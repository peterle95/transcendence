'use client';

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
    <main className="flex-1 flex items-center justify-center p-4 min-h-screen bg-gradient-to-br from-purple-900 via-black to-blue-900">
      <div className="w-full max-w-6xl">
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
          <Link href="/chat/"> {/* this will point to the right port via nginx */}
            <div
              onMouseEnter={() => setHoveredCard('chat')}
              onMouseLeave={() => setHoveredCard(null)}
              className={`cursor-pointer rounded-2xl p-8 transition-all duration-300 transform ${
                hoveredCard === 'chat'
                  ? 'scale-105 shadow-2xl shadow-blue-500/50'
                  : 'shadow-lg'
              } bg-gradient-to-br from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700`}
            >
              <div className="text-6xl mb-4">💬</div>
              <h2 className="text-3xl font-bold text-white mb-2">Chat</h2>
              <p className="text-blue-100 mb-4">
                Connect with other players in real-time. Share strategies, make friends, and stay in touch.
              </p>
              <div className="inline-block px-6 py-2 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition">
                Enter Chat →
              </div>
            </div>
          </Link>

          {/* Game Card */}
          <Link href="/game/">
            <div
              onMouseEnter={() => setHoveredCard('game')}
              onMouseLeave={() => setHoveredCard(null)}
              className={`cursor-pointer rounded-2xl p-8 transition-all duration-300 transform ${
                hoveredCard === 'game'
                  ? 'scale-105 shadow-2xl shadow-purple-500/50'
                  : 'shadow-lg'
              } bg-gradient-to-br from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700`}
            >
              <div className="text-6xl mb-4">🕹️</div>
              <h2 className="text-3xl font-bold text-white mb-2">Play Game</h2>
              <p className="text-purple-100 mb-4">
                Keep Control of the Galaxy by annihilating challengers Space Fleets.
              </p>
              <div className="inline-block px-6 py-2 bg-white text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition">
                Play Now →
              </div>
            </div>
          </Link>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-3 gap-4 text-center">
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
        </div>
      </div>
    </main>
  );
}
