"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"

interface RegisterFormData {
	email: string
	username: string
	password: string
}

export default function RegisterPage() {
	const router = useRouter()
	const [formData, setFormData] = useState<RegisterFormData>({
		email: "",
		username: "",
		password: "",
	})
	const [error, setError] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setFormData({ ...formData, [e.target.name]: e.target.value })
	}

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		setLoading(true)
		setError(null)

		try {
			const res = await fetch("/api/register", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(formData),
			})

			const data = await res.json()

			if (!res.ok) {
				throw new Error(data.error || "Registration failed")
			}

			const signInResult = await signIn("credentials", {
				redirect: false,
				email: formData.email,
				password: formData.password,
			})

			if (signInResult?.error) {
				throw new Error(signInResult.error)
			}

			//router.push("/home") 
		} catch (err: any) {
			setError(err.message)
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="flex items-center justify-center min-h-screen bg-gray-100">
			<form
				onSubmit={handleSubmit}
				className="bg-white p-8 rounded shadow-md w-full max-w-md"
			>
				<h1 className="text-2xl font-bold mb-6 text-center">Register</h1>

				{error && <p className="text-red-500 mb-4">{error}</p>}

				<label className="block mb-2 font-medium">Email</label>
				<input
					type="email"
					name="email"
					value={formData.email}
					onChange={handleChange}
					className="w-full p-2 mb-4 border rounded"
					required
				/>

				<label className="block mb-2 font-medium">Username</label>
				<input
					type="text"
					name="username"
					value={formData.username}
					onChange={handleChange}
					className="w-full p-2 mb-4 border rounded"
					required
				/>

				<label className="block mb-2 font-medium">Password</label>
				<input
					type="password"
					name="password"
					value={formData.password}
					onChange={handleChange}
					className="w-full p-2 mb-6 border rounded"
					required
				/>

				<button
					type="submit"
					disabled={loading}
					className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition"
				>
					{loading ? "Registering..." : "Register"}
				</button>
			</form>
		</div>
	)
}
