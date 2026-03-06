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
		<div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
			<div className="max-w-md mx-auto">
				<div className="mb-6">
					<Link
						href={currentUserId ? `/profile/${currentUserId}` : '/profile'}
						className="text-indigo-600 hover:text-indigo-500 flex items-center text-sm"
					>
						<svg style={{ width: '16px', height: '16px' }} className="mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
						</svg>
						Back to Profile
					</Link>
				</div>

				<div className="bg-white shadow sm:rounded-lg">
					<div className="px-4 py-5 sm:p-6">
						<h3 className="text-lg leading-6 font-medium text-gray-900">
							Add a Friend
						</h3>
						<p className="mt-2 text-sm text-gray-500">
							Enter the username of the person you want to add as a friend
						</p>

						<form onSubmit={handleSubmit} className="mt-5">
							<div>
								<label htmlFor="username" className="block text-sm font-medium text-gray-700">
									Username
								</label>
								<div className="mt-1">
									<input
										type="text"
										name="username"
										id="username"
										value={username}
										onChange={(e) => setUsername(e.target.value)}
										className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md px-3 py-2 border"
										placeholder="Enter username"
										disabled={isLoading}
									/>
								</div>
							</div>

							{error && (
								<div className="mt-4 rounded-md bg-red-50 p-4">
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
											<p className="text-sm text-red-800">{error}</p>
										</div>
									</div>
								</div>
							)}

							{success && (
								<div className="mt-4 rounded-md bg-green-50 p-4">
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
											<p className="text-sm text-green-800">{success}</p>
										</div>
									</div>
								</div>
							)}

							<div className="mt-5">
								<button
									type="submit"
									disabled={isLoading}
									className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
				<div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
					<h4 className="text-sm font-medium text-blue-900 mb-2">Tips:</h4>
					<ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
						<li>Make sure you enter the exact username</li>
						<li>Usernames are case-sensitive</li>
						<li>You can view your pending sent requests in your profile</li>
					</ul>
				</div>
			</div>
		</div>
	)
}