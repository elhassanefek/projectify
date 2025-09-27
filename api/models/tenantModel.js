const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tenant must have name'],
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'A tenant must have an email'],
      unique: true,
      lowercase: true,
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

const Tenant = mongoose.model('Tenant', tenantSchema);

module.exports = Tenant;
