import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithUserId } from '@/lib/proxy/auth';
import { acceptFriendRequest, rejectFriendRequest, blockFriendRequest } from '@/lib/friend';
import { handleApiError, errorResponse } from '@/lib/utils/api-response';
import { parseIdParam } from '@/lib/utils/validation';
import { getStatusCode } from '@/lib/utils/error-codes';

export const dynamic = 'force-dynamic';

export async function PATCH(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { userId } = await requireAuthWithUserId();
		const { id } = await params;
		const friendshipId = parseIdParam(id);

		const body = await req.json();
		const { action } = body;

		if (!action || !['accept', 'reject', 'block'].includes(action)) {
			return errorResponse('Action must be "accept", "reject", or "block"', 400);
		}

		let result;
		if (action === 'accept') {
			result = await acceptFriendRequest(friendshipId, userId);
		} else if (action === 'reject') {
			result = await rejectFriendRequest(friendshipId, userId);
		} else {
			result = await blockFriendRequest(friendshipId, userId);
		}

		if (!result.success) {
			const statusCode = getStatusCode(result.error);

			return NextResponse.json(
				{
					success: false,
					message: result.message,
					error: result.error
				},
				{ status: statusCode }
			);
		}

		return NextResponse.json({
			success: true,
			message: result.message,
			data: result.data
		});
	} catch (error) {
		return handleApiError(error);
	}
}
