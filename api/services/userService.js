const userRepository = require('../repositories/userRepository');
const AppError = require('../utils/appError');

class UserService {
  async getAllUsers() {
    return userRepository.findAll();
  }

  async getUserById(id) {
    const user = await userRepository.findById(id);
    if (!user) throw new AppError('No user found with this ID', 404);
    return user;
  }

  async updateUserProfile(userId, updates) {
    const allowedFields = ['name', 'email'];
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([key]) => allowedFields.includes(key))
    );

    return userRepository.updateById(userId, filtered);
  }

  async deactivateUser(userId) {
    return userRepository.softDelete(userId);
  }

  async adminUpdateUser(id, data) {
    const user = await userRepository.updateById(id, data);
    if (!user) throw new AppError('No user found with this ID', 404);
    return user;
  }

  async deleteUser(id) {
    const user = await userRepository.deleteById(id);
    if (!user) throw new AppError('No user found with this ID', 404);
    return user;
  }
}

module.exports = new UserService();
