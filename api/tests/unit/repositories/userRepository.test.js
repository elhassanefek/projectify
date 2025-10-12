const User = require("../../../src/models/userModel");
const userRepository = require("../../../src/repositories/userRepository");

jest.mock("../../../src/models/userModel");

describe("userRepository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a user", async () => {
      const mockUser = { name: "John" };
      User.create.mockResolvedValue(mockUser);

      const result = await userRepository.create({ name: "John" });

      expect(User.create).toHaveBeenCalledWith({ name: "John" });
      expect(result).toEqual(mockUser);
    });
  });

  describe("findAll", () => {
    it("should return all users", async () => {
      const mockUsers = [
        { _id: "1", name: "John" },
        { _id: "2", name: "Jane" },
      ];
      User.find.mockReturnValue(mockUsers);

      const result = await userRepository.findAll();

      expect(User.find).toHaveBeenCalled();
      expect(result).toEqual(mockUsers);
    });
  });

  describe("findById", () => {
    it("should find a user by id", async () => {
      const mockUser = { _id: "123", name: "John" };
      User.findById.mockResolvedValue(mockUser);

      const result = await userRepository.findById("123");

      expect(User.findById).toHaveBeenCalledWith("123");
      expect(result).toEqual(mockUser);
    });
  });

  describe("findByEmail", () => {
    it("should find a user by email with password", async () => {
      const mockUser = {
        _id: "123",
        email: "john@example.com",
        password: "hashed",
      };
      const mockSelect = jest.fn().mockResolvedValue(mockUser);
      User.findOne.mockReturnValue({ select: mockSelect });

      const result = await userRepository.findByEmail("john@example.com");

      expect(User.findOne).toHaveBeenCalledWith({ email: "john@example.com" });
      expect(mockSelect).toHaveBeenCalledWith("+password");
      expect(result).toEqual(mockUser);
    });
  });

  describe("updateById", () => {
    it("should update a user by id", async () => {
      const mockUpdatedUser = { _id: "123", name: "John Updated" };
      User.findByIdAndUpdate.mockResolvedValue(mockUpdatedUser);

      const updateData = { name: "John Updated" };
      const result = await userRepository.updateById("123", updateData);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith("123", updateData, {
        new: true,
        runValidators: true,
      });
      expect(result).toEqual(mockUpdatedUser);
    });
  });

  describe("softDelete", () => {
    it("should soft delete a user by setting isActive to false", async () => {
      const mockUser = { _id: "123", isActive: false };
      User.findByIdAndUpdate.mockResolvedValue(mockUser);

      const result = await userRepository.softDelete("123");

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith("123", {
        isActive: false,
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe("deleteById", () => {
    it("should permanently delete a user by id", async () => {
      const mockUser = { _id: "123", name: "John" };
      User.findByIdAndDelete.mockResolvedValue(mockUser);

      const result = await userRepository.deleteById("123");

      expect(User.findByIdAndDelete).toHaveBeenCalledWith("123");
      expect(result).toEqual(mockUser);
    });
  });

  describe("findByIdWithPassword", () => {
    it("should find a user by id with password included", async () => {
      const mockUser = { _id: "123", name: "John", password: "hashed" };
      const mockSelect = jest.fn().mockResolvedValue(mockUser);
      User.findById.mockReturnValue({ select: mockSelect });

      const result = await userRepository.findByIdWithPassword("123");

      expect(User.findById).toHaveBeenCalledWith("123");
      expect(mockSelect).toHaveBeenCalledWith("+password");
      expect(result).toEqual(mockUser);
    });
  });
});
