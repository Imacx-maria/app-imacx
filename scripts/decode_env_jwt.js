const fs = require('fs')
const path = require('path')

// Read .env.local directly
const envPath = path.join(__dirname, '../.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')

console.log('\n========================================')
console.log('DIRECT .env.local FILE ANALYSIS')
console.log('========================================\n')

// Extract URL
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)
if (urlMatch) {
  console.log('URL from file:', urlMatch[1].trim())
}

// Extract and decode key
const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)
if (keyMatch) {
  const key = keyMatch[1].trim()
  console.log('Key (first 20 chars):', key.substring(0, 20))
  
  try {
    const payload = Buffer.from(key.split('.')[1], 'base64').toString()
    const decoded = JSON.parse(payload)
    console.log('\nJWT Decoded:')
    console.log('  ref:', decoded.ref)
    console.log('  role:', decoded.role)
  } catch (e) {
    console.error('Error decoding:', e.message)
  }
}

console.log('\n========================================\n')
