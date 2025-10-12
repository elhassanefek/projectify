const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongoServer;

const connectTestDB = async () => {
  try {
    // Close any existing connections
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    // Create new in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log("✅ Test database connected");
  } catch (err) {
    console.error("❌ Test database connection error:", err);
    throw err;
  }
};

const clearDB = async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      console.warn("⚠️ No database connection to clear");
      return;
    }

    const collections = mongoose.connection.collections;

    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  } catch (err) {
    console.error("❌ Error clearing database:", err);
    throw err;
  }
};

const disconnectTestDB = async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }

    if (mongoServer) {
      await mongoServer.stop();
    }

    console.log("✅ Test database disconnected");
  } catch (err) {
    console.error("❌ Error disconnecting test database:", err);
    throw err;
  }
};

module.exports = {
  connectTestDB,
  clearDB,
  disconnectTestDB,
};
