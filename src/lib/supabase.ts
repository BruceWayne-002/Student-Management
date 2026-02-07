import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

export interface Student {
  register_no: string; // Primary Key
  name: string;
  father_name: string;
  mother_name: string;
  address: string;
  class: string;
  year: string;
  department: string;
  cia_1_mark: number;
  cia_2_mark: number;
  present_today: number;
  leave_taken: number;
  attendance_percentage: number;
  email?: string | null;
  phone_number?: string | null;
  profile_image_url?: string;
  last_updated: string;
  created_at: string;
  created_by?: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'staff' | 'student';
  created_at: string;
}

export interface UploadHistory {
  id: string;
  uploaded_by: string;
  file_name: string;
  records_count: number;
  status: 'success' | 'partial' | 'failed';
  error_log: string | null;
  uploaded_at: string;
}
