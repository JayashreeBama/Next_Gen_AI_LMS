export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff' | 'student';
  department?: string;
  subject?: string;
  phone?: string;
  course?: string;
  year?: string;
}

export interface Material {
  id: number;
  staff_id: string;
  department?: string;
  subject: string;
  topic: string;
  description: string;
  file_path: string;
  resource_type: string;
  upload_date: string;
}

export interface Question {
  id: number;
  subject: string;
  topic: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer?: string;
}

export interface Progress {
  student_name?: string;
  subject?: string;
  topic: string;
  score: number;
  timestamp?: string;
  status?: string;
}
