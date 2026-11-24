export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

type Listener = () => void;
const unauthListeners = new Set<Listener>();
export const onUnauthorised = (l: Listener) => {
  unauthListeners.add(l);
  return () => {
    unauthListeners.delete(l);
  };
};

export const IS_DEMO = import.meta.env.VITE_DEMO_MODE === "true";

export async function api<T = unknown>(method: string, url: string, body?: unknown): Promise<T> {
  if (IS_DEMO) {
    const { demoApi, DemoApiError } = await import("./demo-backend");
    try {
      return await demoApi<T>(method, url, body);
    } catch (e) {
      if (e instanceof DemoApiError) {
        if (e.status === 401 && !url.startsWith("/auth")) unauthListeners.forEach((l) => l());
        throw new ApiError(e.status, e.message);
      }
      throw e;
    }
  }
  const res = await fetch("/api" + url, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith("/auth")) unauthListeners.forEach((l) => l());
    throw new ApiError(res.status, json.error ?? `Request failed (${res.status})`, json.code);
  }
  return json as T;
}

export const get = <T,>(url: string) => api<T>("GET", url);
export const post = <T,>(url: string, body?: unknown) => api<T>("POST", url, body ?? {});
export const put = <T,>(url: string, body?: unknown) => api<T>("PUT", url, body ?? {});
export const del = <T,>(url: string, body?: unknown) => api<T>("DELETE", url, body ?? {});

declare global {
  interface Window {
    desktop?: {
      isDesktop: true;
      savePdf(opts: { fileName: string; landscape?: boolean }): Promise<{ ok: boolean; filePath?: string }>;
      chooseFolder(): Promise<string | null>;
      chooseBackupFile(): Promise<string | null>;
      openDataFolder(): Promise<void>;
    };
  }
}

/** Saves the current view as PDF (desktop) or opens the print dialog (browser). */
export async function saveAsPdf(fileName: string) {
  if (window.desktop) return window.desktop.savePdf({ fileName });
  window.print();
  return { ok: true };
}

export function downloadCsv(fileName: string, rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    let s = v == null ? "" : String(v);
    if (typeof v === "string" && /^[=+\-@]/.test(s)) s = "'" + s; // neutralise spreadsheet formulas
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
