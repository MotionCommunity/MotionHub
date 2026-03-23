import { type AppRole } from "./types";

export const AUTH_COOKIE = "motion_session";
export const OAUTH_STATE_COOKIE = "motion_oauth_state";

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
}

export function discordRedirectUri(): string {
  return process.env.DISCORD_REDIRECT_URI?.trim() || `${appUrl()}/api/auth/callback`;
}

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

export function resolveAppRole(discordRoleIds: string[]): AppRole | null {
  const founderRoleId = process.env.DISCORD_ROLE_FOUNDER_ID?.trim();
  const staffRoleId = process.env.DISCORD_ROLE_STAFF_ID?.trim();
  const partnerRoleId = process.env.DISCORD_ROLE_PARTNER_ID?.trim();

  if (founderRoleId && discordRoleIds.includes(founderRoleId)) return "founder";
  if (staffRoleId && discordRoleIds.includes(staffRoleId)) return "staff";
  if (partnerRoleId && discordRoleIds.includes(partnerRoleId)) return "partner";
  return null;
}

export function isAdminRole(role: AppRole | null): boolean {
  return role === "founder" || role === "staff";
}

