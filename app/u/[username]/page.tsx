import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

const statusLabel: Record<string, { text: string; color: string }> = {
  AVAILABLE: { text: "在线", color: "bg-green-100 text-green-700" },
  BUSY: { text: "工作中", color: "bg-yellow-100 text-yellow-700" },
  OFFLINE: { text: "离线", color: "bg-gray-100 text-gray-500" },
};

export default async function UserPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const [user, recentSkills, totalSkills] = await Promise.all([
    prisma.user.findUnique({
      where: { username },
      select: {
        username: true,
        name: true,
        stars: true,
        createdAt: true,
        agents: {
          orderBy: { updatedAt: "desc" },
          select: {
            handle: true,
            displayName: true,
            description: true,
            status: true,
            platform: true,
            _count: { select: { publishedSkills: true } },
          },
        },
      },
    }),
    prisma.skill.findMany({
      where: { agent: { owner: { username } } },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: {
        id: true,
        name: true,
        tagline: true,
        price: true,
        completenessScore: true,
        updatedAt: true,
        agent: { select: { handle: true, displayName: true } },
      },
    }),
    prisma.skill.count({ where: { agent: { owner: { username } } } }),
  ]);

  if (!user) notFound();

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">← 返回</Link>
          <span className="text-gray-300">|</span>
          <h1 className="text-base font-bold text-gray-900">AgentIn</h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* 身份卡 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{user.name}</h2>
              <p className="text-gray-400 mt-1 text-sm">@{user.username}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-yellow-500">⭐ {user.stars}</p>
              <p className="text-xs text-gray-400 mt-0.5">stars</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-gray-500 pt-4 border-t border-gray-100">
            <span>旗下 <strong className="text-gray-800">{user.agents.length}</strong> 个 Agent</span>
            <span>共 <strong className="text-gray-800">{totalSkills}</strong> 个 Skill</span>
            <span className="ml-auto text-xs text-gray-400">加入于 {user.createdAt.toLocaleDateString("zh-CN")}</span>
          </div>
        </div>

        {/* 旗下 Agents */}
        <div>
          <h3 className="text-base font-semibold text-gray-800 mb-3">
            旗下 Agent
            <span className="ml-2 text-sm font-normal text-gray-400">{user.agents.length} 个</span>
          </h3>

          {user.agents.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
              还没有 Agent
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {user.agents.map((agent) => {
                const s = statusLabel[agent.status] ?? statusLabel.OFFLINE;
                return (
                  <Link
                    key={agent.handle}
                    href={`/agent/${encodeURIComponent(agent.handle)}`}
                    className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all block"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">{agent.displayName}</p>
                        <p className="text-xs text-gray-400 mt-0.5">@{agent.handle}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${s.color}`}>
                        {s.text}
                      </span>
                    </div>
                    {agent.description && (
                      <p className="text-sm text-gray-600 line-clamp-2 mb-2">{agent.description}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      {agent._count.publishedSkills} 个 Skill
                      {agent.platform && <span className="ml-2 bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{agent.platform}</span>}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* 最新技能 */}
        {recentSkills.length > 0 && (
          <div>
            <h3 className="text-base font-semibold text-gray-800 mb-3">最新技能</h3>
            <div className="space-y-3">
              {recentSkills.map((skill) => (
                <Link
                  key={skill.id}
                  href={`/skill/${skill.id}`}
                  className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all"
                >
                  <div className="flex items-start justify-between mb-1">
                    <p className="font-semibold text-gray-900">{skill.name}</p>
                    <p className="text-sm font-bold text-blue-700 shrink-0 ml-3">⭐ {skill.price}</p>
                  </div>
                  {skill.tagline && (
                    <p className="text-sm text-gray-600 mb-2">{skill.tagline}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>@{skill.agent.handle}</span>
                    <span>{skill.updatedAt.toLocaleDateString("zh-CN")} 更新</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
