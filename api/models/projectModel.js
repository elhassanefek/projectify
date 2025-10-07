const mongoose = require('mongoose');
const groupSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      default: function () {
        return `grp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      },
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    color: {
      type: String,
      default: '#0073ea',
      validate: {
        validator: function (v) {
          return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
        },
        message: 'Invalid hex color format',
      },
    },
    collapsed: {
      type: Boolean,
      default: false,
    },
    position: {
      type: Number,
      required: true,
    },
  },
  {
    _id: false, // Don't create MongoDB _id for sub-documents
  }
);

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
        joinedAt: {
          type: Date,
          default: Date.now,
        },
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
    groups: {
      type: [groupSchema],
      default: function () {
        // Auto-create default groups when project is created
        return [
          {
            id: `grp_${Date.now()}_1`,
            title: 'To Do',
            color: '#c4c4c4',
            collapsed: false,
            position: 0,
          },
          {
            id: `grp_${Date.now()}_2`,
            title: 'In Progress',
            color: '#fdab3d',
            collapsed: false,
            position: 1,
          },
          {
            id: `grp_${Date.now()}_3`,
            title: 'Done',
            color: '#00c875',
            collapsed: false,
            position: 2,
          },
        ];
      },
    },
    archivedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

projectSchema.pre('save', function (next) {
  if (this.isNew && this.owner) {
    this.teamMembers.push({
      member: this.owner,
      role: 'owner',
      joinedAt: new Date(),
    });
  }

  next();
});
const Project = mongoose.model('Project', projectSchema);
module.exports = Project;
