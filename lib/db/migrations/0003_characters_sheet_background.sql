-- Optional full-bleed background for the character "studio" view (dashboard).
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "sheet_background_url" text;
