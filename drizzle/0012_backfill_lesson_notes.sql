-- Every lesson translation must render with a description + notes so the
-- Reels mobile overlay can show the tap-to-expand affordance. Backfill any
-- pre-existing rows that predate that invariant. Columns stay nullable at
-- the DB level; enforcement lives in the admin server actions so tests +
-- ad-hoc scripts that insert throwaway fixtures don't have to carry both
-- fields. Idempotent — safe to re-run.

UPDATE "lesson_translations"
SET "notes_markdown" = '# ' || "title" || E'\n\nNotes coming soon.'
WHERE "notes_markdown" IS NULL OR btrim("notes_markdown") = '';

UPDATE "lesson_translations"
SET "description" = 'Notes for ' || "title" || '.'
WHERE "description" IS NULL OR btrim("description") = '';
