import NextAuth from "next-auth"
import { authOptions } from "../../../../lib/auth-config"

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }

/*
	[...nextauth] is a catch-all route: it matches any number of path segments 
	and these will all be handled by this page. (ex. POST /api/auth/signin)

	The NextAuth library generates a complete handler from a config object (the authOptions)
	these configs can be found in the lib/auth-config.ts file. 
*/
