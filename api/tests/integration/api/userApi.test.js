const request = require("supertest");
const mongoose = require("mongoose");
const User = require("../../../src/models/userModel");
const app = require("../../../src/app");
const {
  connectTestDB,
  clearDB,
  disconnectTestDB,
} = require("../../helpers/testDbHelper");

let authToken;
let userId;
let adminToken;
let adminUserId;

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
  adminToken = null;
  adminUserId = null;
});

afterAll(async () => {
  await disconnectTestDB();
});

describe("User API - Authentication", () => {
  describe("POST /api/v1/users/signup", () => {
    it("should create a new user successfully", async () => {
      const res = await request(app)
        .post("/api/v1/users/signup")
        .send({
          name: "Test User",
          email: "test@example.com",
          password: "12345678",
          passwordConfirm: "12345678",
        })
        .expect(201);

      expect(res.body.status).toBe("success");
      expect(res.body.token).toBeDefined();
      expect(res.body.data.user.email).toBe("test@example.com");
      expect(res.body.data.user.name).toBe("Test User");
      expect(res.body.data.user.password).toBeUndefined();
    });

    it("should not create user with duplicate email", async () => {
      // Create first user
      await request(app).post("/api/v1/users/signup").send({
        name: "First User",
        email: "duplicate@example.com",
        password: "12345678",
        passwordConfirm: "12345678",
      });

      // Try to create second user with same email
      const res = await request(app)
        .post("/api/v1/users/signup")
        .send({
          name: "Second User",
          email: "duplicate@example.com",
          password: "12345678",
          passwordConfirm: "12345678",
        })
        .expect(500);

      expect(res.body.status).toBe("error");
    });

    it("should not create user with mismatched passwords", async () => {
      const res = await request(app)
        .post("/api/v1/users/signup")
        .send({
          name: "Test User",
          email: "test@example.com",
          password: "12345678",
          passwordConfirm: "87654321",
        })
        .expect(500);

      expect(res.body.status).toBe("error");
    });

    it("should not create user with password less than 8 characters", async () => {
      const res = await request(app)
        .post("/api/v1/users/signup")
        .send({
          name: "Test User",
          email: "test@example.com",
          password: "1234567",
          passwordConfirm: "1234567",
        })
        .expect(500);

      expect(res.body.status).toBe("error");
    });

    it("should not create user without required fields", async () => {
      const res = await request(app)
        .post("/api/v1/users/signup")
        .send({
          email: "test@example.com",
        })
        .expect(500);

      expect(res.body.status).toBe("error");
    });

    it("should not create user with invalid email format", async () => {
      const res = await request(app)
        .post("/api/v1/users/signup")
        .send({
          name: "Test User",
          email: "invalid-email",
          password: "12345678",
          passwordConfirm: "12345678",
        })
        .expect(500);

      expect(res.body.status).toBe("error");
    });
  });

  describe("POST /api/v1/users/login", () => {
    beforeEach(async () => {
      // Create a user for login tests
      await request(app).post("/api/v1/users/signup").send({
        name: "Login User",
        email: "login@example.com",
        password: "12345678",
        passwordConfirm: "12345678",
      });
    });

    it("should login user with correct credentials", async () => {
      const res = await request(app)
        .post("/api/v1/users/login")
        .send({
          email: "login@example.com",
          password: "12345678",
        })
        .expect(200);

      expect(res.body.status).toBe("success");
      expect(res.body.token).toBeDefined();
      expect(res.body.data.user.email).toBe("login@example.com");
    });

    it("should not login with incorrect password", async () => {
      const res = await request(app)
        .post("/api/v1/users/login")
        .send({
          email: "login@example.com",
          password: "wrongpassword",
        })
        .expect(401);

      expect(res.body.status).toBe("fail");
    });

    it("should not login with non-existent email", async () => {
      const res = await request(app)
        .post("/api/v1/users/login")
        .send({
          email: "nonexistent@example.com",
          password: "12345678",
        })
        .expect(401);

      expect(res.body.status).toBe("fail");
    });

    it("should not login without email", async () => {
      const res = await request(app)
        .post("/api/v1/users/login")
        .send({
          password: "12345678",
        })
        .expect(400);

      expect(res.body.status).toBe("fail");
    });

    it("should not login without password", async () => {
      const res = await request(app)
        .post("/api/v1/users/login")
        .send({
          email: "login@example.com",
        })
        .expect(400);

      expect(res.body.status).toBe("fail");
    });
  });
});

describe("User API - Protected Routes", () => {
  beforeEach(async () => {
    // Create and login a user before each test
    const signupRes = await request(app).post("/api/v1/users/signup").send({
      name: "Auth User",
      email: "auth@example.com",
      password: "12345678",
      passwordConfirm: "12345678",
    });

    authToken = signupRes.body.token;
    userId = signupRes.body.data.user._id;
  });

  describe("GET /api/v1/users/me", () => {
    it("should get current user profile", async () => {
      const res = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.status).toBe("success");
      expect(res.body.data.user.email).toBe("auth@example.com");
    });

    it("should not get profile without token", async () => {
      const res = await request(app).get("/api/v1/users/me").expect(401);

      expect(res.body.status).toBe("fail");
    });

    it("should not get profile with invalid token", async () => {
      const res = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", "Bearer invalidtoken123")
        .expect(500);

      expect(res.body.status).toBe("error");
    });
  });

  describe("PATCH /api/v1/users/updateMe", () => {
    it("should update user name", async () => {
      const res = await request(app)
        .patch("/api/v1/users/updateMe")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Updated Name",
        })
        .expect(200);

      expect(res.body.status).toBe("success");
      expect(res.body.data.user.name).toBe("Updated Name");
    });

    it("should update user email", async () => {
      const res = await request(app)
        .patch("/api/v1/users/updateMe")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          email: "newemail@example.com",
        })
        .expect(200);

      expect(res.body.status).toBe("success");
      expect(res.body.data.user.email).toBe("newemail@example.com");
    });

    it("should not update password through updateMe", async () => {
      const res = await request(app)
        .patch("/api/v1/users/updateMe")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          password: "newpassword123",
        })
        .expect(400);

      expect(res.body.status).toBe("fail");
    });

    it("should not update without authentication", async () => {
      const res = await request(app)
        .patch("/api/v1/users/updateMe")
        .send({
          name: "Updated Name",
        })
        .expect(401);

      expect(res.body.status).toBe("fail");
    });
  });

  describe("PATCH /api/v1/users/updatePassword", () => {
    it("should update password with correct current password", async () => {
      const res = await request(app)
        .patch("/api/v1/users/updatePassword")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          passwordCurrent: "12345678",
          password: "newpassword123",
          passwordConfirm: "newpassword123",
        })
        .expect(200);

      expect(res.body.status).toBe("success");
      expect(res.body.token).toBeDefined();

      // Verify can login with new password
      const loginRes = await request(app)
        .post("/api/v1/users/login")
        .send({
          email: "auth@example.com",
          password: "newpassword123",
        })
        .expect(200);

      expect(loginRes.body.status).toBe("success");
    });

    it("should not update password with incorrect current password", async () => {
      const res = await request(app)
        .patch("/api/v1/users/updatePassword")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          passwordCurrent: "wrongpassword",
          password: "newpassword123",
          passwordConfirm: "newpassword123",
        })
        .expect(401);

      expect(res.body.status).toBe("fail");
    });
  });

  describe("DELETE /api/v1/users/deleteMe", () => {
    it("should deactivate user account", async () => {
      const res = await request(app)
        .delete("/api/v1/users/deleteMe")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(204);

      // Try to login with deactivated account
    });
  });
});

describe("User API - Admin Routes", () => {
  beforeEach(async () => {
    // Create regular user
    const userRes = await request(app).post("/api/v1/users/signup").send({
      name: "Regular User",
      email: "user@example.com",
      password: "12345678",
      passwordConfirm: "12345678",
    });
    authToken = userRes.body.token;
    userId = userRes.body.data.user._id;

    // Create admin user (you'll need to manually set role in DB or create admin signup)
    const adminRes = await request(app).post("/api/v1/users/signup").send({
      name: "Admin User",
      email: "admin@example.com",
      password: "12345678",
      passwordConfirm: "12345678",
    });
    await User.updateOne(
      { email: "admin@example.com" },
      { role: "super-admin" }
    );
    adminToken = adminRes.body.token;
    adminUserId = adminRes.body.data.user._id;

    // TODO: Update admin user role to 'super-admin' in database
    // This would require a helper function or direct DB access
  });

  describe("GET /api/v1/users", () => {
    it("should get all users (admin only)", async () => {
      const res = await request(app)
        .get("/api/v1/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.status).toBe("success");
      // expect(res.body.data.users).toBeInstanceOf(Array);
      expect(res.body.data.users.length).toBeGreaterThan(0);
    });

    it("should not get all users without admin role", async () => {
      const res = await request(app)
        .get("/api/v1/users")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(403);

      expect(res.body.status).toBe("fail");
    });
  });

  describe("GET /api/v1/users/:id", () => {
    it("should get user by id (admin only)", async () => {
      const res = await request(app)
        .get(`/api/v1/users/${userId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.status).toBe("success");
      expect(res.body.data.user._id).toBe(userId);
    });

    it("should not get user by id without admin role", async () => {
      const res = await request(app)
        .get(`/api/v1/users/${adminUserId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(403);

      expect(res.body.status).toBe("fail");
    });
  });

  describe("DELETE /api/v1/users/:id", () => {
    it("should delete user (admin only)", async () => {
      const res = await request(app)
        .delete(`/api/v1/users/${userId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(204);
    });

    it("should not delete user without admin role", async () => {
      const res = await request(app)
        .delete(`/api/v1/users/${adminUserId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(403);

      expect(res.body.status).toBe("fail");
    });
  });
});

describe("User API - Password Reset", () => {
  beforeEach(async () => {
    await request(app).post("/api/v1/users/signup").send({
      name: "Reset User",
      email: "reset@example.com",
      password: "12345678",
      passwordConfirm: "12345678",
    });
  });

  describe("POST /api/v1/users/forgotPassword", () => {
    it("should send password reset token", async () => {
      const res = await request(app)
        .post("/api/v1/users/forgotPassword")

        .send({
          email: "reset@example.com",
        })
        .expect(200);

      expect(res.body.status).toBe("success");
      expect(res.body.message).toContain("Token sent");
    });

    it("should return error for non-existent email", async () => {
      const res = await request(app)
        .post("/api/v1/users/forgotPassword")

        .send({
          email: "nonexistent@example.com",
        })
        .expect(404);

      expect(res.body.status).toBe("fail");
    });
  });
});
