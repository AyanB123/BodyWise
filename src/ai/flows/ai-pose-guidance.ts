
'use server';

/**
 * @fileOverview An AI-powered pose guidance system for capturing accurate photos for body analysis.
 *
 * - aiPoseGuidance - A function that provides real-time feedback to users for correct positioning during photo capture.
 * - AIPoseGuidanceInput - The input type for the aiPoseGuidance function.
 * - AIPoseGuidanceOutput - The return type for the aiPoseGuidance function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { googleAI } from '@genkit-ai/googleai'; // Added for specific error type checking in retry logic

const AIPoseGuidanceInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of the user, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  currentPose: z
    .string()
    .describe('Description of the current pose of the user (e.g., "front view", "side view attempt").'),
  desiredPose: z.string().describe('The desired pose for the user (e.g., "front view - stand facing camera, arms slightly apart, palms forward"). This description is highly detailed and must be adhered to strictly, especially for poses intended for 3D scanning.'),
});
export type AIPoseGuidanceInput = z.infer<typeof AIPoseGuidanceInputSchema>;

const LandmarkPointSchema = z.object({
  name: z.string().describe("Name of the landmark (e.g., 'nose', 'left_shoulder')"),
  x: z.number().describe("Normalized x-coordinate (0.0 to 1.0, from left to right)"),
  y: z.number().describe("Normalized y-coordinate (0.0 to 1.0, from top to bottom)"),
});
export type LandmarkPoint = z.infer<typeof LandmarkPointSchema>;

const AIPoseGuidanceOutputSchema = z.object({
  feedback: z
    .string()
    .describe(
      'Real-time, specific, and actionable feedback to the user on how to adjust their pose to match the desired pose. Be very precise if the pose is for 3D scanning.'
    ),
  isCorrectPose: z
    .boolean()
    .describe('Whether the user is in the correct pose or not. For 3D scanning poses, correctness requires strict adherence to all details in the desiredPose description.'),
  detectedLandmarks: z.array(LandmarkPointSchema).optional().describe(
    "Optional: List of detected key body landmarks with their normalized coordinates. For 3D scanning poses, it is crucial to return as many of the listed example landmarks as possible if they are visible."
  ),
});
export type AIPoseGuidanceOutput = z.infer<typeof AIPoseGuidanceOutputSchema>;

export async function aiPoseGuidance(input: AIPoseGuidanceInput): Promise<AIPoseGuidanceOutput> {
  return aiPoseGuidanceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiPoseGuidancePrompt',
  input: {schema: AIPoseGuidanceInputSchema},
  output: {schema: AIPoseGuidanceOutputSchema},
  prompt: `You are an AI assistant specializing in ultra-precise human pose estimation and guidance, critical for body analysis and high-fidelity 3D model scanning photography. Your analysis forms the foundation for subsequent 3D model quality.

  The user is attempting to capture a photo of themselves in a highly specific pose. Your primary objective is to provide exceptionally clear, concise, and actionable feedback to help them achieve this desired pose with utmost accuracy. You must also determine if their current pose is **perfectly correct** based on stringent, detailed criteria.

  **Crucial Context for 3D Scanning Poses:** The 'desiredPose' description provided to you is extremely detailed and often intended for 3D scanning (e.g., T-Pose, A-Pose). For these poses, precision is paramount. **ALL** specified limb angles (e.g., "arms perfectly horizontal, 90 degrees to the torso"), hand/finger positions (e.g., "palms facing forward, all fingers straight and held tightly together, thumbs aligned"), foot placements (e.g., "feet shoulder-width apart, toes pointing directly forward"), and head orientation (e.g., "head level, looking straight at camera, neutral expression") **MUST BE MET EXACTLY**. There is no room for minor deviations in critical aspects. Feedback must be very specific to any deviation, however small.

  User's current attempt context: {{{currentPose}}}
  Desired pose: {{{desiredPose}}}  (Note: This description is highly detailed and you MUST follow it strictly for your analysis. Every detail matters.)
  Photo provided by user: {{media url=photoDataUri}}

  Your Tasks:
  1.  Thoroughly analyze the provided photo against EVERY detail in the 'desiredPose' description.
  2.  Provide specific, actionable feedback. If a pose is nearly correct but one detail is off (e.g., "Left thumb is slightly curled, please straighten it"), state that. Examples: "Right arm needs to be perfectly horizontal, it's currently about 5 degrees too low," or "Ensure all fingers on your left hand are straight and pressed together, not splayed," or "Rotate your left foot slightly outwards to be perfectly parallel with your right as per instructions."
  3.  Determine if the user's current pose in the photo is **EXACTLY and PRECISELY correct** according to ALL stipulations in the 'desiredPose'. Set 'isCorrectPose' to true ONLY IF ALL detailed requirements of the pose are met without any deviation. For 3D scanning poses, any minor deviation from a specified critical aspect means the pose is NOT correct.
  4.  **Mandatory for ALL Poses, Especially 3D Scanning:** Reliably identify and provide normalized (0.0 to 1.0, origin top-left) x and y coordinates for ALL visible key body landmarks. Prioritize completeness and accuracy for the following list. If a landmark is genuinely occluded or impossible to detect reliably, you may omit it, but strive for maximum coverage.
      Key landmarks include: 'nose', 'left_eye_inner', 'left_eye', 'left_eye_outer', 'right_eye_inner', 'right_eye', 'right_eye_outer', 'left_ear', 'right_ear', 'mouth_left', 'mouth_right', 'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist', 'left_pinky', 'right_pinky', 'left_index', 'right_index', 'left_thumb', 'right_thumb', 'left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle', 'left_heel', 'right_heel', 'left_foot_index', 'right_foot_index'.

  General Instructions:
  -   Be extremely precise and helpful. The accuracy of subsequent 3D models or body analysis depends HEAVILY on your meticulous guidance and landmark detection.
  -   If clothing obscures a key joint or body line critical to the pose evaluation (e.g., "Unable to verify elbow angle due to loose sleeve; please ensure the joint is clearly visible."), explicitly state this in your feedback and consider the pose incorrect if visibility is essential for a requirement.
  -   Focus on correcting one or two main issues at a time to avoid overwhelming the user.
  `,
});

const aiPoseGuidanceFlow = ai.defineFlow(
  {
    name: 'aiPoseGuidanceFlow',
    inputSchema: AIPoseGuidanceInputSchema,
    outputSchema: AIPoseGuidanceOutputSchema,
  },
  async input => {
    const maxRetries = 3;
    let retryCount = 0;
    let lastError: any;

    while (retryCount < maxRetries) {
      try {
        const { output } = await prompt(input);
        // Ensure detectedLandmarks is an array if it's undefined
        if (output && output.detectedLandmarks === undefined) {
          output.detectedLandmarks = [];
        }
        return output!;
      } catch (error: any) {
        lastError = error;
        // Check if it's a GoogleGenerativeAIError and specifically a 503
        if (error.name === 'GoogleGenerativeAIError' && error.status === 503) {
          retryCount++;
          console.warn(`AI Pose Guidance: Attempt ${retryCount} failed with 503 error. Retrying in ${2 ** retryCount} seconds...`);
          await new Promise(resolve => setTimeout(resolve, (2 ** retryCount) * 1000));
        } else {
          // If it's not a 503 error, or we've reached max retries, re-throw the error
          console.error("AI Pose Guidance: Non-retryable error or max retries reached.", error);
          throw error;
        }
      }
    }
    // If we've reached max retries and haven't returned, throw the last error
    console.error(`AI Pose Guidance: Failed to get response after ${maxRetries} retries.`);
    throw new Error(`Failed to get AI pose guidance after ${maxRetries} retries: ${lastError?.message || lastError}`);
  }
);
