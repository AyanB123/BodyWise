
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, RotateCcw, ArrowRight, Loader2, Lightbulb, Camera, Video, PlayCircle, PauseCircle, Sparkles, ThumbsUp, ScanLine, UserCircle, Image as ImageIcon } from 'lucide-react';
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

const CAPTURE_INTERVAL_MS = 3200; // Slightly faster AI checks
const PHOTO_CONFIRMATION_DELAY_MS = 1800; // Slightly longer to show "Captured!"
const NEXT_POSE_DELAY_MS = 2800; // Slightly longer before next pose for user prep

const FRAME_WIDTH = 640;
const FRAME_HEIGHT = 480;

type CapturePhase =
  | 'IDLE'
  | 'READY_TO_START'
  | 'INITIALIZING_POSE'
  | 'GUIDING'
  | 'ANALYZING'
  | 'CAPTURING_PHOTO' 
  | 'PHOTO_FLASH' // New phase for visual feedback of photo taken
  | 'POSE_CONFIRMED'
  | 'ALL_POSES_CAPTURED'
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
  const [isProcessing, setIsProcessing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const guidanceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const phaseTransitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const flashTimeoutRef = useRef<NodeJS.Timeout | null>(null);


  const { toast } = useToast();

  const currentPoseInfo = POSE_TYPES[currentPoseIndex];
  const currentPhotoStorage = photos.find(p => p.id === currentPoseInfo?.id);

  const speak = useCallback((text: string) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 1.0; // Slightly faster speech
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  }, []);

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
           // Wait for video to be ready to get dimensions
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current && canvasRef.current) {
              canvasRef.current.width = videoRef.current.videoWidth;
              canvasRef.current.height = videoRef.current.videoHeight;
            }
          };
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

  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      if (guidanceIntervalRef.current) clearInterval(guidanceIntervalRef.current);
      if (phaseTransitionTimeoutRef.current) clearTimeout(phaseTransitionTimeoutRef.current);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !videoRef.current || !detectedLandmarks || detectedLandmarks.length === 0 || !hasCameraPermission) {
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
    if (!ctx || video.videoWidth === 0 || video.videoHeight === 0) return; // Ensure video dimensions are loaded

    // Set canvas dimensions if not already set or if video dimensions changed
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const color = poseCorrectness === 'CORRECT' ? 'hsl(var(--accent))' : 'hsl(var(--primary))'; // Teal for correct, Orange for adjustment
    ctx.strokeStyle = color;
    ctx.fillStyle = cn(color, 'opacity-70');
    ctx.lineWidth = canvas.width > 320 ? 3 : 2;

    detectedLandmarks.forEach(landmark => {
      const x = landmark.x * canvas.width;
      const y = landmark.y * canvas.height;
      ctx.beginPath();
      ctx.arc(x, y, canvas.width > 320 ? 5 : 3, 0, 2 * Math.PI); 
      ctx.fill();
      // ctx.stroke(); // Optional: stroke around landmarks
    });
  }, [detectedLandmarks, hasCameraPermission, poseCorrectness]);

  const runAiGuidance = useCallback(async () => {
    if (!currentPoseInfo || !videoRef.current || !canvasRef.current || isProcessing || capturePhase !== 'GUIDING') return;

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
    const photoDataUri = tempCanvas.toDataURL('image/webp', 0.85); // Slightly higher quality

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
          setCapturePhase('PHOTO_FLASH'); // Trigger flash
          flashTimeoutRef.current = setTimeout(() => {
            setCapturePhase('POSE_CONFIRMED'); // After flash, confirm pose
            setPhotos(prevPhotos =>
              prevPhotos.map(p =>
                p.id === currentPoseInfo.id
                  ? { ...p, dataUri: photoDataUri, isCorrect: true, feedback: "Pose captured successfully." }
                  : p
              )
            );
            setAiFeedbackText(`${currentPoseInfo.name} captured!`);
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
          }, 300); // Flash duration
        }, 500); // Short delay for "capturing" feel before flash

      } else {
        setPoseCorrectness('ADJUSTMENT_NEEDED');
        speak(result.feedback);
        setCapturePhase('GUIDING'); // Go back to guiding
         toast({ 
            title: "Quick Tip!", 
            description: result.feedback, 
            variant: "default", 
            className:"bg-primary/10 border-primary/30 text-primary dark:text-orange-300" 
        });
      }
    } catch (error) {
      console.error("AI Pose Guidance Error:", error);
      const errorMessage = "AI analysis is having a hiccup. Let's try again in a moment.";
      setAiFeedbackText(errorMessage);
      speak(errorMessage);
      toast({ title: "AI Error", description: errorMessage, variant: "destructive" });
      setDetectedLandmarks(null);
      setPoseCorrectness('NEUTRAL');
      setCapturePhase('GUIDING');
    } finally {
      setIsProcessing(false);
    }
  }, [currentPoseInfo, isProcessing, photos, setPhotos, toast, speak, currentPoseIndex, capturePhase]);


  useEffect(() => {
    if (capturePhase === 'GUIDING' && hasCameraPermission && !isProcessing) {
      if (guidanceIntervalRef.current) clearInterval(guidanceIntervalRef.current);
      guidanceIntervalRef.current = setInterval(runAiGuidance, CAPTURE_INTERVAL_MS);
    } else {
      if (guidanceIntervalRef.current) {
        clearInterval(guidanceIntervalRef.current);
        guidanceIntervalRef.current = null;
      }
    }
    return () => {
      if (guidanceIntervalRef.current) clearInterval(guidanceIntervalRef.current);
    };
  }, [capturePhase, hasCameraPermission, isProcessing, runAiGuidance]);


  useEffect(() => {
    if (capturePhase === 'INITIALIZING_POSE' && currentPoseInfo) {
      setPoseCorrectness('NEUTRAL');
      setDetectedLandmarks(null);
      const initialMessage = `Next: ${currentPoseInfo.name}. ${currentPoseInfo.shortInstruction || currentPoseInfo.description}`;
      setAiFeedbackText(initialMessage);
      speak(`Get ready for ${currentPoseInfo.name}. ${currentPoseInfo.shortInstruction || currentPoseInfo.description}`);
      
      phaseTransitionTimeoutRef.current = setTimeout(() => {
        setCapturePhase('GUIDING');
      }, NEXT_POSE_DELAY_MS);
    }
  }, [capturePhase, currentPoseInfo, speak]);


  const handleStartCapture = () => {
    const canStart = (capturePhase === 'READY_TO_START' || capturePhase === 'IDLE') && hasCameraPermission && profile;
    const isPaused = capturePhase === 'READY_TO_START' && (photos.some(p => p.dataUri !== null && p.isCorrect === false) || currentPoseIndex > 0);


    if (canStart || isPaused) {
        if(capturePhase === 'IDLE' || !isPaused) { // Fresh start or truly idle
            setCurrentPoseIndex(0); 
            setPhotos(initialPhotosState); 
        }
        setCapturePhase('INITIALIZING_POSE');
    } else if (['GUIDING', 'ANALYZING'].includes(capturePhase)) { // Pausing
      if (guidanceIntervalRef.current) {
        clearInterval(guidanceIntervalRef.current);
        guidanceIntervalRef.current = null;
        setCapturePhase('READY_TO_START'); 
        speak("Capture paused.");
        setAiFeedbackText("Capture paused. Press Start to resume.");
      }
    }
  };
  
  const handleRetryCurrentPose = () => {
    if (!currentPoseInfo) return;
    if (guidanceIntervalRef.current) clearInterval(guidanceIntervalRef.current);
    setIsProcessing(false);
    setPhotos(prevPhotos => 
      prevPhotos.map(p => p.id === currentPoseInfo.id ? {...initialPhotosState.find(ip => ip.id === currentPoseInfo.id)!} : p)
    );
    setCapturePhase('INITIALIZING_POSE');
    toast({ title: "Pose Reset", description: `Let's try ${currentPoseInfo.name} again.`});
  };

  const capturedCount = photos.filter(p => p.isCorrect).length;
  const progressPercentage = (capturedCount / POSE_TYPES.length) * 100;

  const getVideoBorderColor = () => {
    if (capturePhase === 'CAPTURING_PHOTO' || capturePhase === 'PHOTO_FLASH') return 'border-green-400 shadow-green-500/50';
    switch (poseCorrectness) {
      case 'CORRECT': return 'border-accent shadow-accent/30'; // Teal for correct
      case 'ADJUSTMENT_NEEDED': return 'border-primary shadow-primary/30'; // Orange for adjustment
      case 'NEUTRAL':
      default: return 'border-muted-foreground/30 shadow-md'; // Neutral subtle border
    }
  };

  const getFeedbackIcon = () => {
    if (capturePhase === 'ANALYZING') return <ScanLine className="h-5 w-5 md:h-6 md:w-6 text-blue-400 animate-pulse" />;
    if (capturePhase === 'CAPTURING_PHOTO' || capturePhase === 'PHOTO_FLASH') return <Camera className="h-5 w-5 md:h-6 md:w-6 text-green-400 animate-ping" />;
    if (capturePhase === 'POSE_CONFIRMED' && currentPhotoStorage?.isCorrect) return <ThumbsUp className="h-5 w-5 md:h-6 md:w-6 text-green-500" />;
    if (poseCorrectness === 'CORRECT') return <CheckCircle className="h-5 w-5 md:h-6 md:w-6 text-green-500" />;
    if (poseCorrectness === 'ADJUSTMENT_NEEDED') return <AlertTriangle className="h-5 w-5 md:h-6 md:w-6 text-primary" />;
    return <Lightbulb className="h-5 w-5 md:h-6 md:w-6 text-teal-400" />;
  };
  
  const getActionButton = () => {
    if (capturePhase === 'ALL_POSES_CAPTURED') {
      return (
        <Link href="/results" className="w-full">
          <Button size="lg" className="w-full text-lg py-3.5 px-6 bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg hover:shadow-accent/50 transition-all duration-300 transform hover:scale-105 flex items-center">
            View My Analysis <ArrowRight className="ml-2.5 h-5 w-5" />
          </Button>
        </Link>
      );
    }

    const isCapturingActive = ['INITIALIZING_POSE', 'GUIDING', 'ANALYZING', 'CAPTURING_PHOTO', 'PHOTO_FLASH', 'POSE_CONFIRMED'].includes(capturePhase);
    const isPaused = capturePhase === 'READY_TO_START' && (photos.some(p => p.dataUri !== null && p.isCorrect === false) || currentPoseIndex > 0 || (currentPoseIndex === 0 && !photos[0].isCorrect && !photos[0].dataUri));


    let buttonText = 'Start Capture';
    let buttonIcon = <PlayCircle className="mr-2 h-6 w-6" />;

    if (isCapturingActive && guidanceIntervalRef.current) { // Actively guiding/analyzing
        buttonText = 'Pause Capture';
        buttonIcon = <PauseCircle className="mr-2 h-6 w-6" />;
    } else if (isPaused || (isCapturingActive && !guidanceIntervalRef.current && capturePhase !== 'READY_TO_START')) { // Paused or ready to resume
        buttonText = 'Resume Capture';
    } else if (capturePhase === 'READY_TO_START' && currentPoseIndex === 0 && photos[0].isCorrect === null) { // Fresh start ready
        buttonText = 'Start Capture';
    }


    return (
      <Button 
        onClick={handleStartCapture} 
        size="lg" 
        disabled={isProcessing || capturePhase === 'CAMERA_ERROR' || capturePhase === 'PROFILE_INCOMPLETE' || capturePhase === 'CAPTURING_PHOTO' || capturePhase === 'PHOTO_FLASH' || capturePhase === 'POSE_CONFIRMED'}
        className={cn(
            "w-full text-lg py-3.5 px-6 shadow-lg hover:shadow-primary/50 transition-all duration-300 transform hover:scale-105 flex items-center",
            (isCapturingActive && guidanceIntervalRef.current) ? "bg-red-500 hover:bg-red-600 text-white" : "bg-primary hover:bg-primary/90"
        )}
      >
        {buttonIcon}
        {buttonText}
      </Button>
    );
  };

  // Render Logic
  if (capturePhase === 'IDLE' && hasCameraPermission === null) {
    return <div className="flex flex-col flex-grow justify-center items-center p-4"><Loader2 className="h-12 w-12 animate-spin text-primary" /> <p className="mt-4 text-lg text-muted-foreground">Initializing Camera...</p></div>;
  }
  if (capturePhase === 'PROFILE_INCOMPLETE') {
    return (
      <div className="flex flex-col flex-grow items-center justify-center p-4">
        <Card className="w-full max-w-md mx-auto shadow-xl">
          <CardHeader><CardTitle className="text-2xl text-destructive flex items-center"><UserCircle className="mr-2"/>Profile Incomplete</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">Please complete your profile (height, weight, age) to begin.</p>
            <Link href="/profile">
              <Button className="w-full bg-primary hover:bg-primary/80">Go to Profile</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }
   if (capturePhase === 'CAMERA_ERROR' || (capturePhase !== 'IDLE' && !hasCameraPermission)) {
    return (
      <div className="flex flex-col flex-grow items-center justify-center p-4">
        <Card className="w-full max-w-md mx-auto shadow-xl">
          <CardHeader><CardTitle className="text-2xl text-destructive flex items-center"><Video className="mr-2"/>Camera Access Required</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">Enable camera access in your browser settings and refresh.</p>
            <Button onClick={() => window.location.reload()} className="w-full">Refresh Page</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-grow items-center w-full p-2 sm:p-4 overflow-hidden">
      <Card className="w-full max-w-md md:max-w-xl lg:max-w-2xl flex flex-col flex-grow my-0 sm:my-4 shadow-2xl bg-card/90 backdrop-blur-lg border-border/30 overflow-hidden rounded-xl">
        <CardHeader className="border-b border-border/20 p-3 md:p-4 flex-shrink-0">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl md:text-2xl font-bold flex items-center text-primary">
              <Camera className="mr-2 h-6 w-6" />
              AI Photo Capture
            </CardTitle>
            {currentPoseInfo && capturePhase !== 'ALL_POSES_CAPTURED' && (
              <span className="text-xs sm:text-sm font-medium text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">
                Pose {currentPoseIndex + 1}/{POSE_TYPES.length}
              </span>
            )}
          </div>
          {capturePhase !== 'ALL_POSES_CAPTURED' &&
            <CardDescription className="text-xs sm:text-sm text-foreground/70 mt-1">
              Follow audio & visual cues. The AI will guide you.
            </CardDescription>
          }
          {capturePhase === 'ALL_POSES_CAPTURED' &&
            <CardDescription className="text-sm sm:text-base text-accent font-semibold mt-1">
              All photos captured successfully!
            </CardDescription>
          }
          <Progress value={progressPercentage} className="w-full h-2 mt-2 transition-all duration-500 bg-secondary [&>div]:bg-gradient-to-r [&>div]:from-teal-500 [&>div]:to-primary" />
        </CardHeader>

        <CardContent className="p-3 md:p-4 flex-grow overflow-y-auto space-y-3 md:space-y-4 flex flex-col">
          <div className={cn(
            "relative w-full aspect-[4/3] bg-muted/40 rounded-lg overflow-hidden border-2 md:border-4 transition-all duration-300 ease-in-out shadow-inner flex-shrink-0",
            getVideoBorderColor(),
            capturePhase === 'PHOTO_FLASH' && "animate-pulse border-green-300 shadow-green-400/70 ring-4 ring-green-300/50"
          )}>
            <video ref={videoRef} className="w-full h-full object-cover transform scale-x-[-1]" autoPlay muted playsInline />
            <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full transform scale-x-[-1]" />
            
            {/* Overlays for analyzing/capturing states */}
            {['ANALYZING', 'CAPTURING_PHOTO'].includes(capturePhase) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm text-white z-10 transition-opacity duration-300">
                {capturePhase === 'ANALYZING' && <ScanLine className="h-10 w-10 md:h-12 md:w-12 animate-pulse text-blue-300" />}
                {capturePhase === 'CAPTURING_PHOTO' && <ImageIcon className="h-10 w-10 md:h-12 md:w-12 animate-ping text-green-300" />}
                <p className="text-md md:text-lg font-semibold mt-2.5">
                  {capturePhase === 'ANALYZING' ? 'Analyzing...' : 'Capturing...'}
                </p>
              </div>
            )}
             {/* Silhouette or Guide Overlay - Placeholder */}
            {/* {capturePhase === 'GUIDING' && currentPoseInfo?.silhouette && (
              <div className="absolute inset-0 flex items-center justify-center z-5 opacity-20">
                <Image src={currentPoseInfo.silhouette} alt={`${currentPoseInfo.name} guide`} layout="fill" objectFit="contain" />
              </div>
            )} */}
          </div>

          {currentPoseInfo && capturePhase !== 'ALL_POSES_CAPTURED' && (
            <div className={cn(
                "p-2.5 md:p-3 rounded-md border transition-all duration-300 flex-shrink-0",
                poseCorrectness === 'CORRECT' ? 'bg-green-500/10 border-green-500/30' : 
                poseCorrectness === 'ADJUSTMENT_NEEDED' ? 'bg-primary/10 border-primary/30' :
                'bg-teal-500/10 border-teal-500/30'
            )}>
              <div className="flex items-start space-x-2 md:space-x-2.5">
                <div className="flex-shrink-0 pt-0.5">
                  {getFeedbackIcon()}
                </div>
                <div className="flex-grow">
                  <p className={cn(
                      "text-sm md:text-base font-semibold",
                       poseCorrectness === 'CORRECT' ? 'text-green-700 dark:text-green-300' : 
                       poseCorrectness === 'ADJUSTMENT_NEEDED' ? 'text-primary dark:text-orange-300' :
                       'text-teal-700 dark:text-teal-300'
                  )}>
                    {capturePhase === 'POSE_CONFIRMED' && currentPhotoStorage?.isCorrect ? `${currentPoseInfo.name} Confirmed!` : (currentPoseInfo.name || "Instructions")}
                  </p>
                  <p className="text-xs md:text-sm text-foreground/80 leading-snug">
                    {aiFeedbackText || currentPoseInfo.description}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-2.5 md:gap-3 pt-1 md:pt-2 mt-auto flex-shrink-0"> {/* mt-auto pushes buttons to bottom in flex-col */}
            {getActionButton()}
            {((['GUIDING', 'ANALYZING', 'INITIALIZING_POSE'].includes(capturePhase)) || (capturePhase === 'READY_TO_START' && currentPhotoStorage && !currentPhotoStorage.isCorrect)) && 
             (currentPoseIndex < POSE_TYPES.length && capturedCount < POSE_TYPES.length && currentPhotoStorage?.isCorrect !== true) && (
                 <Button 
                    onClick={handleRetryCurrentPose} 
                    variant="outline" 
                    size="lg" 
                    disabled={isProcessing || capturePhase === 'CAPTURING_PHOTO' || capturePhase === 'PHOTO_FLASH' || capturePhase === 'POSE_CONFIRMED'}
                    className="w-full sm:w-auto text-base md:text-lg py-3 px-6 border-primary/60 hover:border-primary text-primary shadow-sm hover:bg-primary/5"
                >
                    <RotateCcw className="mr-2 h-4 w-4 md:h-5 md:w-5" /> Retry Pose
                </Button>
            )}
          </div>
        </CardContent>

        {photos.filter(p => p.dataUri).length > 0 && capturePhase !== 'ALL_POSES_CAPTURED' && (
          <CardFooter className="p-2.5 md:p-3 border-t border-border/20 flex-col items-start flex-shrink-0">
            <h4 className="text-xs font-semibold mb-1.5 text-foreground/90">Captured Snaps:</h4>
            <div className="grid grid-cols-4 gap-1.5 md:gap-2 w-full">
              {POSE_TYPES.map(poseType => {
                const photo = photos.find(p => p.id === poseType.id);
                return (
                  <div 
                    key={poseType.id} 
                    className={cn(
                        "relative aspect-square rounded-md p-0.5 shadow-sm transition-all duration-300 border", // aspect-square for mobile
                        photo?.dataUri ? (photo.isCorrect ? "border-green-500/80" : "border-primary/80") : "border-muted/60 bg-muted/30",
                        currentPoseInfo?.id === poseType.id && !photo?.isCorrect ? "ring-2 ring-offset-1 ring-teal-500 dark:ring-offset-background" : ""
                    )}
                  >
                    {photo?.dataUri ? (
                      <>
                        <Image src={photo.dataUri} alt={photo.name} layout="fill" objectFit="cover" className="rounded-sm"/>
                        <div className={`absolute top-0.5 right-0.5 p-0.5 rounded-full shadow ${photo.isCorrect ? 'bg-green-500' : 'bg-destructive'}`}>
                          {photo.isCorrect ? <CheckCircle className="h-2.5 w-2.5 text-white"/> : <AlertTriangle className="h-2.5 w-2.5 text-white"/>}
                        </div>
                      </>
                    ) : (
                       <div className="flex items-center justify-center h-full">
                         <Camera className={cn("h-4 w-4 md:h-5 md:w-5", currentPoseInfo?.id === poseType.id ? "text-teal-500 animate-pulse" : "text-muted-foreground/60")} />
                       </div>
                    )}
                     <p className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2 text-[8px] md:text-[9px] bg-black/60 text-white px-1 py-0.5 rounded-sm shadow-sm whitespace-nowrap truncate max-w-[calc(100%-4px)]">
                        {poseType.name.replace(" View", "")}
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
