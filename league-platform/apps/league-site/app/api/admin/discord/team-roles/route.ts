import { NextResponse } from "next/server";
import { isAdminRole } from "@/lib/auth/config";
import { getServerSession } from "@/lib/auth/session-server";

type TeamRoleOption = {
  name: string;
  roleId: string;
};

const defaultTeamRoles: TeamRoleOption[] = [
  { name: "Legacy", roleId: "1482963996804911194" },
  { name: "Genesis", roleId: "1482964123527549072" },
  { name: "Ignition", roleId: "1483231567844479196" },
  { name: "Impact", roleId: "1483231621170594027" },
  { name: "Catalyst", roleId: "1483231647460622466" },
  { name: "Crest", roleId: "1483231684538400949" },
  { name: "Valor", roleId: "1483231710018670765" },
  { name: "Phantom", roleId: "1483231735834480822" }
];

function parseTeamRolesEnv(): TeamRoleOption[] | null {
  const raw = process.env.DISCORD_TEAM_ROLE_OPTIONS?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Array<{ name?: string; roleId?: string }>;
    const options = parsed
      .map((x) => ({ name: (x.name || "").trim(), roleId: (x.roleId || "").trim() }))
      .filter((x) => x.name && x.roleId);
    return options.length > 0 ? options : null;
  } catch {
    return null;
  }
}

async function requireAdmin() {
  const session = await getServerSession();
  if (!session || !isAdminRole(session.appRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json({ items: parseTeamRolesEnv() || defaultTeamRoles });
}
