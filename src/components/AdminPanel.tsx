import { useState, useEffect } from 'react';
import { Trash2, Edit, Shield, Download } from 'lucide-react';
import { supabase, Student } from '../lib/supabase';
import * as XLSX from 'xlsx';

export default function AdminPanel() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'staff' | 'student'>('staff');

  useEffect(() => {
    fetchStudents();
    checkDuplicateRegisterNos();
  }, []);

  const checkDuplicateRegisterNos = async () => {
    const { data } = await supabase
      .from('students')
      .select('register_no');
    if (data) {
      const map = new Map<string, number>();
      for (const s of data as Array<{ register_no: string | null }>) {
        const key = s.register_no;
        if (!key) continue;
        map.set(key, (map.get(key) || 0) + 1);
      }
      const duplicates = Array.from(map.entries()).filter((entry) => entry[1] > 1);
      console.log('DUPLICATE REGISTER_NOS:', duplicates);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('students')
      .select('*')
      .order('register_no', { ascending: true });

    if (data) {
      setStudents(data);
    }
    setLoading(false);
  };

  const handleDelete = async (register_no: string) => {
    if (!confirm(`Are you sure you want to delete the student record for ${register_no}?`)) return;

    const { error } = await supabase
      .from('students')
      .delete()
      .eq('register_no', register_no);

    if (!error) {
      fetchStudents();
    } else {
      alert('Failed to delete student: ' + error.message);
    }
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
  };

  const saveEdit = async () => {
    if (!editingStudent) return;

    const { error } = await supabase
      .from('students')
      .update({
        name: editingStudent.name,
        father_name: editingStudent.father_name,
        mother_name: editingStudent.mother_name,
        address: editingStudent.address,
        class: editingStudent.class,
        year: editingStudent.year,
        department: editingStudent.department,
        cia_1_mark: editingStudent.cia_1_mark,
        cia_2_mark: editingStudent.cia_2_mark,
        present_today: editingStudent.present_today,
        leave_taken: editingStudent.leave_taken,
        phone_number: editingStudent.phone_number,
        email: editingStudent.email,
      })
      .eq('register_no', editingStudent.register_no);

    if (!error) {
      setEditingStudent(null);
      fetchStudents();
    } else {
      alert('Failed to update student: ' + error.message);
    }
  };

  const downloadAllData = () => {
    const exportData = students.map(s => ({
      'Register Number': s.register_no,
      'Student Name': s.name,
      'Father Name': s.father_name,
      'Mother Name': s.mother_name,
      'Department': s.department,
      'Class': s.class,
      'Year': s.year,
      'CIA 1': s.cia_1_mark,
      'CIA 2': s.cia_2_mark,
      'Present Days': s.present_today,
      'Leave Taken': s.leave_taken,
      'Attendance %': s.attendance_percentage,
      'Email': s.email,
      'Phone': s.phone_number,
      'Address': s.address,
      'Last Updated': new Date(s.last_updated).toLocaleString(),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, `students_export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const assignRole = async () => {
    alert('Assign Role requires a secure backend function. Please run this operation from the admin backend.');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Admin Panel</h2>
          <p className="text-gray-600">Manage student records and user roles</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowRoleModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <Shield className="w-5 h-5" />
            <span>Assign Role</span>
          </button>
          <button
            onClick={downloadAllData}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <Download className="w-5 h-5" />
            <span>Export All</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading students...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Register No</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Dept</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Class/Year</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Attendance</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {students.map((student) => (
                  <tr key={student.register_no} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.register_no}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{student.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{student.department}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{student.class} / {student.year}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        student.attendance_percentage >= 75 ? 'bg-green-100 text-green-800' :
                        student.attendance_percentage >= 60 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {student.attendance_percentage}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(student)}
                          className="text-blue-600 hover:text-blue-800 transition"
                          title="Edit"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(student.register_no)}
                          className="text-red-600 hover:text-red-800 transition"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {students.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600">No student records found</p>
            </div>
          )}
        </div>
      )}

      {editingStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full my-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Edit Student Record</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Identity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editingStudent.name}
                  onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Register No (Read-only)</label>
                <input
                  type="text"
                  value={editingStudent.register_no}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                />
              </div>
              
              {/* Academic Info */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <input
                  type="text"
                  value={editingStudent.department}
                  onChange={(e) => setEditingStudent({ ...editingStudent, department: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                <input
                  type="text"
                  value={editingStudent.class}
                  onChange={(e) => setEditingStudent({ ...editingStudent, class: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <input
                  type="text"
                  value={editingStudent.year}
                  onChange={(e) => setEditingStudent({ ...editingStudent, year: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Parents */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Father's Name</label>
                <input
                  type="text"
                  value={editingStudent.father_name}
                  onChange={(e) => setEditingStudent({ ...editingStudent, father_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mother's Name</label>
                <input
                  type="text"
                  value={editingStudent.mother_name}
                  onChange={(e) => setEditingStudent({ ...editingStudent, mother_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Marks & Attendance */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CIA 1 Mark</label>
                <input
                  type="number"
                  value={editingStudent.cia_1_mark}
                  onChange={(e) => setEditingStudent({ ...editingStudent, cia_1_mark: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CIA 2 Mark</label>
                <input
                  type="number"
                  value={editingStudent.cia_2_mark}
                  onChange={(e) => setEditingStudent({ ...editingStudent, cia_2_mark: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Present Days</label>
                <input
                  type="number"
                  value={editingStudent.present_today}
                  onChange={(e) => setEditingStudent({ ...editingStudent, present_today: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Leave Taken</label>
                <input
                  type="number"
                  value={editingStudent.leave_taken}
                  onChange={(e) => setEditingStudent({ ...editingStudent, leave_taken: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Contact */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editingStudent.email || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={editingStudent.phone_number || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, phone_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  value={editingStudent.address}
                  onChange={(e) => setEditingStudent({ ...editingStudent, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={2}
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={saveEdit}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Save Changes
              </button>
              <button
                onClick={() => setEditingStudent(null)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showRoleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Assign User Role</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">User Email</label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'staff' | 'student')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="staff">Staff (View Only)</option>
                  <option value="admin">Admin (Full Access)</option>
                  <option value="student">Student</option>
                </select>
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={assignRole}
                className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition font-medium"
              >
                Assign Role
              </button>
              <button
                onClick={() => setShowRoleModal(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
