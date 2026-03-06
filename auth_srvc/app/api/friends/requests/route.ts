import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithUserId } from '@/lib/proxy/auth';
import { sendFriendRequest, getPendingRequests } from '@/lib/friend';
import { handleApiError, successResponse } from '@/lib/utils/api-response';
import { validateAddresseeId } from '@/lib/utils/validation';
import { getStatusCode } from '@/lib/utils/error-codes';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
	try {
		const { userId } = await requireAuthWithUserId();

		const body = await req.json();
		const addresseeId = validateAddresseeId(body.addresseeId);

		const result = await sendFriendRequest(userId, addresseeId);

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

		return NextResponse.json(
			{
				success: true,
				message: result.message,
				data: result.data
			},
			{ status: 201 }
		);
	} catch (error) {
		return handleApiError(error);
	}
}

export async function GET() {
	try {
		const { userId } = await requireAuthWithUserId();
		const result = await getPendingRequests(userId);

		if (!result.success) {
			throw new Error(result.message);
		}

		return successResponse({
			success: true,
			data: result.data
		});
	} catch (error) {
		return handleApiError(error);
	}
}
