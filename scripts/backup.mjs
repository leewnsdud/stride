import path from "node:path";
import { backupDatabase } from "../server/backup.mjs";
try {
  console.log(
    backupDatabase(
      path.resolve("data/stride.sqlite"),
      path.resolve("data/backups"),
    ),
  );
} catch (error) {
  console.error(`백업을 만들지 못했습니다: ${error.message}`);
  process.exitCode = 1;
}
