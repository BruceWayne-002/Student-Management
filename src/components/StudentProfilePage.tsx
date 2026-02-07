import { Student } from '../lib/supabase';
import ProfileHeader from './ProfileHeader';
import PersonalInfoCard from './PersonalInfoCard';
import AcademicCard from './AcademicCard';
import AttendanceCard from './AttendanceCard';
import ActionButtons from './ActionButtons';

interface Props {
  student: Student;
  onBack?: () => void;
}

const computeAttendance = (present?: number | null, leave?: number | null) => {
  const p = typeof present === 'number' ? present : null;
  const l = typeof leave === 'number' ? leave : null;
  if (p === null || l === null) return null;
  const total = p + l;
  if (!Number.isFinite(total) || total <= 0) return 0;
  const perc = (p / total) * 100;
  return Number.isFinite(perc) ? Math.round(perc * 100) / 100 : 0;
};

export default function StudentProfilePage({ student, onBack }: Props) {
  const attendance = computeAttendance(student.present_today, student.leave_taken);
  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-blue-50">
      <div className="sticky top-0 z-10 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="animate-[slideFadeIn_0.5s_ease-out]">
            <ProfileHeader student={student} attendance={attendance} />
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="animate-[slideFadeIn_0.6s_ease-out]">
            <PersonalInfoCard student={student} />
          </div>
          <div className="animate-[slideFadeIn_0.7s_ease-out]">
            <AcademicCard student={student} />
          </div>
        </div>
        <div className="mt-6 animate-[slideFadeIn_0.8s_ease-out]">
          <AttendanceCard student={student} attendance={attendance} />
        </div>
        <div className="mt-8 flex justify-end">
          <ActionButtons student={student} onBack={onBack} />
        </div>
      </div>
    </div>
  );
}
