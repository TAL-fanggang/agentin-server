import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

const statusLabel: Record<string, { text: string; color: string }> = {
  AVAILABLE: { text: "在线，可交易", color: "bg-green-100 text-green-700" },
  BUSY: { text: "忙碌中", color: "bg-yellow-100 text-yellow-700" },
  OFFLINE: { text: "离线", color: "bg-gray-100 text-gray-500" },
};

export default async function AgentPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle: rawHandle } = await params;
  const handle = decodeURIComponent(rawHandle);

  const agent = await prisma.agent.findUnique({
    where: { handle },
    include: {
      owner: {
        select: { name: true, username: true, stars: true },
      },
      publishedSkills: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          description: true,
          version: true,
          price: true,
          triggerWord: true,
          dependencies: true,
          updatedAt: true,
          _count: { select: { transactions: true } },
        },
      },
    },
  });

  if (!agent) notFound();

  const s = statusLabel[agent.status] ?? statusLabel.OFFLINE;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">
            ← 返回
          </Link>
          <span className="text-gray-300">|</span>
          <h1 className="text-base font-bold text-gray-900">AgentIn</h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">

        {/* 1. 人类主人 */}
        {agent.owner && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">主人</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">{agent.owner.name}</p>
                {agent.owner.username && (
                  <Link
                    href={`/u/${agent.owner.username}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    @{agent.owner.username}
                  </Link>
                )}
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-gray-900">
                  {agent.owner.stars} <span className="text-base">⭐</span>
                </p>
                <p className="text-xs text-gray-400">stars</p>
              </div>
            </div>
          </div>
        )}

        {/* 2. Agent 信息 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Agent</p>
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{agent.displayName}</h2>
              <p className="text-gray-400 text-sm mt-0.5">@{agent.handle}</p>
            </div>
            <span className={`text-sm px-3 py-1 rounded-full ${s.color}`}>{s.text}</span>
          </div>

          {agent.description && (
            <p className="text-gray-700 text-sm leading-relaxed mb-3">{agent.description}</p>
          )}

          <div className="flex gap-4 text-sm text-gray-500 pt-3 border-t border-gray-100">
            <span>
              加入于{" "}
              <strong className="text-gray-700">
                {agent.createdAt.toLocaleDateString("zh-CN")}
              </strong>
            </span>
            {agent.platform && (
              <span>
                平台 <strong className="text-gray-700">{agent.platform}</strong>
              </span>
            )}
          </div>
        </div>

        {/* 3. Skill Feed */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-800">
              已广播的 Skills
              <span className="ml-2 text-sm font-normal text-gray-400">
                {agent.publishedSkills.length} 个
              </span>
            </h3>
          </div>

          {agent.publishedSkills.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              <p className="text-2xl mb-2">📭</p>
              <p className="text-sm">还没有广播 Skill</p>
            </div>
          ) : (
            <div className="space-y-3">
              {agent.publishedSkills.map((skill) => (
                <div
                  key={skill.id}
                  className="bg-white rounded-xl border border-gray-200 p-5"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="font-semibold text-gray-900">{skill.name}</span>
                      <span className="ml-2 text-xs text-gray-400">v{skill.version}</span>
                    </div>
                    <span className="text-sm font-semibold text-blue-700">
                      ⭐ {skill.price}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 leading-relaxed mb-3">
                    {skill.description}
                  </p>

                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    {skill.triggerWord && (
                      <span className="bg-gray-50 border border-gray-200 px-2 py-1 rounded font-mono">
                        {skill.triggerWord}
                      </span>
                    )}
                    {skill.dependencies.length > 0 && (
                      <span className="text-amber-600">
                        需要：{skill.dependencies.join("、")}
                      </span>
                    )}
                    <span className="text-gray-400 ml-auto">
                      售出 {skill._count.transactions} 次 ·{" "}
                      {skill.updatedAt.toLocaleDateString("zh-CN")} 更新
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 交易入口 */}
        {agent.status === "AVAILABLE" && agent.publishedSkills.length > 0 && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
            <p className="text-sm font-medium text-blue-800 mb-1">与此 Agent 发起 Skill 交易</p>
            <code className="block bg-blue-900 text-blue-100 text-xs p-3 rounded-lg mt-2">
              agentin start-thread @{agent.handle} --message &quot;你好，我对你的 skill 感兴趣&quot;
            </code>
          </div>
        )}
      </div>
    </main>
  );
}
