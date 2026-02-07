import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Save, RotateCcw, FileSpreadsheet, RefreshCw, Search, User } from 'lucide-react';
import { supabase, Student } from '../lib/supabase';
import * as XLSX from 'xlsx';
import { Link } from 'react-router-dom';

type MinimalStudent = Pick<Student, 'register_no' | 'name'> & { profile_image_url?: string | null };

export default function DailyAttendance() {
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

  const trySyncToSupabase = async () => {
    await saveAttendance();
  };

  const ringColor =
    attendancePercentToday >= 90 ? '#16a34a' :
    attendancePercentToday >= 75 ? '#22c55e' :
    attendancePercentToday >= 60 ? '#f59e0b' : '#ef4444';
  const pct = Math.min(Math.max(attendancePercentToday, 0), 100);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-cyan-50">
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <CalendarDays className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Daily Attendance</h1>
              <p className="text-xs text-gray-500">Mark absentees and calculate attendance automatically</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Link to="/dashboard" className="px-3 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition">
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl bg-white/90 backdrop-blur shadow-lg border border-slate-100 p-6 animate-[slideFadeIn_0.4s_ease-out]">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">Select Date</label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">Total Working Days</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    placeholder="40"
                    value={workingDays}
                    onChange={(e) => setWorkingDays(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white w-full md:w-48"
                  />
                  {workingDaysInvalid && (
                    <p className="text-red-600 text-sm">Total Working Days must be a positive number</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white/90 backdrop-blur shadow-lg border border-slate-100 p-6 animate-[slideFadeIn_0.5s_ease-out]">
              <div className="flex items-center gap-3 mb-4">
                <Search className="w-5 h-5 text-slate-600" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name or register number"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white"
                />
              </div>
              <div className="max-h-[520px] overflow-auto divide-y divide-slate-200">
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-slate-200 rounded w-1/3 animate-pulse" />
                          <div className="h-3 bg-slate-200 rounded w-1/4 animate-pulse" />
                        </div>
                        <div className="w-16 h-6 bg-slate-200 rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : (
                  filtered.map((s) => {
                    const checked = absentees.has(s.register_no);
                    return (
                      <label
                        key={s.register_no}
                        className="flex items-center justify-between p-3 hover:bg-slate-50 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-white/70 p-2 rounded-full">
                            {s.profile_image_url ? (
                              <img src={s.profile_image_url || ''} alt={s.name} className="w-10 h-10 rounded-full object-cover" />
                            ) : (
                              <User className="w-10 h-10 text-slate-700" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{s.name}</p>
                            <p className="text-sm text-slate-600 font-mono">{s.register_no}</p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAbsent(s.register_no)}
                          className="w-6 h-6 rounded accent-red-600 cursor-pointer transition-transform duration-150 ease-out"
                        />
                      </label>
                    );
                  })
                )}
                {!loading && filtered.length === 0 && (
                  <div className="text-center text-slate-600 py-6">No students found</div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 animate-[slideFadeIn_0.6s_ease-out]">
              <button
                onClick={saveAttendance}
                disabled={saving || workingDaysInvalid}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl shadow hover:bg-blue-700 transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Save Attendance
              </button>
              <button
                onClick={resetDay}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-800 rounded-xl shadow hover:bg-slate-200 transition"
              >
                <RotateCcw className="w-4 h-4" />
                Reset Day
              </button>
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl shadow hover:bg-emerald-700 transition"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export to Excel
              </button>
              <button
                onClick={trySyncToSupabase}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl shadow hover:bg-indigo-700 transition disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                Sync to Supabase
              </button>
              {error && <p className="text-red-600 font-medium">{error}</p>}
              {success && <p className="text-green-600 font-medium">{success}</p>}
            </div>
          </section>

          <aside className="lg:col-span-1">
            <div className="rounded-2xl bg-white/90 backdrop-blur shadow-lg border border-slate-100 p-6 sticky top-6 animate-[slideFadeIn_0.5s_ease-out]">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Summary</h3>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white/70 backdrop-blur p-4 rounded-xl border border-slate-200 text-center">
                  <p className="text-xs text-slate-500 mb-1">Total Students</p>
                  <p className="text-2xl font-bold text-slate-900">{totalStudents}</p>
                </div>
                <div className="bg-white/70 backdrop-blur p-4 rounded-xl border border-slate-200 text-center">
                  <p className="text-xs text-slate-500 mb-1">Present Today</p>
                  <p className="text-2xl font-bold text-emerald-600">{presentToday}</p>
                </div>
                <div className="bg-white/70 backdrop-blur p-4 rounded-xl border border-slate-200 text-center">
                  <p className="text-xs text-slate-500 mb-1">Absent Today</p>
                  <p className="text-2xl font-bold text-red-600">{absentToday}</p>
                </div>
                <div className="bg-white/70 backdrop-blur p-4 rounded-xl border border-slate-200 text-center">
                  <p className="text-xs text-slate-500 mb-1">Working Days</p>
                  <p className="text-2xl font-bold text-slate-900">{workingDaysInvalid ? '—' : workingDaysNum}</p>
                </div>
              </div>
              <div className="flex items-center justify-center mb-2">
                <div className="relative w-28 h-28">
                  <div
                    className="absolute inset-0 rounded-full transition-all duration-700 ease-out"
                    style={{
                      background: `conic-gradient(${ringColor} ${pct}%, #e5e7eb ${pct}%)`,
                    }}
                  />
                  <div className="absolute inset-3 rounded-full bg-white/90 backdrop-blur flex items-center justify-center">
                    <span className="text-xl font-bold text-slate-800">{Math.round(pct)}%</span>
                  </div>
                </div>
              </div>
              <p className="text-center text-slate-600 text-sm">Attendance Percentage (today)</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
