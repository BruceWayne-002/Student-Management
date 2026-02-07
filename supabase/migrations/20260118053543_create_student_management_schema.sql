
/*
  # Student Information Management System Schema

  1. New Tables
    - `students`
      - `register_no` (text, primary key) - Single source of truth
      - `name` (text)
      - `father_name` (text)
      - `mother_name` (text)
      - `address` (text)
      - `class` (text)
      - `year` (text)
      - `department` (text)
      - `cia_1_mark` (numeric)
      - `cia_2_mark` (numeric)
      - `present_today` (numeric) - Interpreted as total days present or similar counter based on requirements
      - `leave_taken` (numeric)
      - `attendance_percentage` (numeric) - Derived/Stored
      - `email` (text, optional)
      - `phone_number` (text, optional)
      - `profile_image_url` (text, optional)
      - `last_updated` (timestamptz)
      - `created_at` (timestamptz)
      - `created_by` (uuid)

    - `user_roles`
      - `id` (uuid, primary key)
      - `user_id` (uuid) - Reference to auth.users
      - `role` (text) - Role: admin, staff (user said Staff, let's include teacher as staff or separate)
      - `created_at` (timestamptz)

    - `upload_history`
      - `id` (uuid, primary key)
      - `uploaded_by` (uuid)
      - `file_name` (text)
      - `records_count` (integer)
      - `status` (text)
      - `error_log` (text)
      - `uploaded_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Policies for Admin and Staff
*/

-- Drop existing tables if they exist to ensure clean slate with new schema
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS upload_history CASCADE;

-- Create students table
CREATE TABLE students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  register_no text,
  name text,
  father_name text,
  mother_name text,
  address text,
  class text,
  year text,
  department text,
  cia_1_mark numeric DEFAULT 0 NOT NULL,
  cia_2_mark numeric DEFAULT 0 NOT NULL,
  present_today numeric DEFAULT 0 NOT NULL,
  leave_taken numeric DEFAULT 0 NOT NULL,
  attendance_percentage numeric DEFAULT 0 NOT NULL,
  email text,
  phone_number text,
  profile_image_url text,
  source_row_number integer,
  synced_at timestamptz DEFAULT now(),
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_students_register_no ON students(register_no);

-- Create user_roles table
CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'staff', 'student')),
  created_at timestamptz DEFAULT now()
);

-- Create upload_history table
CREATE TABLE upload_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by uuid REFERENCES auth.users(id) NOT NULL,
  file_name text NOT NULL,
  records_count integer DEFAULT 0,
  status text NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  error_log text,
  uploaded_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_history ENABLE ROW LEVEL SECURITY;

-- Students policies
CREATE POLICY "Anyone authenticated can view students"
  ON students FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert students"
  ON students FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins and Staff can update students"
  ON students FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Only admins can delete students"
  ON students FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- User roles policies
CREATE POLICY "Users can view their own role"
  ON user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
    )
  );

CREATE POLICY "Only admins can manage roles"
  ON user_roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Upload history policies
CREATE POLICY "Users can view their own uploads"
  ON upload_history FOR SELECT
  TO authenticated
  USING (uploaded_by = auth.uid());

CREATE POLICY "Admins can view all uploads"
  ON upload_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can insert upload history"
  ON upload_history FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

-- Function to automatically update last_updated timestamp
CREATE OR REPLACE FUNCTION update_last_updated_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = now();
  -- Auto-calculate attendance percentage if present_today or leave_taken changes
  -- Formula: (present_today / (present_today + leave_taken)) * 100
  IF (NEW.present_today + NEW.leave_taken) > 0 THEN
      NEW.attendance_percentage := ROUND((NEW.present_today::numeric / (NEW.present_today + NEW.leave_taken)::numeric) * 100, 2);
  ELSE
      NEW.attendance_percentage := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_updated on students table
DROP TRIGGER IF EXISTS update_students_last_updated ON students;
CREATE TRIGGER update_students_last_updated
  BEFORE INSERT OR UPDATE ON students
  FOR EACH ROW
  EXECUTE FUNCTION update_last_updated_column();
