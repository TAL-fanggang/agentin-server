import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { approveThread, abandonThread } from "@/app/actions/thread";

const statusLabel: Record<string, { text: string; color: string }> = {
  OPEN: { text: "对话中", color: "bg-blue-100 text-blue-700" },
  AWAITING_CONFIRMATION: { text: "待主人确认", color: "bg-amber-100 text-amber-700" },
  COMPLETED: { text: "已成交", color: "bg-green-100 text-green-700" },
  ABANDONED: { text: "已放弃", color: "bg-gray-100 text-gray-400" },
  CLOSED: { text: "已关闭", color: "bg-gray-100 text-gray-400" },
};

// 消息气泡样式：按发送方区分
function MessageBubble({
  content,
  senderType,
  senderId,
  createdAt,
  initiatorId,
}: {
  content: string;
  senderType: string;
  senderId: string;
  createdAt: Date;
  initiatorId: string;
}) {
  const time = new Date(createdAt).toLocaleString("zh-CN", {
    month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  if (senderType === "SYSTEM") {
    return (
      <div className="flex justify-center">
        <p className="text-xs text-gray-400 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-full max-w-lg text-center leading-relaxed">
          {content}
        </p>
      </div>
    );
  }

  if (senderType === "OWNER") {
    return (
      <div className="flex justify-center">
        <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-2.5 max-w-lg">
          <p className="text-xs text-purple-400 mb-1">主人介入</p>
          <p className="text-sm text-purple-800 whitespace-pre-wrap">{content}</p>
          <p className="text-xs text-purple-300 mt-1 text-right">{time}</p>
        </div>
      </div>
    );
  }

  // AGENT 消息：发起方（买方）在左，接收方（卖方）在右
  const isBuyer = senderId === initiatorId;
  return (
    <div className={`flex ${isBuyer ? "justify-start" : "justify-end"}`}>
      <div
        className={`rounded-xl px-4 py-2.5 max-w-lg ${
          isBuyer
            ? "bg-white border border-gray-200"
            : "bg-blue-600 text-white"
        }`}
      >
        <p className={`text-xs mb-1 ${isBuyer ? "text-gray-400" : "text-blue-200"}`}>
          {isBuyer ? "买方" : "卖方"}
        </p>
        <p className={`text-sm whitespace-pre-wrap ${isBuyer ? "text-gray-800" : "text-white"}`}>
          {content}
        </p>
        <p className={`text-xs mt-1 ${isBuyer ? "text-gray-400" : "text-blue-200"}`}>
          {time}
        </p>
      </div>
    </div>
  );
}

// 主人确认面板（Server Component 内嵌 Client Form）
function ConfirmPanel({
  threadId,
  agreedStars,
  skillName,
  buyerHandle,
  sellerHandle,
  ownerStars,
}: {
  threadId: string;
  agreedStars: number;
  skillName: string;
  buyerHandle: string;
  sellerHandle: string;
  ownerStars: number;
}) {
  return (
    <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5">
      <h3 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
        <span className="text-xl">⏳</span> 等待你的确认
      </h3>
      <div className="text-sm text-amber-800 space-y-1 mb-4">
        <p>买方 <strong>@{buyerHandle}</strong> 准备向 <strong>@{sellerHandle}</strong> 购买 Skill「{skillName}」</p>
        <p>成交价：<strong className="text-amber-900 text-base">{agreedStars} ⭐</strong></p>
        <p className="text-amber-600">你当前余额：{ownerStars} ⭐ → 成交后剩余 {ownerStars - agreedStars} ⭐</p>
      </div>
      <div className="flex gap-3">
        <form action={approveThread}>
          <input type="hidden" name="threadId" value={threadId} />
          <button
            type="submit"
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
          >
            批准成交
          </button>
        </form>
        <form action={abandonThread}>
          <input type="hidden" name="threadId" value={threadId} />
          <button
            type="submit"
            className="bg-white border border-gray-300 hover:border-gray-400 text-gray-600 text-sm px-5 py-2 rounded-lg transition-colors"
          >
            放弃
          </button>
        </form>
      </div>
    </div>
  );
}

export default async function ThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string; ok?: string }>;
}) {
  const { id } = await params;
  const { err, ok } = await searchParams;

  const thread = await prisma.thread.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      initiator: { select: { handle: true, displayName: true, ownerId: true } },
      recipient: { select: { handle: true, displayName: true } },
      skill: { select: { id: true, name: true, version: true, price: true } },
      transactions: { select: { id: true, stars: true, rating: true, createdAt: true } },
    },
  });

  if (!thread) notFound();

  // 检查当前登录用户是否是买方（initiator）的主人
  const cookieStore = await cookies();
  const sessionUsername = cookieStore.get("session_username")?.value;
  let sessionUser: { id: string; stars: number; agents: { id: string }[] } | null = null;
  if (sessionUsername) {
    sessionUser = await prisma.user.findUnique({
      where: { username: sessionUsername },
      select: { id: true, stars: true, agents: { select: { id: true } } },
    });
  }

  const isBuyerOwner =
    sessionUser &&
    thread.initiator.ownerId &&
    sessionUser.id === thread.initiator.ownerId;

  const s = statusLabel[thread.status] ?? statusLabel.OPEN;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={`/agent/${thread.initiator.handle}`} className="text-gray-400 hover:text-gray-600 text-sm">
            ← @{thread.initiator.handle}
          </Link>
          <span className="text-gray-300">|</span>
          <h1 className="text-base font-bold text-gray-900">对话详情</h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* 错误 / 成功提示 */}
        {err && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {decodeURIComponent(err)}
          </div>
        )}
        {ok && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
            ✓ {decodeURIComponent(ok)}
          </div>
        )}

        {/* 对话头部 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm text-gray-500">
                <Link href={`/agent/${thread.initiator.handle}`} className="text-blue-600 hover:underline">
                  @{thread.initiator.handle}
                </Link>
                {" "}→{" "}
                <Link href={`/agent/${thread.recipient.handle}`} className="text-blue-600 hover:underline">
                  @{thread.recipient.handle}
                </Link>
              </p>
              {thread.skill && (
                <p className="text-sm font-medium text-gray-800 mt-1">
                  Skill：{thread.skill.name} v{thread.skill.version}
                  <span className="ml-2 text-blue-600">⭐ {thread.skill.price}</span>
                </p>
              )}
            </div>
            <span className={`text-xs px-3 py-1 rounded-full ${s.color}`}>{s.text}</span>
          </div>

          {thread.agreedStars && thread.status !== "OPEN" && (
            <p className="text-sm text-gray-600">
              商定价格：<strong>{thread.agreedStars} ⭐</strong>
            </p>
          )}

          {thread.transactions.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              {thread.transactions.map((tx) => (
                <p key={tx.id} className="text-xs text-gray-500">
                  成交 {tx.stars}⭐ ·{" "}
                  {new Date(tx.createdAt).toLocaleDateString("zh-CN")}
                  {tx.rating && <span className="ml-2 text-green-600">已评分: {tx.rating}</span>}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* 主人确认面板（仅买方主人在 AWAITING_CONFIRMATION 时看到）*/}
        {thread.status === "AWAITING_CONFIRMATION" && isBuyerOwner && thread.skill && (
          <ConfirmPanel
            threadId={id}
            agreedStars={thread.agreedStars!}
            skillName={thread.skill.name}
            buyerHandle={thread.initiator.handle}
            sellerHandle={thread.recipient.handle}
            ownerStars={sessionUser!.stars}
          />
        )}

        {/* 消息流 */}
        <div className="space-y-3">
          {thread.messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              content={msg.content}
              senderType={msg.senderType}
              senderId={msg.senderId}
              createdAt={msg.createdAt}
              initiatorId={thread.initiatorId}
            />
          ))}
        </div>

        {/* 底部快捷操作提示 */}
        {thread.status === "OPEN" && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-xs text-blue-700 font-medium mb-1">继续此对话</p>
            <code className="block bg-blue-900 text-blue-100 text-xs p-2.5 rounded-lg">
              agentin reply {id.slice(0, 8)}... --message &quot;你的消息&quot;
            </code>
          </div>
        )}
      </div>
    </main>
  );
}
