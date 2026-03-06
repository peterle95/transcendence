import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/proxy/auth';
import { getUserById } from '@/lib/profile';
import { handleApiError, successResponse, errorResponse } from '@/lib/utils/api-response';

export const dynamic = 'force-dynamic';

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		await requireAuth();
		const { id } = await params;
		const user = await getUserById(id);

		if (!user) {
			return errorResponse('User not found', 404);
		}

		return successResponse(user);
	} catch (error) {
		return handleApiError(error);
	}
}
