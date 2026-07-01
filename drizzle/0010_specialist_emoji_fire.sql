-- Rename the Specialist tier's emoji from ⚡ (U+26A1) to 🔥 (U+1F525) so it
-- resolves to the Noto animated fire Lottie in /public/emoji/1f525.json.
UPDATE "lesson_tiers" SET "emoji" = '🔥' WHERE "emoji" = '⚡';
