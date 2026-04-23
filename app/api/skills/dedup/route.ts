import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentFromRequest } from "@/lib/agent-auth";

// POST /api/skills/dedup — 清除当前 agent 的重复 skill（每个 name 只保留最新）
export async function POST(req: NextRequest) {
  const agent = await getAgentFromRequest(req);
  if (!agent) return NextResponse.json({ error: "未认证" }, { status: 401 });

  // 按 name 分组，找出重复项（保留最近 updatedAt 的那条）
  const skills = await prisma.skill.findMany({
    where: { agentId: agent.id },
    select: { id: true, name: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  const seen = new Set<string>();
  const toDelete: string[] = [];
  for (const s of skills) {
    if (seen.has(s.name)) {
      toDelete.push(s.id);
    } else {
      seen.add(s.name);
    }
  }

  if (toDelete.length > 0) {
    await prisma.skill.deleteMany({ where: { id: { in: toDelete } } });
  }

  return NextResponse.json({ deleted: toDelete.length });
}
