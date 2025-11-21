"use client"

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { createBrowserClient } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Eye, EyeOff } from 'lucide-react'

// Type declaration for Credential Management API
declare global {
  interface Window {
    PasswordCredential?: any
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const router = useRouter()

  // Load saved email on component mount
  useEffect(() => {
    const savedEmail = typeof window !== 'undefined' ? localStorage.getItem('rememberedEmail') : null
    const rememberMeSetting = typeof window !== 'undefined' ? localStorage.getItem('rememberMe') === 'true' : false
    
    if (savedEmail && rememberMeSetting) {
      setEmail(savedEmail)
      setRememberMe(true)
    }
  }, [])

  const saveCredentials = async () => {
    // Try to use Credential Management API to save password
    if ('PasswordCredential' in window && navigator.credentials) {
      try {
        const cred = new window.PasswordCredential({
          id: email,
          password: password,
          name: email,
        })
        await navigator.credentials.store(cred)
        console.log('✅ Credentials saved via Credential Management API')
      } catch (err) {
        console.warn('Could not save credentials via API:', err)
      }
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      console.log('🔐 Iniciando login...')
      
      // Save or clear email based on remember me setting
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email)
        localStorage.setItem('rememberMe', 'true')
      } else {
        localStorage.removeItem('rememberedEmail')
        localStorage.removeItem('rememberMe')
      }
      
      // Clear any existing Supabase storage that might cause issues
      if (typeof window !== 'undefined') {
        try {
          const keys = Object.keys(window.localStorage)
          keys.forEach(key => {
            if (key.startsWith('sb-') || key.includes('supabase')) {
              window.localStorage.removeItem(key)
            }
          })
          console.log('🧹 Cleared Supabase storage')
        } catch (e) {
          console.warn('Could not clear storage:', e)
        }
      }
      
      const supabase = createBrowserClient()
      console.log('✅ Supabase client criado')
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      console.log('Response:', { 
        user: data?.user?.email, 
        userId: data?.user?.id,
        emailConfirmed: data?.user?.email_confirmed_at,
        session: data?.session ? 'Present' : 'Missing',
        error 
      })

      if (error) {
        console.error('❌ Auth error:', error)
        console.error('Error details:', {
          message: error.message,
          status: error.status,
          code: error.code,
        })
        
        // Provide user-friendly error messages
        if (error.message.includes('Email logins are disabled')) {
          setError('Email/password authentication is disabled. Please contact your administrator.')
        } else if (error.message.includes('Invalid login credentials')) {
          setError('Email ou palavra-passe incorretos. Verifique se o email está correto, a palavra-passe está correta e a conta existe e está ativa.')
        } else {
          setError(error.message)
        }
      } else {
        console.log('✅ Login bem-sucedido!')

        // Try to save credentials using Credential Management API
        await saveCredentials()

        // IMPORTANT: Use window.location.href instead of router.push() to force a full page reload
        // This ensures cookies are properly synced from localStorage before middleware runs
        // Client-side navigation (router.push) doesn't trigger cookie sync, causing auth issues
        console.log('🔄 Redirecionando para dashboard...')
        
        // Use full page reload to ensure session cookies are synced properly
        // This fixes the issue where users had to refresh after login
        window.location.href = '/dashboard'
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
      <div className="w-full max-w-md space-y-6 rounded-lg imx-border p-8">
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

        <form 
          onSubmit={handleLogin} 
          className="space-y-4" 
          method="post"
          autoComplete="on"
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Palavra-passe</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pr-10"
                autoComplete="current-password"
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

          <div className="flex items-center space-x-2">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked as boolean)}
            />
            <label
              htmlFor="remember"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Lembrar-me neste computador
            </label>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading}
          >
            {loading ? 'A entrar...' : 'Entrar'}
          </Button>
        </form>

        <div className="text-xs text-muted-foreground text-center mt-4">
          💡 Dica: O seu navegador pode perguntar se deseja guardar a palavra-passe após o login bem-sucedido.
        </div>
      </div>
    </div>
  )
}

