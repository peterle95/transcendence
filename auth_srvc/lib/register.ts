import bcrypt from "bcryptjs"
import { prisma } from "../prisma/prisma";
import { ConflictError } from "./utils/api-response";
import { validateEmail, validateUsername, validatePassword } from "./utils/validation";

interface RegisterInput {
	email: string
	username: string
	password: string
}

export async function registerUser({ email, username, password }: RegisterInput) {
	if (!email || !username || !password) {
		throw new Error("Missing required fields")
	}

	// Validate format and constraints — throws descriptive Error on failure
	validateEmail(email)
	validateUsername(username)
	validatePassword(password)

	const existingUser = await prisma.user.findFirst({
		where: {
			OR: [{ email }, { username }],
		},
	})

	if (existingUser) {
		// Use a generic message — do not reveal whether the email or username is taken
		throw new ConflictError("Registration failed")
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
