import { NextResponse } from "next/server"
import { registerUser } from "../../../lib/register"

export async function POST(req: Request) {
	try {
		let data
		try {
			data = await req.json()
		} catch {
			return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
		}
		await registerUser(data)
		return NextResponse.json({ success: true })
	} catch (err) {
		if (err instanceof Error) {
			if (err.message === "Missing required fields") {
				return NextResponse.json({ error: err.message }, { status: 400 })
			}
			if (err.message === "Email or username already exists") {
				return NextResponse.json({ error: err.message }, { status: 409 })
			}
		}
		return NextResponse.json({ error: "Registration failed" }, { status: 500 })
	}
}