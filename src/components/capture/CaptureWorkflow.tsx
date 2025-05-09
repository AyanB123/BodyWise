
'use client';

import { useState, useEffect, useRef, ChangeEvent } from 'react';
import Image from 'next/image'; // Keep for potential fallback or results display
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, RotateCcw, ArrowRight, Loader2, Lightbulb, Camera, Video, Mic, PlayCircle, PauseCircle, XCircle } from 'lucide-react';
import type { PosePhoto, PoseType, UserProfile } from '@/lib/types'; // Added UserProfile
import { POSE_TYPES } from '@/lib/types';
import { aiPoseGuidance, AIPoseGuidanceInput, AIPoseGuidanceOutput, LandmarkPoint } from '@/ai/flows/ai-pose-guidance';
import { useToast } from '@/hooks/use-toast';
import useLocalStorage from '@/hooks/useLocalStorage';
import Link from 'next/link';

const initialPhotosState: PosePhoto[] = POSE_TYPES.map(pt => ({
  id: pt.id,
  name: pt.name,
  dataUri: null,
  isCorrect: null,
  feedback: null,
}));

const CAPTURE_INTERVAL = 3000; // Capture frame every 3 seconds
const FRAME_WIDTH = 640; // Width to capture frames at
const FRAME_HEIGHT = 480; // Height to capture frames at

export default function CaptureWorkflow() {
  const [profile] = useLocalStorage<UserProfile | null>('userProfile', null);
  const [photos, setPhotos] = useLocalStorage<PosePhoto[]>('capturedPhotos', initialPhotosState);
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  
  const [isLoadingApi, setIsLoadingApi] = useState(false); // For AI call
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

  // Utility to speak text
  const speak = (text: string) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Request Camera Permission
  useEffect(() => {
    const getCameraPermission = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast({ title: "Camera Error", description: "Camera not supported by this browser.", variant: "destructive" });
        setHasCameraPermission(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: FRAME_WIDTH, height: FRAME_HEIGHT } });
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

    return () => { // Cleanup: stop video stream when component unmounts
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }
    };
  }, [toast]);

  // Drawing landmarks on canvas
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current || !detectedLandmarks || detectedLandmarks.length === 0) {
      // Clear canvas if no landmarks or refs not ready
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

    // Match canvas dimensions to video display dimensions
    // This assumes video is displayed at its intrinsic size or styled to a specific size
    // For simplicity, using video intrinsic dimensions for drawing.
    // For responsive designs, canvas size should sync with video's rendered size.
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'hsl(var(--accent))'; // Use accent color for landmarks
    ctx.fillStyle = 'hsl(var(--accent))';
    ctx.lineWidth = 2;

    detectedLandmarks.forEach(landmark => {
      const x = landmark.x * canvas.width;
      const y = landmark.y * canvas.height;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI); // Draw a small circle for each landmark
      ctx.fill();
      // Optional: Draw landmark name
      // ctx.fillStyle = 'white';
      // ctx.fillText(landmark.name, x + 7, y - 7);
    });

  }, [detectedLandmarks, hasCameraPermission]);


  // Auto-capture loop
  useEffect(() => {
    if (isAutoCapturing && hasCameraPermission && currentPoseInfo) {
      captureIntervalRef.current = setInterval(async () => {
        if (isLoadingApi || !videoRef.current || !canvasRef.current) return;

        setIsLoadingApi(true);
        const video = videoRef.current;
        const tempCanvas = document.createElement('canvas'); // Use a temporary canvas for frame capture
        tempCanvas.width = video.videoWidth;
        tempCanvas.height = video.videoHeight;
        const ctx = tempCanvas.getContext('2d');
        if (!ctx) {
            setIsLoadingApi(false);
            return;
        }
        ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
        const photoDataUri = tempCanvas.toDataURL('image/webp', 0.8); // Use webp for better compression

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
            speak(`Correct ${currentPoseInfo.name} pose captured!`);
            toast({ title: "Pose Correct!", description: `${currentPoseInfo.name} captured successfully.`, variant: "default" });
            
            setPhotos(prevPhotos =>
              prevPhotos.map(p =>
                p.id === currentPoseInfo.id
                  ? { ...p, dataUri: photoDataUri, isCorrect: true, feedback: result.feedback }
                  : p
              )
            );

            if (currentPoseIndex < POSE_TYPES.length - 1) {
              setCurrentPoseIndex(prev => prev + 1);
              setDetectedLandmarks(null); // Clear landmarks for next pose
              const nextPose = POSE_TYPES[currentPoseIndex + 1];
              speak(`Now, let's capture the ${nextPose.name}. ${nextPose.description}`);
            } else {
              speak("All poses captured! You can now view your results.");
              setIsAutoCapturing(false); // Stop capture
              if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
            }
          }
        } catch (error) {
          console.error("AI Pose Guidance Error:", error);
          const errorMessage = "AI analysis failed. Please try again.";
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
    return () => { // Cleanup interval on effect change or unmount
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }
    };
  }, [isAutoCapturing, hasCameraPermission, currentPoseIndex, isLoadingApi, photos, setPhotos, toast, currentPoseInfo]);

  const handleStartStopCapture = () => {
    if (!profile || !profile.height || !profile.weight) {
      toast({
        title: "Profile Incomplete",
        description: "Please complete your profile before starting photo capture.",
        variant: "destructive",
      });
      // Optionally, navigate to profile page or show a link
      return;
    }
    if (!hasCameraPermission) {
        toast({title: "Camera Permission Needed", description: "Please grant camera access to start.", variant: "destructive"});
        return;
    }
    setIsAutoCapturing(!isAutoCapturing);
    if (!isAutoCapturing) {
      setLastFeedback(`Starting capture for ${currentPoseInfo.name}. ${currentPoseInfo.description}`);
      speak(`Starting automated capture. First pose: ${currentPoseInfo.name}. ${currentPoseInfo.description}`);
      setDetectedLandmarks(null); // Clear landmarks when starting a new session or pose
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
    if (isAutoCapturing) { // Restart capture for this pose
        speak(`Retrying ${currentPoseInfo.name}. ${currentPoseInfo.description}`);
    }
    toast({ title: "Pose Reset", description: `Instructions for ${currentPoseInfo.name} shown again.`});
  }

  const capturedCount = photos.filter(p => p.isCorrect).length;
  const progressPercentage = (capturedCount / POSE_TYPES.length) * 100;
  const allPhotosCaptured = capturedCount === POSE_TYPES.length;

  if (hasCameraPermission === null) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Checking camera...</p></div>;
  }

  return (
    <Card className="w-full max-w-3xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-3xl flex items-center"><Camera className="mr-3 h-8 w-8 text-primary" />Automated Photo Capture</CardTitle>
        <CardDescription>
          The system will guide you through capturing {POSE_TYPES.length} poses. Follow the audio and on-screen feedback.
        </CardDescription>
        <Progress value={progressPercentage} className="w-full mt-2" />
        <p className="text-sm text-muted-foreground mt-1">{capturedCount} of {POSE_TYPES.length} poses captured correctly.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!profile || !profile.height || !profile.weight ? (
           <Alert variant="destructive">
            <XCircle className="h-5 w-5" />
            <AlertTitle>Profile Incomplete</AlertTitle>
            <AlertDescription>
              Please <Link href="/profile" className="underline hover:text-destructive-foreground">complete your profile</Link> before starting the capture process. 
              Accurate height, weight, and age are needed for analysis.
            </AlertDescription>
          </Alert>
        ) : !hasCameraPermission ? (
          <Alert variant="destructive">
            <Video className="h-5 w-5" />
            <AlertTitle>Camera Access Required</AlertTitle>
            <AlertDescription>
              BodyWise needs access to your camera to capture photos. Please enable camera permissions in your browser settings and refresh the page.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="relative w-full aspect-video bg-muted rounded-md overflow-hidden border">
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
              <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
              {isLoadingApi && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Loader2 className="mr-2 h-8 w-8 animate-spin text-white" />
                  <p className="text-white text-lg">Analyzing...</p>
                </div>
              )}
            </div>

            {currentPoseInfo && (
                 <Alert variant="default" className="bg-primary/10 border-primary/30">
                    <Lightbulb className="h-5 w-5 text-primary" />
                    <AlertTitle className="text-primary">
                        Capturing: {currentPoseInfo.name} {photos.find(p=>p.id === currentPoseInfo.id)?.isCorrect ? <CheckCircle className="inline h-5 w-5 text-green-500 ml-2" /> : null}
                    </AlertTitle>
                    <AlertDescription>{currentPoseInfo.description}</AlertDescription>
                </Alert>
            )}

            {lastFeedback && (
                <Alert variant={photos.find(p=>p.id === currentPoseInfo?.id)?.isCorrect ? "default" : "destructive"} className={photos.find(p=>p.id === currentPoseInfo?.id)?.isCorrect ? "bg-green-500/10 border-green-500/30" : ""}>
                    <Mic className="h-5 w-5" />
                    <AlertTitle>AI Feedback</AlertTitle>
                    <AlertDescription>{lastFeedback}</AlertDescription>
                </Alert>
            )}

            <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button onClick={handleStartStopCapture} size="lg" disabled={isLoadingApi || allPhotosCaptured}>
                    {isAutoCapturing ? <PauseCircle className="mr-2" /> : <PlayCircle className="mr-2" />}
                    {isAutoCapturing ? 'Pause Capture' : (progressPercentage > 0 && progressPercentage < 100) ? 'Resume Capture' : 'Start Automated Capture'}
                </Button>
                {currentPhotoStorage?.dataUri && !currentPhotoStorage.isCorrect && (
                     <Button onClick={resetCurrentPose} variant="outline" size="lg" disabled={isLoadingApi}>
                        <RotateCcw className="mr-2 h-4 w-4" /> Retry Current Pose
                    </Button>
                )}
            </div>
            {/* Display saved photos thumbnails if needed */}
            {photos.filter(p => p.dataUri).length > 0 && (
              <div>
                <h4 className="text-md font-semibold mb-2 mt-4">Captured Photos:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {photos.map(photo => photo.dataUri ? (
                    <div key={photo.id} className="relative aspect-square border rounded-md p-1">
                      <Image src={photo.dataUri} alt={photo.name} layout="fill" objectFit="contain" className="rounded-sm"/>
                      <div className={`absolute top-1 right-1 p-0.5 rounded-full ${photo.isCorrect ? 'bg-green-500' : 'bg-destructive'}`}>
                        {photo.isCorrect ? <CheckCircle className="h-4 w-4 text-white"/> : <AlertCircle className="h-4 w-4 text-white"/>}
                      </div>
                      <p className="absolute bottom-1 left-1 text-xs bg-black/50 text-white px-1 py-0.5 rounded">{photo.name}</p>
                    </div>
                  ): null)}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
      <CardFooter className="flex justify-end">
        {allPhotosCaptured ? (
          <Link href="/results">
            <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground">
              View Results <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        ) : (
          <Button size="lg" disabled>
            Complete All Poses to View Results
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
