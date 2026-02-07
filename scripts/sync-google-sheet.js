/**
 * Google Sheet → Supabase Sync Script
 *
 * Sync Flow (MANDATORY):
 * 1. Fetch Google Sheet data (CSV export by default)
 * 2. Convert rows → normalized JSON
 * 3. Validate required fields
 * 4. Calculate attendance_percentage (derived, DO NOT TRUST SHEET)
 * 5. UPSERT into Supabase by register_no (PRIMARY KEY)
 * 6. Return sync summary (logs to console)
 *
 * Requirements:
 * - Node.js v18+ (uses global fetch)
 * - @supabase/supabase-js v2
 *
 * Environment Variables (example):
 * - SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
 * - SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
 * - GOOGLE_SHEET_ID=1toH3lJbi6Zh2KeCaaWArcN9t6coOGNbAjkUhtftqYXg
 * - GOOGLE_SHEET_GID=0                      # optional (default 0)
 * - GOOGLE_SHEET_RANGE=Sheet1!A1:Z1000      # optional for Sheets API
 * - GOOGLE_API_KEY=                         # optional fallback (public read-only sheet works without)
 *
 * Usage:
 *   node scripts/sync-google-sheet.js
 */

import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';

// ---------- Env helpers ----------
function getEnv(name, required = true) {
  const val = process.env[name];
  if (required && (!val || val.trim() === '')) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val?.trim();
}

const SUPABASE_URL = getEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');
const SHEET_ID = getEnv('GOOGLE_SHEET_ID');
const SHEET_GID = process.env.GOOGLE_SHEET_GID ? String(process.env.GOOGLE_SHEET_GID) : '0';
const SHEET_RANGE = process.env.GOOGLE_SHEET_RANGE || 'Sheet1!A1:Z1000';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const GOOGLE_SA_JSON_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH || '';
const GOOGLE_SA_CREDENTIALS_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';

function ensureValidServiceRoleKey(k) {
  const tooShort = !k || k.length < 50;
  const looksTruncated = typeof k === 'string' && k.includes('...');
  if (tooShort || looksTruncated) {
    throw new Error('Invalid SUPABASE_SERVICE_ROLE_KEY. Paste the full Service Role key from Supabase project settings.');
  }
}
ensureValidServiceRoleKey(SUPABASE_SERVICE_ROLE_KEY);

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
 

// ---------- Fetch helpers ----------
async function fetchWithRetry(url, options = {}, maxRetries = 3, backoffMs = 500) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      return res;
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries) throw err;
      await new Promise(r => setTimeout(r, backoffMs * attempt));
    }
  }
}

async function fetchSheetCSV(sheetId, gid = '0') {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const res = await fetchWithRetry(csvUrl);
  const text = await res.text();
  if (!text || !text.trim()) {
    throw new Error('Invalid sheet structure: empty CSV');
  }
  return text;
}

async function fetchSheetValuesAPI(sheetId, range, apiKey) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;
  const res = await fetchWithRetry(url);
  const json = await res.json();
  if (!json || !json.values || json.values.length === 0) {
    throw new Error('Invalid sheet structure: no values returned');
  }
  return json.values; // array of rows (arrays)
}

async function fetchSheetValuesWithServiceAccount(sheetId, range) {
  let auth;
  if (GOOGLE_SA_JSON_PATH) {
    const resolved = path.resolve(GOOGLE_SA_JSON_PATH);
    auth = new google.auth.GoogleAuth({
      keyFile: resolved,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
  } else if (GOOGLE_SA_CREDENTIALS_JSON) {
    const creds = JSON.parse(GOOGLE_SA_CREDENTIALS_JSON);
    const client = new google.auth.JWT(
      creds.client_email,
      undefined,
      creds.private_key,
      ['https://www.googleapis.com/auth/spreadsheets.readonly']
    );
    auth = { getClient: async () => client };
  } else {
    throw new Error('Service Account credentials not provided. Set GOOGLE_SERVICE_ACCOUNT_JSON_PATH or GOOGLE_SERVICE_ACCOUNT_JSON.');
  }

  try {
    const authedClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authedClient });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range,
    });
    const values = res.data.values;
    if (!values || values.length === 0) {
      throw new Error('Sheets API returned empty values');
    }
    return values;
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    if (msg.includes('401')) {
      throw new Error('Sheets API auth failed (401). Check service account credentials.');
    }
    if (msg.includes('403')) {
      throw new Error('Sheets API permission denied (403). Share the spreadsheet with the service account email.');
    }
    throw err;
  }
}
// ---------- CSV parsing ----------
function parseCSV(csvText) {
  // Parses CSV with quoted fields and commas
  // Returns: { headers: string[], rows: string[][] }
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.length > 0);
  const rows = lines.map(line => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  });
  const headers = rows[0].map(h => String(h).trim());
  const dataRows = rows.slice(1);
  return { headers, rows: dataRows };
}

// ---------- Normalization ----------
function normalizeHeaderForMap(key) {
  return key
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const HEADER_MAP = {
  'register no': 'register_no',
  'register_no': 'register_no',
  'reg no': 'register_no',
  'registration number': 'register_no',

  'name': 'name',
  'father name': 'father_name',
  'mother name': 'mother_name',
  'address': 'address',
  'class': 'class',
  'year': 'year',
  'department': 'department',

  'cia-1 mark': 'cia_1_mark',
  'cia 1 mark': 'cia_1_mark',
  'cia1': 'cia_1_mark',

  'cia-2 mark': 'cia_2_mark',
  'cia 2 mark': 'cia_2_mark',
  'cia2': 'cia_2_mark',

  'present to class (today)': 'present_today',
  'present today': 'present_today',

  'leave taken': 'leave_taken',

  // Contact fields
  'email': 'email',
  'mail': 'email',
  'phone number': 'phone_number',
  'phone': 'phone_number',
  'mobile': 'phone_number',
};

function buildHeaderIndex(headers) {
  const index = {};
  headers.forEach((h, i) => {
    const norm = normalizeHeaderForMap(h);
    const mapped = HEADER_MAP[norm] || norm.replace(/\s+/g, '_');
    index[mapped] = i;
  });
  return index;
}

function mapRowToStudent(headerIndex, row, rowNumber) {
  const getStrOrEmpty = (key) => {
    const idx = headerIndex[key];
    const val = idx !== undefined ? row[idx] : '';
    const s = String(val ?? '').trim();
    return s.length > 0 ? s : '';
  };
  const getNumOrNull = (key) => {
    const idx = headerIndex[key];
    if (idx === undefined) return null;
    const raw = row[idx];
    if (raw === null || raw === undefined) return null;
    const s = String(raw).trim();
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const register_no = getStrOrEmpty('register_no');
  const name = getStrOrEmpty('name');
  const father_name = getStrOrEmpty('father_name');
  const mother_name = getStrOrEmpty('mother_name');
  const address = getStrOrEmpty('address');
  const className = getStrOrEmpty('class');
  let department = getStrOrEmpty('department');
  const year = getStrOrEmpty('year');
  const cia_1_mark = getNumOrNull('cia_1_mark');
  const cia_2_mark = getNumOrNull('cia_2_mark');
  const present_today = getNumOrNull('present_today');
  const leave_taken = getNumOrNull('leave_taken');
  const email = getStrOrEmpty('email');
  const phone_number = getStrOrEmpty('phone_number');
  const profile_image_url = getStrOrEmpty('profile_image_url');

  if (!department && className) {
    department = className;
    console.log(`Fallback applied: department set from class for register_no ${register_no || '(unknown)'} (row ${rowNumber})`);
  }

  console.log(`[PARSE] row ${rowNumber} register_no=${register_no || '(unknown)'} email=${email || '(blank)'} phone=${phone_number || '(blank)'}`);

  return {
    register_no,
    name,
    father_name,
    mother_name,
    address,
    class: className,
    year,
    department,
    cia_1_mark,
    cia_2_mark,
    present_today,
    leave_taken,
    email,
    phone_number,
    profile_image_url,
  };
}

function validateStudent(row) {
  const warnings = [];
  if (!row.register_no) warnings.push('register_no missing');
  if (!row.name) warnings.push('name missing');
  if (!row.department) warnings.push('department missing');
  return { warnings };
}

function deriveAttendance(row) {
  const total = (row.present_today || 0) + (row.leave_taken || 0);
  const percentage = total > 0 ? (row.present_today / total) * 100 : 0;
  return Number.isFinite(percentage) ? Math.round(percentage * 100) / 100 : 0;
}

// ---------- Supabase UPSERT ----------
async function upsertStudents(students) {
  const batchSize = 500;
  let upserted = 0;
  for (let i = 0; i < students.length; i += batchSize) {
    const batch = students.slice(i, i + batchSize).map(s => {
      const hasAcademicData =
        s.cia_1_mark !== null ||
        s.cia_2_mark !== null ||
        s.present_today !== null ||
        s.leave_taken !== null;
      const payload = { ...s };
      if (!hasAcademicData) {
        console.log(`SKIP ACADEMIC UPDATE: register_no=${s.register_no || '(unknown)'} reason=blank academic row (preserving existing data)`);
        delete payload.cia_1_mark;
        delete payload.cia_2_mark;
        delete payload.present_today;
        delete payload.leave_taken;
        delete payload.attendance_percentage;
      } else {
        payload.attendance_percentage = deriveAttendance({
          present_today: s.present_today || 0,
          leave_taken: s.leave_taken || 0,
        });
      }
      if (typeof payload.email === 'string' && payload.email.trim() === '') {
        delete payload.email;
      }
      if (typeof payload.phone_number === 'string' && payload.phone_number.trim() === '') {
        delete payload.phone_number;
      }
      return payload;
    });
    console.log('UPSERT payload preview:', batch.slice(0, Math.min(3, batch.length)));
    const { error } = await supabaseAdmin
      .from('students')
      .upsert(batch, { onConflict: 'register_no' });
    if (error) {
      throw new Error(`Supabase upsert error: ${error.message}`);
    }
    upserted += batch.length;
  }
  return { upserted };
}

// ---------- Hard Sync Deletion ----------
async function deleteMissingStudents(sheetRegisterNos) {
  const uniqueNos = Array.from(new Set((sheetRegisterNos || []).map(r => String(r || '').trim()).filter(r => r.length > 0)));
  if (uniqueNos.length === 0) {
    console.warn('Hard sync: sheetRegisterNos is empty. Deleting all students to mirror empty sheet.');
    const { error } = await supabaseAdmin.from('students').delete();
    if (error) throw new Error(`Delete all students failed: ${error.message}`);
    return;
  }
  const { data: existing, error: selErr } = await supabaseAdmin
    .from('students')
    .select('register_no');
  if (selErr) throw new Error(`Fetch existing students failed: ${selErr.message}`);
  const existingNos = (existing || []).map(r => String(r.register_no || '').trim()).filter(r => r.length > 0);
  const missingNos = existingNos.filter(r => !uniqueNos.includes(r));
  if (missingNos.length === 0) return;
  const { error: delErr } = await supabaseAdmin
    .from('students')
    .delete()
    .in('register_no', missingNos);
  if (delErr) throw new Error(`Delete missing students failed: ${delErr.message}`);
}

// ---------- Main ----------
async function syncGoogleSheet() {
  const start = Date.now();
  console.log('Starting Google Sheet → Supabase sync...');

  let headers = [];
  let rows = [];
  try {
    if (GOOGLE_SA_JSON_PATH || GOOGLE_SA_CREDENTIALS_JSON) {
      console.log('Fetching sheet via Google Sheets API with Service Account...');
      const values = await fetchSheetValuesWithServiceAccount(SHEET_ID, SHEET_RANGE);
      headers = values[0].map(h => String(h).trim());
      rows = values.slice(1);
    } else if (GOOGLE_API_KEY) {
      console.log('Fetching sheet via Google Sheets API (values endpoint)...');
      const values = await fetchSheetValuesAPI(SHEET_ID, SHEET_RANGE, GOOGLE_API_KEY);
      headers = values[0].map(h => String(h).trim());
      rows = values.slice(1);
    } else {
      console.log('Fetching sheet via public CSV export...');
      const csvText = await fetchSheetCSV(SHEET_ID, SHEET_GID);
      const parsed = parseCSV(csvText);
      headers = parsed.headers;
      rows = parsed.rows;
    }
    console.log(`Sheet fetch successful. Raw rows read (excluding header): ${rows.length}`);
  } catch (err) {
    console.error('Network or sheet fetch failure:', err.message);
    throw err; // abort sync
  }

  // Convert -> normalize -> validate
  const headerIndex = buildHeaderIndex(headers);
  console.log('Parsed headers:', Object.keys(headerIndex));
  const normalized = rows.map((r, i) => mapRowToStudent(headerIndex, r, i + 2));
  const totalRows = normalized.length;
  const failedRows = [];
  const validRows = [];

  if (totalRows === 0) {
    console.warn('Warning: No rows found in the sheet after parsing. Nothing to process.');
  }

  for (let idx = 0; idx < normalized.length; idx++) {
    const row = normalized[idx];
    for (const k of Object.keys(row)) {
      if (typeof row[k] === 'string') row[k] = row[k].trim();
    }
    const { warnings } = validateStudent(row);
    if (warnings.length > 0) {
      console.log(`Row ${idx + 2} warnings: ${warnings.join('; ')}`);
    }
    if (!row.register_no) {
      failedRows.push({ row_number: idx + 2, reason: 'register_no missing' });
      continue;
    }
    const hasAcademicData =
      row.cia_1_mark !== null ||
      row.cia_2_mark !== null ||
      row.present_today !== null ||
      row.leave_taken !== null;
    if (!hasAcademicData) {
      console.log(`SKIP ACADEMIC UPDATE: register_no=${row.register_no || '(unknown)'} reason=blank academic row (preserving existing data)`);
      delete row.cia_1_mark;
      delete row.cia_2_mark;
      delete row.present_today;
      delete row.leave_taken;
      delete row.attendance_percentage;
    } else {
      row.attendance_percentage = deriveAttendance(row);
    }
    validRows.push(row);
  }

  // Perform UPSERT
  let processed_rows = 0;
  try {
    const sheetRegisterNos = validRows.map(r => r.register_no);
    console.log('Deleting Supabase rows not present in sheet...');
    await deleteMissingStudents(sheetRegisterNos);

    console.log(`Beginning Supabase upsert for ${validRows.length} valid rows...`);
    const result = await upsertStudents(validRows);
    processed_rows = result.upserted;
    console.log(`Upsert completed. Processed rows: ${processed_rows}`);
  } catch (err) {
    console.error('Supabase error:', err.message);
    throw err; // abort sync
  }

  const durationMs = Date.now() - start;
  const summary = {
    total_rows: totalRows,
    processed_rows,
    failed_rows: failedRows.length,
    duration_ms: durationMs,
  };

  console.log('Sync Summary:');
  console.log(` - Total rows: ${summary.total_rows}`);
  console.log(` - Processed rows: ${summary.processed_rows}`);
  console.log(` - Failed: ${summary.failed_rows}`);
  console.log(` - Duration (ms): ${summary.duration_ms}`);
  console.log('Sync completed successfully');

  return summary;
}

// Explicit entry point (non-negotiable)
syncGoogleSheet()
  .then(() => {
    console.log('Sync completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Sync failed:', err);
    process.exit(1);
  });
