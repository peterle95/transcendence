'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface UserProfile {
	username: string
	email?: string
	wins: number
	losses: number
}

export default function UpdateProfilePage() {
	const router = useRouter()
	const [formData, setFormData] = useState({
		username: '',
		email: '',
	})
	const [isLoading, setIsLoading] = useState(true)
	const [isSaving, setIsSaving] = useState(false)
	const [error, setError] = useState('')
	const [success, setSuccess] = useState(false)
	const [userId, setUserId] = useState<string | null>(null)
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
	const [deleteInput, setDeleteInput] = useState('')
	const [isDeleting, setIsDeleting] = useState(false)
	const [deleteError, setDeleteError] = useState('')

	useEffect(() => {
		const fetchProfile = async () => {
			try {
				const response = await fetch(`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/users/me`, {
					credentials: 'include',
				})

				if (response.status === 401) {
					router.push('/login')
					return
				}

				if (!response.ok) {
					throw new Error('Failed to load profile')
				}

				const data: UserProfile = await response.json()

				// Get user email from session since getUserById doesn't return it
				const sessionResponse = await fetch(`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/auth/session`, {
					credentials: 'include',
				})

				let email = ''
				if (sessionResponse.ok) {
					const sessionData = await sessionResponse.json()
					setUserId(sessionData?.user?.id || null)
					email = sessionData?.user?.email || ''
				} else {
					throw new Error('Failed to load session data')
				}

				setFormData({
					username: data.username,
					email: email
				})

			} catch (err) {
				setError((err as Error).message)
			} finally {
				setIsLoading(false)
			}
		}

		fetchProfile()
	}, [router])

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		setError('')
		setSuccess(false)
		setIsSaving(true)

		try {
			const response = await fetch(`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/users/me`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify(formData),
			})

			if (!response.ok) {
				throw new Error('Failed to update profile')
			}

			const data = await response.json()

			setSuccess(true)

			setTimeout(() => {
				if (!userId) {
					setError('Unable to determine user id for redirect')
					return
				}
				router.push(`/profile/${userId}`)
			}, 1500)
		} catch (err) {
			setError((err as Error).message)
		} finally {
			setIsSaving(false)
		}
	}

	const handleDeleteAccount = async () => {
		setDeleteError('')
		setIsDeleting(true)
		try {
			const response = await fetch(`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/users/me`, {
				method: 'DELETE',
				credentials: 'include',
			})

			if (!response.ok) {
				throw new Error('Failed to delete account')
			}

			await fetch(`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/auth/signout`, {
				method: 'POST',
				credentials: 'include',
			})

			router.push('/login')
		} catch (err) {
			setDeleteError((err as Error).message)
			setIsDeleting(false)
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

	return (
		<div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
			<div className="max-w-md mx-auto space-y-6">
				<div className="bg-white shadow sm:rounded-lg">
					<div className="px-4 py-5 sm:p-6">
						<h3 className="text-lg leading-6 font-medium text-gray-900">
							Update Profile
						</h3>
						<p className="mt-1 text-sm text-gray-500">
							Update your account information
						</p>

						<form className="mt-6 space-y-6" onSubmit={handleSubmit}>
							{error && (
								<div className="rounded-md bg-red-50 p-4">
									<p className="text-sm text-red-800">{error}</p>
								</div>
							)}

							{success && (
								<div className="rounded-md bg-green-50 p-4">
									<p className="text-sm text-green-800">
										Profile updated successfully! Redirecting...
									</p>
								</div>
							)}

							<div>
								<label
									htmlFor="username"
									className="block text-sm font-medium text-gray-700"
								>
									Username
								</label>
								<input
									type="text"
									id="username"
									required
									className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
									value={formData.username}
									onChange={(e) =>
										setFormData({ ...formData, username: e.target.value })
									}
								/>
							</div>

							<div>
								<label
									htmlFor="email"
									className="block text-sm font-medium text-gray-700"
								>
									Email
								</label>
								<input
									type="email"
									id="email"
									required
									className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
									value={formData.email}
									onChange={(e) =>
										setFormData({ ...formData, email: e.target.value })
									}
								/>
							</div>
							<div className="flex gap-3">
								<button
									type="submit"
									disabled={isSaving}
									className="flex-1 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{isSaving ? 'Saving...' : 'Save Changes'}
								</button>
								<button
									type="button"
									onClick={() => router.back()}
									className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
								>
									Cancel
								</button>
							</div>
						</form>
					</div>
				</div>

				<div className="bg-white shadow sm:rounded-lg border border-red-200">
					<div className="px-4 py-5 sm:p-6">
						<h3 className="text-lg leading-6 font-medium text-red-600">
							Danger Zone
						</h3>
						<p className="mt-1 text-sm text-gray-500">
							Permanently delete your account and all associated data. This action cannot be undone.
						</p>

						{!showDeleteConfirm ? (
							<button
								type="button"
								onClick={() => setShowDeleteConfirm(true)}
								className="mt-4 inline-flex justify-center py-2 px-4 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
							>
								Delete Account
							</button>
						) : (
							<div className="mt-4 space-y-3">
								{deleteError && (
									<div className="rounded-md bg-red-50 p-4">
										<p className="text-sm text-red-800">{deleteError}</p>
									</div>
								)}
								<p className="text-sm font-medium text-gray-700">
									Type <span className="font-mono font-bold">delete</span> to confirm:
								</p>
								<input
									type="text"
									className="block w-full border border-red-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
									value={deleteInput}
									onChange={(e) => setDeleteInput(e.target.value)}
									placeholder="delete"
								/>
								<div className="flex gap-3">
									<button
										type="button"
										onClick={handleDeleteAccount}
										disabled={deleteInput !== 'delete' || isDeleting}
										className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										{isDeleting ? 'Deleting...' : 'Confirm Delete'}
									</button>
									<button
										type="button"
										onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); setDeleteError('') }}
										className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
									>
										Cancel
									</button>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
