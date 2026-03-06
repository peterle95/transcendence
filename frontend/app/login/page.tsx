'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
	const router = useRouter()
	const [formData, setFormData] = useState({
		email: '',
		password: '',
	})
	const [error, setError] = useState('')
	const [isLoading, setIsLoading] = useState(false)

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		setError('')
		setIsLoading(true)

		try {
			const csrfResponse = await fetch(`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/auth/csrf`, {
				credentials: 'include',
			})
			const { csrfToken } = await csrfResponse.json()

			const response = await fetch(`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/auth/callback/credentials`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				credentials: 'include',
				body: new URLSearchParams({
					email: formData.email,
					password: formData.password,
					csrfToken: csrfToken,
					callbackUrl: `${process.env.NEXT_PUBLIC_FRONTEND_URL}`,
					json: 'true',
				}),
			})

			const data = await response.json()

			// Check for authentication failure
			if (!response.ok || response.status === 401 || data.error) {
				setError('Invalid email or password')
				setIsLoading(false)
				return
			}

			// Successful login
			window.location.href = `${process.env.NEXT_PUBLIC_FRONTEND_URL}`
		} catch (err) {
			console.error('Login error:', err)
			setError('An error occurred. Please try again.')
			setIsLoading(false)
		}
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
			<div className="max-w-md w-full space-y-8">
				<div>
					<h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
						Sign in to your account
					</h2>
				</div>
				<form className="mt-8 space-y-6" onSubmit={handleSubmit}>
					{error && (
						<div className="rounded-md bg-red-50 p-4">
							<p className="text-sm text-red-800">{error}</p>
						</div>
					)}
					<div className="rounded-md shadow-sm -space-y-px">
						<div>
							<label htmlFor="email" className="sr-only">
								Email address
							</label>
							<input
								id="email"
								name="email"
								type="email"
								autoComplete="email"
								required
								className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
								placeholder="Email address"
								value={formData.email}
								onChange={(e) =>
									setFormData({ ...formData, email: e.target.value })
								}
							/>
						</div>
						<div>
							<label htmlFor="password" className="sr-only">
								Password
							</label>
							<input
								id="password"
								name="password"
								type="password"
								autoComplete="current-password"
								required
								className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
								placeholder="Password"
								value={formData.password}
								onChange={(e) =>
									setFormData({ ...formData, password: e.target.value })
								}
							/>
						</div>
					</div>

					<div className="flex items-center justify-between">
						<div className="text-sm">
							<Link
								href="/register"
								className="font-medium text-indigo-600 hover:text-indigo-500"
							>
								Don't have an account? Register
							</Link>
						</div>
					</div>

					<div>
						<button
							type="submit"
							disabled={isLoading}
							className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{isLoading ? 'Signing in...' : 'Sign in'}
						</button>
					</div>
				</form>
			</div>
		</div>
	)
}