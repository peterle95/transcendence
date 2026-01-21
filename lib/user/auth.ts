import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { PrismaClient } from "@/src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })

const prisma = new PrismaClient({ adapter })

export const authOptions: NextAuthOptions = {
	adapter: PrismaAdapter(prisma),

	session: {
		strategy: "jwt",
	},

	providers: [
		CredentialsProvider({
			name: "Credentials",

			credentials: {
				email: { label: "Email", type: "email" },
				password: { label: "Password", type: "password" },
			},

			async authorize(credentials) {
				if (!credentials?.email || !credentials?.password) {
					return null
				}

				const user = await prisma.user.findUnique({
					where: { email: credentials.email },
				})

				if (!user) return null

				const isValid = await bcrypt.compare(
					credentials.password,
					user.password
				)

				if (!isValid) return null

				return {
					id: user.id.toString(),
					email: user.email,
					name: user.username,
				}
			},
		}),
	],

	callbacks: {
		async jwt({ token, user }) {
			if (user) {
				token.userId = user.id
				token.name = user.name
			}
			return token
		},

		async session({ session, token }) {
			if (session.user) {
				session.user.id = token.userId as string
				session.user.name = token.name
			}
			return session
		},
	},

	pages: {
		signIn: "/login",
	},

	secret: process.env.AUTH_SECRET,
}
