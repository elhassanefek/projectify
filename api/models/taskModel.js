const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'A task must have a title'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['todo', 'in-progress', 'done'],
      default: 'todo',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    dueDate: Date,

    //relations

    project: {
      type: mongoose.Schema.Types.ObjectId,
      red: 'Project',
      required: true,
    },
    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    //commnents will be virtual
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);
//virtual populate
taskSchema.virtual('comments', {
  ref: 'Comment',
  foreignField: 'task',
  localField: '_id',
});

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;
