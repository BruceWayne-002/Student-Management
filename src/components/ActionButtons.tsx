import { Student } from '../lib/supabase';
import { Download, ArrowLeft } from 'lucide-react';
import jsPDF from 'jspdf';

interface Props {
  student: Student;
  onBack?: () => void;
}

export default function ActionButtons({ student, onBack }: Props) {
  const download = () => {
    const doc = new jsPDF();
    let y = 20;
    doc.setFontSize(18);
    doc.text('STUDENT PROFILE', 105, y, { align: 'center' });
    y += 10;
    doc.setFontSize(11);
    doc.text(`Name: ${student.name || '—'}`, 20, y); y += 6;
    doc.text(`Register No: ${student.register_no || '—'}`, 20, y); y += 6;
    doc.text(`Department: ${student.department || '—'}`, 20, y); y += 6;
    doc.text(`Class/Year: ${student.class || '—'} / ${student.year || '—'}`, 20, y); y += 10;
    doc.text(`Father: ${student.father_name || '—'}`, 20, y); y += 6;
    doc.text(`Mother: ${student.mother_name || '—'}`, 20, y); y += 6;
    doc.text(`Address: ${student.address || '—'}`, 20, y); y += 6;
    doc.text(`Email: ${student.email || '—'}`, 20, y); y += 6;
    doc.text(`Phone: ${student.phone_number || '—'}`, 20, y); y += 10;
    doc.text(`CIA 1: ${student.cia_1_mark ?? '—'}`, 20, y); y += 6;
    doc.text(`CIA 2: ${student.cia_2_mark ?? '—'}`, 20, y); y += 6;
    doc.text(`Present: ${student.present_today ?? '—'}`, 20, y); y += 6;
    doc.text(`Leave: ${student.leave_taken ?? '—'}`, 20, y); y += 6;
    doc.save(`${student.register_no}_profile.pdf`);
  };

  return (
    <div className="flex items-center justify-end gap-3">
      <button
        onClick={onBack}
        className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/80 backdrop-blur shadow-md text-slate-900 hover:bg-white focus:ring-2 focus:ring-blue-200"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Search</span>
      </button>
      <button
        onClick={download}
        className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/80 backdrop-blur shadow-md text-slate-900 hover:bg-white focus:ring-2 focus:ring-blue-200"
      >
        <Download className="w-4 h-4" />
        <span>Download PDF</span>
      </button>
    </div>
  );
}
