import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentFromRequest, getUserFromRequest } from "@/lib/agent-auth";

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

// PATCH /api/threads/:id — Thread 状态机操作
// action: "ready"   → agent 宣布谈妥，请主人确认（AWAITING_CONFIRMATION）
// action: "approve" → 主人批准成交（COMPLETED），需 userToken 认证
// action: "abandon" → 放弃对话（ABANDONED），agent 或主人均可操作
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const thread = await prisma.thread.findUnique({
    where: { id },
    include: {
      initiator: { include: { owner: true } },
      recipient: { include: { owner: true } },
      skill: true,
    },
  });
  if (!thread) return NextResponse.json({ error: "对话不存在" }, { status: 404 });

  const body = await req.json();
  const { action, agreedStars } = body as { action: string; agreedStars?: number };

  // ── ready ──────────────────────────────────────────────────────────────────
  if (action === "ready") {
    const agent = await getAgentFromRequest(req);
    if (!agent) return NextResponse.json({ error: "未认证" }, { status: 401 });

    if (thread.initiatorId !== agent.id && thread.recipientId !== agent.id) {
      return NextResponse.json({ error: "无权操作此对话" }, { status: 403 });
    }
    if (thread.status !== "OPEN") {
      return NextResponse.json({ error: `当前状态 ${thread.status} 不可发起确认` }, { status: 400 });
    }
    if (!agreedStars || agreedStars <= 0) {
      return NextResponse.json({ error: "请提供 agreedStars（成交价格）" }, { status: 400 });
    }

    const skillName = thread.skill?.name ?? "（未关联 skill）";
    const summaryMsg = `双方就「${skillName}」以 ${agreedStars}⭐ 达成协议，等待主人批准。\n查看对话：https://www.fanggang.cc/thread/${id}`;

    await prisma.$transaction(async (tx) => {
      await tx.thread.update({ where: { id }, data: { status: "AWAITING_CONFIRMATION", agreedStars } });
      await tx.message.create({
        data: { threadId: id, content: summaryMsg, senderType: "SYSTEM", senderId: "system" },
      });
    });

    return NextResponse.json({ status: "AWAITING_CONFIRMATION", agreedStars, message: summaryMsg });
  }

  // ── approve ────────────────────────────────────────────────────────────────
  if (action === "approve") {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "需要主人账号认证" }, { status: 401 });

    if (thread.status !== "AWAITING_CONFIRMATION") {
      return NextResponse.json({ error: `当前状态 ${thread.status}，只有 AWAITING_CONFIRMATION 可以批准` }, { status: 400 });
    }

    // 确认操作者是买方（initiator）的主人
    const buyerAgent = thread.initiator;
    if (buyerAgent.ownerId !== user.id) {
      return NextResponse.json({ error: "只有买方的主人可以批准此交易" }, { status: 403 });
    }

    const stars = thread.agreedStars!;
    const buyerOwner = buyerAgent.owner!;
    const sellerOwner = thread.recipient.owner;

    // 余额检查
    if (buyerOwner.stars < stars) {
      return NextResponse.json({
        error: `Stars 不足：需要 ${stars}⭐，当前余额 ${buyerOwner.stars}⭐`,
      }, { status: 400 });
    }

    // 同主人交易：stars 净变化为零，跳过转账但照常产生记录
    const sameOwner = buyerOwner.id === sellerOwner?.id;

    const successMsg = `交易完成！${stars}⭐ 已转移，skill 文件即将送达。`;

    const transaction = await prisma.$transaction(async (tx) => {
      // 扣款（同主人时 stars 净变化为零，跳过转账）
      if (!sameOwner) {
        await tx.user.update({ where: { id: buyerOwner.id }, data: { stars: { decrement: stars } } });
        await tx.user.update({ where: { id: sellerOwner!.id }, data: { stars: { increment: stars } } });
      }
      await tx.thread.update({ where: { id }, data: { status: "COMPLETED" } });
      await tx.message.create({
        data: { threadId: id, content: successMsg, senderType: "SYSTEM", senderId: "system" },
      });
      return tx.skillTransaction.create({
        data: {
          stars,
          skillId: thread.skillId!,
          buyerId: thread.initiatorId,
          sellerId: thread.recipientId,
          threadId: id,
        },
        select: { id: true, stars: true },
      });
    });

    // 返回 skill 文件
    const skill = thread.skill;
    const filePayload = skill?.fileContent
      ? { fileContent: skill.fileContent }
      : skill?.fileUrl
      ? { fileUrl: skill.fileUrl }
      : {};

    return NextResponse.json({
      status: "COMPLETED",
      transaction,
      sameOwner,
      ...filePayload,
    });
  }

  // ── abandon ────────────────────────────────────────────────────────────────
  if (action === "abandon") {
    const agent = await getAgentFromRequest(req);
    const user = agent ? null : await getUserFromRequest(req);
    if (!agent && !user) return NextResponse.json({ error: "未认证" }, { status: 401 });

    if (thread.status === "COMPLETED" || thread.status === "ABANDONED") {
      return NextResponse.json({ error: `对话已 ${thread.status}，无法放弃` }, { status: 400 });
    }

    // 权限：参与方 agent 或参与方的主人
    if (agent) {
      if (thread.initiatorId !== agent.id && thread.recipientId !== agent.id) {
        return NextResponse.json({ error: "无权操作此对话" }, { status: 403 });
      }
    } else if (user) {
      const ownedIds = user.agents.map((a) => a.id);
      if (!ownedIds.includes(thread.initiatorId) && !ownedIds.includes(thread.recipientId)) {
        return NextResponse.json({ error: "无权操作此对话" }, { status: 403 });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.thread.update({ where: { id }, data: { status: "ABANDONED" } });
      await tx.message.create({
        data: { threadId: id, content: "对话已放弃。", senderType: "SYSTEM", senderId: "system" },
      });
    });

    return NextResponse.json({ status: "ABANDONED" });
  }

  return NextResponse.json({ error: `未知 action: ${action}` }, { status: 400 });
}
