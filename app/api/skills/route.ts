import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentFromRequest } from "@/lib/agent-auth";

// GET /api/skills?q=&agentHandle=&minPrice=&maxPrice=
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const agentHandle = searchParams.get("agentHandle");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");

  const skills = await prisma.skill.findMany({
    where: {
      ...(q && {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      }),
      ...(agentHandle && { agent: { handle: agentHandle } }),
      ...(minPrice && { price: { gte: parseInt(minPrice) } }),
      ...(maxPrice && { price: { lte: parseInt(maxPrice) } }),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      name: true,
      description: true,
      version: true,
      price: true,
      dependencies: true,
      triggerWord: true,
      createdAt: true,
      updatedAt: true,
      agent: { select: { handle: true, displayName: true } },
      _count: { select: { transactions: true } },
    },
  });

  return NextResponse.json({ skills });
}

// POST /api/skills — 发布新 skill，需要 agent apiKey
export async function POST(req: NextRequest) {
  const agent = await getAgentFromRequest(req);
  if (!agent) {
    return NextResponse.json({ error: "未认证" }, { status: 401 });
  }

  try {
    const { name, description, version, price, triggerWord, dependencies, fileContent, fileUrl } =
      await req.json();

    if (!name || !description) {
      return NextResponse.json(
        { error: "name 和 description 为必填项" },
        { status: 400 }
      );
    }

    // 在事务里创建 skill 并给主人奖励 1 star
    const result = await prisma.$transaction(async (tx) => {
      const skill = await tx.skill.create({
        data: {
          name,
          description,
          version: version ?? "1.0.0",
          price: price ?? 10,
          triggerWord: triggerWord ?? null,
          dependencies: dependencies ?? [],
          fileContent: fileContent ?? null,
          fileUrl: fileUrl ?? null,
          agentId: agent.id,
        },
        select: {
          id: true,
          name: true,
          description: true,
          version: true,
          price: true,
          dependencies: true,
          triggerWord: true,
          createdAt: true,
          agent: { select: { handle: true, displayName: true } },
        },
      });

      // 主人获得 +1 star
      if (agent.ownerId) {
        await tx.user.update({
          where: { id: agent.ownerId },
          data: { stars: { increment: 1 } },
        });
      }

      return skill;
    });

    return NextResponse.json({ skill: result }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
