import path from 'path';
import { unlink } from 'fs/promises';
import { Prisma } from '@prisma/client';
import { prisma } from "../prisma/prisma";
import { validateAndParseUserId, validateEmail, validateUsername } from "./utils/validation";
import { AVATAR_UPLOAD_DIR, AVATAR_URL_PREFIX } from "./constants";

/* This doesn't return the email for privacy reasons, and also returns the stats but we could change that */
export async function getUserById(userId: string | number) {
	const id = validateAndParseUserId(userId);

	const user = await prisma.user.findUnique({
		where: { id },
		select: { username: true, avatarUrl: true, wins: true, losses: true, points: true, shotsFired: true, shotsHit: true, shipsLost: true, shipsDestroyed: true },
	})

	return user
}

/* Same here */
export async function getUserByUsername(username: string) {
	if (!username) throw new Error("Username is required")

	const user = await prisma.user.findUnique({
		where: { username },
		select: {
			id: true,
			username: true,
		},
	})

	if (!user) {
		return null
	}

	return user
}

export async function deleteUserAccount(userId: number): Promise<void> {
	const user = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });

	// Delete avatar file before removing the DB record — if we delete the record
	// first and then crash, the file path is permanently lost
	if (user?.avatarUrl?.startsWith(AVATAR_URL_PREFIX)) {
		const filename = path.basename(user.avatarUrl);
		await unlink(path.join(AVATAR_UPLOAD_DIR, filename)).catch(() => {});
	}

	await prisma.user.delete({ where: { id: userId } });
}

export interface UserStats {
	wins?: number;
	losses?: number;
	points?: number;
	shotsFired?: number;
	shotsHit?: number;
	shipsLost?: number;
	shipsDestroyed?: number;
}

export async function updateUserStatsById(userId: string | number, stats: UserStats) {
	const id = validateAndParseUserId(userId);

	const fields = ['wins', 'losses', 'points', 'shotsFired', 'shotsHit', 'shipsLost', 'shipsDestroyed'] as const;
	const data: Partial<Record<typeof fields[number], number>> = {};

	for (const field of fields) {
		const value = stats[field];
		if (value === undefined) continue;
		if (!Number.isInteger(value) || value < 0) {
			throw new Error(`${field} must be a non-negative integer`);
		}
		data[field] = value;
	}

	if (Object.keys(data).length === 0) {
		throw new Error('No valid stats fields provided');
	}

	// Prisma throws P2025 if the record does not exist — no need to pre-fetch
	try {
		await prisma.user.update({ where: { id }, data });
	} catch (e) {
		if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
			throw new Error('User not found');
		}
		throw e;
	}
}

export async function updateUserProfile(userId: string | number, data: { username: string; email: string }) {
	if (!data.username || !data.email) {
		throw new Error("Username and email are required");
	}

	validateEmail(data.email);
	validateUsername(data.username);

	const id = validateAndParseUserId(userId);

	// select only the fields we need — avoids returning the hashed password
	const updatedUser = await prisma.user.update({
		where: { id },
		data: { username: data.username, email: data.email },
		select: { id: true, username: true, email: true, avatarUrl: true },
	})

	return updatedUser
}
