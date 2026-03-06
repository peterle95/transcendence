'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface UserProfile {
	username: string
	wins: number
	losses: number
	draws: number
	points: number
}

interface Friend {
	id: number
	username: string
	wins: number
	losses: number
	draws: number
	points: number
}

export default function ProfilePage() {
	const params = useParams()
	const router = useRouter()
	const [profile, setProfile] = useState<UserProfile | null>(null)
	const [friends, setFriends] = useState<Friend[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState('')
	const [currentUserId, setCurrentUserId] = useState<string | null>(null)
	const [removingFriendId, setRemovingFriendId] = useState<number | null>(null)

	const userId = params.id as string

	useEffect(() => {
		const fetchProfile = async () => {
			try {
				const response = await fetch(`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/users/${userId}`, {
					credentials: 'include',
				})

				if (response.status === 401) {
					router.push('/login')
					return
				}

				if (!response.ok) {
					throw new Error('Failed to load profile')
				}

				const data = await response.json()
				setProfile(data)

				const sessionResponse = await fetch(`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/auth/session`, {
					credentials: 'include',
				})

				if (sessionResponse.ok) {
					const sessionData = await sessionResponse.json()
					setCurrentUserId(sessionData?.user?.id || null)

					// Only fetch friends if viewing own profile
					if (String(sessionData?.user?.id) === userId) {
						const friendsResponse = await fetch(
							`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/friends`,
							{
								credentials: 'include',
							}
						)

						if (friendsResponse.ok) {
							const friendsData = await friendsResponse.json()
							setFriends(friendsData.data || [])
						}
					}
				}
			} catch (err) {
				setError((err as Error).message)
			} finally {
				setIsLoading(false)
			}
		}

		fetchProfile()
	}, [userId, router])

	const isOwnProfile = currentUserId === userId

	const handleRemoveFriend = async (friendId: number) => {
		if (!confirm('Are you sure you want to remove this friend?')) {
			return
		}

		setRemovingFriendId(friendId)
		try {
			const response = await fetch(
				`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/friends/${friendId}`,
				{
					method: 'DELETE',
					credentials: 'include',
				}
			)

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.message || 'Failed to remove friend')
			}

			// Refresh the friends list
			const friendsResponse = await fetch(
				`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/friends`,
				{
					credentials: 'include',
				}
			)

			if (friendsResponse.ok) {
				const friendsData = await friendsResponse.json()
				setFriends(friendsData.data || [])
			}
		} catch (err) {
			alert((err as Error).message)
		} finally {
			setRemovingFriendId(null)
		}
	}

	if (isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
					<p className="mt-4 text-gray-600">Loading profile...</p>
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

	if (!profile) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="text-center">
					<p className="text-gray-600">Profile not found</p>
				</div>
			</div>
		)
	}

	return (
		<div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
			<div className="max-w-3xl mx-auto space-y-6">
				<div className="bg-white shadow overflow-hidden sm:rounded-lg">
					<div className="px-4 py-5 sm:px-6 flex justify-between items-center">
						<div>
							<h3 className="text-lg leading-6 font-medium text-gray-900">
								User Profile
							</h3>
							<p className="mt-1 max-w-2xl text-sm text-gray-500">
								{isOwnProfile ? 'Your profile information' : 'Profile details'}
							</p>
						</div>
						{isOwnProfile && (
							<Link
								href="/profile/update"
								className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
							>
								Edit Profile
							</Link>
						)}
					</div>
					<div className="border-t border-gray-200">
						<dl>
							<div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
								<dt className="text-sm font-medium text-gray-500">Username</dt>
								<dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
									{profile.username}
								</dd>
							</div>
							<div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
								<dt className="text-sm font-medium text-gray-500">Wins</dt>
								<dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
									{profile.wins}
								</dd>
							</div>
							<div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
								<dt className="text-sm font-medium text-gray-500">Losses</dt>
								<dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
									{profile.losses}
								</dd>
							</div>
							<div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
								<dt className="text-sm font-medium text-gray-500">Draws</dt>
								<dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
									{profile.draws}
								</dd>
							</div>
							<div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
								<dt className="text-sm font-medium text-gray-500">Points</dt>
								<dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
									{profile.points}
								</dd>
							</div>
						</dl>
					</div>
				</div>

				{isOwnProfile && (
					<div className="bg-white shadow sm:rounded-lg p-6">
						<div className="flex flex-col sm:flex-row gap-4">
							<Link
								href="/friends/pending"
								className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
							>
								<svg style={{ width: '16px', height: '16px' }} className="mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
								</svg>
								View Pending Requests
							</Link>
							<Link
								href="/friends/add"
								className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
							>
								<svg style={{ width: '16px', height: '16px' }} className="mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
								</svg>
								Add New Friend
							</Link>
						</div>
					</div>
				)}

				{isOwnProfile && <div className="bg-white shadow overflow-hidden sm:rounded-lg">
					<div className="px-4 py-5 sm:px-6">
						<h3 className="text-lg leading-6 font-medium text-gray-900">
							Friends ({friends.length})
						</h3>
					</div>
					<div className="border-t border-gray-200">
						{friends.length === 0 ? (
							<div className="px-4 py-12 text-center">
								<p className="mt-2 text-sm text-gray-500">
									{isOwnProfile ? 'You don\'t have any friends yet' : 'No friends to display'}
								</p>
								{isOwnProfile && (
									<Link
										href="/friends/add"
										className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
									>
										Add your first friend
									</Link>
								)}
							</div>
						) : (
							<ul className="divide-y divide-gray-200">
								{friends.map((friend) => (
									<li key={friend.id} className="px-4 py-4 hover:bg-gray-50">
										<div className="flex items-center justify-between gap-4">
											<Link href={`/profile/${friend.id}`} className="flex-1 min-w-0">
												<div className="flex items-center justify-between">
													<div className="flex-1 min-w-0">
														<p className="text-sm font-medium text-indigo-600 truncate">
															{friend.username}
														</p>
														<div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
															<span>Wins: {friend.wins}</span>
															<span>Losses: {friend.losses}</span>
															<span>Draws: {friend.draws}</span>
															<span>Points: {friend.points}</span>
														</div>
													</div>
													<div>
														<svg
															style={{ width: '16px', height: '16px' }}
															className="text-gray-400"
															fill="none"
															stroke="currentColor"
															viewBox="0 0 24 24"
														>
															<path
																strokeLinecap="round"
																strokeLinejoin="round"
																strokeWidth={2}
																d="M9 5l7 7-7 7"
															/>
														</svg>
													</div>
												</div>
											</Link>
											{isOwnProfile && (
												<button
													onClick={(e) => {
														e.preventDefault()
														handleRemoveFriend(friend.id)
													}}
													disabled={removingFriendId === friend.id}
													className="flex-shrink-0 inline-flex items-center px-3 py-1.5 border border-red-300 text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
													title="Remove friend"
												>
													{removingFriendId === friend.id ? (
														<div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600"></div>
													) : (
														<svg
															style={{ width: '14px', height: '14px' }}
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
													)}
													<span className="ml-1">Remove</span>
												</button>
											)}
										</div>
									</li>
								))}
							</ul>
						)}
					</div>
				</div>}
			</div>
		</div>
	)
}