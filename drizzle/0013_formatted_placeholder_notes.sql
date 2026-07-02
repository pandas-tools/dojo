-- Migration 0012 backfilled a bare "# <title>\n\nNotes coming soon." into
-- notes_markdown. Now that the notes surfaces render markdown (bold, italics,
-- dividers, lists) instead of raw text, replace that stub with a properly
-- formatted placeholder so every lesson reads cleanly until real notes are
-- authored. Only touches rows still holding the 0012 stub (or null/empty) —
-- hand-authored notes are matched out and left untouched. Idempotent.

UPDATE "lesson_translations"
SET "notes_markdown" =
  E'**About this lesson**\n\n'
  || 'This is placeholder content so you can see how the notes panel reads. '
  || E'Replace it with the real summary from the lesson admin view.\n\n'
  || E'---\n\n'
  || E'**What you''ll learn**\n\n'
  || E'- The key idea, in a single line\n'
  || E'- A step that comes up with customers\n'
  || E'- A common mistake to avoid\n\n'
  || E'---\n\n'
  || E'**Good to remember**\n\n'
  || E'_Keep notes short — employees skim these between customers._\n\n'
  || 'Questions? Ask your store lead.'
WHERE
  "notes_markdown" IS NULL
  OR btrim("notes_markdown") = ''
  OR "notes_markdown" = '# ' || "title" || E'\n\nNotes coming soon.';
