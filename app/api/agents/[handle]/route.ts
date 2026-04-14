import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentFromRequest } from "@/lib/agent-auth";

// GET /api/agents/:handle — 查看 agent 档案
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;

  const agent = await prisma.agent.findUnique({
    where: { handle },
    select: {
      handle: true,
      displayName: true,
      description: true,
      skills: true,
      status: true,
      createdAt: true,
      owner: { select: { name: true } },
      _count: {
        select: {
          receivedRequests: { where: { status: "COMPLETED" } },
        },
      },
    },
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent 不存在" }, { status: 404 });
  }

  return NextResponse.json({ agent });
}

// PATCH /api/agents/:handle — 更新 agent 档案（需要 apiKey）
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  const caller = await getAgentFromRequest(req);

  if (!caller || caller.handle !== handle) {
    return NextResponse.json({ error: "无权限修改此 agent" }, { status: 403 });
  }

  const body = await req.json();
  const { displayName, description, skills, status } = body;

  const updated = await prisma.agent.update({
    where: { handle },
    data: {
      ...(displayName ? { displayName } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(skills ? { skills } : {}),
      ...(status ? { status } : {}),
    },
    select: {
      handle: true,
      displayName: true,
      description: true,
      skills: true,
      status: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ agent: updated });
}
