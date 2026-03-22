-- Tavern OS — Character sheets, campaigns, invites (Step A1 reference)
-- PostgreSQL. Applied via `pnpm --filter @workspace/db run push` from Drizzle schema.
-- Run this file only if you need a manual replay; prefer Drizzle as source of truth.

-- users: optional email (login remains username-based)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" text;

-- campaigns: DM metadata + lifecycle
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "setting" text;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "starting_location" text;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "tone" text;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "house_rules" text;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'recruiting' NOT NULL;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz DEFAULT now() NOT NULL;

-- characters: pool sheets (nullable campaign), story fields, explicit abilities
ALTER TABLE "characters" ALTER COLUMN "campaign_id" DROP NOT NULL;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "alignment" text;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "strength" integer;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "dexterity" integer;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "constitution" integer;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "intelligence" integer;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "wisdom" integer;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "charisma" integer;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "personality" text;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "backstory" text;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "ideals" text;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "bonds" text;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "flaws" text;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "appearance" text;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "avatar_url" text;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "game_system" text DEFAULT 'D&D 5e' NOT NULL;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz DEFAULT now() NOT NULL;

-- campaign_members: bind a membership row to a character sheet (nullable during migration)
ALTER TABLE "campaign_members" ADD COLUMN IF NOT EXISTS "character_id" uuid REFERENCES "characters"("id") ON DELETE CASCADE;
ALTER TABLE "campaign_members" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'accepted' NOT NULL;

-- campaign_invites
CREATE TABLE IF NOT EXISTS "campaign_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "invited_by" uuid NOT NULL REFERENCES "users"("id"),
  "invited_user_id" uuid REFERENCES "users"("id"),
  "invite_code" text NOT NULL UNIQUE,
  "status" text DEFAULT 'pending' NOT NULL,
  "expires_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

-- game_sessions: AI / session metadata (Phase D)
ALTER TABLE "game_sessions" ADD COLUMN IF NOT EXISTS "session_number" integer DEFAULT 1 NOT NULL;
ALTER TABLE "game_sessions" ADD COLUMN IF NOT EXISTS "dm_user_id" uuid REFERENCES "users"("id");
ALTER TABLE "game_sessions" ADD COLUMN IF NOT EXISTS "story_log" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "game_sessions" ADD COLUMN IF NOT EXISTS "locations_data" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "game_sessions" ADD COLUMN IF NOT EXISTS "items_data" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "game_sessions" ADD COLUMN IF NOT EXISTS "open_threads" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "game_sessions" ADD COLUMN IF NOT EXISTS "message_history" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "game_sessions" ADD COLUMN IF NOT EXISTS "started_at" timestamptz;
ALTER TABLE "game_sessions" ADD COLUMN IF NOT EXISTS "ended_at" timestamptz;
ALTER TABLE "game_sessions" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz DEFAULT now() NOT NULL;
