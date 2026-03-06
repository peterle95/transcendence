import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithUserId } from '@/lib/proxy/auth';
import { getUserById, updateUserProfile, deleteUserAccount } from '@/lib/profile';
import { handleApiError, successResponse, errorResponse } from '@/lib/utils/api-response';

export const dynamic = 'force-dynamic';

export async function GET() {
	try {
		const { session } = await requireAuthWithUserId();
		const user = await getUserById(session.user.id);

		if (!user) {
			return errorResponse('User not found', 404);
		}

		return successResponse(user);
	} catch (error) {
		return handleApiError(error);
	}
}

export async function DELETE() {
	try {
		const { userId } = await requireAuthWithUserId();
		await deleteUserAccount(userId);
		return NextResponse.json({ success: true, message: 'Account deleted' });
	} catch (error) {
		return handleApiError(error);
	}
}

export async function PATCH(req: NextRequest) {
	try {
		const { session } = await requireAuthWithUserId();

		const body = await req.json();
		const { username, email } = body;

		await updateUserProfile(session.user.id, { username, email });
		return successResponse({ success: true });
	} catch (error) {
		return handleApiError(error);
	}
}
