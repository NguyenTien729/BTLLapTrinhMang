const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true
    },
    fileName: {
      type: String,
      default: ''
    },
    fileType: {
      type: String,
      default: ''
    },
    fileSize: {
      type: Number,
      default: 0
    },
    mimeType: {
      type: String,
      default: ''
    }
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: [true, 'conversationId là bắt buộc'],
      index: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'sender là bắt buộc'],
      index: true
    },
    type: {
      type: String,
      enum: ['text', 'image', 'file'],
      default: 'text'
    },
    text: {
      type: String,
      default: '',
      trim: true
    },
    attachments: [attachmentSchema],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null
    },
    isEdited: {
      type: Boolean,
      default: false
    },
    editedAt: {
      type: Date,
      default: null
    },
    isRecall: {
      type: Boolean,
      default: false,
      index: true
    },
    recalledAt: {
      type: Date,
      default: null
    },
    // Deduplication token between REST API and Socket.IO
    clientTempId: {
      type: String,
      default: null,
      index: true
    },
    readBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        readAt: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

// Compound index for querying chat history with pagination
messageSchema.index({ conversationId: 1, createdAt: -1 });

// Text index for search
messageSchema.index({ text: 'text' });

/**
 * Format message output, masking content if message was recalled
 */
messageSchema.methods.toClientJSON = function () {
  const obj = this.toObject();
  if (obj.isRecall) {
    obj.text = 'Tin nhắn đã bị thu hồi';
    obj.attachments = [];
  }
  return obj;
};

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;

