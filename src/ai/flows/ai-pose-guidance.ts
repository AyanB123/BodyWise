
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

const AIPoseGuidanceInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of the user, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  currentPose: z
    .string()
    .describe('Description of the current pose of the user (e.g., "front view", "side view attempt").'),
  desiredPose: z.string().describe('The desired pose for the user (e.g., "front view - stand facing camera, arms slightly apart, palms forward").'),
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
      'Real-time feedback to the user on how to adjust their pose to match the desired pose.'
    ),
  isCorrectPose: z
    .boolean()
    .describe('Whether the user is in the correct pose or not.'),
  detectedLandmarks: z.array(LandmarkPointSchema).optional().describe(
    "Optional: List of detected key body landmarks with their normalized coordinates. If landmarks cannot be reliably detected or are not applicable, this can be omitted or be an empty array."
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
  prompt: `You are an AI assistant specializing in human pose estimation and guidance for body analysis photography.

  The user is trying to capture a photo of themselves in a specific pose. Your goal is to provide clear, concise feedback to help them achieve the desired pose and to determine if their current pose is correct.

  User's current attempt context: {{{currentPose}}}
  Desired pose: {{{desiredPose}}}
  Photo provided by user: {{media url=photoDataUri}}

  Tasks:
  1. Analyze the provided photo against the desired pose.
  2. Provide specific, actionable feedback to the user on how to adjust their current pose to match the desired pose. For example, "Tilt your head slightly to the left," or "Ensure your feet are shoulder-width apart."
  3. Determine if the user's current pose in the photo is substantially correct according to the desired pose. Set 'isCorrectPose' to true if it is, and false otherwise.
  4. Optional: If you can reliably identify key body landmarks, provide their normalized (0.0 to 1.0) x and y coordinates. 'x' is from left to right, 'y' is from top to bottom of the image.
     Example landmarks: 'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear', 'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist', 'left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle'.
     If you cannot reliably detect landmarks, or if it's not applicable for this task, omit the 'detectedLandmarks' field or provide an empty array.

  Be precise and helpful. The user relies on your guidance for accurate body analysis.
  `,
});

const aiPoseGuidanceFlow = ai.defineFlow(
  {
    name: 'aiPoseGuidanceFlow',
    inputSchema: AIPoseGuidanceInputSchema,
    outputSchema: AIPoseGuidanceOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    // Ensure detectedLandmarks is an array if it's undefined (though Zod's .optional() should handle it)
    if (output && output.detectedLandmarks === undefined) {
      output.detectedLandmarks = [];
    }
    return output!;
  }
);
