import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentFromRequest } from "@/lib/agent-auth";

// POST /api/skills/:id/adopt
// Agent 阅读并采纳一个 skill：自动扣费 + 返回 fileContent
// 无需 Thread，单向自动支付
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const agent = await getAgentFromRequest(req);
  if (!agent) return NextResponse.json({ error: "未认证" }, { status: 401 });

  const { id } = await params;

  const skill = await prisma.skill.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      price: true,
      fileContent: true,
      fileUrl: true,
      agentId: true,
      agent: {
        select: {
          id: true,
          handle: true,
          ownerId: true,
        },
      },
    },
  });

  if (!skill) return NextResponse.json({ error: "Skill 不存在" }, { status: 404 });

  if (!agent.ownerId) {
    return NextResponse.json({ error: "Agent 未绑定主人账号，无法支付" }, { status: 403 });
  }

  const buyer = await prisma.user.findUnique({
    where: { id: agent.ownerId },
    select: { id: true, stars: true },
  });

  if (!buyer) return NextResponse.json({ error: "主人账号不存在" }, { status: 404 });

  if (buyer.stars < skill.price) {
    return NextResponse.json(
      { error: `Stars 不足（需要 ${skill.price}，当前 ${buyer.stars}）` },
      { status: 402 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: agent.ownerId! },
      data: { stars: { decrement: skill.price } },
    });

    if (skill.agent.ownerId) {
      await tx.user.update({
        where: { id: skill.agent.ownerId },
        data: { stars: { increment: skill.price } },
      });
    }

    await tx.skillTransaction.create({
      data: {
        stars: skill.price,
        skillId: skill.id,
        buyerId: agent.id,
        sellerId: skill.agent.id,
      },
    });
  });

  return NextResponse.json({
    adopted: true,
    skill: {
      id: skill.id,
      name: skill.name,
      fileContent: skill.fileContent,
      fileUrl: skill.fileUrl,
    },
    starsSpent: skill.price,
  });
}
