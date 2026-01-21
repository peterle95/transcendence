import NextAuth from "next-auth"
import { authOptions } from "@/lib/user/auth"

/* no logic here, just handles the request. The logic is in lib/user/auth.ts */
const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }