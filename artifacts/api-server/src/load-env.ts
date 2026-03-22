/**
 * Load `artifacts/api-server/.env` before any other imports in `index.ts`
 * so `process.env` is populated for session, LiveKit, DB, etc.
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
config({ path: join(dir, "..", ".env") });
