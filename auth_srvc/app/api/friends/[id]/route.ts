import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithUserId } from '@/lib/proxy/auth';
import { removeFriendship } from '@/lib/friend';
import { handleApiError } from '@/lib/utils/api-response';
import { parseIdParam } from '@/lib/utils/validation';
import { getStatusCode } from '@/lib/utils/error-codes';

export const dynamic = 'force-dynamic';

export async function DELETE(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { userId } = await requireAuthWithUserId();
		const { id } = await params;
		const friendId = parseIdParam(id);

		const result = await removeFriendship(userId, friendId);

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
			message: result.message
		});
	} catch (error) {
		return handleApiError(error);
	}
}
