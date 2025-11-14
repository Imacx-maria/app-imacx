'use client'

export default function DebugPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">🔍 Debug Information</h1>
      
      <div className="bg-gray-100 p-4 rounded">
        <p className="font-semibold">NEXT_PUBLIC_SUPABASE_URL:</p>
        <p className="font-mono text-sm break-all">
          {supabaseUrl || '❌ NOT FOUND'}
        </p>
      </div>

      <div className="bg-gray-100 p-4 rounded">
        <p className="font-semibold">NEXT_PUBLIC_SUPABASE_ANON_KEY:</p>
        <p className="font-mono text-sm">
          {supabaseKey ? `✅ Present (${supabaseKey.substring(0, 20)}...)` : '❌ NOT FOUND'}
        </p>
      </div>

      <div className="bg-gray-100 p-4 rounded">
        <p className="font-semibold">Environment Status:</p>
        <p>
          {supabaseUrl && supabaseKey ? (
            <span className="text-success">✅ All variables loaded</span>
          ) : (
            <span className="text-destructive">❌ Missing variables</span>
          )}
        </p>
      </div>

      <a href="/login" className="inline-block bg-info text-white px-4 py-2 rounded">
        Go to Login
      </a>
    </div>
  )
}
