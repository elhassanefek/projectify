const jwt = require("jsonwebtoken");
const sendEmail = require("../../../src/utils/email");
const AppError = require("../../../src/utils/appError");
const authService = require("../../../src/services/authService");

jest.mock("jsonwebtoken");
jest.mock("../../../src/utils/email");

describe("authService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_EXPIRES_IN = "7d";
    process.env.JWT_COOKIE_EXPIRES_IN = "7";
  });

  describe("signToken", () => {
    it("should create a JWT token with user id", () => {
      const mockToken = "mockToken123";
      jwt.sign.mockReturnValue(mockToken);

      const result = authService.signToken("userId123");

      expect(jwt.sign).toHaveBeenCalledWith(
        { id: "userId123" },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );
      expect(result).toBe(mockToken);
    });
  });

  describe("createSendToken", () => {
    it("should create and send token with cookie in development", async () => {
      const mockUser = { _id: "123", name: "John", password: "hashedPass" };
      const mockToken = "mockToken";
      jwt.sign.mockReturnValue(mockToken);

      const res = {
        cookie: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      process.env.NODE_ENV = "development";

      await authService.createSendToken(mockUser, 200, res);

      expect(jwt.sign).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalledWith(
        "jwt",
        mockToken,
        expect.objectContaining({
          httpOnly: true,
          expires: expect.any(Date),
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: "success",
        token: mockToken,
        data: { user: expect.objectContaining({ name: "John" }) },
      });
      expect(mockUser.password).toBeUndefined();
    });

    it("should set secure cookie option in production", async () => {
      const mockUser = { _id: "123", name: "John" };
      jwt.sign.mockReturnValue("mockToken");

      const res = {
        cookie: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      process.env.NODE_ENV = "production";

      await authService.createSendToken(mockUser, 201, res);

      expect(res.cookie).toHaveBeenCalledWith(
        "jwt",
        "mockToken",
        expect.objectContaining({
          httpOnly: true,
          secure: true,
        })
      );
    });
  });

  describe("sendPasswordResetEmail", () => {
    it("should send password reset email successfully", async () => {
      const mockUser = { email: "user@example.com" };
      const resetToken = "resetToken123";
      const req = {
        protocol: "https",
        get: jest.fn().mockReturnValue("example.com"),
      };

      sendEmail.mockResolvedValue(true);

      await authService.sendPasswordResetEmail(mockUser, resetToken, req);

      expect(req.get).toHaveBeenCalledWith("host");
      expect(sendEmail).toHaveBeenCalledWith({
        email: "user@example.com",
        subject: "Your password reset token (valid for 10 min)",
        message: expect.stringContaining(
          "https://example.com/api/v1/auth/resetPassword/resetToken123"
        ),
      });
    });

    it("should throw AppError when email sending fails", async () => {
      const mockUser = {
        email: "user@example.com",
        passwordResetToken: "token",
        passwordResetExpires: Date.now(),
        save: jest.fn().mockResolvedValue(true),
      };
      const resetToken = "resetToken123";
      const req = {
        protocol: "https",
        get: jest.fn().mockReturnValue("example.com"),
      };

      sendEmail.mockRejectedValue(new Error("Email service error"));

      await expect(
        authService.sendPasswordResetEmail(mockUser, resetToken, req)
      ).rejects.toThrow(AppError);

      await expect(
        authService.sendPasswordResetEmail(mockUser, resetToken, req)
      ).rejects.toThrow(
        "There was an error sending the email. Try again later!"
      );

      expect(mockUser.passwordResetToken).toBeUndefined();
      expect(mockUser.passwordResetExpires).toBeUndefined();
      expect(mockUser.save).toHaveBeenCalledWith({ validateBeforeSave: false });
    });
  });

  describe("verifyToken", () => {
    it("should verify a valid token", async () => {
      const mockToken = "validToken";
      const mockDecoded = { id: "userId123", iat: 1234567890 };
      jwt.verify.mockReturnValue(mockDecoded);

      const result = await authService.verifyToken(mockToken);

      expect(jwt.verify).toHaveBeenCalledWith(
        mockToken,
        process.env.JWT_SECRET
      );
      expect(result).toEqual(mockDecoded);
    });

    it("should throw error for invalid token", async () => {
      const mockToken = "invalidToken";
      jwt.verify.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      await expect(authService.verifyToken(mockToken)).rejects.toThrow(
        "Invalid token"
      );
    });
  });
});
