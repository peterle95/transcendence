import { NextRequest } from 'next/server';
import { requireAuthWithUserIdFromRequest } from '@/lib/proxy/auth';
import { getFriends } from '@/lib/friend';
import { handleApiError, successResponse } from '@/lib/utils/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
	try {
		const { userId } = await requireAuthWithUserIdFromRequest(req);
		const result = await getFriends(userId);

		if (!result.success) {
			throw new Error(result.message);
		}

		return successResponse({ success: true, data: result.data });
	} catch (error) {
		return handleApiError(error);
	}
}
