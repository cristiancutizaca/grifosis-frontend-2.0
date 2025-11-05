// src/utils/logout.ts
"use client";

import { safeLocal, safeSession } from "../utils/safeStorage";

export function clearAuth() {
  try {
    // limpia todos los posibles nombres legacy
    safeSession.removeItem("token");
    safeLocal.removeItem("token");
    safeLocal.removeItem("authToken");
    safeSession.removeItem("authToken");
  } catch {}
}

export function broadcastLogout() {
  try {
    // sincroniza entre pestañas
    const bc = new BroadcastChannel("auth");
    bc.postMessage({ type: "force-logout" });
    bc.close();
  } catch {}
}

export function forceRedirectToLogin() {
  // evita problemas con router si el componente ya desmontó
  if (typeof window !== "undefined") {
    window.location.replace("/"); // tu login está en "/"
  }
}

/** Cerrar sesión en todas las pestañas y redirigir */
export function logoutEverywhere() {
  clearAuth();
  broadcastLogout();
  forceRedirectToLogin();
}

