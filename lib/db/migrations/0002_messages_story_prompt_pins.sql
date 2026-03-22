-- Story assistant: player "story slider" posts + DM pins for AI context
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "pinned_for_story_ai" boolean DEFAULT false NOT NULL;
