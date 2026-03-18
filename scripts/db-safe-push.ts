// Safe Database Push Script
// This script backs up the database before pushing schema changes
// Run with: bunx tsx scripts/db-safe-push.ts

import { execSync } from "child_process";
import { existsSync, mkdirSync, copyFileSync, writeFileSync } from "fs";
import { join } from "path";

const DB_PATH = "/home/z/my-project/db/custom.db";
const BACKUP_DIR = "/home/z/my-project/db/backups";

function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(BACKUP_DIR, `pre-push-${timestamp}.db`);

  // Create backup directory if it doesn't exist
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Check if database exists
  if (!existsSync(DB_PATH)) {
    console.log("ℹ️ No database file found to backup.");
    return null;
  }

  // Copy database file
  copyFileSync(DB_PATH, backupPath);
  console.log(`✅ Database backed up to: ${backupPath}`);

  return backupPath;
}

function pushSchema() {
  console.log("\n📦 Pushing schema changes to database...");
  try {
    execSync("bunx prisma db push --accept-data-loss", {
      stdio: "inherit",
      cwd: "/home/z/my-project",
    });
    console.log("✅ Schema pushed successfully!");
    return true;
  } catch (error) {
    console.error("❌ Schema push failed:", error);
    return false;
  }
}

function main() {
  console.log("🔒 Safe Database Push");
  console.log("========================\n");

  // Step 1: Backup
  console.log("Step 1: Creating backup...");
  const backupPath = backupDatabase();

  // Step 2: Push schema
  console.log("\nStep 2: Pushing schema changes...");
  const success = pushSchema();

  if (success) {
    console.log("\n✅ All done! Database updated successfully.");
    if (backupPath) {
      console.log(`📁 Backup saved at: ${backupPath}`);
    }
  } else {
    console.log("\n❌ Push failed. Database unchanged.");
    if (backupPath) {
      console.log(`📁 You can restore from: ${backupPath}`);
      console.log(`   Run: bunx tsx scripts/backup-db.ts restore ${backupPath.split("/").pop()}`);
    }
  }
}

main();
