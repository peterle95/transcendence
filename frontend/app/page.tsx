'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';



export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/auth/session`,
          { credentials: 'include' }
        );
        const data = await res.json();
        if (!data?.user?.id) {
          router.push('/login');
          return;
        }
        setIsAuthenticated(true);
      } catch {
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, [router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-blue-900" />
    );
  }

  return (
<main className="flex-1 flex items-center justify-center p-4 min-h-screen relative">

      <div className="w-full max-w-6xl relative z-10">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-4">
            SPACE SUPREMACY
          </h1>
          {/* <p className="text-xl text-purple-300">
            Connect, Chat, and Play Amazing Games
          </p> */}
        </div>

        {/* Main Cards Grid */}
        <div className="grid md:grid-cols-2 gap-8 mx-auto max-w-4xl">
          {/* Chat Card */}
          <Link href="/chat/">
            <div
              onMouseEnter={() => setHoveredCard('chat')}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '20px',
                padding: '32px',
                backdropFilter: 'blur(20px)',
                transition: 'all 0.3s ease',
                transform: hoveredCard === 'chat' ? 'scale(1.05)' : 'scale(1)',
                boxShadow: hoveredCard === 'chat' ? '0 24px 80px rgba(59,130,246,0.3)' : '0 12px 40px rgba(0,0,0,0.2)',
                cursor: 'pointer'
              }}
            >
              <div className="text-6xl mb-4">💬</div>
              <h2 className="text-3xl font-bold text-white mb-2">Chat</h2>
              <p className="text-blue-100 mb-4 opacity-80">
                Connect with other players in real-time. Share strategies, make friends, and stay in touch.
              </p>
              <div style={{
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: '#fff',
                padding: '8px 24px',
                borderRadius: '8px',
                fontWeight: 'bold',
                display: 'inline-block'
              }}>
                Enter Chat →
              </div>
            </div>
          </Link>

          {/* Game Card */}
          <Link href="/game/">
            <div
              onMouseEnter={() => setHoveredCard('game')}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '20px',
                padding: '32px',
                backdropFilter: 'blur(20px)',
                transition: 'all 0.3s ease',
                transform: hoveredCard === 'game' ? 'scale(1.05)' : 'scale(1)',
                boxShadow: hoveredCard === 'game' ? '0 24px 80px rgba(124,58,237,0.3)' : '0 12px 40px rgba(0,0,0,0.2)',
                cursor: 'pointer'
              }}
            >
              <div className="text-6xl mb-4">🕹️</div>
              <h2 className="text-3xl font-bold text-white mb-2">Play Game</h2>
              <p className="text-purple-100 mb-4 opacity-80">
                Keep Control of the Galaxy by annihilating challengers Space Fleets.
              </p>
              <div style={{
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                color: '#fff',
                padding: '8px 24px',
                borderRadius: '8px',
                fontWeight: 'bold',
                display: 'inline-block'
              }}>
                Play Now →
              </div>
            </div>
          </Link>
        </div>

        {/* Stats */}
        {/*<div className="mt-16 grid grid-cols-3 gap-4 text-center">
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="text-3xl font-bold text-white">1000+</div>
            <p className="text-gray-300">Active Players</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="text-3xl font-bold text-white">5+</div>
            <p className="text-gray-300">Games Available</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="text-3xl font-bold text-white">24/7</div>
            <p className="text-gray-300">Always Online</p>
          </div>
        </div>*/}
      </div>
    </main>
  );
}
