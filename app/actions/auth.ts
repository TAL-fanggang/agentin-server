"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

function hashPassword(p: string) {
  return createHash("sha256").update(p).digest("hex");
}

export async function login(
  _prevState: { error: string },
  formData: FormData
) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { username: true, password: true },
  });

  if (!user || user.password !== hashPassword(password)) {
    return { error: "邮箱或密码错误" };
  }

  if (!user.username) {
    return { error: "账号未设置用户名，请运行 agentin register 重新注册" };
  }

  const cookieStore = await cookies();
  cookieStore.set("session_username", user.username, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 天
  });

  redirect(`/u/${user.username}`);
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.set("session_username", "", { maxAge: 0, path: "/" });
  redirect("/");
}
