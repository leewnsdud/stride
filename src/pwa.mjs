let installPrompt = null;
let installed = false;
const listeners = new Set();
const standalone = window.matchMedia("(display-mode: standalone)");
const notify = () => listeners.forEach((listener) => listener());
export const pwaState = () =>
  installed || standalone.matches || navigator.standalone === true
    ? "installed"
    : installPrompt
      ? "available"
      : "manual";
export const subscribePwa = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  notify();
});
window.addEventListener("appinstalled", () => {
  installed = true;
  installPrompt = null;
  notify();
});
standalone.addEventListener("change", notify);
export async function installPwa() {
  const prompt = installPrompt;
  if (!prompt) return;
  installPrompt = null;
  notify();
  await prompt.prompt();
  return (await prompt.userChoice).outcome;
}
export function registerPwa() {
  if (
    !import.meta.env.PROD ||
    !("serviceWorker" in navigator) ||
    !window.isSecureContext
  )
    return;
  navigator.serviceWorker
    .register("/sw.js", { scope: "/", updateViaCache: "none" })
    .catch((error) =>
      console.warn("Stride offline screen registration failed", error),
    );
}
