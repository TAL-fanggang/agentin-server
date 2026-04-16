"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

async function getSessionUser() {
  const cookieStore = await cookies();
  const username = cookieStore.get("session_username")?.value;
  if (!username) return null;
  return prisma.user.findUnique({
    where: { username },
    select: { id: true, stars: true, agents: { select: { id: true, handle: true } } },
  });
}

export async function approveThread(formData: FormData) {
  const threadId = formData.get("threadId") as string;
  const user = await getSessionUser();
  if (!user) redirect(`/thread/${threadId}?err=请先登录`);

  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
    include: {
      initiator: { include: { owner: true } },
      recipient: { include: { owner: true } },
    },
  });
  if (!thread) redirect("/");
  if (thread.status !== "AWAITING_CONFIRMATION") redirect(`/thread/${threadId}?err=当前状态不可批准`);

  const buyerAgent = thread.initiator;
  if (buyerAgent.ownerId !== user.id) redirect(`/thread/${threadId}?err=只有买方的主人可以批准此交易`);

  const stars = thread.agreedStars!;
  const buyerOwner = buyerAgent.owner!;
  const sellerOwner = thread.recipient.owner;

  if (buyerOwner.stars < stars) {
    redirect(`/thread/${threadId}?err=Stars不足：需要${stars}⭐当前余额${buyerOwner.stars}⭐`);
  }

  const sameOwner = buyerOwner.id === sellerOwner?.id;
  const successMsg = `交易完成！${stars}⭐ 已转移，skill 文件即将送达。`;

  await prisma.$transaction(async (tx) => {
    if (!sameOwner) {
      await tx.user.update({ where: { id: buyerOwner.id }, data: { stars: { decrement: stars } } });
      await tx.user.update({ where: { id: sellerOwner!.id }, data: { stars: { increment: stars } } });
    }
    await tx.thread.update({ where: { id: threadId }, data: { status: "COMPLETED" } });
    await tx.message.create({
      data: { threadId, content: successMsg, senderType: "SYSTEM", senderId: "system" },
    });
    await tx.skillTransaction.create({
      data: {
        stars,
        skillId: thread.skillId!,
        buyerId: thread.initiatorId,
        sellerId: thread.recipientId,
        threadId,
      },
    });
  });

  redirect(`/thread/${threadId}?ok=成交`);
}

export async function abandonThread(formData: FormData) {
  const threadId = formData.get("threadId") as string;
  const user = await getSessionUser();
  if (!user) redirect(`/thread/${threadId}?err=请先登录`);

  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
    select: { id: true, status: true, initiatorId: true, recipientId: true },
  });
  if (!thread) redirect("/");
  if (["COMPLETED", "ABANDONED"].includes(thread.status)) redirect(`/thread/${threadId}?err=对话已结束`);

  const ownedIds = user.agents.map((a) => a.id);
  if (!ownedIds.includes(thread.initiatorId) && !ownedIds.includes(thread.recipientId)) {
    redirect(`/thread/${threadId}?err=无权操作此对话`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.thread.update({ where: { id: threadId }, data: { status: "ABANDONED" } });
    await tx.message.create({
      data: { threadId, content: "主人已放弃此交易。", senderType: "SYSTEM", senderId: "system" },
    });
  });

  redirect(`/thread/${threadId}`);
}
