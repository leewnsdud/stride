import { createApp } from "./app.mjs";
const { app, sync, close } = createApp();
const port = Number(process.env.PORT || 4318);
const server = app.listen(port, "127.0.0.1", () =>
  console.log(`STRIDE server: http://127.0.0.1:${port}`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.once(signal, () => {
    close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  });
if (process.env.AUTO_SYNC === "true") {
  setInterval(
    () => sync().catch((e) => console.error("Scheduled sync:", e.message)),
    60 * 60 * 1000,
  ).unref();
}
