import { Student } from '../lib/supabase';
import { Award } from 'lucide-react';

interface Props {
  student: Student;
}

const formatValue = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v);

export default function AcademicCard({ student }: Props) {
  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur shadow-lg shadow-slate-200/60 p-6">
      <div className="flex items-center space-x-3 mb-4 border-b border-slate-200 pb-2">
        <Award className="w-5 h-5 text-green-600" />
        <h4 className="text-slate-800 text-lg font-semibold tracking-tight">Academic Performance (CIA)</h4>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/70 backdrop-blur p-5 rounded-xl shadow-sm text-center border border-slate-200">
          <p className="text-slate-500 text-sm mb-1">CIA 1</p>
          <p className={`text-4xl font-bold ${Number(student.cia_1_mark ?? 0) > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
            {formatValue(student.cia_1_mark)}
          </p>
        </div>
        <div className="bg-white/70 backdrop-blur p-5 rounded-xl shadow-sm text-center border border-slate-200">
          <p className="text-slate-500 text-sm mb-1">CIA 2</p>
          <p className={`text-4xl font-bold ${Number(student.cia_2_mark ?? 0) > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
            {formatValue(student.cia_2_mark)}
          </p>
        </div>
      </div>
    </div>
  );
}
