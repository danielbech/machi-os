'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import dynamic from 'next/dynamic'

const PrismaticBurst = dynamic(() => import('@/components/PrismaticBurst'), { ssr: false })

export function AuthForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [isForgot, setIsForgot] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (isForgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        })
        if (error) throw error
        setMessage('Check your email for the password reset link!')
      } else if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        setMessage('Check your email for the confirmation link!')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
      }
    } catch (error: any) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 bg-black overflow-hidden">
      <div className="absolute inset-0">
        <PrismaticBurst
          animationType="rotate"
          intensity={1.3}
          speed={0.25}
          distort={5.9}
          paused={false}
          offset={{ x: 0, y: 0 }}
          hoverDampness={0.25}
          rayCount={0}
          mixBlendMode="lighten"
          colors={['#A0492D', '#FF7300', '#D2AA1A']}
        />
      </div>
      <Card className="relative z-10 w-full max-w-md border-white/[0.08] bg-white/[0.04] backdrop-blur-2xl shadow-2xl">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <img src="/logo.svg" alt="Machi OS" className="w-10 h-10" />
            <div>
              <CardTitle className="text-2xl">Machi OS</CardTitle>
              <CardDescription className="text-white/40">
                {isForgot ? 'Reset your password' : isSignUp ? 'Create your account' : 'Sign in to your account'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-white/80">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-white/10 bg-white/[0.02] focus:border-white/30 focus:ring-white/20"
              />
            </div>
            {!isForgot && (
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-white/80">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-white/10 bg-white/[0.02] focus:border-white/30 focus:ring-white/20"
                />
              </div>
            )}
            {message && (
              <div className={`text-sm ${message.includes('error') || message.includes('Invalid') ? 'text-red-400' : 'text-green-400'}`}>
                {message}
              </div>
            )}
            <Button type="submit" className="w-full bg-white text-black hover:bg-white/90" disabled={loading}>
              {loading ? 'Loading...' : isForgot ? 'Send Reset Link' : isSignUp ? 'Sign Up' : 'Sign In'}
            </Button>
            {!isSignUp && !isForgot && (
              <button
                type="button"
                className="w-full text-center text-sm text-white/40 hover:text-white/60 transition-colors"
                onClick={() => { setIsForgot(true); setMessage('') }}
              >
                Forgot password?
              </button>
            )}
            <Button
              type="button"
              variant="ghost"
              className="w-full text-white/60 hover:text-white hover:bg-white/5"
              onClick={() => {
                setIsForgot(false)
                setIsSignUp(isForgot ? false : !isSignUp)
                setMessage('')
              }}
            >
              {isForgot ? 'Back to sign in' : isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
