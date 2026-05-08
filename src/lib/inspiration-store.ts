import { apiGet, apiPut } from "./api";

const KEY = "tracker-inspiration";

export interface InspirationDoc {
  html: string;
  updatedAt: string | null;
}

export async function loadInspiration(): Promise<InspirationDoc> {
  return apiGet<InspirationDoc>("inspiration", KEY, { html: "", updatedAt: null });
}

export async function saveInspiration(html: string): Promise<void> {
  await apiPut("inspiration", KEY, { html, updatedAt: new Date().toISOString() });
}
