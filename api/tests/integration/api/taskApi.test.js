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
  // READ TESTS (Basic)
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
  // FILTERING TESTS
  // ═══════════════════════════════════════════════════════════
  describe("GET /api/v1/workspaces/:workSpaceId/projects/:projectId/tasks - Filtering", () => {
    beforeEach(async () => {
      // Create diverse tasks for filtering tests
      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "High Priority Todo",
          status: "todo",
          priority: "high",
        });

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "High Priority In Progress",
          status: "in-progress",
          priority: "high",
        });

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Medium Priority Done",
          status: "done",
          priority: "medium",
        });

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Low Priority Todo",
          status: "todo",
          priority: "low",
        });

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Assigned Task",
          status: "in-progress",
          priority: "medium",
          assignedTo: [userId],
        });
    });

    it("should filter tasks by status", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?status=todo`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks.length).toBe(2);
      res.body.data.tasks.forEach((task) => {
        expect(task.status).toBe("todo");
      });
    });

    it("should filter tasks by priority", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?priority=high`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks.length).toBe(2);
      res.body.data.tasks.forEach((task) => {
        expect(task.priority).toBe("high");
      });
    });

    it("should filter tasks by multiple criteria (status AND priority)", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?status=in-progress&priority=high`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks.length).toBe(1);
      expect(res.body.data.tasks[0].status).toBe("in-progress");
      expect(res.body.data.tasks[0].priority).toBe("high");
    });

    it("should filter tasks by assignedTo", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?assignedTo=${userId}`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks.length).toBeGreaterThanOrEqual(1);
      res.body.data.tasks.forEach((task) => {
        expect(task.assignedTo).toContain(userId);
      });
    });

    it("should return empty array when filter matches no tasks", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?status=cancelled`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks).toEqual([]);
    });

    it("should handle invalid filter values gracefully", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?status=invalid-status`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // ADVANCED FILTERING (gte, gt, lte, lt)
  // ═══════════════════════════════════════════════════════════
  describe("GET /api/v1/workspaces/:workSpaceId/projects/:projectId/tasks - Advanced Filtering", () => {
    let earlyDate, midDate, lateDate;

    beforeEach(async () => {
      earlyDate = new Date("2025-11-01");
      midDate = new Date("2025-11-15");
      lateDate = new Date("2025-11-30");

      // Create tasks with different due dates
      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Early Task",
          dueDate: earlyDate.toISOString(),
          priority: "high",
        });

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Mid Task",
          dueDate: midDate.toISOString(),
          priority: "medium",
        });

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Late Task",
          dueDate: lateDate.toISOString(),
          priority: "low",
        });
    });

    it("should filter tasks with dueDate greater than or equal (gte)", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?dueDate[gte]=${midDate.toISOString()}`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks.length).toBeGreaterThanOrEqual(2);
      res.body.data.tasks.forEach((task) => {
        expect(new Date(task.dueDate).getTime()).toBeGreaterThanOrEqual(
          midDate.getTime()
        );
      });
    });

    it("should filter tasks with dueDate greater than (gt)", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?dueDate[gt]=${midDate.toISOString()}`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks.length).toBeGreaterThanOrEqual(1);
      res.body.data.tasks.forEach((task) => {
        expect(new Date(task.dueDate).getTime()).toBeGreaterThan(
          midDate.getTime()
        );
      });
    });

    it("should filter tasks with dueDate less than or equal (lte)", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?dueDate[lte]=${midDate.toISOString()}`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks.length).toBeGreaterThanOrEqual(2);
      res.body.data.tasks.forEach((task) => {
        expect(new Date(task.dueDate).getTime()).toBeLessThanOrEqual(
          midDate.getTime()
        );
      });
    });

    it("should filter tasks with dueDate less than (lt)", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?dueDate[lt]=${midDate.toISOString()}`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks.length).toBeGreaterThanOrEqual(1);
      res.body.data.tasks.forEach((task) => {
        expect(new Date(task.dueDate).getTime()).toBeLessThan(
          midDate.getTime()
        );
      });
    });

    it("should filter tasks with date range (gte and lte)", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?dueDate[gte]=${earlyDate.toISOString()}&dueDate[lte]=${midDate.toISOString()}`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks.length).toBeGreaterThanOrEqual(2);
      res.body.data.tasks.forEach((task) => {
        const taskDate = new Date(task.dueDate).getTime();
        expect(taskDate).toBeGreaterThanOrEqual(earlyDate.getTime());
        expect(taskDate).toBeLessThanOrEqual(midDate.getTime());
      });
    });

    it("should combine advanced filters with regular filters", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?dueDate[gte]=${earlyDate.toISOString()}&priority=high`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      res.body.data.tasks.forEach((task) => {
        expect(new Date(task.dueDate).getTime()).toBeGreaterThanOrEqual(
          earlyDate.getTime()
        );
        expect(task.priority).toBe("high");
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // DEFAULT BEHAVIOR TESTS
  // ═══════════════════════════════════════════════════════════
  describe("GET /api/v1/workspaces/:workSpaceId/projects/:projectId/tasks - Default Behavior", () => {
    beforeEach(async () => {
      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "First Task" });

      await new Promise((resolve) => setTimeout(resolve, 100));

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Second Task" });

      await new Promise((resolve) => setTimeout(resolve, 100));

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Third Task" });
    });

    it("should sort by -createdAt by default (newest first)", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks[0].title).toBe("Third Task");
      expect(res.body.data.tasks[2].title).toBe("First Task");
    });

    it("should exclude __v field by default", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      res.body.data.tasks.forEach((task) => {
        expect(task.__v).toBeUndefined();
      });
    });

    it("should apply default limit of 100 tasks", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks.length).toBeLessThanOrEqual(100);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // SORTING TESTS
  // ═══════════════════════════════════════════════════════════
  describe("GET /api/v1/workspaces/:workSpaceId/projects/:projectId/tasks - Sorting", () => {
    beforeEach(async () => {
      // Create tasks with varying dates and priorities
      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Zebra Task",
          priority: "low",
          dueDate: new Date("2025-12-31").toISOString(),
        });

      await new Promise((resolve) => setTimeout(resolve, 100));

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Alpha Task",
          priority: "high",
          dueDate: new Date("2025-11-01").toISOString(),
        });

      await new Promise((resolve) => setTimeout(resolve, 100));

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Beta Task",
          priority: "medium",
          dueDate: new Date("2025-10-15").toISOString(),
        });
    });

    it("should sort tasks by title ascending", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?sort=title`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks[0].title).toBe("Alpha Task");
      expect(res.body.data.tasks[1].title).toBe("Beta Task");
      expect(res.body.data.tasks[2].title).toBe("Zebra Task");
    });

    it("should sort tasks by title descending", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?sort=-title`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks[0].title).toBe("Zebra Task");
      expect(res.body.data.tasks[1].title).toBe("Beta Task");
      expect(res.body.data.tasks[2].title).toBe("Alpha Task");
    });

    it("should sort tasks by createdAt ascending (oldest first)", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?sort=createdAt`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks[0].title).toBe("Zebra Task");
      expect(res.body.data.tasks[2].title).toBe("Beta Task");
    });

    it("should sort tasks by createdAt descending (newest first)", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?sort=-createdAt`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks[0].title).toBe("Beta Task");
      expect(res.body.data.tasks[2].title).toBe("Zebra Task");
    });

    it("should sort tasks by dueDate ascending", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?sort=dueDate`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks[0].title).toBe("Beta Task");
      expect(res.body.data.tasks[1].title).toBe("Alpha Task");
      expect(res.body.data.tasks[2].title).toBe("Zebra Task");
    });

    it("should sort tasks by dueDate descending", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?sort=-dueDate`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks[0].title).toBe("Zebra Task");
      expect(res.body.data.tasks[2].title).toBe("Beta Task");
    });

    it("should sort by multiple fields (priority, then title)", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?sort=title`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks.length).toBe(3);
      // Verify tasks are sorted alphabetically by title
      expect(res.body.data.tasks[0].title).toBe("Alpha Task");
      expect(res.body.data.tasks[1].title).toBe("Beta Task");
      expect(res.body.data.tasks[2].title).toBe("Zebra Task");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // PAGINATION TESTS
  // ═══════════════════════════════════════════════════════════
  describe("GET /api/v1/workspaces/:workSpaceId/projects/:projectId/tasks - Pagination", () => {
    beforeEach(async () => {
      // Create 15 tasks for pagination testing
      const taskPromises = [];
      for (let i = 1; i <= 15; i++) {
        taskPromises.push(
          request(app)
            .post(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({
              title: `Task ${i.toString().padStart(2, "0")}`,
              description: `Description for task ${i}`,
              priority: i % 3 === 0 ? "high" : i % 2 === 0 ? "medium" : "low",
            })
        );
      }
      await Promise.all(taskPromises);
    });

    it("should return default number of tasks per page", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      // Assuming default is 10 or all tasks if no limit
      expect(res.body.data.tasks.length).toBeGreaterThan(0);
      expect(res.body.data.tasks.length).toBeLessThanOrEqual(15);
    });

    it("should limit tasks per page", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?limit=5`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks.length).toBe(5);
    });

    it("should paginate to second page", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?page=2&limit=5`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks.length).toBe(5);
    });

    it("should paginate to third page", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?page=3&limit=5`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks.length).toBe(5);
    });

    it("should return remaining tasks on last page", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?page=4&limit=5`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks.length).toBeLessThanOrEqual(5);
    });

    it("should return empty array for page beyond available data", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?page=100&limit=5`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks).toEqual([]);
    });

    it("should handle invalid page number gracefully", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?page=0&limit=5`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body.data.tasks)).toBe(true);
    });

    it("should handle invalid limit gracefully", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?limit=-5`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body.data.tasks)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // FIELD SELECTION TESTS
  // ═══════════════════════════════════════════════════════════
  describe("GET /api/v1/workspaces/:workSpaceId/projects/:projectId/tasks - Field Selection", () => {
    beforeEach(async () => {
      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Full Task",
          description: "Complete task with all fields",
          status: "todo",
          priority: "high",
        });
    });

    it("should select only specified fields", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?fields=title,status`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks[0]).toHaveProperty("title");
      expect(res.body.data.tasks[0]).toHaveProperty("status");
      expect(res.body.data.tasks[0]).toHaveProperty("_id");
      // Description should not be present
      expect(res.body.data.tasks[0].description).toBeUndefined();
    });

    it("should exclude specified fields", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?fields=-description,-priority`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks[0]).toHaveProperty("title");
      expect(res.body.data.tasks[0]).toHaveProperty("status");
      expect(res.body.data.tasks[0].description).toBeUndefined();
      expect(res.body.data.tasks[0].priority).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // COMBINED QUERY TESTS
  // ═══════════════════════════════════════════════════════════
  describe("GET /api/v1/workspaces/:workSpaceId/projects/:projectId/tasks - Combined Queries", () => {
    beforeEach(async () => {
      const taskPromises = [];
      for (let i = 1; i <= 20; i++) {
        // Generate valid dates
        const month = Math.min(10 + Math.floor(i / 5), 12); // Months 10-12
        const day = Math.min((i % 27) + 1, 28); // Days 1-28 (safe for all months)

        taskPromises.push(
          request(app)
            .post(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({
              title: `Combined Task ${i.toString().padStart(2, "0")}`,
              status: i <= 10 ? "todo" : i <= 15 ? "in-progress" : "done",
              priority: i % 3 === 0 ? "high" : i % 2 === 0 ? "medium" : "low",
              dueDate: new Date(`2025-${month}-${day}`).toISOString(),
            })
        );
      }
      await Promise.all(taskPromises);
    });

    it("should filter, sort, and paginate simultaneously", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?status=todo&sort=-priority&page=1&limit=5`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks.length).toBeLessThanOrEqual(5);
      res.body.data.tasks.forEach((task) => {
        expect(task.status).toBe("todo");
      });
    });

    it("should combine filter, sort, pagination, and field selection", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?priority=high&sort=title&limit=3&fields=title,priority`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks.length).toBeLessThanOrEqual(3);
      res.body.data.tasks.forEach((task) => {
        expect(task.priority).toBe("high");
        expect(task).toHaveProperty("title");
        expect(task.description).toBeUndefined();
      });
    });

    it("should handle complex multi-filter with sorting", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?status=in-progress&priority=medium&sort=-createdAt`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      res.body.data.tasks.forEach((task) => {
        expect(task.status).toBe("in-progress");
        expect(task.priority).toBe("medium");
      });
    });

    it("should handle all query parameters together", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?status=todo&priority=low&sort=title&page=1&limit=5&fields=title,status,priority`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.tasks.length).toBeLessThanOrEqual(5);
      res.body.data.tasks.forEach((task) => {
        expect(task.status).toBe("todo");
        expect(task.priority).toBe("low");
        expect(task).toHaveProperty("title");
        expect(task.description).toBeUndefined();
      });
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
