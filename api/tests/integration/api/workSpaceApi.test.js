const request = require("supertest");
const mongoose = require("mongoose");
const User = require("../../../src/models/userModel");
const WorkSpace = require("../../../src/models/workSpaceModel");
const app = require("../../../src/app");
const {
  connectTestDB,
  clearDB,
  disconnectTestDB,
} = require("../../helpers/testDbHelper");

let authToken;
let userId;
let anotherUserToken;
let anotherUserId;
let workspaceId;
let ownedWorkspaceId;

beforeAll(async () => {
  await connectTestDB();

  // Wait for mongoose to be ready
  while (mongoose.connection.readyState !== 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}, 30000);

afterEach(async () => {
  await clearDB();
  authToken = null;
  userId = null;
  anotherUserToken = null;
  anotherUserId = null;
  workspaceId = null;
  ownedWorkspaceId = null;
});

afterAll(async () => {
  await disconnectTestDB();
});

describe("WorkSpace API - Authentication & Creation", () => {
  beforeEach(async () => {
    // Create and login a user
    const signupRes = await request(app).post("/api/v1/users/signup").send({
      name: "Test User",
      email: "test@example.com",
      password: "12345678",
      passwordConfirm: "12345678",
    });

    authToken = signupRes.body.token;
    userId = signupRes.body.data.user._id;
  });

  describe("POST /api/v1/workspaces", () => {
    it("should create a new workspace successfully", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Test Workspace",
          description: "A test workspace",
        })
        .expect(201);

      expect(res.body.status).toBe("success");
      expect(res.body.data.workSpace.name).toBe("Test Workspace");
      expect(res.body.data.workSpace.description).toBe("A test workspace");
      expect(res.body.data.workSpace.createdBy).toBeDefined();
    });

    it("should not create workspace without authentication", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces")
        .send({
          name: "Test Workspace",
          description: "A test workspace",
        })
        .expect(401);

      expect(res.body.status).toBe("fail");
    });

    it("should not create workspace without required fields", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          description: "Missing name",
        })
        .expect(400);

      expect(res.body.status).toBe("fail");
    });

    it("should create workspace with only name", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Minimal Workspace",
        })
        .expect(201);

      expect(res.body.status).toBe("success");
      expect(res.body.data.workSpace.name).toBe("Minimal Workspace");
    });
  });
});

describe("WorkSpace API - Owned & Member Workspaces", () => {
  beforeEach(async () => {
    // Create first user
    const user1Res = await request(app).post("/api/v1/users/signup").send({
      name: "User One",
      email: "user1@example.com",
      password: "12345678",
      passwordConfirm: "12345678",
    });
    authToken = user1Res.body.token;
    userId = user1Res.body.data.user._id;

    // Create second user
    const user2Res = await request(app).post("/api/v1/users/signup").send({
      name: "User Two",
      email: "user2@example.com",
      password: "12345678",
      passwordConfirm: "12345678",
    });
    anotherUserToken = user2Res.body.token;
    anotherUserId = user2Res.body.data.user._id;

    // User 1 creates a workspace
    const workspaceRes = await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        name: "User One Workspace",
        description: "Owned by user one",
      });
    ownedWorkspaceId = workspaceRes.body.data.workSpace._id;
  });

  describe("GET /api/v1/workspaces/my-owned", () => {
    it("should get all workspaces owned by the user", async () => {
      const res = await request(app)
        .get("/api/v1/workspaces/my-owned")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.status).toBe("success");
      expect(res.body.results).toBeGreaterThan(0);
      expect(res.body.data.ownedWorkSpaces).toBeInstanceOf(Array);
      expect(res.body.data.ownedWorkSpaces[0].name).toBe("User One Workspace");
    });

    it("should return empty array for user with no owned workspaces", async () => {
      const res = await request(app)
        .get("/api/v1/workspaces/my-owned")
        .set("Authorization", `Bearer ${anotherUserToken}`)
        .expect(200);

      expect(res.body.status).toBe("success");
      expect(res.body.results).toBe(0);
      expect(res.body.data.ownedWorkSpaces).toEqual([]);
    });

    it("should not get owned workspaces without authentication", async () => {
      const res = await request(app)
        .get("/api/v1/workspaces/my-owned")
        .expect(401);

      expect(res.body.status).toBe("fail");
    });
  });

  describe("GET /api/v1/workspaces/my-member", () => {
    it("should get all workspaces where user is a member", async () => {
      const res = await request(app)
        .get("/api/v1/workspaces/my-member")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.status).toBe("success");
      expect(res.body.data.memberWorkSpaces).toBeInstanceOf(Array);
    });

    it("should not get member workspaces without authentication", async () => {
      const res = await request(app)
        .get("/api/v1/workspaces/my-member")
        .expect(401);

      expect(res.body.status).toBe("fail");
    });
  });
});

describe("WorkSpace API - Get, Update, Delete", () => {
  beforeEach(async () => {
    // Create user and workspace
    const signupRes = await request(app).post("/api/v1/users/signup").send({
      name: "Workspace Owner",
      email: "owner@example.com",
      password: "12345678",
      passwordConfirm: "12345678",
    });
    authToken = signupRes.body.token;
    userId = signupRes.body.data.user._id;

    // Create another user
    const user2Res = await request(app).post("/api/v1/users/signup").send({
      name: "Another User",
      email: "another@example.com",
      password: "12345678",
      passwordConfirm: "12345678",
    });
    anotherUserToken = user2Res.body.token;
    anotherUserId = user2Res.body.data.user._id;

    // Create workspace
    const workspaceRes = await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        name: "Test Workspace",
        description: "Test description",
      });
    workspaceId = workspaceRes.body.data.workSpace._id;
  });

  describe("GET /api/v1/workspaces/:id", () => {
    it("should get workspace by id if user is owner", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.status).toBe("success");
      expect(res.body.data.workSpace._id).toBe(workspaceId);
      expect(res.body.data.workSpace.name).toBe("Test Workspace");
    });

    it("should not get workspace without authentication", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}`)
        .expect(401);

      expect(res.body.status).toBe("fail");
    });

    it("should not get workspace if user is not a member", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}`)
        .set("Authorization", `Bearer ${anotherUserToken}`)
        .expect(403);

      expect(res.body.status).toBe("fail");
    });

    it("should return error for invalid workspace id", async () => {
      const res = await request(app)
        .get("/api/v1/workspaces/invalidid123")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);

      expect(res.body.status).toBe("fail");
    });
  });

  describe("PATCH /api/v1/workspaces/:id", () => {
    it("should update workspace if user is owner", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Updated Workspace Name",
          description: "Updated description",
        })
        .expect(200);

      expect(res.body.status).toBe("success");
      expect(res.body.data.workSpace.name).toBe("Updated Workspace Name");
      expect(res.body.data.workSpace.description).toBe("Updated description");
    });

    it("should update only name", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Only Name Updated",
        })
        .expect(200);

      expect(res.body.status).toBe("success");
      expect(res.body.data.workSpace.name).toBe("Only Name Updated");
      expect(res.body.data.workSpace.description).toBe("Test description");
    });

    it("should not update workspace without authentication", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}`)
        .send({
          name: "Unauthorized Update",
        })
        .expect(401);

      expect(res.body.status).toBe("fail");
    });

    it("should not update workspace if user is not owner", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}`)
        .set("Authorization", `Bearer ${anotherUserToken}`)
        .send({
          name: "Unauthorized Update",
        })
        .expect(403);

      expect(res.body.status).toBe("fail");
    });
  });

  describe("DELETE /api/v1/workspaces/:id", () => {
    it("should delete workspace if user is owner", async () => {
      const res = await request(app)
        .delete(`/api/v1/workspaces/${workspaceId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(204);

      // Verify workspace is deleted
      const getRes = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);
    });

    it("should not delete workspace without authentication", async () => {
      const res = await request(app)
        .delete(`/api/v1/workspaces/${workspaceId}`)
        .expect(401);

      expect(res.body.status).toBe("fail");
    });

    it("should not delete workspace if user is not owner", async () => {
      const res = await request(app)
        .delete(`/api/v1/workspaces/${workspaceId}`)
        .set("Authorization", `Bearer ${anotherUserToken}`)
        .expect(403);

      expect(res.body.status).toBe("fail");
    });

    it("should return error for invalid workspace id", async () => {
      const res = await request(app)
        .delete("/api/v1/workspaces/invalidid123")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);

      expect(res.body.status).toBe("fail");
    });
  });
});

describe("WorkSpace API - Multiple Workspaces", () => {
  beforeEach(async () => {
    const signupRes = await request(app).post("/api/v1/users/signup").send({
      name: "Multi User",
      email: "multi@example.com",
      password: "12345678",
      passwordConfirm: "12345678",
    });
    authToken = signupRes.body.token;
    userId = signupRes.body.data.user._id;
  });

  it("should create and retrieve multiple workspaces", async () => {
    // Create first workspace
    await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        name: "Workspace One",
        description: "First workspace",
      })
      .expect(201);

    // Create second workspace
    await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        name: "Workspace Two",
        description: "Second workspace",
      })
      .expect(201);

    // Create third workspace
    await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        name: "Workspace Three",
        description: "Third workspace",
      })
      .expect(201);

    // Get all owned workspaces
    const res = await request(app)
      .get("/api/v1/workspaces/my-owned")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.status).toBe("success");
    expect(res.body.results).toBe(3);
    expect(res.body.data.ownedWorkSpaces).toHaveLength(3);
  });
});
