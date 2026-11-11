const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['direct', 'group'],
      default: 'direct'
    },
    name: {
      type: String,
      trim: true,
      default: ''
    },
    avatar: {
      type: String,
      default: ''
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      }
    ],
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null
    },
    lastMessageAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Indexes for fast lookup
conversationSchema.index({ members: 1 });
conversationSchema.index({ lastMessageAt: -1 });
conversationSchema.index({ type: 1, members: 1 });

/**
 * Static method to find existing 1-1 conversation between two users
 */
conversationSchema.statics.findDirectConversation = function (userId1, userId2) {
  return this.findOne({
    type: 'direct',
    members: { $all: [userId1, userId2], $size: 2 }
  });
};

/**
 * Method to check if a user is a member of this conversation
 */
conversationSchema.methods.hasMember = function (userId) {
  return this.members.some(
    (memberId) => memberId.toString() === userId.toString()
  );
};

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;

