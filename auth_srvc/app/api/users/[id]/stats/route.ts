import { NextRequest } from 'next/server';
import { updateUserStatsById } from '@/lib/profile';
import { handleApiError, successResponse, errorResponse } from '@/lib/utils/api-response';
import { UnauthorizedError } from '@/lib/utils/api-response';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const secret = req.headers.get('x-internal-secret');
		if (!secret || secret !== process.env.INTERNAL_SERVICE_SECRET) {
			throw new UnauthorizedError('Invalid or missing internal secret');
		}

		const { id } = await params;
		const body = await req.json();
		const { wins, losses, points, shotsFired, shotsHit, shipsLost, shipsDestroyed } = body;

		await updateUserStatsById(id, { wins, losses, points, shotsFired, shotsHit, shipsLost, shipsDestroyed });
		return successResponse({ success: true });
	} catch (error) {
		return handleApiError(error);
	}
}
