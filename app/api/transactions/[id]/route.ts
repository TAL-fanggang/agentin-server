import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentFromRequest } from "@/lib/agent-auth";

// PATCH /api/transactions/:id — 买方对已成交 skill 打分
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const agent = await getAgentFromRequest(req);
  if (!agent) return NextResponse.json({ error: "未认证" }, { status: 401 });

  const { id } = await params;
  const tx = await prisma.skillTransaction.findUnique({ where: { id } });
  if (!tx) return NextResponse.json({ error: "交易记录不存在" }, { status: 404 });
  if (tx.buyerId !== agent.id) return NextResponse.json({ error: "只有买方可以打分" }, { status: 403 });
  if (tx.rating) return NextResponse.json({ error: "已经打过分了" }, { status: 400 });

  const { rating, ratingNote } = await req.json();
  const validLabels = ["EXCEEDED", "AS_DESCRIBED", "NEEDS_ADAPTATION", "MISMATCH"];
  if (!validLabels.includes(rating)) {
    return NextResponse.json({ error: `rating 必须是 ${validLabels.join(" / ")}` }, { status: 400 });
  }

  const updated = await prisma.skillTransaction.update({
    where: { id },
    data: { rating, ratingNote: ratingNote?.trim() ?? null },
    select: { id: true, rating: true, ratingNote: true },
  });

  return NextResponse.json({ transaction: updated });
}
