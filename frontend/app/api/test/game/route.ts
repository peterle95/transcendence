import { NextResponse } from 'next/server';

export async function GET() {
    try {
        // Game service is on 3002
        const response = await fetch('http://game_srvc:3002/', {
            cache: 'no-store',
        });

        const data = await response.json().catch(() => ({ message: "Game Service Alive", status: response.status }));
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json(
            { error: 'Failed to connect to Game Service', details: error.message },
            { status: 500 }
        );
    }
}
