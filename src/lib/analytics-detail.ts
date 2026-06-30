// Per-client analytics detail. Funnel + store table + lesson breakdown +
// group ratings + employee list. All from the same in-memory aggregation
// pass; one query per source table.
//
// Rating model (post-2026-06-30): ratings are PER GROUP (lesson_groups),
// not per lesson. The per-lesson rating table (lesson_completions) was
// dropped; rating data now lives in lesson_group_ratings. Completion is
// still derived from lesson_events.lesson_completed.

import { and, eq, inArray } from "drizzle-orm";
import { db } from "./db/client";
import {
  clients,
  stores,
  users,
  clientLessons,
  lessons,
  lessonGroups,
  lessonTranslations,
  lessonEvents,
  lessonBookmarks,
  lessonUpvotes,
  lessonGroupRatings,
} from "./db/schema";

export type FunnelStage = {
  label: string;
  count: number;
  // Conversion rate from the previous stage (1.0 for the first stage)
  rate: number;
};

export type StoreRow = {
  storeId: string;
  name: string;
  city: string | null;
  employeesLoggedIn: number;
  completedAll: number;
  completionPct: number; // 0..1
  // Average + count of GROUP ratings submitted by employees at this store
  // (the per-lesson rating was removed in 2026-06-30 cutover).
  avgRating: number | null;
  ratingCount: number;
  status: "no-activity" | "low-completion" | "on-track" | "no-data";
};

export type LessonRow = {
  lessonId: string;
  internalName: string;
  title: string;
  completionCount: number;
  completionPct: number; // 0..1
  upvoteCount: number;
};

// Per-group rating rollup for this client. Surfaced on the client-detail
// analytics page as the "Group ratings" section. avgRating + ratingCount
// aggregate every (user, group) rating row whose user belongs to this
// client (denormalised via lesson_group_ratings.client_id).
export type GroupRow = {
  groupId: string;
  name: string;
  sortOrder: number;
  // Lessons in this group that are CURRENTLY assigned + published for this
  // client. Drives the "how many people could possibly rate this group"
  // denominator and confirms the group is even visible to the client.
  assignedLessonCount: number;
  avgRating: number | null;
  ratingCount: number;
};

export type EmployeeRow = {
  userId: string;
  email: string;
  storeName: string | null;
  completedCount: number;
  assignedCount: number;
  lastActiveAt: string | null; // ISO
  status: "not-started" | "in-progress" | "completed";
};

export type TimelinePoint = {
  // YYYY-MM-DD in UTC
  date: string;
  completions: number;
};

export type ClientDetailAnalytics = {
  clientId: string;
  clientName: string;
  clientSlug: string;
  totals: {
    storeCount: number;
    employeeCount: number;
    assignedLessonCount: number;
  };
  funnel: FunnelStage[];
  stores: StoreRow[];
  lessons: LessonRow[];
  // Per-group rating breakdown — only includes groups that have at least one
  // currently assigned+published lesson for this client. Sorted by the
  // group's editorial sort_order.
  groups: GroupRow[];
  employees: EmployeeRow[];
  // Completion count per day for the last 30 days. Always exactly 30
  // points, oldest first, even when most buckets are zero — keeps the
  // chart axis stable.
  timeline: TimelinePoint[];
};

export async function getClientDetailAnalytics(
  clientId: string,
): Promise<ClientDetailAnalytics | null> {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!client) return null;

  const [storeRows, employeeRows, clientLessonRows, upvoteRows, groupRows] =
    await Promise.all([
      db.select().from(stores).where(eq(stores.clientId, clientId)),
      db
        .select()
        .from(users)
        .where(and(eq(users.role, "employee"), eq(users.clientId, clientId))),
      db
        .select()
        .from(clientLessons)
        .where(eq(clientLessons.clientId, clientId)),
      db
        .select({ lessonId: lessonUpvotes.lessonId })
        .from(lessonUpvotes)
        .where(eq(lessonUpvotes.clientId, clientId)),
      db.select().from(lessonGroups),
    ]);

  const upvoteCountByLesson = new Map<string, number>();
  for (const u of upvoteRows) {
    upvoteCountByLesson.set(
      u.lessonId,
      (upvoteCountByLesson.get(u.lessonId) ?? 0) + 1,
    );
  }

  const assignedLessonIds = clientLessonRows.map((cl) => cl.lessonId);
  const [
    lessonRows,
    translationRows,
    groupRatingRows,
    completionEventRows,
  ] = await Promise.all([
    assignedLessonIds.length > 0
      ? db.query.lessons.findMany({
          where: (l, { inArray: inArr }) => inArr(l.id, assignedLessonIds),
          orderBy: (l, { asc }) => [asc(l.sortOrder)],
        })
      : Promise.resolve([] as (typeof lessons.$inferSelect)[]),
    assignedLessonIds.length > 0
      ? db
          .select()
          .from(lessonTranslations)
          .where(inArray(lessonTranslations.lessonId, assignedLessonIds))
      : Promise.resolve([] as (typeof lessonTranslations.$inferSelect)[]),
    // Group ratings (lesson_group_ratings table) — scoped by the
    // denormalised client_id so the query is index-only. Drives avg-rating
    // for the per-store and per-group rollups.
    db
      .select({
        userId: lessonGroupRatings.userId,
        groupId: lessonGroupRatings.groupId,
        rating: lessonGroupRatings.rating,
      })
      .from(lessonGroupRatings)
      .where(eq(lessonGroupRatings.clientId, clientId)),
    // Completion events (lesson_events table) — drives "did they finish."
    employeeRows.length > 0 && assignedLessonIds.length > 0
      ? db
          .select({
            userId: lessonEvents.userId,
            lessonId: lessonEvents.lessonId,
            createdAt: lessonEvents.createdAt,
          })
          .from(lessonEvents)
          .where(
            and(
              eq(lessonEvents.eventType, "lesson_completed"),
              inArray(
                lessonEvents.userId,
                employeeRows.map((u) => u.id),
              ),
              inArray(lessonEvents.lessonId, assignedLessonIds),
            ),
          )
      : Promise.resolve(
          [] as { userId: string; lessonId: string; createdAt: Date }[],
        ),
  ]);

  const assignedCount = assignedLessonIds.length;
  const enTitleByLessonId = new Map<string, string>();
  for (const t of translationRows) {
    if (t.language === "en") enTitleByLessonId.set(t.lessonId, t.title);
  }

  // Completion events — de-duped per (user, lesson). A user who somehow
  // produced multiple lesson_completed events for the same lesson counts
  // as one completion. scopedDb.events.write de-dupes on insert too;
  // belt-and-braces here in case backfill or admin scripts ever produce
  // dupes.
  const completedLessonsByUser = new Map<string, Set<string>>();
  const completedUsersByLesson = new Map<string, Set<string>>();
  for (const e of completionEventRows) {
    const userSet = completedLessonsByUser.get(e.userId) ?? new Set<string>();
    userSet.add(e.lessonId);
    completedLessonsByUser.set(e.userId, userSet);
    const lessonSet =
      completedUsersByLesson.get(e.lessonId) ?? new Set<string>();
    lessonSet.add(e.userId);
    completedUsersByLesson.set(e.lessonId, lessonSet);
  }

  // Group ratings — indexed for the per-store (via user) and per-group
  // rollups. Each row is one (user, group) rating.
  const ratingsByUser = new Map<string, number[]>();
  const ratingsByGroup = new Map<string, number[]>();
  for (const r of groupRatingRows) {
    const u = ratingsByUser.get(r.userId) ?? [];
    u.push(r.rating);
    ratingsByUser.set(r.userId, u);
    const g = ratingsByGroup.get(r.groupId) ?? [];
    g.push(r.rating);
    ratingsByGroup.set(r.groupId, g);
  }

  // FUNNEL — based on completion events, not ratings.
  const loggedIn = employeeRows.length;
  const completed1Plus = employeeRows.filter(
    (u) => (completedLessonsByUser.get(u.id)?.size ?? 0) > 0,
  ).length;
  const completedAll =
    assignedCount > 0
      ? employeeRows.filter(
          (u) =>
            (completedLessonsByUser.get(u.id)?.size ?? 0) >= assignedCount,
        ).length
      : 0;

  const funnel: FunnelStage[] = [
    { label: "Logged in", count: loggedIn, rate: 1 },
    {
      label: "Completed 1+ lessons",
      count: completed1Plus,
      rate: loggedIn > 0 ? completed1Plus / loggedIn : 0,
    },
    {
      label: "Completed all lessons",
      count: completedAll,
      rate: completed1Plus > 0 ? completedAll / completed1Plus : 0,
    },
  ];

  // STORES
  const storesById = new Map(storeRows.map((s) => [s.id, s]));
  const employeesByStore = new Map<string, typeof employeeRows>();
  for (const u of employeeRows) {
    if (!u.storeId) continue;
    const arr = employeesByStore.get(u.storeId) ?? [];
    arr.push(u);
    employeesByStore.set(u.storeId, arr);
  }

  const storeRowsOut: StoreRow[] = storeRows
    .map((s): StoreRow => {
      const usersAtStore = employeesByStore.get(s.id) ?? [];
      const loggedAtStore = usersAtStore.length;
      const completedAtStore = usersAtStore.filter(
        (u) =>
          assignedCount > 0 &&
          (completedLessonsByUser.get(u.id)?.size ?? 0) >= assignedCount,
      ).length;
      const completionPct =
        loggedAtStore > 0 && assignedCount > 0
          ? completedAtStore / loggedAtStore
          : 0;
      const ratings = usersAtStore.flatMap(
        (u) => ratingsByUser.get(u.id) ?? [],
      );
      const avgRating =
        ratings.length > 0
          ? Number(
              (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2),
            )
          : null;

      let status: StoreRow["status"];
      if (loggedAtStore === 0) status = "no-activity";
      else if (assignedCount === 0) status = "no-data";
      else if (completionPct < 0.5) status = "low-completion";
      else status = "on-track";

      return {
        storeId: s.id,
        name: s.name,
        city: s.city,
        employeesLoggedIn: loggedAtStore,
        completedAll: completedAtStore,
        completionPct,
        avgRating,
        ratingCount: ratings.length,
        status,
      };
    })
    .sort((a, b) => {
      // Sort: on-track desc by completion, then low-completion, then no-activity
      const order = { "on-track": 0, "low-completion": 1, "no-data": 2, "no-activity": 3 };
      if (order[a.status] !== order[b.status]) {
        return order[a.status] - order[b.status];
      }
      return b.completionPct - a.completionPct;
    });

  // LESSONS — completion + upvote stats only (per-lesson rating removed
  // in 2026-06-30 cutover; see the GroupRow section below for ratings).
  const lessonRowsOut: LessonRow[] = lessonRows.map((l): LessonRow => {
    const completedUsers = completedUsersByLesson.get(l.id);
    const completionCount = completedUsers?.size ?? 0;
    const completionPct = loggedIn > 0 ? completionCount / loggedIn : 0;
    return {
      lessonId: l.id,
      internalName: l.internalName,
      title: enTitleByLessonId.get(l.id) ?? l.internalName,
      completionCount,
      completionPct,
      upvoteCount: upvoteCountByLesson.get(l.id) ?? 0,
    };
  });

  // GROUPS — only surface groups that have at least one currently
  // assigned + published lesson for this client. assignedLessonCount is
  // the rateable surface area (groups with 0 published-assigned lessons
  // can't be rated, so they don't belong here).
  const assignedSet = new Set(assignedLessonIds);
  const publishedAssignedByGroup = new Map<string, number>();
  for (const l of lessonRows) {
    if (!l.groupId || !l.isPublished || !assignedSet.has(l.id)) continue;
    publishedAssignedByGroup.set(
      l.groupId,
      (publishedAssignedByGroup.get(l.groupId) ?? 0) + 1,
    );
  }
  const groupRowsOut: GroupRow[] = groupRows
    .filter((g) => (publishedAssignedByGroup.get(g.id) ?? 0) > 0)
    .map((g): GroupRow => {
      const ratings = ratingsByGroup.get(g.id) ?? [];
      const avgRating =
        ratings.length > 0
          ? Number(
              (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2),
            )
          : null;
      return {
        groupId: g.id,
        name: g.name,
        sortOrder: g.sortOrder,
        assignedLessonCount: publishedAssignedByGroup.get(g.id) ?? 0,
        avgRating,
        ratingCount: ratings.length,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // EMPLOYEES
  const employeeRowsOut: EmployeeRow[] = employeeRows
    .map((u): EmployeeRow => {
      const completedSet = completedLessonsByUser.get(u.id);
      const completedCount = completedSet?.size ?? 0;
      // Most recent activity = most recent completion event for this user
      // across their completed lessons. Falls back to null if they never
      // completed anything.
      const userEvents = completionEventRows.filter((e) => e.userId === u.id);
      const lastActiveAt =
        userEvents.length > 0
          ? userEvents
              .map((e) => e.createdAt.toISOString())
              .sort()
              .reverse()[0]
          : null;
      let status: EmployeeRow["status"];
      if (completedCount === 0) status = "not-started";
      else if (assignedCount > 0 && completedCount >= assignedCount)
        status = "completed";
      else status = "in-progress";
      return {
        userId: u.id,
        email: u.email,
        storeName: u.storeId
          ? (storesById.get(u.storeId)?.name ?? null)
          : null,
        completedCount,
        assignedCount,
        lastActiveAt,
        status,
      };
    })
    .sort((a, b) => {
      // Most recently active first, then email asc for ties
      if (a.lastActiveAt && b.lastActiveAt) {
        return b.lastActiveAt.localeCompare(a.lastActiveAt);
      }
      if (a.lastActiveAt) return -1;
      if (b.lastActiveAt) return 1;
      return a.email.localeCompare(b.email);
    });

  // TIMELINE — completion events per day for the last 30 days, oldest
  // first. Buckets are computed in UTC for stability across regions; the
  // page formats them in the viewer's locale at render time.
  const DAYS = 30;
  const now = new Date();
  const startUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - (DAYS - 1),
  );
  const bucketCounts = new Map<string, number>();
  for (const c of completionEventRows) {
    const d = c.createdAt;
    const ts = Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
    );
    if (ts < startUtc) continue;
    const key = new Date(ts).toISOString().slice(0, 10);
    bucketCounts.set(key, (bucketCounts.get(key) ?? 0) + 1);
  }
  const timeline: TimelinePoint[] = [];
  for (let i = 0; i < DAYS; i++) {
    const ts = startUtc + i * 24 * 60 * 60 * 1000;
    const key = new Date(ts).toISOString().slice(0, 10);
    timeline.push({ date: key, completions: bucketCounts.get(key) ?? 0 });
  }

  return {
    clientId: client.id,
    clientName: client.name,
    clientSlug: client.slug,
    totals: {
      storeCount: storeRows.length,
      employeeCount: employeeRows.length,
      assignedLessonCount: assignedCount,
    },
    funnel,
    stores: storeRowsOut,
    lessons: lessonRowsOut,
    groups: groupRowsOut,
    employees: employeeRowsOut,
    timeline,
  };
}

// ---------------------------------------------------------------------------
// Per-employee drill: everything a Pandas admin needs to investigate one user.
// ---------------------------------------------------------------------------

export type EmployeeLessonHistory = {
  lessonId: string;
  internalName: string;
  title: string;
  opened: boolean;
  completed: boolean;
  totalEngagedMs: number;
  lastActivityAt: string | null; // ISO
};

// One group rating row for the employee drill, sorted newest-first.
export type EmployeeGroupRating = {
  groupId: string;
  groupName: string;
  rating: number; // 1-5
  ratedAt: string; // ISO — updatedAt (= createdAt on first rate, bumps on re-rate)
};

export type EmployeeProfile = {
  userId: string;
  email: string;
  name: string | null;
  role: "employee" | "admin" | "client_admin";
  clientId: string | null;
  clientName: string | null;
  clientSlug: string | null;
  storeId: string | null;
  storeName: string | null;
  preferredLanguage: string;
  onboardingCompleted: boolean;
  storeConfirmedAt: string | null; // ISO
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

export type EmployeeDetail = {
  user: EmployeeProfile;
  // Lessons currently assigned to the user's client, with this user's
  // per-lesson activity merged in. Admins viewing themselves get an empty
  // array (they don't have an assigned-lessons list).
  lessons: EmployeeLessonHistory[];
  // Group ratings this user has submitted. Empty when the user has never
  // finished + rated a group. Sorted newest-first by ratedAt.
  groupRatings: EmployeeGroupRating[];
  // Coarse-grained totals across lessons + group ratings.
  totals: {
    opened: number;
    completed: number;
    assigned: number;
    // Average of this user's group ratings (1-5), or null if they haven't
    // rated any group. Source of truth shifted from per-lesson rating in
    // the 2026-06-30 cutover.
    avgRating: number | null;
    totalEngagedMs: number;
    bookmarked: number;
  };
};

/**
 * Aggregate everything Pandas-team admins need to investigate a single user:
 * profile + per-lesson timeline (open/complete/engagement) + group ratings +
 * totals. Returns null if the user doesn't exist. One pass, parallel queries:
 * user + lesson_events + lesson_group_ratings + lesson_bookmarks +
 * client_lessons join lessons join translations join lesson_groups.
 */
export async function getEmployeeDetail(
  userId: string,
): Promise<EmployeeDetail | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return null;

  const [clientRow, storeRow] = await Promise.all([
    user.clientId
      ? db
          .select()
          .from(clients)
          .where(eq(clients.id, user.clientId))
          .limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
    user.storeId
      ? db
          .select()
          .from(stores)
          .where(eq(stores.id, user.storeId))
          .limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
  ]);

  const profile: EmployeeProfile = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    clientId: user.clientId,
    clientName: clientRow?.name ?? null,
    clientSlug: clientRow?.slug ?? null,
    storeId: user.storeId,
    storeName: storeRow?.name ?? null,
    preferredLanguage: user.preferredLanguage,
    onboardingCompleted: user.onboardingCompleted,
    storeConfirmedAt: user.storeConfirmedAt
      ? user.storeConfirmedAt.toISOString()
      : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };

  const emptyTotals = {
    opened: 0,
    completed: 0,
    assigned: 0,
    avgRating: null,
    totalEngagedMs: 0,
    bookmarked: 0,
  } as const;

  // No clientId → no lessons to merge in.
  if (!user.clientId) {
    return {
      user: profile,
      lessons: [],
      groupRatings: [],
      totals: { ...emptyTotals },
    };
  }

  // Pull assigned lessons + this user's activity + group ratings + bookmarks.
  const [assignmentRows, eventRows, groupRatingRows, bookmarkRows] =
    await Promise.all([
      db
        .select()
        .from(clientLessons)
        .where(eq(clientLessons.clientId, user.clientId)),
      db.select().from(lessonEvents).where(eq(lessonEvents.userId, userId)),
      db
        .select({
          groupId: lessonGroupRatings.groupId,
          rating: lessonGroupRatings.rating,
          updatedAt: lessonGroupRatings.updatedAt,
        })
        .from(lessonGroupRatings)
        .where(eq(lessonGroupRatings.userId, userId)),
      db
        .select({ lessonId: lessonBookmarks.lessonId })
        .from(lessonBookmarks)
        .where(eq(lessonBookmarks.userId, userId)),
    ]);

  const assignedIds = assignmentRows.map((a) => a.lessonId);
  if (assignedIds.length === 0) {
    return {
      user: profile,
      lessons: [],
      groupRatings: [],
      totals: { ...emptyTotals },
    };
  }

  // Bookmarks on lessons still assigned to this user's client.
  const assignedSet = new Set(assignedIds);
  const bookmarkedCount = bookmarkRows.filter((b) =>
    assignedSet.has(b.lessonId),
  ).length;

  const [lessonRows, translationRows, groupNameRows] = await Promise.all([
    db
      .select()
      .from(lessons)
      .where(inArray(lessons.id, assignedIds)),
    db
      .select()
      .from(lessonTranslations)
      .where(inArray(lessonTranslations.lessonId, assignedIds)),
    groupRatingRows.length > 0
      ? db
          .select({ id: lessonGroups.id, name: lessonGroups.name })
          .from(lessonGroups)
          .where(
            inArray(
              lessonGroups.id,
              groupRatingRows.map((r) => r.groupId),
            ),
          )
      : Promise.resolve([] as { id: string; name: string }[]),
  ]);

  // Pick translation title by preferred lang with EN fallback.
  const titleFor = (lessonId: string): string => {
    const candidates = translationRows.filter((t) => t.lessonId === lessonId);
    const pref = candidates.find((t) => t.language === user.preferredLanguage);
    const en = candidates.find((t) => t.language === "en");
    return (pref ?? en)?.title ?? "(no title)";
  };

  // Build per-lesson activity buckets from this user's events.
  type Bucket = {
    opened: boolean;
    completed: boolean;
    engagedMs: number;
    lastActivity: Date | null;
  };
  const buckets = new Map<string, Bucket>();
  const getBucket = (lid: string): Bucket => {
    let b = buckets.get(lid);
    if (!b) {
      b = { opened: false, completed: false, engagedMs: 0, lastActivity: null };
      buckets.set(lid, b);
    }
    return b;
  };
  for (const ev of eventRows) {
    const b = getBucket(ev.lessonId);
    if (ev.eventType === "lesson_opened") b.opened = true;
    else if (ev.eventType === "lesson_completed") b.completed = true;
    else if (ev.eventType === "lesson_engagement") {
      const p = (ev.payload ?? {}) as { engagedMs?: number };
      if (typeof p.engagedMs === "number" && Number.isFinite(p.engagedMs)) {
        // engagement payloads carry CUMULATIVE engagedMs per session; take
        // the running max we've seen, not the sum, so heartbeats don't
        // double-count.
        if (p.engagedMs > b.engagedMs) b.engagedMs = p.engagedMs;
      }
    }
    if (!b.lastActivity || ev.createdAt > b.lastActivity) {
      b.lastActivity = ev.createdAt;
    }
  }

  const lessonsOut: EmployeeLessonHistory[] = lessonRows
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((l) => {
      const b = buckets.get(l.id);
      return {
        lessonId: l.id,
        internalName: l.internalName,
        title: titleFor(l.id),
        opened: !!b?.opened,
        completed: !!b?.completed,
        totalEngagedMs: b?.engagedMs ?? 0,
        lastActivityAt: b?.lastActivity?.toISOString() ?? null,
      };
    });

  const groupNameById = new Map<string, string>();
  for (const g of groupNameRows) groupNameById.set(g.id, g.name);
  const groupRatingsOut: EmployeeGroupRating[] = groupRatingRows
    .map((r): EmployeeGroupRating => ({
      groupId: r.groupId,
      groupName: groupNameById.get(r.groupId) ?? "(unknown group)",
      rating: r.rating,
      ratedAt: r.updatedAt.toISOString(),
    }))
    .sort((a, b) => b.ratedAt.localeCompare(a.ratedAt));

  const completedCount = lessonsOut.filter((l) => l.completed).length;
  const openedCount = lessonsOut.filter((l) => l.opened).length;
  const ratingValues = groupRatingsOut.map((r) => r.rating);
  const avgRating =
    ratingValues.length === 0
      ? null
      : Number(
          (
            ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length
          ).toFixed(2),
        );
  const totalEngagedMs = lessonsOut.reduce((a, l) => a + l.totalEngagedMs, 0);

  return {
    user: profile,
    lessons: lessonsOut,
    groupRatings: groupRatingsOut,
    totals: {
      opened: openedCount,
      completed: completedCount,
      assigned: lessonsOut.length,
      avgRating,
      totalEngagedMs,
      bookmarked: bookmarkedCount,
    },
  };
}
