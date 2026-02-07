import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { supabase, Student } from '../lib/supabase';
import StudentProfilePage from './StudentProfilePage';

export default function StudentSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (searchTerm.length >= 2) {
      fetchSuggestions();
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchTerm]);

  const fetchSuggestions = async () => {
    const q = searchTerm.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const { data } = await supabase
      .from('students')
      .select(`
        register_no,
        name,
        father_name,
        mother_name,
        address,
        class,
        year,
        department,
        cia_1_mark,
        cia_2_mark,
        present_today,
        leave_taken,
        attendance_percentage,
        email,
        phone_number,
        profile_image_url,
        last_updated,
        created_at
      `)
      .ilike('register_no', `%${q}%`)
      .limit(5);

    if (data) {
      setSuggestions(data);
      setShowSuggestions(true);
    }
  };

  const handleSearch = async (registerNo?: string) => {
    const searchValue = registerNo || searchTerm;
    if (!searchValue.trim()) return;

    setSelectedStudent(null);
    setLoading(true);
    setNotFound(false);
    setShowSuggestions(false);

    const { data } = await supabase
      .from('students')
      .select(`
        register_no,
        name,
        father_name,
        mother_name,
        address,
        class,
        year,
        department,
        cia_1_mark,
        cia_2_mark,
        present_today,
        leave_taken,
        attendance_percentage,
        email,
        phone_number,
        profile_image_url,
        last_updated,
        created_at
      `)
      .eq('register_no', searchValue.trim())
      .single();
    console.log('RAW SUPABASE STUDENT ROW:', data);
    if (data && (data as Student).last_updated) {
      console.log('FETCHED FROM SUPABASE AT:', (data as Student).last_updated);
    }

    if (data) {
      setSelectedStudent(data);
    } else {
      setSelectedStudent(null);
      setNotFound(true);
    }

    setLoading(false);
  };

  const handleSuggestionClick = (student: Student) => {
    setSearchTerm(student.register_no);
    setShowSuggestions(false);
    handleSearch(student.register_no);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Search Student Information</h2>
        <p className="text-gray-600">Enter full register number (exact match)</p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Enter full register number (exact match)..."
            className="w-full pl-12 pr-4 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-lg transition"
          />
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {suggestions.map((student) => (
              <button
                key={student.register_no}
                onClick={() => handleSuggestionClick(student)}
                className="w-full px-4 py-3 hover:bg-blue-50 text-left transition border-b border-gray-100 last:border-0"
              >
                <p className="font-semibold text-gray-800">{student.register_no || '—'}</p>
                <p className="text-sm text-gray-600">{(student.name || '—')} - {(student.department || '—')}</p>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => handleSearch()}
          disabled={loading}
          className="mt-4 w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>Searching...</span>
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              <span>Search</span>
            </>
          )}
        </button>
      </div>

      {notFound && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-semibold">No student found with register number: {searchTerm}</p>
        </div>
      )}

      {selectedStudent && (
        <StudentProfilePage student={selectedStudent} onBack={() => setSelectedStudent(null)} />
      )}
    </div>
  );
}
