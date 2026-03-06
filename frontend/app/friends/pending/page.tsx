'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface PendingRequest {
	id: number
	requesterId: number
	addresseeId: number
	status: string
	createdAt: string
	requester: {
		id: number
		username: string
		email: string
	}
}

export default function PendingRequestsPage() {
	const router = useRouter()
	const [requests, setRequests] = useState<PendingRequest[]>([])
	const [currentUserId, setCurrentUserId] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState('')
	const [actionLoading, setActionLoading] = useState<number | null>(null)

	useEffect(() => {
		fetchPendingRequests()
	}, [])

	const fetchPendingRequests = async () => {
		try {
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
			const userId = sessionData?.user?.id

			if (!userId) {
				router.push('/login')
				return
			}

			setCurrentUserId(userId)

			const response = await fetch(
				`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/friends/requests`,
				{
					credentials: 'include',
				}
			)

			if (!response.ok) {
				throw new Error('Failed to load pending requests')
			}

			const data = await response.json()
			setRequests(data.data || [])
		} catch (err) {
			setError((err as Error).message)
		} finally {
			setIsLoading(false)
		}
	}

	const handleAccept = async (friendshipId: number) => {
		setActionLoading(friendshipId)
		try {
			const response = await fetch(
				`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/friends/requests/${friendshipId}`,
				{
					method: 'PATCH',
					headers: {
						'Content-Type': 'application/json',
					},
					credentials: 'include',
					body: JSON.stringify({ action: 'accept' }),
				}
			)

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.message || 'Failed to accept request')
			}

			// Refresh the list
			await fetchPendingRequests()
		} catch (err) {
			alert((err as Error).message)
		} finally {
			setActionLoading(null)
		}
	}

	const handleReject = async (friendshipId: number) => {
		setActionLoading(friendshipId)
		try {
			const response = await fetch(
				`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/friends/requests/${friendshipId}`,
				{
					method: 'PATCH',
					headers: {
						'Content-Type': 'application/json',
					},
					credentials: 'include',
					body: JSON.stringify({ action: 'reject' }),
				}
			)

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.message || 'Failed to reject request')
			}

			// Refresh the list
			await fetchPendingRequests()
		} catch (err) {
			alert((err as Error).message)
		} finally {
			setActionLoading(null)
		}
	}

	const handleBlock = async (friendshipId: number) => {
		if (!confirm('Are you sure you want to block this user? They will not be able to send you friend requests.')) {
			return
		}

		setActionLoading(friendshipId)
		try {
			const response = await fetch(
				`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/friends/requests/${friendshipId}`,
				{
					method: 'PATCH',
					headers: {
						'Content-Type': 'application/json',
					},
					credentials: 'include',
					body: JSON.stringify({ action: 'block' }),
				}
			)

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.message || 'Failed to block user')
			}

			// Refresh the list
			await fetchPendingRequests()
		} catch (err) {
			alert((err as Error).message)
		} finally {
			setActionLoading(null)
		}
	}

	if (isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
					<p className="mt-4 text-gray-600">Loading pending requests...</p>
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="max-w-md w-full">
					<div className="rounded-md bg-red-50 p-4">
						<p className="text-sm text-red-800">{error}</p>
					</div>
					<button
						onClick={() => router.back()}
						className="mt-4 text-indigo-600 hover:text-indigo-500"
					>
						← Go back
					</button>
				</div>
			</div>
		)
	}

	return (
		<div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
			<div className="max-w-3xl mx-auto">
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

				<div className="bg-white shadow overflow-hidden sm:rounded-lg">
					<div className="px-4 py-5 sm:px-6">
						<h3 className="text-lg leading-6 font-medium text-gray-900">
							Pending Friend Requests
						</h3>
						<p className="mt-1 max-w-2xl text-sm text-gray-500">
							Accept, reject, or block friend requests
						</p>
					</div>
					<div className="border-t border-gray-200">
						{requests.length === 0 ? (
							<div className="px-4 py-12 text-center">
								<svg
									style={{ width: '48px', height: '48px' }}
									className="mx-auto text-gray-400"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
									/>
								</svg>
								<p className="mt-2 text-sm text-gray-500">No pending friend requests</p>
								<Link
									href="/friends/add"
									className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
								>
									Add a friend
								</Link>
							</div>
						) : (
							<ul className="divide-y divide-gray-200">
								{requests.map((request) => (
									<li key={request.id} className="px-4 py-4">
										<div className="flex items-center justify-between">
											<div className="flex-1 min-w-0">
												<Link
													href={`/profile/${request.requester.id}`}
													className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
												>
													{request.requester.username}
												</Link>
		<p className="text-xs text-gray-400 mt-1">
													Sent {new Date(request.createdAt).toLocaleDateString()}
												</p>
											</div>
											<div className="flex gap-2 ml-4">
												<button
													onClick={() => handleAccept(request.id)}
													disabled={actionLoading === request.id}
													className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
												>
													{actionLoading === request.id ? (
														<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
													) : (
														'Accept'
													)}
												</button>
												<button
													onClick={() => handleReject(request.id)}
													disabled={actionLoading === request.id}
													className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
												>
													Reject
												</button>
												<button
													onClick={() => handleBlock(request.id)}
													disabled={actionLoading === request.id}
													className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
												>
													Block
												</button>
											</div>
										</div>
									</li>
								))}
							</ul>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}