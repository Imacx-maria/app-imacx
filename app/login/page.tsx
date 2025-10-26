"use client"

import { useState } from 'react'
import Image from 'next/image'
import { createBrowserClient } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      console.log('🔐 Iniciando login...')
      
      const supabase = createBrowserClient()
      console.log('✅ Supabase client criado')
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      console.log('Response:', { user: data?.user?.email, error })

      if (error) {
        console.error('❌ Auth error:', error)
        setError(error.message)
      } else {
        console.log('✅ Login bem-sucedido! Aguardando sessão...')
        
        // Wait a moment for session to be stored
        await new Promise(resolve => setTimeout(resolve, 500))
        
        console.log('🔄 Redirecionando para dashboard...')
        router.push('/dashboard')
        
        // Refresh to ensure middleware runs and sees the session
        await new Promise(resolve => setTimeout(resolve, 100))
        router.refresh()
      }
    } catch (err: any) {
      console.error('❌ Exception:', err)
      setError(err.message || 'Ocorreu um erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center" data-page="login">
      <div className="w-full max-w-md space-y-6 rounded-lg border p-8">
        <div className="space-y-2 text-center">
          <Image
            src="/imacx_pos.svg"
            alt="IMACX Logo"
            width={150}
            height={60}
            priority
            className="mx-auto"
          />
          <p className="text-sm text-muted-foreground">
            Introduza as suas credenciais para aceder ao sistema
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Palavra-passe</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'A entrar...' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  )
}

