/* Validates and parses a user ID from string or number format */
export function validateAndParseUserId(userId: string | number): number {
	if (!userId) {
		throw new Error('User ID is required');
	}

	const id = typeof userId === 'string' ? parseInt(userId, 10) : userId;

	if (Number.isNaN(id) || id <= 0) {
		throw new Error('Invalid user ID');
	}

	return id;
}

/* Parses a numeric ID from a URL path parameter string */
export function parseIdParam(id: string): number {
	const parsed = parseInt(id, 10);
	if (isNaN(parsed) || parsed <= 0) {
		throw new Error('Invalid ID');
	}
	return parsed;
}

/* Validates an addressee ID from request body */
export function validateAddresseeId(addresseeId: unknown): number {
	if (typeof addresseeId !== 'number' || !Number.isInteger(addresseeId) || addresseeId <= 0) {
		throw new Error('addresseeId must be a positive integer');
	}
	return addresseeId;
}

/* Validates email format */
export function validateEmail(email: string): void {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!email || !emailRegex.test(email)) {
		throw new Error('Invalid email format');
	}
}

/* Validates username: 3–32 chars, alphanumeric / hyphen / underscore only */
export function validateUsername(username: string): void {
	if (!username || username.length < 3 || username.length > 32) {
		throw new Error('Username must be between 3 and 32 characters');
	}
	if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
		throw new Error('Invalid username: only letters, numbers, hyphens, and underscores are allowed');
	}
}

/* Validates password length — bcrypt silently truncates at 72 bytes */
export function validatePassword(password: string): void {
	if (!password || password.length < 8) {
		throw new Error('Password must be at least 8 characters');
	}
	if (password.length > 72) {
		throw new Error('Password must be at most 72 characters');
	}
}
