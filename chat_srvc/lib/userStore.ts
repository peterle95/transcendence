/**
 * 
 * mock for demo data would come from auth_srvc via api calls
 * TODO:
 * (- Replace getUserById(), getAllUsers() with fetch() calls to auth_srvc)
 * (- Replace getFriends() with calls to friendship endpoints)
 * - Remove this file entirely and use real authentication
 */

import type { User, UserStore, UserHelpers } from '@/types';

export const userStore: UserStore = {
  users: [
    { id: 1, username: "alice", email: "alice@example.com" },
    { id: 2, username: "bob", email: "bob@example.com" }
  ],
  nextUserId: 3,
  
  // { userId: [friendId1, friendId2, ...] }
  friendships: {
    1: [2], 
    2: [1]  
  }
};

export const userHelpers: UserHelpers = {
 
  getAllUsers(): User[] {
    return userStore.users;
  },


  getUserById(userId: number): User | undefined {
    return userStore.users.find(u => u.id === userId);
  },

  createUser(username: string, email: string): User {
    const existingUser = userStore.users.find(
      u => u.username === username || u.email === email
    );

    if (existingUser) {
      throw new Error('Username or email already exists');
    }

    const newUser: User = {
      id: userStore.nextUserId++,
      username,
      email
    };

    userStore.users.push(newUser);
    userStore.friendships[newUser.id] = [];

    return newUser;
  },


  getFriends(userId: number): User[] {
    const friendIds = userStore.friendships[userId] || [];
    return friendIds
      .map(friendId => userStore.users.find(u => u.id === friendId))
      .filter((user): user is User => user !== undefined);
  },


  addFriendship(senderId: number, receiverId: number): boolean {
    //validate users exist
    const senderExists = userStore.users.find(u => u.id === senderId);
    const receiverExists = userStore.users.find(u => u.id === receiverId);

    if (!senderExists || !receiverExists) {
      throw new Error('One or both users do not exist');
    }

    //if no friendship arrays, create them
    if (!userStore.friendships[senderId]) {
      userStore.friendships[senderId] = [];
    }
    if (!userStore.friendships[receiverId]) {
      userStore.friendships[receiverId] = [];
    }

    if (userStore.friendships[senderId].includes(receiverId)) {
      throw new Error('Already friends');
    }
    userStore.friendships[senderId].push(receiverId);
    userStore.friendships[receiverId].push(senderId);

    return true;
  }
};
