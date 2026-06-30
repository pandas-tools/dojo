-- Drop the per-lesson rating table. Pre-prod cutover; no real client data.
-- Completion status already lives in `lesson_events.lesson_completed`; this
-- table only held the 1-5 rating which is moving to lesson_group_ratings.
DROP TABLE IF EXISTS "lesson_completions";--> statement-breakpoint

-- Per-(user, group) rating, 1-5 stars. PK is (user_id, group_id) so the
-- existing scoped upsert pattern (matching lesson_bookmarks / lesson_upvotes)
-- gives last-write-wins semantics. client_id is denormalised at write time
-- so per-tenant analytics rollups (per group, per group x client, per store)
-- avoid a join. updated_at tracks re-rates separately from created_at.
CREATE TABLE "lesson_group_ratings" (
	"user_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_group_ratings_user_id_group_id_pk" PRIMARY KEY("user_id","group_id"),
	CONSTRAINT "lesson_group_ratings_rating_1_to_5" CHECK ("rating" >= 1 AND "rating" <= 5)
);
--> statement-breakpoint
ALTER TABLE "lesson_group_ratings" ADD CONSTRAINT "lesson_group_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_group_ratings" ADD CONSTRAINT "lesson_group_ratings_group_id_lesson_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."lesson_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_group_ratings" ADD CONSTRAINT "lesson_group_ratings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_lesson_group_ratings_user_id" ON "lesson_group_ratings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_lesson_group_ratings_group_id" ON "lesson_group_ratings" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_lesson_group_ratings_client_group" ON "lesson_group_ratings" USING btree ("client_id","group_id");--> statement-breakpoint

-- Audit trail for rating submissions in the append-only lesson_events log.
-- The current-state row lives in lesson_group_ratings; this event captures
-- each rating submission (including re-rates) so we can graph rating activity
-- over time the same way upvotes do via lesson_upvoted / lesson_unvoted.
ALTER TYPE "lesson_event_type" ADD VALUE IF NOT EXISTS 'group_rated';
