'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const PixelBlast = dynamic(() => import('@/components/PixelBlast'), {
  ssr: false,
})

export default function LoginPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const csrfResponse = await fetch(
        `${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/auth/csrf`,
        { credentials: 'include' }
      )
      const { csrfToken } = await csrfResponse.json()

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/auth/callback/credentials`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          credentials: 'include',
          body: new URLSearchParams({
            email: formData.email,
            password: formData.password,
            csrfToken,
            callbackUrl: '/',
            json: 'true',
          }),
        }
      )

      const data = await response.json()
      if (!response.ok || (data.url && data.url.includes('error='))) {
        setError('Invalid email or password')
        setIsLoading(false)
        return
      }

      router.push('/')
    } catch (err) {
      console.error('Login error:', err)
      setError('An error occurred. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    // Dark base so transparent PixelBlast doesn't look gray
    <div style={{ minHeight: '100vh', background: '#07070f', position: 'relative' }}>

      {/* PixelBlast canvas */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <PixelBlast
          variant="square"
          pixelSize={2}
          color="#592deb"
          patternScale={3.75}
          patternDensity={1.2}
          pixelSizeJitter={0.4}
          enableRipples
          rippleSpeed={0.4}
          rippleThickness={0.12}
          rippleIntensityScale={1.5}
          liquid={false}
          speed={0.5}
          edgeFade={0.25}
          transparent
        />
      </div>

      {/* Centered card — no extra header here, layout.tsx already renders Header */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '0 16px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '420px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '20px',
            padding: '40px 36px',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 24px 80px rgba(89,45,235,0.25)',
          }}
        >
          <h2
            style={{
              margin: '0 0 28px',
              textAlign: 'center',
              fontSize: '1.75rem',
              fontWeight: 800,
              color: '#fff',
              letterSpacing: '-0.01em',
            }}
          >
            Sign in to your account
          </h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {error && (
              <div
                style={{
                  borderRadius: '10px',
                  padding: '10px 14px',
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.35)',
                  color: '#fca5a5',
                  fontSize: '0.85rem',
                }}
              >
                {error}
              </div>
            )}

            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              placeholder="Email address"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              style={{
                width: '100%',
                padding: '13px 16px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                fontSize: '0.95rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />

            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              placeholder="Password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              style={{
                width: '100%',
                padding: '13px 16px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                fontSize: '0.95rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />

            <Link
              href="/register"
              style={{ color: '#a78bfa', fontSize: '0.875rem', textDecoration: 'none', marginTop: '2px' }}
            >
              Don't have an account? Register
            </Link>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                marginTop: '6px',
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}