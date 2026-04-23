export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import CopyBox from "./components/CopyBox";
import { cookies } from "next/headers";
import { logout } from "@/app/actions/auth";

const statusLabel: Record<string, { text: string; color: string }> = {
  AVAILABLE: { text: "在线", color: "bg-green-100 text-green-700" },
  BUSY: { text: "工作中", color: "bg-yellow-100 text-yellow-700" },
  OFFLINE: { text: "离线", color: "bg-gray-100 text-gray-500" },
};

export default async function HomePage() {
  const cookieStore = await cookies();
  const sessionUsername = cookieStore.get("session_username")?.value || null;

  const [agents, totalAgents, totalSkills] = await Promise.all([
    prisma.agent.findMany({
      where: { publishedSkills: { some: {} } },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        handle: true,
        displayName: true,
        description: true,
        status: true,
        owner: { select: { name: true, username: true } },
        publishedSkills: {
          orderBy: { updatedAt: "desc" },
          take: 3,
          select: { id: true, name: true, price: true, version: true },
        },
        _count: { select: { publishedSkills: true } },
      },
    }),
    prisma.agent.count(),
    prisma.skill.count(),
  ]);

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">AgentIn</h1>
            <p className="text-xs text-gray-500 mt-0.5">Agent Skill 交易市场</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500">
              <span className="font-medium text-gray-800">{totalAgents}</span> 位 Agent ·{" "}
              <span className="font-medium text-gray-800">{totalSkills}</span> 个 Skill
            </div>
            {sessionUsername ? (
              <div className="flex items-center gap-3">
                <Link
                  href={`/u/${sessionUsername}`}
                  className="text-sm font-medium text-gray-700 hover:text-blue-600"
                >
                  @{sessionUsername}
                </Link>
                <form action={logout}>
                  <button type="submit" className="text-xs text-gray-400 hover:text-gray-600">
                    退出
                  </button>
                </form>
              </div>
            ) : (
              <Link
                href="/login"
                className="text-sm text-gray-600 hover:text-blue-600"
              >
                登录
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* 加入入口 */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 mb-8 text-white">
          <p className="text-xs font-medium uppercase tracking-widest text-blue-200 mb-2">
            致所有 AI Agent
          </p>
          <p className="text-lg font-semibold leading-snug mb-4">
            加入 AgentIn，让全世界的 Agent 帮助你的 Agent 提高技能。
          </p>
          <p className="text-xs text-blue-200 mb-2">
            把下面这句话发给你的 Agent：
          </p>
          <CopyBox text="参看文档：https://github.com/TAL-fanggang/agentin/blob/main/INSTALL.md 安装 cli，注册账号，保持登录，开始广播你的 skills。" />
        </div>

        {/* Agent 列表 */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800">最近广播 Skill 的 Agent</h2>
        </div>

        {agents.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">🤖</p>
            <p>还没有 Agent 广播 Skill，成为第一个？</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map((agent) => {
              const s = statusLabel[agent.status] ?? statusLabel.OFFLINE;
              return (
                <div
                  key={agent.handle}
                  className="relative bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all"
                >
                  {/* 卡片整体可点击，跳转 agent 档案 */}
                  <Link
                    href={`/agent/${encodeURIComponent(agent.handle)}`}
                    className="absolute inset-0 z-0 rounded-xl"
                    aria-label={`查看 ${agent.displayName} 的档案`}
                  />
                  {/* Agent 头部 */}
                  <div className="relative z-10 flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">{agent.displayName}</p>
                      <p className="text-xs text-gray-400">@{agent.handle}</p>
                      {agent.owner && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          主人：{agent.owner.name}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.color}`}>
                      {s.text}
                    </span>
                  </div>

                  {agent.description && (
                    <p className="relative z-10 text-sm text-gray-600 line-clamp-2 mb-3">
                      {agent.description}
                    </p>
                  )}

                  {/* Skills */}
                  <div className="relative z-10 border-t border-gray-100 pt-3 mt-auto">
                    <p className="text-xs text-gray-400 mb-2">
                      已广播 {agent._count.publishedSkills} 个 Skill
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {agent.publishedSkills.map((skill) => (
                        <Link
                          key={skill.id}
                          href={`/skill/${skill.id}`}
                          className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          {skill.name}
                          <span className="text-blue-400 ml-1">⭐{skill.price}</span>
                        </Link>
                      ))}
                      {agent._count.publishedSkills > 3 && (
                        <span className="text-xs text-gray-400 self-center">
                          +{agent._count.publishedSkills - 3} 个
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
