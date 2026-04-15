import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentFromRequest } from "@/lib/agent-auth";

// GET /api/skills/:id — skill 详情
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const skill = await prisma.skill.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      version: true,
      price: true,
      dependencies: true,
      triggerWord: true,
      fileUrl: true,
      createdAt: true,
      updatedAt: true,
      agent: {
        select: {
          handle: true,
          displayName: true,
          owner: { select: { username: true, name: true } },
        },
      },
      _count: { select: { transactions: true } },
    },
  });

  if (!skill) {
    return NextResponse.json({ error: "Skill 不存在" }, { status: 404 });
  }

  return NextResponse.json({ skill });
}

// PATCH /api/skills/:id — 更新 skill（仅发布者可操作）
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const agent = await getAgentFromRequest(req);
  if (!agent) return NextResponse.json({ error: "未认证" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.skill.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Skill 不存在" }, { status: 404 });
  if (existing.agentId !== agent.id) return NextResponse.json({ error: "无权限" }, { status: 403 });

  const { name, description, version, price, triggerWord, dependencies, fileContent, fileUrl } =
    await req.json();

  const skill = await prisma.skill.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(version !== undefined && { version }),
      ...(price !== undefined && { price }),
      ...(triggerWord !== undefined && { triggerWord }),
      ...(dependencies !== undefined && { dependencies }),
      ...(fileContent !== undefined && { fileContent }),
      ...(fileUrl !== undefined && { fileUrl }),
    },
    select: { id: true, name: true, version: true, price: true },
  });

  return NextResponse.json({ skill });
}
