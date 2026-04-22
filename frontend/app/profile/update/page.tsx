'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface UserProfile {
	username: string
	email?: string
	avatarUrl: string | null
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
	const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null)
	const [avatarFile, setAvatarFile] = useState<File | null>(null)
	const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
	const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
	const [avatarError, setAvatarError] = useState('')
	const [avatarSuccess, setAvatarSuccess] = useState(false)
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
				setCurrentAvatarUrl(data.avatarUrl ?? null)

			} catch (err) {
				setError((err as Error).message)
			} finally {
				setIsLoading(false)
			}
		}

		fetchProfile()
	}, [router])

	const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setAvatarError('')
		setAvatarSuccess(false)
		const file = e.target.files?.[0]
		if (!file) return

		// Client-side UX check only — server enforces both of these too
		if (!['image/jpeg', 'image/png'].includes(file.type)) {
			setAvatarError('Only PNG and JPEG images are allowed')
			return
		}
		// Mirrors AVATAR_MAX_SIZE on the server (2 MB)
		if (file.size > 2 * 1024 * 1024) {
			setAvatarError('File size must be under 2MB')
			return
		}

		setAvatarFile(file)
		setAvatarPreview(URL.createObjectURL(file))
	}

	const handleAvatarUpload = async () => {
		if (!avatarFile) return
		setAvatarError('')
		setAvatarSuccess(false)
		setIsUploadingAvatar(true)

		try {
			const form = new FormData()
			form.append('avatar', avatarFile)

			const response = await fetch(`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/users/me/avatar`, {
				method: 'POST',
				credentials: 'include',
				body: form,
			})

			if (!response.ok) {
				const data = await response.json()
				throw new Error(data.error || data.message || 'Failed to upload avatar')
			}

			const data = await response.json()
			setCurrentAvatarUrl(data.avatarUrl)
			setAvatarFile(null)
			setAvatarPreview(null)
			setAvatarSuccess(true)
		} catch (err) {
			setAvatarError((err as Error).message)
		} finally {
			setIsUploadingAvatar(false)
		}
	}

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

			await response.json()

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
		<div style={{ minHeight: '100vh', padding: '48px 16px' }}>
			<div className="max-w-md mx-auto space-y-6">

				{/* Avatar section */}
				<div 
					style={{
						background: 'rgba(255,255,255,0.06)',
						border: '1px solid rgba(255,255,255,0.12)',
						borderRadius: '20px',
						backdropFilter: 'blur(20px)',
						boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
					}}
				>
					<div className="px-4 py-5 sm:p-6 text-white">
						<h3 className="text-xl font-bold">
							Profile Picture
						</h3>
						<p className="mt-1 text-sm text-gray-400">
							Upload a PNG or JPEG image (max 2MB)
						</p>

						<div className="mt-6 flex items-center gap-5">
							<img
								src={
									avatarPreview
										? avatarPreview
										: currentAvatarUrl
											? `${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}${currentAvatarUrl}`
											: `${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/default-avatar.png`
								}
								alt="Avatar preview"
								className="rounded-full object-cover border-4 border-blue-500/30"
								style={{ width: '80px', height: '80px' }}
							/>
							<div className="flex-1 space-y-2">
								<input
									type="file"
									accept=".png,.jpg,.jpeg"
									onChange={handleAvatarChange}
									className="block w-full text-sm text-gray-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-blue-600/30 file:text-blue-300 hover:file:bg-blue-600/50 transition-colors file:cursor-pointer"
								/>
								{avatarError && (
									<p className="text-xs text-red-400">{avatarError}</p>
								)}
								{avatarSuccess && (
									<p className="text-xs text-green-400">Avatar updated successfully!</p>
								)}
							</div>
						</div>

						{avatarFile && (
							<div className="mt-6 flex gap-3">
								<button
									type="button"
									onClick={handleAvatarUpload}
									disabled={isUploadingAvatar}
									style={{
										background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
									}}
									className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-bold rounded-lg text-white hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{isUploadingAvatar ? 'Uploading...' : 'Upload Avatar'}
								</button>
								<button
									type="button"
									onClick={() => { setAvatarFile(null); setAvatarPreview(null); setAvatarError('') }}
									className="inline-flex justify-center py-2 px-6 border border-white/20 shadow-sm text-sm font-bold rounded-lg text-white bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
								>
									Cancel
								</button>
							</div>
						)}
					</div>
				</div>

				{/* Username / email section */}
				<div 
					style={{
						background: 'rgba(255,255,255,0.06)',
						border: '1px solid rgba(255,255,255,0.12)',
						borderRadius: '20px',
						backdropFilter: 'blur(20px)',
						boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
					}}
				>
					<div className="px-4 py-5 sm:p-6 text-white">
						<h3 className="text-xl font-bold">
							Update Profile
						</h3>
						<p className="mt-1 text-sm text-gray-400">
							Update your account information
						</p>

						<form className="mt-8 space-y-6" onSubmit={handleSubmit}>
							{error && (
								<div className="rounded-lg bg-red-900/40 border border-red-500/50 p-4">
									<p className="text-sm text-red-200">{error}</p>
								</div>
							)}

							{success && (
								<div className="rounded-lg bg-green-900/40 border border-green-500/50 p-4">
									<p className="text-sm text-green-200">
										Profile updated successfully! Redirecting...
									</p>
								</div>
							)}

							<div>
								<label
									htmlFor="username"
									className="block text-sm font-medium text-gray-300"
								>
									Username
								</label>
								<input
									type="text"
									id="username"
									required
									style={{
										background: 'rgba(0,0,0,0.2)',
										border: '1px solid rgba(255,255,255,0.2)',
										color: 'white',
									}}
									className="mt-2 block w-full rounded-lg shadow-sm py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm transition-all"
									value={formData.username}
									onChange={(e) =>
										setFormData({ ...formData, username: e.target.value })
									}
								/>
							</div>

							<div>
								<label
									htmlFor="email"
									className="block text-sm font-medium text-gray-300"
								>
									Email
								</label>
								<input
									type="email"
									id="email"
									required
									style={{
										background: 'rgba(0,0,0,0.2)',
										border: '1px solid rgba(255,255,255,0.2)',
										color: 'white',
									}}
									className="mt-2 block w-full rounded-lg shadow-sm py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm transition-all"
									value={formData.email}
									onChange={(e) =>
										setFormData({ ...formData, email: e.target.value })
									}
								/>
							</div>
							<div className="flex gap-3 pt-4">
								<button
									type="submit"
									disabled={isSaving}
									style={{
										background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
									}}
									className="flex-1 inline-flex justify-center py-3 px-4 border border-transparent shadow-sm text-sm font-bold rounded-lg text-white hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{isSaving ? 'Saving...' : 'Save Changes'}
								</button>
								<button
									type="button"
									onClick={() => router.back()}
									className="inline-flex justify-center py-3 px-6 border border-white/20 shadow-sm text-sm font-bold rounded-lg text-white bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
								>
									Cancel
								</button>
							</div>
						</form>
					</div>
				</div>

				{/* Danger Zone */}
				<div 
					style={{
						background: 'rgba(239,68,68,0.05)',
						border: '1px solid rgba(239,68,68,0.2)',
						borderRadius: '20px',
						backdropFilter: 'blur(20px)',
						boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
					}}
				>
					<div className="px-4 py-5 sm:p-6 text-white">
						<h3 className="text-xl font-bold text-red-400">
							Danger Zone
						</h3>
						<p className="mt-1 text-sm text-red-200/70">
							Permanently delete your account and all associated data. This action cannot be undone.
						</p>

						{!showDeleteConfirm ? (
							<button
								type="button"
								onClick={() => setShowDeleteConfirm(true)}
								className="mt-6 inline-flex justify-center py-2 px-6 border border-red-500/50 shadow-sm text-sm font-bold rounded-lg text-red-400 bg-red-900/20 hover:bg-red-900/40 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
							>
								Delete Account
							</button>
						) : (
							<div className="mt-6 space-y-4">
								{deleteError && (
									<div className="rounded-lg bg-red-900/50 border border-red-500/50 p-4">
										<p className="text-sm text-red-300">{deleteError}</p>
									</div>
								)}
								<p className="text-sm font-medium text-red-200">
									Type <span className="font-mono font-bold bg-black/40 px-2 py-0.5 rounded">delete</span> to confirm:
								</p>
								<input
									type="text"
									style={{
										background: 'rgba(0,0,0,0.2)',
										border: '1px solid rgba(239,68,68,0.4)',
										color: 'white',
									}}
									className="block w-full rounded-lg shadow-sm py-2 px-4 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent sm:text-sm transition-all"
									value={deleteInput}
									onChange={(e) => setDeleteInput(e.target.value)}
									placeholder="delete"
								/>
								<div className="flex gap-3 pt-2">
									<button
										type="button"
										onClick={handleDeleteAccount}
										disabled={deleteInput !== 'delete' || isDeleting}
										className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-bold rounded-lg text-white bg-red-600 hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										{isDeleting ? 'Deleting...' : 'Confirm Delete'}
									</button>
									<button
										type="button"
										onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); setDeleteError('') }}
										className="inline-flex justify-center py-2 px-6 border border-white/20 shadow-sm text-sm font-bold rounded-lg text-white bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
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
