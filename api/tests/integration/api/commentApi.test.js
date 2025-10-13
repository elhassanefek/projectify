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
let taskId;
let commentId;

beforeAll(async () => {
  await connectTestDB();
}, 30000);

afterEach(async () => {
  await clearDB();
});

afterAll(async () => {
  await disconnectTestDB();
});

describe("Comment API (Nested under Task)", () => {
  beforeEach(async () => {
    // 1️⃣ Create and login user
    const signupRes = await request(app).post("/api/v1/users/signup").send({
      name: "Test User",
      email: "testuser@example.com",
      password: "12345678",
      passwordConfirm: "12345678",
    });

    token = signupRes.body.token;
    userId = signupRes.body.data.user._id;

    // 2️⃣ Create workspace
    const wsRes = await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Workspace for Comments",
      });
    workspaceId = wsRes.body.data.workSpace._id;

    // 3️⃣ Create project
    const projRes = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Project for Comments",
      });
    projectId = projRes.body.data.project._id;

    // 4️⃣ Create task
    const taskRes = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Task for Comments",
      });
    taskId = taskRes.body.data.task._id;
  });

  // ════════════════════════════════════════════════
  // CREATE
  // ════════════════════════════════════════════════
  describe("POST /api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments", () => {
    it("should create a new comment on a task", async () => {
      const res = await request(app)
        .post(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments`
        )
        .set("Authorization", `Bearer ${token}`)
        .send({
          text: "This is a new comment.",
        })
        .expect(201);

      expect(res.body.status).toBe("success");
      expect(res.body.data.comment.text).toBe("This is a new comment.");
      expect(res.body.data.comment.task).toBe(taskId);
      expect(res.body.data.comment.user).toBe(userId);
      commentId = res.body.data.comment._id;
    });

    it("should not create a comment without text", async () => {
      const res = await request(app)
        .post(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments`
        )
        .set("Authorization", `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(res.body.status).toBe("fail");
    });

    it("should not create a comment without authentication", async () => {
      await request(app)
        .post(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments`
        )
        .send({ text: "No auth" })
        .expect(401);
    });

    it("should return 404 for non-existent task", async () => {
      const fakeTaskId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${fakeTaskId}/comments`
        )
        .set("Authorization", `Bearer ${token}`)
        .send({ text: "Comment on invalid task" })
        .expect(404);

      expect(res.body.status).toBe("fail");
    });
  });

  // ════════════════════════════════════════════════
  // READ
  // ════════════════════════════════════════════════
  describe("GET /api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments", () => {
    beforeEach(async () => {
      // Add comments
      await request(app)
        .post(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments`
        )
        .set("Authorization", `Bearer ${token}`)
        .send({ text: "First comment" });

      await request(app)
        .post(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments`
        )
        .set("Authorization", `Bearer ${token}`)
        .send({ text: "Second comment" });
    });

    it("should get all comments for a task", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.status).toBe("success");
      expect(Array.isArray(res.body.data.comments)).toBe(true);
      expect(res.body.data.comments.length).toBe(2);
    });

    it("should get a single comment by ID", async () => {
      const createRes = await request(app)
        .post(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments`
        )
        .set("Authorization", `Bearer ${token}`)
        .send({ text: "Find me" });

      commentId = createRes.body.data.comment._id;

      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments/${commentId}`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.status).toBe("success");
      expect(res.body.data.comment.text).toBe("Find me");
    });

    it("should return 404 for non-existent comment", async () => {
      const fakeCommentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments/${fakeCommentId}`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(404);

      expect(res.body.status).toBe("fail");
    });

    it("should not get comments without auth", async () => {
      await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments`
        )
        .expect(401);
    });
  });

  // ════════════════════════════════════════════════
  // UPDATE
  // ════════════════════════════════════════════════
  describe("PATCH /comments/:commentId", () => {
    beforeEach(async () => {
      const createRes = await request(app)
        .post(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments`
        )
        .set("Authorization", `Bearer ${token}`)
        .send({ text: "Old comment" });

      commentId = createRes.body.data.comment._id;
    });

    it("should update comment text", async () => {
      const res = await request(app)
        .patch(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments/${commentId}`
        )
        .set("Authorization", `Bearer ${token}`)
        .send({ text: "Updated text" })
        .expect(200);

      expect(res.body.status).toBe("success");
      expect(res.body.data.comment.text).toBe("Updated text");
    });

    it("should not update without auth", async () => {
      await request(app)
        .patch(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments/${commentId}`
        )
        .send({ text: "No token" })
        .expect(401);
    });
  });

  // ════════════════════════════════════════════════
  // DELETE
  // ════════════════════════════════════════════════
  describe("DELETE /comments/:commentId", () => {
    beforeEach(async () => {
      const createRes = await request(app)
        .post(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments`
        )
        .set("Authorization", `Bearer ${token}`)
        .send({ text: "Delete me" });

      commentId = createRes.body.data.comment._id;
    });

    it("should delete a comment", async () => {
      const res = await request(app)
        .delete(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments/${commentId}`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(204);

      expect(res.body).toEqual({});
    });

    it("should not delete comment without auth", async () => {
      await request(app)
        .delete(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments/${commentId}`
        )
        .expect(401);
    });
  });
});
