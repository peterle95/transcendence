'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function Header() {
	const router = useRouter()
	const [isOpen, setIsOpen] = useState(false)
	const [user, setUser] = useState<{ id: string; username: string } | null>(null)

	useEffect(() => {
		const fetchSession = async () => {
			try {
				const res = await fetch(
					`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/auth/session`,
					{ credentials: 'include' }
				)
				const data = await res.json()
				if (data?.user?.id) {
					setUser({ id: String(data.user.id), username: data.user.name })
				}
			} catch {
				// no session
			}
		}
		fetchSession()
	}, [])

	const handleLogout = async () => {
		await fetch(`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/auth/signout`, {
			method: 'POST',
			credentials: 'include',
		})
		router.push('/login')
	}

	return (
		<header className="sticky top-0 z-10 bg-black/40 backdrop-blur border-b border-white/10">
			<div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
				<span className="text-white font-bold text-lg tracking-wide">Antigravity</span>

				{user && (
					<div className="relative">
						<button
							onClick={() => setIsOpen((prev) => !prev)}
							className="flex items-center gap-2 text-white hover:text-purple-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10"
						>
							<span className="font-medium">{user.username}</span>
							<svg
								className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
							</svg>
						</button>

						{isOpen && (
							<>
								<div
									className="fixed inset-0 z-10"
									onClick={() => setIsOpen(false)}
								/>
								<div className="absolute right-0 mt-1 w-44 bg-gray-900 border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden">
									<Link
										href={`/profile/${user.id}`}
										className="block px-4 py-2.5 text-sm text-gray-200 hover:bg-white/10 transition-colors"
										onClick={() => setIsOpen(false)}
									>
										My Profile
									</Link>
									<button
										onClick={handleLogout}
										className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-white/10 transition-colors border-t border-white/10"
									>
										Logout
									</button>
								</div>
							</>
						)}
					</div>
				)}
			</div>
		</header>
	)
}
