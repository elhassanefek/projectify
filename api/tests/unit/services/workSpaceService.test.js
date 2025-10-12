const workSpaceService = require("../../../src/services/workSpaceService");
const workSpaceRepository = require("../../../src/repositories/workSpaceRepository");
const User = require("../../../src/models/userModel");
const AppError = require("../../../src/utils/appError");

jest.mock("../../../src/repositories/workSpaceRepository");
jest.mock("../../../src/models/userModel");

describe("workSpaceService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAllWorkSpaces", () => {
    it("should return all workspaces", async () => {
      const mockWorkSpaces = [
        { _id: "1", name: "Workspace 1" },
        { _id: "2", name: "Workspace 2" },
      ];
      workSpaceRepository.find.mockResolvedValue(mockWorkSpaces);

      const result = await workSpaceService.getAllWorkSpaces();

      expect(workSpaceRepository.find).toHaveBeenCalledWith({});
      expect(result).toEqual(mockWorkSpaces);
    });
  });

  describe("getWorkSpaceById", () => {
    it("should return workspace by id with populated createdBy", async () => {
      const mockWorkSpace = {
        _id: "workspaceId",
        name: "Test Workspace",
        createdBy: { _id: "userId", name: "John" },
      };
      workSpaceRepository.findById.mockResolvedValue(mockWorkSpace);

      const result = await workSpaceService.getWorkSpaceById("workspaceId");

      expect(workSpaceRepository.findById).toHaveBeenCalledWith("workspaceId", [
        { path: "createdBy", select: "name" },
      ]);
      expect(result).toEqual(mockWorkSpace);
    });

    it("should throw error if workspace not found", async () => {
      workSpaceRepository.findById.mockResolvedValue(null);

      await expect(
        workSpaceService.getWorkSpaceById("invalidId")
      ).rejects.toThrow(AppError);

      await expect(
        workSpaceService.getWorkSpaceById("invalidId")
      ).rejects.toThrow("No workSpace found with this ID");
    });
  });

  describe("createWorkSpace", () => {
    it("should create workspace and add to user's workspaces", async () => {
      const mockWorkSpace = {
        _id: "newWorkspaceId",
        name: "New Workspace",
        description: "Test",
        createdBy: "userId",
      };
      const workspaceData = { name: "New Workspace", description: "Test" };

      workSpaceRepository.create.mockResolvedValue(mockWorkSpace);
      User.findByIdAndUpdate = jest.fn().mockResolvedValue({});

      const result = await workSpaceService.createWorkSpace(
        workspaceData,
        "userId"
      );

      expect(workSpaceRepository.create).toHaveBeenCalledWith({
        ...workspaceData,
        createdBy: "userId",
      });
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith("userId", {
        $push: { workSpaces: { workSpace: "newWorkspaceId", role: "owner" } },
      });
      expect(result).toEqual(mockWorkSpace);
    });
  });

  describe("updateWorkSpace", () => {
    it("should update workspace successfully", async () => {
      const mockUpdatedWorkSpace = {
        _id: "workspaceId",
        name: "Updated Workspace",
      };
      const updates = { name: "Updated Workspace" };

      workSpaceRepository.update.mockResolvedValue(mockUpdatedWorkSpace);

      const result = await workSpaceService.updateWorkSpace(
        "workspaceId",
        updates
      );

      expect(workSpaceRepository.update).toHaveBeenCalledWith(
        "workspaceId",
        updates
      );
      expect(result).toEqual(mockUpdatedWorkSpace);
    });

    it("should throw error if workspace not found", async () => {
      workSpaceRepository.update.mockResolvedValue(null);

      await expect(
        workSpaceService.updateWorkSpace("invalidId", { name: "Test" })
      ).rejects.toThrow(AppError);

      await expect(
        workSpaceService.updateWorkSpace("invalidId", { name: "Test" })
      ).rejects.toThrow("No workSpace found with this ID");
    });
  });

  describe("deleteWorkSpace", () => {
    it("should delete workspace successfully", async () => {
      const mockWorkSpace = { _id: "workspaceId", name: "Deleted Workspace" };
      workSpaceRepository.deleteById.mockResolvedValue(mockWorkSpace);

      const result = await workSpaceService.deleteWorkSpace("workspaceId");

      expect(workSpaceRepository.deleteById).toHaveBeenCalledWith(
        "workspaceId"
      );
      expect(result).toEqual(mockWorkSpace);
    });

    it("should throw error if workspace not found", async () => {
      workSpaceRepository.deleteById.mockResolvedValue(null);

      await expect(
        workSpaceService.deleteWorkSpace("invalidId")
      ).rejects.toThrow(AppError);

      await expect(
        workSpaceService.deleteWorkSpace("invalidId")
      ).rejects.toThrow("No workSpace found with that ID");
    });
  });

  describe("getOwnedWorkSpaces", () => {
    it("should return workspaces owned by user", async () => {
      const mockWorkSpaces = [
        { _id: "1", name: "Workspace 1", createdBy: "userId" },
        { _id: "2", name: "Workspace 2", createdBy: "userId" },
      ];

      workSpaceRepository.find.mockResolvedValue(mockWorkSpaces);

      const result = await workSpaceService.getOwnedWorkSpaces("userId");

      expect(workSpaceRepository.find).toHaveBeenCalledWith({
        createdBy: "userId",
      });
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Workspace 1");
      expect(result[1].name).toBe("Workspace 2");
    });

    it("should return empty array if user has no owned workspaces", async () => {
      workSpaceRepository.find.mockResolvedValue([]);

      const result = await workSpaceService.getOwnedWorkSpaces("userId");

      expect(workSpaceRepository.find).toHaveBeenCalledWith({
        createdBy: "userId",
      });
      expect(result).toEqual([]);
    });
  });

  describe("getMemberWorkSpaces", () => {
    it("should return workspaces where user is member, owner, or admin", async () => {
      const mockUser = {
        _id: "userId",
        workSpaces: [
          {
            workSpace: "1",
            role: "owner",
          },
          {
            workSpace: "2",
            role: "admin",
          },
          {
            workSpace: "3",
            role: "member",
          },
        ],
      };

      const mockWorkSpaces = [
        { _id: "1", name: "Workspace 1" },
        { _id: "2", name: "Workspace 2" },
        { _id: "3", name: "Workspace 3" },
      ];

      User.findById = jest.fn().mockResolvedValue(mockUser);
      workSpaceRepository.find.mockResolvedValue(mockWorkSpaces);

      const result = await workSpaceService.getMemberWorkSpaces("userId");

      expect(User.findById).toHaveBeenCalledWith("userId");
      expect(workSpaceRepository.find).toHaveBeenCalledWith({
        _id: { $in: ["1", "2", "3"] },
      });
      expect(result).toHaveLength(3);
    });

    it("should throw error if user not found", async () => {
      User.findById = jest.fn().mockResolvedValue(null);

      await expect(
        workSpaceService.getMemberWorkSpaces("invalidUserId")
      ).rejects.toThrow(AppError);

      await expect(
        workSpaceService.getMemberWorkSpaces("invalidUserId")
      ).rejects.toThrow("User not found");
    });

    it("should return empty array if user has no workspaces", async () => {
      const mockUser = {
        _id: "userId",
        workSpaces: [],
      };

      User.findById = jest.fn().mockResolvedValue(mockUser);
      workSpaceRepository.find.mockResolvedValue([]);

      const result = await workSpaceService.getMemberWorkSpaces("userId");

      expect(workSpaceRepository.find).toHaveBeenCalledWith({
        _id: { $in: [] },
      });
      expect(result).toEqual([]);
    });

    it("should filter out non-member roles", async () => {
      const mockUser = {
        _id: "userId",
        workSpaces: [
          {
            workSpace: "1",
            role: "owner",
          },
          {
            workSpace: "2",
            role: "guest", // This should be filtered out
          },
        ],
      };

      const mockWorkSpaces = [{ _id: "1", name: "Workspace 1" }];

      User.findById = jest.fn().mockResolvedValue(mockUser);
      workSpaceRepository.find.mockResolvedValue(mockWorkSpaces);

      const result = await workSpaceService.getMemberWorkSpaces("userId");

      expect(workSpaceRepository.find).toHaveBeenCalledWith({
        _id: { $in: ["1"] }, // Only owner workspace ID
      });
      expect(result).toHaveLength(1);
    });
  });

  describe("checkWorkspaceOwnership", () => {
    it("should return workspace if user can manage it", async () => {
      const mockWorkSpace = {
        _id: "workspaceId",
        name: "Test Workspace",
        canManage: jest.fn().mockReturnValue(true),
      };
      workSpaceRepository.findById.mockResolvedValue(mockWorkSpace);

      const result = await workSpaceService.checkWorkspaceOwnership(
        "workspaceId",
        "userId"
      );

      expect(workSpaceRepository.findById).toHaveBeenCalledWith("workspaceId");
      expect(mockWorkSpace.canManage).toHaveBeenCalledWith("userId");
      expect(result).toEqual(mockWorkSpace);
    });

    it("should throw error if workspace not found", async () => {
      workSpaceRepository.findById.mockResolvedValue(null);

      await expect(
        workSpaceService.checkWorkspaceOwnership("invalidId", "userId")
      ).rejects.toThrow(AppError);

      await expect(
        workSpaceService.checkWorkspaceOwnership("invalidId", "userId")
      ).rejects.toThrow("No workSpace found with this ID");
    });

    it("should throw error if user cannot manage workspace", async () => {
      const mockWorkSpace = {
        _id: "workspaceId",
        name: "Test Workspace",
        canManage: jest.fn().mockReturnValue(false),
      };
      workSpaceRepository.findById.mockResolvedValue(mockWorkSpace);

      await expect(
        workSpaceService.checkWorkspaceOwnership("workspaceId", "userId")
      ).rejects.toThrow(AppError);

      await expect(
        workSpaceService.checkWorkspaceOwnership("workspaceId", "userId")
      ).rejects.toThrow("You do not have permission to perform this action!");
    });
  });

  describe("checkWorkspaceMembership", () => {
    it("should return workspace if user is a member", async () => {
      const mockWorkSpace = {
        _id: "workspaceId",
        name: "Test Workspace",
        isMember: jest.fn().mockReturnValue(true),
      };
      workSpaceRepository.findById.mockResolvedValue(mockWorkSpace);

      const result = await workSpaceService.checkWorkspaceMembership(
        "workspaceId",
        "userId"
      );

      expect(workSpaceRepository.findById).toHaveBeenCalledWith("workspaceId");
      expect(mockWorkSpace.isMember).toHaveBeenCalledWith("userId");
      expect(result).toEqual(mockWorkSpace);
    });

    it("should throw error if workspace not found", async () => {
      workSpaceRepository.findById.mockResolvedValue(null);

      await expect(
        workSpaceService.checkWorkspaceMembership("invalidId", "userId")
      ).rejects.toThrow(AppError);

      await expect(
        workSpaceService.checkWorkspaceMembership("invalidId", "userId")
      ).rejects.toThrow("No workSpace found with this ID");
    });

    it("should throw error if user is not a member", async () => {
      const mockWorkSpace = {
        _id: "workspaceId",
        name: "Test Workspace",
        isMember: jest.fn().mockReturnValue(false),
      };
      workSpaceRepository.findById.mockResolvedValue(mockWorkSpace);

      await expect(
        workSpaceService.checkWorkspaceMembership("workspaceId", "userId")
      ).rejects.toThrow(AppError);

      await expect(
        workSpaceService.checkWorkspaceMembership("workspaceId", "userId")
      ).rejects.toThrow("You are not a member in this workSpace");
    });
  });

  describe("getTotalWorkSpaces", () => {
    it("should return total count of workspaces", async () => {
      workSpaceRepository.count.mockResolvedValue(42);

      const result = await workSpaceService.getTotalWorkSpaces();

      expect(workSpaceRepository.count).toHaveBeenCalled();
      expect(result).toBe(42);
    });

    it("should return 0 if no workspaces exist", async () => {
      workSpaceRepository.count.mockResolvedValue(0);

      const result = await workSpaceService.getTotalWorkSpaces();

      expect(result).toBe(0);
    });
  });

  describe("getWorkSpacesUsersStats", () => {
    it("should return user statistics grouped by role", async () => {
      const mockStats = [
        { role: "owner", count: 5 },
        { role: "admin", count: 3 },
        { role: "member", count: 10 },
      ];

      User.aggregate = jest.fn().mockResolvedValue(mockStats);

      const result = await workSpaceService.getWorkSpacesUsersStats(
        "workspaceId"
      );

      expect(User.aggregate).toHaveBeenCalledWith([
        { $match: { workSpace: "workspaceId" } },
        { $group: { _id: "$role", count: { $sum: 1 } } },
        { $project: { role: "$_id", count: 1, _id: 0 } },
      ]);
      expect(result).toEqual(mockStats);
    });

    it("should return empty array if no users in workspace", async () => {
      User.aggregate = jest.fn().mockResolvedValue([]);

      const result = await workSpaceService.getWorkSpacesUsersStats(
        "workspaceId"
      );

      expect(result).toEqual([]);
    });
  });

  describe("getWorkSpaceUsersActiveStats", () => {
    it("should return user statistics grouped by active status", async () => {
      const mockStats = [
        { status: "active", count: 15 },
        { status: "inactive", count: 3 },
      ];

      User.aggregate = jest.fn().mockResolvedValue(mockStats);

      const result = await workSpaceService.getWorkSpaceUsersActiveStats(
        "workspaceId"
      );

      expect(User.aggregate).toHaveBeenCalledWith([
        { $match: { workSpace: "workspaceId" } },
        { $group: { _id: "$isActive", count: { $sum: 1 } } },
        {
          $project: {
            status: { $cond: [{ $eq: ["$_id", true] }, "active", "inactive"] },
            count: 1,
            _id: 0,
          },
        },
      ]);
      expect(result).toEqual(mockStats);
    });

    it("should return empty array if no users in workspace", async () => {
      User.aggregate = jest.fn().mockResolvedValue([]);

      const result = await workSpaceService.getWorkSpaceUsersActiveStats(
        "workspaceId"
      );

      expect(result).toEqual([]);
    });
  });
});
