-- Stores gain an optional street address. The same city can hold several
-- stores, so the address is what disambiguates them in the onboarding store
-- picker (rendered as "address · city"). Additive + idempotent so it is safe
-- to re-run against a partially-migrated DB.
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "address" text;
