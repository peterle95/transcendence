import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "../prisma/prisma";

export const authOptions: NextAuthOptions = {

	/* the "strategy" (how we handle sessions) - a signed JWT cookie (no db reequired) */
	session: {
		strategy: "jwt",
	},

	/*
	the Credential Provider checks that a user exists
	currently it's only with credentials, but we can add Google etc here also later if we want
	*/
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

				return { /* this is what will be in the user object, which we put in the generated token, we can add more things in here as well from the user db, see below */
					id: user.id.toString(),
					email: user.email,
					name: user.username,
				}
			},
		}),
	],


	/* 
		callbacks : when a token is created, it adds information to it (in our case userid & username)
		the token is the source of truth, and what is being secured with the AUTH_SECRET
		The session is then called in client facing things, to get some user information
	*/
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

	/* instead of using the default nextauth page, we override it here so that we use ouw own login page */
	pages: {
		signIn: "/login",
		error: "/login",
	},

	/* this is the enryption for the JWT */
	secret: process.env.AUTH_SECRET,

	/* this configures the session cookie, and adding some security to it */
	cookies: {
		sessionToken: {
			name: `next-auth.session-token`,
			options: {
				httpOnly: true,
				sameSite: 'lax',
				path: '/',
				secure: process.env.NODE_ENV === 'production',
			},
		},
	},
}

