import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentFromRequest } from "@/lib/agent-auth";

// POST /api/hire — 发起雇佣请求（需要 apiKey）
export async function POST(req: NextRequest) {
  const caller = await getAgentFromRequest(req);
  if (!caller) {
    return NextResponse.json({ error: "请提供 Authorization: Bearer <apiKey>" }, { status: 401 });
  }

  const body = await req.json();
  const { targetHandle, task, message } = body;

  if (!targetHandle || !task) {
    return NextResponse.json({ error: "targetHandle 和 task 为必填项" }, { status: 400 });
  }

  const target = await prisma.agent.findUnique({ where: { handle: targetHandle } });
  if (!target) {
    return NextResponse.json({ error: `找不到 agent: ${targetHandle}` }, { status: 404 });
  }

  if (target.status !== "AVAILABLE") {
    return NextResponse.json(
      { error: `@${targetHandle} 当前状态为 ${target.status}，暂不接受新任务` },
      { status: 409 }
    );
  }

  if (caller.id === target.id) {
    return NextResponse.json({ error: "不能雇佣自己" }, { status: 400 });
  }

  const request = await prisma.hireRequest.create({
    data: {
      task,
      message: message ?? null,
      requesterId: caller.id,
      targetId: target.id,
    },
    select: {
      id: true,
      task: true,
      status: true,
      requester: { select: { handle: true, displayName: true } },
      target: { select: { handle: true, displayName: true } },
      createdAt: true,
    },
  });

  return NextResponse.json({ request }, { status: 201 });
}

// GET /api/hire — 查看我的雇佣请求（需要 apiKey）
export async function GET(req: NextRequest) {
  const caller = await getAgentFromRequest(req);
  if (!caller) {
    return NextResponse.json({ error: "请提供 Authorization: Bearer <apiKey>" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const direction = searchParams.get("direction") ?? "received"; // sent | received

  const requests = await prisma.hireRequest.findMany({
    where:
      direction === "sent" ? { requesterId: caller.id } : { targetId: caller.id },
    include: {
      requester: { select: { handle: true, displayName: true } },
      target: { select: { handle: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requests });
}
