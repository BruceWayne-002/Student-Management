import { useState, useEffect } from 'react';
import { Users, TrendingUp, Award, BookOpen } from 'lucide-react';
import { supabase, Student } from '../lib/supabase';

interface Stats {
  totalStudents: number;
  averageAttendance: number;
  topPerformer: Student | null;
  attendanceDistribution: Record<string, number>;
  departmentStats: Record<string, { count: number; avgAttendance: number; avgMarks: number }>;
}

export default function Analytics() {
  const [stats, setStats] = useState<Stats>({
    totalStudents: 0,
    averageAttendance: 0,
    topPerformer: null,
    attendanceDistribution: {},
    departmentStats: {},
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    const { data: students } = await supabase
      .from('students')
      .select('*');

    if (students && students.length > 0) {
      const totalStudents = students.length;
      
      // Calculate Average Attendance
      const averageAttendance = students.reduce((sum, s) => sum + (s.attendance_percentage || 0), 0) / totalStudents;
      
      // Find Top Performer (based on Total Marks: CIA 1 + CIA 2)
      const topPerformer = students.reduce((top, current) => {
        const topMarks = (top.cia_1_mark || 0) + (top.cia_2_mark || 0);
        const currentMarks = (current.cia_1_mark || 0) + (current.cia_2_mark || 0);
        return currentMarks > topMarks ? current : top;
      });

      // Attendance Distribution
      const attendanceDistribution: Record<string, number> = {
        'Excellent (>90%)': 0,
        'Good (75-90%)': 0,
        'Low (<75%)': 0,
      };

      students.forEach(s => {
        const att = s.attendance_percentage || 0;
        if (att > 90) attendanceDistribution['Excellent (>90%)']++;
        else if (att >= 75) attendanceDistribution['Good (75-90%)']++;
        else attendanceDistribution['Low (<75%)']++;
      });

      // Department Stats
      const departmentStats: Record<string, { count: number; avgAttendance: number; avgMarks: number }> = {};
      
      students.forEach(s => {
        if (!departmentStats[s.department]) {
          departmentStats[s.department] = { count: 0, avgAttendance: 0, avgMarks: 0 };
        }
        const dept = departmentStats[s.department];
        dept.count++;
        dept.avgAttendance += (s.attendance_percentage || 0);
        dept.avgMarks += ((s.cia_1_mark || 0) + (s.cia_2_mark || 0));
      });

      // Finalize Department Averages
      Object.keys(departmentStats).forEach(dept => {
        const d = departmentStats[dept];
        d.avgAttendance /= d.count;
        d.avgMarks /= d.count;
      });

      setStats({
        totalStudents,
        averageAttendance: Math.round(averageAttendance * 100) / 100,
        topPerformer,
        attendanceDistribution,
        departmentStats,
      });
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 mt-4">Loading analytics...</p>
      </div>
    );
  }

  // removed unused variable

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Analytics Dashboard</h2>
        <p className="text-gray-600">Comprehensive insights and statistics</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <Users className="w-10 h-10 opacity-80" />
            <div className="bg-white/20 px-3 py-1 rounded-full text-sm">Total</div>
          </div>
          <p className="text-4xl font-bold mb-1">{stats.totalStudents}</p>
          <p className="text-blue-100">Students Enrolled</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-10 h-10 opacity-80" />
            <div className="bg-white/20 px-3 py-1 rounded-full text-sm">Avg Attendance</div>
          </div>
          <p className="text-4xl font-bold mb-1">{stats.averageAttendance}%</p>
          <p className="text-green-100">Overall Performance</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <Award className="w-10 h-10 opacity-80" />
            <div className="bg-white/20 px-3 py-1 rounded-full text-sm">Top Performer</div>
          </div>
          <p className="text-4xl font-bold mb-1">
            {((stats.topPerformer?.cia_1_mark || 0) + (stats.topPerformer?.cia_2_mark || 0))}
            <span className="text-xl font-normal opacity-80"> marks</span>
          </p>
          <p className="text-purple-100 truncate">{stats.topPerformer?.name}</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <BookOpen className="w-10 h-10 opacity-80" />
            <div className="bg-white/20 px-3 py-1 rounded-full text-sm">Departments</div>
          </div>
          <p className="text-4xl font-bold mb-1">{Object.keys(stats.departmentStats).length}</p>
          <p className="text-orange-100">Active Departments</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-6">Attendance Distribution</h3>
          <div className="space-y-4">
            {Object.entries(stats.attendanceDistribution).map(([category, count]) => (
                <div key={category}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-gray-700">{category}</span>
                    <span className="text-gray-600">{count} students</span>
                  </div>
                  <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        category.includes('Excellent') ? 'bg-green-500' :
                        category.includes('Good') ? 'bg-blue-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${stats.totalStudents > 0 ? (count / stats.totalStudents) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Department Performance */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-6">Department Attendance</h3>
          <div className="space-y-4">
            {Object.entries(stats.departmentStats)
              .sort((a, b) => b[1].avgAttendance - a[1].avgAttendance)
              .map(([dept, data]) => (
                <div key={dept}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-gray-700">{dept}</span>
                    <span className="text-gray-600">{Math.round(data.avgAttendance)}% avg</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all"
                        style={{ width: `${data.avgAttendance}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-500">{data.count} students</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Department Breakdown Grid */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-6">Department Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(stats.departmentStats).map(([dept, data]) => (
            <div key={dept} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h4 className="font-semibold text-gray-800 mb-3">{dept}</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Students:</span>
                  <span className="font-medium text-gray-800">{data.count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Avg Attendance:</span>
                  <span className={`font-medium ${
                    data.avgAttendance >= 75 ? 'text-green-600' :
                    data.avgAttendance >= 60 ? 'text-blue-600' :
                    'text-red-600'
                  }`}>{Math.round(data.avgAttendance)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Avg Total Marks:</span>
                  <span className="font-medium text-gray-800">{Math.round(data.avgMarks)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
