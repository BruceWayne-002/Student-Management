import { useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

interface ParsedStudent {
  register_no: string;
  name: string;
  father_name: string;
  mother_name: string;
  address: string;
  class: string;
  year: string;
  department: string;
  cia_1_mark: number;
  cia_2_mark: number;
  present_today: number;
  leave_taken: number;
  attendance_percentage: number;
  email?: string;
  phone_number?: string;
  profile_image_url?: string;
}

export default function ExcelUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    success: number;
    failed: number;
    duplicates: number;
    errors: string[];
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const parseExcelFile = async (file: File): Promise<ParsedStudent[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

          const students: ParsedStudent[] = jsonData.map((row: Record<string, unknown>) => {
            // Helper to find key case-insensitively
            const getValue = (keys: string[]): unknown => {
              for (const k of keys) {
                if (row[k] !== undefined) return row[k];
                // Try case insensitive
                const foundKey = Object.keys(row).find(rk => rk.toLowerCase().replace(/_/g, '').replace(/\s/g, '') === k.toLowerCase().replace(/_/g, '').replace(/\s/g, ''));
                if (foundKey) return row[foundKey];
              }
              return undefined;
            };

            const register_no = String(getValue(['register_no', 'register_number', 'reg_no']) ?? '').trim();
            const name = String(getValue(['name', 'student_name', 'full_name']) ?? '').trim();
            const father_name = String(getValue(['father_name', 'father']) ?? '').trim();
            const mother_name = String(getValue(['mother_name', 'mother']) ?? '').trim();
            const address = String(getValue(['address', 'addr']) ?? '').trim();
            const className = String(getValue(['class', 'grade']) ?? '').trim();
            const year = String(getValue(['year']) ?? '').trim();
            const department = String(getValue(['department', 'dept']) ?? '').trim();
            
            const cia_1_mark = Number(getValue(['cia_1_mark', 'cia1', 'cia_1']));
            const cia_2_mark = Number(getValue(['cia_2_mark', 'cia2', 'cia_2']));
            const present_today = Number(getValue(['present_today', 'present', 'days_present']));
            const leave_taken = Number(getValue(['leave_taken', 'leave', 'days_absent']));
            let attendance_percentage = Number(getValue(['attendance_percentage', 'attendance', 'att_perc']));

            // Auto-calculate attendance if missing
            if (isNaN(attendance_percentage) && !isNaN(present_today) && !isNaN(leave_taken)) {
              const total = present_today + leave_taken;
              attendance_percentage = total > 0 ? (present_today / total) * 100 : 0;
            }

            return {
              register_no,
              name,
              father_name,
              mother_name,
              address,
              class: className,
              year,
              department,
              cia_1_mark: isNaN(cia_1_mark) ? -1 : cia_1_mark, // Use -1 to indicate invalid number for validation
              cia_2_mark: isNaN(cia_2_mark) ? -1 : cia_2_mark,
              present_today: isNaN(present_today) ? -1 : present_today,
              leave_taken: isNaN(leave_taken) ? -1 : leave_taken,
              attendance_percentage: isNaN(attendance_percentage) ? 0 : attendance_percentage,
              email: String(getValue(['email', 'mail']) || '').trim() || undefined,
              phone_number: String(getValue(['phone_number', 'phone', 'mobile']) || '').trim() || undefined,
              profile_image_url: String(getValue(['profile_image_url', 'image', 'photo']) || '').trim() || undefined,
            };
          });

          resolve(students);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsBinaryString(file);
    });
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setResult(null);

    try {
      const parsedStudents = await parseExcelFile(file);

      let successCount = 0;
      let failedCount = 0;
      let duplicateCount = 0;
      const errors: string[] = [];
      const validStudents: ParsedStudent[] = [];

      // Validation Phase
      const seenRegisterNos = new Set<string>();

      for (const student of parsedStudents) {
        const missingFields = [];
        if (!student.register_no) missingFields.push('register_no');
        if (!student.name) missingFields.push('name');
        if (!student.father_name) missingFields.push('father_name');
        if (!student.mother_name) missingFields.push('mother_name');
        if (!student.address) missingFields.push('address');
        if (!student.class) missingFields.push('class');
        if (!student.year) missingFields.push('year');
        if (!student.department) missingFields.push('department');
        
        // Numeric validation (we used -1 for invalid numbers)
        if (student.cia_1_mark < 0) missingFields.push('cia_1_mark (numeric)');
        if (student.cia_2_mark < 0) missingFields.push('cia_2_mark (numeric)');
        if (student.present_today < 0) missingFields.push('present_today (numeric)');
        if (student.leave_taken < 0) missingFields.push('leave_taken (numeric)');

        if (missingFields.length > 0) {
          failedCount++;
          errors.push(`Row for ${student.name || 'Unknown'}: Missing or invalid ${missingFields.join(', ')}`);
          continue;
        }

        if (seenRegisterNos.has(student.register_no)) {
          duplicateCount++;
          errors.push(`Duplicate in file: ${student.register_no}`);
          continue;
        }
        seenRegisterNos.add(student.register_no);
        validStudents.push(student);
      }

      const { data: { user } } = await supabase.auth.getUser();

      // Batch Insert/Upsert
      for (const student of validStudents) {
        // Check if exists in DB
        const { data: existing } = await supabase
          .from('students')
          .select('register_no')
          .eq('register_no', student.register_no)
          .maybeSingle();

        if (existing) {
          duplicateCount++;
          // Optional: Update if exists? User says "Treat Register Number as single source of truth" and "Allow bulk data ingestion".
          // Usually bulk upload might update existing. But "Reject upload if: Duplicate register numbers exist" in 2.4 Validation Rules.
          // "Reject upload if: Duplicate register numbers exist" usually means "don't create duplicates", but could mean "don't allow overwriting".
          // However, "Updates must be atomic".
          // Let's stick to "Reject upload if Duplicate register numbers exist".
          errors.push(`Duplicate in DB: ${student.register_no}`);
          continue;
        }

        const { error } = await supabase.from('students').insert({
          register_no: student.register_no,
          name: student.name,
          father_name: student.father_name,
          mother_name: student.mother_name,
          address: student.address,
          class: student.class,
          year: student.year,
          department: student.department,
          cia_1_mark: student.cia_1_mark,
          cia_2_mark: student.cia_2_mark,
          present_today: student.present_today,
          leave_taken: student.leave_taken,
          attendance_percentage: student.attendance_percentage,
          email: student.email,
          phone_number: student.phone_number,
          profile_image_url: student.profile_image_url,
          created_by: user?.id,
        });

        if (error) {
          failedCount++;
          errors.push(`${student.register_no}: ${error.message}`);
        } else {
          successCount++;
        }
      }

      await supabase.from('upload_history').insert({
        uploaded_by: user?.id,
        file_name: file.name,
        records_count: successCount,
        status: failedCount === 0 ? 'success' : duplicateCount > 0 ? 'partial' : 'failed',
        error_log: errors.length > 0 ? errors.join('\n') : null,
      });

      setResult({
        success: successCount,
        failed: failedCount,
        duplicates: duplicateCount,
        errors,
      });
    } catch (error) {
      setResult({
        success: 0,
        failed: 0,
        duplicates: 0,
        errors: [error instanceof Error ? error.message : 'Upload failed'],
      });
    } finally {
      setUploading(false);
      setFile(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Upload Student Data</h2>
        <p className="text-gray-600">Upload an Excel file containing student information. Supported formats: .xlsx, .xls, .csv</p>
      </div>

      <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-500 transition">
        <FileSpreadsheet className="w-16 h-16 text-gray-400 mx-auto mb-4" />

        <label className="cursor-pointer">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
            disabled={uploading}
          />
          <span className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            <Upload className="w-5 h-5" />
            <span>Choose Excel File</span>
          </span>
        </label>

        {file && (
          <div className="mt-4">
            <p className="text-gray-700 font-medium">{file.name}</p>
            <p className="text-gray-500 text-sm">{(file.size / 1024).toFixed(2)} KB</p>
          </div>
        )}
      </div>

      {file && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {uploading ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              <span>Upload and Process</span>
            </>
          )}
        </button>
      )}

      {result && (
        <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Upload Results</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-800">Success</span>
              </div>
              <p className="text-3xl font-bold text-green-600">{result.success}</p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <span className="font-semibold text-yellow-800">Duplicates/Skipped</span>
              </div>
              <p className="text-3xl font-bold text-yellow-600">{result.duplicates}</p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="font-semibold text-red-800">Failed</span>
              </div>
              <p className="text-3xl font-bold text-red-600">{result.failed}</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold text-gray-700 mb-2">Errors:</h4>
              <div className="bg-white rounded-lg p-4 max-h-40 overflow-y-auto">
                {result.errors.map((error, index) => (
                  <p key={index} className="text-sm text-red-600 mb-1">{error}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-3">Excel Format Guidelines:</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li><strong>Required columns:</strong> register_no, name, father_name, mother_name, address, class, year, department</li>
          <li><strong>Numeric columns:</strong> cia_1_mark, cia_2_mark, present_today, leave_taken</li>
          <li><strong>Optional columns:</strong> email, phone_number, profile_image_url</li>
          <li>Column names are case-insensitive and can use spaces (e.g., "Student Name" or "student_name")</li>
        </ul>
      </div>
    </div>
  );
}
