import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync, chmodSync } from "node:fs";
import path from "node:path";
import { day, monday, today } from "./domain.mjs";
export function createStore(file) {
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(file);
  chmodSync(file, 0o600);
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS entries(dataset TEXT NOT NULL,kind TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(dataset,kind,id)); CREATE TABLE IF NOT EXISTS links(dataset TEXT NOT NULL,session_id TEXT NOT NULL,activity_id TEXT NOT NULL,PRIMARY KEY(dataset,session_id),UNIQUE(dataset,activity_id));",
  );
  const store = {
    db,
    list(ds, kind) {
      return db
        .prepare("SELECT id,data FROM entries WHERE dataset=? AND kind=?")
        .all(ds, kind)
        .map((x) => ({ ...JSON.parse(x.data), id: x.id }));
    },
    get(ds, kind, id) {
      return store.list(ds, kind).find((x) => x.id === id);
    },
    put(ds, kind, data) {
      const id = data.id || randomUUID();
      db.prepare(
        "INSERT INTO entries VALUES(?,?,?,?) ON CONFLICT(dataset,kind,id) DO UPDATE SET data=excluded.data",
      ).run(ds, kind, id, JSON.stringify({ ...data, id }));
      return { ...data, id };
    },
    remove(ds, kind, id) {
      db.prepare("DELETE FROM entries WHERE dataset=? AND kind=? AND id=?").run(
        ds,
        kind,
        id,
      );
      if (kind === "session")
        db.prepare("DELETE FROM links WHERE dataset=? AND session_id=?").run(
          ds,
          id,
        );
      if (kind === "activity")
        db.prepare("DELETE FROM links WHERE dataset=? AND activity_id=?").run(
          ds,
          id,
        );
    },
    sessions(ds) {
      const links = db.prepare("SELECT * FROM links WHERE dataset=?").all(ds);
      return store.list(ds, "session").map((s) => ({
        ...s,
        activityId:
          links.find((l) => l.session_id === s.id)?.activity_id || null,
      }));
    },
    link(ds, s, a) {
      if (!store.get(ds, "session", s) || !store.get(ds, "activity", a))
        throw new Error("훈련 또는 활동을 찾을 수 없습니다.");
      db.prepare(
        "INSERT INTO links VALUES(?,?,?) ON CONFLICT(dataset,session_id) DO UPDATE SET activity_id=excluded.activity_id",
      ).run(ds, s, a);
    },
    unlink(ds, s) {
      db.prepare("DELETE FROM links WHERE dataset=? AND session_id=?").run(
        ds,
        s,
      );
    },
    transaction(fn) {
      db.exec("BEGIN");
      try {
        const result = fn();
        db.exec("COMMIT");
        return result;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
  if (!store.list("demo", "goal").length) {
    const week = monday();
    const base = new Date(week);
    store.put("demo", "goal", {
      id: "demo-road",
      name: "가을, 나의 첫 Sub 4",
      date: day(65),
      type: "road",
      distance: 42.195,
      elevation: 0,
      targetMinutes: 240,
    });
    store.put("demo", "goal", {
      id: "demo-trail",
      name: "산을 따라, 50K",
      date: day(100),
      type: "trail",
      distance: 50,
      elevation: 2500,
      targetMinutes: 540,
    });
    for (let i = 0; i < 8; i++) {
      for (let j of [0, 2, 4, 6]) {
        const offset = -49 + i * 7 + j;
        if (day(offset, base) > today()) continue;
        const distance = j === 6 ? 17 + i * 0.5 : 6.5 + (i % 3) + j * 0.3;
        store.put("demo", "activity", {
          id: `demo-a-${i}-${j}`,
          name:
            j === 6
              ? "북한산 트레일 롱런"
              : j === 2
                ? "한강 템포 러닝"
                : "아침의 이지 러닝",
          date: day(offset, base),
          type: j === 6 ? "trail" : "road",
          distance,
          duration: distance * (j === 6 ? 8 : 5.65 + (i % 3) * 0.1),
          elevation: j === 6 ? 650 + i * 40 : 20,
          hr: j === 2 ? 158 : 139,
          rpe: j === 2 ? 7 : 4,
          source: "demo",
          load: distance * 5,
          notes: "데모 활동입니다.",
        });
      }
    }
    [0, 2, 4, 5, 6].forEach((n, i) => {
      const s = store.put("demo", "session", {
        id: `demo-s-${i}`,
        title: [
          "이지 러닝",
          "템포 러닝",
          "이지 러닝",
          "회복 러닝",
          "트레일 롱런",
        ][i],
        date: day(n, base),
        type: ["easy", "tempo", "easy", "easy", "trail"][i],
        distance: [7, 10, 8, 5, 18][i],
        duration: [42, 55, 48, 32, 150][i],
        elevation: i === 4 ? 800 : 0,
        notes: "몸의 리듬에 집중하며 편안하게 달려보세요.",
        goalId: "demo-road",
      });
      const a = store.list("demo", "activity").find((a) => a.date === s.date);
      if (a) store.link("demo", s.id, a.id);
    });
  }
  return store;
}
