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
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    members: [
      {
        name: {
          type: String,
          required: true,
        },
        email: {
          type: String,
          required: true,
          lowercase: true,
        },
        role: {
          type: String,
          enum: ['owner', 'manager', 'editor', 'viewer'],
          default: 'editor',
        },
      },
    ],
    status: {
      type: String,
      enum: ['pending', 'active', 'completed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

const Project = mongoose.model('Project', projectSchema);
module.exports = Project;
