CREATE TABLE "lesson_bookmarks" (
	"user_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_bookmarks_user_id_lesson_id_pk" PRIMARY KEY("user_id","lesson_id")
);
--> statement-breakpoint
CREATE TABLE "lesson_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "group_sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_bookmarks" ADD CONSTRAINT "lesson_bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_bookmarks" ADD CONSTRAINT "lesson_bookmarks_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_lesson_bookmarks_user_id" ON "lesson_bookmarks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_lesson_bookmarks_lesson_id" ON "lesson_bookmarks" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "idx_lesson_groups_sort_order" ON "lesson_groups" USING btree ("sort_order");--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_group_id_lesson_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."lesson_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_lessons_group_id" ON "lessons" USING btree ("group_id","group_sort_order");