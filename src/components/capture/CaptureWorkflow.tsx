'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, RotateCcw, ArrowRight, Loader2, Lightbulb, Camera, Video, Mic, PlayCircle, PauseCircle, XCircle, Sparkles, ThumbsUp, ScanLine, UserCircle } from 'lucide-react';
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

const CAPTURE_INTERVAL_MS = 3500; // Time between AI checks
const PHOTO_CONFIRMATION_DELAY_MS = 1500; // Time to show "Captured!" message
const NEXT_POSE_DELAY_MS = 2500; // Time before starting next pose

const FRAME_WIDTH = 640;
const FRAME_HEIGHT = 480;

type CapturePhase =
  | 'IDLE' // Initial state, profile/camera checks
  | 'READY_TO_START' // Profile & camera OK, waiting for user to start
  | 'INITIALIZING_POSE' // Setting up for the current pose
  | 'GUIDING' // Actively showing camera and waiting for AI feedback
  | 'ANALYZING' // AI is processing the image
  | 'CAPTURING_PHOTO' // Brief moment of "taking" the picture
  | 'POSE_CONFIRMED' // Pose was correct, photo saved
  | 'ALL_POSES_CAPTURED' // All poses done
  | 'CAMERA_ERROR'
  | 'PROFILE_INCOMPLETE';

type PoseCorrectness = 'NEUTRAL' | 'CORRECT' | 'ADJUSTMENT_NEEDED';

export default function CaptureWorkflow() {
  const [profile] = useLocalStorage<UserProfile | null>('userProfile', null);
  const [photos, setPhotos] = useLocalStorage<PosePhoto[]>('capturedPhotos', initialPhotosState);
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  
  const [capturePhase, setCapturePhase] = useState<CapturePhase>('IDLE');
  const [poseCorrectness, setPoseCorrectness] = useState<PoseCorrectness>('NEUTRAL');
  
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [aiFeedbackText, setAiFeedbackText] = useState<string | null>(null);
  const [detectedLandmarks, setDetectedLandmarks] = useState<LandmarkPoint[] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false); // General processing state for AI or delays

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const guidanceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const phaseTransitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { toast } = useToast();

  const currentPoseInfo = POSE_TYPES[currentPoseIndex];
  const currentPhotoStorage = photos.find(p => p.id === currentPoseInfo?.id);

  const speak = useCallback((text: string) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.95;
      window.speechSynthesis.cancel(); // Cancel any previous speech
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // Initial Setup: Check profile and camera permissions
  useEffect(() => {
    if (capturePhase !== 'IDLE') return;

    if (!profile || !profile.height || !profile.weight || !profile.age) {
      setCapturePhase('PROFILE_INCOMPLETE');
      return;
    }

    const getCameraPermission = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast({ title: "Camera Error", description: "Camera not supported by this browser.", variant: "destructive" });
        setHasCameraPermission(false);
        setCapturePhase('CAMERA_ERROR');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: FRAME_WIDTH, height: FRAME_HEIGHT, facingMode: "user" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasCameraPermission(true);
        setCapturePhase('READY_TO_START');
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        setCapturePhase('CAMERA_ERROR');
        toast({ variant: 'destructive', title: 'Camera Access Denied', description: 'Please enable camera permissions.' });
      }
    };
    getCameraPermission();
  }, [capturePhase, profile, toast]);

  // Cleanup effect for camera and timeouts
  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      if (guidanceIntervalRef.current) clearInterval(guidanceIntervalRef.current);
      if (phaseTransitionTimeoutRef.current) clearTimeout(phaseTransitionTimeoutRef.current);
      window.speechSynthesis?.cancel();
    };
  }, []);

  // Draw landmarks on canvas
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current || !detectedLandmarks || detectedLandmarks.length === 0 || !hasCameraPermission) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas if no landmarks or no permission
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
    
    const color = poseCorrectness === 'CORRECT' ? 'hsl(var(--accent))' : 'hsl(var(--primary))';
    ctx.strokeStyle = color;
    ctx.fillStyle = cn(color, 'opacity-70');
    ctx.lineWidth = video.videoWidth > 320 ? 3 : 2;

    detectedLandmarks.forEach(landmark => {
      const x = landmark.x * canvas.width;
      const y = landmark.y * canvas.height;
      ctx.beginPath();
      ctx.arc(x, y, video.videoWidth > 320 ? 6 : 4, 0, 2 * Math.PI); 
      ctx.fill();
      ctx.stroke();
    });
  }, [detectedLandmarks, hasCameraPermission, poseCorrectness]);

  // Core AI Guidance Loop
  const runAiGuidance = useCallback(async () => {
    if (!currentPoseInfo || !videoRef.current || !canvasRef.current || isProcessing) return;

    setIsProcessing(true);
    setCapturePhase('ANALYZING');
    setAiFeedbackText("Analyzing your pose...");

    const video = videoRef.current;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) {
        setIsProcessing(false);
        setCapturePhase('GUIDING');
        return;
    }
    ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    const photoDataUri = tempCanvas.toDataURL('image/webp', 0.8);

    const aiInput: AIPoseGuidanceInput = {
      photoDataUri,
      currentPose: `User attempting ${currentPoseInfo.name}.`,
      desiredPose: currentPoseInfo.description,
    };

    try {
      const result: AIPoseGuidanceOutput = await aiPoseGuidance(aiInput);
      setAiFeedbackText(result.feedback);
      setDetectedLandmarks(result.detectedLandmarks || []);

      if (result.isCorrectPose) {
        setPoseCorrectness('CORRECT');
        setCapturePhase('CAPTURING_PHOTO');
        speak(`Perfect! Capturing ${currentPoseInfo.name}. Hold still.`);
        
        phaseTransitionTimeoutRef.current = setTimeout(() => {
          setPhotos(prevPhotos =>
            prevPhotos.map(p =>
              p.id === currentPoseInfo.id
                ? { ...p, dataUri: photoDataUri, isCorrect: true, feedback: "Pose captured successfully." }
                : p
            )
          );
          setAiFeedbackText(`${currentPoseInfo.name} captured!`);
          setCapturePhase('POSE_CONFIRMED');
          speak("Got it!");

          phaseTransitionTimeoutRef.current = setTimeout(() => {
            if (currentPoseIndex < POSE_TYPES.length - 1) {
              setCurrentPoseIndex(prev => prev + 1);
              setCapturePhase('INITIALIZING_POSE');
            } else {
              setCapturePhase('ALL_POSES_CAPTURED');
              speak("All poses captured! Fantastic work.");
              setAiFeedbackText("All poses captured! You can now view your analysis.");
              if (guidanceIntervalRef.current) clearInterval(guidanceIntervalRef.current);
            }
          }, PHOTO_CONFIRMATION_DELAY_MS);
        }, 750); // Short delay for "capturing" feel

      } else {
        setPoseCorrectness('ADJUSTMENT_NEEDED');
        speak(result.feedback);
        setCapturePhase('GUIDING');
        toast({ title: "Adjustment Needed", description: result.feedback, variant: "default", className:"bg-yellow-500/90 border-yellow-600 text-black dark:text-white" });
      }
    } catch (error) {
      console.error("AI Pose Guidance Error:", error);
      const errorMessage = "AI analysis is currently unavailable. Please try again in a moment.";
      setAiFeedbackText(errorMessage);
      speak(errorMessage);
      toast({ title: "AI Error", description: errorMessage, variant: "destructive" });
      setDetectedLandmarks(null);
      setPoseCorrectness('NEUTRAL');
      setCapturePhase('GUIDING'); // Revert to guiding to allow retry
    } finally {
      setIsProcessing(false);
    }
  }, [currentPoseInfo, isProcessing, photos, setPhotos, toast, speak, currentPoseIndex]);


  // Effect to manage guidance interval based on capturePhase
  useEffect(() => {
    if (capturePhase === 'GUIDING' && hasCameraPermission && !isProcessing) {
      if (guidanceIntervalRef.current) clearInterval(guidanceIntervalRef.current); // Clear previous interval
      guidanceIntervalRef.current = setInterval(runAiGuidance, CAPTURE_INTERVAL_MS);
    } else {
      if (guidanceIntervalRef.current) {
        clearInterval(guidanceIntervalRef.current);
        guidanceIntervalRef.current = null;
      }
    }
    
    // Cleanup interval on unmount or when dependencies change that stop the interval
    return () => {
      if (guidanceIntervalRef.current) {
        clearInterval(guidanceIntervalRef.current);
      }
    };
  }, [capturePhase, hasCameraPermission, isProcessing, runAiGuidance]);


  // Effect to handle pose initialization
  useEffect(() => {
    if (capturePhase === 'INITIALIZING_POSE' && currentPoseInfo) {
      setPoseCorrectness('NEUTRAL');
      setDetectedLandmarks(null);
      const initialMessage = `Next up: ${currentPoseInfo.name}. ${currentPoseInfo.description}`;
      setAiFeedbackText(initialMessage);
      speak(`Prepare for ${currentPoseInfo.name}. ${currentPoseInfo.description}`);
      
      // Transition to GUIDING after a brief delay for user to prepare
      phaseTransitionTimeoutRef.current = setTimeout(() => {
        setCapturePhase('GUIDING');
      }, NEXT_POSE_DELAY_MS);
    }
  }, [capturePhase, currentPoseInfo, speak]);


  const handleStartCapture = () => {
    if (capturePhase === 'READY_TO_START' || capturePhase === 'IDLE' && hasCameraPermission && profile) {
      setCurrentPoseIndex(0); // Reset to first pose
      setPhotos(initialPhotosState); // Reset photos
      setCapturePhase('INITIALIZING_POSE');
    } else if (capturePhase === 'GUIDING' || capturePhase === 'ANALYZING' || capturePhase === 'POSE_CONFIRMED' || capturePhase === 'CAPTURING_PHOTO') {
      // This button now acts as a pause/resume, effectively stopping/restarting the GUIDING phase.
      if (guidanceIntervalRef.current) { // If currently running, pause it
        clearInterval(guidanceIntervalRef.current);
        guidanceIntervalRef.current = null;
        setCapturePhase('READY_TO_START'); // Or a new 'PAUSED' state if more granular control is needed
        speak("Capture paused.");
        setAiFeedbackText("Capture paused. Press Start to resume.");
      } else { // If paused, resume
        setCapturePhase('INITIALIZING_POSE'); // Re-initialize current pose
      }
    }
  };
  
  const handleRetryCurrentPose = () => {
    if (!currentPoseInfo) return;
    if (guidanceIntervalRef.current) clearInterval(guidanceIntervalRef.current);
    setIsProcessing(false); // Reset processing flag
    setPhotos(prevPhotos => 
      prevPhotos.map(p => p.id === currentPoseInfo.id ? {...initialPhotosState.find(ip => ip.id === currentPoseInfo.id)!} : p)
    );
    setCapturePhase('INITIALIZING_POSE'); // Re-initialize the current pose
    toast({ title: "Pose Reset", description: `Retrying ${currentPoseInfo.name}.`});
  };

  const capturedCount = photos.filter(p => p.isCorrect).length;
  const progressPercentage = (capturedCount / POSE_TYPES.length) * 100;

  const getVideoBorderColor = () => {
    if (capturePhase === 'CAPTURING_PHOTO') return 'border-green-400 shadow-green-500/50';
    switch (poseCorrectness) {
      case 'CORRECT': return 'border-green-500 shadow-green-500/30';
      case 'ADJUSTMENT_NEEDED': return 'border-primary shadow-primary/30'; // Burnt Orange
      case 'NEUTRAL':
      default: return 'border-teal-500 shadow-teal-500/30'; // Teal
    }
  };

  const getFeedbackIcon = () => {
    if (capturePhase === 'ANALYZING') return <ScanLine className="h-6 w-6 text-blue-400 animate-pulse" />;
    if (capturePhase === 'CAPTURING_PHOTO') return <Camera className="h-6 w-6 text-green-400 animate-ping" />;
    if (capturePhase === 'POSE_CONFIRMED') return <ThumbsUp className="h-6 w-6 text-green-500" />;
    if (poseCorrectness === 'CORRECT') return <CheckCircle className="h-6 w-6 text-green-500" />;
    if (poseCorrectness === 'ADJUSTMENT_NEEDED') return <AlertTriangle className="h-6 w-6 text-primary" />;
    return <Lightbulb className="h-6 w-6 text-teal-400" />;
  };
  
  const getActionButton = () => {
    if (capturePhase === 'ALL_POSES_CAPTURED') {
      return (
        <Link href="/results" className="w-full md:w-auto">
          <Button size="lg" className="w-full text-lg py-3 px-6 bg-accent hover:bg-accent/80 text-accent-foreground shadow-lg hover:shadow-accent/40 transition-all duration-300 transform hover:scale-105 flex items-center">
            View My Analysis <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Link>
      );
    }

    const isCapturingActive = ['INITIALIZING_POSE', 'GUIDING', 'ANALYZING', 'CAPTURING_PHOTO', 'POSE_CONFIRMED'].includes(capturePhase);

    return (
      <Button 
        onClick={handleStartCapture} 
        size="lg" 
        disabled={isProcessing || capturePhase === 'CAMERA_ERROR' || capturePhase === 'PROFILE_INCOMPLETE' || capturePhase === 'CAPTURING_PHOTO' || capturePhase === 'POSE_CONFIRMED'}
        className={cn(
            "w-full md:w-auto text-lg py-3 px-6 shadow-lg hover:shadow-primary/40 transition-all duration-300 transform hover:scale-105 flex items-center",
            isCapturingActive && !guidanceIntervalRef.current && capturePhase !== 'READY_TO_START' ? "bg-primary hover:bg-primary/80" : "bg-primary hover:bg-primary/80" // Style for Paused vs Start/Resume
        )}
      >
        {isCapturingActive && guidanceIntervalRef.current ? <PauseCircle className="mr-2 h-6 w-6" /> : <PlayCircle className="mr-2 h-6 w-6" />}
        {isCapturingActive && guidanceIntervalRef.current ? 'Pause Capture' : (capturedCount > 0 && capturedCount < POSE_TYPES.length && capturePhase === 'READY_TO_START' ? 'Resume Capture' : 'Start Capture')}
      </Button>
    );
  };


  // Render Logic based on capturePhase
  if (capturePhase === 'IDLE' && hasCameraPermission === null) {
    return <div className="flex flex-col justify-center items-center min-h-[70vh] p-4"><Loader2 className="h-12 w-12 animate-spin text-primary" /> <p className="mt-4 text-lg text-muted-foreground">Initializing Camera...</p></div>;
  }
  if (capturePhase === 'PROFILE_INCOMPLETE') {
    return (
      <Card className="w-full max-w-lg mx-auto my-8 shadow-xl">
        <CardHeader><CardTitle className="text-2xl text-destructive flex items-center"><UserCircle className="mr-2"/>Profile Incomplete</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">Please complete your profile (height, weight, age) to begin AI-guided photo capture.</p>
          <Link href="/profile">
            <Button className="w-full bg-primary hover:bg-primary/80">Go to Profile</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }
   if (capturePhase === 'CAMERA_ERROR' || (capturePhase !== 'IDLE' && !hasCameraPermission)) {
    return (
      <Card className="w-full max-w-lg mx-auto my-8 shadow-xl">
        <CardHeader><CardTitle className="text-2xl text-destructive flex items-center"><Video className="mr-2"/>Camera Access Required</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">BodyWise needs camera access. Please enable it in your browser settings and refresh the page.</p>
           <Button onClick={() => window.location.reload()} className="w-full">Refresh Page</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto py-4 md:py-8 px-2 md:px-4">
      <Card className="w-full max-w-3xl mx-auto shadow-2xl bg-card/80 backdrop-blur-md border-border/20">
        <CardHeader className="border-b border-border/20 p-4 md:p-6">
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl md:text-3xl font-bold flex items-center text-primary">
              <Camera className="mr-2.5 h-7 w-7" />
              AI Photo Capture
            </CardTitle>
            {currentPoseInfo && capturePhase !== 'ALL_POSES_CAPTURED' && (
              <span className="text-sm font-medium text-muted-foreground bg-secondary px-3 py-1.5 rounded-full">
                Pose {currentPoseIndex + 1} of {POSE_TYPES.length}
              </span>
            )}
          </div>
          <CardDescription className="text-sm md:text-base text-foreground/70 mt-1">
            {capturePhase === 'ALL_POSES_CAPTURED' ? "All photos captured successfully!" : "Follow audio and visual cues for optimal results."}
          </CardDescription>
          <Progress value={progressPercentage} className="w-full h-2.5 mt-3 transition-all duration-500 bg-secondary [&>div]:bg-gradient-to-r [&>div]:from-teal-500 [&>div]:to-primary" />
        </CardHeader>

        <CardContent className="p-3 md:p-6 space-y-4 md:space-y-6">
          <div className={cn(
            "relative w-full aspect-[4/3] bg-muted/30 rounded-xl overflow-hidden border-4 transition-all duration-300 ease-in-out shadow-lg",
            getVideoBorderColor()
          )}>
            <video ref={videoRef} className="w-full h-full object-cover transform scale-x-[-1]" autoPlay muted playsInline />
            <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full transform scale-x-[-1]" />
            {['ANALYZING', 'CAPTURING_PHOTO'].includes(capturePhase) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm text-white z-10">
                {capturePhase === 'ANALYZING' && <ScanLine className="h-12 w-12 animate-pulse text-blue-300" />}
                {capturePhase === 'CAPTURING_PHOTO' && <Camera className="h-12 w-12 animate-ping text-green-300" />}
                <p className="text-lg font-semibold mt-3">
                  {capturePhase === 'ANALYZING' ? 'Analyzing Pose...' : 'Capturing Photo...'}
                </p>
              </div>
            )}
          </div>

          {currentPoseInfo && (
            <div className={cn(
                "p-3 md:p-4 rounded-lg border transition-all duration-300",
                poseCorrectness === 'CORRECT' ? 'bg-green-500/10 border-green-500/30' : 
                poseCorrectness === 'ADJUSTMENT_NEEDED' ? 'bg-primary/10 border-primary/30' :
                'bg-teal-500/10 border-teal-500/30'
            )}>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 pt-0.5">
                  {getFeedbackIcon()}
                </div>
                <div className="flex-grow">
                  <p className={cn(
                      "text-md md:text-lg font-semibold",
                       poseCorrectness === 'CORRECT' ? 'text-green-700 dark:text-green-300' : 
                       poseCorrectness === 'ADJUSTMENT_NEEDED' ? 'text-primary dark:text-orange-300' :
                       'text-teal-700 dark:text-teal-300'
                  )}>
                    {capturePhase === 'POSE_CONFIRMED' ? `${currentPoseInfo.name} Confirmed!` : currentPoseInfo.name}
                  </p>
                  <p className="text-sm md:text-base text-foreground/80 leading-relaxed">
                    {aiFeedbackText || currentPoseInfo.description}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {getActionButton()}
            {(['GUIDING', 'ANALYZING', 'INITIALIZING_POSE'].includes(capturePhase) && currentPhotoStorage && !currentPhotoStorage.isCorrect && capturedCount < POSE_TYPES.length && currentPoseIndex < POSE_TYPES.length) && (
                 <Button 
                    onClick={handleRetryCurrentPose} 
                    variant="outline" 
                    size="lg" 
                    disabled={isProcessing || capturePhase === 'CAPTURING_PHOTO' || capturePhase === 'POSE_CONFIRMED'}
                    className="w-full sm:w-auto text-lg py-3 px-6 border-primary/50 hover:border-primary text-primary shadow-md"
                >
                    <RotateCcw className="mr-2 h-5 w-5" /> Retry
                </Button>
            )}
          </div>
        </CardContent>

        {photos.filter(p => p.dataUri).length > 0 && capturePhase !== 'ALL_POSES_CAPTURED' && (
          <CardFooter className="p-3 md:p-6 border-t border-border/20 flex-col items-start">
            <h4 className="text-md font-semibold mb-2 text-foreground/90">Captured Snaps:</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
              {POSE_TYPES.map(poseType => {
                const photo = photos.find(p => p.id === poseType.id);
                return (
                  <div 
                    key={poseType.id} 
                    className={cn(
                        "relative aspect-[3/4] rounded-lg p-0.5 shadow-sm transition-all duration-300 border-2",
                        photo?.dataUri ? (photo.isCorrect ? "border-green-500/70" : "border-primary/70") : "border-muted/50 bg-muted/20",
                        currentPoseInfo?.id === poseType.id && !photo?.isCorrect ? "ring-2 ring-offset-2 ring-teal-500 dark:ring-offset-background" : ""
                    )}
                  >
                    {photo?.dataUri ? (
                      <>
                        <Image src={photo.dataUri} alt={photo.name} layout="fill" objectFit="cover" className="rounded"/>
                        <div className={`absolute top-1 right-1 p-0.5 rounded-full shadow-md ${photo.isCorrect ? 'bg-green-500' : 'bg-destructive'}`}>
                          {photo.isCorrect ? <CheckCircle className="h-3 w-3 text-white"/> : <AlertTriangle className="h-3 w-3 text-white"/>}
                        </div>
                      </>
                    ) : (
                       <div className="flex items-center justify-center h-full">
                         <Camera className={cn("h-6 w-6", currentPoseInfo?.id === poseType.id ? "text-teal-500" : "text-muted-foreground/50")} />
                       </div>
                    )}
                     <p className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2 text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded-full shadow-sm whitespace-nowrap">
                        {poseType.name}
                     </p>
                  </div>
                );
              })}
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
