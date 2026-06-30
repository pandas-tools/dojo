// Pure analytics aggregation. No HTTP, no Auth.
// Called from /api/admin/analytics + /admin/analytics page.
// Single-pass over the raw rows so we never N+1 the DB.

import { eq } from "drizzle-orm";
import { db } from "./db/client";
import {
  clients,
  stores,
  users,
  clientLessons,
  lessonGroupRatings,
  lessonEvents,
} from "./db/schema";

export type ClientAnalytics = {
  clientId: string;
  name: string;
  slug: string;
  isActive: boolean;
  // Stores
  storeCount: number;
  activeStoreCount: number; // stores with ≥1 employee who has ≥1 completion
  // Employees
  employeeCount: number;
  trainedEmployeeCount: number; // employees who completed ALL assigned lessons
  // Per-active-store training density
  avgTrainedPerActiveStore: number | null;
  // Lessons + completions
  assignedLessonCount: number;
  completionCount: number;
  // Group ratings (per-lesson rating was removed in 2026-06-30 cutover).
  // avgRating averages across every group rating an employee of this
  // client has submitted; responseCount is the number of group ratings.
  avgRating: number | null;
  responseCount: number;
};

export async function getClientAnalytics(): Promise<ClientAnalytics[]> {
  // Completion is derived from lesson_events (event_type =
  // 'lesson_completed'). Rating data lives in lesson_group_ratings
  // (per-lesson rating was deprecated in 2026-06-30). client_id is
  // denormalised on lesson_group_ratings so we can attribute ratings
  // without joining through users.
  const [
    clientRows,
    storeRows,
    employeeRows,
    clientLessonRows,
    groupRatingRows,
    completedEventRows,
  ] = await Promise.all([
    db.select().from(clients),
    db.select().from(stores),
    db.select().from(users).where(eq(users.role, "employee")),
    db.select().from(clientLessons),
    db
      .select({
        clientId: lessonGroupRatings.clientId,
        rating: lessonGroupRatings.rating,
      })
      .from(lessonGroupRatings),
    db
      .select({
        userId: lessonEvents.userId,
        lessonId: lessonEvents.lessonId,
      })
      .from(lessonEvents)
      .where(eq(lessonEvents.eventType, "lesson_completed")),
  ]);

  // Index rows by clientId for O(1) lookups
  const storesByClient = group(storeRows, (s) => s.clientId);
  const employeesByClient = group(employeeRows, (u) => u.clientId ?? "");
  const lessonsByClient = group(clientLessonRows, (cl) => cl.clientId);

  // Per-client lesson-assignment set so we can attribute completions strictly
  // to a user's *current* client's curriculum. Without this, if a user ever
  // moves between clients (today: not possible via UI; future-proof anyway),
  // their stale completions would inflate the new client's "trained" count.
  const assignedLessonsByClient = new Map<string, Set<string>>();
  for (const cl of clientLessonRows) {
    const set = assignedLessonsByClient.get(cl.clientId) ?? new Set<string>();
    set.add(cl.lessonId);
    assignedLessonsByClient.set(cl.clientId, set);
  }

  // userId → clientId, used to filter completions to the user's curriculum.
  const userToClient = new Map<string, string>();
  for (const u of employeeRows) {
    if (u.clientId) userToClient.set(u.id, u.clientId);
  }

  // Map: userId → count of COMPLETION EVENTS that are FOR LESSONS
  // ASSIGNED TO THE USER'S CURRENT CLIENT. Completions for lessons no
  // longer assigned (or never assigned) to the user's client don't count
  // toward "trained". De-duped per (user, lesson) — multiple completion
  // events for the same lesson count once.
  const inScopeCompletionsByUser = new Map<string, Set<string>>();
  const completedUserIdsByClient = new Map<string, Set<string>>();

  for (const ev of completedEventRows) {
    const cid = userToClient.get(ev.userId);
    if (!cid) continue;
    const assignedToClient = assignedLessonsByClient.get(cid);
    if (!assignedToClient?.has(ev.lessonId)) continue;

    const userCompleted =
      inScopeCompletionsByUser.get(ev.userId) ?? new Set<string>();
    userCompleted.add(ev.lessonId);
    inScopeCompletionsByUser.set(ev.userId, userCompleted);

    const completedSet =
      completedUserIdsByClient.get(cid) ?? new Set<string>();
    completedSet.add(ev.userId);
    completedUserIdsByClient.set(cid, completedSet);
  }

  // Group ratings: pre-aggregated per client via the denormalised
  // client_id column. Each row is one (user, group) rating; we collect
  // them per client so the avg/count below is a flat "ratings from this
  // client's employees" metric.
  const ratingsByClient = new Map<string, number[]>();
  for (const r of groupRatingRows) {
    const arr = ratingsByClient.get(r.clientId) ?? [];
    arr.push(r.rating);
    ratingsByClient.set(r.clientId, arr);
  }

  return clientRows.map((c): ClientAnalytics => {
    const clientStores = storesByClient.get(c.id) ?? [];
    const clientEmployees = employeesByClient.get(c.id) ?? [];
    const clientAssigned = (lessonsByClient.get(c.id) ?? []).length;
    const ratings = ratingsByClient.get(c.id) ?? [];
    const completedSet = completedUserIdsByClient.get(c.id) ?? new Set();

    // Active stores: any store with at least one employee who has at least one completion
    const activeStores = new Set<string>();
    for (const u of clientEmployees) {
      if (u.storeId && completedSet.has(u.id)) {
        activeStores.add(u.storeId);
      }
    }

    // Trained employees: completed ALL assigned lessons (only in-scope
    // completion EVENTS count — see inScopeCompletionsByUser construction
    // above). Counted as the size of the per-user set since events are
    // de-duped per (user, lesson).
    let trainedEmployeeCount = 0;
    let completionCountForClient = 0;
    if (clientAssigned > 0) {
      for (const u of clientEmployees) {
        const userCompleted = inScopeCompletionsByUser.get(u.id);
        if (!userCompleted) continue;
        completionCountForClient += userCompleted.size;
        if (userCompleted.size >= clientAssigned) {
          trainedEmployeeCount++;
        }
      }
    }

    const totalRating = ratings.reduce((a, b) => a + b, 0);
    const avgRating = ratings.length > 0 ? totalRating / ratings.length : null;

    return {
      clientId: c.id,
      name: c.name,
      slug: c.slug,
      isActive: c.isActive,
      storeCount: clientStores.length,
      activeStoreCount: activeStores.size,
      employeeCount: clientEmployees.length,
      trainedEmployeeCount,
      avgTrainedPerActiveStore:
        activeStores.size > 0
          ? Number((trainedEmployeeCount / activeStores.size).toFixed(2))
          : null,
      assignedLessonCount: clientAssigned,
      completionCount: completionCountForClient,
      avgRating: avgRating !== null ? Number(avgRating.toFixed(2)) : null,
      responseCount: ratings.length,
    };
  });
}

function group<T, K>(items: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = m.get(k) ?? [];
    arr.push(item);
    m.set(k, arr);
  }
  return m;
}
