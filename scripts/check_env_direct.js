#!/usr/bin/env node

// Read .env.local directly from filesystem without dotenv
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const content = fs.readFileSync(envPath, 'utf8');

console.log('='.repeat(50));
console.log('DIRECT FILE CONTENT (.env.local)');
console.log('='.repeat(50));
console.log('');

// Parse manually
const lines = content.split('\n');
lines.forEach(line => {
  if (line.includes('SUPABASE') || line.includes('PG_')) {
    if (!line.startsWith('#')) {
      console.log(line);
      
      // If it's a key value, extract and check
      if (line.includes('=')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=');
        
        if (key === 'NEXT_PUBLIC_SUPABASE_URL' || key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
          if (value.includes('ocajcjdlrmbmfiirxndn')) {
            console.log('  ⚠️  Contains WRONG project ID: ocajcjdlrmbmfiirxndn');
          }
          if (value.includes('bnfixjkjrbfalgcqhzof')) {
            console.log('  ✅ Contains CORRECT project ID: bnfixjkjrbfalgcqhzof');
          }
        }
      }
    }
  }
});

console.log('');
console.log('='.repeat(50));
console.log('COMPARISON WITH process.env');
console.log('='.repeat(50));
console.log('');

require('dotenv').config({ path: envPath });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('process.env.NEXT_PUBLIC_SUPABASE_URL:', url);
if (url && url.includes('ocajcjdlrmbmfiirxndn')) {
  console.log('  ⚠️  MISMATCH! File has correct, process.env has WRONG!');
}

console.log('');
console.log('File has bnfixjkjrbfalgcqhzof:', content.includes('bnfixjkjrbfalgcqhzof'));
console.log('process.env has bnfixjkjrbfalgcqhzof:', url?.includes('bnfixjkjrbfalgcqhzof'));
