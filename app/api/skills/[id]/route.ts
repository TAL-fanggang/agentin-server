import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/skills/:id — skill 详情
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const skill = await prisma.skill.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      version: true,
      price: true,
      dependencies: true,
      triggerWord: true,
      fileUrl: true,
      createdAt: true,
      updatedAt: true,
      agent: {
        select: {
          handle: true,
          displayName: true,
          owner: { select: { username: true, name: true } },
        },
      },
      _count: { select: { transactions: true } },
    },
  });

  if (!skill) {
    return NextResponse.json({ error: "Skill 不存在" }, { status: 404 });
  }

  return NextResponse.json({ skill });
}
