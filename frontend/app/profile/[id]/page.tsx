'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface UserProfile {
	username: string
	avatarUrl: string | null
}

interface Friend {
	id: number
	username: string
}

interface UserStats {
	totalGamesPlayed: number
	totalWins: number
	totalLosses: number
	totalShipsDestroyed: number
	totalShipsLost: number
	totalShotsFired: number
	totalShotsHit: number
	winRate: number | null
	accuracy: number | null
}

interface GameOpponent {
	playerName: string
	playerColor: string
	isWinner: boolean
	placement: number
	shipsDestroyed: number
}

interface GameHistoryEntry {
	sessionId: string
	gameMode: string
	duration: number
	playedAt: string
	result: 'win' | 'loss'
	placement: number | null
	shotsFired: number
	shotsHit: number
	shipsLost: number
	shipsDestroyed: number
	accuracy: number | null
	playerColor: string | null
	opponents: GameOpponent[]
}

export default function ProfilePage() {
	const params = useParams()
	const router = useRouter()
	const [profile, setProfile] = useState<UserProfile | null>(null)
	const [userStats, setUserStats] = useState<UserStats | null>(null)
	const [friends, setFriends] = useState<Friend[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState('')
	const [currentUserId, setCurrentUserId] = useState<string | null>(null)
	const [removingFriendId, setRemovingFriendId] = useState<number | null>(null)
	const [gameHistory, setGameHistory] = useState<GameHistoryEntry[]>([])
	const [historyTotal, setHistoryTotal] = useState(0)
	const [historyOffset, setHistoryOffset] = useState(0)
	const HISTORY_LIMIT = 10

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
					setCurrentUserId(sessionData?.user?.id != null ? String(sessionData.user.id) : null)

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

				try {
					const statsResponse = await fetch(
						`${process.env.NEXT_PUBLIC_GAME_SERVICE_URL}/api/stats/user/${userId}`
					)
					if (statsResponse.ok) {
						const statsData = await statsResponse.json()
						setUserStats(statsData)
					}
				} catch {
					// stats unavailable — page renders with null state
				}

				try {
					const historyResponse = await fetch(
						`${process.env.NEXT_PUBLIC_GAME_SERVICE_URL}/api/stats/history?userId=${userId}&limit=${HISTORY_LIMIT}&offset=0`
					)
					if (historyResponse.ok) {
						const historyData = await historyResponse.json()
						setGameHistory(historyData.data || [])
						setHistoryTotal(historyData.total || 0)
					}
				} catch {

				}
			} catch (err) {
				setError((err as Error).message)
			} finally {
				setIsLoading(false)
			}
		}

		fetchProfile()
	}, [userId, router])

	const loadMoreHistory = async () => {
		const nextOffset = historyOffset + HISTORY_LIMIT
		try {
			const response = await fetch(
				`${process.env.NEXT_PUBLIC_GAME_SERVICE_URL}/api/stats/history?userId=${userId}&limit=${HISTORY_LIMIT}&offset=${nextOffset}`
			)
			if (response.ok) {
				const data = await response.json()
				setGameHistory(prev => [...prev, ...(data.data || [])])
				setHistoryOffset(nextOffset)
			}
		} catch {

		}
	}

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
		<div style={{ minHeight: '100vh', padding: '48px 16px' }}>
			<div className="max-w-3xl mx-auto space-y-8">
				<div
					style={{
						background: 'rgba(255,255,255,0.06)',
						border: '1px solid rgba(255,255,255,0.12)',
						borderRadius: '20px',
						backdropFilter: 'blur(20px)',
						boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
						overflow: 'hidden',
					}}
				>
					<div className="px-4 py-5 sm:px-6 flex justify-between items-center bg-black/20 border-b border-white/10">
						<div>
							<h3 className="text-xl font-bold text-white">
								User Profile
							</h3>
							<p className="mt-1 max-w-2xl text-sm text-gray-300">
								{isOwnProfile ? 'Your profile information' : 'Profile details'}
							</p>
						</div>
						{isOwnProfile && (
							<Link
								href="/profile/update"
								style={{
									padding: '8px 16px',
									borderRadius: '8px',
									background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
									color: '#fff',
									fontWeight: 'bold',
									fontSize: '0.875rem',
									textDecoration: 'none',
									display: 'inline-block'
								}}
							>
								Edit Profile
							</Link>
						)}
					</div>
					<div>
						<div className="px-4 py-8 sm:px-6 flex justify-center">
							<img
								src={
									profile.avatarUrl
										? `${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}${profile.avatarUrl}`
										: '/default-avatar.png'
								}
								alt={`${profile.username}'s avatar`}
								className="rounded-full object-cover border-4 border-blue-500/30"
								style={{ width: '120px', height: '120px', boxShadow: '0 0 40px rgba(59,130,246,0.5)' }}
							/>
						</div>
						<dl className="divide-y divide-white/10">
							<div className="px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 hover:bg-white/5 transition-colors">
								<dt className="text-sm font-medium text-blue-200">Username</dt>
								<dd className="mt-1 text-sm font-semibold text-white sm:mt-0 sm:col-span-2">
									{profile.username}
								</dd>
							</div>
							<div className="px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 hover:bg-white/5 transition-colors">
								<dt className="text-sm font-medium text-blue-200">Games Played</dt>
								<dd className="mt-1 text-sm font-semibold text-white sm:mt-0 sm:col-span-2">
									{userStats?.totalGamesPlayed ?? '--'}
								</dd>
							</div>
							<div className="px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 hover:bg-white/5 transition-colors">
								<dt className="text-sm font-medium text-blue-200">Wins</dt>
								<dd className="mt-1 text-sm font-semibold text-white sm:mt-0 sm:col-span-2">
									{userStats?.totalWins ?? '--'}
								</dd>
							</div>
							<div className="px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 hover:bg-white/5 transition-colors">
								<dt className="text-sm font-medium text-blue-200">Losses</dt>
								<dd className="mt-1 text-sm font-semibold text-white sm:mt-0 sm:col-span-2">
									{userStats?.totalLosses ?? '--'}
								</dd>
							</div>
							<div className="px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 hover:bg-white/5 transition-colors">
								<dt className="text-sm font-medium text-blue-200">Win Rate</dt>
								<dd className="mt-1 text-sm font-semibold text-white sm:mt-0 sm:col-span-2">
									{userStats?.winRate != null ? Math.round(userStats.winRate) + '%' : '--'}
								</dd>
							</div>
							<div className="px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 hover:bg-white/5 transition-colors">
								<dt className="text-sm font-medium text-blue-200">Accuracy</dt>
								<dd className="mt-1 text-sm font-semibold text-white sm:mt-0 sm:col-span-2">
									{userStats?.accuracy != null ? Math.round(userStats.accuracy) + '%' : '--'}
								</dd>
							</div>
						</dl>
					</div>
				</div>

				{isOwnProfile && (
					<div
						style={{
							background: 'rgba(255,255,255,0.06)',
							border: '1px solid rgba(255,255,255,0.12)',
							borderRadius: '20px',
							backdropFilter: 'blur(20px)',
							padding: '24px',
						}}
					>
						<div className="flex flex-col sm:flex-row gap-4">
							<Link
								href="/friends/pending"
								className="flex-1 inline-flex justify-center items-center px-4 py-3 border border-white/20 shadow-sm text-sm font-bold rounded-xl text-white bg-white/10 hover:bg-white/20 transition-colors"
							>
								<svg style={{ width: '18px', height: '18px' }} className="mr-2 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
								</svg>
								View Pending Requests
							</Link>
							<Link
								href="/friends/add"
								className="flex-1 inline-flex justify-center items-center px-4 py-3 border border-transparent shadow-sm text-sm font-bold rounded-xl text-white"
								style={{
									background: 'linear-gradient(135deg, #3b82f6, #2563eb)'
								}}
							>
								<svg style={{ width: '18px', height: '18px' }} className="mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
								</svg>
								Add New Friend
							</Link>
						</div>
					</div>
				)}

				{isOwnProfile && <div
					style={{
						background: 'rgba(255,255,255,0.06)',
						border: '1px solid rgba(255,255,255,0.12)',
						borderRadius: '20px',
						backdropFilter: 'blur(20px)',
						overflow: 'hidden'
					}}
				>
					<div className="px-4 py-5 sm:px-6 bg-black/20 border-b border-white/10">
						<h3 className="text-xl leading-6 font-bold text-white">
							Friends ({friends.length})
						</h3>
					</div>
					<div>
						{friends.length === 0 ? (
							<div className="px-4 py-12 text-center">
								<p className="mt-2 text-sm text-blue-200">
									{isOwnProfile ? 'You don\'t have any friends yet' : 'No friends to display'}
								</p>
								{isOwnProfile && (
									<Link
										href="/friends/add"
										className="mt-4 inline-flex items-center px-4 py-2 border border-blue-500/50 text-sm font-medium rounded-md text-blue-300 bg-blue-900/30 hover:bg-blue-900/50 transition-colors"
									>
										Add your first friend
									</Link>
								)}
							</div>
						) : (
							<ul className="divide-y divide-white/10">
								{friends.map((friend) => (
									<li key={friend.id} className="px-4 py-4 hover:bg-white/5 transition-colors">
										<div className="flex items-center justify-between gap-4">
											<Link href={`/profile/${friend.id}`} className="flex-1 min-w-0 group">
												<div className="flex items-center justify-between">
													<div className="flex-1 min-w-0">
														<p className="text-sm font-bold text-blue-400 group-hover:text-blue-300 transition-colors truncate">
															{friend.username}
														</p>
													</div>
													<div>
														<svg
															style={{ width: '16px', height: '16px' }}
															className="text-white/20 group-hover:text-white/60 transition-colors"
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
													className="flex-shrink-0 inline-flex items-center px-3 py-1.5 border border-red-500/30 text-xs font-bold rounded-lg text-red-400 bg-red-900/20 hover:bg-red-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
													title="Remove friend"
												>
													{removingFriendId === friend.id ? (
														<div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-400"></div>
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

				{/* Game History */}
				<div
					style={{
						background: 'rgba(255,255,255,0.06)',
						border: '1px solid rgba(255,255,255,0.12)',
						borderRadius: '20px',
						backdropFilter: 'blur(20px)',
						overflow: 'hidden',
					}}
				>
					<div className="px-4 py-5 sm:px-6 bg-black/20 border-b border-white/10">
						<h3 className="text-xl leading-6 font-bold text-white">
							Game History {historyTotal > 0 && <span className="text-sm font-normal text-gray-400">({historyTotal} games)</span>}
						</h3>
					</div>
					<div>
						{gameHistory.length === 0 ? (
							<div className="px-4 py-12 text-center">
								<p className="text-sm text-blue-200">No game history yet</p>
							</div>
						) : (
							<>
								<ul className="divide-y divide-white/10">
									{gameHistory.map((game) => (
										<li key={game.sessionId} className="px-4 py-4 hover:bg-white/5 transition-colors">
											<div className="flex items-center justify-between gap-4">
												<div className="flex items-center gap-3 min-w-0">
													{game.playerColor && (
														<div
															className="flex-shrink-0 rounded-full"
															style={{ width: '10px', height: '10px', background: game.playerColor }}
														/>
													)}
													<div className="min-w-0">
														<div className="flex items-center gap-2 flex-wrap">
															<span
																className="text-xs font-bold px-2 py-0.5 rounded"
																style={{
																	background: game.result === 'win' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
																	color: game.result === 'win' ? '#4ade80' : '#f87171',
																}}
															>
																{game.result === 'win' ? 'WIN' : 'LOSS'}
															</span>
															<span className="text-xs text-gray-400 uppercase tracking-wide">{game.gameMode}</span>
															{game.placement != null && (
																<span className="text-xs text-gray-500">#{game.placement}</span>
															)}
														</div>
														<div className="mt-1 flex items-center gap-3 text-xs text-gray-400 flex-wrap">
															<span>Accuracy: <span className="text-gray-200">{game.accuracy != null ? `${game.accuracy}%` : '--'}</span></span>
															<span>Ships destroyed: <span className="text-gray-200">{game.shipsDestroyed}</span></span>
															<span>Ships lost: <span className="text-gray-200">{game.shipsLost}</span></span>
															{game.opponents.length > 0 && (
																<span className="text-gray-500">
																	vs {game.opponents.map(o => o.playerName).join(', ')}
																</span>
															)}
														</div>
													</div>
												</div>
												<div className="flex-shrink-0 text-right">
													<p className="text-xs text-gray-500">
														{new Date(game.playedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
													</p>
													<p className="text-xs text-gray-600 mt-0.5">
														{Math.floor(game.duration / 1000 / 60)}m {Math.round((game.duration / 1000) % 60)}s
													</p>
												</div>
											</div>
										</li>
									))}
								</ul>
								{gameHistory.length < historyTotal && (
									<div className="px-4 py-4 text-center border-t border-white/10">
										<button
											onClick={loadMoreHistory}
											className="text-sm text-blue-400 hover:text-blue-300 transition-colors font-medium"
										>
											Load more
										</button>
									</div>
								)}
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
