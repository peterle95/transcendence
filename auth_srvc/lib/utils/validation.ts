/* Validates and parses a user ID from string or number format */
export function validateAndParseUserId(userId: string | number): number {
	if (!userId) {
		throw new Error('User ID is required');
	}

	const id = typeof userId === 'string' ? parseInt(userId, 10) : userId;

	if (Number.isNaN(id)) {
		throw new Error('Invalid user ID');
	}

	return id;
}

/* Parses a numeric ID from a URL path parameter string */
export function parseIdParam(id: string): number {
	const parsed = parseInt(id, 10);
	if (isNaN(parsed)) {
		throw new Error('Invalid ID');
	}
	return parsed;
}

/* Validates an addressee ID from request body */
export function validateAddresseeId(addresseeId: unknown): number {
	if (!addresseeId) {
		throw new Error('addresseeId is required');
	}

	if (typeof addresseeId !== 'number') {
		throw new Error('addresseeId must be a number');
	}

	return addresseeId;
}
