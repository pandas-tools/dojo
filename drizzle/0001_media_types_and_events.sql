CREATE TYPE "public"."lesson_content_type" AS ENUM('video', 'image', 'carousel');--> statement-breakpoint
CREATE TYPE "public"."lesson_event_type" AS ENUM('lesson_opened', 'lesson_completed', 'lesson_engagement', 'rating_submitted');--> statement-breakpoint
CREATE TABLE "lesson_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"client_id" uuid,
	"event_type" "lesson_event_type" NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lesson_translations" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "lesson_translations" ADD COLUMN "image_alt" text;--> statement-breakpoint
ALTER TABLE "lesson_translations" ADD COLUMN "carousel_slides" jsonb;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "content_type" "lesson_content_type" DEFAULT 'video' NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_events" ADD CONSTRAINT "lesson_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_events" ADD CONSTRAINT "lesson_events_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_events" ADD CONSTRAINT "lesson_events_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_lesson_events_user_lesson_type" ON "lesson_events" USING btree ("user_id","lesson_id","event_type");--> statement-breakpoint
CREATE INDEX "idx_lesson_events_client_created" ON "lesson_events" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_lesson_events_lesson_created" ON "lesson_events" USING btree ("lesson_id","created_at");--> statement-breakpoint
-- Backfill: every existing rating row produced "completion" semantics in the
-- old model. Mirror that into the new event log so historical analytics keep
-- producing the same completion counts after the rewrite. Idempotent: skips
-- any (user, lesson) pair that already has a lesson_completed event.
INSERT INTO "lesson_events" ("user_id", "lesson_id", "client_id", "event_type", "payload", "created_at")
SELECT
  lc."user_id",
  lc."lesson_id",
  u."client_id",
  'lesson_completed'::lesson_event_type,
  jsonb_build_object('source', 'backfill', 'rating', lc."rating"),
  lc."completed_at"
FROM "lesson_completions" lc
JOIN "users" u ON u."id" = lc."user_id"
WHERE NOT EXISTS (
  SELECT 1 FROM "lesson_events" le
  WHERE le."user_id" = lc."user_id"
    AND le."lesson_id" = lc."lesson_id"
    AND le."event_type" = 'lesson_completed'
);