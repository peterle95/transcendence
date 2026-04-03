'use client'; 

import { useEffect, useRef } from 'react';

// this function is used to mock the backend API calls
// it enables to bypass the authentication process for dev purposes
export default function DevAuthBypass() {
	const initRef = useRef(false);

	useEffect(() => {
		// Only run once and only in development
		if (process.env.NODE_ENV !== 'development' || initRef.current) return;
		initRef.current = true;

		if (typeof window !== 'undefined') {
			console.log('🚀 DevAuthBypass activated! Mocking backend fetches.');
			const originalFetch = window.fetch;

			window.fetch = async (...args) => {
				const requestUrl = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
				
				// Mock Session
				if (requestUrl.includes('/api/auth/session')) {
					return new Response(JSON.stringify({
						user: { id: 999, username: 'SpaceCommander', email: 'dev@space.com' }
					}), { status: 200, headers: { 'Content-Type': 'application/json' } });
				}

				// Mock /api/users/me or /api/users/[id]
				if (requestUrl.includes('/api/users/') && !requestUrl.includes('search')) {
					return new Response(JSON.stringify({
						id: 999,
						username: 'SpaceCommander',
						email: 'dev@space.com',
						avatarUrl: null,
						wins: 42,
						losses: 7,
						points: 9000,
						shotsFired: 0,
						shotsHit: 0,
						shipsLost: 0,
						shipsDestroyed: 0,
						isWinner: 1
					}), { status: 200, headers: { 'Content-Type': 'application/json' } });
				}

				// Mock regular friends list
				if (requestUrl.endsWith('/api/friends') || requestUrl.includes('/api/friends?')) {
					return new Response(JSON.stringify({
						data: [
							{ id: 1000, username: 'AlienFriend', wins: 5, losses: 2, points: 1500 }
						]
					}), { status: 200, headers: { 'Content-Type': 'application/json' } });
				}

				// Mock friend requests list
				if (requestUrl.includes('/api/friends/requests')) {
					return new Response(JSON.stringify({
						data: []
					}), { status: 200, headers: { 'Content-Type': 'application/json' } });
				}

				return originalFetch(...args);
			};
		}
	}, []);

	return null;
}
