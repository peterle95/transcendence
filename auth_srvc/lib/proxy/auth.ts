import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth-config';
import { UnauthorizedError } from '../utils/api-response';


/* THese two functions are authentication guards, basically checking that the user reuqest the resource is authenticated */
export async function requireAuth() {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
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

	const userId = parseInt(session.user.id);
	if (isNaN(userId)) {
		throw new Error('Invalid user ID in session');
	}

	return { session, userId };
}
