import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

// ---------- ENV ----------
function getEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

const SUPABASE_URL = getEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');
const GOOGLE_SHEET_ID = getEnv('GOOGLE_SHEET_ID');

const GOOGLE_SHEET_RANGE = process.env.GOOGLE_SHEET_RANGE || 'Sheet1!A1:Z1000';
const GOOGLE_SHEET_GID = process.env.GOOGLE_SHEET_GID || '0';
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';

console.log('Environment variables validated.');

// ---------- SUPABASE ----------
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ---------- GOOGLE SHEETS ----------
async function fetchSheetRows() {
  if (GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.log('Using Service Account authentication');
    const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: GOOGLE_SHEET_RANGE,
    });

    return res.data.values;
  }

  console.log('Using public CSV export fallback');
  const url = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv&gid=${GOOGLE_SHEET_GID}`;
  const res = await fetch(url);
  const csv = await res.text();

  const rows = csv
    .split('\n')
    .map(r => r.split(',').map(c => c.trim()));

  return rows;
}

// ---------- MAIN ----------
async function sync() {
  console.log('Starting Google Sheet → Supabase sync...');

  const rows = await fetchSheetRows();
  if (!rows || rows.length < 2) {
    console.log('No data found.');
    return;
  }

  const headers = rows[0].map(h => h.toLowerCase().replace(/\s+/g, '_'));
  const dataRows = rows.slice(1);

  const records = dataRows.map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? null;
    });

    const present = Number(obj.present_today || 0);
    const leave = Number(obj.leave_taken || 0);
    const total = present + leave;
    obj.attendance_percentage = total > 0 ? (present / total) * 100 : 0;

    return obj;
  });

  if (!records.length) {
    console.log('Nothing to upsert.');
    return;
  }

  const { error } = await supabase
    .from('students')
    .upsert(records, { onConflict: 'register_no' });

  if (error) throw error;

  console.log(`Sync completed. Rows processed: ${records.length}`);
}

sync()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Sync failed:', err.message);
    process.exit(1);
  });
