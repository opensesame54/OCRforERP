const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI;
  if (!mongoURI) {
    console.warn('⚠️ MONGO_URI is missing in env. Running in MOCK DB (memory) mode.');
    global.isMockDB = true;
    return;
  }
  try {
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✅ Connected to MongoDB Atlas.');
    global.isMockDB = false;
    const seedMongoDatabase = require('./dbSeeder');
    await seedMongoDatabase();
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.warn('⚠️ Running in MOCK DB (memory) mode due to connection failure.');
    global.isMockDB = true;
  }
};

module.exports = connectDB;
