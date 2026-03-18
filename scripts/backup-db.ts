// Database Backup Script
// Run with: bunx tsx scripts/backup-db.ts [backup|list|restore <filename>]

import { existsSync, mkdirSync, copyFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const DB_PATH = "/home/z/my-project/db/custom.db";
const BACKUP_DIR = "/home/z/my-project/db/backups";

function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(BACKUP_DIR, `backup-${timestamp}.db`);

  // Create backup directory if it doesn't exist
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Check if database exists
  if (!existsSync(DB_PATH)) {
    console.log("No database file found to backup.");
    return null;
  }

  // Copy database file
  copyFileSync(DB_PATH, backupPath);
  console.log(`✅ Database backed up to: ${backupPath}`);

  // Create metadata file
  const metadata = {
    timestamp: new Date().toISOString(),
    originalPath: DB_PATH,
    backupPath,
    size: existsSync(backupPath) ? 
      Math.round((statSync(backupPath).size / 1024)) + " KB" : "Unknown",
  };
  
  const metadataPath = backupPath.replace(".db", ".json");
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  return backupPath;
}

function listBackups() {
  if (!existsSync(BACKUP_DIR)) {
    console.log("No backups found.");
    return [];
  }

  const backups = readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".db"))
    .sort()
    .reverse();

  console.log(`\n📋 Found ${backups.length} backup(s):`);
  backups.forEach((b, i) => {
    const backupPath = join(BACKUP_DIR, b);
    const stats = statSync(backupPath);
    const size = Math.round(stats.size / 1024);
    const date = stats.mtime.toISOString().split("T")[0];
    console.log(`  ${i + 1}. ${b} (${size} KB, ${date})`);
  });

  return backups;
}

function restoreBackup(backupName: string) {
  const backupPath = join(BACKUP_DIR, backupName);
  
  if (!existsSync(backupPath)) {
    console.error(`❌ Backup not found: ${backupName}`);
    return false;
  }

  // Create a backup of current database before restore
  if (existsSync(DB_PATH)) {
    const currentBackup = DB_PATH.replace(".db", "-before-restore.db");
    copyFileSync(DB_PATH, currentBackup);
    console.log(`Current database saved to: ${currentBackup}`);
  }

  // Restore
  copyFileSync(backupPath, DB_PATH);
  console.log(`✅ Database restored from: ${backupName}`);
  
  return true;
}

// Main
const args = process.argv.slice(2);
const command = args[0];

if (command === "restore" && args[1]) {
  restoreBackup(args[1]);
} else if (command === "list") {
  listBackups();
} else {
  // Default: create backup
  backupDatabase();
}

export { backupDatabase, listBackups, restoreBackup };
