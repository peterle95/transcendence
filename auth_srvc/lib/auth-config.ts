import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "../prisma/prisma";
import { SESSION_TOKEN_COOKIE_NAME } from "./auth-cookie";

// Simple in-memory brute-force guard: lock an account for 15 minutes after
// 10 consecutive failed login attempts. Resets on a successful login.
// NOTE: in-memory only — resets on server restart. For production, back this
// with Redis or a DB table.
const LOCKOUT_THRESHOLD = 10;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const failedLogins = new Map<string, { count: number; resetAt: number }>();

function isLoginLocked(email: string): boolean {
	const now = Date.now();
	const entry = failedLogins.get(email);
	if (!entry || now > entry.resetAt) return false;
	return entry.count >= LOCKOUT_THRESHOLD;
}

function recordFailedLogin(email: string): void {
	const now = Date.now();
	const entry = failedLogins.get(email);
	if (!entry || now > entry.resetAt) {
		failedLogins.set(email, { count: 1, resetAt: now + LOCKOUT_WINDOW_MS });
	} else {
		entry.count++;
	}
}

function clearFailedLogins(email: string): void {
	failedLogins.delete(email);
}

export const authOptions: NextAuthOptions = {

	/* the "strategy" (how we handle sessions) - a signed JWT cookie (no db required) */
	session: {
		strategy: "jwt",
		maxAge: 24 * 60 * 60, // 1 day
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

				const email = credentials.email.toLowerCase().trim();

				if (isLoginLocked(email)) {
					return null;
				}

				const user = await prisma.user.findUnique({
					where: { email },
				})

				if (!user) {
					recordFailedLogin(email);
					return null
				}

				const isValid = await bcrypt.compare(
					credentials.password,
					user.password
				)

				if (!isValid) {
					recordFailedLogin(email);
					return null
				}

				clearFailedLogins(email);

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

	/* instead of using the default nextauth page, we override it here so that we use our own login page */
	pages: {
		signIn: "/login",
		error: "/login",
	},

	/* this is the encryption for the JWT */
	secret: process.env.AUTH_SECRET,

	/* this configures the session cookie, and adding some security to it */
	cookies: {
		sessionToken: {
			name: SESSION_TOKEN_COOKIE_NAME,
			options: {
				httpOnly: true,
				// 'strict' prevents the cookie from being sent on cross-site navigations,
				// which is correct for an API-only service.
				sameSite: 'lax',
				path: '/',
				secure: true, // TEMP: ....
			},
		},
	},
}

// NOTE on JWT invalidation (M-8):
// JWTs are not stored server-side and cannot be revoked directly. Account
// deletion is handled by requireAuth() in lib/proxy/auth.ts, which re-checks
// the DB on every request. If the user row is gone, requireAuth throws
// UnauthorizedError. This DB check MUST NOT be removed — it is the only
// invalidation mechanism for outstanding tokens.
