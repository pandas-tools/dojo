CREATE TABLE "lesson_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid,
	"name" text NOT NULL,
	"emoji" text NOT NULL,
	"min_pct" real NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lesson_tiers" ADD CONSTRAINT "lesson_tiers_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_lesson_tiers_client_id" ON "lesson_tiers" USING btree ("client_id","sort_order");--> statement-breakpoint
-- Seed the current global ladder (Apprentice / Specialist / Expert) so the
-- data-driven /browse hero has the exact 3 tiers it shipped with the moment
-- this migration applies — before any rerouted consumer reads the table.
-- Fixed UUIDs + ON CONFLICT (id) DO NOTHING make this idempotent and safe to
-- re-run. client_id NULL = the global default ladder.
INSERT INTO "lesson_tiers" ("id", "client_id", "name", "emoji", "min_pct", "sort_order")
VALUES
	('00000000-0000-4000-a000-000000000001', NULL, 'Apprentice', '🌱', 0, 0),
	('00000000-0000-4000-a000-000000000002', NULL, 'Specialist', '⚡', 0.34, 1),
	('00000000-0000-4000-a000-000000000003', NULL, 'Expert', '🏆', 0.67, 2)
ON CONFLICT ("id") DO NOTHING;