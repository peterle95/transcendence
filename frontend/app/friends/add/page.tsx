'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AddFriendPage() {
	const router = useRouter()
	const [username, setUsername] = useState('')
	const [currentUserId, setCurrentUserId] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState('')
	const [success, setSuccess] = useState('')

	useEffect(() => {
		// Get current user ID for the back link
		const fetchCurrentUser = async () => {
			try {
				const sessionResponse = await fetch(
					`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/auth/session`,
					{
						credentials: 'include',
					}
				)

				if (sessionResponse.ok) {
					const sessionData = await sessionResponse.json()
					setCurrentUserId(sessionData?.user?.id || null)
				}
			} catch (err) {
				// Silently fail, back link will use fallback
			}
		}

		fetchCurrentUser()
	}, [])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError('')
		setSuccess('')

		if (!username.trim()) {
			setError('Please enter a username')
			return
		}

		setIsLoading(true)

		try {
			// First, get the current user's session
			const sessionResponse = await fetch(
				`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/auth/session`,
				{
					credentials: 'include',
				}
			)

			if (!sessionResponse.ok) {
				router.push('/login')
				return
			}

			const sessionData = await sessionResponse.json()
			const currentUserId = sessionData?.user?.id

			if (!currentUserId) {
				router.push('/login')
				return
			}

			// Search for the user by username
			const searchResponse = await fetch(
				`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/users/search?username=${encodeURIComponent(username)}`,
				{
					credentials: 'include',
				}
			)

			if (!searchResponse.ok) {
				if (searchResponse.status === 404) {
					setError('User not found')
				} else {
					setError('Failed to search for user')
				}
				return
			}

			const userData = await searchResponse.json()
			const targetUserId = userData.id

			if (String(targetUserId) === String(currentUserId)) {
				setError('You cannot send a friend request to yourself')
				return
			}

			// Send friend request
			const requestResponse = await fetch(
				`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/friends/requests`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					credentials: 'include',
					body: JSON.stringify({
						addresseeId: targetUserId,
					}),
				}
			)

			if (!requestResponse.ok) {
				const errorData = await requestResponse.json()
				setError(errorData.message || 'Failed to send friend request')
				return
			}

			const result = await requestResponse.json()
			setSuccess(result.message || 'Friend request sent successfully!')
			setUsername('')

			// Redirect to profile after 2 seconds
			setTimeout(() => {
				router.push(`/profile/${currentUserId}`)
			}, 2000)
		} catch (err) {
			setError((err as Error).message || 'An error occurred')
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<div style={{ minHeight: '100vh', padding: '48px 16px' }}>
			<div className="max-w-md mx-auto space-y-6">
				<div className="mb-2">
					<Link
						href={currentUserId ? `/profile/${currentUserId}` : '/profile'}
						className="text-blue-400 hover:text-blue-300 inline-flex items-center text-sm font-semibold transition-colors bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg"
						prefetch={false}
					>
						<svg style={{ width: '16px', height: '16px' }} className="mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
						</svg>
						Back to Profile
					</Link>
				</div>

				<div 
					style={{
						background: 'rgba(255,255,255,0.06)',
						border: '1px solid rgba(255,255,255,0.12)',
						borderRadius: '20px',
						backdropFilter: 'blur(20px)',
						boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
					}}
				>
					<div className="px-4 py-6 sm:p-8">
						<h3 className="text-2xl font-bold text-white">
							Add a Friend
						</h3>
						<p className="mt-2 text-sm text-gray-400">
							Enter the username of the person you want to add as a friend
						</p>

						<form onSubmit={handleSubmit} className="mt-8 space-y-6">
							<div>
								<label htmlFor="username" className="block text-sm font-medium text-gray-300">
									Username
								</label>
								<div className="mt-2">
									<input
										type="text"
										name="username"
										id="username"
										value={username}
										onChange={(e) => setUsername(e.target.value)}
										style={{
											background: 'rgba(0,0,0,0.2)',
											border: '1px solid rgba(255,255,255,0.2)',
											color: 'white',
										}}
										className="block w-full rounded-lg shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm transition-all"
										placeholder="Enter username"
										disabled={isLoading}
									/>
								</div>
							</div>

							{error && (
								<div className="rounded-lg bg-red-900/40 border border-red-500/50 p-4">
									<div className="flex">
										<div className="flex-shrink-0">
											<svg
												style={{ width: '20px', height: '20px' }}
												className="text-red-400"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M6 18L18 6M6 6l12 12"
												/>
											</svg>
										</div>
										<div className="ml-3">
											<p className="text-sm text-red-200">{error}</p>
										</div>
									</div>
								</div>
							)}

							{success && (
								<div className="rounded-lg bg-green-900/40 border border-green-500/50 p-4">
									<div className="flex">
										<div className="flex-shrink-0">
											<svg
												style={{ width: '20px', height: '20px' }}
												className="text-green-400"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M5 13l4 4L19 7"
												/>
											</svg>
										</div>
										<div className="ml-3">
											<p className="text-sm text-green-200">{success}</p>
										</div>
									</div>
								</div>
							)}

							<div className="pt-2">
								<button
									type="submit"
									disabled={isLoading}
									style={{
										background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
									}}
									className="w-full inline-flex justify-center items-center px-4 py-3 border border-transparent text-sm font-bold rounded-lg shadow-sm text-white hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{isLoading ? (
										<>
											<div style={{ width: '16px', height: '16px' }} className="animate-spin rounded-full border-b-2 border-white mr-2"></div>
											Sending Request...
										</>
									) : (
										'Send Friend Request'
									)}
								</button>
							</div>
						</form>
					</div>
				</div>

				{/* Tips Section */}
				<div 
					style={{
						background: 'rgba(59,130,246,0.1)',
						border: '1px solid rgba(59,130,246,0.2)',
						borderRadius: '16px',
						backdropFilter: 'blur(10px)',
					}}
					className="p-5"
				>
					<h4 className="text-sm font-bold text-blue-300 mb-3 flex items-center">
						<svg style={{ width: '16px', height: '16px' }} className="mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						Tips
					</h4>
					<ul className="text-sm text-blue-200/80 space-y-2 list-disc list-inside">
						<li>Make sure you enter the exact username</li>
						<li>Usernames are case-sensitive</li>
						<li>You can view your pending sent requests in your profile</li>
					</ul>
				</div>
			</div>
		</div>
	)
}