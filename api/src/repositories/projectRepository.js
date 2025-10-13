const Project = require('../models/projectModel');
const WorkSpace = require('../models/workSpaceModel');
const User = require('../models/userModel');
const APIFeatures = require('../utils/apiFeatures');

class ProjectRepository {
  async create(data) {
    return await Project.create(data);
  }

  async findAll(filter = {}, queryParams = {}) {
    let query = Project.find(filter);
    const features = new APIFeatures(query, queryParams)
      .filter()
      .sort()
      .limitFields()
      .paginate();

    return await features.query;
  }

  async findById(id, populate = []) {
    let query = Project.findById(id);
    populate.forEach((path) => (query = query.populate(path)));
    return await query;
  }
  async update(id, updates) {
    return await Project.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });
  }
  async delete(filter) {
    return await Project.deleteOne(filter);
  }
  async deleteById(id) {
    return await Project.findByIdAndDelete(id);
  }
  async aggregate(pipeline) {
    return await Project.aggregate(pipeline);
  }
  async addProjectToWorkSpace(workSpaceId, projectId) {
    return await WorkSpace.findByIdAndUpdate(
      workSpaceId,
      { $push: { projects: projectId } },
      { new: true }
    );
  }

  async addProjectToUser(userId, projectId) {
    return await User.findByIdAndUpdate(
      userId,
      { $push: { projects: { project: projectId, role: 'owner' } } },
      { new: true }
    );
  }
}

module.exports = new ProjectRepository();
