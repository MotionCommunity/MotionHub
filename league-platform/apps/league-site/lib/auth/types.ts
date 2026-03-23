export type AppRole = "founder" | "staff" | "partner";

export type SessionPayload = {
  sub: string;
  username: string;
  avatarUrl: string | null;
  discordRoles: string[];
  appRole: AppRole | null;
  exp?: number;
  iat?: number;
};

