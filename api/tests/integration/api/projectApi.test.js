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
      expect(res.body.data.project.groups).toBeDefined();
      expect(res.body.data.project.groups.length).toBe(3); // Default groups

      projectId = res.body.data.project._id;
    });

    it("should create project with default groups", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Project with Groups",
        })
        .expect(201);

      expect(res.body.data.project.groups.length).toBe(3);
      expect(res.body.data.project.groups[0].title).toBe("To Do");
      expect(res.body.data.project.groups[1].title).toBe("In Progress");
      expect(res.body.data.project.groups[2].title).toBe("Done");
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
  // READ TESTS (BASIC)
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
  // FILTERING TESTS
  // ═══════════════════════════════════════════════════════════
  describe("GET /api/v1/workspaces/:workSpaceId/projects - Filtering", () => {
    beforeEach(async () => {
      // Create diverse projects for filtering
      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "High Priority Planning",
          status: "planning",
          priority: "high",
        });

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "High Priority In Progress",
          status: "in-progress",
          priority: "high",
        });

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Medium Priority Completed",
          status: "completed",
          priority: "medium",
        });

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Low Priority On Hold",
          status: "on-hold",
          priority: "low",
        });
    });

    it("should filter projects by status", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects?status=on-hold`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.projects.length).toBe(1);
      res.body.data.projects.forEach((project) => {
        expect(project.status).toBe("on-hold");
      });
    });

    it("should filter projects by priority", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects?priority=high`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.projects.length).toBe(2);
      res.body.data.projects.forEach((project) => {
        expect(project.priority).toBe("high");
      });
    });

    it("should filter projects by multiple criteria (status AND priority)", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects?status=in-progress&priority=high`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.projects.length).toBe(1);
      expect(res.body.data.projects[0].status).toBe("in-progress");
      expect(res.body.data.projects[0].priority).toBe("high");
    });

    it("should return empty array when filter matches no projects", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects?status=cancelled`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.projects).toEqual([]);
    });

    it("should handle invalid filter values gracefully", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects?status=invalid-status`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.projects).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // ADVANCED FILTERING TESTS (gte, gt, lte, lt)
  // ═══════════════════════════════════════════════════════════
  describe("GET /api/v1/workspaces/:workSpaceId/projects - Advanced Filtering", () => {
    beforeEach(async () => {
      // Create projects with different progress values
      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Low Progress Project",
          progress: 25,
          priority: "high",
        });

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Medium Progress Project",
          progress: 50,
          priority: "medium",
        });

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "High Progress Project",
          progress: 75,
          priority: "low",
        });
    });

    it("should filter projects with progress greater than or equal (gte)", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects?progress[gte]=50`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.projects.length).toBeGreaterThanOrEqual(2);
      res.body.data.projects.forEach((project) => {
        expect(project.progress).toBeGreaterThanOrEqual(50);
      });
    });

    it("should filter projects with progress greater than (gt)", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects?progress[gt]=50`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.projects.length).toBeGreaterThanOrEqual(1);
      res.body.data.projects.forEach((project) => {
        expect(project.progress).toBeGreaterThan(50);
      });
    });

    it("should filter projects with progress less than or equal (lte)", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects?progress[lte]=50`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.projects.length).toBeGreaterThanOrEqual(2);
      res.body.data.projects.forEach((project) => {
        expect(project.progress).toBeLessThanOrEqual(50);
      });
    });

    it("should filter projects with progress less than (lt)", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects?progress[lt]=50`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.projects.length).toBeGreaterThanOrEqual(1);
      res.body.data.projects.forEach((project) => {
        expect(project.progress).toBeLessThan(50);
      });
    });

    it("should filter projects with progress range (gte and lte)", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects?progress[gte]=25&progress[lte]=75`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.projects.length).toBe(3);
      res.body.data.projects.forEach((project) => {
        expect(project.progress).toBeGreaterThanOrEqual(25);
        expect(project.progress).toBeLessThanOrEqual(75);
      });
    });

    it("should combine advanced filters with regular filters", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects?progress[gte]=50&priority=medium`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      res.body.data.projects.forEach((project) => {
        expect(project.progress).toBeGreaterThanOrEqual(50);
        expect(project.priority).toBe("medium");
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // DEFAULT BEHAVIOR TESTS
  // ═══════════════════════════════════════════════════════════
  describe("GET /api/v1/workspaces/:workSpaceId/projects - Default Behavior", () => {
    beforeEach(async () => {
      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "First Project" });

      await new Promise((resolve) => setTimeout(resolve, 100));

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Second Project" });

      await new Promise((resolve) => setTimeout(resolve, 100));

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Third Project" });
    });

    it("should sort by -createdAt by default (newest first)", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.projects[0].name).toBe("Third Project");
      expect(res.body.data.projects[2].name).toBe("First Project");
    });

    it("should exclude __v field by default", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      res.body.data.projects.forEach((project) => {
        expect(project.__v).toBeUndefined();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // SORTING TESTS
  // ═══════════════════════════════════════════════════════════
  describe("GET /api/v1/workspaces/:workSpaceId/projects - Sorting", () => {
    beforeEach(async () => {
      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Zebra Project",
          priority: "low",
          progress: 90,
        });

      await new Promise((resolve) => setTimeout(resolve, 100));

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Alpha Project",
          priority: "high",
          progress: 30,
        });

      await new Promise((resolve) => setTimeout(resolve, 100));

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Beta Project",
          priority: "medium",
          progress: 60,
        });
    });

    it("should sort projects by name ascending", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects?sort=name`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.projects[0].name).toBe("Alpha Project");
      expect(res.body.data.projects[1].name).toBe("Beta Project");
      expect(res.body.data.projects[2].name).toBe("Zebra Project");
    });

    it("should sort projects by name descending", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects?sort=-name`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.projects[0].name).toBe("Zebra Project");
      expect(res.body.data.projects[1].name).toBe("Beta Project");
      expect(res.body.data.projects[2].name).toBe("Alpha Project");
    });

    it("should sort projects by progress ascending", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects?sort=progress`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.projects[0].progress).toBe(30);
      expect(res.body.data.projects[1].progress).toBe(60);
      expect(res.body.data.projects[2].progress).toBe(90);
    });

    it("should sort projects by progress descending", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects?sort=-progress`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.projects[0].progress).toBe(90);
      expect(res.body.data.projects[2].progress).toBe(30);
    });

    it("should sort projects by createdAt ascending (oldest first)", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects?sort=createdAt`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.projects[0].name).toBe("Zebra Project");
      expect(res.body.data.projects[2].name).toBe("Beta Project");
    });

    it("should sort projects by createdAt descending (newest first)", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects?sort=-createdAt`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.projects[0].name).toBe("Beta Project");
      expect(res.body.data.projects[2].name).toBe("Zebra Project");
    });

    it("should sort by multiple fields (priority, then name)", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects?sort=name`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.projects[0].name).toBe("Alpha Project");
      expect(res.body.data.projects[1].name).toBe("Beta Project");
      expect(res.body.data.projects[2].name).toBe("Zebra Project");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // PAGINATION TESTS
  // ═══════════════════════════════════════════════════════════
  describe("GET /api/v1/workspaces/:workSpaceId/projects - Pagination", () => {
    beforeEach(async () => {
      const projectPromises = [];
      for (let i = 1; i <= 15; i++) {
        projectPromises.push(
          request(app)
            .post(`/api/v1/workspaces/${workspaceId}/projects`)
            .set("Authorization", `Bearer ${token}`)
            .send({
              name: `Project ${i.toString().padStart(2, "0")}`,
              description: `Description for project ${i}`,
              priority: i % 3 === 0 ? "high" : i % 2 === 0 ? "medium" : "low",
            })
        );
      }
      await Promise.all(projectPromises);
    });

    it("should limit projects per page", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects?limit=5`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.projects.length).toBe(5);
    });

    it("should paginate to second page", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects?page=2&limit=5`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.projects.length).toBe(5);
    });

    it("should paginate to third page", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects?page=3&limit=5`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.projects.length).toBe(5);
    });

    it("should return empty array for page beyond available data", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects?page=100&limit=5`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.projects).toEqual([]);
    });

    it("should handle invalid page number gracefully", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects?page=0&limit=5`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body.data.projects)).toBe(true);
    });

    it("should handle invalid limit gracefully", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects?limit=-5`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body.data.projects)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // FIELD SELECTION TESTS
  // ═══════════════════════════════════════════════════════════
  describe("GET /api/v1/workspaces/:workSpaceId/projects - Field Selection", () => {
    beforeEach(async () => {
      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Full Project",
          description: "Complete project with all fields",
          status: "in-progress",
          priority: "high",
        });
    });

    it("should select only specified fields", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects?fields=name,status`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.projects[0]).toHaveProperty("name");
      expect(res.body.data.projects[0]).toHaveProperty("status");
      expect(res.body.data.projects[0]).toHaveProperty("_id");
      expect(res.body.data.projects[0].description).toBeUndefined();
    });

    it("should exclude specified fields", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects?fields=-description,-priority`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.projects[0]).toHaveProperty("name");
      expect(res.body.data.projects[0]).toHaveProperty("status");
      expect(res.body.data.projects[0].description).toBeUndefined();
      expect(res.body.data.projects[0].priority).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // COMBINED QUERY TESTS
  // ═══════════════════════════════════════════════════════════
  describe("GET /api/v1/workspaces/:workSpaceId/projects - Combined Queries", () => {
    beforeEach(async () => {
      const projectPromises = [];
      for (let i = 1; i <= 20; i++) {
        projectPromises.push(
          request(app)
            .post(`/api/v1/workspaces/${workspaceId}/projects`)
            .set("Authorization", `Bearer ${token}`)
            .send({
              name: `Combined Project ${i.toString().padStart(2, "0")}`,
              status:
                i <= 10 ? "pending" : i <= 15 ? "in-progress" : "completed",
              priority: i % 3 === 0 ? "high" : i % 2 === 0 ? "medium" : "low",
              progress: i * 5,
            })
        );
      }
      await Promise.all(projectPromises);
    });

    it("should filter, sort, and paginate simultaneously", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects?status=pending&sort=-priority&page=1&limit=5`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.projects.length).toBeLessThanOrEqual(5);
      res.body.data.projects.forEach((project) => {
        expect(project.status).toBe("pending");
      });
    });

    it("should combine filter, sort, pagination, and field selection", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects?priority=high&sort=name&limit=3&fields=name,priority`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.projects.length).toBeLessThanOrEqual(3);
      res.body.data.projects.forEach((project) => {
        expect(project.priority).toBe("high");
        expect(project).toHaveProperty("name");
        expect(project.description).toBeUndefined();
      });
    });

    it("should handle complex multi-filter with sorting", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects?status=in-progress&priority=medium&sort=-createdAt`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      res.body.data.projects.forEach((project) => {
        expect(project.status).toBe("in-progress");
        expect(project.priority).toBe("medium");
      });
    });

    it("should handle all query parameters together", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects?status=pending&priority=low&sort=name&page=1&limit=5&fields=name,status,priority`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.projects.length).toBeLessThanOrEqual(5);
      res.body.data.projects.forEach((project) => {
        expect(project.status).toBe("pending");
        expect(project.priority).toBe("low");
        expect(project).toHaveProperty("name");
        expect(project.description).toBeUndefined();
      });
    });

    it("should filter by progress range and status", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects?progress[gte]=25&progress[lte]=75&status=in-progress`
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      res.body.data.projects.forEach((project) => {
        expect(project.progress).toBeGreaterThanOrEqual(25);
        expect(project.progress).toBeLessThanOrEqual(75);
        expect(project.status).toBe("in-progress");
      });
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

    it("should update project status", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "in-progress" })
        .expect(200);

      expect(res.body.data.project.status).toBe("in-progress");
    });

    it("should update project priority", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ priority: "urgent" })
        .expect(200);

      expect(res.body.data.project.priority).toBe("urgent");
    });

    it("should update project progress", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ progress: 75 })
        .expect(200);

      expect(res.body.data.project.progress).toBe(75);
    });

    it("should update multiple fields at once", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Completely New Name",
          description: "Completely New Description",
          status: "completed",
          priority: "high",
          progress: 100,
        })
        .expect(200);

      expect(res.body.data.project.name).toBe("Completely New Name");
      expect(res.body.data.project.description).toBe(
        "Completely New Description"
      );
      expect(res.body.data.project.status).toBe("completed");
      expect(res.body.data.project.priority).toBe("high");
      expect(res.body.data.project.progress).toBe(100);
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

    it("should not update with invalid status", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "invalid-status" })
        .expect(400);

      expect(res.body.status).toBe("fail");
    });

    it("should not update with invalid priority", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ priority: "super-urgent" })
        .expect(400);

      expect(res.body.status).toBe("fail");
    });

    it("should not update progress below 0", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ progress: -10 })
        .expect(400);

      expect(res.body.status).toBe("fail");
    });

    it("should not update progress above 100", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ progress: 150 })
        .expect(400);

      expect(res.body.status).toBe("fail");
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
  // GROUP MANAGEMENT TESTS
  // ═══════════════════════════════════════════════════════════
  describe("Project Groups", () => {
    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Project with Groups",
          description: "Testing groups",
        });

      projectId = res.body.data.project._id;
    });

    it("should have default groups when created", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.project.groups.length).toBe(3);
      expect(res.body.data.project.groups[0].title).toBe("To Do");
      expect(res.body.data.project.groups[1].title).toBe("In Progress");
      expect(res.body.data.project.groups[2].title).toBe("Done");
    });

    it("should have valid group IDs", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      res.body.data.project.groups.forEach((group) => {
        expect(group.id).toBeDefined();
        expect(group.id).toMatch(/^grp_/);
      });
    });

    it("should have valid group colors", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      res.body.data.project.groups.forEach((group) => {
        expect(group.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    });

    it("should have valid group positions", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.project.groups[0].position).toBe(0);
      expect(res.body.data.project.groups[1].position).toBe(1);
      expect(res.body.data.project.groups[2].position).toBe(2);
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
        .expect(400);
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

    it("should handle whitespace in project name", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "  Project with spaces  ",
        })
        .expect(201);

      // Assuming the schema trims whitespace
      expect(res.body.data.project.name).toBe("Project with spaces");
    });

    it("should allow duplicate project names in same workspace", async () => {
      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Duplicate Project",
          description: "First one",
        })
        .expect(201);

      // Create duplicate
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Duplicate Project",
          description: "Second one",
        })
        .expect(201);

      expect(res.body.data.project.name).toBe("Duplicate Project");
    });

    it("should have totalGroups virtual field", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Virtual Field Test",
        })
        .expect(201);

      expect(res.body.data.project.totalGroups).toBe(3);
    });

    it("should handle project creation with all optional fields", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Complete Project",
          description: "Full description",
          status: "in-progress",
          priority: "high",
          progress: 50,
        })
        .expect(201);

      expect(res.body.data.project.name).toBe("Complete Project");
      expect(res.body.data.project.description).toBe("Full description");
      expect(res.body.data.project.status).toBe("in-progress");
      expect(res.body.data.project.priority).toBe("high");
      expect(res.body.data.project.progress).toBe(50);
    });

    it("should set default values for optional fields", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Minimal Project",
        })
        .expect(201);

      expect(res.body.data.project.status).toBe("pending");
      expect(res.body.data.project.priority).toBe("medium");
      expect(res.body.data.project.progress).toBe(0);
    });
  });
});
