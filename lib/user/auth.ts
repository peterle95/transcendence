import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "../../src/app/prisma";

export const authOptions: NextAuthOptions = {
	

	session: {
		strategy: "jwt",
	},

	providers: [ /* currently it's only with credentials, but we can add Google etc here also later if we want */
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

				return { /* this is was will be in the user object, which we put in the generated token, we can add more things in here as well from the user db, see below */
					id: user.id.toString(),
					email: user.email,
					name: user.username,
				}
			},
		}),
	],

	callbacks: {
		async jwt({ token, user }) {
			if (user) {  /* if we need more info about the user from the token, we can add it here */
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
