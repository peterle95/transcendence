import path from 'path';
import { unlink } from 'fs/promises';
import { prisma } from "../prisma/prisma";
import { validateAndParseUserId, validateEmail, validateUsername } from "./utils/validation";
import { AVATAR_UPLOAD_DIR, AVATAR_URL_PREFIX } from "./constants";

export async function getUserById(userId: string | number) {
	const id = validateAndParseUserId(userId);

	const user = await prisma.user.findUnique({
		where: { id },
		select: { username: true, avatarUrl: true },
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
