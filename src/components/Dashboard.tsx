import { useAuth } from '../contexts/AuthContext';
import { LogOut, Users } from 'lucide-react';
import StudentSearch from './StudentSearch';
import Analytics from './Analytics';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { user, userRole, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-cyan-50">
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Student Management</h1>
                <p className="text-xs text-gray-500">
                  {userRole?.role === 'admin' ? 'Administrator' :
                   userRole?.role === 'student' ? 'Student' : 'Staff'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                to="/attendance"
                className="px-3 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
              >
                Daily Attendance
              </Link>
              <span className="text-sm text-gray-600">{user?.email}</span>
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-10">
        {/* Search Section — TOP */}
        <section className="max-w-4xl mx-auto">
          <div className="rounded-2xl bg-white/90 backdrop-blur shadow-lg border border-slate-100">
            <div className="p-6">
              <StudentSearch />
            </div>
          </div>
        </section>

        {/* Analytics — BELOW */}
        <section>
          <div className="rounded-2xl bg-white/95 backdrop-blur-sm shadow-md border border-slate-100 opacity-95">
            <div className="p-6">
              <Analytics />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
