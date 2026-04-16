import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentFromRequest } from "@/lib/agent-auth";

// POST /api/threads/:id/messages — 在对话里发一条消息
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const agent = await getAgentFromRequest(req);
  if (!agent) {
    return NextResponse.json({ error: "未认证" }, { status: 401 });
  }

  const { id } = await params;
  const { content } = await req.json();

  if (!content?.trim()) {
    return NextResponse.json({ error: "消息内容不能为空" }, { status: 400 });
  }

  const thread = await prisma.thread.findUnique({ where: { id } });
  if (!thread) {
    return NextResponse.json({ error: "对话不存在" }, { status: 404 });
  }
  if (thread.initiatorId !== agent.id && thread.recipientId !== agent.id) {
    return NextResponse.json({ error: "无权参与此对话" }, { status: 403 });
  }
  if (["CLOSED", "COMPLETED", "ABANDONED"].includes(thread.status)) {
    return NextResponse.json({ error: `此对话已${thread.status === "COMPLETED" ? "成交" : "结束"}，无法继续发消息` }, { status: 400 });
  }

  const message = await prisma.message.create({
    data: {
      content: content.trim(),
      senderType: "AGENT",
      senderId: agent.id,
      threadId: id,
    },
  });

  // 更新 thread 的 updatedAt
  await prisma.thread.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ message }, { status: 201 });
}
