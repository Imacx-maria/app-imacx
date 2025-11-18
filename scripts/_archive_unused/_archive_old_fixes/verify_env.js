require('dotenv').config({ path: '.env.local' })

console.log('\n========================================')
console.log('RUNTIME ENVIRONMENT CHECK')
console.log('========================================\n')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('URL:', url)
console.log('Key (first 20 chars):', key?.substring(0, 20))

// Decode JWT to verify project
if (key) {
  try {
    const payload = Buffer.from(key.split('.')[1], 'base64').toString()
    const decoded = JSON.parse(payload)
    console.log('\nJWT Payload:')
    console.log('  Project Ref:', decoded.ref)
    console.log('  Role:', decoded.role)
    console.log('  Issued At:', new Date(decoded.iat * 1000).toLocaleString('pt-PT'))
    
    // Verify match
    if (url && !url.includes(decoded.ref)) {
      console.error('\n❌ SECURITY ALERT: URL and JWT KEY DO NOT MATCH!')
      console.error('   URL project:', url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1])
      console.error('   JWT project:', decoded.ref)
      process.exit(1)
    } else {
      console.log('\n✅ URL and JWT key match correctly')
    }
  } catch (e) {
    console.error('\n❌ Error decoding JWT:', e.message)
  }
} else {
  console.error('\n❌ ANON_KEY not found!')
}

console.log('\n========================================\n')
