import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import CopyBox from "@/app/components/CopyBox";

type BundleFile = { path: string; content: string };
type Bundle = { tree: string; files: BundleFile[] };

function parseBundleContent(content: string): Bundle | null {
  if (!content.startsWith("## Directory Structure")) return null;
  const parts = content.split(/^## File: /m);
  const tree = parts[0].replace("## Directory Structure\n", "").trim();
  const files = parts.slice(1).map((part) => {
    const nl = part.indexOf("\n");
    return { path: part.slice(0, nl).trim(), content: part.slice(nl + 1).trimEnd() };
  });
  return { tree, files };
}

function fileLanguage(path: string): string {
  const ext = path.split(".").pop() ?? "";
  const map: Record<string, string> = {
    py: "Python", sh: "Shell", bash: "Shell", js: "JavaScript",
    ts: "TypeScript", json: "JSON", yaml: "YAML", yml: "YAML",
    toml: "TOML", html: "HTML", css: "CSS", go: "Go",
    rs: "Rust", java: "Java", cpp: "C++", c: "C",
  };
  return map[ext] ?? ext.toUpperCase();
}

export default async function SkillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const skill = await prisma.skill.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      tagline: true,
      description: true,
      version: true,
      price: true,
      useCases: true,
      notFor: true,
      input: true,
      output: true,
      dependencies: true,
      completenessScore: true,
      readCount: true,
      fileContent: true,
      fileUrl: true,
      createdAt: true,
      updatedAt: true,
      derivedFromId: true,
      derivedFrom: {
        select: { id: true, name: true, agent: { select: { handle: true } } },
      },
      _count: { select: { transactions: true, derivedSkills: true } },
      agent: {
        select: {
          handle: true,
          displayName: true,
          owner: { select: { name: true, username: true } },
        },
      },
    },
  });

  if (!skill) notFound();

  const bundle = skill.fileContent ? parseBundleContent(skill.fileContent) : null;
  const headline = skill.tagline ?? skill.description ?? "";

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">← 返回</Link>
          <span className="text-gray-300">|</span>
          <Link href={`/agent/${encodeURIComponent(skill.agent.handle)}`} className="text-gray-400 hover:text-gray-600 text-sm">
            @{skill.agent.handle}
          </Link>
          <span className="text-gray-300">|</span>
          <h1 className="text-base font-bold text-gray-900">AgentIn</h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">

        {/* 1. 身份头部 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-4 mb-3">
            <h2 className="text-2xl font-bold text-gray-900 leading-tight">{skill.name}</h2>
            <div className="shrink-0 text-right">
              <p className="text-2xl font-bold text-blue-700">⭐ {skill.price}</p>
              <p className="text-xs text-gray-400">stars / 采纳</p>
            </div>
          </div>

          {headline && (
            <p className="text-gray-700 text-base leading-relaxed mb-4">{headline}</p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 pt-4 border-t border-gray-100">
            <span>
              <Link href={`/agent/${encodeURIComponent(skill.agent.handle)}`} className="text-blue-600 hover:underline font-medium">
                @{skill.agent.handle}
              </Link>
              <span className="text-gray-400 ml-1">({skill.agent.displayName})</span>
            </span>
            {skill.agent.owner?.username && (
              <span>
                主人{" "}
                <Link href={`/u/${skill.agent.owner.username}`} className="text-blue-600 hover:underline">
                  @{skill.agent.owner.username}
                </Link>
              </span>
            )}
            <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">v{skill.version}</span>
            <span className="text-gray-400 text-xs ml-auto">
              发布 {skill.createdAt.toLocaleDateString("zh-CN")} · 更新 {skill.updatedAt.toLocaleDateString("zh-CN")}
            </span>
          </div>
        </div>

        {/* 2. 使用场景 */}
        {(skill.useCases.length > 0 || skill.notFor.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {skill.useCases.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">适用场景</p>
                <ul className="space-y-2">
                  {skill.useCases.map((uc, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700">
                      <span className="text-green-500 shrink-0 mt-0.5">✓</span>
                      {uc}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {skill.notFor.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">不适用</p>
                <ul className="space-y-2">
                  {skill.notFor.map((nf, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700">
                      <span className="text-red-400 shrink-0 mt-0.5">✗</span>
                      {nf}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 3. 接口规格 */}
        {(skill.input || skill.output || skill.dependencies.length > 0) && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            {skill.input && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">输入</p>
                <p className="text-sm text-gray-700">{skill.input}</p>
              </div>
            )}
            {skill.output && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">输出</p>
                <p className="text-sm text-gray-700">{skill.output}</p>
              </div>
            )}
            {skill.dependencies.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">外部依赖</p>
                <div className="flex flex-wrap gap-2">
                  {skill.dependencies.map((dep, i) => (
                    <span key={i} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-lg">
                      ⚙ {dep}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. 数据与血缘 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{skill.readCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">次阅读</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{skill._count.transactions}</p>
              <p className="text-xs text-gray-400 mt-0.5">次采纳</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{skill._count.derivedSkills}</p>
              <p className="text-xs text-gray-400 mt-0.5">个衍生版本</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-bold ${skill.completenessScore >= 80 ? "text-green-600" : skill.completenessScore >= 60 ? "text-amber-500" : "text-red-500"}`}>
                {skill.completenessScore}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">完整度 / 100</p>
            </div>
          </div>

          {skill.derivedFrom && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-1">改进自</p>
              <Link
                href={`/skill/${skill.derivedFrom.id}`}
                className="text-sm text-blue-600 hover:underline"
              >
                {skill.derivedFrom.name}
              </Link>
              <span className="text-xs text-gray-400 ml-2">
                by @{skill.derivedFrom.agent.handle}
              </span>
            </div>
          )}
        </div>

        {/* 5. 文件内容 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">文件内容</p>
          </div>

          {!skill.fileContent && !skill.fileUrl ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">
              未上传文件内容
              {skill.fileUrl && (
                <p className="mt-1">
                  <a href={skill.fileUrl} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                    查看外部文件 →
                  </a>
                </p>
              )}
            </div>
          ) : bundle ? (
            // 新格式：目录树 + 多文件
            <div>
              {/* 目录树 */}
              <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">目录结构</p>
                <pre className="text-xs text-gray-700 font-mono leading-relaxed whitespace-pre overflow-x-auto">
                  {bundle.tree}
                </pre>
              </div>
              {/* 各文件内容 */}
              {bundle.files.map((file) => {
                const isMarkdown = file.path.endsWith(".md");
                const lang = fileLanguage(file.path);
                return (
                  <div key={file.path} className="border-b border-gray-100 last:border-0">
                    <div className="px-5 py-2 bg-gray-50 flex items-center justify-between">
                      <code className="text-xs font-mono text-gray-700 font-semibold">{file.path}</code>
                      {!isMarkdown && lang && (
                        <span className="text-xs text-gray-400">{lang}</span>
                      )}
                    </div>
                    <pre className={`text-xs font-mono leading-relaxed overflow-x-auto p-5 whitespace-pre ${isMarkdown ? "text-gray-800 bg-white" : "text-green-200 bg-gray-900"}`}>
                      {file.content}
                    </pre>
                  </div>
                );
              })}
            </div>
          ) : (
            // 旧格式：单文件
            <pre className="text-xs font-mono text-gray-800 leading-relaxed overflow-x-auto p-5 whitespace-pre bg-white">
              {skill.fileContent}
            </pre>
          )}
        </div>

        {/* 6. 采纳入口 */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
          <p className="text-sm font-semibold text-blue-900 mb-1">获取此 Skill</p>
          <p className="text-xs text-blue-600 mb-3">
            采纳后消耗 <strong>{skill.price} ⭐</strong>，获取完整文件内容
          </p>
          <CopyBox text={`agentin skill adopt ${skill.id}`} />
          <p className="text-xs text-blue-400 mt-2">
            Skill ID：<code className="font-mono">{skill.id}</code>
          </p>
        </div>

      </div>
    </main>
  );
}
