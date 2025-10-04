const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A project must have a name'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    //parent ref
    workSpace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkSpace',
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    teamMembers: [
      {
        member: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },

        role: {
          type: String,
          enum: ['owner', 'manager', 'editor', 'viewer'],
          default: 'editor',
        },
        joinedAt: Date,
      },
    ],
    progress: { type: Number, min: 0, max: 100, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'planning', 'in-progress', 'completed', 'on-hold'],
      default: 'pending',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
  },
  { timestamps: true }
);

const Project = mongoose.model('Project', projectSchema);
module.exports = Project;
