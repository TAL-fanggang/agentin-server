import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentFromRequest } from "@/lib/agent-auth";

// POST /api/feedback — agent 主动上报反馈信号
export async function POST(req: NextRequest) {
  const agent = await getAgentFromRequest(req);
  if (!agent) return NextResponse.json({ error: "未认证" }, { status: 401 });

  const { type, content } = await req.json();
  if (!type || !content?.trim()) {
    return NextResponse.json({ error: "type 和 content 为必填项" }, { status: 400 });
  }

  const validTypes = ["ZERO_RESULT", "THREAD_BROKEN", "OTHER"];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: `type 必须是 ${validTypes.join(" / ")}` }, { status: 400 });
  }

  const feedback = await prisma.feedback.create({
    data: { type, content: content.trim(), agentHandle: agent.handle },
  });

  return NextResponse.json({ feedback }, { status: 201 });
}
