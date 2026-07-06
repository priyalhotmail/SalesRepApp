import { syncQueuedRequests } from "./offlineQueue";

export function registerServiceWorker() {
  if ("serviceWorker" in navigator && !import.meta.env.DEV) {
    window.addEventListener("load", () => {
      void navigator.serviceWorker.register("/service-worker.js");
    });
  }

  window.addEventListener("online", () => {
    const token = window.localStorage.getItem("accessToken") ?? undefined;
    void syncQueuedRequests(token);
  });
}
