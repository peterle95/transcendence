/**
 * Type Definitions for Chat Service
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

// Auth service proxy helpers
export interface UserStoreHelpers {
  getUserById: (userId: number, cookie?: string) => Promise<User | null>;
  getFriends: (cookie: string) => Promise<User[]>;
}

