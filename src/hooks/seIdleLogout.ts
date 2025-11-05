// src/hooks/useIdleLogout.ts
"use client";

import { useEffect, useRef } from "react";
import { logoutEverywhere } from "../utils/logout";

type Opts = {
  /** Minutos de inactividad para cerrar sesión (default 10) */
  minutes?: number;
  /** Si quieres pausar el conteo cuando la pestaña no está visible */
  onlyWhenVisible?: boolean;
};

const LAST_ACTIVITY_KEY = "app:last-activity-ms";
const LOGOUT_BROADCAST = "auth"; // canal BroadcastChannel

export function useIdleLogout(opts: Opts = {}) {
  const minutes = opts.minutes ?? 10;
  const onlyWhenVisible = opts.onlyWhenVisible ?? false;
  const timeoutMs = Math.max(1, minutes) * 60 * 1000;

  const lastActivity = useRef<number>(Date.now());
  const timerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const updateActivity = () => {
      lastActivity.current = Date.now();
      try {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(lastActivity.current));
      } catch {}
      // Reinicia el timer de "disparo único" por si lo prefieres así
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        // chequeo final por si hubo actividad justo antes
        const now = Date.now();
        if (now - lastActivity.current >= timeoutMs) {
          logoutEverywhere();
        }
      }, timeoutMs) as unknown as number;
    };

    // Dispara al montar (para no depender de un primer evento)
    updateActivity();

    const activityEvents = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "pointerdown",
      "wheel",
    ];

    activityEvents.forEach((ev) => window.addEventListener(ev, updateActivity, { passive: true }));

    // Reaccionar a cambios de visibilidad (opcional)
    const handleVisibility = () => {
      if (!onlyWhenVisible) return;
      if (document.visibilityState === "visible") {
        updateActivity();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Intervalo de seguridad (por si el timeout fue limpiado en caliente)
    intervalRef.current = window.setInterval(() => {
      if (onlyWhenVisible && document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastActivity.current >= timeoutMs) {
        logoutEverywhere();
      }
    }, 15 * 1000) as unknown as number; // cada 15s revisa

    // Sync entre pestañas via storage (si otra pestaña escribe última actividad)
    const onStorage = (e: StorageEvent) => {
      if (e.key === LAST_ACTIVITY_KEY && e.newValue) {
        lastActivity.current = Number(e.newValue) || Date.now();
      }
    };
    window.addEventListener("storage", onStorage);

    // Forzar logout si otra pestaña lo pidió
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(LOGOUT_BROADCAST);
      bc.onmessage = (msg) => {
        if (msg?.data?.type === "force-logout") {
          logoutEverywhere(); // ya redirige
        }
      };
    } catch {}

    return () => {
      activityEvents.forEach((ev) => window.removeEventListener(ev, updateActivity));
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("storage", onStorage);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      try { bc?.close(); } catch {}
    };
  }, [minutes, onlyWhenVisible, timeoutMs]);
}

