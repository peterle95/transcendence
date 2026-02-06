"use client";
import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Message } from '@/types';

interface ChatInterfaceProps {
  myId: number;
  friendId: number;
}

export default function ChatInterface({ myId, friendId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // Initialize Socket connection
  useEffect(() => {
    // Connect to the socket server (same host)
    const socket = io({
      path: '/socket.io', // Standard Socket.io path
      extraHeaders: {
        'x-mock-user-id': String(myId)
      },
      auth: {
        userId: String(myId)
      }
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setIsConnected(true);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setIsConnected(false);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    // Listen for incoming messages
    socket.on('new_message', (message: Message) => {
      console.log('New message received:', message);
      // Only add if it belongs to this conversation
      if (
        (message.sender_id === myId && message.receiver_id === friendId) ||
        (message.sender_id === friendId && message.receiver_id === myId)
      ) {
        setMessages((prev) => [...prev, message]);
      }
    });

    // Listen for confirmation of sent messages
    socket.on('message_sent', (data: { message: Message, clientTempId?: string }) => {
        // If we implemented optimistic UI, we would update the temporary message here.
    });

    return () => {
      socket.disconnect();
    };
  }, [myId, friendId]);

  // Fetch initial history
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
        console.error("History fetch error:", err);
      }
    };

    fetchHistory();
  }, [myId, friendId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!inputText.trim() || !isConnected || !socketRef.current) return;

    const content = inputText.trim();
    setInputText("");

    // Emit message via socket
    socketRef.current.emit('send_message', {
      receiverId: friendId,
      content: content
    });
  };

  return (
    <div className="flex flex-col h-[600px] border rounded-lg bg-white shadow-2xl">
      <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 border-b font-bold text-white rounded-t-lg">
        <div className="flex items-center justify-between">
          <span>Chatting with User {friendId}</span>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
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
                <div className={`max-w-[70%] p-3 rounded-xl text-sm shadow-sm ${
                  isMe
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
          placeholder={isConnected ? "Type a message..." : "Connecting..."}
          disabled={!isConnected}
        />
        <button
          type="submit"
          disabled={!isConnected || !inputText.trim()}
          className="bg-blue-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </form>
    </div>
  );
}
