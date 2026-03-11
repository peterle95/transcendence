import NextAuth from "next-auth"
import { authOptions } from "../../../../lib/auth-config"
import { handleOptionsRequest, getCorsHeaders } from "../../../../lib/cors"
import { NextRequest } from "next/server"

const handler = NextAuth(authOptions)

export async function OPTIONS(req: Request) {
	return handleOptionsRequest(req)
}

async function handlerWithCors(req: NextRequest, context: any) {
	const response = await handler(req, context)
	
	const origin = req.headers.get('origin')
	const corsHeaders = getCorsHeaders(origin)
	
	Object.entries(corsHeaders).forEach(([key, value]) => {
		response.headers.set(key, value)
	})
	
	return response
}

export { handlerWithCors as GET, handlerWithCors as POST }

/*
	[...nextauth] is a catch-all route: it matches any number of path segments 
	and these will all be handled by this page. (ex. POST /api/auth/signin)

	The NextAuth library generates a complete handler from a config object (the authOptions)
	these configs can be found in the lib/auth-config.ts file. 
*/
