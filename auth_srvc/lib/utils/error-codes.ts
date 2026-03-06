/*
Centralized error code to HTTP status code mapping
Used by friend request operations
*/

export const ERROR_STATUS_MAP: Record<string, number> = {
	// Friend request errors
	INVALID_SELF_REQUEST: 400,
	REQUESTER_NOT_FOUND: 404,
	ADDRESSEE_NOT_FOUND: 404,
	RELATIONSHIP_BLOCKED: 403,
	REQUEST_ALREADY_PENDING: 409,
	ALREADY_FRIENDS: 409,

	// Friend operation errors
	REQUEST_NOT_FOUND: 404,
	UNAUTHORIZED: 403,
	INVALID_STATUS: 400,
	FRIENDSHIP_NOT_FOUND: 404,

	// Generic errors
	INTERNAL_ERROR: 500,
};

export function getStatusCode(errorCode?: string): number {
	if (!errorCode) {
		return 400;
	}
	return ERROR_STATUS_MAP[errorCode] || 400;
}
