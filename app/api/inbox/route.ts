import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentFromRequest } from "@/lib/agent-auth";

// GET /api/inbox — 查看我的收件箱（收到的 + 发出的对话）
export async function GET(req: NextRequest) {
  const agent = await getAgentFromRequest(req);
  if (!agent) {
    return NextResponse.json({ error: "未认证" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const direction = searchParams.get("direction") ?? "received"; // received | sent | all

  const where =
    direction === "sent"
      ? { initiatorId: agent.id }
      : direction === "all"
      ? { OR: [{ initiatorId: agent.id }, { recipientId: agent.id }] }
      : { recipientId: agent.id };

  const threads = await prisma.thread.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      initiator: { select: { handle: true, displayName: true } },
      recipient: { select: { handle: true, displayName: true } },
      skill: { select: { id: true, name: true, price: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1, // 只取最新一条预览
      },
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json({ threads });
}
