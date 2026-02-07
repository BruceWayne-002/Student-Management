import { Student } from '../lib/supabase';
import { User } from 'lucide-react';

interface Props {
  student: Student;
  attendance: number | null;
}

export default function ProfileHeader({ student, attendance }: Props) {
  const badge = student.register_no || '—';
  const percText = attendance === null ? '—' : `${Math.round(attendance)}%`;
  const ringColor =
    Number(attendance ?? 0) >= 75
      ? '#16a34a'
      : Number(attendance ?? 0) >= 65
      ? '#f59e0b'
      : '#f59e0b';
  const pct = Math.min(Math.max(Number(attendance ?? 0), 0), 100);

  return (
    <div className="backdrop-blur-md bg-white/80 border border-white/50 rounded-2xl shadow-lg shadow-slate-200/60">
      <div className="px-6 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="bg-white/70 p-4 rounded-full">
              {student.profile_image_url ? (
                <img
                  src={student.profile_image_url}
                  alt={student.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <User className="w-12 h-12 text-slate-700" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-800">{student.name || '—'}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="bg-slate-900/10 text-slate-800 px-2 py-0.5 rounded text-xs font-mono">
                  {badge}
                </span>
                <span className="text-slate-500 text-sm">{student.department || '—'}</span>
              </div>
              <p className="text-slate-500 text-sm">{(student.class || '—')} • {(student.year || '—')} Year</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative w-24 h-24">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: attendance === null
                    ? 'conic-gradient(#e5e7eb 0%, #e5e7eb 100%)'
                    : `conic-gradient(${ringColor} ${pct}%, #e5e7eb ${pct}%)`,
                }}
              />
              <div className="absolute inset-2 rounded-full bg-white/90 backdrop-blur flex items-center justify-center">
                <span className="text-xl font-bold text-slate-800">{percText}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
