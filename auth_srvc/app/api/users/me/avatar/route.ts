import { NextRequest } from 'next/server';
import { writeFile, unlink, rename, mkdir } from 'fs/promises';
import path from 'path';
import { requireAuthWithUserId } from '@/lib/proxy/auth';
import { prisma } from '@/prisma/prisma';
import { handleApiError, successResponse, errorResponse } from '@/lib/utils/api-response';
import { AVATAR_UPLOAD_DIR, AVATAR_URL_PREFIX, AVATAR_MAX_SIZE } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const ALLOWED_TYPES: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
};

// Ensure upload directory exists once at module load, not on every request
const uploadDirInit = mkdir(AVATAR_UPLOAD_DIR, { recursive: true });

// Simple in-memory rate limiter: max 10 uploads per user per 10 minutes
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const uploadCounts = new Map<number, { count: number; resetAt: number }>();

function checkRateLimit(userId: number): boolean {
	const now = Date.now();
	const entry = uploadCounts.get(userId);

	if (!entry || now > entry.resetAt) {
		uploadCounts.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
		return true;
	}

	if (entry.count >= RATE_LIMIT_MAX) return false;

	entry.count++;
	return true;
}

function hasValidImageMagicBytes(buffer: Buffer): boolean {
	// PNG: 89 50 4E 47
	if (buffer.length >= 4 &&
		buffer[0] === 0x89 && buffer[1] === 0x50 &&
		buffer[2] === 0x4e && buffer[3] === 0x47) return true;
	// JPEG: FF D8 FF
	if (buffer.length >= 3 &&
		buffer[0] === 0xff && buffer[1] === 0xd8 &&
		buffer[2] === 0xff) return true;
	return false;
}

export async function POST(req: NextRequest) {
	try {
		const { userId } = await requireAuthWithUserId();

		if (!checkRateLimit(userId)) {
			return errorResponse('Too many uploads — try again later', 429);
		}

		const formData = await req.formData();
		const file = formData.get('avatar');

		if (!file || !(file instanceof File)) {
			return errorResponse('No file provided', 400);
		}

		const ext = ALLOWED_TYPES[file.type];
		if (!ext) {
			return errorResponse('Only PNG and JPEG images are allowed', 400);
		}

		if (file.size > AVATAR_MAX_SIZE) {
			return errorResponse('File size must be under 2MB', 400);
		}

		const buffer = Buffer.from(await file.arrayBuffer());

		if (!hasValidImageMagicBytes(buffer)) {
			return errorResponse('File content does not match a valid PNG or JPEG', 400);
		}

		await uploadDirInit;

		// Fetch existing avatar so we can clean it up if the extension changes
		const existing = await prisma.user.findUnique({
			where: { id: userId },
			select: { avatarUrl: true },
		});
		const oldFilename = existing?.avatarUrl?.startsWith(AVATAR_URL_PREFIX)
			? path.basename(existing.avatarUrl)
			: null;

		const filename = `${userId}.${ext}`;
		const filepath = path.join(AVATAR_UPLOAD_DIR, filename);
		const tmpPath = path.join(AVATAR_UPLOAD_DIR, `${userId}.tmp`);

		// Write to a temp file first — if the DB update fails we can clean up
		// without leaving a corrupt file at the real path
		await writeFile(tmpPath, buffer);
		try {
			const avatarUrl = `${AVATAR_URL_PREFIX}${filename}`;
			await prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
			await rename(tmpPath, filepath);

			// Remove old file only after everything succeeds, and only if the
			// extension changed (same extension means rename already replaced it)
			if (oldFilename && oldFilename !== filename) {
				await unlink(path.join(AVATAR_UPLOAD_DIR, oldFilename)).catch(() => {});
			}

			return successResponse({ avatarUrl });
		} catch (e) {
			await unlink(tmpPath).catch(() => {});
			throw e;
		}
	} catch (error) {
		return handleApiError(error);
	}
}
