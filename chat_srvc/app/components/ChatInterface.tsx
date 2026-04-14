"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { CHAT_PUBLIC_BASE } from '@/lib/chatPublicBase';
import type { Message } from '@/types';

interface ChatInterfaceProps {
  myId: number;
  friendId: number;
  authToken: string;
}

function generateRoomId(userId1: number, userId2: number): string {
  const [smallerId, largerId] = [userId1, userId2].sort((a, b) => a - b);
  return `${smallerId}_${largerId}`;
}

export default function ChatInterface({ myId, friendId, authToken }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  const roomId = generateRoomId(myId, friendId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${CHAT_PUBLIC_BASE}/api/chat/history?friend_id=${friendId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.messages) {
          setMessages((prev) => {
            const combined = [...data.messages, ...prev];
            const uniqueMap = new Map();
            combined.forEach((msg: Message) => { if (msg._id) uniqueMap.set(msg._id, msg); });
            return Array.from(uniqueMap.values()).sort((a: any, b: any) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
          });
        }
      }
    } catch (err) {
      console.error("Fetch history error:", err);
    }
  }, [friendId, authToken]);

  // Keep refs so the socket lifecycle effect can always call the latest versions
  // without needing to recreate the socket when friendId/fetchHistory changes.
  const roomIdRef = useRef(roomId);
  const fetchHistoryRef = useRef(fetchHistory);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);
  useEffect(() => { fetchHistoryRef.current = fetchHistory; }, [fetchHistory]);

  // Socket lifecycle — only recreated when authToken changes, not on every friend switch.
  useEffect(() => {
    const opts: any = { auth: { token: authToken } };
    if (process.env.NODE_ENV === 'development') {
      opts.rejectUnauthorized = false;
    }
    if (typeof window !== 'undefined') {
      // Connect specifically to /chat/socket.io/ to allow Nginx to route to the chat container
      opts.path = '/chat/socket.io/';
    }
    const socket = io(opts);
    socketRef.current = socket;

    socket.on('receive_message', (message: Message) => {
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

  // Room switching — leave old room, join new one, reload history.
  // Runs when the user selects a different friend without recreating the socket.
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
      const res = await fetch(`${CHAT_PUBLIC_BASE}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ receiver_id: friendId, content: messageContent }),
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

  return (
    <div
      className="flex flex-col"
      style={{
        height: '600px',
        border: '1px solid var(--cyber-border)',
        background: 'var(--cyber-surface)',
        clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))',
      }}
    >
      {/* Header bar */}
      <div
        className="flex-shrink-0 px-5 py-3 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--cyber-border)', background: 'rgba(0,229,255,0.05)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-1 h-4" style={{ background: 'var(--cyber-cyan)', boxShadow: '0 0 6px var(--cyber-cyan)' }} />
          <span className="text-xs font-bold tracking-widest" style={{ fontFamily: 'Orbitron, sans-serif', color: 'var(--cyber-cyan)' }}>
            CHANNEL::{friendId}
          </span>
        </div>
        <div className="flex items-center gap-4">
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
          <span className="text-xs" style={{ color: 'var(--cyber-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
            ID:{myId}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-5 space-y-3"
        style={{ background: 'rgba(7,7,15,0.6)' }}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs" style={{ color: 'var(--cyber-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
              &gt; CHANNEL_EMPTY // BEGIN_TRANSMISSION
            </p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.sender_id === myId;
            return (
              <div key={msg._id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[70%] px-4 py-2.5"
                  style={{
                    fontFamily: 'Share Tech Mono, monospace',
                    fontSize: '0.8rem',
                    border: `1px solid ${isMe ? 'rgba(0,229,255,0.4)' : 'rgba(157,0,255,0.3)'}`,
                    background: isMe ? 'rgba(0,229,255,0.08)' : 'rgba(157,0,255,0.06)',
                    clipPath: isMe
                      ? 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)'
                      : 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
                  }}
                >
                  <p className="whitespace-pre-wrap break-words" style={{ color: isMe ? 'var(--cyber-text)' : '#d8b8ff' }}>
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
