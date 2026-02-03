import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        status: 'healthy',
        service: 'game-service',
        timestamp: new Date().toISOString()
    });
}
