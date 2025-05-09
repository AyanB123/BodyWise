

export interface UserProfile {
  height: number | string; // cm
  weight: number | string; // kg
  age: number | string;
  gender: 'male' | 'female' | 'other' | '';
  ethnicity: 'asian' | 'black' | 'caucasian' | 'hispanic' | 'other' | '';
}

export const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

export const ETHNICITY_OPTIONS = [
  { value: 'asian', label: 'Asian' },
  { value: 'black', label: 'Black or African American' },
  { value: 'caucasian', label: 'White or Caucasian' },
  { value: 'hispanic', label: 'Hispanic or Latino' },
  { value: 'other', label: 'Other / Prefer not to declare' },
];

export interface PosePhoto {
  id: string;
  name: string; // e.g., "Front View"
  dataUri: string | null;
  isCorrect: boolean | null;
  feedback: string | null;
  // silhouetteData?: LandmarkPoint[] | string; // To be added later
}

// Placeholder for LandmarkPoint if we define a structure for silhouetteData
// export interface LandmarkPoint { x: number; y: number; z?: number; name?: string; }

export interface AnalysisResult {
  id:string;
  date: string; // ISO string
  bodyFatPercentage: number;
  visceralFat: number; // arbitrary units or percentage
  leanMuscleMass: number; // kg
  bmi: number;
  // Add more metrics as needed
}

export const POSE_TYPES = [
  {
    id: 'front_t_pose',
    name: 'T-Pose (Front View)',
    description: 'Stand facing the camera squarely, maintaining an upright posture. Extend both arms straight out to your sides, ensuring they are perfectly horizontal and form a 90-degree angle with your torso (parallel to the ground). Palms must face directly forward, with all fingers kept straight, extended, and held tightly together. Your thumbs should also be extended and aligned with your fingers. Feet should be positioned shoulder-width apart, with toes pointing directly forward towards the camera. Your head should be level, looking straight at the camera lens with a neutral facial expression (mouth closed, relaxed). Ensure your entire body, from head to toes including fingertips and heels, is fully visible within the camera frame and not cut off. Wear form-fitting clothing if possible to avoid obscuring body contours; avoid baggy or loose garments.',
    shortInstruction: 'Front T-Pose. Arms horizontal, palms forward, fingers straight. Feet shoulder-width. Look at camera.',
    // silhouette: '/silhouettes/front_t_pose.svg' // Example path
  },
  {
    id: 'side_left_a_pose',
    name: 'A-Pose (Left Side View)',
    description: 'Stand with your left side directly facing the camera, maintaining an upright posture. Allow arms to hang naturally, then move them slightly away from your body to form a 30-45 degree angle from your torso (an "A" shape). Keep fingers straight, extended, and held together, with palms facing towards your body (inwards). Feet should be together or no more than hip-width apart, with toes pointing forward (relative to your body, perpendicular to the camera). Your head should be level, looking straight ahead (perpendicular to the camera) with a neutral facial expression. Ensure your entire body, from head to toes, is fully visible. Wear form-fitting clothing if possible.',
    shortInstruction: 'Left A-Pose. Left side to camera. Arms slightly out, palms in. Feet together. Look ahead.',
    // silhouette: '/silhouettes/side_left_a_pose.svg'
  },
  {
    id: 'side_right_a_pose',
    name: 'A-Pose (Right Side View)',
    description: 'Stand with your right side directly facing the camera, maintaining an upright posture. Allow arms to hang naturally, then move them slightly away from your body to form a 30-45 degree angle from your torso (an "A" shape). Keep fingers straight, extended, and held together, with palms facing towards your body (inwards). Feet should be together or no more than hip-width apart, with toes pointing forward (relative to your body, perpendicular to the camera). Your head should be level, looking straight ahead (perpendicular to the camera) with a neutral facial expression. Ensure your entire body, from head to toes, is fully visible. Wear form-fitting clothing if possible.',
    shortInstruction: 'Right A-Pose. Right side to camera. Arms slightly out, palms in. Feet together. Look ahead.',
    // silhouette: '/silhouettes/side_right_a_pose.svg'
  },
  {
    id: 'back_t_pose',
    name: 'T-Pose (Back View)',
    description: 'Stand with your back squarely facing the camera, maintaining an upright posture. Extend both arms straight out to your sides, ensuring they are perfectly horizontal and form a 90-degree angle with your torso (parallel to the ground). Palms must face directly backward (away from the camera), with all fingers kept straight, extended, and held tightly together. Your thumbs should also be extended and aligned with your fingers. Feet should be positioned shoulder-width apart, with toes pointing directly forward (away from the camera). Your head should be level, looking straight ahead (away from the camera) with a neutral facial expression. Ensure your entire body, from head to toes including fingertips and heels, is fully visible. Wear form-fitting clothing if possible.',
    shortInstruction: 'Back T-Pose. Arms horizontal, palms back, fingers straight. Feet shoulder-width. Look straight ahead.',
    // silhouette: '/silhouettes/back_t_pose.svg'
  },
] as const;

export type PoseType = typeof POSE_TYPES[number]['id'];
