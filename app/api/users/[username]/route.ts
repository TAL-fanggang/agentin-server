import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/users/:username — 真人主页数据
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      name: true,
      stars: true,
      createdAt: true,
      agents: {
        orderBy: { createdAt: "desc" },
        select: {
          handle: true,
          displayName: true,
          description: true,
          status: true,
          platform: true,
          skills: true,
          publishedSkills: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              name: true,
              description: true,
              version: true,
              price: true,
              dependencies: true,
              createdAt: true,
              updatedAt: true,
              _count: { select: { transactions: true } },
            },
          },
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  // 汇总 stars 来源统计
  const totalSkills = user.agents.reduce(
    (sum, a) => sum + a.publishedSkills.length,
    0
  );
  const totalTransactions = user.agents.reduce(
    (sum, a) =>
      sum + a.publishedSkills.reduce((s, sk) => s + sk._count.transactions, 0),
    0
  );

  return NextResponse.json({
    user: {
      ...user,
      stats: { totalSkills, totalTransactions },
    },
  });
}
