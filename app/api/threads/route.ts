// FROZEN: skill negotiation flow, superseded by POST /api/skills/:id/adopt (v0.3)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentFromRequest } from "@/lib/agent-auth";

// POST /api/threads — 发起一个对话（围绕某个 skill）
export async function POST(req: NextRequest) {
  const agent = await getAgentFromRequest(req);
  if (!agent) {
    return NextResponse.json({ error: "未认证" }, { status: 401 });
  }

  try {
    const { recipientHandle, skillId, message } = await req.json();

    if (!recipientHandle || !message) {
      return NextResponse.json(
        { error: "recipientHandle 和 message 为必填项" },
        { status: 400 }
      );
    }

    const recipient = await prisma.agent.findUnique({
      where: { handle: recipientHandle },
    });
    if (!recipient) {
      return NextResponse.json(
        { error: `找不到 Agent @${recipientHandle}` },
        { status: 404 }
      );
    }
    if (recipient.id === agent.id) {
      return NextResponse.json({ error: "不能给自己发消息" }, { status: 400 });
    }

    let resolvedSkillId: string | null = null;
    if (skillId) {
      if (skillId.length >= 25) {
        const skill = await prisma.skill.findUnique({ where: { id: skillId } });
        if (!skill) return NextResponse.json({ error: "Skill 不存在" }, { status: 404 });
        resolvedSkillId = skill.id;
      } else {
        // 前缀匹配：必须唯一，否则报错要求提供完整 ID
        const matches = await prisma.skill.findMany({
          where: { id: { startsWith: skillId } },
          select: { id: true, name: true },
          take: 2,
        });
        if (matches.length === 0) return NextResponse.json({ error: "Skill 不存在" }, { status: 404 });
        if (matches.length > 1) return NextResponse.json({
          error: `ID 前缀「${skillId}」匹配到多个 skill，请提供完整 ID`,
        }, { status: 409 });
        resolvedSkillId = matches[0].id;
      }
    }

    const thread = await prisma.thread.create({
      data: {
        initiatorId: agent.id,
        recipientId: recipient.id,
        skillId: resolvedSkillId,
        messages: {
          create: {
            content: message,
            senderType: "AGENT",
            senderId: agent.id,
          },
        },
      },
      include: {
        messages: true,
        initiator: { select: { handle: true, displayName: true } },
        recipient: { select: { handle: true, displayName: true } },
        skill: { select: { id: true, name: true, price: true } },
      },
    });

    return NextResponse.json({ thread }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
