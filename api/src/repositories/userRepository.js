const User = require('../models/userModel');

class UserRepository {
  async findAll() {
    // return User.find().populate('workSpaces.workSpace');
    return User.find();
  }

  async findById(id) {
    return User.findById(id);
  }

  async findByEmail(email) {
    return User.findOne({ email }).select('+password');
  }

  async create(userData) {
    return User.create(userData);
  }

  async updateById(id, updateData) {
    return User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
  }

  async softDelete(id) {
    return User.findByIdAndUpdate(id, { isActive: false });
  }

  async deleteById(id) {
    return User.findByIdAndDelete(id);
  }
  async findByIdWithPassword(id) {
    return User.findById(id).select('+password');
  }
}

module.exports = new UserRepository();
