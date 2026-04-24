"use client";
import { useState, useEffect, useCallback } from 'react';
import ChatInterface from './components/ChatInterface';
import { CHAT_PUBLIC_BASE } from '@/lib/chatPublicBase';
import type { User } from '@/types';

const AUTH_SERVICE_URL = process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || '/auth';

interface RoomParticipant {
  id: number;
  username: string;
}

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [friends, setFriends] = useState<User[]>([]);
  const [roomParticipants, setRoomParticipants] = useState<RoomParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);

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
      if (typeof token !== 'string' || token.length === 0) {
        setError('TOKEN_ACQUISITION_FAILED');
        return;
      }

      setAuthToken(token);
      setCurrentUser({
        id: parseInt(sessionData.user.id, 10),
        username: sessionData.user.name || 'Unknown',
        email: '',
      });

      const friendsRes = await fetch(`${CHAT_PUBLIC_BASE}/api/friends`, {
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!friendsRes.ok) {
        setError(friendsRes.status === 401 ? 'FRIEND_SYNC_UNAUTHORIZED' : 'FRIEND_SYNC_FAILED');
        return;
      }

      const friendsData = await friendsRes.json();
      setFriends(friendsData.friends || []);
    } catch (err) {
      console.error('Auth error:', err);
      setError('CONNECTION_TO_AUTH_SERVICE_FAILED');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFriendClick = (friend: User) => {
    setRoomParticipants([{ id: friend.id, username: friend.username }]);
  };

  const handleDragStart = (e: React.DragEvent, friend: User) => {
    e.dataTransfer.setData('text/friend-id', String(friend.id));
    e.dataTransfer.effectAllowed = 'copy';
    setDraggingId(friend.id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
  };

  const addParticipant = useCallback((friendId: number) => {
    if (!currentUser) return;
    if (friendId === currentUser.id) return;

    setRoomParticipants(prev => {
      if (prev.some(p => p.id === friendId)) return prev;
      const friend = friends.find(f => f.id === friendId);
      if (!friend) return prev;

      if (prev.length === 0) {
        return [{ id: friend.id, username: friend.username }];
      }
      return [...prev, { id: friend.id, username: friend.username }];
    });
  }, [currentUser, friends]);

  const removeParticipant = (participantId: number) => {
    setRoomParticipants(prev => {
      const next = prev.filter(p => p.id !== participantId);
      return next;
    });
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
            SPACE SUPREMACY
          </h1>
          <div className="border p-5 text-left" style={{ borderColor: 'rgba(255,34,68,0.4)', background: 'rgba(255,34,68,0.05)' }}>
            <p className="text-xs" style={{ color: 'var(--cyber-red)', fontFamily: 'Share Tech Mono, monospace' }}>
              ! {error || 'AUTHENTICATION_REQUIRED'}
            </p>
          </div>
          <a
            href="/"
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

  const hasRoom = roomParticipants.length > 0;

  return (
    <div className="min-h-screen relative z-10" style={{ background: 'var(--cyber-bg)' }}>
      {/* Header */}
      <header className="border-b sticky top-0 z-50 backdrop-blur-md" style={{ borderColor: 'var(--cyber-border)', background: 'rgba(13,13,26,0.85)' }}>
        <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, var(--cyber-cyan), var(--cyber-purple), transparent)', opacity: 0.6 }} />
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: 'var(--cyber-muted)', fontFamily: 'Share Tech Mono, monospace' }}>//</span>
            <span className="font-black tracking-widest text-lg" style={{ fontFamily: 'Orbitron, sans-serif', color: 'var(--cyber-cyan)', textShadow: '0 0 10px rgba(0,229,255,0.4)' }}>
              SPACE SUPREMACY
            </span>
            <span className="text-xs hidden sm:inline" style={{ color: 'var(--cyber-muted)', fontFamily: 'Share Tech Mono, monospace' }}>// COMMS</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--cyber-green)', boxShadow: '0 0 6px var(--cyber-green)' }} />
            <span className="text-xs" style={{ color: 'var(--cyber-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
              USER: <span style={{ color: 'var(--cyber-cyan)' }}>{currentUser.username}</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
          <span className="font-black tracking-widest text-lg" style={{ fontFamily: 'Orbitron, sans-serif', color: 'var(--violet, #8B008B)', textShadow: '0 0 10px rgba(64, 0, 255, 0.68)' }}>            
            <button
                onClick={() => {
                  window.location.href = '/';
                }}
                className="text-xs hover:underline"
              >
                HOME
              </button>
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">

        {/* System path */}
        <div className="text-xs tracking-widest pt-2" style={{ color: 'var(--cyber-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
          SYS://COMMS &gt; {hasRoom ? 'ACTIVE_CHANNEL' : 'SELECT_CHANNEL'}
          {hasRoom && roomParticipants.length > 1 && ' // GROUP_MODE'}
        </div>

        {/* Friends / Channels */}
        <div style={{ border: '1px solid var(--cyber-border)', background: 'var(--cyber-surface)', clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))' }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--cyber-border)' }}>
            <div className="flex items-center gap-3">
              <div className="w-1 h-4" style={{ background: 'var(--cyber-cyan)', boxShadow: '0 0 6px var(--cyber-cyan)' }} />
              <span className="text-xs font-bold tracking-widest" style={{ fontFamily: 'Orbitron, sans-serif', color: 'var(--cyber-cyan)' }}>
                NETWORK ({friends.length}_OPERATORS)
              </span>
            </div>
            {hasRoom && (
              <span className="text-xs animate-pulse" style={{ color: 'var(--cyber-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
                DRAG_OPERATOR_TO_CHANNEL ↓
              </span>
            )}
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
                  const isInRoom = roomParticipants.some(p => p.id === friend.id);
                  const isDragging = draggingId === friend.id;
                  return (
                    <button
                      key={friend.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, friend)}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleFriendClick(friend)}
                      className="p-4 text-left transition-all select-none"
                      style={{
                        border: `1px solid ${isInRoom ? 'var(--cyber-cyan)' : 'var(--cyber-border)'}`,
                        background: isInRoom ? 'rgba(0,229,255,0.1)' : 'transparent',
                        boxShadow: isInRoom ? '0 0 10px rgba(0,229,255,0.2)' : 'none',
                        fontFamily: 'Share Tech Mono, monospace',
                        opacity: isDragging ? 0.5 : 1,
                        cursor: 'grab',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: isInRoom ? 'var(--cyber-cyan)' : 'var(--cyber-muted)', boxShadow: isInRoom ? '0 0 4px var(--cyber-cyan)' : 'none' }} />
                        <span className="text-xs font-bold truncate" style={{ color: isInRoom ? 'var(--cyber-cyan)' : 'var(--cyber-text)' }}>
                          {friend.username}
                        </span>
                        <span className="text-xs ml-auto" style={{ color: 'var(--cyber-muted)', opacity: 0.5 }}>⠿</span>
                      </div>
                      {isInRoom && (
                        <span className="text-xs" style={{ color: 'var(--cyber-muted)' }}>IN_CHANNEL</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Active room participants strip */}
        {hasRoom && roomParticipants.length > 1 && (
          <div
            className="flex items-center gap-3 px-5 py-3"
            style={{
              border: '1px solid var(--cyber-border)',
              background: 'rgba(0,229,255,0.03)',
            }}
          >
            <span className="text-xs tracking-widest flex-shrink-0" style={{ color: 'var(--cyber-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
              ROOM:
            </span>
            <div className="flex flex-wrap gap-2">
              {roomParticipants.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1.5 px-2 py-1 text-xs"
                  style={{
                    border: '1px solid rgba(0,229,255,0.3)',
                    background: 'rgba(0,229,255,0.08)',
                    fontFamily: 'Share Tech Mono, monospace',
                    color: 'var(--cyber-cyan)',
                  }}
                >
                  {p.username}
                  <button
                    onClick={() => removeParticipant(p.id)}
                    className="hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--cyber-red)', opacity: 0.6, cursor: 'pointer' }}
                    title={`Remove ${p.username}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Chat window */}
        {hasRoom && (
          <ChatInterface
            myId={currentUser.id}
            myUsername={currentUser.username}
            participants={roomParticipants}
            authToken={authToken}
            onDrop={addParticipant}
          />
        )}

        {!hasRoom && friends.length > 0 && (
          <div className="py-8 text-center space-y-3" style={{ border: '1px dashed var(--cyber-border)' }}>
            <p className="text-xs" style={{ color: 'var(--cyber-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
              &gt; SELECT_AN_OPERATOR_TO_OPEN_CHANNEL
            </p>
            <p className="text-xs" style={{ color: 'var(--cyber-muted)', fontFamily: 'Share Tech Mono, monospace', opacity: 0.5 }}>
              Click to open 1:1 // Drag to channel for group comms
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
