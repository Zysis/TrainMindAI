// ============================================
// TrainMind — Exercise Types
// ============================================

export interface Exercise {
  id: string;
  name: string;
  category: string;
  description: string | null;
  muscleGroups: string[];
  equipment: string[];
  videoUrl: string | null;
}

export interface ExerciseForm {
  name: string;
  category: string;
  description: string;
  muscleGroups: string;
  equipment: string;
  videoUrl: string;
}

export interface ExerciseListResponse {
  success: boolean;
  data: Exercise[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
