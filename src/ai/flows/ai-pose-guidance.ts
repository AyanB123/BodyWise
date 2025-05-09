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
    .describe('Description of the current pose of the user.'),
  desiredPose: z.string().describe('The desired pose for the user.'),
});
export type AIPoseGuidanceInput = z.infer<typeof AIPoseGuidanceInputSchema>;

const AIPoseGuidanceOutputSchema = z.object({
  feedback: z
    .string()
    .describe(
      'Real-time feedback to the user on how to adjust their pose to match the desired pose.'
    ),
  isCorrectPose: z
    .boolean()
    .describe('Whether the user is in the correct pose or not.'),
});
export type AIPoseGuidanceOutput = z.infer<typeof AIPoseGuidanceOutputSchema>;

export async function aiPoseGuidance(input: AIPoseGuidanceInput): Promise<AIPoseGuidanceOutput> {
  return aiPoseGuidanceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiPoseGuidancePrompt',
  input: {schema: AIPoseGuidanceInputSchema},
  output: {schema: AIPoseGuidanceOutputSchema},
  prompt: `You are an AI assistant that helps users capture accurate photos for body analysis.

  The user will take photos of themselves and you will provide feedback on their pose to ensure it matches the desired pose.

  Here's information about the user's current pose, the desired pose, and a photo:

  Current Pose: {{{currentPose}}}
  Desired Pose: {{{desiredPose}}}
  Photo: {{media url=photoDataUri}}

  Based on this information, provide feedback to the user on how to adjust their pose to match the desired pose. Be concise and specific.
  Also, determine if the user is in the correct pose or not. Set isCorrectPose to true if the pose is correct, and false otherwise.
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
    return output!;
  }
);
