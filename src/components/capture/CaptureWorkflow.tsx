
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, RotateCcw, ArrowRight, Loader2, Lightbulb, Camera, Video, PlayCircle, PauseCircle, Sparkles, ThumbsUp, ScanLine, UserCircle, Image as ImageIcon, Brain } from 'lucide-react';
import type { PosePhoto, UserProfile } from '@/lib/types';
import { POSE_TYPES } from '@/lib/types';
import { aiPoseGuidance, AIPoseGuidanceInput, AIPoseGuidanceOutput, LandmarkPoint as GenkitLandmarkPoint } from '@/ai/flows/ai-pose-guidance';
import { useToast } from '@/hooks/use-toast';
import useLocalStorage from '@/hooks/useLocalStorage';
import Link from 'next/link';
import { cn } from '@/lib/utils';

import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl'; // Registers the WebGL backend
import * as poseDetection from '@tensorflow-models/pose-detection';

const initialPhotosState: PosePhoto[] = POSE_TYPES.map(pt => ({
  id: pt.id,
  name: pt.name,
  dataUri: null,
  isCorrect: null,
  feedback: null,
}));

const CAPTURE_INTERVAL_MS = 3200; 
const PHOTO_CONFIRMATION_DELAY_MS = 1800; 
const NEXT_POSE_DELAY_MS = 2800; 

const FRAME_WIDTH = 640;
const FRAME_HEIGHT = 480;

type CapturePhase =
  | 'IDLE'
  | 'INITIALIZING_CAMERA_TF' // New phase for initial setup
  | 'TF_MODEL_LOADING' // New phase for model loading
  | 'READY_TO_START'
  | 'INITIALIZING_POSE'
  | 'GUIDING'
  | 'ANALYZING' // AI Backend analysis
  | 'CAPTURING_PHOTO' 
  | 'PHOTO_FLASH' 
  | 'POSE_CONFIRMED'
  | 'ALL_POSES_CAPTURED'
  | 'CAMERA_ERROR'
  | 'PROFILE_INCOMPLETE'
  | 'MODEL_LOAD_ERROR';

type PoseCorrectness = 'NEUTRAL' | 'CORRECT' | 'ADJUSTMENT_NEEDED';

export default function CaptureWorkflow() {
  const [profile] = useLocalStorage<UserProfile | null>('userProfile', null);
  const [photos, setPhotos] = useLocalStorage<PosePhoto[]>('capturedPhotos', initialPhotosState);
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  
  const [capturePhase, setCapturePhase] = useState<CapturePhase>('IDLE');
  const [poseCorrectness, setPoseCorrectness] = useState<PoseCorrectness>('NEUTRAL');
  
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [aiFeedbackText, setAiFeedbackText] = useState<string | null>(null);
  const [backendDetectedLandmarks, setBackendDetectedLandmarks] = useState<GenkitLandmarkPoint[] | null>(null); // Renamed for clarity
  const [isBackendProcessing, setIsBackendProcessing] = useState(false); // Renamed for clarity

  // State for Step 1.2: Client-side pose detection
  const [clientDetector, setClientDetector] = useState<poseDetection.PoseDetector | null>(null);
  const [isClientDetectorLoading, setIsClientDetectorLoading] = useState<boolean>(false); // Start as false, true when loading
  const [liveLandmarks, setLiveLandmarks] = useState<poseDetection.Keypoint[] | null>(null);
  const [poseGuideSilhouette, setPoseGuideSilhouette] = useState<poseDetection.Keypoint[] | string | null>(null); // string for SVG path later

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
      utterance.rate = 1.0; 
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // Effect for TFJS Backend and Camera Permission
  useEffect(() => {
    if (capturePhase !== 'IDLE') return; 

    const setupCameraAndTF = async () => {
      setCapturePhase('INITIALIZING_CAMERA_TF');
      if (!profile || !profile.height || !profile.weight || !profile.age) {
        setCapturePhase('PROFILE_INCOMPLETE');
        return;
      }

      try {
        // Initialize TFJS backend
        await tf.setBackend('webgl');
        await tf.ready();
        console.log("TFJS WebGL backend ready.");
        toast({ title: "System Initialized", description: "TensorFlow.js backend is active." });

        // Get camera permission
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          toast({ title: "Camera Error", description: "Camera not supported by this browser.", variant: "destructive" });
          setHasCameraPermission(false);
          setCapturePhase('CAMERA_ERROR');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: FRAME_WIDTH, height: FRAME_HEIGHT, facingMode: "user" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current && canvasRef.current) {
              canvasRef.current.width = videoRef.current.videoWidth;
              canvasRef.current.height = videoRef.current.videoHeight;
            }
          };
        }
        setHasCameraPermission(true); 
        // Model loading will be triggered by the next useEffect hook
      } catch (error: any) {
        console.error('Error setting up camera or TFJS:', error);
        toast({ variant: 'destructive', title: 'Setup Error', description: error.message || 'Failed to initialize camera or TFJS backend.' });
        setHasCameraPermission(false);
        setCapturePhase('CAMERA_ERROR');
      }
    };
    setupCameraAndTF();
  }, [capturePhase, profile, toast]);


  // Effect for Model Loading, dependent on camera permission
  useEffect(() => {
    // Run if camera permission is granted, model isn't loaded, and not currently attempting to load
    if (!hasCameraPermission || clientDetector || isClientDetectorLoading) return;

    const loadModel = async () => {
      setCapturePhase('TF_MODEL_LOADING');
      setIsClientDetectorLoading(true);
      toast({ title: "Loading Pose Model", description: "This may take a moment...", duration: 5000 });
      try {
        const model = poseDetection.SupportedModels.MoveNet;
        const detectorConfig: poseDetection.movenet.MoveNetModelConfig = {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING, // Fast and good for real-time
          // modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER, // More accurate but slower
          // enableSmoothing: true, // Optional: can make landmarks smoother but adds slight latency
        };
        const detector = await poseDetection.createDetector(model, detectorConfig);
        setClientDetector(detector);
        toast({ title: "Pose Model Ready!", description: "BodyWise is ready to guide you.", className: "bg-green-600/90 border-green-700 text-white" });
        setCapturePhase('READY_TO_START'); 
      } catch (error: any) {
        console.error('Error loading pose detection model:', error);
        toast({ variant: 'destructive', title: 'Model Load Error', description: 'Could not load the pose detection model. Please try refreshing the page.' });
        setCapturePhase('MODEL_LOAD_ERROR'); 
      } finally {
        setIsClientDetectorLoading(false);
      }
    };

    loadModel();
  }, [hasCameraPermission, clientDetector, isClientDetectorLoading, toast]);


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
      // Dispose of the client detector if it exists
      clientDetector?.dispose();
    };
  }, [clientDetector]);

  // Updated canvas drawing effect to use liveLandmarks or backendDetectedLandmarks
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current || !hasCameraPermission) {
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
    if (!ctx || video.videoWidth === 0 || video.videoHeight === 0) return;
  
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const landmarksToDraw = liveLandmarks || backendDetectedLandmarks; // Prioritize live landmarks

    if (landmarksToDraw && landmarksToDraw.length > 0) {
      const color = poseCorrectness === 'CORRECT' ? 'hsl(var(--accent))' : 'hsl(var(--primary))';
      ctx.strokeStyle = color;
      ctx.fillStyle = cn(color, 'opacity-70');
      ctx.lineWidth = canvas.width > 320 ? 3 : 2;

      landmarksToDraw.forEach(landmark => {
        // The 'name' property might not exist on poseDetection.Keypoint directly, or might be optional
        // TFJS Keypoint usually has x, y, score. name is optional. GenkitLandmarkPoint has name.
        // For now, we just draw x, y.
        const x = landmark.x * canvas.width;
        const y = landmark.y * canvas.height;
        ctx.beginPath();
        ctx.arc(x, y, canvas.width > 320 ? 5 : 3, 0, 2 * Math.PI); 
        ctx.fill();
      });
    }
  }, [liveLandmarks, backendDetectedLandmarks, hasCameraPermission, poseCorrectness]); // Updated dependencies


  const runAiGuidance = useCallback(async () => {
    if (!currentPoseInfo || !videoRef.current || !canvasRef.current || isBackendProcessing || capturePhase !== 'GUIDING') return;

    setIsBackendProcessing(true);
    setCapturePhase('ANALYZING');
    setAiFeedbackText("Verifying pose with AI...");

    const video = videoRef.current;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) {
        setIsBackendProcessing(false);
        setCapturePhase('GUIDING');
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
      setAiFeedbackText(result.feedback);
      setBackendDetectedLandmarks(result.detectedLandmarks || []);

      if (result.isCorrectPose) {
        setPoseCorrectness('CORRECT');
        setCapturePhase('CAPTURING_PHOTO');
        speak(`Perfect! Capturing ${currentPoseInfo.name}. Hold still.`);
        
        phaseTransitionTimeoutRef.current = setTimeout(() => {
          setCapturePhase('PHOTO_FLASH'); 
          flashTimeoutRef.current = setTimeout(() => {
            setCapturePhase('POSE_CONFIRMED'); 
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
          }, 300); 
        }, 500); 

      } else {
        setPoseCorrectness('ADJUSTMENT_NEEDED');
        speak(result.feedback);
        setCapturePhase('GUIDING'); 
         toast({ 
            title: "Quick Tip!", 
            description: result.feedback, 
            variant: "default", 
            className:"bg-primary/10 border-primary/30 text-primary dark:text-orange-300" 
        });
      }
    } catch (error) {
      console.error("AI Pose Guidance Error:", error);
      const errorMessage = "AI analysis hiccup. Let's try again.";
      setAiFeedbackText(errorMessage);
      speak(errorMessage);
      toast({ title: "AI Error", description: errorMessage, variant: "destructive" });
      setBackendDetectedLandmarks(null);
      setPoseCorrectness('NEUTRAL');
      setCapturePhase('GUIDING');
    } finally {
      setIsBackendProcessing(false);
    }
  }, [currentPoseInfo, isBackendProcessing, photos, setPhotos, toast, speak, currentPoseIndex, capturePhase]);


  useEffect(() => {
    if (capturePhase === 'GUIDING' && hasCameraPermission && !isBackendProcessing && clientDetector) { // Ensure clientDetector is loaded
      // This interval is now for triggering AI backend checks, not for client-side estimation
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
  }, [capturePhase, hasCameraPermission, isBackendProcessing, runAiGuidance, clientDetector]);


  useEffect(() => {
    if (capturePhase === 'INITIALIZING_POSE' && currentPoseInfo) {
      setPoseCorrectness('NEUTRAL');
      setBackendDetectedLandmarks(null); // Clear backend landmarks
      setLiveLandmarks(null); // Clear live landmarks
      const initialMessage = `Next: ${currentPoseInfo.name}. ${currentPoseInfo.shortInstruction || currentPoseInfo.description}`;
      setAiFeedbackText(initialMessage);
      speak(`Get ready for ${currentPoseInfo.name}. ${currentPoseInfo.shortInstruction || currentPoseInfo.description}`);
      
      phaseTransitionTimeoutRef.current = setTimeout(() => {
        setCapturePhase('GUIDING');
      }, NEXT_POSE_DELAY_MS);
    }
  }, [capturePhase, currentPoseInfo, speak]);


  const handleStartCapture = () => {
    const canStart = (capturePhase === 'READY_TO_START' || capturePhase === 'IDLE' || capturePhase === 'MODEL_LOAD_ERROR') && hasCameraPermission && profile && clientDetector;
    const isPaused = capturePhase === 'READY_TO_START' && (photos.some(p => p.dataUri !== null && p.isCorrect === false) || currentPoseIndex > 0);

    if (capturePhase === 'MODEL_LOAD_ERROR') {
      // Attempt to re-initialize / re-load model
      setCapturePhase('IDLE'); // This will trigger the setup effects again
      setHasCameraPermission(null); // Reset to re-trigger camera and model load
      setClientDetector(null);
      toast({ title: "Retrying Setup", description: "Attempting to initialize camera and model again." });
      return;
    }

    if (canStart || isPaused) {
        if(capturePhase === 'IDLE' || !isPaused) { 
            setCurrentPoseIndex(0); 
            setPhotos(initialPhotosState); 
        }
        setCapturePhase('INITIALIZING_POSE');
    } else if (['GUIDING', 'ANALYZING'].includes(capturePhase)) { 
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
    setIsBackendProcessing(false);
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
      case 'CORRECT': return 'border-accent shadow-accent/30'; 
      case 'ADJUSTMENT_NEEDED': return 'border-primary shadow-primary/30'; 
      case 'NEUTRAL':
      default: return 'border-muted-foreground/30 shadow-md'; 
    }
  };

  const getFeedbackIcon = () => {
    if (isClientDetectorLoading || capturePhase === 'TF_MODEL_LOADING') return <Brain className="h-5 w-5 md:h-6 md:w-6 text-blue-400 animate-spin" />
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

    if (capturePhase === 'MODEL_LOAD_ERROR') {
      return (
        <Button 
          onClick={handleStartCapture} 
          size="lg" 
          className="w-full text-lg py-3.5 px-6 bg-destructive hover:bg-destructive/90 text-white"
        >
          <RotateCcw className="mr-2 h-6 w-6" /> Retry Setup
        </Button>
      );
    }

    const isCapturingActive = ['INITIALIZING_POSE', 'GUIDING', 'ANALYZING', 'CAPTURING_PHOTO', 'PHOTO_FLASH', 'POSE_CONFIRMED'].includes(capturePhase);
    const isPaused = capturePhase === 'READY_TO_START' && (photos.some(p => p.dataUri !== null && p.isCorrect === false) || currentPoseIndex > 0);


    let buttonText = 'Start Capture';
    let buttonIcon = <PlayCircle className="mr-2 h-6 w-6" />;

    if (isCapturingActive && guidanceIntervalRef.current) { 
        buttonText = 'Pause Capture';
        buttonIcon = <PauseCircle className="mr-2 h-6 w-6" />;
    } else if (isPaused || (isCapturingActive && !guidanceIntervalRef.current && capturePhase !== 'READY_TO_START')) { 
        buttonText = 'Resume Capture';
    } else if (capturePhase === 'READY_TO_START' && currentPoseIndex === 0 && photos[0].isCorrect === null) { 
        buttonText = 'Start Capture';
    } else if (isClientDetectorLoading || capturePhase === 'TF_MODEL_LOADING' || capturePhase === 'INITIALIZING_CAMERA_TF') {
        buttonText = 'Initializing...';
        buttonIcon = <Loader2 className="mr-2 h-6 w-6 animate-spin" />;
    }


    return (
      <Button 
        onClick={handleStartCapture} 
        size="lg" 
        disabled={isBackendProcessing || capturePhase === 'CAMERA_ERROR' || capturePhase === 'PROFILE_INCOMPLETE' || capturePhase === 'CAPTURING_PHOTO' || capturePhase === 'PHOTO_FLASH' || capturePhase === 'POSE_CONFIRMED' || isClientDetectorLoading || capturePhase === 'TF_MODEL_LOADING' || capturePhase === 'INITIALIZING_CAMERA_TF'}
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
  if ((capturePhase === 'IDLE' || capturePhase === 'INITIALIZING_CAMERA_TF') && hasCameraPermission === null) {
    return <div className="flex flex-col flex-grow justify-center items-center p-4"><Loader2 className="h-12 w-12 animate-spin text-primary" /> <p className="mt-4 text-lg text-muted-foreground">Initializing Camera & Systems...</p></div>;
  }
   if (capturePhase === 'TF_MODEL_LOADING') {
    return <div className="flex flex-col flex-grow justify-center items-center p-4"><Brain className="h-12 w-12 animate-spin text-primary" /> <p className="mt-4 text-lg text-muted-foreground">Loading AI Pose Model...</p><p className="text-sm text-muted-foreground">This can take a few moments.</p></div>;
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
   if (capturePhase === 'CAMERA_ERROR' || capturePhase === 'MODEL_LOAD_ERROR' || (capturePhase !== 'IDLE' && !hasCameraPermission && !isClientDetectorLoading && capturePhase !== 'INITIALIZING_CAMERA_TF' && capturePhase !== 'TF_MODEL_LOADING' )) {
    const title = capturePhase === 'MODEL_LOAD_ERROR' ? "AI Model Error" : "Camera Access Required";
    const message = capturePhase === 'MODEL_LOAD_ERROR' ? "Could not load the pose detection model. Please try refreshing." : "Enable camera access in your browser settings and refresh.";
    return (
      <div className="flex flex-col flex-grow items-center justify-center p-4">
        <Card className="w-full max-w-md mx-auto shadow-xl">
          <CardHeader><CardTitle className="text-2xl text-destructive flex items-center"><Video className="mr-2"/>{title}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{message}</p>
            <Button onClick={() => {
                setCapturePhase('IDLE'); 
                setHasCameraPermission(null); 
                setClientDetector(null);
                setIsClientDetectorLoading(false);
              }} 
              className="w-full"
            >
              Retry Setup
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="flex flex-col flex-grow items-center justify-center w-full p-1 sm:p-2 md:p-4 max-h-screen overflow-hidden">
      <Card className="w-full max-w-md md:max-w-lg lg:max-w-xl flex flex-col h-[calc(100vh-100px)] sm:h-[calc(100vh-120px)] my-0 shadow-2xl bg-card/90 backdrop-blur-lg border-border/30 overflow-hidden rounded-xl">
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
              {isClientDetectorLoading || capturePhase === 'TF_MODEL_LOADING' ? 'Initializing AI guide...' : (aiFeedbackText ? '' : 'Follow audio & visual cues. The AI will guide you.')}
            </CardDescription>
          }
          {capturePhase === 'ALL_POSES_CAPTURED' &&
            <CardDescription className="text-sm sm:text-base text-accent font-semibold mt-1">
              All photos captured successfully!
            </CardDescription>
          }
          <Progress value={progressPercentage} className="w-full h-2 mt-2 transition-all duration-500 bg-secondary [&>div]:bg-gradient-to-r [&>div]:from-teal-500 [&>div]:to-primary" />
        </CardHeader>

        <CardContent className="p-2 sm:p-3 md:p-4 flex-grow overflow-hidden space-y-2 md:space-y-3 flex flex-col relative"> {/* Added relative for canvas positioning */}
          <div className={cn(
            "relative w-full aspect-[3/4] sm:aspect-video md:aspect-[4/3] bg-muted/40 rounded-lg overflow-hidden border-2 md:border-4 transition-all duration-300 ease-in-out shadow-inner flex items-center justify-center flex-shrink-0",
            getVideoBorderColor(),
            capturePhase === 'PHOTO_FLASH' && "animate-pulse border-green-300 shadow-green-400/70 ring-4 ring-green-300/50"
          )}>
            <video ref={videoRef} className="absolute top-0 left-0 w-full h-full object-cover transform scale-x-[-1]" autoPlay muted playsInline />
            <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full transform scale-x-[-1] z-10" /> {/* z-10 to be on top of video */}
            
            {['ANALYZING', 'CAPTURING_PHOTO'].includes(capturePhase) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm text-white z-20 transition-opacity duration-300">
                {capturePhase === 'ANALYZING' && <ScanLine className="h-10 w-10 md:h-12 md:w-12 animate-pulse text-blue-300" />}
                {capturePhase === 'CAPTURING_PHOTO' && <ImageIcon className="h-10 w-10 md:h-12 md:w-12 animate-ping text-green-300" />}
                <p className="text-md md:text-lg font-semibold mt-2.5">
                  {capturePhase === 'ANALYZING' ? 'Analyzing...' : 'Capturing...'}
                </p>
              </div>
            )}
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
                    {isClientDetectorLoading || capturePhase === 'TF_MODEL_LOADING' ? 'Loading AI Guide...' :
                     capturePhase === 'POSE_CONFIRMED' && currentPhotoStorage?.isCorrect ? `${currentPoseInfo.name} Confirmed!` : 
                     (currentPoseInfo.name || "Instructions")}
                  </p>
                  <p className="text-xs md:text-sm text-foreground/80 leading-snug">
                    {isClientDetectorLoading || capturePhase === 'TF_MODEL_LOADING' ? 'Getting the live pose feedback system ready for you.' :
                     aiFeedbackText || currentPoseInfo.description}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-2.5 md:gap-3 pt-1 md:pt-2 mt-auto flex-shrink-0"> 
            {getActionButton()}
            {((['GUIDING', 'ANALYZING', 'INITIALIZING_POSE'].includes(capturePhase)) || (capturePhase === 'READY_TO_START' && currentPhotoStorage && !currentPhotoStorage.isCorrect)) && 
             (currentPoseIndex < POSE_TYPES.length && capturedCount < POSE_TYPES.length && currentPhotoStorage?.isCorrect !== true && clientDetector) && ( // Ensure clientDetector is loaded to allow retry
                 <Button 
                    onClick={handleRetryCurrentPose} 
                    variant="outline" 
                    size="lg" 
                    disabled={isBackendProcessing || capturePhase === 'CAPTURING_PHOTO' || capturePhase === 'PHOTO_FLASH' || capturePhase === 'POSE_CONFIRMED' || isClientDetectorLoading}
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
                        "relative aspect-square rounded-md p-0.5 shadow-sm transition-all duration-300 border",
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
                        {poseType.name.replace(" View", "").replace(" Pose", "")}
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

    