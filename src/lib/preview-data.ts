// Data helpers for the admin "preview as <client>" surface (#6).
//
// Mirror the shape of scopedDb's lesson + translation reads, but take a
// raw clientId instead of a session — preview viewing has no user.
// Translation language fallback uses the client's first allowed language
// (or "en") since the preview has no user.preferredLanguage. Same
// media-aware fallback rule as the real viewer applies.

import { and, eq, inArray } from "drizzle-orm";
import { db } from "./db/client";
import {
  clients,
  clientLessons,
  clientLanguages,
  lessons,
  lessonTranslations,
} from "./db/schema";

type LessonContentType = "video" | "image" | "carousel";

function isMediaComplete(
  t: typeof lessonTranslations.$inferSelect,
  ct: LessonContentType,
): boolean {
  if (ct === "video") return !!t.muxPlaybackId;
  if (ct === "image") return !!t.imageUrl;
  const slides = Array.isArray(t.carouselSlides) ? t.carouselSlides : [];
  return slides.length >= 2;
}

async function preferredLanguageFor(clientId: string): Promise<string> {
  const rows = await db
    .select({ language: clientLanguages.language })
    .from(clientLanguages)
    .where(eq(clientLanguages.clientId, clientId));
  // Prefer EN if it's in the list; otherwise the first one; otherwise default
  // to EN (works because every lesson has an EN translation as the system
  // fallback).
  if (rows.some((r) => r.language === "en")) return "en";
  return rows[0]?.language ?? "en";
}

export interface PreviewClientHeader {
  clientId: string;
  clientName: string;
  clientSlug: string;
}

export interface PreviewBrowseLesson {
  lessonId: string;
  internalName: string;
  contentType: LessonContentType;
  title: string;
  description: string | null;
  /** Mux thumbnail / image URL / first carousel slide URL depending on type. */
  thumbnailUrl: string | null;
}

export interface PreviewBrowsePayload {
  header: PreviewClientHeader;
  lessons: PreviewBrowseLesson[];
}

export async function loadPreviewBrowse(
  clientId: string,
): Promise<PreviewBrowsePayload | null> {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!client) return null;

  const assignments = await db
    .select({ lessonId: clientLessons.lessonId })
    .from(clientLessons)
    .where(eq(clientLessons.clientId, clientId));
  const ids = assignments.map((a) => a.lessonId);
  if (ids.length === 0) {
    return {
      header: { clientId: client.id, clientName: client.name, clientSlug: client.slug },
      lessons: [],
    };
  }

  const preferred = await preferredLanguageFor(clientId);

  const [lessonRows, allTranslations] = await Promise.all([
    db
      .select()
      .from(lessons)
      .where(and(inArray(lessons.id, ids), eq(lessons.isPublished, true)))
      .orderBy(lessons.sortOrder),
    db
      .select()
      .from(lessonTranslations)
      .where(inArray(lessonTranslations.lessonId, ids)),
  ]);

  const lessonsOut: PreviewBrowseLesson[] = lessonRows.map((l) => {
    const ct = l.contentType as LessonContentType;
    const candidates = allTranslations.filter((t) => t.lessonId === l.id);
    const pref = candidates.find((t) => t.language === preferred);
    const en = candidates.find((t) => t.language === "en");
    const t = pref && isMediaComplete(pref, ct) ? pref : en;
    let thumbnailUrl: string | null = null;
    if (t) {
      if (ct === "video") thumbnailUrl = t.thumbnailUrl ?? null;
      else if (ct === "image") thumbnailUrl = t.imageUrl ?? null;
      else {
        const slides = Array.isArray(t.carouselSlides) ? t.carouselSlides : [];
        thumbnailUrl = slides[0]?.url ?? null;
      }
    }
    return {
      lessonId: l.id,
      internalName: l.internalName,
      contentType: ct,
      title: t?.title ?? "(untitled)",
      description: t?.description ?? null,
      thumbnailUrl,
    };
  });

  return {
    header: { clientId: client.id, clientName: client.name, clientSlug: client.slug },
    lessons: lessonsOut,
  };
}

export interface PreviewWatchLesson {
  header: PreviewClientHeader;
  lesson: typeof lessons.$inferSelect;
  translation: typeof lessonTranslations.$inferSelect;
}

export async function loadPreviewWatch(
  clientId: string,
  lessonId: string,
): Promise<PreviewWatchLesson | null> {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!client) return null;

  // Verify lesson is assigned to this client (so preview links can't be
  // crafted against arbitrary lesson ids).
  const [assignment] = await db
    .select()
    .from(clientLessons)
    .where(
      and(
        eq(clientLessons.clientId, clientId),
        eq(clientLessons.lessonId, lessonId),
      ),
    )
    .limit(1);
  if (!assignment) return null;

  const [lesson] = await db
    .select()
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!lesson) return null;

  const candidates = await db
    .select()
    .from(lessonTranslations)
    .where(eq(lessonTranslations.lessonId, lessonId));
  if (candidates.length === 0) return null;

  const preferred = await preferredLanguageFor(clientId);
  const ct = lesson.contentType as LessonContentType;
  const pref = candidates.find((t) => t.language === preferred);
  const en = candidates.find((t) => t.language === "en");
  const translation = pref && isMediaComplete(pref, ct) ? pref : en;
  if (!translation) return null;

  return {
    header: { clientId: client.id, clientName: client.name, clientSlug: client.slug },
    lesson,
    translation,
  };
}
