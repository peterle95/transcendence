"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"

interface LoginFormData {
	email: string
	password: string
}

export default function LoginPage() {
	const router = useRouter()
	const [formData, setFormData] = useState<LoginFormData>({
		email: "",
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
			const result = await signIn("credentials", {
				redirect: false,
				email: formData.email,
				password: formData.password,
			})

			if (!result) {
				throw new Error("Unexpected error logging in")
			}

			if (result.error) {
				throw new Error(result.error)
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
				<h1 className="text-2xl font-bold mb-6 text-center">Login</h1>

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
					{loading ? "Logging in..." : "Login"}
				</button>

				<p className="mt-4 text-center text-sm">
					Don’t have an account?{" "}
					<a href="/register" className="text-blue-600 hover:underline">
						Register
					</a>
				</p>
			</form>
		</div>
	)
}
