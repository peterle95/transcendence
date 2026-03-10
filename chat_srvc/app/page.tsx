"use client";
import { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import type { User } from '@/types';

const AUTH_SERVICE_URL = process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || 'http://localhost:3000';

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [friends, setFriends] = useState<User[]>([]);
  const [activeChatFriend, setActiveChatFriend] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authenticate();
  }, []);

  const authenticate = async () => {
    try {
      const sessionRes = await fetch(`${AUTH_SERVICE_URL}/api/auth/session`, {
        credentials: 'include',
      });
      const sessionData = await sessionRes.json();

      if (!sessionData?.user?.id) {
        setError('Not authenticated. Please log in at the main app first.');
        setIsLoading(false);
        return;
      }

      const tokenRes = await fetch(`${AUTH_SERVICE_URL}/api/auth/token`, {
        credentials: 'include',
      });

      if (!tokenRes.ok) {
        setError('Failed to obtain auth token.');
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
      setError('Failed to connect to authentication service.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Authenticating...</p>
        </div>
      </div>
    );
  }

  if (error || !currentUser || !authToken) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 max-w-md text-center">
          <p className="text-red-600 mb-4">{error || 'Authentication required'}</p>
          <a
            href={AUTH_SERVICE_URL.replace(/:\d+$/, ':3003')}
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Chat</h1>
          <div className="bg-blue-50 border border-blue-200 rounded px-3 py-1.5">
            <p className="text-sm text-blue-900">Logged in as <strong>@{currentUser.username}</strong></p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Friends</h2>
          {friends.length === 0 ? (
            <p className="text-gray-400">No friends yet. Add friends from the main app.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {friends.map((friend) => (
                <button
                  key={friend.id}
                  onClick={() => setActiveChatFriend(friend.id)}
                  className={`p-4 rounded-lg border-2 transition text-left ${
                    activeChatFriend === friend.id
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  <div className="font-semibold">@{friend.username}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {activeChatFriend && (
          <ChatInterface
            myId={currentUser.id}
            friendId={activeChatFriend}
            authToken={authToken}
          />
        )}
      </div>
    </div>
  );
}
