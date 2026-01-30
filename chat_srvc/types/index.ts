/**
 * Type Definitions for Chat Service
 * 
 * These types represent the mock user system.
 * When Auth Service is implemented, replace these with types from the Auth Service API.
 */

export interface User {
  id: number;
  username: string;
  email: string;
}

export interface CreateUserRequest {
  username: string;
  email: string;
}

export interface CreateUserResponse {
  success: boolean;
  user?: User;
  error?: string;
}

// Friend types
export interface FriendshipStore {
  [userId: number]: number[];
}

export interface AddFriendRequest {
  senderId: number;
  receiverId: number;
}

export interface FriendsResponse {
  success: boolean;
  friends?: User[];
  error?: string;
}

// Message types
export interface Message {
  _id: string;
  sender_id: number;
  receiver_id: number;
  content: string;
  room_id: string;
  timestamp: Date;
}

export interface SendMessageRequest {
  receiver_id: number;
  content: string;
}

export interface SendMessageResponse {
  success: boolean;
  message?: Message;
  error?: string;
  details?: string;
}

export interface ChatHistoryResponse {
  success: boolean;
  messages?: Message[];
  room_id?: string;
  count?: number;
  error?: string;
  details?: string;
}

// Auth middleware types
export interface AuthResult {
  authenticated: boolean;
  userId?: number;
  error?: string;
}

// User store types
export interface UserStore {
  users: User[];
  nextUserId: number;
  friendships: FriendshipStore;
}

export interface UserHelpers {
  getAllUsers: () => User[];
  getUserById: (userId: number) => User | undefined;
  createUser: (username: string, email: string) => User;
  getFriends: (userId: number) => User[];
  addFriendship: (senderId: number, receiverId: number) => boolean;
}

