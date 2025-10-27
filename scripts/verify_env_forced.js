#!/usr/bin/env node

// Force load ONLY from .env.local, overriding all environment variables
require('dotenv').config({ 
  path: '.env.local',
  override: true  // This FORCES override of existing env vars
});

console.log('========================================');
console.log('RUNTIME ENVIRONMENT CHECK (FORCED LOAD)');
console.log('========================================');
console.log('');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('URL:', url);
console.log('Key (first 20 chars):', key?.substring(0, 20));
console.log('');

if (key) {
  try {
    const parts = key.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      console.log('JWT Payload:');
      console.log('  Project Ref:', payload.ref);
      console.log('  Role:', payload.role);
      console.log('  Issued At:', new Date(payload.iat * 1000).toLocaleString());
    }
  } catch (e) {
    console.error('Could not decode JWT:', e.message);
  }
}

console.log('');
console.log('========================================');
console.log('');
