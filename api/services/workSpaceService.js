// services/workSpaceService.js
const workSpaceRepository = require('../repositories/workSpaceRepository');
const User = require('../models/userModel');
const AppError = require('../utils/appError');

class WorkSpaceService {
  async getAllWorkSpaces() {
    return await workSpaceRepository.find({});
  }

  async getWorkSpaceById(id) {
    const workSpace = await workSpaceRepository.findById(id, [
      { path: 'createdBy', select: 'name' },
    ]);
    if (!workSpace) throw new AppError('No workSpace found with this ID', 404);
    return workSpace;
  }

  async createWorkSpace(data, userId) {
    const newWorkSpace = await workSpaceRepository.create({
      ...data,
      createdBy: userId,
    });

    await User.findByIdAndUpdate(userId, {
      $push: { workSpaces: { workSpace: newWorkSpace._id, role: 'owner' } },
    });

    return newWorkSpace;
  }

  async updateWorkSpace(id, updates) {
    const workSpace = await workSpaceRepository.update(id, updates);
    if (!workSpace) throw new AppError('No workSpace found with this ID', 404);
    return workSpace;
  }

  async deleteWorkSpace(id) {
    const workSpace = await workSpaceRepository.deleteById(id);
    if (!workSpace) throw new AppError('No workSpace found with that ID', 404);
    return workSpace;
  }

  async getOwnedWorkSpaces(userId) {
    const user = await User.findById(userId).populate({
      path: 'workSpaces.workSpace',
      select: 'name description createdAt',
    });
    if (!user) throw new AppError('User not found', 404);

    return user.workSpaces
      .filter((ws) => ws.role === 'owner')
      .map((ws) => ws.workSpace);
  }

  async getMemberWorkSpaces(userId) {
    const user = await User.findById(userId).populate({
      path: 'workSpaces.workSpace',
      select: 'name description createdAt',
    });
    if (!user) throw new AppError('User not found', 404);

    return user.workSpaces
      .filter(
        (ws) =>
          ws.role === 'member' || ws.role === 'owner' || ws.role === 'admin'
      )
      .map((ws) => ws.workSpace);
  }

  async checkWorkspaceOwnership(workSpaceId, userId) {
    const workSpace = await workSpaceRepository.findById(workSpaceId);
    if (!workSpace) throw new AppError('No workSpace found with this ID', 404);
    if (!workSpace.canManage(userId))
      throw new AppError(
        'You do not have permission to perform this action!',
        403
      );
    return workSpace;
  }

  async checkWorkspaceMembership(workSpaceId, userId) {
    const workSpace = await workSpaceRepository.findById(workSpaceId);
    if (!workSpace) throw new AppError('No workSpace found with this ID', 404);
    if (!workSpace.isMember(userId))
      throw new AppError('You are not a member in this workSpace', 403);
    return workSpace;
  }

  async getTotalWorkSpaces() {
    return await workSpaceRepository.count();
  }

  async getWorkSpacesUsersStats(workSpaceId) {
    const stats = await User.aggregate([
      { $match: { workSpace: workSpaceId } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $project: { role: '$_id', count: 1, _id: 0 } },
    ]);
    return stats;
  }

  async getWorkSpaceUsersActiveStats(workSpaceId) {
    const stats = await User.aggregate([
      { $match: { workSpace: workSpaceId } },
      { $group: { _id: '$isActive', count: { $sum: 1 } } },
      {
        $project: {
          status: { $cond: [{ $eq: ['$_id', true] }, 'active', 'inactive'] },
          count: 1,
          _id: 0,
        },
      },
    ]);
    return stats;
  }
}

module.exports = new WorkSpaceService();
