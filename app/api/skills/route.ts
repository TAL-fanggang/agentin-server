import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentFromRequest } from "@/lib/agent-auth";

// 完整度评分：满分 100，字段越完整排名越靠前
export function computeCompleteness(skill: {
  tagline?: string | null;
  useCases?: string[];
  notFor?: string[];
  input?: string | null;
  output?: string | null;
}): number {
  let score = 0;
  if (skill.tagline) score += 20;
  const uc = skill.useCases?.length ?? 0;
  if (uc >= 2) score += 20;
  else if (uc >= 1) score += 10;
  if ((skill.notFor?.length ?? 0) >= 1) score += 15;
  if (skill.input) score += 20;
  if (skill.output) score += 25;
  return score;
}

// 多个候选词，任意一个命中即可（OR）
// 搜索范围：name、tagline、semanticSummary（客户端生成的双语语义摘要）、fileContent（全文兜底）
function buildSearchCondition(terms: string[]) {
  if (terms.length === 0) return {};
  const perTerm = terms.map((term) => ({
    OR: [
      { name: { contains: term, mode: "insensitive" as const } },
      { tagline: { contains: term, mode: "insensitive" as const } },
      { semanticSummary: { contains: term, mode: "insensitive" as const } },
      { fileContent: { contains: term, mode: "insensitive" as const } },
    ],
  }));
  return { OR: perTerm };
}

// GET /api/skills?q=&terms=&agentHandle=&minPrice=&maxPrice=&mine=true
// terms：CLI 在客户端用自己的 LLM 扩展后的中英双语词，逗号分隔，OR 逻辑
// q：无 LLM 时的原始查询词，单词字符串匹配兜底
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const termsParam = searchParams.get("terms");
  const agentHandle = searchParams.get("agentHandle");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  const mine = searchParams.get("mine") === "true";

  // mine=true：只返回已认证 agent 自己的 skill（供 skill sync 构建 publishedMap）
  let myAgentId: string | undefined;
  if (mine) {
    const agent = await getAgentFromRequest(req);
    if (!agent) return NextResponse.json({ error: "未认证" }, { status: 401 });
    myAgentId = agent.id;
  }

  // 市场搜索时尝试识别调用方，用于排除自己发布的 skill
  let callerAgentId: string | undefined;
  if (!mine) {
    try {
      const agent = await getAgentFromRequest(req);
      if (agent) callerAgentId = agent.id;
    } catch { /* 匿名请求，忽略 */ }
  }

  // 优先用客户端扩展好的 terms，无则退回 q 单词匹配
  const searchTerms = termsParam
    ? termsParam.split(",").map((t) => t.trim()).filter(Boolean)
    : q ? [q] : [];

  const skills = await prisma.skill.findMany({
    where: {
      ...(myAgentId && { agentId: myAgentId }),
      ...(!myAgentId && callerAgentId && { agentId: { not: callerAgentId } }),
      ...(searchTerms.length > 0 && buildSearchCondition(searchTerms)),
      ...(!myAgentId && agentHandle && { agent: { handle: agentHandle } }),
      ...(minPrice && { price: { gte: parseInt(minPrice) } }),
      ...(maxPrice && { price: { lte: parseInt(maxPrice) } }),
    },
    orderBy: [
      { completenessScore: "desc" },
      { createdAt: "desc" },
    ],
    take: myAgentId ? 1000 : 50,
    select: {
      id: true,
      name: true,
      tagline: true,
      useCases: true,
      notFor: true,
      completenessScore: true,
      price: true,
      readCount: true,
      createdAt: true,
      agent: { select: { handle: true, displayName: true } },
      _count: { select: { transactions: true } },
    },
  });

  return NextResponse.json({ skills });
}

// POST /api/skills — 发布新 skill，需要 agent apiKey
// semanticSummary 由客户端（CLI）用自己的 LLM 生成后随 skill 数据一起上传
export async function POST(req: NextRequest) {
  const agent = await getAgentFromRequest(req);
  if (!agent) {
    return NextResponse.json({ error: "未认证" }, { status: 401 });
  }

  try {
    const {
      name, description, version, price, triggerWord, dependencies,
      fileContent, fileUrl, derivedFromId, semanticSummary,
      tagline, useCases, notFor, input, output,
    } = await req.json();

    if (!name || !description) {
      return NextResponse.json(
        { error: "name 和 description 为必填项" },
        { status: 400 }
      );
    }

    const completenessScore = computeCompleteness({ tagline, useCases, notFor, input, output });

    const skillData = {
      name,
      description,
      tagline: tagline ?? null,
      useCases: useCases ?? [],
      notFor: notFor ?? [],
      input: input ?? null,
      output: output ?? null,
      completenessScore,
      version: version ?? "1.0.0",
      price: price ?? 10,
      triggerWord: triggerWord ?? null,
      dependencies: dependencies ?? [],
      fileContent: fileContent ?? null,
      fileUrl: fileUrl ?? null,
      semanticSummary: semanticSummary ?? null,
      derivedFromId: derivedFromId ?? null,
    };

    const skillSelect = {
      id: true, name: true, tagline: true,
      useCases: true, notFor: true, completenessScore: true,
      price: true, readCount: true, createdAt: true,
      derivedFromId: true,
      agent: { select: { handle: true, displayName: true } },
    };

    const existing = await prisma.skill.findFirst({
      where: { agentId: agent.id, name },
      select: { id: true },
    });

    let result;
    if (existing) {
      result = await prisma.skill.update({
        where: { id: existing.id },
        data: skillData,
        select: skillSelect,
      });
      return NextResponse.json({ skill: result });
    } else {
      result = await prisma.$transaction(async (tx) => {
        const skill = await tx.skill.create({
          data: { ...skillData, agentId: agent.id },
          select: skillSelect,
        });
        if (agent.ownerId) {
          await tx.user.update({
            where: { id: agent.ownerId },
            data: { stars: { increment: 1 } },
          });
        }
        return skill;
      });
      return NextResponse.json({ skill: result }, { status: 201 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
