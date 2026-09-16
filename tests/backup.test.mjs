import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  cpSync,
  statSync,
  existsSync,
  readdirSync,
} from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";
import { createStore } from "../server/store.mjs";
import { backupDatabase } from "../server/backup.mjs";
const contents = (db) => ({
  entries: db.prepare("SELECT * FROM entries ORDER BY dataset,kind,id").all(),
  links: db.prepare("SELECT * FROM links ORDER BY dataset,session_id").all(),
});
test("live WAL snapshot restores records, links, reviews and both datasets after restart", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "stride-backup-test-"));
  const store = createStore(path.join(dir, "source.sqlite"));
  let restored;
  try {
    store.db.exec("PRAGMA wal_autocheckpoint=0");
    store.put("live", "activity", {
      id: "a",
      name: "백업 합성 활동",
      distance: 5,
      detail: { points: [{ time: 0, hr: 140 }] },
    });
    store.put("live", "session", { id: "s", title: "합성 훈련", duration: 30 });
    store.link("live", "s", "a");
    store.put("live", "review", {
      id: "r",
      activityId: "a",
      text: "합성 리뷰",
      evidence: { source: "manual" },
    });
    store.put("live", "trash", {
      id: "t",
      kind: "activity",
      entry: { id: "deleted" },
    });
    store.put("live", "planning", {
      id: "intake",
      answers: { start: "2026-09-15" },
    });
    const expected = contents(store.db);
    assert.ok(statSync(path.join(dir, "source.sqlite-wal")).size > 0);
    const copy = backupDatabase(
      path.join(dir, "source.sqlite"),
      path.join(dir, "backups"),
    );
    const second = backupDatabase(
      path.join(dir, "source.sqlite"),
      path.join(dir, "backups"),
    );
    assert.notEqual(copy, second);
    assert.equal(statSync(copy).mode & 0o777, 0o600);
    assert.equal(statSync(path.dirname(copy)).mode & 0o777, 0o700);
    assert.equal(
      readdirSync(path.dirname(copy)).some((name) => name.endsWith(".partial")),
      false,
    );
    store.put("live", "activity", { id: "after-backup", name: "스냅샷 이후" });
    cpSync(copy, path.join(dir, "restored.sqlite"));
    restored = createStore(path.join(dir, "restored.sqlite"));
    assert.deepEqual(contents(restored.db), expected);
    assert.equal(restored.sessions("live")[0].activityId, "a");
    restored.db.close();
    restored = createStore(path.join(dir, "restored.sqlite"));
    assert.deepEqual(contents(restored.db), expected);
  } finally {
    restored?.db.close();
    store.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("missing or unrelated source fails without creating a success-shaped backup", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "stride-backup-test-"));
  try {
    const missing = path.join(dir, "missing.sqlite"),
      backups = path.join(dir, "backups");
    assert.throws(() => backupDatabase(missing, backups));
    assert.equal(existsSync(missing), false);
    const empty = new DatabaseSync(path.join(dir, "empty.sqlite"));
    empty.close();
    assert.throws(() =>
      backupDatabase(path.join(dir, "empty.sqlite"), backups),
    );
    assert.equal(existsSync(backups), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
