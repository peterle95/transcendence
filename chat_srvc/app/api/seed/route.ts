import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { success: false, error: 'DATABASE_URL is not configured' },
      { status: 400 }
    );
  }

  if (!prisma) {
    return NextResponse.json(
      { success: false, error: 'Prisma client is not initialized' },
      { status: 500 }
    );
  }

  const users = [
    { username: 'alice', email: 'alice@example.com' },
    { username: 'bob', email: 'bob@example.com' },
  ];

  const created = await prisma.$transaction(
    users.map((u) =>
      prisma.user.upsert({
        where: { email: u.email },
        update: { username: u.username },
        create: {
          username: u.username,
          email: u.email,
          password: 'placeholder',
        },
        select: {
          id: true,
          username: true,
          email: true,
        },
      })
    )
  );

  return NextResponse.json({ success: true, created });
}
