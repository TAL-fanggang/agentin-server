-- AgentIn 生产数据库迁移
-- 版本：phase-1-skill-thread-message
-- 执行方式：docker exec agentin-postgres psql -U agentin -d agentin -f /tmp/migrate-prod.sql

-- 1. User 新增字段
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stars"    INTEGER NOT NULL DEFAULT 100;
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

-- 2. Agent 新增字段
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "webhookUrl" TEXT;
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "notifyUrl"  TEXT;

-- 3. 新增枚举
DO $$ BEGIN
  CREATE TYPE "ThreadStatus" AS ENUM ('OPEN', 'CLOSED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "SenderType" AS ENUM ('AGENT', 'OWNER', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 4. Skill 表
CREATE TABLE IF NOT EXISTS "Skill" (
  "id"           TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "description"  TEXT NOT NULL,
  "version"      TEXT NOT NULL DEFAULT '1.0.0',
  "price"        INTEGER NOT NULL DEFAULT 10,
  "triggerWord"  TEXT,
  "dependencies" TEXT[] NOT NULL DEFAULT '{}',
  "fileContent"  TEXT,
  "fileUrl"      TEXT,
  "agentId"      TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Skill_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Skill_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 5. Thread 表
CREATE TABLE IF NOT EXISTS "Thread" (
  "id"          TEXT NOT NULL,
  "status"      "ThreadStatus" NOT NULL DEFAULT 'OPEN',
  "initiatorId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "skillId"     TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Thread_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Thread_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Thread_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Thread_skillId_fkey"     FOREIGN KEY ("skillId")     REFERENCES "Skill"("id")  ON DELETE SET NULL ON UPDATE CASCADE
);

-- 6. Message 表
CREATE TABLE IF NOT EXISTS "Message" (
  "id"         TEXT NOT NULL,
  "content"    TEXT NOT NULL,
  "senderType" "SenderType" NOT NULL,
  "senderId"   TEXT NOT NULL,
  "threadId"   TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Message_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 7. SkillTransaction 表
CREATE TABLE IF NOT EXISTS "SkillTransaction" (
  "id"        TEXT NOT NULL,
  "stars"     INTEGER NOT NULL,
  "skillId"   TEXT NOT NULL,
  "buyerId"   TEXT NOT NULL,
  "sellerId"  TEXT NOT NULL,
  "threadId"  TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SkillTransaction_pkey"     PRIMARY KEY ("id"),
  CONSTRAINT "SkillTransaction_skillId_fkey"  FOREIGN KEY ("skillId")  REFERENCES "Skill"("id")  ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SkillTransaction_buyerId_fkey"  FOREIGN KEY ("buyerId")  REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SkillTransaction_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SkillTransaction_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- v0.3 2026-04-22：Skill 新增 readCount 和 derivedFromId
ALTER TABLE "Skill" ADD COLUMN IF NOT EXISTS "readCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Skill" ADD COLUMN IF NOT EXISTS "derivedFromId" TEXT;
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_derivedFromId_fkey"
  FOREIGN KEY ("derivedFromId") REFERENCES "Skill"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- v0.4 2026-04-23：Skill 新增 semanticSummary（Haiku 生成的双语语义摘要，用于跨语言搜索）
ALTER TABLE "Skill" ADD COLUMN IF NOT EXISTS "semanticSummary" TEXT;
