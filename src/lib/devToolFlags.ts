import { useEffect, useState } from "react";

/**
 * localStorage-backed boolean flags for admin dev tool visibility.
 * Components subscribe via useDevToolFlag().
 */
export type DevToolKey = "promptBuilder" | "styleExport" | "testBar";

const STORAGE_PREFIX = "devTool.visible.";
const EVENT_NAME = "devtool-flag-change";

const DEFAULTS: Record<DevToolKey, boolean> = {
  promptBuilder: false,
  styleExport: false,
  testBar: false,
};

export function getDevToolFlag(key: DevToolKey): boolean {
  if (typeof window === "undefined") return DEFAULTS[key];
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (raw === null) return DEFAULTS[key];
    return raw === "1";
  } catch {
    return DEFAULTS[key];
  }
}

export function setDevToolFlag(key: DevToolKey, value: boolean) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, value ? "1" : "0");
  } catch { /* noop */ }
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { key, value } }));
  } catch { /* noop */ }
}

export function useDevToolFlag(key: DevToolKey): boolean {
  const [value, setValue] = useState<boolean>(() => getDevToolFlag(key));
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.key === key) setValue(getDevToolFlag(key));
    };
    const storageHandler = (e: StorageEvent) => {
      if (e.key === STORAGE_PREFIX + key) setValue(getDevToolFlag(key));
    };
    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener("storage", storageHandler);
    };
  }, [key]);
  return value;
}
