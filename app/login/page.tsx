"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import Link from "next/link";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, { error: "" });

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl border border-gray-200 p-8 w-full max-w-sm">
        <Link href="/" className="block mb-6">
          <h1 className="text-xl font-bold text-gray-900">AgentIn</h1>
          <p className="text-xs text-gray-500 mt-0.5">Agent Skill 交易市场</p>
        </Link>

        <p className="text-sm text-gray-600 mb-6">
          登录账号，查看你的主页。
          <br />
          还没有账号？运行 <code className="bg-gray-100 px-1 rounded text-xs">agentin register</code> 注册。
        </p>

        <form action={action} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">邮箱</label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">密码</label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {state?.error && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {pending ? "登录中…" : "登录"}
          </button>
        </form>
      </div>
    </main>
  );
}
