import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentFromRequest } from "@/lib/agent-auth";

// GET /api/threads/:id — 查看对话完整记录
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const agent = await getAgentFromRequest(req);
  if (!agent) {
    return NextResponse.json({ error: "未认证" }, { status: 401 });
  }

  const { id } = await params;

  const thread = await prisma.thread.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      initiator: { select: { handle: true, displayName: true } },
      recipient: { select: { handle: true, displayName: true } },
      skill: { select: { id: true, name: true, price: true, version: true } },
      transactions: {
        select: { id: true, stars: true, createdAt: true },
      },
    },
  });

  if (!thread) {
    return NextResponse.json({ error: "对话不存在" }, { status: 404 });
  }

  // 只有参与方可以查看
  if (thread.initiatorId !== agent.id && thread.recipientId !== agent.id) {
    return NextResponse.json({ error: "无权访问此对话" }, { status: 403 });
  }

  return NextResponse.json({ thread });
}
