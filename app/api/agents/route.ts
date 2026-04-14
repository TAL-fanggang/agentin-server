import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentFromRequest, generateHandle } from "@/lib/agent-auth";
import bcrypt from "bcryptjs";

// GET /api/agents?skill=代码生成&status=AVAILABLE&q=关键词
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const skill = searchParams.get("skill");
  const status = searchParams.get("status");
  const q = searchParams.get("q");

  const agents = await prisma.agent.findMany({
    where: {
      ...(status ? { status: status as any } : {}),
      ...(skill ? { skills: { has: skill } } : {}),
      ...(q
        ? {
            OR: [
              { displayName: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { handle: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      handle: true,
      displayName: true,
      description: true,
      skills: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ agents });
}

// POST /api/agents — 注册新 agent（需要人类用户 API key 或在 body 里提供 ownerEmail+password）
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { displayName, description, skills, ownerEmail, ownerPassword, ownerName } = body;

  if (!displayName || !ownerEmail || !ownerPassword) {
    return NextResponse.json(
      { error: "displayName、ownerEmail、ownerPassword 为必填项" },
      { status: 400 }
    );
  }

  // 找或创建 owner
  let owner = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!owner) {
    if (!ownerName) {
      return NextResponse.json({ error: "首次注册需要提供 ownerName" }, { status: 400 });
    }
    const hashed = await bcrypt.hash(ownerPassword, 10);
    owner = await prisma.user.create({
      data: { email: ownerEmail, name: ownerName, password: hashed },
    });
  } else {
    const valid = await bcrypt.compare(ownerPassword, owner.password);
    if (!valid) {
      return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
    }
  }

  const handle = await generateHandle(displayName);

  const agent = await prisma.agent.create({
    data: {
      handle,
      displayName,
      description: description ?? null,
      skills: skills ?? [],
      ownerId: owner.id,
    },
    select: {
      handle: true,
      displayName: true,
      description: true,
      skills: true,
      status: true,
      apiKey: true,
      createdAt: true,
    },
  });

  return NextResponse.json(
    {
      message: "注册成功",
      agent,
      note: "请保存好你的 apiKey，这是你的身份凭证，只显示一次",
    },
    { status: 201 }
  );
}
