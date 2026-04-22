"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { CHAT_PUBLIC_BASE, CHAT_SOCKET_PATH } from '@/lib/chatPublicBase';
import type { Message } from '@/types';

const PARTICIPANT_COLORS = [
  '#d8b8ff',
  '#ff6b6b',
  '#4ecdc4',
  '#ffe66d',
  '#f38181',
  '#95e1d3',
  '#aa96da',
  '#ffd93d',
];

interface Participant {
  id: number;
  username: string;
}

interface ChatInterfaceProps {
  myId: number;
  myUsername: string;
  participants: Participant[];
  authToken: string;
  onDrop?: (friendId: number) => void;
}

type MessageWithUsername = Message & { sender_username?: string };

function generateRoomId(myId: number, participants: Participant[]): string {
  const allIds = [myId, ...participants.map(p => p.id)];
  const sorted = [...new Set(allIds)].sort((a, b) => a - b);
  if (sorted.length === 2) {
    return `${sorted[0]}_${sorted[1]}`;
  }
  return `group_${sorted.join('_')}`;
}

export default function ChatInterface({ myId, myUsername, participants, authToken, onDrop }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<MessageWithUsername[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  const isGroup = participants.length > 1;
  const roomId = generateRoomId(myId, participants);

  const colorMap = useRef<Map<number, string>>(new Map());
  useEffect(() => {
    const map = new Map<number, string>();
    participants.forEach((p, i) => {
      map.set(p.id, PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length]);
    });
    colorMap.current = map;
  }, [participants]);

  const usernameMap = useRef<Map<number, string>>(new Map());
  useEffect(() => {
    const map = new Map<number, string>();
    map.set(myId, myUsername);
    participants.forEach(p => map.set(p.id, p.username));
    usernameMap.current = map;
  }, [myId, myUsername, participants]);

  function getSenderColor(senderId: number): string {
    if (senderId === myId) return 'var(--cyber-cyan)';
    return colorMap.current.get(senderId) || '#d8b8ff';
  }

  function getSenderName(msg: MessageWithUsername): string {
    if (msg.sender_username) return msg.sender_username;
    return usernameMap.current.get(msg.sender_id) || `USER_${msg.sender_id}`;
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchHistory = useCallback(async () => {
    try {
      const queryParam = isGroup
        ? `room_id=${encodeURIComponent(roomId)}`
        : `friend_id=${participants[0].id}`;
      const res = await fetch(`${CHAT_PUBLIC_BASE}/api/chat/history?${queryParam}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.messages) {
          setMessages((prev) => {
            const combined = [...data.messages, ...prev];
            const uniqueMap = new Map();
            combined.forEach((msg: MessageWithUsername) => { if (msg._id) uniqueMap.set(msg._id, msg); });
            return Array.from(uniqueMap.values()).sort((a: any, b: any) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
          });
        }
      }
    } catch (err) {
      console.error("Fetch history error:", err);
    }
  }, [participants, authToken, roomId, isGroup]);

  const roomIdRef = useRef(roomId);
  const fetchHistoryRef = useRef(fetchHistory);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);
  useEffect(() => { fetchHistoryRef.current = fetchHistory; }, [fetchHistory]);

  useEffect(() => {
    const origin = window.location.origin;
    const socketOptions: Record<string, unknown> = {
      path: CHAT_SOCKET_PATH,
      auth: { token: authToken },
      transports: ['websocket', 'polling'],
    };
    if (process.env.NODE_ENV === 'development') {
      (socketOptions as any).rejectUnauthorized = false;
    }
    const socket = io(origin, socketOptions as any);
    socketRef.current = socket;

    socket.on('receive_message', (message: MessageWithUsername) => {
      setMessages((prev) => {
        if (prev.some(m => m._id === message._id)) return prev;
        return [...prev, message];
      });
    });

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join_room', roomIdRef.current);
      fetchHistoryRef.current();
    });

    socket.on('connect_error', () => setIsConnected(false));
    socket.on('disconnect', () => setIsConnected(false));

    return () => {
      socket.emit('leave_room', roomIdRef.current);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [authToken]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;

    socket.emit('join_room', roomId);
    setMessages([]);
    fetchHistoryRef.current();

    return () => {
      socket.emit('leave_room', roomId);
    };
  }, [roomId]);

  const handleSend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const messageContent = inputText.trim();
    setInputText("");
    setIsLoading(true);

    try {
      const bodyPayload: any = { content: messageContent };
      if (isGroup) {
        bodyPayload.room_id = roomId;
      } else {
        bodyPayload.receiver_id = participants[0].id;
      }

      const res = await fetch(`${CHAT_PUBLIC_BASE}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify(bodyPayload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.message) {
          setMessages((prev) => {
            if (prev.some(m => m._id === data.message._id)) return prev;
            return [...prev, data.message];
          });
        }
      } else {
        const error = await res.json();
        setSendError(error.error || 'Transmission failed');
      }
    } catch (err) {
      console.error("Send error:", err);
      setSendError('Transmission failed — check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLaunchGame = async () => {
    const gameUrl = '/game/games/space_supremacy/index.html?mode=online';
    for (const p of participants) {
      try {
        await fetch(`${CHAT_PUBLIC_BASE}/api/game-invite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
          body: JSON.stringify({ targetUserId: p.id }),
        });
      } catch (err) {
        console.error(`Failed to invite ${p.username}:`, err);
      }
    }
    window.open(gameUrl, '_blank');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDropOnChat = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const friendId = parseInt(e.dataTransfer.getData('text/friend-id'), 10);
    if (!isNaN(friendId) && friendId !== myId && onDrop) {
      onDrop(friendId);
    }
  };

  const participantLabel = isGroup
    ? participants.map(p => p.username).join(', ')
    : `CHANNEL::${participants[0]?.id}`;

  return (
    <div
      className="flex flex-col"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDropOnChat}
      style={{
        height: '600px',
        border: `1px solid ${isDragOver ? 'var(--cyber-cyan)' : 'var(--cyber-border)'}`,
        background: 'var(--cyber-surface)',
        clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))',
        boxShadow: isDragOver ? '0 0 20px rgba(0,229,255,0.3), inset 0 0 20px rgba(0,229,255,0.1)' : 'none',
        transition: 'box-shadow 0.2s, border-color 0.2s',
      }}
    >
      {/* Header bar */}
      <div
        className="flex-shrink-0 px-5 py-3 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--cyber-border)', background: 'rgba(0,229,255,0.05)' }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-1 h-4 flex-shrink-0" style={{ background: 'var(--cyber-cyan)', boxShadow: '0 0 6px var(--cyber-cyan)' }} />
          <span className="text-xs font-bold tracking-widest truncate" style={{ fontFamily: 'Orbitron, sans-serif', color: 'var(--cyber-cyan)' }}>
            {participantLabel}
          </span>
          {isGroup && (
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--cyber-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
              [{participants.length + 1}_USERS]
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          {participants.length >= 1 && (
            <button
              onClick={handleLaunchGame}
              className="px-3 py-1.5 text-xs font-bold tracking-widest transition-all hover:scale-105"
              style={{
                fontFamily: 'Orbitron, sans-serif',
                border: '1px solid var(--cyber-green)',
                color: 'var(--cyber-green)',
                background: 'rgba(0,255,100,0.08)',
                boxShadow: '0 0 8px rgba(0,255,100,0.2)',
                cursor: 'pointer',
              }}
            >
              LAUNCH_GAME
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: isConnected ? 'var(--cyber-green)' : 'var(--cyber-red)',
                boxShadow: isConnected ? '0 0 6px var(--cyber-green)' : '0 0 6px var(--cyber-red)',
              }}
            />
            <span className="text-xs" style={{ color: isConnected ? 'var(--cyber-green)' : 'var(--cyber-red)', fontFamily: 'Share Tech Mono, monospace' }}>
              {isConnected ? 'LIVE' : 'CONNECTING'}
            </span>
          </div>
        </div>
      </div>

      {/* Participant color legend for group chats */}
      {isGroup && (
        <div className="flex-shrink-0 px-5 py-2 border-b flex flex-wrap gap-3" style={{ borderColor: 'var(--cyber-border)', background: 'rgba(0,0,0,0.3)' }}>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--cyber-cyan)', boxShadow: '0 0 4px var(--cyber-cyan)' }} />
            <span className="text-xs" style={{ color: 'var(--cyber-cyan)', fontFamily: 'Share Tech Mono, monospace' }}>{myUsername}</span>
          </span>
          {participants.map((p) => {
            const color = getSenderColor(p.id);
            return (
              <span key={p.id} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 4px ${color}` }} />
                <span className="text-xs" style={{ color, fontFamily: 'Share Tech Mono, monospace' }}>{p.username}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Drop overlay */}
      {isDragOver && (
        <div
          className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
          style={{ background: 'rgba(0,229,255,0.08)' }}
        >
          <div className="text-center space-y-2 animate-pulse">
            <div className="text-4xl" style={{ color: 'var(--cyber-cyan)' }}>+</div>
            <p className="text-xs tracking-widest font-bold" style={{ fontFamily: 'Orbitron, sans-serif', color: 'var(--cyber-cyan)' }}>
              DROP_TO_ADD_OPERATOR
            </p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-5 space-y-3"
        style={{ background: 'rgba(7,7,15,0.6)' }}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <p className="text-xs" style={{ color: 'var(--cyber-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
                &gt; CHANNEL_EMPTY // BEGIN_TRANSMISSION
              </p>
              {isGroup && (
                <p className="text-xs" style={{ color: 'var(--cyber-muted)', fontFamily: 'Share Tech Mono, monospace', opacity: 0.6 }}>
                  GROUP_ROOM // {participants.length + 1}_OPERATORS
                </p>
              )}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.sender_id === myId;
            const senderColor = getSenderColor(msg.sender_id);
            const borderColor = isMe ? 'rgba(0,229,255,0.4)' : `${senderColor}44`;
            const bgColor = isMe ? 'rgba(0,229,255,0.08)' : `${senderColor}0f`;
            return (
              <div key={msg._id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[70%] px-4 py-2.5"
                  style={{
                    fontFamily: 'Share Tech Mono, monospace',
                    fontSize: '0.8rem',
                    border: `1px solid ${borderColor}`,
                    background: bgColor,
                    clipPath: isMe
                      ? 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)'
                      : 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
                  }}
                >
                  {(isGroup || !isMe) && (
                    <span className="text-xs block mb-1 font-bold" style={{ color: isMe ? 'var(--cyber-cyan)' : senderColor }}>
                      {isMe ? myUsername : getSenderName(msg)}
                    </span>
                  )}
                  <p className="whitespace-pre-wrap break-words" style={{ color: isMe ? 'var(--cyber-text)' : senderColor }}>
                    {msg.content}
                  </p>
                  {msg.timestamp && (
                    <span className="text-xs mt-1 block" style={{ color: 'var(--cyber-muted)' }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { setSendError(null); handleSend(e); }}
        className="flex-shrink-0 flex flex-col gap-2 p-4 border-t"
        style={{ borderColor: 'var(--cyber-border)', background: 'rgba(13,13,26,0.9)' }}
      >
        <input
          className="flex-1 px-4 py-2.5 text-xs bg-transparent outline-none transition-all"
          style={{
            fontFamily: 'Share Tech Mono, monospace',
            border: '1px solid var(--cyber-border)',
            color: 'var(--cyber-text)',
          }}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="> TYPE_MESSAGE..."
          disabled={isLoading}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--cyber-cyan)'; e.currentTarget.style.boxShadow = '0 0 8px rgba(0,229,255,0.2)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--cyber-border)'; e.currentTarget.style.boxShadow = 'none'; }}
        />
        <button
          type="submit"
          disabled={isLoading || !inputText.trim()}
          className="px-6 py-2.5 text-xs font-bold tracking-widest transition-all"
          style={{
            fontFamily: 'Orbitron, sans-serif',
            border: '1px solid var(--cyber-cyan)',
            color: isLoading || !inputText.trim() ? 'var(--cyber-muted)' : 'var(--cyber-cyan)',
            background: isLoading || !inputText.trim() ? 'transparent' : 'rgba(0,229,255,0.05)',
            cursor: isLoading || !inputText.trim() ? 'not-allowed' : 'pointer',
            boxShadow: isLoading || !inputText.trim() ? 'none' : '0 0 8px rgba(0,229,255,0.15)',
            borderColor: isLoading || !inputText.trim() ? 'var(--cyber-border)' : 'var(--cyber-cyan)',
          }}
        >
          {isLoading ? 'TX...' : 'SEND'}
        </button>
        {sendError && (
          <p className="text-xs" style={{ color: 'var(--cyber-red)', fontFamily: 'Share Tech Mono, monospace' }}>
            ! {sendError}
          </p>
        )}
      </form>
    </div>
  );
}
