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

  // ───────────────────────────────
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

      projectId = res.body.data.project._id;
    });

    it("should not create project without auth", async () => {
      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .send({ name: "No Auth Project" })
        .expect(401);
    });
  });

  // ───────────────────────────────
  describe("GET /api/v1/workspaces/:workSpaceId/projects", () => {
    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Workspace Project 2",
          description: "For get testing",
        });

      projectId = res.body.data.project._id;
    });

    it("should get all projects under a workspace", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.status).toBe("success");
      //   expect(Array.isArray(res.body.data.projects)).toBe(true);
      //   expect(res.body.data.projects[0].workSpace).toBe(workspaceId);
    });

    it("should get a project by ID", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.status).toBe("success");
      expect(res.body.data.project._id).toBe(projectId);
    });
  });

  // ───────────────────────────────
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

    it("should update a project", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Updated Project Name" })
        .expect(200);

      expect(res.body.status).toBe("success");
      expect(res.body.data.project.name).toBe("Updated Project Name");
    });
  });

  // ───────────────────────────────
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

      await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
    });
  });
});
