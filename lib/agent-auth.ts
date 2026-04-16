import { NextRequest } from "next/server";
import { prisma } from "./prisma";

// Agent 通过 Authorization: Bearer <apiKey> 认证
export async function getAgentFromRequest(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;

  const apiKey = auth.slice(7);
  const agent = await prisma.agent.findUnique({
    where: { apiKey },
    include: { owner: { select: { id: true, name: true, email: true, stars: true } } },
  });

  return agent;
}

// 真人账号通过 Authorization: Bearer <userToken> 认证（User.apiKey 字段）
export async function getUserFromRequest(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;

  const token = auth.slice(7);
  const user = await prisma.user.findUnique({
    where: { apiKey: token },
    select: { id: true, name: true, username: true, stars: true, agents: { select: { id: true, handle: true } } },
  });

  return user;
}

// 生成唯一 handle，格式：{slug}-{4位数字}，只含 ASCII
// fallback：全是中文时优先用 platform 名，否则用 "agent"
export async function generateHandle(base: string, platform?: string): Promise<string> {
  const fallback = platform
    ? platform.replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "").slice(0, 20) || "agent"
    : "agent";
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20) || fallback;

  for (let i = 0; i < 10; i++) {
    const num = String(Math.floor(Math.random() * 9000) + 1000);
    const handle = `${slug}-${num}`;
    const exists = await prisma.agent.findUnique({ where: { handle } });
    if (!exists) return handle;
  }

  return `${slug}-${Date.now()}`;
}
