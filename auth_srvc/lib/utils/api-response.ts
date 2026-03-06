import { NextResponse } from 'next/server';

/* Custom error class for unauthorized access */
export class UnauthorizedError extends Error {
	constructor(message = 'Not authenticated') {
		super(message);
		this.name = 'UnauthorizedError';
	}
}

/*
Handles API errors consistently across all routes
Maps different error types to appropriate HTTP status codes
*/
export function handleApiError(error: unknown) {
	console.error('API Error:', error);

	if (error instanceof UnauthorizedError) {
		return NextResponse.json(
			{ error: error.message },
			{ status: 401 }
		);
	}

	if (error instanceof Error) {
		const message = error.message;

		if (
			message.includes('required') ||
			message.includes('Invalid') ||
			message.includes('must be')
		) {
			return NextResponse.json(
				{ error: message },
				{ status: 400 }
			);
		}

		if (message.includes('not found')) {
			return NextResponse.json(
				{ error: message },
				{ status: 404 }
			);
		}

		if (message.includes('not authorized')) {
			return NextResponse.json(
				{ error: message },
				{ status: 403 }
			);
		}

		return NextResponse.json(
			{ error: message },
			{ status: 500 }
		);
	}

	return NextResponse.json(
		{ error: 'Internal server error' },
		{ status: 500 }
	);
}

export function successResponse<T>(data: T, status = 200) {
	return NextResponse.json(data, { status });
}
export function errorResponse(message: string, status: number) {
	return NextResponse.json({ error: message }, { status });
}
