import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/proxy/auth';
import { getUserByUsername } from '@/lib/profile';
import { handleApiError, successResponse, errorResponse } from '@/lib/utils/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
	try {
		await requireAuth();

		const { searchParams } = new URL(req.url);
		const username = searchParams.get('username');

		if (!username) {
			return errorResponse('Username parameter is required', 400);
		}

		const user = await getUserByUsername(username);

		if (!user) {
			return errorResponse('User not found', 404);
		}

		return successResponse(user);
	} catch (error) {
		return handleApiError(error);
	}
}
