import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  primaryKey,
  unique,
  index,
  check,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", [
  "employee",
  "admin",
  "client_admin",
]);

export const lessonTypeEnum = pgEnum("lesson_type", [
  "training",
  "announcement",
  "update",
]);

// Media-shape of a lesson. Drives the renderer + the completion criteria:
//   video    — Mux player, completed at 90% of duration watched.
//   image    — single ImageKit-hosted image, completed at 5s of visible dwell.
//   carousel — ordered slides (ImageKit-hosted images), completed once every
//              slide has been viewed.
export const lessonContentTypeEnum = pgEnum("lesson_content_type", [
  "video",
  "image",
  "carousel",
]);

// Append-only event log for tracking employee interaction with a lesson.
// One row per discrete event. Completion status is derived from this table
// (a lesson_completed row for a user+lesson means they completed it) — the
// lesson_completions table holds RATING data only now, decoupled from
// completion.
export const lessonEventTypeEnum = pgEnum("lesson_event_type", [
  "lesson_opened",
  "lesson_completed",
  "lesson_engagement",
  "rating_submitted",
]);

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const clientAllowedDomains = pgTable(
  "client_allowed_domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
  },
  (t) => ({
    uniqClientDomain: unique().on(t.clientId, t.domain),
    domainIdx: index("idx_client_allowed_domains_domain").on(t.domain),
  }),
);

export const clientLanguages = pgTable(
  "client_languages",
  {
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    language: text("language").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.clientId, t.language] }),
  }),
);

export const stores = pgTable(
  "stores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    city: text("city"),
    countryCode: text("country_code"),
    externalId: text("external_id"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    clientIdx: index("idx_stores_client_id").on(t.clientId),
  }),
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").references(() => clients.id),
    storeId: uuid("store_id").references(() => stores.id),
    email: text("email").notNull().unique(),
    name: text("name"),
    image: text("image"),
    emailVerified: timestamp("email_verified", { withTimezone: true }),
    preferredLanguage: text("preferred_language").notNull().default("en"),
    subtitlesEnabled: boolean("subtitles_enabled").notNull().default(true),
    onboardingCompleted: boolean("onboarding_completed")
      .notNull()
      .default(false),
    storeConfirmedAt: timestamp("store_confirmed_at", { withTimezone: true }),
    role: userRoleEnum("role").notNull().default("employee"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    clientIdx: index("idx_users_client_id").on(t.clientId),
    emailIdx: index("idx_users_email").on(t.email),
  }),
);

// Auth.js Drizzle adapter tables (accounts, sessions, verificationTokens)
// We use JWT strategy so sessions table is optional, but accounts +
// verificationTokens are required for the email provider.
// Field names must be snake_case to match what DrizzleAdapter expects.
export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
  }),
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.identifier, t.token] }),
  }),
);

export const lessons = pgTable("lessons", {
  id: uuid("id").primaryKey().defaultRandom(),
  internalName: text("internal_name").notNull(),
  type: lessonTypeEnum("type").notNull().default("training"),
  contentType: lessonContentTypeEnum("content_type")
    .notNull()
    .default("video"),
  sortOrder: integer("sort_order").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const lessonTranslations = pgTable(
  "lesson_translations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    language: text("language").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    notesMarkdown: text("notes_markdown"),
    // Video media (populated only when lessons.content_type = 'video')
    muxPlaybackId: text("mux_playback_id"),
    muxAssetId: text("mux_asset_id"),
    muxUploadId: text("mux_upload_id"),
    durationSeconds: integer("duration_seconds"),
    thumbnailUrl: text("thumbnail_url"),
    // Single-image media (populated only when lessons.content_type = 'image')
    imageUrl: text("image_url"),
    imageAlt: text("image_alt"),
    // Carousel media (populated only when lessons.content_type = 'carousel').
    // Ordered array of slides: [{ url: string, alt: string, caption?: string }, ...]
    carouselSlides: jsonb("carousel_slides").$type<CarouselSlide[] | null>(),
  },
  (t) => ({
    uniqLessonLang: unique().on(t.lessonId, t.language),
    lessonIdx: index("idx_lesson_translations_lesson_id").on(t.lessonId),
  }),
);

export type CarouselSlide = {
  url: string;
  alt: string;
  caption?: string;
};

export const clientLessons = pgTable(
  "client_lessons",
  {
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.clientId, t.lessonId] }),
  }),
);

export const lessonCompletions = pgTable(
  "lesson_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqUserLesson: unique().on(t.userId, t.lessonId),
    ratingRange: check(
      "rating_1_to_5",
      sql`${t.rating} >= 1 AND ${t.rating} <= 5`,
    ),
    userIdx: index("idx_lesson_completions_user_id").on(t.userId),
    lessonIdx: index("idx_lesson_completions_lesson_id").on(t.lessonId),
  }),
);

export const lessonEvents = pgTable(
  "lesson_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    // Denormalised so analytics queries can scope by client without a join.
    // Populated server-side from the user's clientId at write time.
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "cascade",
    }),
    eventType: lessonEventTypeEnum("event_type").notNull(),
    // Per-event payload — currentTimeSec/duration for video, dwellMs for
    // image, slideIndex/totalSlides for carousel, rating for rating events,
    // engagedMs for engagement heartbeats. Free-shape so we can add fields
    // without a migration.
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userLessonTypeIdx: index("idx_lesson_events_user_lesson_type").on(
      t.userId,
      t.lessonId,
      t.eventType,
    ),
    clientCreatedIdx: index("idx_lesson_events_client_created").on(
      t.clientId,
      t.createdAt,
    ),
    lessonCreatedIdx: index("idx_lesson_events_lesson_created").on(
      t.lessonId,
      t.createdAt,
    ),
  }),
);

// Type helpers for use across the app
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Lesson = typeof lessons.$inferSelect;
export type LessonTranslation = typeof lessonTranslations.$inferSelect;
export type Store = typeof stores.$inferSelect;
export type LessonCompletion = typeof lessonCompletions.$inferSelect;
export type LessonEvent = typeof lessonEvents.$inferSelect;
export type NewLessonEvent = typeof lessonEvents.$inferInsert;
