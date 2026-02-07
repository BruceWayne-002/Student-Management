import { Student } from '../lib/supabase';
import { User } from 'lucide-react';

interface Props {
  student: Student;
}

export default function PersonalInfoCard({ student }: Props) {
  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur shadow-lg shadow-slate-200/60 p-6">
      <div className="flex items-center space-x-3 mb-4 border-b border-slate-200 pb-2">
        <User className="w-5 h-5 text-blue-600" />
        <h4 className="text-slate-800 text-lg font-semibold tracking-tight">Personal Information</h4>
      </div>
      <div className="space-y-0 text-sm divide-y divide-slate-200">
        <div className="grid grid-cols-3 gap-2 py-2">
          <span className="text-slate-500">Father</span>
          <span className="col-span-2 font-semibold text-slate-900">{student.father_name || 'N/A'}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 py-2">
          <span className="text-slate-500">Mother</span>
          <span className="col-span-2 font-semibold text-slate-900">{student.mother_name || 'N/A'}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 py-2">
          <span className="text-slate-500">Address</span>
          <span className="col-span-2 font-semibold text-slate-900 whitespace-normal break-words">
            {student.address || 'N/A'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 py-2">
          <span className="text-slate-500">Email</span>
          <span className="col-span-2 font-semibold text-slate-900">{student.email ?? 'N/A'}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 py-2">
          <span className="text-slate-500">Phone</span>
          <span className="col-span-2 font-semibold text-slate-900">{student.phone_number ?? 'N/A'}</span>
        </div>
      </div>
    </div>
  );
}
