const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
if (!/^https:\/\/[^/]+\.supabase\.co\/?$/.test(supabaseUrl)) {
  throw new Error('Set SUPABASE_URL to your HTTPS Supabase project URL.');
}
if (!supabaseAnonKey) {
  throw new Error('Set SUPABASE_ANON_KEY to the publishable/anon key.');
}

const publicConfig = {
  supabaseUrl: supabaseUrl.replace(/\/$/, ''),
  supabaseAnonKey
};
const output = 'window.TRACECDR_CONFIG = ' +
  JSON.stringify(publicConfig).replace(/</g, '\\u003c') + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'public', 'config.js'), output);
process.stdout.write('Generated public/config.js with the public Supabase configuration.\n');
