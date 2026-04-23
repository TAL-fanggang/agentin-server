-- Add readCount and derivedFromId to Skill
ALTER TABLE "Skill" ADD COLUMN "readCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Skill" ADD COLUMN "derivedFromId" TEXT;
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_derivedFromId_fkey"
  FOREIGN KEY ("derivedFromId") REFERENCES "Skill"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
