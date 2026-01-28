import mongoose, { Schema, Model, Document } from 'mongoose';

export interface IMessage extends Document {
  sender_id: number;
  receiver_id: number;
  content: string;
  room_id: string;
  timestamp: Date;
}

export interface IMessageModel extends Model<IMessage> {
  generateRoomId(userId1: number, userId2: number): string;
}

const MessageSchema = new Schema<IMessage>({
  sender_id: {
    type: Number,
    required: [true, 'Please provide a sender_id'],
    index: true,
  },
  receiver_id: {
    type: Number,
    required: [true, 'Please provide a receiver_id'],
    index: true,
  },
  content: {
    type: String,
    required: [true, 'Please provide message content'],
    trim: true,
  },
  room_id: {
    type: String,
    required: true,
    index: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Compound index for efficient room queries
MessageSchema.index({ room_id: 1, timestamp: 1 });

/**
 * generate(unique)RoomId for users
 * 
 * @param userId1
 * @param userId2
 * @returns Generated room_id (e.g., "101_205")
 */
MessageSchema.statics.generateRoomId = function(userId1: number, userId2: number): string {
  const [smallerId, largerId] = [userId1, userId2].sort((a, b) => a - b);
  return `${smallerId}_${largerId}`;
};

// model only create once even if file reloads (e.g., in dev with hot reload)
const Message = (mongoose.models.Message as IMessageModel) || 
  mongoose.model<IMessage, IMessageModel>('Message', MessageSchema);

export default Message;
