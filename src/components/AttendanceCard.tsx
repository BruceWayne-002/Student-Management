import { Student } from '../lib/supabase';
import { BookOpen } from 'lucide-react';

interface Props {
  student: Student;
  attendance: number | null;
}

export default function AttendanceCard({ student, attendance }: Props) {
  const color =
    Number(attendance ?? 0) >= 75
      ? 'bg-green-600'
      : 'bg-amber-500';
  const width = Math.min(Number(attendance ?? 0), 100);

  const formatValue = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v);

  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur shadow-lg shadow-slate-200/60 p-6">
      <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
        <div className="flex items-center space-x-3">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <h4 className="text-slate-800 text-lg font-semibold tracking-tight">Attendance Analytics</h4>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">Present Days</p>
            <p className="font-semibold text-slate-900">{formatValue(student.present_today)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Leave Taken</p>
            <p className="font-semibold text-slate-900">{formatValue(student.leave_taken)}</p>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-500">Overall Percentage</span>
            <span className="font-bold text-slate-900">
              {attendance === null ? 'N/A' : `${Number(attendance).toFixed(2)}%`}
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
            <div className={`h-2.5 rounded-full ${color} transition-all duration-700 ease-out`} style={{ width: `${width}%` }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
