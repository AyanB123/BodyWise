'use client';

import { useState, useEffect, ChangeEvent } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle, AlertCircle, UploadCloud, RotateCcw, ArrowRight, Loader2, Lightbulb, Camera } from 'lucide-react';
import type { PosePhoto, PoseType } from '@/lib/types';
import { POSE_TYPES } from '@/lib/types';
import { aiPoseGuidance, AIPoseGuidanceInput } from '@/ai/flows/ai-pose-guidance';
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


export default function CaptureWorkflow() {
  const [photos, setPhotos] = useLocalStorage<PosePhoto[]>('capturedPhotos', initialPhotosState);
  const [currentTab, setCurrentTab] = useState<PoseType>(POSE_TYPES[0].id);
  const [isLoading, setIsLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const { toast } = useToast();

  const currentPhoto = photos.find(p => p.id === currentTab);
  const currentPoseInfo = POSE_TYPES.find(p => p.id === currentTab);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    if (event.target.files && event.target.files[0] && currentPhoto) {
      const file = event.target.files[0];

      if (file.size > 4 * 1024 * 1024) { // 4MB limit
        setFileError("File is too large. Maximum size is 4MB.");
        toast({ title: "Upload Error", description: "File size exceeds 4MB limit.", variant: "destructive" });
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setFileError("Invalid file type. Please upload a JPG, PNG, or WEBP image.");
        toast({ title: "Upload Error", description: "Invalid file type. Only JPG, PNG, WEBP allowed.", variant: "destructive" });
        return;
      }


      setIsLoading(true);
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        
        const aiInput: AIPoseGuidanceInput = {
          photoDataUri: base64data,
          currentPose: `User submitted photo for ${currentPhoto.name} analysis.`,
          desiredPose: currentPoseInfo?.description || currentPhoto.name,
        };

        try {
          const result = await aiPoseGuidance(aiInput);
          setPhotos(prevPhotos =>
            prevPhotos.map(p =>
              p.id === currentPhoto.id
                ? { ...p, dataUri: base64data, isCorrect: result.isCorrectPose, feedback: result.feedback }
                : p
            )
          );
          toast({
            title: result.isCorrectPose ? "Pose Correct!" : "Pose Needs Adjustment",
            description: result.feedback,
            variant: result.isCorrectPose ? "default" : "destructive",
          });
        } catch (error) {
          console.error("AI Pose Guidance Error:", error);
          toast({
            title: "AI Error",
            description: "Could not get pose guidance. Please try again.",
            variant: "destructive",
          });
           setPhotos(prevPhotos =>
            prevPhotos.map(p =>
              p.id === currentPhoto.id
                ? { ...p, dataUri: base64data, isCorrect: false, feedback: "Error analyzing pose. Please try again." }
                : p
            )
          );
        } finally {
          setIsLoading(false);
        }
      };
      reader.onerror = () => {
        setIsLoading(false);
        toast({ title: "File Read Error", description: "Could not read the selected file.", variant: "destructive" });
      }
    }
  };

  const resetPhoto = (poseId: PoseType) => {
    setPhotos(prevPhotos =>
      prevPhotos.map(p => (p.id === poseId ? { ...initialPhotosState.find(ip => ip.id === poseId)! } : p))
    );
    setFileError(null);
  };

  const capturedCount = photos.filter(p => p.isCorrect).length;
  const progressPercentage = (capturedCount / POSE_TYPES.length) * 100;
  const allPhotosCaptured = capturedCount === POSE_TYPES.length;

  useEffect(() => {
    // Reset file input when tab changes to allow re-uploading same file name
    const fileInput = document.getElementById(`file-upload-${currentTab}`) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  }, [currentTab]);

  if (!currentPhoto || !currentPoseInfo) return <div>Error: Pose configuration not found.</div>;

  return (
    <Card className="w-full max-w-3xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-3xl flex items-center"><Camera className="mr-3 h-8 w-8 text-primary" />Photo Capture</CardTitle>
        <CardDescription>
          Follow the AI guidance to capture photos from {POSE_TYPES.length} different angles.
          Accurate photos are crucial for precise analysis.
        </CardDescription>
        <Progress value={progressPercentage} className="w-full mt-2" />
        <p className="text-sm text-muted-foreground mt-1">{capturedCount} of {POSE_TYPES.length} photos captured correctly.</p>
      </CardHeader>
      <CardContent>
        <Tabs value={currentTab} onValueChange={(value) => setCurrentTab(value as PoseType)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-4">
            {POSE_TYPES.map(pose => (
              <TabsTrigger key={pose.id} value={pose.id} className="flex items-center gap-1 text-xs sm:text-sm">
                {photos.find(p=>p.id === pose.id)?.isCorrect ? <CheckCircle className="h-4 w-4 text-green-500" /> : photos.find(p=>p.id === pose.id)?.dataUri ? <AlertCircle className="h-4 w-4 text-destructive" /> : null}
                {pose.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {POSE_TYPES.map(pose => (
             <TabsContent key={pose.id} value={pose.id}>
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">{pose.name}</h3>
                <Alert variant="default" className="bg-accent/10 border-accent/30">
                  <Lightbulb className="h-5 w-5 text-accent" />
                  <AlertTitle className="text-accent">Pose Instructions</AlertTitle>
                  <AlertDescription>{pose.description}</AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  <div className="space-y-2">
                    <Label htmlFor={`file-upload-${pose.id}`} className="text-base">Upload Photo</Label>
                    <Input id={`file-upload-${pose.id}`} type="file" accept="image/jpeg, image/png, image/webp" onChange={handleFileChange} disabled={isLoading} className="hover:cursor-pointer"/>
                    {fileError && <p className="text-sm text-destructive">{fileError}</p>}
                    {currentPhoto.dataUri && (
                       <Button variant="outline" size="sm" onClick={() => resetPhoto(pose.id)} disabled={isLoading} className="mt-2">
                        <RotateCcw className="mr-2 h-4 w-4" /> Retry
                      </Button>
                    )}
                  </div>
                  
                  {currentPhoto.dataUri && (
                    <div className="relative w-full aspect-[3/4] border rounded-md overflow-hidden bg-muted">
                      <Image src={currentPhoto.dataUri} alt={`${pose.name} preview`} layout="fill" objectFit="contain" />
                    </div>
                  )}
                </div>

                {isLoading && (
                  <div className="flex items-center justify-center p-4 rounded-md bg-muted">
                    <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />
                    <p className="text-primary">Analyzing pose, please wait...</p>
                  </div>
                )}

                {!isLoading && currentPhoto.feedback && (
                  <Alert variant={currentPhoto.isCorrect ? "default" : "destructive"} className={currentPhoto.isCorrect ? "bg-green-500/10 border-green-500/30" : ""}>
                    {currentPhoto.isCorrect ? <CheckCircle className="h-5 w-5 text-green-600" /> : <AlertCircle className="h-5 w-5 text-destructive" />}
                    <AlertTitle>{currentPhoto.isCorrect ? "Pose Correct!" : "Adjustment Needed"}</AlertTitle>
                    <AlertDescription>{currentPhoto.feedback}</AlertDescription>
                  </Alert>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-end">
        {allPhotosCaptured ? (
          <Link href="/results">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
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
