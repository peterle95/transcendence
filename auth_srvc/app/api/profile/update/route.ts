import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../../../../lib/auth"
import { updateUserProfile } from "../../../../lib/profile"


export async function POST(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions)
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
		}

		let body: any
		try {
			body = await req.json()
		} catch {
			return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
		}

		const { username, email } = body

		try {
			await updateUserProfile(session.user.id, { username, email })
			return NextResponse.json({ success: true })
		} catch (err: any) {
			return NextResponse.json({ error: err.message || "Failed to update" }, { status: 400 })
		}
	} catch (err: any) {
		console.error(err)
		return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
	}
}
