"use client";
import { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import type { User } from '@/types';

// Changed fallback from http://localhost:3000 to /auth to work in production behind Nginx
const AUTH_SERVICE_URL = process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || '/auth';

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [friends, setFriends] = useState<User[]>([]);
  const [activeChatFriend, setActiveChatFriend] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { authenticate(); }, []);

  const authenticate = async () => {
    try {
      const sessionRes = await fetch(`${AUTH_SERVICE_URL}/api/auth/session`, { credentials: 'include' });
      const sessionData = await sessionRes.json();

      if (!sessionData?.user?.id) {
        setError('NOT_AUTHENTICATED // Please log in at the main platform first.');
        setIsLoading(false);
        return;
      }

      const tokenRes = await fetch(`${AUTH_SERVICE_URL}/api/auth/token`, { credentials: 'include' });
      if (!tokenRes.ok) {
        setError('TOKEN_ACQUISITION_FAILED');
        setIsLoading(false);
        return;
      }

      const { token } = await tokenRes.json();
      setAuthToken(token);
      setCurrentUser({
        id: parseInt(sessionData.user.id, 10),
        username: sessionData.user.name || 'Unknown',
        email: '',
      });

      const friendsRes = await fetch('/api/friends', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (friendsRes.ok) {
        const friendsData = await friendsRes.json();
        setFriends(friendsData.friends || []);
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError('CONNECTION_TO_AUTH_SERVICE_FAILED');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative z-10" style={{ background: 'var(--cyber-bg)' }}>
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--cyber-cyan)', borderTopColor: 'transparent' }} />
          <p className="text-xs tracking-widest animate-pulse" style={{ color: 'var(--cyber-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
            AUTHENTICATING...
          </p>
        </div>
      </div>
    );
  }

  if (error || !currentUser || !authToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative z-10" style={{ background: 'var(--cyber-bg)' }}>
        <div className="w-full max-w-md text-center space-y-6">
          <h1 className="text-3xl font-black tracking-widest" style={{ fontFamily: 'Orbitron, sans-serif', color: 'var(--cyber-cyan)', textShadow: '0 0 20px rgba(0,229,255,0.4)' }}>
            SPACE WARS
          </h1>
          <div className="border p-5 text-left" style={{ borderColor: 'rgba(255,34,68,0.4)', background: 'rgba(255,34,68,0.05)' }}>
            <p className="text-xs" style={{ color: 'var(--cyber-red)', fontFamily: 'Share Tech Mono, monospace' }}>
              ! {error || 'AUTHENTICATION_REQUIRED'}
            </p>
          </div>
          <a
            href={AUTH_SERVICE_URL.replace(/:\d+$/, '/')} // :3003 -> /, this now works with nginx
            className="inline-block text-xs tracking-widest px-6 py-3 transition-all"
            style={{
              fontFamily: 'Orbitron, sans-serif',
              border: '1px solid var(--cyber-cyan)',
              color: 'var(--cyber-cyan)',
              background: 'rgba(0,229,255,0.05)',
            }}
          >
            RETURN_TO_HUB →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative z-10" style={{ background: 'var(--cyber-bg)' }}>
      {/* Header */}
      <header className="border-b sticky top-0 z-50 backdrop-blur-md" style={{ borderColor: 'var(--cyber-border)', background: 'rgba(13,13,26,0.85)' }}>
        <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, var(--cyber-cyan), var(--cyber-purple), transparent)', opacity: 0.6 }} />
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: 'var(--cyber-muted)', fontFamily: 'Share Tech Mono, monospace' }}>//</span>
            <span className="font-black tracking-widest text-lg" style={{ fontFamily: 'Orbitron, sans-serif', color: 'var(--cyber-cyan)', textShadow: '0 0 10px rgba(0,229,255,0.4)' }}>
              SPACE WARS
            </span>
            <span className="text-xs hidden sm:inline" style={{ color: 'var(--cyber-muted)', fontFamily: 'Share Tech Mono, monospace' }}>// COMMS</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--cyber-green)', boxShadow: '0 0 6px var(--cyber-green)' }} />
            <span className="text-xs" style={{ color: 'var(--cyber-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
              USER: <span style={{ color: 'var(--cyber-cyan)' }}>{currentUser.username}</span>
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">

        {/* System path */}
        <div className="text-xs tracking-widest pt-2" style={{ color: 'var(--cyber-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
          SYS://COMMS &gt; SELECT_CHANNEL
        </div>

        {/* Friends / Channels */}
        <div style={{ border: '1px solid var(--cyber-border)', background: 'var(--cyber-surface)', clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))' }}>
          <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: 'var(--cyber-border)' }}>
            <div className="w-1 h-4" style={{ background: 'var(--cyber-cyan)', boxShadow: '0 0 6px var(--cyber-cyan)' }} />
            <span className="text-xs font-bold tracking-widest" style={{ fontFamily: 'Orbitron, sans-serif', color: 'var(--cyber-cyan)' }}>
              NETWORK ({friends.length}_OPERATORS)
            </span>
          </div>

          <div className="p-5">
            {friends.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <div className="text-3xl" style={{ color: 'var(--cyber-muted)', opacity: 0.3 }}>◈</div>
                <p className="text-xs" style={{ color: 'var(--cyber-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
                  NO_OPERATORS_IN_NETWORK
                </p>
                <p className="text-xs" style={{ color: 'var(--cyber-muted)', fontFamily: 'Share Tech Mono, monospace', opacity: 0.6 }}>
                  Add friends from the main platform to begin
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {friends.map((friend) => {
                  const isActive = activeChatFriend === friend.id;
                  return (
                    <button
                      key={friend.id}
                      onClick={() => setActiveChatFriend(friend.id)}
                      className="p-4 text-left transition-all"
                      style={{
                        border: `1px solid ${isActive ? 'var(--cyber-cyan)' : 'var(--cyber-border)'}`,
                        background: isActive ? 'rgba(0,229,255,0.1)' : 'transparent',
                        boxShadow: isActive ? '0 0 10px rgba(0,229,255,0.2)' : 'none',
                        fontFamily: 'Share Tech Mono, monospace',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: isActive ? 'var(--cyber-cyan)' : 'var(--cyber-muted)', boxShadow: isActive ? '0 0 4px var(--cyber-cyan)' : 'none' }} />
                        <span className="text-xs font-bold truncate" style={{ color: isActive ? 'var(--cyber-cyan)' : 'var(--cyber-text)' }}>
                          {friend.username}
                        </span>
                      </div>
                      {isActive && (
                        <span className="text-xs" style={{ color: 'var(--cyber-muted)' }}>CHANNEL_OPEN</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Chat window */}
        {activeChatFriend && (
          <ChatInterface
            myId={currentUser.id}
            friendId={activeChatFriend}
            authToken={authToken}
          />
        )}

        {!activeChatFriend && friends.length > 0 && (
          <div className="py-8 text-center" style={{ border: '1px dashed var(--cyber-border)' }}>
            <p className="text-xs" style={{ color: 'var(--cyber-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
              &gt; SELECT_AN_OPERATOR_TO_OPEN_CHANNEL
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
