const projectService = require("../../../src/services/projectService");
const projectRepository = require("../../../src/repositories/projectRepository");
const AppError = require("../../../src/utils/appError");

jest.mock("../../../src/repositories/projectRepository");

describe("projectService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  describe("getAllProjects", () => {
    it("should return all projects when no workspaceId provided", async () => {
      const mockProjects = [
        { _id: "1", name: "Project 1" },
        { _id: "2", name: "Project 2" },
      ];

      projectRepository.findAll.mockResolvedValue(mockProjects);

      const result = await projectService.getAllProjects();

      expect(projectRepository.findAll).toHaveBeenCalledWith({});
      expect(result).toEqual(mockProjects);
    });

    it("should return projects filtered by workspaceId", async () => {
      const mockProjects = [{ _id: "1", name: "Workspace Project" }];
      const workSpaceId = "workspace123";

      projectRepository.findAll.mockResolvedValue(mockProjects);

      const result = await projectService.getAllProjects(workSpaceId);

      expect(projectRepository.findAll).toHaveBeenCalledWith({
        workSpace: workSpaceId,
      });
      expect(result).toEqual(mockProjects);
    });
  });

  // --------------------------------------------------------------------------
  describe("getProjectById", () => {
    it("should return project by id", async () => {
      const mockProject = { _id: "projectId", name: "Test Project" };
      projectRepository.findById.mockResolvedValue(mockProject);

      const result = await projectService.getProjectById("projectId");

      expect(projectRepository.findById).toHaveBeenCalledWith("projectId");
      expect(result).toEqual(mockProject);
    });

    it("should throw error if project not found", async () => {
      projectRepository.findById.mockResolvedValue(null);

      await expect(projectService.getProjectById("notFoundId")).rejects.toThrow(
        AppError
      );

      expect(projectRepository.findById).toHaveBeenCalledWith("notFoundId");
    });
  });

  // --------------------------------------------------------------------------
  describe("createProject", () => {
    it("should create a new project successfully", async () => {
      const userId = "user123";
      const data = {
        name: "New Project",
        workSpace: "workspace123",
      };
      const mockProject = { _id: "projectId", ...data };

      projectRepository.create.mockResolvedValue(mockProject);
      projectRepository.addProjectToWorkSpace.mockResolvedValue({});
      projectRepository.addProjectToUser.mockResolvedValue({});

      const result = await projectService.createProject(data, userId);

      expect(projectRepository.create).toHaveBeenCalledWith({
        ...data,
        owner: userId,
      });
      expect(projectRepository.addProjectToWorkSpace).toHaveBeenCalledWith(
        "workspace123",
        "projectId"
      );
      expect(projectRepository.addProjectToUser).toHaveBeenCalledWith(
        userId,
        "projectId"
      );
      expect(result).toEqual(mockProject);
    });

    it("should throw error if workspace is missing", async () => {
      const data = { name: "Invalid Project" };
      const userId = "user123";

      await expect(projectService.createProject(data, userId)).rejects.toThrow(
        AppError
      );

      expect(projectRepository.create).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  describe("updateProject", () => {
    it("should update project successfully", async () => {
      const id = "projectId";
      const updates = { name: "Updated Project" };
      const updatedProject = { _id: id, ...updates };

      projectRepository.update.mockResolvedValue(updatedProject);

      const result = await projectService.updateProject(id, updates);

      expect(projectRepository.update).toHaveBeenCalledWith(id, updates);
      expect(result).toEqual(updatedProject);
    });

    it("should throw error if project not found during update", async () => {
      projectRepository.update.mockResolvedValue(null);

      await expect(
        projectService.updateProject("missingId", { name: "nope" })
      ).rejects.toThrow(AppError);

      expect(projectRepository.update).toHaveBeenCalledWith("missingId", {
        name: "nope",
      });
    });
  });

  // --------------------------------------------------------------------------
  describe("deleteProject", () => {
    it("should delete project successfully", async () => {
      const mockProject = { _id: "projectId", name: "To Delete" };
      projectRepository.delete.mockResolvedValue(mockProject);

      const result = await projectService.deleteProject("projectId");

      expect(projectRepository.delete).toHaveBeenCalledWith("projectId");
      expect(result).toEqual(mockProject);
    });

    it("should throw error if project not found during delete", async () => {
      projectRepository.delete.mockResolvedValue(null);

      await expect(projectService.deleteProject("missingId")).rejects.toThrow(
        AppError
      );

      expect(projectRepository.delete).toHaveBeenCalledWith("missingId");
    });
  });
});
