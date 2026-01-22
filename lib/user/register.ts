import bcrypt from "bcryptjs"
import { prisma } from "../../src/app/prisma";

interface RegisterInput {
	email: string
	username: string
	password: string
}

export async function registerUser({
	email,
	username,
	password,
}: RegisterInput) {
	if (!email || !username || !password) {
		throw new Error("Missing required fields")
	}

	const existingUser = await prisma.user.findUnique({
		where: { email },
	})

	if (existingUser) {
		throw new Error("User already exists")
	}

	const hashedPassword = await bcrypt.hash(password, 10)

	return prisma.user.create({
		data: {
			email,
			username,
			password: hashedPassword,
			age: 18, //need to set as optional in schema
			largeNumber: 0 //need to set as optional in schema
		},
	})
}
