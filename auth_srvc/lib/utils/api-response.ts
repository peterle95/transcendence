import { NextResponse } from 'next/server';

export class UnauthorizedError extends Error {
	constructor(message = 'Not authenticated') {
		super(message);
		this.name = 'UnauthorizedError';
	}
}

export class ValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ValidationError';
	}
}

export class ConflictError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ConflictError';
	}
}

/*
Handles API errors consistently across all routes.
Maps typed error classes to HTTP status codes first, then falls back to
keyword matching for errors from Prisma and other third-party libraries.
The 500 catch-all always returns a generic message — never the raw Error.message —
to avoid leaking internal details (DB connection strings, stack info, etc.).
*/
export function handleApiError(error: unknown) {
	console.error('API Error:', error);

	if (error instanceof UnauthorizedError) {
		return NextResponse.json({ error: error.message }, { status: 401 });
	}

	if (error instanceof ValidationError) {
		return NextResponse.json({ error: error.message }, { status: 400 });
	}

	if (error instanceof ConflictError) {
		return NextResponse.json({ error: error.message }, { status: 409 });
	}

	if (error instanceof Error) {
		const message = error.message;

		if (message.includes('required') || message.includes('Invalid') || message.includes('must be')) {
			return NextResponse.json({ error: message }, { status: 400 });
		}

		if (message.includes('not found')) {
			return NextResponse.json({ error: message }, { status: 404 });
		}

		if (message.includes('not authorized')) {
			return NextResponse.json({ error: message }, { status: 403 });
		}

		// Do not expose raw error.message to clients — log it above and return generic text
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}

	return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

export function successResponse<T>(data: T, status = 200) {
	return NextResponse.json(data, { status });
}

export function errorResponse(message: string, status: number) {
	return NextResponse.json({ error: message }, { status });
}
