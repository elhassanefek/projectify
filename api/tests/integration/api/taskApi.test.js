const request = require("supertest");
const mongoose = require("mongoose");
const { io: Client } = require("socket.io-client");
const http = require("http");
const socketConfig = require("../../../src/config/socket");
const app = require("../../../src/app");
const jwt = require("jsonwebtoken");
const {
  connectTestDB,
  clearDB,
  disconnectTestDB,
} = require("../../helpers/testDbHelper");
const { resolve } = require("path");

let token;
let userId;
let workspaceId;
let projectId;
let taskId;
let secondUserId;
let secondToken;
let server;
let clientSocket;

beforeAll(async () => {
  await connectTestDB();

  // Create HTTP + Socket server
  server = http.createServer(app);
  socketConfig.initialize(server);

  // Start listening and connect socket client (unauthenticated for now)
  await new Promise((resolve) => {
    server.listen(() => {
      resolve();
    });
  });
}, 30000);

afterEach(async () => {
  if (clientSocket && clientSocket.connect) clientSocket.disconnect();
  await clearDB();
});

afterAll(async () => {
  if (clientSocket) clientSocket.close();
  if (server)
    await new Promise((resolve) => {
      server.close(resolve);
    });
  await disconnectTestDB();
});

describe("Task API (Nested under Workspace > Project)", () => {
  beforeEach(async () => {
    // 1️ Create and login first user
    const signupRes = await request(app).post("/api/v1/users/signup").send({
      name: "Test User",
      email: "testuser@example.com",
      password: "12345678",
      passwordConfirm: "12345678",
    });

    token = signupRes.body.token;
    userId = signupRes.body.data.user._id;
    const port = server.address().port;

    clientSocket = new Client(`http://localhost:${port}`, {
      auth: { token }, // real token
      reconnection: false,
    });

    await new Promise((resolve, reject) => {
      clientSocket.once("connect", resolve);
      clientSocket.once("connect_error", (err) => reject(err));
    });

    // 2 Create second user
    const secondUserRes = await request(app).post("/api/v1/users/signup").send({
      name: "Second User",
      email: "seconduser@example.com",
      password: "12345678",
      passwordConfirm: "12345678",
    });

    secondToken = secondUserRes.body.token;
    secondUserId = secondUserRes.body.data.user._id;

    // 3️ Create a workspace
    const wsRes = await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Task Workspace",
        description: "Test workspace for tasks",
      });

    workspaceId = wsRes.body.data.workSpace._id;
    clientSocket.emit("join:workspace", workspaceId);

    // 4️ Create a project
    const projectRes = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Task Project",
        description: "Project for task testing",
      });

    projectId = projectRes.body.data.project._id;
    clientSocket.emit("join:project", projectId);
  });
  // ═══════════════════════════════════════════════════════════
  // CREATE TESTS
  // ═══════════════════════════════════════════════════════════
  describe("POST /api/v1/workspaces/:workSpaceId/projects/:projectId/tasks", () => {
    describe("Socket Events", () => {
      it("should create a new task and emit 'task:created' event", async () => {
        const socketPromise = new Promise((resolve) => {
          clientSocket.once("task:created", (data) => {
            resolve(data);
          });
        });

        const res = await request(app)
          .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
          .set("Authorization", `Bearer ${token}`)
          .send({
            title: "Socket Event Task",
            description: "This triggers a socket event",
            status: "todo",
            priority: "high",
          })
          .expect(201);

        expect(res.body.status).toBe("success");

        const socketEvent = await socketPromise;
        expect(socketEvent.task).toBeDefined();
        expect(socketEvent.task.title).toBe("Socket Event Task");
        expect(socketEvent.task.project).toBe(projectId);
      });

      it("should emit 'task:created' with correct metadata", async () => {
        const socketPromise = new Promise((resolve) => {
          clientSocket.once("task:created", (data) => {
            resolve(data);
          });
        });

        await request(app)
          .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
          .set("Authorization", `Bearer ${token}`)
          .send({
            title: "Metadata Task",
            priority: "low",
          })
          .expect(201);

        const socketEvent = await socketPromise;
        expect(socketEvent).toHaveProperty("task");
        expect(socketEvent).toHaveProperty("createdBy");
        expect(socketEvent).toHaveProperty("timestamp");
        expect(socketEvent.createdBy).toBe(userId);
        expect(new Date(socketEvent.timestamp)).toBeInstanceOf(Date);
      });

      it("should emit 'task:assigned' to assigned users when task is created", async () => {
        // Create second client socket for second user
        const port = server.address().port;
        const secondClientSocket = new Client(`http://localhost:${port}`, {
          auth: { token: secondToken },
          reconnection: false,
        });

        await new Promise((resolve, reject) => {
          secondClientSocket.once("connect", resolve);
          secondClientSocket.once("connect_error", (err) => reject(err));
        });

        // Join the project with second user socket
        secondClientSocket.emit("join:project", projectId);

        const assignmentPromise = new Promise((resolve) => {
          secondClientSocket.once("task:assigned", (data) => {
            resolve(data);
          });
        });

        // Create task assigned to second user
        await request(app)
          .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
          .set("Authorization", `Bearer ${token}`)
          .send({
            title: "Assigned Task",
            assignedTo: [secondUserId],
          })
          .expect(201);

        const assignmentEvent = await assignmentPromise;
        expect(assignmentEvent).toHaveProperty("task");
        expect(assignmentEvent).toHaveProperty("assignedBy");
        expect(assignmentEvent).toHaveProperty("message");
        expect(assignmentEvent.task.title).toBe("Assigned Task");
        expect(assignmentEvent.assignedBy).toBe(userId);
        expect(assignmentEvent.message).toContain("You've been assigned to");

        secondClientSocket.disconnect();
        secondClientSocket.close();
      });

      it("should NOT emit 'task:assigned' to the user who created and assigned themselves", async () => {
        let assignmentReceived = false;

        clientSocket.once("task:assigned", () => {
          assignmentReceived = true;
        });

        // Create task and assign to self
        await request(app)
          .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
          .set("Authorization", `Bearer ${token}`)
          .send({
            title: "Self Assigned Task",
            assignedTo: [userId],
          })
          .expect(201);

        // Wait a bit to ensure no event is emitted
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(assignmentReceived).toBe(false);
      });

      it("should emit 'task:assigned' to multiple assigned users", async () => {
        const port = server.address().port;
        const secondClientSocket = new Client(`http://localhost:${port}`, {
          auth: { token: secondToken },
          reconnection: false,
        });

        await new Promise((resolve, reject) => {
          secondClientSocket.once("connect", resolve);
          secondClientSocket.once("connect_error", (err) => reject(err));
        });

        secondClientSocket.emit("join:project", projectId);

        // Create third user
        const thirdUserRes = await request(app)
          .post("/api/v1/users/signup")
          .send({
            name: "Third User",
            email: "thirduser@example.com",
            password: "12345678",
            passwordConfirm: "12345678",
          });

        const thirdToken = thirdUserRes.body.token;
        const thirdUserId = thirdUserRes.body.data.user._id;

        const thirdClientSocket = new Client(`http://localhost:${port}`, {
          auth: { token: thirdToken },
          reconnection: false,
        });

        await new Promise((resolve, reject) => {
          thirdClientSocket.once("connect", resolve);
          thirdClientSocket.once("connect_error", (err) => reject(err));
        });

        thirdClientSocket.emit("join:project", projectId);

        const assignmentPromises = [
          new Promise((resolve) => {
            secondClientSocket.once("task:assigned", (data) => resolve(data));
          }),
          new Promise((resolve) => {
            thirdClientSocket.once("task:assigned", (data) => resolve(data));
          }),
        ];

        // Create task assigned to both users
        await request(app)
          .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
          .set("Authorization", `Bearer ${token}`)
          .send({
            title: "Multi-Assigned Task",
            assignedTo: [secondUserId, thirdUserId],
          })
          .expect(201);

        const [event1, event2] = await Promise.all(assignmentPromises);

        expect(event1.task.title).toBe("Multi-Assigned Task");
        expect(event2.task.title).toBe("Multi-Assigned Task");
        expect(event1.assignedBy).toBe(userId);
        expect(event2.assignedBy).toBe(userId);

        secondClientSocket.disconnect();
        secondClientSocket.close();
        thirdClientSocket.disconnect();
        thirdClientSocket.close();
      });

      it("should emit 'task:created' to all project members", async () => {
        const port = server.address().port;
        const secondClientSocket = new Client(`http://localhost:${port}`, {
          auth: { token: secondToken },
          reconnection: false,
        });

        await new Promise((resolve, reject) => {
          secondClientSocket.once("connect", resolve);
          secondClientSocket.once("connect_error", (err) => reject(err));
        });

        secondClientSocket.emit("join:project", projectId);

        const socketPromises = [
          new Promise((resolve) => {
            clientSocket.once("task:created", (data) => resolve(data));
          }),
          new Promise((resolve) => {
            secondClientSocket.once("task:created", (data) => resolve(data));
          }),
        ];

        await request(app)
          .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
          .set("Authorization", `Bearer ${token}`)
          .send({
            title: "Broadcast Task",
          })
          .expect(201);

        const [event1, event2] = await Promise.all(socketPromises);

        expect(event1.task.title).toBe("Broadcast Task");
        expect(event2.task.title).toBe("Broadcast Task");

        secondClientSocket.disconnect();
        secondClientSocket.close();
      });

      it("should emit socket event even when task creation has default values", async () => {
        const socketPromise = new Promise((resolve) => {
          clientSocket.once("task:created", (data) => {
            resolve(data);
          });
        });

        await request(app)
          .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
          .set("Authorization", `Bearer ${token}`)
          .send({
            title: "Default Values Task",
          })
          .expect(201);

        const socketEvent = await socketPromise;
        expect(socketEvent.task.status).toBe("todo");
        expect(socketEvent.task.priority).toBe("medium");
      });

      it("should NOT emit socket event if task creation fails", async () => {
        let eventReceived = false;

        clientSocket.once("task:created", () => {
          eventReceived = true;
        });

        // Try to create task without title (should fail)
        await request(app)
          .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
          .set("Authorization", `Bearer ${token}`)
          .send({
            description: "No title",
          })
          .expect(400);

        // Wait to ensure no event is emitted
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(eventReceived).toBe(false);
      });

      it("should include timestamp in task:created event", async () => {
        const beforeTime = new Date();

        const socketPromise = new Promise((resolve) => {
          clientSocket.once("task:created", (data) => {
            resolve(data);
          });
        });

        await request(app)
          .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
          .set("Authorization", `Bearer ${token}`)
          .send({
            title: "Timestamp Task",
          })
          .expect(201);

        const afterTime = new Date();
        const socketEvent = await socketPromise;

        const eventTime = new Date(socketEvent.timestamp);
        expect(eventTime.getTime()).toBeGreaterThanOrEqual(
          beforeTime.getTime()
        );
        expect(eventTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
      });

      // it("should emit task:created event with populated task data", async () => {
      //   const socketPromise = new Promise((resolve) => {
      //     clientSocket.once("task:created", (data) => {
      //       resolve(data);
      //     });
      //   });

      //   const dueDate = new Date("2025-12-31");

      //   await request(app)
      //     .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
      //     .set("Authorization", `Bearer ${token}`)
      //     .send({
      //       title: "Complete Task",
      //       description: "Full task with all fields",
      //       status: "in-progress",
      //       priority: "high",
      //       assignedTo: [userId],
      //       dueDate: dueDate.toISOString(),
      //       tags: ["urgent", "backend"],
      //     })
      //     .expect(201);

      //   const socketEvent = await socketPromise;
      //   expect(socketEvent.task.title).toBe("Complete Task");
      //   expect(socketEvent.task.description).toBe("Full task with all fields");
      //   expect(socketEvent.task.status).toBe("in-progress");
      //   expect(socketEvent.task.priority).toBe("high");
      //   expect(socketEvent.task.assignedTo).toContain(userId);
      //   expect(socketEvent.task.tags).toEqual(["urgent", "backend"]);
      // });
    });

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

    // ───────────────────────────────
    // ERROR CASES
    // ───────────────────────────────
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
  //-----------------------------------------------------------
  //-----------------------------------------------------------
  // UPDATE TEESTS
  //---------------------------------------------------------
  describe("UPDATE TESTS", () => {
    describe("PATCH /api/v1/workspaces/:workSpaceId/projects/:projectId/tasks/:taskId", () => {
      beforeEach(async () => {
        // Create a task to update in each test
        const res = await request(app)
          .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
          .set("Authorization", `Bearer ${token}`)
          .send({
            title: "Original Task",
            description: "Original description",
            status: "todo",
            priority: "medium",
            assignedTo: [userId],
          });

        taskId = res.body.data.task._id;
      });

      // ───────────────────────────────
      // BASIC UPDATE TESTS
      // ───────────────────────────────
      describe("Basic Updates", () => {
        it("should update task title", async () => {
          const res = await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Updated Title" })
            .expect(200);
          expect(res.body.status).toBe("success");
          expect(res.body.data.task.title).toBe("Updated Title");
          expect(res.body.data.task._id).toBe(taskId);
        });
        it("should update task description", async () => {
          const res = await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ description: "Updated description" })
            .expect(200);
          expect(res.body.data.task.description).toBe("Updated description");
        });
        it("should update task status", async () => {
          const res = await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ status: "in-progress" })
            .expect(200);
          expect(res.body.data.task.status).toBe("in-progress");
        });
        it("should update task priority", async () => {
          const res = await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ priority: "high" })
            .expect(200);
          expect(res.body.data.task.priority).toBe("high");
        });
        it("should update task dueDate", async () => {
          const newDueDate = new Date("2026-01-15");
          const res = await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ dueDate: newDueDate.toISOString() })
            .expect(200);
          expect(new Date(res.body.data.task.dueDate).toISOString()).toBe(
            newDueDate.toISOString()
          );
        });
        it("should update task assignedTo array", async () => {
          const res = await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ assignedTo: [userId, secondUserId] });
          expect(res.body.status).toBe("success");
          expect(res.body.data.task.assignedTo).toHaveLength(2);
          expect(res.body.data.task.assignedTo).toContain(userId);
          expect(res.body.data.task.assignedTo).toContain(secondUserId);
        });
        it("should update task groupId", async () => {
          // Get valid groupId from project
          const projectRes = await request(app)
            .get(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
            .set("Authorization", `Bearer ${token}`);
          const validGroupId =
            projectRes.body.data.project.groups[1]?.id ||
            projectRes.body.data.project.groups[0].id;
          const res = await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ groupId: validGroupId })
            .expect(200);
          expect(res.body.data.task.groupId).toBe(validGroupId);
        });
        it("should update multiple fields at once", async () => {
          const res = await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({
              title: "Multi-Update Task",
              description: "Multiple fields updated",
              status: "in-progress",
              priority: "high",
            })
            .expect(200);
          expect(res.body.data.task.title).toBe("Multi-Update Task");
          expect(res.body.data.task.description).toBe(
            "Multiple fields updated"
          );
          expect(res.body.data.task.status).toBe("in-progress");
          expect(res.body.data.task.priority).toBe("high");
        });
        it("should preserve fields not being updated", async () => {
          const res = await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Only Title Changed" })
            .expect(200);
          expect(res.body.data.task.title).toBe("Only Title Changed");
          expect(res.body.data.task.description).toBe("Original description");
          expect(res.body.data.task.status).toBe("todo");
          expect(res.body.data.task.priority).toBe("medium");
        });
        it("should update task tags", async () => {
          const res = await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ tags: ["urgent", "backend", "bug"] })
            .expect(200);
          expect(res.body.data.task.tags).toEqual(["urgent", "backend", "bug"]);
        });
      });

      // ───────────────────────────────
      // SOCKET EVENT TESTS
      // ───────────────────────────────
      describe("Socket Events", () => {
        it("should emit 'task:updated' when task is updated", async () => {
          const socketPromise = new Promise((resolve) => {
            clientSocket.once("task:updated", (data) => resolve(data));
          });

          await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Socket Update" })
            .expect(200);

          const socketEvent = await socketPromise;
          console.log(socketEvent);
          expect(socketEvent).toHaveProperty("task");
          expect(socketEvent).toHaveProperty("updatedBy");
          expect(socketEvent).toHaveProperty("changes");
          expect(socketEvent.task.title).toBe("Socket Update");
          expect(socketEvent.updatedBy).toBe(userId);
        });

        it("should emit 'task:updated' with correct changes object", async () => {
          const socketPromise = new Promise((resolve) => {
            clientSocket.once("task:updated", (data) => resolve(data));
          });

          await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({
              title: "Changed Title",
              priority: "high",
            })
            .expect(200);

          const socketEvent = await socketPromise;
          expect(socketEvent.changes).toHaveProperty("title");
          expect(socketEvent.changes).toHaveProperty("priority");
          expect(socketEvent.changes.title.old).toBe("Original Task");
          expect(socketEvent.changes.title.new).toBe("Changed Title");
          expect(socketEvent.changes.priority.old).toBe("medium");
          expect(socketEvent.changes.priority.new).toBe("high");
        });

        it("should emit 'task:status_changed' when status changes", async () => {
          const socketPromise = new Promise((resolve) => {
            clientSocket.once("task:status_changed", (data) => resolve(data));
          });

          await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ status: "in-progress" })
            .expect(200);

          const socketEvent = await socketPromise;
          expect(socketEvent).toHaveProperty("taskId");
          expect(socketEvent).toHaveProperty("oldStatus");
          expect(socketEvent).toHaveProperty("newStatus");
          expect(socketEvent).toHaveProperty("updatedBy");
          expect(socketEvent.taskId).toBe(taskId);
          expect(socketEvent.oldStatus).toBe("todo");
          expect(socketEvent.newStatus).toBe("in-progress");
          expect(socketEvent.updatedBy).toBe(userId);
        });

        it("should emit 'task:priority_changed' when priority changes", async () => {
          const socketPromise = new Promise((resolve) => {
            clientSocket.once("task:priority_changed", (data) => resolve(data));
          });

          await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ priority: "low" })
            .expect(200);

          const socketEvent = await socketPromise;
          expect(socketEvent).toHaveProperty("taskId");
          expect(socketEvent).toHaveProperty("oldPriority");
          expect(socketEvent).toHaveProperty("newPriority");
          expect(socketEvent).toHaveProperty("updatedBy");
          expect(socketEvent.taskId).toBe(taskId);
          expect(socketEvent.oldPriority).toBe("medium");
          expect(socketEvent.newPriority).toBe("low");
          expect(socketEvent.updatedBy).toBe(userId);
        });

        it("should emit 'task:assigned' to newly assigned users", async () => {
          const port = server.address().port;
          const secondClientSocket = new Client(`http://localhost:${port}`, {
            auth: { token: secondToken },
            reconnection: false,
          });

          await new Promise((resolve, reject) => {
            secondClientSocket.once("connect", resolve);
            secondClientSocket.once("connect_error", (err) => reject(err));
          });

          secondClientSocket.emit("join:project", projectId);

          const assignmentPromise = new Promise((resolve) => {
            secondClientSocket.once("task:assigned", (data) => resolve(data));
          });

          await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ assignedTo: [userId, secondUserId] })
            .expect(200);

          const assignmentEvent = await assignmentPromise;
          expect(assignmentEvent).toHaveProperty("task");
          expect(assignmentEvent).toHaveProperty("assignedBy");
          expect(assignmentEvent.task._id).toBe(taskId);
          expect(assignmentEvent.assignedBy).toBe(userId);

          secondClientSocket.disconnect();
          secondClientSocket.close();
        });

        it("should NOT emit 'task:assigned' to already assigned users", async () => {
          let assignmentEventReceived = false;

          clientSocket.once("task:assigned", () => {
            assignmentEventReceived = true;
          });

          await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({
              assignedTo: [userId], // Same user, no new assignment
              description: "Updated description",
            })
            .expect(200);

          await new Promise((resolve) => setTimeout(resolve, 100));

          expect(assignmentEventReceived).toBe(false);
        });

        it("should emit 'task:assigned' only to newly added users, not existing ones", async () => {
          let firstUserAssignmentReceived = false;

          clientSocket.once("task:assigned", () => {
            firstUserAssignmentReceived = true;
          });

          const port = server.address().port;
          const secondClientSocket = new Client(`http://localhost:${port}`, {
            auth: { token: secondToken },
            reconnection: false,
          });

          await new Promise((resolve, reject) => {
            secondClientSocket.once("connect", resolve);
            secondClientSocket.once("connect_error", (err) => reject(err));
          });

          secondClientSocket.emit("join:project", projectId);

          const assignmentPromise = new Promise((resolve) => {
            secondClientSocket.once("task:assigned", (data) => resolve(data));
          });

          await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ assignedTo: [userId, secondUserId] })
            .expect(200);

          const assignmentEvent = await assignmentPromise;

          expect(firstUserAssignmentReceived).toBe(false);
          expect(assignmentEvent.task._id).toBe(taskId);
          expect(assignmentEvent.assignedBy).toBe(userId);

          secondClientSocket.disconnect();
          secondClientSocket.close();
        });

        it("should NOT emit 'task:assigned' to the user making the assignment", async () => {
          let selfAssignmentReceived = false;

          clientSocket.once("task:assigned", () => {
            selfAssignmentReceived = true;
          });

          await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ assignedTo: [userId, secondUserId] })
            .expect(200);

          await new Promise((resolve) => setTimeout(resolve, 100));

          expect(selfAssignmentReceived).toBe(false);
        });

        it("should emit both 'task:updated' and 'task:status-changed' when status changes", async () => {
          const updatedPromise = new Promise((resolve) => {
            clientSocket.once("task:updated", (data) => resolve(data));
          });

          const statusChangedPromise = new Promise((resolve) => {
            clientSocket.once("task:status_changed", (data) => resolve(data));
          });

          await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ status: "done" })
            .expect(200);

          const [updatedEvent, statusEvent] = await Promise.all([
            updatedPromise,
            statusChangedPromise,
          ]);

          expect(updatedEvent.task.status).toBe("done");
          expect(statusEvent.newStatus).toBe("done");
          expect(statusEvent.oldStatus).toBe("todo");
        });

        it("should emit both 'task:updated' and 'task:priority-changed' when priority changes", async () => {
          const updatedPromise = new Promise((resolve) => {
            clientSocket.once("task:updated", (data) => resolve(data));
          });

          const priorityChangedPromise = new Promise((resolve) => {
            clientSocket.once("task:priority_changed", (data) => resolve(data));
          });

          await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ priority: "high" })
            .expect(200);

          const [updatedEvent, priorityEvent] = await Promise.all([
            updatedPromise,
            priorityChangedPromise,
          ]);

          expect(updatedEvent.task.priority).toBe("high");
          expect(priorityEvent.newPriority).toBe("high");
          expect(priorityEvent.oldPriority).toBe("medium");
        });

        it("should emit 'task:updated' to all project members", async () => {
          const port = server.address().port;
          const secondClientSocket = new Client(`http://localhost:${port}`, {
            auth: { token: secondToken },
            reconnection: false,
          });

          await new Promise((resolve, reject) => {
            secondClientSocket.once("connect", resolve);
            secondClientSocket.once("connect_error", (err) => reject(err));
          });

          secondClientSocket.emit("join:project", projectId);

          const socketPromises = [
            new Promise((resolve) => {
              clientSocket.once("task:updated", (data) => resolve(data));
            }),
            new Promise((resolve) => {
              secondClientSocket.once("task:updated", (data) => resolve(data));
            }),
          ];

          await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Broadcast Update" })
            .expect(200);

          const [event1, event2] = await Promise.all(socketPromises);

          expect(event1.task.title).toBe("Broadcast Update");
          expect(event2.task.title).toBe("Broadcast Update");

          secondClientSocket.disconnect();
          secondClientSocket.close();
        });

        it("should NOT emit socket events if update fails", async () => {
          let eventReceived = false;

          clientSocket.once("task:updated", () => {
            eventReceived = true;
          });

          await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ status: "invalid-status" })
            .expect(400);

          await new Promise((resolve) => setTimeout(resolve, 100));

          expect(eventReceived).toBe(false);
        });

        it("should include timestamp in task:updated event", async () => {
          const beforeTime = new Date();

          const socketPromise = new Promise((resolve) => {
            clientSocket.once("task:updated", (data) => resolve(data));
          });

          await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Timestamp Test" })
            .expect(200);

          const afterTime = new Date();
          const socketEvent = await socketPromise;

          if (socketEvent.timestamp) {
            const eventTime = new Date(socketEvent.timestamp);
            expect(eventTime.getTime()).toBeGreaterThanOrEqual(
              beforeTime.getTime()
            );
            expect(eventTime.getTime()).toBeLessThanOrEqual(
              afterTime.getTime()
            );
          }
        });
      });

      // ───────────────────────────────
      // AUTHORIZATION TESTS
      // ───────────────────────────────
      describe("Authorization", () => {
        it("should not update task without authentication", async () => {
          const res = await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .send({ title: "Unauthorized Update" })
            .expect(401);

          expect(res.body.status).toBe("fail");
        });

        it("should not update task with invalid token", async () => {
          const res = await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", "Bearer invalid-token-12345")
            .send({ title: "Invalid Token Update" })
            .expect(401);

          expect(res.body.status).toBe("fail");
        });

        it("should not update task in non-existent project", async () => {
          const fakeProjectId = new mongoose.Types.ObjectId();

          const res = await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${fakeProjectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Update in fake project" })
            .expect(404);

          expect(res.body.status).toBe("fail");
        });
      });

      // ───────────────────────────────
      // VALIDATION TESTS
      // ───────────────────────────────
      describe("Validation", () => {
        it("should not update with invalid status", async () => {
          const res = await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ status: "invalid-status" })
            .expect(400);

          expect(res.body.status).toBe("fail");
        });

        it("should not update with invalid priority", async () => {
          const res = await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ priority: "urgent" })
            .expect(400);

          expect(res.body.status).toBe("fail");
        });

        // it("should not update with invalid groupId", async () => {
        //   const res = await request(app)
        //     .patch(
        //       `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
        //     )
        //     .set("Authorization", `Bearer ${token}`)
        //     .send({ groupId: "non-existent-group-id" })
        //     .expect(400);

        //   expect(res.body.status).toBe("fail");
        //   expect(res.body.message).toContain("Invalid groupId");
        // });

        it("should not update non-existent task", async () => {
          const fakeTaskId = new mongoose.Types.ObjectId();

          const res = await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${fakeTaskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Update fake task" })
            .expect(404);

          expect(res.body.status).toBe("fail");
          expect(res.body.message).toContain("Task not found");
        });

        it("should not update with empty title", async () => {
          const res = await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "" })
            .expect(400);

          expect(res.body.status).toBe("fail");
        });

        it("should not update with whitespace-only title", async () => {
          const res = await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "   " })
            .expect(400);

          expect(res.body.status).toBe("fail");
        });

        it("should handle invalid MongoDB ObjectId gracefully", async () => {
          const res = await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/invalid-id-123`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Update" })
            .expect(400);

          expect(res.body.status).toBe("fail");
        });

        it("should not update with invalid assignedTo (non-array)", async () => {
          const res = await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ assignedTo: "not-an-array" })
            .expect(400);

          expect(res.body.status).toBe("fail");
        });

        it("should not update with invalid dueDate format", async () => {
          const res = await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ dueDate: "invalid-date" })
            .expect(400);

          expect(res.body.status).toBe("fail");
        });
      });

      // ───────────────────────────────
      // EDGE CASES
      // ───────────────────────────────
      describe("Edge Cases", () => {
        it("should handle updating task with no changes", async () => {
          const res = await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({})
            .expect(200);

          expect(res.body.status).toBe("success");
        });

        it("should handle removing all assignees", async () => {
          const res = await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ assignedTo: [] })
            .expect(200);

          expect(res.body.data.task.assignedTo).toEqual([]);
        });

        it("should handle updating to past due date", async () => {
          const pastDate = new Date("2020-01-01");

          const res = await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ dueDate: pastDate.toISOString() })
            .expect(200);

          expect(new Date(res.body.data.task.dueDate)).toEqual(pastDate);
        });

        it("should handle updating to far future date", async () => {
          const futureDate = new Date("2099-12-31");

          const res = await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ dueDate: futureDate.toISOString() })
            .expect(200);

          expect(new Date(res.body.data.task.dueDate)).toEqual(futureDate);
        });

        it("should handle removing dueDate (set to null)", async () => {
          const res = await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ dueDate: null })
            .expect(200);

          expect(res.body.data.task.dueDate).toBeNull();
        });

        it("should handle updating task with very long title", async () => {
          const longTitle = "A".repeat(500);

          const res = await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ title: longTitle });

          expect([200, 400]).toContain(res.status);
        });

        it("should handle updating task with whitespace in title", async () => {
          const res = await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "  Trimmed Title  " })
            .expect(200);

          expect(res.body.data.task.title).toBe("Trimmed Title");
        });

        it("should handle removing description (set to empty)", async () => {
          const res = await request(app)
            .patch(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ description: "" })
            .expect(200);

          expect(res.body.data.task.description).toBe("");
        });
      });
    });
  });
  // ═══════════════════════════════════════════════════════════
  // DELETE TESTS
  // ═══════════════════════════════════════════════════════════
  describe("DELETE TESTS", () => {
    describe("DELETE /api/v1/workspaces/:workSpaceId/projects/:projectId/tasks/:taskId", () => {
      beforeEach(async () => {
        // Create a task to delete in each test
        const res = await request(app)
          .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
          .set("Authorization", `Bearer ${token}`)
          .send({
            title: "Task to Delete",
            description: "This task will be deleted",
            status: "todo",
            priority: "medium",
            assignedTo: [userId],
          });

        taskId = res.body.data.task._id;
      });

      // ───────────────────────────────
      // BASIC DELETE TESTS
      // ───────────────────────────────
      describe("Basic Delete Operations", () => {
        it("should delete a task successfully with 204 status", async () => {
          const res = await request(app)
            .delete(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(204);

          // 204 No Content - body should be empty
          expect(res.body).toEqual({});
        });

        it("should remove task from database after deletion", async () => {
          await request(app)
            .delete(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(204);

          // Verify task no longer exists
          const res = await request(app)
            .get(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(404);

          expect(res.body.status).toBe("fail");
        });

        it("should return task list without deleted task", async () => {
          // Create another task
          await request(app)
            .post(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({
              title: "Task to Keep",
            });

          // Delete first task
          await request(app)
            .delete(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(204);

          // Get all tasks
          const res = await request(app)
            .get(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(200);

          expect(res.body.data.tasks).toHaveLength(1);
          expect(res.body.data.tasks[0].title).toBe("Task to Keep");
          expect(res.body.data.tasks[0]._id).not.toBe(taskId);
        });

        it("should delete task with all its properties", async () => {
          const dueDate = new Date("2026-12-31");

          // Create a task with all properties
          const createRes = await request(app)
            .post(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({
              title: "Complete Task to Delete",
              description: "Full description",
              status: "in-progress",
              priority: "high",
              dueDate: dueDate.toISOString(),
              assignedTo: [userId, secondUserId],
              tags: ["important", "urgent"],
            });

          const fullTaskId = createRes.body.data.task._id;

          await request(app)
            .delete(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${fullTaskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(204);

          // Verify it's gone
          await request(app)
            .get(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${fullTaskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(404);
        });

        it("should return empty body on successful deletion", async () => {
          const res = await request(app)
            .delete(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(204);

          expect(res.body).toEqual({});
          expect(Object.keys(res.body).length).toBe(0);
        });
      });

      // ───────────────────────────────
      // SOCKET EVENT TESTS
      // ───────────────────────────────
      describe("Socket Events", () => {
        it("should emit 'task:deleted' event when task is deleted", async () => {
          const socketPromise = new Promise((resolve) => {
            clientSocket.once("task:deleted", (data) => resolve(data));
          });

          await request(app)
            .delete(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(204);

          const socketEvent = await socketPromise;
          expect(socketEvent).toHaveProperty("taskId");
          expect(socketEvent).toHaveProperty("deletedBy");
          expect(socketEvent).toHaveProperty("timestamp");
          expect(socketEvent.taskId).toBe(taskId);
          expect(socketEvent.deletedBy).toBe(userId);
        });

        it("should emit 'task:deleted' with correct metadata", async () => {
          const socketPromise = new Promise((resolve) => {
            clientSocket.once("task:deleted", (data) => resolve(data));
          });

          await request(app)
            .delete(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(204);

          const socketEvent = await socketPromise;
          expect(socketEvent.taskId).toBe(taskId);
          expect(socketEvent.deletedBy).toBe(userId);
          expect(new Date(socketEvent.timestamp)).toBeInstanceOf(Date);
        });

        it("should emit 'task:deleted' to all project members", async () => {
          const port = server.address().port;
          const secondClientSocket = new Client(`http://localhost:${port}`, {
            auth: { token: secondToken },
            reconnection: false,
          });

          await new Promise((resolve, reject) => {
            secondClientSocket.once("connect", resolve);
            secondClientSocket.once("connect_error", (err) => reject(err));
          });

          secondClientSocket.emit("join:project", projectId);

          const socketPromises = [
            new Promise((resolve) => {
              clientSocket.once("task:deleted", (data) => resolve(data));
            }),
            new Promise((resolve) => {
              secondClientSocket.once("task:deleted", (data) => resolve(data));
            }),
          ];

          await request(app)
            .delete(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(204);

          const [event1, event2] = await Promise.all(socketPromises);

          expect(event1.taskId).toBe(taskId);
          expect(event2.taskId).toBe(taskId);
          expect(event1.deletedBy).toBe(userId);
          expect(event2.deletedBy).toBe(userId);

          secondClientSocket.disconnect();
          secondClientSocket.close();
        });

        it("should NOT emit 'task:deleted' if deletion fails", async () => {
          let eventReceived = false;

          clientSocket.once("task:deleted", () => {
            eventReceived = true;
          });

          const fakeTaskId = new mongoose.Types.ObjectId();

          await request(app)
            .delete(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${fakeTaskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(404);

          await new Promise((resolve) => setTimeout(resolve, 100));

          expect(eventReceived).toBe(false);
        });

        it("should include timestamp in task:deleted event", async () => {
          const beforeTime = new Date();

          const socketPromise = new Promise((resolve) => {
            clientSocket.once("task:deleted", (data) => resolve(data));
          });

          await request(app)
            .delete(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(204);

          const afterTime = new Date();
          const socketEvent = await socketPromise;

          const eventTime = new Date(socketEvent.timestamp);
          expect(eventTime.getTime()).toBeGreaterThanOrEqual(
            beforeTime.getTime()
          );
          expect(eventTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
        });

        it("should emit 'task:deleted' even if task has no assignees", async () => {
          // Create task without assignees
          const createRes = await request(app)
            .post(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({
              title: "Unassigned Task",
              assignedTo: [],
            });

          const unassignedTaskId = createRes.body.data.task._id;

          const socketPromise = new Promise((resolve) => {
            clientSocket.once("task:deleted", (data) => resolve(data));
          });

          await request(app)
            .delete(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${unassignedTaskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(204);

          const socketEvent = await socketPromise;
          expect(socketEvent.taskId).toBe(unassignedTaskId);
        });

        it("should emit 'task:deleted' for task with multiple assignees", async () => {
          // Create task with multiple assignees
          const createRes = await request(app)
            .post(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({
              title: "Multi-Assigned Task",
              assignedTo: [userId, secondUserId],
            });

          const multiTaskId = createRes.body.data.task._id;

          const socketPromise = new Promise((resolve) => {
            clientSocket.once("task:deleted", (data) => resolve(data));
          });

          await request(app)
            .delete(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${multiTaskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(204);

          const socketEvent = await socketPromise;
          expect(socketEvent.taskId).toBe(multiTaskId);
          expect(socketEvent.deletedBy).toBe(userId);
        });
      });

      // ───────────────────────────────
      // AUTHORIZATION TESTS
      // ───────────────────────────────
      describe("Authorization", () => {
        it("should not delete task without authentication", async () => {
          const res = await request(app)
            .delete(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .expect(401);

          expect(res.body.status).toBe("fail");

          // Verify task still exists
          await request(app)
            .get(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(200);
        });

        it("should not delete task with invalid token", async () => {
          const res = await request(app)
            .delete(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", "Bearer invalid-token-12345")
            .expect(401);

          expect(res.body.status).toBe("fail");
        });

        it("should not delete task in non-existent project", async () => {
          const fakeProjectId = new mongoose.Types.ObjectId();

          const res = await request(app)
            .delete(
              `/api/v1/workspaces/${workspaceId}/projects/${fakeProjectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(404);

          expect(res.body.status).toBe("fail");

          // Verify task still exists in original project
          await request(app)
            .get(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(200);
        });

        // it("should not delete task in non-existent workspace", async () => {
        //   const fakeWorkspaceId = new mongoose.Types.ObjectId();

        //   const res = await request(app)
        //     .delete(
        //       `/api/v1/workspaces/${fakeWorkspaceId}/projects/${projectId}/tasks/${taskId}`
        //     )
        //     .set("Authorization", `Bearer ${token}`)
        //     .expect(404);

        //   expect(res.body.status).toBe("fail");
        // });
      });

      // ───────────────────────────────
      // ERROR HANDLING TESTS
      // ───────────────────────────────
      describe("Error Handling", () => {
        it("should return 404 for non-existent task", async () => {
          const fakeTaskId = new mongoose.Types.ObjectId();

          const res = await request(app)
            .delete(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${fakeTaskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(404);

          expect(res.body.status).toBe("fail");
          expect(res.body.message).toContain("Task not found");
        });

        it("should handle invalid task ID format", async () => {
          const res = await request(app)
            .delete(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/invalid-id-123`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(400);

          expect(res.body.status).toBe("fail");
        });

        it("should not allow deleting same task twice", async () => {
          // Delete task first time
          await request(app)
            .delete(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(204);

          // Try to delete again
          const res = await request(app)
            .delete(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(404);

          expect(res.body.status).toBe("fail");
          expect(res.body.message).toContain("Task not found");
        });

        it("should handle deletion when task has comments", async () => {
          // Delete task
          await request(app)
            .delete(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(204);

          // Verify task is deleted
          await request(app)
            .get(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(404);
        });
      });

      // ───────────────────────────────
      // EDGE CASES
      // ───────────────────────────────
      describe("Edge Cases", () => {
        it("should handle deleting task with past due date", async () => {
          const pastDate = new Date("2020-01-01");

          const createRes = await request(app)
            .post(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({
              title: "Overdue Task",
              dueDate: pastDate.toISOString(),
            });

          const overdueTaskId = createRes.body.data.task._id;

          await request(app)
            .delete(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${overdueTaskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(204);

          await request(app)
            .get(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${overdueTaskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(404);
        });

        it("should handle deleting task with future due date", async () => {
          const futureDate = new Date("2099-12-31");

          const createRes = await request(app)
            .post(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({
              title: "Future Task",
              dueDate: futureDate.toISOString(),
            });

          const futureTaskId = createRes.body.data.task._id;

          await request(app)
            .delete(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${futureTaskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(204);
        });

        it("should handle deleting task with tags", async () => {
          const createRes = await request(app)
            .post(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({
              title: "Tagged Task",
              tags: ["important", "urgent", "bug"],
            });

          const taggedTaskId = createRes.body.data.task._id;

          await request(app)
            .delete(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taggedTaskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(204);
        });

        it("should handle deleting completed task", async () => {
          const createRes = await request(app)
            .post(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({
              title: "Completed Task",
              status: "done",
            });

          const completedTaskId = createRes.body.data.task._id;

          await request(app)
            .delete(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${completedTaskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(204);
        });

        it("should handle deleting task in different group", async () => {
          // Get a different group ID from project
          const projectRes = await request(app)
            .get(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
            .set("Authorization", `Bearer ${token}`);

          const differentGroupId =
            projectRes.body.data.project.groups[1]?.id ||
            projectRes.body.data.project.groups[0].id;

          const createRes = await request(app)
            .post(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({
              title: "Task in Different Group",
              groupId: differentGroupId,
            });

          const differentGroupTaskId = createRes.body.data.task._id;

          await request(app)
            .delete(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${differentGroupTaskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(204);
        });

        it("should update project task count after deletion", async () => {
          // Get initial task count
          const beforeRes = await request(app)
            .get(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`
            )
            .set("Authorization", `Bearer ${token}`);

          const beforeCount = beforeRes.body.data.tasks.length;

          // Delete task
          await request(app)
            .delete(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(204);

          // Get updated task count
          const afterRes = await request(app)
            .get(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`
            )
            .set("Authorization", `Bearer ${token}`);

          const afterCount = afterRes.body.data.tasks.length;

          expect(afterCount).toBe(beforeCount - 1);
        });

        it("should handle rapid consecutive deletions", async () => {
          // Create multiple tasks
          const task1Res = await request(app)
            .post(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Task 1" });

          const task2Res = await request(app)
            .post(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Task 2" });

          const task3Res = await request(app)
            .post(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Task 3" });

          const task1Id = task1Res.body.data.task._id;
          const task2Id = task2Res.body.data.task._id;
          const task3Id = task3Res.body.data.task._id;

          // Delete all rapidly
          const deletions = await Promise.all([
            request(app)
              .delete(
                `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${task1Id}`
              )
              .set("Authorization", `Bearer ${token}`),
            request(app)
              .delete(
                `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${task2Id}`
              )
              .set("Authorization", `Bearer ${token}`),
            request(app)
              .delete(
                `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${task3Id}`
              )
              .set("Authorization", `Bearer ${token}`),
          ]);

          deletions.forEach((res) => {
            expect(res.status).toBe(204);
          });

          // Verify all are deleted
          await request(app)
            .get(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${task1Id}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(404);

          await request(app)
            .get(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${task2Id}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(404);

          await request(app)
            .get(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${task3Id}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(404);
        });
      });

      // ───────────────────────────────
      // INTEGRATION TESTS
      // ───────────────────────────────
      describe("Integration with Other Features", () => {
        it("should not affect other tasks when deleting one", async () => {
          // Create additional tasks
          const task1Res = await request(app)
            .post(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Keep Task 1" });

          const task2Res = await request(app)
            .post(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Keep Task 2" });

          const keepTask1Id = task1Res.body.data.task._id;
          const keepTask2Id = task2Res.body.data.task._id;

          // Delete original task
          await request(app)
            .delete(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(204);

          // Verify other tasks still exist
          const keep1 = await request(app)
            .get(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${keepTask1Id}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(200);

          const keep2 = await request(app)
            .get(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${keepTask2Id}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(200);

          expect(keep1.body.data.task.title).toBe("Keep Task 1");
          expect(keep2.body.data.task.title).toBe("Keep Task 2");
        });

        it("should update task statistics after deletion", async () => {
          // Create multiple tasks with different statuses
          await request(app)
            .post(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Todo Task", status: "todo" });

          await request(app)
            .post(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Done Task", status: "done" });

          // Delete one task
          await request(app)
            .delete(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(204);

          // Verify task list is updated
          const listRes = await request(app)
            .get(
              `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`
            )
            .set("Authorization", `Bearer ${token}`)
            .expect(200);

          expect(listRes.body.data.tasks.some((t) => t._id === taskId)).toBe(
            false
          );
        });
      });
    });
  });
});
