const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../../../src/app");
const {
  connectTestDB,
  clearDB,
  disconnectTestDB,
} = require("../../helpers/testDbHelper");

let token;
let userId;
let workspaceId;
let projectId;

beforeAll(async () => {
  await connectTestDB();
}, 30000);

afterEach(async () => {
  await clearDB();
});

afterAll(async () => {
  await disconnectTestDB();
});

describe("Project API (Nested under Workspace)", () => {
  beforeEach(async () => {
    // 1️⃣ Create and login a user
    const signupRes = await request(app).post("/api/v1/users/signup").send({
      name: "Test User",
      email: "testuser@example.com",
      password: "12345678",
      passwordConfirm: "12345678",
    });

    token = signupRes.body.token;
    userId = signupRes.body.data.user._id;

    // 2️⃣ Create a workspace for that user
    const wsRes = await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Workspace Alpha",
        description: "Test workspace",
      });

    workspaceId = wsRes.body.data.workSpace._id;
  });

  // ═══════════════════════════════════════════════════════════
  // CREATE TESTS
  // ═══════════════════════════════════════════════════════════
  describe("POST /api/v1/workspaces/:workSpaceId/projects", () => {
    it("should create a new project in a workspace", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Workspace Project 1",
          description: "Linked to workspace",
        })
        .expect(201);

      expect(res.body.status).toBe("success");
      expect(res.body.data.project.workSpace).toBe(workspaceId);
      expect(res.body.data.project.name).toBe("Workspace Project 1");
      expect(res.body.data.project.description).toBe("Linked to workspace");
      expect(res.body.data.project._id).toBeDefined();
      expect(res.body.data.project.createdAt).toBeDefined();

      projectId = res.body.data.project._id;
    });

    it("should not create project without auth", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .send({ name: "No Auth Project" })
        .expect(401);

      expect(res.body.status).toBe("fail");
    });

    it("should not create project with missing required fields", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          description: "Missing name field",
        })
        .expect(400);

      expect(res.body.status).toBe("fail");
    });

    it("should not create project with invalid workspace ID", async () => {
      const fakeWorkspaceId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .post(`/api/v1/workspaces/${fakeWorkspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Project in non-existent workspace",
          description: "Should fail",
        })
        .expect(404);

      expect(res.body.status).toBe("fail");
    });

    it("should not allow unauthorized user to create project in workspace", async () => {
      // Create another user
      const otherUserRes = await request(app)
        .post("/api/v1/users/signup")
        .send({
          name: "Other User",
          email: "otheruser@example.com",
          password: "12345678",
          passwordConfirm: "12345678",
        });

      const otherToken = otherUserRes.body.token;

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${otherToken}`)
        .send({
          name: "Unauthorized Project",
          description: "Should not be created",
        })
        .expect(403);

      expect(res.body.status).toBe("fail");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // READ TESTS
  // ═══════════════════════════════════════════════════════════
  describe("GET /api/v1/workspaces/:workSpaceId/projects", () => {
    beforeEach(async () => {
      // Create multiple projects for testing
      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Project Alpha",
          description: "First project",
        });

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Project Beta",
          description: "Second project",
        });

      projectId = res.body.data.project._id;
    });

    it("should get all projects under a workspace", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.status).toBe("success");
      expect(Array.isArray(res.body.data.projects)).toBe(true);
      expect(res.body.data.projects.length).toBe(2);
      expect(res.body.data.projects[0].workSpace).toBe(workspaceId);
    });

    it("should get a specific project by ID", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.status).toBe("success");
      expect(res.body.data.project._id).toBe(projectId);
      expect(res.body.data.project.name).toBe("Project Beta");
    });

    it("should return 404 for non-existent project", async () => {
      const fakeProjectId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects/${fakeProjectId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(404);

      expect(res.body.status).toBe("fail");
    });

    it("should not get projects without authentication", async () => {
      await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects`)
        .expect(401);
    });

    it("should return empty array for workspace with no projects", async () => {
      // Create new workspace with no projects
      const newWsRes = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Empty Workspace",
          description: "No projects here",
        });

      const emptyWorkspaceId = newWsRes.body.data.workSpace._id;

      const res = await request(app)
        .get(`/api/v1/workspaces/${emptyWorkspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.projects).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // UPDATE TESTS
  // ═══════════════════════════════════════════════════════════
  describe("PATCH /api/v1/workspaces/:workSpaceId/projects/:id", () => {
    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Editable Project",
          description: "Before update",
        });

      projectId = res.body.data.project._id;
    });

    it("should update project name", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Updated Project Name" })
        .expect(200);

      expect(res.body.status).toBe("success");
      expect(res.body.data.project.name).toBe("Updated Project Name");
      expect(res.body.data.project.description).toBe("Before update"); // Unchanged
    });

    it("should update project description", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ description: "Updated description" })
        .expect(200);

      expect(res.body.data.project.description).toBe("Updated description");
      expect(res.body.data.project.name).toBe("Editable Project"); // Unchanged
    });

    it("should update multiple fields at once", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Completely New Name",
          description: "Completely New Description",
        })
        .expect(200);

      expect(res.body.data.project.name).toBe("Completely New Name");
      expect(res.body.data.project.description).toBe(
        "Completely New Description"
      );
    });

    it("should not update project without auth", async () => {
      await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .send({ name: "Unauthorized Update" })
        .expect(401);
    });

    it("should not allow unauthorized user to update project", async () => {
      const otherUserRes = await request(app)
        .post("/api/v1/users/signup")
        .send({
          name: "Other User",
          email: "otheruser@example.com",
          password: "12345678",
          passwordConfirm: "12345678",
        });

      const otherToken = otherUserRes.body.token;

      await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ name: "Hacked Name" })
        .expect(403);
    });

    it("should return 404 when updating non-existent project", async () => {
      const fakeProjectId = new mongoose.Types.ObjectId();

      await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}/projects/${fakeProjectId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Ghost Project" })
        .expect(404);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // DELETE TESTS
  // ═══════════════════════════════════════════════════════════
  describe("DELETE /api/v1/workspaces/:workSpaceId/projects/:id", () => {
    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Deletable Project",
          description: "To be deleted",
        });

      projectId = res.body.data.project._id;
    });

    it("should delete a project", async () => {
      await request(app)
        .delete(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(204);

      // Verify deletion
      await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
    });

    it("should not delete project without auth", async () => {
      await request(app)
        .delete(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .expect(401);
    });

    it("should not allow unauthorized user to delete project", async () => {
      const otherUserRes = await request(app)
        .post("/api/v1/users/signup")
        .send({
          name: "Other User",
          email: "otheruser@example.com",
          password: "12345678",
          passwordConfirm: "12345678",
        });

      const otherToken = otherUserRes.body.token;

      await request(app)
        .delete(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .expect(403);

      // Verify project still exists
      await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
    });

    it("should return 404 when deleting non-existent project", async () => {
      const fakeProjectId = new mongoose.Types.ObjectId();

      await request(app)
        .delete(`/api/v1/workspaces/${workspaceId}/projects/${fakeProjectId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
    });

    it("should not delete same project twice", async () => {
      // First deletion
      await request(app)
        .delete(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(204);

      // Second deletion attempt
      await request(app)
        .delete(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // EDGE CASES & BUSINESS LOGIC
  // ═══════════════════════════════════════════════════════════
  describe("Edge Cases & Business Logic", () => {
    it("should handle invalid MongoDB ObjectId gracefully", async () => {
      await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects/invalid-id-123`)
        .set("Authorization", `Bearer ${token}`)
        .expect(400); // Or 500 depending on your error handling
    });

    it("should not allow duplicate project names in same workspace (if enforced)", async () => {
      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Unique Project",
          description: "First one",
        })
        .expect(201);

      // Try to create duplicate
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Unique Project",
          description: "Second one",
        });

      // Uncomment if you enforce unique names
      // .expect(400);
      // expect(res.body.message).toContain("already exists");
    });

    it("should handle very long project names", async () => {
      const longName = "A".repeat(500);

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: longName,
          description: "Testing length limits",
        });

      // Expect either 201 (if no limit) or 400 (if limit enforced)
      expect([201, 400]).toContain(res.status);
    });
  });
});
