import { apiGet, apiPut, isApiAvailable } from "./api";

const AUTH_KEY = "tracker-auth-credentials";
const SESSION_KEY = "tracker-auth-session";

interface Credentials {
  username: string;
  passwordHash: string;
}

const DEFAULT_USERNAME = "admin";
const DEFAULT_PASSWORD = "@Tracker@";

async function hashPassword(password: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch { /* fallback below */ }
  }
  let hash = 5381;
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) + hash + password.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

async function getCredentials(): Promise<Credentials> {
  const creds = await apiGet<Credentials | null>("credentials", AUTH_KEY, null);
  if (creds) return creds;
  // Initialize with defaults
  const passwordHash = await hashPassword(DEFAULT_PASSWORD);
  const defaultCreds: Credentials = { username: DEFAULT_USERNAME, passwordHash };
  await apiPut("credentials", AUTH_KEY, defaultCreds);
  return defaultCreds;
}

export async function login(username: string, password: string): Promise<boolean> {
  const creds = await getCredentials();
  const passwordHash = await hashPassword(password);
  if (creds.username === username && creds.passwordHash === passwordHash) {
    sessionStorage.setItem(SESSION_KEY, "authenticated");
    return true;
  }
  return false;
}

export function isAuthenticated(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === "authenticated";
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}

export async function updateCredentials(
  currentPassword: string,
  newUsername: string,
  newPassword: string
): Promise<boolean> {
  const creds = await getCredentials();
  const currentHash = await hashPassword(currentPassword);
  if (creds.passwordHash !== currentHash) return false;
  const newHash = await hashPassword(newPassword);
  const updated: Credentials = { username: newUsername, passwordHash: newHash };
  await apiPut("credentials", AUTH_KEY, updated);
  return true;
}

export async function getCurrentUsername(): Promise<string> {
  const creds = await getCredentials();
  return creds.username;
}
