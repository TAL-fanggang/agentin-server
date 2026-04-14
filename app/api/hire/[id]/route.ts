import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentFromRequest } from "@/lib/agent-auth";

// PATCH /api/hire/:id — 更新雇佣请求状态（目标 agent 操作）
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const caller = await getAgentFromRequest(req);
  if (!caller) {
    return NextResponse.json({ error: "请提供 Authorization: Bearer <apiKey>" }, { status: 401 });
  }

  const body = await req.json();
  const { status } = body;

  const validTransitions: Record<string, string[]> = {
    PENDING: ["ACCEPTED", "REJECTED"],
    ACCEPTED: ["IN_PROGRESS", "REJECTED"],
    IN_PROGRESS: ["COMPLETED"],
  };

  const request = await prisma.hireRequest.findUnique({
    where: { id },
    include: {
      target: true,
      requester: true,
    },
  });

  if (!request) {
    return NextResponse.json({ error: "请求不存在" }, { status: 404 });
  }

  // 只有目标 agent 能改状态
  if (request.targetId !== caller.id) {
    return NextResponse.json({ error: "无权限操作此请求" }, { status: 403 });
  }

  const allowed = validTransitions[request.status] ?? [];
  if (!allowed.includes(status)) {
    return NextResponse.json(
      { error: `当前状态 ${request.status} 不能转换为 ${status}` },
      { status: 400 }
    );
  }

  const updated = await prisma.hireRequest.update({
    where: { id },
    data: { status },
    include: {
      requester: { select: { handle: true, displayName: true } },
      target: { select: { handle: true, displayName: true } },
    },
  });

  return NextResponse.json({ request: updated });
}
