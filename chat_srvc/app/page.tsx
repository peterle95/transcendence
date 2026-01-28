"use client";
import { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import type { User } from '@/types';

export default function DashboardPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [activeChatFriend, setActiveChatFriend] = useState<number | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const selectedUser = users.find((u) => u.id === selectedUserId);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Chat Service</h1>

        {/* User Selection */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Select Your Identity</h2>
          
          {users.length === 0 ? (
            <p className="text-gray-400">No users found</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 mb-4">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => {
                    setSelectedUserId(user.id);
                    setActiveChatFriend(null);
                  }}
                  className={`p-4 rounded-lg border-2 transition text-left ${
                    selectedUserId === user.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  <div className="font-semibold">@{user.username}</div>
                  <div className="text-sm opacity-75">{user.email}</div>
                </button>
              ))}
            </div>
          )}

          {selectedUser && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-sm text-blue-900">Currently as: <strong>@{selectedUser.username}</strong> (ID: {selectedUser.id})</p>
            </div>
          )}
        </div>

        {/* Chat with Other Users */}
        {selectedUser && (
          <>
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Chat With User</h2>
              <div className="grid grid-cols-2 gap-3">
                {users
                  .filter((u) => u.id !== selectedUser.id)
                  .map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setActiveChatFriend(user.id)}
                      className={`p-4 rounded-lg border-2 transition text-left ${
                        activeChatFriend === user.id
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      <div className="font-semibold">@{user.username}</div>
                      <div className="text-sm opacity-75">{user.email}</div>
                    </button>
                  ))}
              </div>
            </div>

            {activeChatFriend && (
              <ChatInterface 
                myId={selectedUser.id} 
                friendId={activeChatFriend} 
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}