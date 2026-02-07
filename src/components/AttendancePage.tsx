import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Search, Check, RotateCcw, FileSpreadsheet, RefreshCcw } from 'lucide-react';
import { supabase, Student } from '../lib/supabase';
import * as XLSX from 'xlsx';
import { Link } from 'react-router-dom';

type MinimalStudent = Pick<Student, 'register_no' | 'name'> & { profile_image_url?: string | null };

function SummaryCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className={`${color} rounded-lg p-4 text-white`}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

export default function AttendancePage() {
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [date, setDate] = useState<string>(todayISO);
  const [workingDays, setWorkingDays] = useState<string>('40');
  const [students, setStudents] = useState<MinimalStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [absentees, setAbsentees] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    const fetchStudents = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('students')
        .select('register_no,name,profile_image_url')
        .order('name', { ascending: true });
      if (!mounted) return;
      if (error) {
        setError('Failed to load students');
        setStudents([]);
      } else {
        setStudents((data || []) as MinimalStudent[]);
      }
      setLoading(false);
    };
    fetchStudents();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const loadForDate = async () => {
      const { data: absentRows } = await supabase
        .from('attendance_records')
        .select('register_no')
        .eq('attendance_date', date);
      setAbsentees(new Set((absentRows || []).map(r => r.register_no)));
      const { data: day } = await supabase
        .from('attendance_days')
        .select('*')
        .eq('attendance_date', date)
        .maybeSingle();
      if (day && typeof day.total_working_days === 'number') {
        setWorkingDays(String(day.total_working_days));
      }
    };
    loadForDate();
  }, [date]);

  const totalStudents = students.length;
  const absentToday = absentees.size;
  const presentToday = Math.max(totalStudents - absentToday, 0);
  const attendancePercentToday = totalStudents === 0 ? 0 : Math.round((presentToday / totalStudents) * 10000) / 100;

  const workingDaysNum = Number(workingDays);
  const workingDaysInvalid = !Number.isFinite(workingDaysNum) || workingDaysNum <= 0;

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return students;
    return students.filter(s =>
      (s.name || '').toLowerCase().includes(term) || (s.register_no || '').toLowerCase().includes(term)
    );
  }, [students, searchTerm]);

  const toggleAbsent = (regNo: string) => {
    setAbsentees(prev => {
      const next = new Set(prev);
      if (next.has(regNo)) next.delete(regNo);
      else next.add(regNo);
      return next;
    });
  };

  const resetDay = () => {
    setAbsentees(new Set());
    setSuccess('');
    setError('');
  };

  const saveAttendance = async () => {
    setError('');
    setSuccess('');
    if (workingDaysInvalid) {
      setError('Total Working Days must be a positive number');
      return;
    }
    setSaving(true);
    try {
      const attendanceDate = date;
      const totalWorkingDays = workingDaysNum;
      const absentCount = absentees.size;
      const presentCount = Math.max(totalStudents - absentCount, 0);
      const attendancePercentage = totalStudents === 0
        ? 0
        : Math.round((presentCount / totalStudents) * 10000) / 100;

      await supabase
        .from('attendance_days')
        .upsert({
          attendance_date: attendanceDate,
          total_working_days: totalWorkingDays,
          total_students: totalStudents,
          present_count: presentCount,
          absent_count: absentCount,
          attendance_percentage: attendancePercentage,
        }, { onConflict: 'attendance_date' });

      await supabase
        .from('attendance_records')
        .delete()
        .eq('attendance_date', attendanceDate);

      const toInsert = Array.from(absentees).map(regNo => {
        const s = students.find(st => st.register_no === regNo);
        return {
          attendance_date: attendanceDate,
          register_no: regNo,
          student_name: s?.name || '',
          status: 'ABSENT',
        };
      });
      if (toInsert.length > 0) {
        await supabase
          .from('attendance_records')
          .insert(toInsert);
      }
      setSuccess('Attendance saved');
    } catch {
      setError('Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const exportToExcel = () => {
    const rows = Array.from(absentees).map(regNo => {
      const s = students.find(st => st.register_no === regNo);
      return {
        Date: date,
        Register_No: regNo,
        Name: s?.name || '',
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Absentees');
    XLSX.writeFile(wb, `absentees_${date}.xlsx`);
  };

  const ringColor =
    attendancePercentToday >= 90 ? '#16a34a' :
    attendancePercentToday >= 75 ? '#22c55e' :
    attendancePercentToday >= 60 ? '#f59e0b' : '#ef4444';
  const pct = Math.min(Math.max(attendancePercentToday, 0), 100);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-64 bg-[#0b2a44] text-white flex flex-col">
        <div className="px-6 py-4 text-lg font-semibold border-b border-white/10">
          Student Management
        </div>
        <nav className="flex-1 px-4 py-4 space-y-2">
          <Link to="/dashboard" className="block text-sm text-white/80 hover:text-white">Dashboard</Link>
          <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-blue-600 text-white">
            <CalendarDays size={18} />
            Attendance
          </div>
        </nav>
      </aside>

      <main className="flex-1 p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Daily Attendance</h1>
            <p className="text-sm text-slate-500">Mark absentees and calculate attendance automatically</p>
          </div>
          <Link to="/dashboard" className="px-4 py-2 rounded-lg border text-sm bg-white shadow">
            Back to Dashboard
          </Link>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8 space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm text-slate-500">Select Date</label>
                <div className="mt-2 flex items-center gap-2 bg-slate-50 px-4 py-3 rounded-lg">
                  <CalendarDays size={18} />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-transparent outline-none w-full"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-500">Total Working Days</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={workingDays}
                  onChange={(e) => setWorkingDays(e.target.value)}
                  className="mt-2 w-full bg-slate-50 px-4 py-3 rounded-lg outline-none"
                />
                {workingDaysInvalid && (
                  <p className="text-red-600 text-sm mt-2">Total Working Days must be a positive number</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-lg mb-4">
                <Search size={18} />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search student..."
                  className="bg-transparent outline-none w-full"
                />
              </div>

              <div className="space-y-3 max-h-[520px] overflow-auto">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
                      <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
                      <div className="w-6 h-6 rounded-full bg-slate-200 animate-pulse" />
                    </div>
                  ))
                ) : (
                  filtered.map(s => {
                    const checked = absentees.has(s.register_no);
                    return (
                      <div key={s.register_no} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
                        <div>
                          <p className="font-semibold text-slate-800">{s.name}</p>
                          <p className="text-xs text-slate-500">ID: {s.register_no}</p>
                        </div>
                        <button
                          onClick={() => toggleAbsent(s.register_no)}
                          className={`w-6 h-6 rounded-full flex items-center justify-center transition ${
                            checked ? 'bg-red-500' : 'bg-slate-300'
                          }`}
                          aria-pressed={checked}
                        >
                          <Check size={14} className="text-white" />
                        </button>
                      </div>
                    );
                  })
                )}
                {!loading && filtered.length === 0 && (
                  <div className="text-center text-slate-600 py-6">No students found</div>
                )}
              </div>

              <div className="flex items-center gap-4 mt-6">
                <button
                  onClick={saveAttendance}
                  disabled={saving || workingDaysInvalid}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                >
                  <Check size={16} /> Save Attendance
                </button>
                <button
                  onClick={resetDay}
                  className="flex items-center gap-2 border px-4 py-2 rounded-lg"
                >
                  <RotateCcw size={16} /> Reset Day
                </button>
                <button
                  onClick={exportToExcel}
                  className="ml-auto flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-lg"
                >
                  <FileSpreadsheet size={16} /> Excel
                </button>
                <button
                  onClick={saveAttendance}
                  disabled={saving}
                  className="flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg disabled:opacity-50"
                >
                  <RefreshCcw size={16} /> Sync
                </button>
              </div>
              {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
              {success && <p className="text-green-600 text-sm mt-3">✓ {success}</p>}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 bg-white rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4">Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <SummaryCard label="Total Students" value={totalStudents} color="bg-slate-900" />
              <SummaryCard label="Present" value={presentToday} color="bg-green-500" />
              <SummaryCard label="Absent" value={absentToday} color="bg-red-500" />
              <SummaryCard label="Working Days" value={workingDaysInvalid ? '—' : workingDaysNum} color="bg-yellow-400" />
            </div>
            <div className="mt-8 flex flex-col items-center">
              <div className="relative w-32 h-32">
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `conic-gradient(${ringColor} ${pct}%, #e5e7eb ${pct}%)`,
                    WebkitMaskImage: 'radial-gradient(circle, transparent 60%, black 61%)',
                    maskImage: 'radial-gradient(circle, transparent 60%, black 61%)',
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold">
                  {Math.round(pct)}%
                </div>
              </div>
              <p className="text-sm text-slate-500 mt-3">Attendance Percentage (Today)</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
