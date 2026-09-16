import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  chmodSync,
  openSync,
  closeSync,
  fsyncSync,
  renameSync,
  rmSync,
} from "node:fs";
import path from "node:path";

export function backupDatabase(source, directory) {
  // Read-only opening rejects a missing database instead of backing up a new empty file.
  const db = new DatabaseSync(source, { readOnly: true });
  let partial;
  try {
    db.prepare("SELECT dataset,kind,id,data FROM entries LIMIT 1").get();
    db.prepare(
      "SELECT dataset,session_id,activity_id FROM links LIMIT 1",
    ).get();
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    chmodSync(directory, 0o700);
    const name = `stride-${new Date().toISOString().replaceAll(":", "-")}-${randomUUID().slice(0, 8)}.sqlite`;
    const destination = path.join(directory, name);
    const staging = `${destination}.partial`;
    const reserved = openSync(staging, "wx", 0o600);
    partial = staging;
    closeSync(reserved);
    db.exec("PRAGMA synchronous=FULL");
    db.prepare("VACUUM INTO ?").run(partial);
    const copy = new DatabaseSync(partial, { readOnly: true });
    try {
      const result = copy.prepare("PRAGMA quick_check").all();
      if (result.length !== 1 || result[0].quick_check !== "ok")
        throw new Error("백업 무결성 검사를 통과하지 못했습니다.");
    } finally {
      copy.close();
    }
    const fd = openSync(partial, "r");
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(partial, destination);
    partial = null;
    return destination;
  } finally {
    db.close();
    if (partial) rmSync(partial, { force: true });
  }
}
