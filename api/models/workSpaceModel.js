const mongoose = require('mongoose');

const workSpaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tenant must have name'],
      unique: true,
      trim: true,
    },
    domain: {
      type: String,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,

      required: true,
    },
  },
  {
    timestamps: true,
  }
);
workSpaceSchema.index('name');
const WorkSpace = mongoose.model('WorkSpace', workSpaceSchema);

module.exports = WorkSpace;
