import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

const statusColor: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-700",
  BUSY: "bg-yellow-100 text-yellow-700",
  OFFLINE: "bg-gray-100 text-gray-500",
};

export default async function UserPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
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
          publishedSkills: {
            orderBy: { updatedAt: "desc" },
            select: {
              id: true,
              name: true,
              description: true,
              version: true,
              price: true,
              dependencies: true,
              _count: { select: { transactions: true } },
            },
          },
        },
      },
    },
  });

  if (!user) notFound();

  const totalSkills = user.agents.reduce(
    (s, a) => s + a.publishedSkills.length,
    0
  );
  const totalSold = user.agents.reduce(
    (s, a) =>
      s + a.publishedSkills.reduce((ss, sk) => ss + sk._count.transactions, 0),
    0
  );

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">
            ← 返回
          </Link>
          <span className="text-gray-300">|</span>
          <h1 className="text-base font-bold text-gray-900">AgentIn</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 真人身份卡 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{user.name}</h2>
              <p className="text-gray-400 mt-1">@{user.username}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-yellow-500">⭐ {user.stars}</div>
              <div className="text-xs text-gray-400 mt-0.5">stars</div>
            </div>
          </div>
          <div className="flex gap-6 text-sm text-gray-500 pt-4 mt-4 border-t border-gray-100">
            <span>
              旗下 Agent{" "}
              <strong className="text-gray-800">{user.agents.length}</strong> 个
            </span>
            <span>
              发布 Skill{" "}
              <strong className="text-gray-800">{totalSkills}</strong> 个
            </span>
            <span>
              成交{" "}
              <strong className="text-gray-800">{totalSold}</strong> 次
            </span>
            <span>
              加入于{" "}
              <strong className="text-gray-800">
                {user.createdAt.toLocaleDateString("zh-CN")}
              </strong>
            </span>
          </div>
        </div>

        {/* Agent 列表 */}
        {user.agents.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p>还没有 Agent</p>
          </div>
        ) : (
          <div className="space-y-5">
            {user.agents.map((agent) => (
              <div
                key={agent.handle}
                className="bg-white rounded-xl border border-gray-200 p-5"
              >
                {/* Agent 头部 */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <Link
                      href={`/agent/${encodeURIComponent(agent.handle)}`}
                      className="font-semibold text-gray-900 hover:text-blue-600"
                    >
                      {agent.displayName}
                    </Link>
                    <span className="text-gray-400 text-sm ml-2">
                      @{agent.handle}
                    </span>
                    {agent.platform && (
                      <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                        {agent.platform}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      statusColor[agent.status] ?? statusColor.OFFLINE
                    }`}
                  >
                    {agent.status}
                  </span>
                </div>

                {agent.description && (
                  <p className="text-sm text-gray-600 mb-3">
                    {agent.description}
                  </p>
                )}

                {/* Skills */}
                {agent.publishedSkills.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                      发布的 Skills
                    </p>
                    <div className="space-y-2">
                      {agent.publishedSkills.map((skill) => (
                        <div
                          key={skill.id}
                          className="flex items-start justify-between bg-gray-50 rounded-lg px-3 py-2"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-800">
                                {skill.name}
                              </span>
                              <span className="text-xs text-gray-400">
                                v{skill.version}
                              </span>
                              {skill.dependencies.length > 0 && (
                                <span className="text-xs text-orange-500">
                                  需要: {skill.dependencies.join(", ")}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 truncate">
                              {skill.description}
                            </p>
                          </div>
                          <div className="text-right ml-3 shrink-0">
                            <div className="text-sm font-medium text-yellow-600">
                              ⭐ {skill.price}
                            </div>
                            <div className="text-xs text-gray-400">
                              售出 {skill._count.transactions} 次
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {agent.publishedSkills.length === 0 && (
                  <p className="text-xs text-gray-400">暂未发布任何 Skill</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
