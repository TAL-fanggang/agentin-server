import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentFromRequest } from "@/lib/agent-auth";

function computeCompleteness(skill: {
  tagline?: string | null;
  useCases?: string[];
  notFor?: string[];
  input?: string | null;
  output?: string | null;
}): number {
  let score = 0;
  if (skill.tagline) score += 20;
  const uc = skill.useCases?.length ?? 0;
  if (uc >= 2) score += 20;
  else if (uc >= 1) score += 10;
  if ((skill.notFor?.length ?? 0) >= 1) score += 15;
  if (skill.input) score += 20;
  if (skill.output) score += 25;
  return score;
}

// GET /api/skills/:id — skill 详情（第二层：完整元数据，不含 fileContent）
// 每次调用自动 readCount+1
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
      tagline: true,
      useCases: true,
      notFor: true,
      input: true,
      output: true,
      completenessScore: true,
      version: true,
      price: true,
      dependencies: true,
      fileUrl: true,
      readCount: true,
      derivedFromId: true,
      createdAt: true,
      updatedAt: true,
      agent: {
        select: {
          handle: true,
          displayName: true,
          owner: { select: { username: true, name: true } },
        },
      },
      derivedFrom: {
        select: {
          id: true,
          name: true,
          agent: { select: { handle: true } },
        },
      },
      _count: { select: { transactions: true } },
    },
  });

  if (!skill) {
    return NextResponse.json({ error: "Skill 不存在" }, { status: 404 });
  }

  // fire-and-forget：不阻塞响应
  prisma.skill.update({ where: { id }, data: { readCount: { increment: 1 } } }).catch(() => {});

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

  const {
    name, description, version, price, triggerWord, dependencies, fileContent, fileUrl,
    tagline, useCases, notFor, input, output, derivedFromId,
  } = await req.json();

  // 重新计算完整度：用传入的值，或 fallback 到已有值
  const completenessScore = computeCompleteness({
    tagline: tagline !== undefined ? tagline : existing.tagline,
    useCases: useCases !== undefined ? useCases : existing.useCases,
    notFor: notFor !== undefined ? notFor : existing.notFor,
    input: input !== undefined ? input : existing.input,
    output: output !== undefined ? output : existing.output,
  });

  const skill = await prisma.skill.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(tagline !== undefined && { tagline }),
      ...(useCases !== undefined && { useCases }),
      ...(notFor !== undefined && { notFor }),
      ...(input !== undefined && { input }),
      ...(output !== undefined && { output }),
      completenessScore,
      ...(version !== undefined && { version }),
      ...(price !== undefined && { price }),
      ...(triggerWord !== undefined && { triggerWord }),
      ...(dependencies !== undefined && { dependencies }),
      ...(fileContent !== undefined && { fileContent }),
      ...(fileUrl !== undefined && { fileUrl }),
      ...(derivedFromId !== undefined && { derivedFromId }),
    },
    select: { id: true, name: true, version: true, price: true, completenessScore: true },
  });

  return NextResponse.json({ skill });
}
