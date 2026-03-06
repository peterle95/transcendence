import bcrypt from "bcryptjs"
import { prisma } from "../prisma/prisma";

interface RegisterInput {
	email: string
	username: string
	password: string
}

export async function registerUser({email, username, password}: RegisterInput) {
	if (!email || !username || !password) {
		throw new Error("Missing required fields")
	}

	const existingUser = await prisma.user.findFirst({
		where: {
			OR: [{ email }, { username }],
		},
	})

	if (existingUser) {
		throw new Error("Email or username already exists")
	}

	/* We're using 10 salt rounds (2¹⁰ iterations of hashing) to encrypt the password, we can increase this if we want better security but it gets slower */
	const hashedPassword = await bcrypt.hash(password, 10)

	return prisma.user.create({
		data: {
			email,
			username,
			password: hashedPassword,
		},
	})
}
