const mongoose = require('mongoose');

const workSpaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tenant must have name'],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    domain: {
      type: String,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      immutable: true,
      required: true,
    },
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        role: {
          type: String,
          enum: ['owner', 'admin', 'member', 'viewer'],
          default: 'member',
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    projects: [
      {
        project: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Project',
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },

  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);
workSpaceSchema.index({ name: 1 });
workSpaceSchema.index({ createdBy: 1 });

//compound index
workSpaceSchema.index({ createdBy: 1, isActive: 1 });

//virtual property for project count
workSpaceSchema.virtual('projectCount').get(function () {
  return this.projects.length;
});

// document middleware to add creator as owner in members array

workSpaceSchema.pre('save', function (next) {
  if (this.isNew && this.createdBy) {
    //check if the creator is not in members
    const creatorExists = this.members.some(
      (member) => member.user.toString() === this.createdBy.toString()
    );
    if (!creatorExists) {
      this.members.push({
        user: this.createdBy,
        role: 'owner',
        joinedAt: new Date(),
      });
    }
  }

  next();
});

//instance method : check if the user is a memeber

workSpaceSchema.methods.isMember = function (userId) {
  return this.members.some((mem) => mem.user.toString() === userId.toString());
};
//get the user role in the workSpace
workSpaceSchema.methods.getUserRole = function (userId) {
  const member = this.members.find(
    (member) => member.user.toString() === userId.toString()
  );
  return member ? member.role : null;
};
// Instance method: Check if user has specific role or higher
workSpaceSchema.methods.hasRole = function (userId, requiredRole) {
  const roleHierarchy = { viewer: 0, member: 1, admin: 2, owner: 3 };
  const userRole = this.getUserRole(userId);

  if (!userRole) return false;

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
};

// Instance method: Check if user can manage workspace
workSpaceSchema.methods.canManage = function (userId) {
  return (
    this.createdBy.toString() === userId.toString() ||
    this.hasRole(userId, 'admin')
  );
};
const WorkSpace = mongoose.model('WorkSpace', workSpaceSchema);

module.exports = WorkSpace;

// Example usage in controller:
// if (!workspace.canManage(req.user.id)) {
//   return res.status(403).json({ message: 'Forbidden' });
// }

// Or check specific roles:
// if (!workspace.hasRole(req.user.id, 'admin')) {
//   return res.status(403).json({ message: 'Admin access required' });
// }
