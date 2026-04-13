// Before Bearer support for service-to-service calls, this file only imported:
//   getServerSession from 'next-auth/next'
// and exported requireAuth + requireAuthWithUserId (unchanged below).
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '../auth-config';
import { UnauthorizedError } from '../utils/api-response';
import { prisma } from '../../prisma/prisma';


/* THese two functions are authentication guards, basically checking that the user reuqest the resource is authenticated */
export async function requireAuth() {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		throw new UnauthorizedError();
	}

	const userId = parseInt(session.user.id);
	if (isNaN(userId)) {
		throw new UnauthorizedError();
	}

	const userExists = await prisma.user.findUnique({
		where: { id: userId },
		select: { id: true },
	});

	if (!userExists) {
		throw new UnauthorizedError();
	}

	return session;
}

/*
In addition to the one above, this function checks user by ID, which is useful for the user-specific content
(for example, it changes how a profile page is shown to it's owner vs some other user)
*/
export async function requireAuthWithUserId() {
	const session = await requireAuth();

	// requireAuth already validates that session.user.id is a valid integer
	const userId = parseInt(session.user.id);

	return { session, userId };
}

/**
 * Same as requireAuthWithUserId but accepts the incoming request so Bearer tokens
 * issued by GET /api/auth/token work (used when chat_srvc or other services call
 * auth with Authorization only — no session cookie on that hop).
 */
export async function requireAuthWithUserIdFromRequest(req: NextRequest) {
	const authHeader = req.headers.get('Authorization');
	const bearerToken =
		authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';

	if (bearerToken) {
		const syntheticReq = new NextRequest('http://localhost', {
			headers: { cookie: `next-auth.session-token=${bearerToken}` },
		});
		const decoded = await getToken({
			req: syntheticReq,
			secret: process.env.AUTH_SECRET!,
		});

		if (decoded?.userId != null) {
			const rawId = decoded.userId as string | number;
			const userId = typeof rawId === 'number' ? rawId : parseInt(String(rawId), 10);

			if (!isNaN(userId)) {
				const userExists = await prisma.user.findUnique({
					where: { id: userId },
					select: { id: true },
				});

				if (userExists) {
					return { session: null, userId };
				}
			}
		}

		throw new UnauthorizedError();
	}

	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		throw new UnauthorizedError();
	}

	const userId = parseInt(session.user.id, 10);
	if (isNaN(userId)) {
		throw new UnauthorizedError();
	}

	const userExists = await prisma.user.findUnique({
		where: { id: userId },
		select: { id: true },
	});

	if (!userExists) {
		throw new UnauthorizedError();
	}

	return { session, userId };
}
