const projectRepository = require('../repositories/projectRepository');
const AppError = require('../utils/appError');

class ProjectService {
  async getAllProjects(workSpaceId) {
    const filter = workSpaceId ? { workSpace: workSpaceId } : {};
    return await projectRepository.findAll(filter);
  }

  async createProject(data, userId) {
    if (!data.workSpace) throw new AppError('WorkSpace is required', 400);

    // Assign owner if not already set
    if (!data.owner) data.owner = userId;

    const newProject = await projectRepository.create(data);

    await projectRepository.addProjectToWorkSpace(
      data.workSpace,
      newProject._id
    );
    await projectRepository.addProjectToUser(userId, newProject._id);

    return newProject;
  }

  async getProjectById(id) {
    const project = await projectRepository.findById(id);
    if (!project) throw new AppError('No project found with this ID', 404);
    return project;
  }

  async updateProject(id, data) {
    const project = await projectRepository.update(id, data);
    if (!project) throw new AppError('No project found with this ID', 404);
    return project;
  }

  async deleteProject(id) {
    const project = await projectRepository.deleteById(id);
    if (!project) throw new AppError('No project found with this ID', 404);
    return project;
  }
}

module.exports = new ProjectService();
