export interface StudentClass {
  id: string;
  code: string;
  name: string;
  description: string | null;
  created_at: unknown;
  updated_at: unknown;
  student_count?: string;
}
