const projectRepository = require('../repositories/projectRepository');
const workSpaceService = require('../services/workSpaceService');
const AppError = require('../utils/appError');
const eventBus = require('../events/eventBus');

class ProjectService {
  async getAllProjects(workSpaceId, queryParams) {
    const filter = workSpaceId ? { workSpace: workSpaceId } : {};
    return await projectRepository.findAll(filter, queryParams);
  }

  async createProject(data, userId) {
    if (!data.workSpace) throw new AppError('WorkSpace is required', 400);

    // Assign owner if not already set
    if (!data.owner) data.owner = userId;

    const exists = await workSpaceService.checkExistance(data.workSpace);

    if (!exists) {
      throw new AppError('No wrokSpace found with this ID ', 404);
    }
    // Create the project in the database
    const newProject = await projectRepository.create(data);

    await projectRepository.addProjectToWorkSpace(
      data.workSpace,
      newProject._id
    );
    await projectRepository.addProjectToUser(userId, newProject._id);

    // Emit project created event
    eventBus.emitEvent('project.created', {
      project: newProject,
      workSpaceId: data.workSpace,
      createdBy: userId
    });

    // Notify all members added to the project
    if (data.members && data.members.length > 0) {
      data.members.forEach(memberId => {
        if (memberId.toString() !== userId.toString()) {
          eventBus.emitEvent('project.member.added', {
            userId: memberId,
            project: newProject,
            addedBy: userId
          });
        }
      });
    }

    return newProject;
  }

  async getProjectById(id) {
    const project = await projectRepository.findById(id);
    if (!project) throw new AppError('No project found with this ID', 404);
    return project;
  }

  async updateProject(id, updates, userId) {
    const existingProject = await projectRepository.findById(id);
    if (!existingProject) throw new AppError('No project found with this ID', 404);

    const updatedProject = await projectRepository.update(id, {
      ...updates,
      updatedBy: userId
    });

    // Emit project updated event
    eventBus.emitEvent('project.updated', {
      project: updatedProject,
      workSpaceId: existingProject.workSpace,
      updatedBy: userId,
      changes: this._detectChanges(existingProject, updatedProject)
    });

    return updatedProject;
  }

  async deleteProject(id, userId) {
    const project = await projectRepository.findById(id);
    if (!project) throw new AppError('No project found with this ID', 404);

    await projectRepository.deleteById(id);

    // Emit project deleted event
    eventBus.emitEvent('project.deleted', {
      projectId: id,
      workSpaceId: project.workSpace,
      deletedBy: userId
    });

    return project;
  }

  // Helper method to detect changes between old and new project state
  _detectChanges(oldProject, newProject) {
    const changes = {};
    const fields = ['name', 'description', 'status', 'startDate', 'endDate', 'members'];
    
    fields.forEach(field => {
      if (JSON.stringify(oldProject[field]) !== JSON.stringify(newProject[field])) {
        changes[field] = {
          old: oldProject[field],
          new: newProject[field]
        };
      }
    });

    return changes;
  }
  async checkProjectOwnership(projectId, userId) {
    const project = await projectRepository.findById(projectId);
    if (!project) throw new AppError('No project found with this ID', 404);
    if (!project.canManage(userId))
      throw new AppError(
        'You do not have permission to perform this action!',
        403
      );
    return project;
  }
}

module.exports = new ProjectService();
