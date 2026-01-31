import { NextResponse } from 'next/server';

export async function GET() {
    try {
        // Attempt to hit the Auth Service root or health check
        // Using the internal Docker network DNS name: auth_srvc
        const response = await fetch('http://auth_srvc:3000/api/health', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
        });

        if (!response.ok) {
            // Try root if health fails, just to see if it's alive
            const rootRes = await fetch('http://auth_srvc:3000/', { cache: 'no-store' });
            if (rootRes.ok) {
                return NextResponse.json({ message: "Auth Service Alive (root)", status: rootRes.status });
            }
            return NextResponse.json({ error: `Auth Service responded with ${response.status}` }, { status: response.status });
        }

        const data = await response.json().catch(() => ({ message: "OK (No JSON)" }));
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json(
            { error: 'Failed to connect to Auth Service', details: error.message },
            { status: 500 }
        );
    }
}
