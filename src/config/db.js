const mongoose = require("mongoose");

// FIX: removed the forced dns.setServers(["8.8.8.8", ...]) override that was
// here before. Your MONGO_URI is a mongodb+srv:// string, which relies on
// DNS SRV/TXT lookups to discover the actual replica-set hosts. Forcing
// every lookup in this process through public DNS resolvers (instead of
// Render's own default resolver, which has a reliable path to Atlas) can
// return a technically-valid Atlas node IP that Render's network can't
// consistently reach — producing exactly the repeated
// "connection X to <ip>:27017 timed out" errors seen in the logs, on the
// very first connection attempt, every restart. Letting Node use Render's
// default DNS resolver fixes this.
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      family: 4,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
