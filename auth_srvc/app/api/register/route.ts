import { NextResponse } from "next/server"
import { registerUser } from "../../../lib/register"

export async function POST(req: Request) {
	try {
		const data = await req.json()
		await registerUser(data)
		return NextResponse.json({ success: true })
	} catch (err) {
		const message = err instanceof Error && err.message === "Missing required fields"
				? err.message
				: "Registration failed"
		const status =
			err instanceof Error && err.message === "Missing required fields"
				? 400
				: 500
		return NextResponse.json({ error: message }, { status })
	}
}