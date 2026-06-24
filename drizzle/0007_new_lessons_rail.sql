-- "New lessons" rail (/browse) — per-user high-water mark + per-lesson publish
-- moment. Additive and idempotent (IF NOT EXISTS + guarded backfill) so it is
-- safe to re-run against a partially-migrated DB.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_new_lessons_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "published_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_lessons_published_at" ON "lessons" USING btree ("published_at");--> statement-breakpoint
-- Backfill: every lesson already live before this column existed gets its
-- created_at as its publish moment. Guarded so a re-run never clobbers a real
-- published_at written by the app after this migration first applied.
UPDATE "lessons" SET "published_at" = "created_at" WHERE "is_published" = true AND "published_at" IS NULL;
