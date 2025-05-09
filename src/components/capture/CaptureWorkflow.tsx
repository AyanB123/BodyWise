'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, RotateCcw, ArrowRight, Loader2, Lightbulb, Camera, Video, Mic, PlayCircle, PauseCircle, XCircle } from 'lucide-react';
import type { PosePhoto, UserProfile } from '@/lib/types';
import { POSE_TYPES } from '@/lib/types';
import { aiPoseGuidance, AIPoseGuidanceInput, AIPoseGuidanceOutput, LandmarkPoint } from '@/ai/flows/ai-pose-guidance';
import { useToast } from '@/hooks/use-toast';
import useLocalStorage from '@/hooks/useLocalStorage';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const initialPhotosState: PosePhoto[] = POSE_TYPES.map(pt => ({
  id: pt.id,
  name: pt.name,
  dataUri: null,
  isCorrect: null,
  feedback: null,
}));

const CAPTURE_INTERVAL = 3000; 
const FRAME_WIDTH = 640; 
const FRAME_HEIGHT = 480;

export default function CaptureWorkflow() {
  const [profile] = useLocalStorage<UserProfile | null>('userProfile', null);
  const [photos, setPhotos] = useLocalStorage<PosePhoto[]>('capturedPhotos', initialPhotosState);
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  
  const [isLoadingApi, setIsLoadingApi] = useState(false); 
  const [isAutoCapturing, setIsAutoCapturing] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const [detectedLandmarks, setDetectedLandmarks] = useState<LandmarkPoint[] | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { toast } = useToast();

  const currentPoseInfo = POSE_TYPES[currentPoseIndex];
  const currentPhotoStorage = photos.find(p => p.id === currentPoseInfo?.id);

  const speak = (text: string) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    const getCameraPermission = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast({ title: "Camera Error", description: "Camera not supported by this browser.", variant: "destructive" });
        setHasCameraPermission(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: FRAME_WIDTH, height: FRAME_HEIGHT, facingMode: "user" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasCameraPermission(true);
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings.',
        });
      }
    };
    getCameraPermission();

    return () => { 
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }
      window.speechSynthesis?.cancel(); // Stop any ongoing speech
    };
  }, [toast]);

  useEffect(() => {
    if (!canvasRef.current || !videoRef.current || !detectedLandmarks || detectedLandmarks.length === 0) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'hsl(var(--accent))'; 
    ctx.fillStyle = 'hsl(var(--accent) / 0.7)';
    ctx.lineWidth = 3;

    detectedLandmarks.forEach(landmark => {
      const x = landmark.x * canvas.width;
      const y = landmark.y * canvas.height;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI); 
      ctx.fill();
      ctx.stroke();
    });

  }, [detectedLandmarks, hasCameraPermission]);


  useEffect(() => {
    if (isAutoCapturing && hasCameraPermission && currentPoseInfo) {
      captureIntervalRef.current = setInterval(async () => {
        if (isLoadingApi || !videoRef.current || !canvasRef.current) return;

        setIsLoadingApi(true);
        const video = videoRef.current;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = video.videoWidth;
        tempCanvas.height = video.videoHeight;
        const ctx = tempCanvas.getContext('2d');
        if (!ctx) {
            setIsLoadingApi(false);
            return;
        }
        ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
        const photoDataUri = tempCanvas.toDataURL('image/webp', 0.85);

        const aiInput: AIPoseGuidanceInput = {
          photoDataUri,
          currentPose: `User attempting ${currentPoseInfo.name}.`,
          desiredPose: currentPoseInfo.description,
        };

        try {
          const result: AIPoseGuidanceOutput = await aiPoseGuidance(aiInput);
          setLastFeedback(result.feedback);
          speak(result.feedback); 
          setDetectedLandmarks(result.detectedLandmarks || []);

          if (result.isCorrectPose) {
            speak(`Great! ${currentPoseInfo.name} captured.`);
            toast({ 
              title: "Pose Correct!", 
              description: `${currentPoseInfo.name} captured successfully.`, 
              variant: "default",
              className: "bg-green-600/90 border-green-700 text-white"
            });
            
            setPhotos(prevPhotos =>
              prevPhotos.map(p =>
                p.id === currentPoseInfo.id
                  ? { ...p, dataUri: photoDataUri, isCorrect: true, feedback: result.feedback }
                  : p
              )
            );

            if (currentPoseIndex < POSE_TYPES.length - 1) {
              setCurrentPoseIndex(prev => prev + 1);
              setDetectedLandmarks(null); 
              const nextPose = POSE_TYPES[currentPoseIndex + 1];
              speak(`Next: ${nextPose.name}. ${nextPose.description}`);
              setLastFeedback(`Next: ${nextPose.name}. ${nextPose.description}`);
            } else {
              speak("All poses captured! Well done. You can now view your results.");
              setLastFeedback("All poses captured! Well done. You can now view your results.");
              setIsAutoCapturing(false); 
              if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
            }
          } else {
             toast({ title: "Adjustment Needed", description: result.feedback, variant: "default", className:"bg-yellow-500/90 border-yellow-600 text-black" });
          }
        } catch (error) {
          console.error("AI Pose Guidance Error:", error);
          const errorMessage = "AI analysis unavailable. Please try again shortly.";
          setLastFeedback(errorMessage);
          speak(errorMessage);
          toast({ title: "AI Error", description: errorMessage, variant: "destructive" });
          setDetectedLandmarks(null);
        } finally {
          setIsLoadingApi(false);
        }
      }, CAPTURE_INTERVAL);
    } else {
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }
    }
    return () => { 
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }
    };
  }, [isAutoCapturing, hasCameraPermission, currentPoseIndex, isLoadingApi, photos, setPhotos, toast, currentPoseInfo]);

  const handleStartStopCapture = () => {
    if (!profile || !profile.height || !profile.weight) {
      toast({
        title: "Profile Incomplete",
        description: "Please complete your profile (height, weight, age) before starting photo capture.",
        variant: "destructive",
      });
      return;
    }
    if (!hasCameraPermission) {
        toast({title: "Camera Permission Needed", description: "Please grant camera access to start.", variant: "destructive"});
        return;
    }
    setIsAutoCapturing(!isAutoCapturing);
    if (!isAutoCapturing) {
      const initialMessage = `Starting capture for ${currentPoseInfo.name}. ${currentPoseInfo.description}`;
      setLastFeedback(initialMessage);
      speak(`Automated capture starting. First pose: ${currentPoseInfo.name}. ${currentPoseInfo.description}`);
      setDetectedLandmarks(null); 
    } else {
      speak("Capture paused.");
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
    }
  };
  
  const resetCurrentPose = () => {
    if (!currentPoseInfo) return;
    setPhotos(prevPhotos => 
      prevPhotos.map(p => p.id === currentPoseInfo.id ? {...initialPhotosState.find(ip => ip.id === currentPoseInfo.id)!} : p)
    );
    setLastFeedback(null);
    setDetectedLandmarks(null);
    if (isAutoCapturing) { 
        speak(`Retrying ${currentPoseInfo.name}. ${currentPoseInfo.description}`);
        setLastFeedback(`Retrying ${currentPoseInfo.name}. ${currentPoseInfo.description}`);
    }
    toast({ title: "Pose Reset", description: `Instructions for ${currentPoseInfo.name} shown again.`});
  }

  const capturedCount = photos.filter(p => p.isCorrect).length;
  const progressPercentage = (capturedCount / POSE_TYPES.length) * 100;
  const allPhotosCaptured = capturedCount === POSE_TYPES.length;

  if (hasCameraPermission === null) {
    return <div className="flex flex-col justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /> <p className="mt-4 text-lg text-muted-foreground">Initializing Camera...</p></div>;
  }

  return (
    <Card className="w-full max-w-4xl mx-auto shadow-2xl overflow-hidden">
      <CardHeader className="bg-gradient-to-br from-card to-secondary/30 p-6">
        <CardTitle className="text-3xl md:text-4xl font-bold flex items-center text-foreground">
          <Camera className="mr-3 h-8 w-8 text-primary" />
          AI Guided Photo Capture
        </CardTitle>
        <CardDescription className="text-base text-foreground/70">
          Follow the on-screen and audio guidance for optimal results. The system will capture photos automatically.
        </CardDescription>
        <div className="mt-4 space-y-2">
          <Progress value={progressPercentage} className="w-full h-3 transition-all duration-500" />
          <p className="text-sm text-muted-foreground font-medium">{capturedCount} of {POSE_TYPES.length} poses captured ({Math.round(progressPercentage)}%)</p>
        </div>
      </CardHeader>
      <CardContent className="p-4 md:p-6 space-y-6">
        {!profile || !profile.height || !profile.weight ? (
           <Alert variant="destructive" className="shadow-md">
            <XCircle className="h-6 w-6" />
            <AlertTitle className="text-lg">Profile Incomplete</AlertTitle>
            <AlertDescription className="text-base">
              Accurate height, weight, and age are essential for analysis. Please 
              <Link href="/profile" className="font-semibold underline hover:text-destructive-foreground ml-1">complete your profile</Link> before starting.
            </AlertDescription>
          </Alert>
        ) : !hasCameraPermission ? (
          <Alert variant="destructive" className="shadow-md">
            <Video className="h-6 w-6" />
            <AlertTitle className="text-lg">Camera Access Required</AlertTitle>
            <AlertDescription className="text-base">
              BodyWise needs camera access to capture your poses. Please enable camera permissions in your browser settings and refresh.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="relative w-full aspect-[4/3] bg-muted/50 rounded-lg overflow-hidden border-2 border-border shadow-inner">
              <video ref={videoRef} className="w-full h-full object-cover transform scale-x-[-1]" autoPlay muted playsInline />
              <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full transform scale-x-[-1]" />
              {isLoadingApi && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
                  <Loader2 className="mr-2 h-10 w-10 animate-spin text-white" />
                  <p className="text-white text-xl font-medium mt-2">Analyzing Pose...</p>
                </div>
              )}
            </div>

            {currentPoseInfo && (
                 <Alert variant="default" className={cn(
                    "shadow-md transition-all duration-300",
                    photos.find(p=>p.id === currentPoseInfo.id)?.isCorrect ? "bg-green-500/10 border-green-500/30 text-green-700" : "bg-primary/10 border-primary/30 text-primary"
                  )}>
                    <Lightbulb className={cn("h-6 w-6", photos.find(p=>p.id === currentPoseInfo.id)?.isCorrect ? "text-green-600" : "text-primary")} />
                    <AlertTitle className={cn("text-lg font-semibold", photos.find(p=>p.id === currentPoseInfo.id)?.isCorrect ? "text-green-700" : "text-primary-dark")}>
                        {photos.find(p=>p.id === currentPoseInfo.id)?.isCorrect ? "Captured: " : "Current Pose: "} {currentPoseInfo.name}
                        {photos.find(p=>p.id === currentPoseInfo.id)?.isCorrect ? <CheckCircle className="inline h-6 w-6 text-green-600 ml-2" /> : null}
                    </AlertTitle>
                    <AlertDescription className="text-base">{currentPoseInfo.description}</AlertDescription>
                </Alert>
            )}

            {lastFeedback && !photos.find(p=>p.id === currentPoseInfo?.id)?.isCorrect && (
                <Alert variant={photos.find(p=>p.id === currentPoseInfo?.id)?.isCorrect ? "default" : "default"} 
                       className={cn("shadow-md transition-all duration-300", photos.find(p=>p.id === currentPoseInfo?.id)?.isCorrect ? "bg-green-500/10 border-green-500/30" : "bg-accent/10 border-accent/30")}>
                    <Mic className={cn("h-6 w-6", photos.find(p=>p.id === currentPoseInfo?.id)?.isCorrect ? "text-green-600" : "text-accent")} />
                    <AlertTitle className={cn("text-lg font-semibold", photos.find(p=>p.id === currentPoseInfo?.id)?.isCorrect ? "text-green-700" : "text-accent-dark")}>AI Feedback</AlertTitle>
                    <AlertDescription className="text-base">{lastFeedback}</AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                <Button 
                    onClick={handleStartStopCapture} 
                    size="lg" 
                    disabled={isLoadingApi || allPhotosCaptured}
                    className="w-full text-lg py-6 shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                >
                    {isAutoCapturing ? <PauseCircle className="mr-2 h-6 w-6" /> : <PlayCircle className="mr-2 h-6 w-6" />}
                    {isAutoCapturing ? 'Pause' : (progressPercentage > 0 && progressPercentage < 100) ? 'Resume' : 'Start Capture'}
                </Button>
                {currentPhotoStorage?.dataUri && !currentPhotoStorage.isCorrect && (
                     <Button 
                        onClick={resetCurrentPose} 
                        variant="outline" 
                        size="lg" 
                        disabled={isLoadingApi}
                        className="w-full text-lg py-6 shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                    >
                        <RotateCcw className="mr-2 h-5 w-5" /> Retry Current
                    </Button>
                )}
            </div>
            
            {photos.filter(p => p.dataUri).length > 0 && (
              <div className="mt-8">
                <h4 className="text-xl font-semibold mb-3 text-foreground">Captured Snapshots:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {photos.map(photo => photo.dataUri ? (
                    <div key={photo.id} className="relative aspect-[3/4] border-2 border-border rounded-lg p-1 shadow-sm hover:shadow-md transition-shadow duration-300">
                      <Image src={photo.dataUri} alt={photo.name} layout="fill" objectFit="contain" className="rounded-md"/>
                      <div className={`absolute top-2 right-2 p-1 rounded-full shadow-lg ${photo.isCorrect ? 'bg-green-500' : 'bg-destructive'}`}>
                        {photo.isCorrect ? <CheckCircle className="h-4 w-4 text-white"/> : <AlertTriangle className="h-4 w-4 text-white"/>}
                      </div>
                      <p className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-xs bg-black/60 text-white px-2 py-1 rounded-full shadow-sm">{photo.name}</p>
                    </div>
                  ): null)}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
      <CardFooter className="p-6 bg-secondary/30">
        {allPhotosCaptured ? (
          <Link href="/results" className="w-full">
            <Button size="lg" className="w-full text-lg py-6 bg-accent hover:bg-accent/80 text-accent-foreground shadow-lg hover:shadow-accent/40 transition-all duration-300 transform hover:scale-105">
              View My Analysis <ArrowRight className="ml-2 h-6 w-6" />
            </Button>
          </Link>
        ) : (
          <Button size="lg" disabled className="w-full text-lg py-6">
            Complete All Poses to View Analysis
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
