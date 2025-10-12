const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // const DB = process.env.DATABASE.replace(
    //   '<PASSWORD>',
    //   process.env.DATABASE_PASSWORD
    // );
    const DB = process.env.DATABASE;

    const conn = await mongoose.connect(DB);
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
