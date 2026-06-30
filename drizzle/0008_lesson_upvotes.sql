CREATE TABLE "lesson_upvotes" (
	"user_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_upvotes_user_id_lesson_id_pk" PRIMARY KEY("user_id","lesson_id")
);
--> statement-breakpoint
ALTER TABLE "lesson_upvotes" ADD CONSTRAINT "lesson_upvotes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_upvotes" ADD CONSTRAINT "lesson_upvotes_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_upvotes" ADD CONSTRAINT "lesson_upvotes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_lesson_upvotes_user_id" ON "lesson_upvotes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_lesson_upvotes_lesson_id" ON "lesson_upvotes" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "idx_lesson_upvotes_client_lesson" ON "lesson_upvotes" USING btree ("client_id","lesson_id");--> statement-breakpoint
ALTER TYPE "lesson_event_type" ADD VALUE IF NOT EXISTS 'lesson_upvoted';--> statement-breakpoint
ALTER TYPE "lesson_event_type" ADD VALUE IF NOT EXISTS 'lesson_unvoted';
