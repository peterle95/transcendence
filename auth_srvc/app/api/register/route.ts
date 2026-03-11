import { registerUser } from "../../../lib/register"
import { handleOptionsRequest, jsonWithCors } from "../../../lib/cors"

export async function OPTIONS(req: Request) {
	return handleOptionsRequest(req)
}

export async function POST(req: Request) {
	try {
		let data
		try {
			data = await req.json()
		} catch {
			return jsonWithCors({ error: "Invalid JSON body" }, req, { status: 400 })
		}
		await registerUser(data)
		return jsonWithCors({ success: true }, req)
	} catch (err) {
		if (err instanceof Error) {
			if (err.message === "Missing required fields") {
				return jsonWithCors({ error: err.message }, req, { status: 400 })
			}
			if (err.message === "Email or username already exists") {
				return jsonWithCors({ error: err.message }, req, { status: 409 })
			}
		}
		return jsonWithCors({ error: "Registration failed" }, req, { status: 500 })
	}
}