"use client";
import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Message } from '@/types';

interface ChatInterfaceProps {
  myId: number;
  friendId: number;
}

// Generate room_id the same way as the server (smaller_larger)
function generateRoomId(userId1: number, userId2: number): string {
  const [smallerId, largerId] = [userId1, userId2].sort((a, b) => a - b);
  return `${smallerId}_${largerId}`;
}

export default function ChatInterface({ myId, friendId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  const roomId = generateRoomId(myId, friendId);

  // Socket.IO connection & room management
  useEffect(() => {
    // Connect to the Socket.IO server (same origin, HTTPS)
    const socket = io({
      rejectUnauthorized: false, // Allow self-signed certs in dev
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setIsConnected(true);
      socket.emit('join_room', roomId);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    // Listen for new messages from other users
    socket.on('receive_message', (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      socket.emit('leave_room', roomId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch initial chat history via REST API
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/chat/history?friend_id=${friendId}`, {
          method: 'GET',
          headers: {
            'x-mock-user-id': String(myId)
          }
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.messages) {
            setMessages(data.messages);
          }
        } else {
          console.error("Failed to fetch history:", await res.text());
        }
      } catch (err) {
        console.error("Fetch history error:", err);
      }
    };

    fetchHistory();
  }, [myId, friendId]);

  // Send message: REST API to persist + Socket.IO to broadcast
  const handleSend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const messageContent = inputText.trim();
    setInputText("");
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mock-user-id': String(myId)
        },
        body: JSON.stringify({
          receiver_id: friendId,
          content: messageContent
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.message) {
          // Add to local state immediately
          setMessages((prev) => [...prev, data.message]);

          // Broadcast via Socket.IO so other users see it instantly
          if (socketRef.current?.connected) {
            socketRef.current.emit('new_message', data.message);
          }
        }
      } else {
        const error = await res.json();
        console.error("Send error:", error);
        alert(`Failed to send message: ${error.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("Send error:", err);
      alert("Failed to send message. Check console for details.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] border rounded-lg bg-white shadow-2xl">
      <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 border-b font-bold text-white rounded-t-lg">
        <div className="flex items-center justify-between">
          <span>Chatting with User {friendId}</span>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-1 rounded-full ${isConnected
                ? 'bg-green-400/30 text-green-100'
                : 'bg-red-400/30 text-red-100'
              }`}>
              {isConnected ? '● Live' : '○ Connecting...'}
            </span>
            <span className="text-xs bg-white/20 px-3 py-1 rounded-full">
              You are User {myId}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.sender_id === myId;
            return (
              <div key={msg._id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] p-3 rounded-xl text-sm shadow-sm ${isMe
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-white border border-gray-200 rounded-bl-none text-gray-800'
                  }`}>
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  {msg.timestamp && (
                    <span className={`text-xs mt-1 block ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
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

      <form onSubmit={handleSend} className="p-4 border-t bg-white flex gap-2 rounded-b-lg">
        <input
          className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message..."
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !inputText.trim()}
          className="bg-blue-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
