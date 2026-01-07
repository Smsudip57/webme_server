#!/usr/bin/env node

/**
 * Migration Runner Script
 * Run this to execute all pending migrations
 *
 * Usage: node webme_server/migrations/run.js
 */

const mongoose = require("mongoose");
require("dotenv").config();

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/webmedigital";

const { runMigration } = require("./001_migrate_project_schema");

const main = async () => {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // Run all migrations in order
    console.log("📋 Running migrations...\n");
    await runMigration();

    console.log("🎉 All migrations completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
};

main();
