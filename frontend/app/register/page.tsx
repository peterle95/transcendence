'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
export default function RegisterPage() {
	const router = useRouter()
	const [formData, setFormData] = useState({
		email: '',
		username: '',
		password: '',
	})
	const [error, setError] = useState('')
	const [isLoading, setIsLoading] = useState(false)

	useEffect(() => {
		fetch(`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/auth/session`, { credentials: 'include' })
			.then(res => res.json())
			.then(data => { if (data?.user) router.replace('/') })
			.catch(() => {})
	}, [])

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		setError('')
		setIsLoading(true)

		try {
			const response = await fetch(`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/register`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(formData),
			})

			const data = await response.json()

			if (!response.ok) {
				throw new Error(data.error || 'Registration failed')
			}

			const csrfResponse = await fetch(
				`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/auth/csrf`,
				{ credentials: 'include' }
			)
			const { csrfToken } = await csrfResponse.json()

			await fetch(
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

			router.replace('/')
		} catch (err) {
			setError((err as Error).message)
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<div style={{ minHeight: '100vh', position: 'relative' }}>
			
			{/* Centered card */}
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
            boxSizing: 'border-box',
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
						Create your account
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
							id="email"
							aria-label="Email"
							name="email"
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
							type="text"
							id="username"
							aria-label="Username"
							name="username"
							required
							placeholder="Username"
							value={formData.username}
							onChange={(e) => setFormData({ ...formData, username: e.target.value })}
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
							id="password"
							aria-label="Password"
							name="password"
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
							href="/login"
							style={{ color: '#a78bfa', fontSize: '0.875rem', textDecoration: 'none', marginTop: '2px' }}
						>
							Already have an account? Sign in
						</Link>

						<button
							type="submit"
							disabled={isLoading}
							style={{
								marginTop: '10px',
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
							{isLoading ? 'Creating account…' : 'Register'}
						</button>
					</form>
				</div>
			</div>
		</div>
	)
}