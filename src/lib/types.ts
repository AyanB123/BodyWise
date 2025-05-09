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
  { value: 'other', label: 'Other / Prefer not to say' },
];

export interface PosePhoto {
  id: string;
  name: string; // e.g., "Front View"
  dataUri: string | null;
  isCorrect: boolean | null;
  feedback: string | null;
}

export interface AnalysisResult {
  id: string;
  date: string; // ISO string
  bodyFatPercentage: number;
  visceralFat: number; // arbitrary units or percentage
  leanMuscleMass: number; // kg
  bmi: number;
  // Add more metrics as needed
}

export const POSE_TYPES = [
  { id: 'front', name: 'Front View', description: 'Stand facing the camera, arms slightly apart from your body, palms facing forward.' },
  { id: 'side_left', name: 'Side View (Left)', description: 'Stand with your left side to the camera, arms relaxed at your sides.' },
  { id: 'side_right', name: 'Side View (Right)', description: 'Stand with your right side to the camera, arms relaxed at your sides.' },
  { id: 'back', name: 'Back View', description: 'Stand with your back to the camera, arms slightly apart from your body.' },
] as const;

export type PoseType = typeof POSE_TYPES[number]['id'];
