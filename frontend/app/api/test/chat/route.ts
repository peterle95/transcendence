import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const response = await fetch('http://chat_srvc:3001/api/health', {
            method: 'GET',
            cache: 'no-store',
        });

        // Fallback if no health endpoint
        if (!response.ok) {
            try {
                const rootRes = await fetch('http://chat_srvc:3001/', { cache: 'no-store' });
                return NextResponse.json({ message: "Chat Service Alive (root)", status: rootRes.status });
            } catch (e) { /* ignore */ }
        }

        const data = await response.json().catch(() => ({ message: "OK (No JSON)" }));
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json(
            { error: 'Failed to connect to Chat Service', details: error.message },
            { status: 500 }
        );
    }
}
