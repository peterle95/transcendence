import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { AVATAR_UPLOAD_DIR } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ filename: string }> }
) {
	const { filename } = await params;

	// Only allow filenames like "42.jpg" or "42.png" — prevents path traversal
	if (!/^\d+\.(jpg|jpeg|png)$/.test(filename)) {
		return new NextResponse('Not found', { status: 404 });
	}

	const filepath = path.join(AVATAR_UPLOAD_DIR, filename);

	try {
		const file = await readFile(filepath);
		const ext = path.extname(filename).slice(1);
		const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

		return new NextResponse(file, {
			headers: {
				'Content-Type': contentType,
				'X-Content-Type-Options': 'nosniff',
				'Content-Disposition': 'inline',
				'Cache-Control': 'public, max-age=3600',
			},
		});
	} catch {
		return new NextResponse('Not found', { status: 404 });
	}
}
