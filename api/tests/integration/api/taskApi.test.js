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
let secondUserId;
let secondToken;

beforeAll(async () => {
  await connectTestDB();
}, 30000);

afterEach(async () => {
  await clearDB();
});

afterAll(async () => {
  await disconnectTestDB();
});

describe("Task API (Nested under Workspace > Project)", () => {
  beforeEach(async () => {
    // 1️⃣ Create and login first user
    const signupRes = await request(app).post("/api/v1/users/signup").send({
      name: "Test User",
      email: "testuser@example.com",
      password: "12345678",
      passwordConfirm: "12345678",
    });

    token = signupRes.body.token;
    userId = signupRes.body.data.user._id;

    // 2️⃣ Create second user for assignment tests
    const secondUserRes = await request(app).post("/api/v1/users/signup").send({
      name: "Second User",
      email: "seconduser@example.com",
      password: "12345678",
      passwordConfirm: "12345678",
    });

    secondToken = secondUserRes.body.token;
    secondUserId = secondUserRes.body.data.user._id;

    // 3️⃣ Create a workspace
    const wsRes = await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Task Workspace",
        description: "Test workspace for tasks",
      });

    workspaceId = wsRes.body.data.workSpace._id;

    // 4️⃣ Create a project with groups
    const projectRes = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Task Project",
        description: "Project for task testing",
      });

    projectId = projectRes.body.data.project._id;
  });

  // ═══════════════════════════════════════════════════════════
  // CREATE TESTS
  // ═══════════════════════════════════════════════════════════
  describe("POST /api/v1/workspaces/:workSpaceId/projects/:projectId/tasks", () => {
    it("should create a new task in a project", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "New Task",
          description: "Task description",
          status: "todo",
          priority: "high",
        })
        .expect(201);

      expect(res.body.status).toBe("success");
      expect(res.body.data.task.title).toBe("New Task");
      expect(res.body.data.task.description).toBe("Task description");
      expect(res.body.data.task.status).toBe("todo");
      expect(res.body.data.task.priority).toBe("high");
      expect(res.body.data.task.project).toBe(projectId);
      expect(res.body.data.task.createdBy).toBe(userId);
      expect(res.body.data.task._id).toBeDefined();
      expect(res.body.data.task.createdAt).toBeDefined();

      taskId = res.body.data.task._id;
    });

    it("should create task with default values", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Minimal Task",
        })
        .expect(201);

      expect(res.body.data.task.status).toBe("todo");
      expect(res.body.data.task.priority).toBe("medium");
      expect(res.body.data.task.groupId).toBeDefined();
    });

    it("should create task with assignedTo array", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Assigned Task",
          assignedTo: [userId, secondUserId],
        })
        .expect(201);

      expect(res.body.data.task.assignedTo).toHaveLength(2);
      expect(res.body.data.task.assignedTo).toContain(userId);
      expect(res.body.data.task.assignedTo).toContain(secondUserId);
    });

    it("should create task with dueDate", async () => {
      const dueDate = new Date("2025-12-31");

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Task with Due Date",
          dueDate: dueDate.toISOString(),
        })
        .expect(201);

      expect(new Date(res.body.data.task.dueDate).toISOString()).toBe(
        dueDate.toISOString()
      );
    });

    it("should create task with specific groupId", async () => {
      const projectRes = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`);
      const validGroupId = projectRes.body.data.project.groups[0].id;
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Task in specific group",
          groupId: validGroupId,
        })
        .expect(201);

      expect(res.body.data.task.groupId).toBe(validGroupId);
    });

    it("should not create task without auth", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .send({ title: "No Auth Task" })
        .expect(401);

      expect(res.body.status).toBe("fail");
    });

    it("should not create task without title", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          description: "No title provided",
        })
        .expect(400);

      expect(res.body.status).toBe("fail");
    });

    it("should not create task with invalid status", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Invalid Status Task",
          status: "invalid-status",
        })
        .expect(400);

      expect(res.body.status).toBe("fail");
    });

    it("should not create task with invalid priority", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Invalid Priority Task",
          priority: "urgent",
        })
        .expect(400);

      expect(res.body.status).toBe("fail");
    });

    it("should not create task with invalid groupId", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Invalid Group Task",
          groupId: "non-existent-group",
        })
        .expect(400);

      expect(res.body.status).toBe("fail");
      expect(res.body.message).toContain("Invalid groupId");
    });

    it("should not create task with non-existent project", async () => {
      const fakeProjectId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .post(
          `/api/v1/workspaces/${workspaceId}/projects/${fakeProjectId}/tasks`
        )
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Task in non-existent project",
        })
        .expect(404);

      expect(res.body.status).toBe("fail");
      expect(res.body.message).toContain("Project not found");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // READ TESTS
  // ═══════════════════════════════════════════════════════════
  describe("GET /api/v1/workspaces/:workSpaceId/projects/:projectId/tasks", () => {
    beforeEach(async () => {
      // Create multiple tasks for testing
      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Task Alpha",
          description: "First task",
          status: "todo",
          priority: "high",
        });

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Task Beta",
          description: "Second task",
          status: "in-progress",
          priority: "medium",
        });

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Task Gamma",
          description: "Third task",
          status: "done",
          priority: "low",
        });

      taskId = res.body.data.task._id;
    });

    it("should get all tasks in a project", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.status).toBe("success");
      expect(Array.isArray(res.body.data.tasks)).toBe(true);
      expect(res.body.data.tasks.length).toBe(3);
      expect(res.body.data.tasks[0].project).toBe(projectId);
    });

    it("should get a specific task by ID", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.status).toBe("success");
      expect(res.body.data.task._id).toBe(taskId);
      expect(res.body.data.task.title).toBe("Task Gamma");
    });

    it("should populate comments virtual field when getting single task", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.task).toHaveProperty("comments");
    });

    it("should return 404 for non-existent task", async () => {
      const fakeTaskId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${fakeTaskId}`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(404);

      expect(res.body.status).toBe("fail");
    });

    it("should not get tasks without authentication", async () => {
      await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .expect(401);
    });

    it("should return empty array for project with no tasks", async () => {
      // Create new project with no tasks
      const newProjectRes = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Empty Project",
          description: "No tasks here",
        });

      const emptyProjectId = newProjectRes.body.data.project._id;

      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${emptyProjectId}/tasks`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // STATS TESTS
  // ═══════════════════════════════════════════════════════════
  describe("GET /api/v1/workspaces/:workSpaceId/projects/:projectId/tasks/stats/by-user", () => {
    beforeEach(async () => {
      // Create tasks assigned to different users
      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "User 1 Task 1",
          status: "todo",
          assignedTo: [userId],
        });

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "User 1 Task 2",
          status: "in-progress",
          assignedTo: [userId],
        });

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "User 1 Task 3",
          status: "done",
          assignedTo: [userId],
        });

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "User 2 Task 1",
          status: "todo",
          assignedTo: [secondUserId],
        });

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "User 2 Task 2",
          status: "done",
          assignedTo: [secondUserId],
        });
    });

    it("should get task statistics by user", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/stats/by-user`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.status).toBe("success");
      expect(Array.isArray(res.body.data.tasksByUser)).toBe(true);
      expect(res.body.data.tasksByUser.length).toBeGreaterThan(0);
    });

    it("should include correct task counts per user", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/stats/by-user`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const userStat = res.body.data.tasksByUser.find(
        (stat) => stat.userId === userId
      );

      expect(userStat).toBeDefined();
      expect(userStat.totalTasks).toBe(3);
      expect(userStat.completeTasks).toBe(1);
      expect(userStat.inProgressTasks).toBe(1);
      expect(userStat.toDoTasks).toBe(1);
    });

    it("should include user information in stats", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/stats/by-user`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasksByUser[0]).toHaveProperty("userId");
      expect(res.body.data.tasksByUser[0]).toHaveProperty("userName");
      expect(res.body.data.tasksByUser[0]).toHaveProperty("totalTasks");
      expect(res.body.data.tasksByUser[0]).toHaveProperty("completeTasks");
      expect(res.body.data.tasksByUser[0]).toHaveProperty("inProgressTasks");
      expect(res.body.data.tasksByUser[0]).toHaveProperty("toDoTasks");
    });

    it("should return empty array for project with no assigned tasks", async () => {
      // Create new project
      const newProjectRes = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "No Assigned Tasks Project",
        });

      const newProjectId = newProjectRes.body.data.project._id;

      // Create task without assignedTo
      await request(app)
        .post(
          `/api/v1/workspaces/${workspaceId}/projects/${newProjectId}/tasks`
        )
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Unassigned Task",
        });

      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${newProjectId}/tasks/stats/by-user`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasksByUser).toEqual([]);
    });

    it("should not get stats without authentication", async () => {
      await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/stats/by-user`
        )
        .expect(401);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // EDGE CASES & BUSINESS LOGIC
  // ═══════════════════════════════════════════════════════════
  describe("Edge Cases & Business Logic", () => {
    it("should handle invalid MongoDB ObjectId gracefully", async () => {
      await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/invalid-id-123`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(400);
    });

    it("should handle very long task titles", async () => {
      const longTitle = "A".repeat(500);

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: longTitle,
          description: "Testing length limits",
        });

      // Expect either 201 (if no limit) or 400 (if limit enforced)
      expect([201, 400]).toContain(res.status);
    });

    it("should handle tasks with past due dates", async () => {
      const pastDate = new Date("2020-01-01");

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Overdue Task",
          dueDate: pastDate.toISOString(),
          status: "todo",
        })
        .expect(201);

      expect(new Date(res.body.data.task.dueDate)).toEqual(pastDate);
    });

    it("should handle tasks with future due dates", async () => {
      const futureDate = new Date("2030-12-31");

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Future Task",
          dueDate: futureDate.toISOString(),
        })
        .expect(201);

      expect(new Date(res.body.data.task.dueDate)).toEqual(futureDate);
    });

    it("should handle empty assignedTo array", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Unassigned Task",
          assignedTo: [],
        })
        .expect(201);

      expect(res.body.data.task.assignedTo).toEqual([]);
    });

    it("should handle tasks with whitespace in title", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "  Task with spaces  ",
        })
        .expect(201);

      // Assuming the schema trims whitespace
      expect(res.body.data.task.title).toBe("Task with spaces");
    });

    it("should create multiple tasks with same title", async () => {
      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Duplicate Title",
        })
        .expect(201);

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Duplicate Title",
        })
        .expect(201);

      expect(res.body.data.task.title).toBe("Duplicate Title");
    });

    it("should handle task creation with all optional fields", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Full Task",
          description: "Complete description",
          status: "in-progress",
          priority: "high",
          dueDate: new Date("2025-12-31").toISOString(),
          assignedTo: [userId, secondUserId],
        })
        .expect(201);

      expect(res.body.data.task.title).toBe("Full Task");
      expect(res.body.data.task.description).toBe("Complete description");
      expect(res.body.data.task.status).toBe("in-progress");
      expect(res.body.data.task.priority).toBe("high");
      expect(res.body.data.task.dueDate).toBeDefined();
      expect(res.body.data.task.assignedTo).toHaveLength(2);
    });
  });
});
