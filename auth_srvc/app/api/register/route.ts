import { NextRequest, NextResponse } from "next/server"
import { registerUser } from "../../../lib/register"
import { handleApiError, errorResponse } from "../../../lib/utils/api-response"

export const dynamic = 'force-dynamic';

// IP-based rate limit: 10 registration attempts per IP per hour
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const registrationCounts = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: NextRequest): string {
	// x-forwarded-for is set by reverse proxies; fall back to a constant in
	// direct Docker deployments where no proxy is in front of the service.
	return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'direct';
}

function checkRegistrationRateLimit(ip: string): boolean {
	const now = Date.now();
	const entry = registrationCounts.get(ip);

	if (!entry || now > entry.resetAt) {
		registrationCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
		return true;
	}

	if (entry.count >= RATE_LIMIT_MAX) return false;

	entry.count++;
	return true;
}

export async function POST(req: NextRequest) {
	if (!checkRegistrationRateLimit(getClientIp(req))) {
		return errorResponse('Too many registration attempts — try again later', 429);
	}

	try {
		const data = await req.json()
		await registerUser(data)
		return NextResponse.json({ success: true })
	} catch (error) {
		return handleApiError(error)
	}
}
