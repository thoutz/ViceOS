# TavernOS — Build Documentation

> A full-featured, browser-based Virtual Tabletop (VTT) platform for D&D 5e.
> This document describes the original specification, architecture, every major design decision, and the complete implementation detail so that any developer (or AI assistant like Cursor) can understand, maintain, and extend the codebase.

---

## Table of Contents

1. [Original Plan (Claude Specification)](#1-original-plan-claude-specification)
2. [Technology Stack](#2-technology-stack)
3. [Monorepo Architecture](#3-monorepo-architecture)
4. [Database Schema](#4-database-schema)
5. [API Design](#5-api-design)
6. [Authentication & Multi-Tab Identity](#6-authentication--multi-tab-identity)
7. [Real-Time Layer (Socket.IO)](#7-real-time-layer-socketio)
8. [Frontend Architecture](#8-frontend-architecture)
9. [VTT Game Table — Session Page](#9-vtt-game-table--session-page)
10. [Map Canvas (Konva.js)](#10-map-canvas-konvajs)
11. [Character System](#11-character-system)
12. [Chat & Dice System](#12-chat--dice-system)
13. [DM Command Center Drawer](#13-dm-command-center-drawer)
14. [Initiative & Combat Tracking](#14-initiative--combat-tracking)
15. [Condition Duration System](#15-condition-duration-system)
16. [Design System & Theming](#16-design-system--theming)
17. [Key Files Reference](#17-key-files-reference)
18. [Running the Project](#18-running-the-project)
19. [Known Architecture Decisions & Trade-offs](#19-known-architecture-decisions--trade-offs)

---

## 1. Original Plan (Claude Specification)

The following was the complete initial specification provided to the AI to build TavernOS:

### Project Goal
> Build TavernOS — a full-featured browser-based VTT platform for D&D 5e with:
> - Three-column game table (character sheet left, Konva.js map canvas center, chat/DM tools right)
> - Persistent initiative top bar
> - Real-time Socket.IO sync
> - Drag-and-drop tokens (DM only)
> - Fog of war
> - Full D&D 5e character sheets
> - Dice roller (rpg-dice-roller)
> - Campaign dashboard
> - 7-step character creation wizard

### Required Features Checklist (from spec)

| Feature | Status |
|---|---|
| Three-column game table | ✅ Implemented |
| Persistent initiative top bar | ✅ Implemented |
| Real-time Socket.IO sync | ✅ Implemented |
| Drag-and-drop tokens (DM only) | ✅ Implemented |
| Fog of war | ✅ Implemented (structure + reveal/hide tools) |
| Full D&D 5e character sheets | ✅ Implemented |
| Dice roller (rpg-dice-roller) | ✅ Implemented |
| Campaign dashboard | ✅ Implemented |
| 7-step character creation wizard | ✅ Implemented |
| DM Command Center (dedicated drawer) | ✅ Implemented |
| Bidirectional whisper threads (DM ↔ Player) | ✅ Implemented |
| Multi-tab user identity simulation | ✅ Implemented (X-Tab-Id header) |
| Condition tracking with round-based expiry | ✅ Implemented |
| Multi-map session support | ✅ Implemented |
| Encounter builder (NPC search via Open5e API) | ✅ Implemented |
| Ambient scene triggers | ✅ Implemented |

### Design Direction (from spec)
- **Dark fantasy** aesthetic
- Background `#0E0B06`, gold `#C9A84C`, parchment `#F2E8CE`, ember `#E07B39`
- Fonts: Cinzel Decorative (headings), Cinzel (labels), Crimson Pro (body)
- Inspired by physical tabletop materials — wood, parchment, wax seals

---

## 2. Technology Stack

### Backend
| Layer | Technology |
|---|---|
| Runtime | Node.js 24 |
| Framework | Express 5 |
| Real-time | Socket.IO 4 |
| Database | PostgreSQL (Replit managed) |
| ORM | Drizzle ORM |
| Schema validation | Zod v4 + drizzle-zod |
| API spec | OpenAPI 3.1 (Orval codegen) |
| Build | esbuild (CJS bundle) |
| Logger | pino + pino-http |
| Session | express-session |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| State | TanStack Query (server state) + React useState |
| Routing | Wouter |
| Map/Canvas | react-konva (Konva.js wrapper) |
| Animations | Framer Motion |
| Icons | Lucide React |
| Dice | rpg-dice-roller |
| Date formatting | date-fns |
| Styling | Tailwind CSS v4 + custom CSS variables |

### Monorepo
| Tool | Version |
|---|---|
| Package manager | pnpm workspaces |
| TypeScript | 5.9 |
| TS project references | Yes (composite: true) |

---

## 3. Monorepo Architecture

```
workspace/
├── artifacts/
│   ├── api-server/          # Express + Socket.IO backend
│   └── tavernos/            # React + Vite frontend
├── lib/
│   ├── api-spec/            # openapi.yaml + orval.config.ts
│   ├── api-client-react/    # Generated React Query hooks + custom-fetch
│   ├── api-zod/             # Generated Zod schemas
│   └── db/                  # Drizzle ORM schema + DB connection
├── scripts/                 # One-off utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json       # Shared TS config (composite: true)
└── tsconfig.json            # Root project references
```

### Key Conventions
- Every package has `composite: true` in its tsconfig so TypeScript can do project-reference builds
- Always run `pnpm run typecheck` from the root — this triggers `tsc --build` across all packages in dependency order
- The API is code-generated from `lib/api-spec/openapi.yaml`. Run `pnpm --filter @workspace/api-spec run codegen` to regenerate after spec changes
- The frontend talks to the backend via the generated hooks in `lib/api-client-react`

### Workflow / Ports
- **Frontend (TavernOS)**: reads `PORT` env var (Replit assigns `20140`), served at `/`
- **Backend (API Server)**: reads `PORT` env var (Replit assigns `8080`), mounted at `/api`
- Socket.IO path: `/socket.io` on the same origin as the frontend (proxied)

---

## 4. Database Schema

All tables use UUIDs as primary keys (via `nanoid` or `uuid()`). Drizzle ORM manages the schema. Run `pnpm --filter @workspace/db run push` to apply schema to the database.

### `users`
```
id          uuid PK
username    text UNIQUE NOT NULL
createdAt   timestamp DEFAULT now()
```

### `campaigns`
```
id          uuid PK
name        text NOT NULL
description text
gameSystem  text DEFAULT 'D&D 5e'
inviteCode  text UNIQUE NOT NULL (8-char nanoid, uppercase)
dmUserId    uuid FK → users.id
settings    jsonb (campaign-level settings)
createdAt   timestamp DEFAULT now()
```

### `campaign_members`
```
id          uuid PK
campaignId  uuid FK → campaigns.id
userId      uuid FK → users.id
role        text ('dm' | 'player')
joinedAt    timestamp DEFAULT now()
```

### `characters`
```
id              uuid PK
campaignId      uuid FK → campaigns.id
userId          uuid FK → users.id
name            text NOT NULL
race            text
subrace         text
class           text
subclass        text
background      text
level           integer DEFAULT 1
hp              integer DEFAULT 10
maxHp           integer DEFAULT 10
tempHp          integer DEFAULT 0
ac              integer DEFAULT 10
speed           integer DEFAULT 30
initiativeBonus integer DEFAULT 0
stats           jsonb { str, dex, con, int, wis, cha }
sheetData       jsonb (full D&D 5e sheet: skills, saving throws, attacks, spells, equipment, personality, etc.)
tokenColor      text DEFAULT '#C9A84C'
isNpc           boolean DEFAULT false
createdAt       timestamp DEFAULT now()
```

### `game_sessions`
```
id               uuid PK
campaignId       uuid FK → campaigns.id
name             text DEFAULT 'Session N'
status           text ('active' | 'ended')
activeMapId      uuid (nullable, FK → maps.id)
initiativeOrder  jsonb (array of InitiativeCombatant)
currentTurnIndex integer DEFAULT 0
roundNumber      integer DEFAULT 1
createdAt        timestamp DEFAULT now()
```

### `maps`
```
id          uuid PK
campaignId  uuid FK → campaigns.id
name        text NOT NULL
imageData   text (base64 image or URL)
gridSize    integer DEFAULT 50
width       integer DEFAULT 2000
height      integer DEFAULT 1500
createdAt   timestamp DEFAULT now()
```

### `messages`
```
id          uuid PK
sessionId   uuid FK → game_sessions.id
senderId    uuid FK → users.id
senderName  text
recipientId uuid (nullable — for whispers)
content     text NOT NULL
type        text ('chat' | 'dice' | 'system' | 'whisper')
diceData    jsonb (nullable — { total, output, expr } for dice rolls)
createdAt   timestamp DEFAULT now()
```

---

## 5. API Design

The API follows RESTful conventions, all routes under `/api`. The full spec lives at `lib/api-spec/openapi.yaml`.

### Auth Routes
```
POST   /api/auth/login        — Username login / register (upserts user)
GET    /api/auth/me           — Get current logged-in user
POST   /api/auth/logout       — Destroy session / clear tab identity
```

### Campaign Routes
```
GET    /api/campaigns                    — List campaigns for current user
POST   /api/campaigns                    — Create campaign (caller becomes DM)
POST   /api/campaigns/join               — Join via invite code
GET    /api/campaigns/:id                — Get campaign (must be member)
PUT    /api/campaigns/:id                — Update campaign (DM only)
DELETE /api/campaigns/:id                — Delete campaign + all data (DM only)
```

### Character Routes
```
GET    /api/campaigns/:cId/characters            — List all characters in campaign
POST   /api/campaigns/:cId/characters            — Create character
GET    /api/campaigns/:cId/characters/:charId    — Get character
PUT    /api/campaigns/:cId/characters/:charId    — Update character (own or DM)
DELETE /api/campaigns/:cId/characters/:charId    — Delete character (own or DM)
```

### Session Routes
```
GET    /api/campaigns/:cId/sessions              — List sessions
POST   /api/campaigns/:cId/sessions              — Create session (DM only)
GET    /api/campaigns/:cId/sessions/:sId         — Get session
PUT    /api/campaigns/:cId/sessions/:sId         — Update session (DM only)
POST   /api/campaigns/:cId/sessions/:sId/livekit-token — Mint LiveKit JWT for session video (member)
```

### Map Routes
```
GET    /api/campaigns/:cId/maps                  — List maps
POST   /api/campaigns/:cId/maps                  — Create map (DM only)
GET    /api/campaigns/:cId/maps/:mapId           — Get map
DELETE /api/campaigns/:cId/maps/:mapId           — Delete map (DM only)
```

### Message Routes
```
GET    /api/campaigns/:cId/sessions/:sId/messages     — List messages (filters whispers)
POST   /api/campaigns/:cId/sessions/:sId/messages     — Post message
```

### Access Control
- `requireAuth` — checks `getEffectiveUserId(req)` (tab identity or session)
- `requireCampaignMember` — verifies membership in `campaign_members`
- `requireDm` — checks `member.role === 'dm'`

### Message Visibility Rules
- `chat`, `dice`, `system` — visible to all members
- `whisper` — visible to DM always; players see only messages where `senderId === userId` OR `recipientId === userId`
- When a player whispers with no explicit recipientId, the server auto-resolves the DM's userId

---

## 6. Authentication & Multi-Tab Identity

### Simple Username Auth
There are no passwords. Users enter a username; the server does an upsert (`INSERT ... ON CONFLICT`). This is intentional — it's a dev/local VTT tool, not a production-secure app.

### Session Cookies
- `express-session` with PostgreSQL-backed session store (falls back to in-memory in dev)
- `SESSION_SECRET` env var — **required in production** (server crashes on startup if missing in `NODE_ENV=production`)
- `cookie.secure = true` in production, `false` in development
- `cookie.sameSite = 'strict'` in production, `'lax'` in development

### Multi-Tab Identity (X-Tab-Id)
Problem: browsers share one session cookie across all tabs, so logging in as a different user in a second tab overwrites the first user for all tabs. This breaks multi-player testing in a single browser.

Solution: **per-tab UUID stored in `sessionStorage`**

How it works:
1. On app load (`App.tsx`), `getOrCreateTabId()` reads or generates a UUID in `sessionStorage` under key `tavernos_tab_id`
2. `setTabIdGetter(getOrCreateTabId)` registers this with the custom fetch layer
3. **Every HTTP request** now includes an `X-Tab-Id` header with the tab's UUID
4. **Login**: if `X-Tab-Id` is present, identity is stored in `tabIdentityMap` (in-memory Map on the server) instead of (or in addition to) the session cookie
5. **All route handlers** call `getEffectiveUserId(req)` which checks `X-Tab-Id → tabIdentityMap` first, then falls back to `req.session.userId`
6. **Socket.IO connections** pass `auth: { tabId }` in the handshake; the server resolves identity the same way

Key files:
- `lib/api-client-react/src/custom-fetch.ts` — `setTabIdGetter()`, injects `X-Tab-Id` header
- `artifacts/api-server/src/middlewares/auth.ts` — `tabIdentityMap`, `getEffectiveUserId()`, `getEffectiveUsername()`
- `artifacts/tavernos/src/App.tsx` — registers tab ID getter on mount
- `artifacts/tavernos/src/hooks/use-socket.ts` — passes `auth.tabId` to socket

---

## 7. Real-Time Layer (Socket.IO)

Socket.IO is mounted on the same HTTP server as Express. The session middleware is shared with Socket.IO via `io.engine.use(sessionMiddleware)`.

### Connection Lifecycle
1. Client connects with `withCredentials: true` and optionally `auth.tabId`
2. Server resolves identity via tab map or session
3. If no identity found → `socket.disconnect(true)` (unauthenticated)
4. Client emits `join_session` with `{ campaignId, sessionId, username }`
5. Server verifies membership, verifies session belongs to campaign, joins the socket room `session:<sessionId>`

### Socket Events (Client → Server)
```
join_session        { campaignId, sessionId, username }
token_move          { mapId, tokenId, x, y }
token_place         { mapId, token: TokenData }       — DM only
token_remove        { mapId, tokenId }                — DM only
initiative_advance  { direction: 'next' | 'prev' }   — DM only
initiative_order_update  { initiativeOrder }          — DM only
chat_message        { message }
fog_update          { mapId, fogData }                — DM only
hp_update           { characterId, hp, maxHp }
```

### Socket Events (Server → Client, broadcast to room)
```
token_moved         { mapId, tokenId, x, y }
token_placed        { mapId, token }
token_removed       { mapId, tokenId }
turn_changed        { currentTurnIndex, roundNumber, initiativeOrder }
initiative_order_updated  { initiativeOrder }
chat_message        (triggers TanStack Query refetch)
fog_updated         { mapId, fogData }
hp_updated          { characterId, hp, maxHp }
user_joined         { userId, username }
```

### Authorization on Socket Events
DM-only events are gated by checking `(socket.data as SocketData).role === 'dm'` and the session/campaign ownership stored in `socket.data` at join time.

---

## 8. Frontend Architecture

### Page Structure
```
/                           → Login page
/dashboard                  → Campaign dashboard (list, create, join)
/campaign/:cId/create-character  → 7-step character creation wizard
/session/:cId/:sessionId    → VTT game table
```

### Data Fetching
All server data is fetched via TanStack Query hooks generated by Orval from the OpenAPI spec. The generated hooks live in `lib/api-client-react/src/generated/api.ts`.

Example:
```typescript
const { data: campaigns } = useListCampaigns();
const createCampaign = useCreateCampaign();
createCampaign.mutate({ data: { name: 'My Campaign' } });
```

### Real-Time / Query Invalidation
Socket.IO events that represent data changes (e.g. `chat_message`, `token_placed`) trigger `queryClient.invalidateQueries()` so TanStack Query refetches the affected data automatically. The socket hook (`use-socket.ts`) has callbacks that accept `refetch*` functions passed in from the session page.

### State Management
- **Server state**: TanStack Query
- **UI state**: React `useState` / `useRef` (initiative order, active conditions, panel open/closed states)
- No global state library — Zustand was available but not needed given the page-level component structure

---

## 9. VTT Game Table — Session Page

File: `artifacts/tavernos/src/pages/session.tsx`

### Layout
```
┌──────────────────────────────────────────────────┐
│  TOP BAR: Campaign name | DM badge | DM btn | Exit │
├──────────────────────────────────────────────────┤
│  INITIATIVE STRIP (scrollable horizontal)         │
├────────────────┬───────────────┬──────────────────┤
│                │               │                  │
│  CHAT + VIDEO  │   MAP CANVAS  │   SHEET + ROLLS  │
│  (LiveKit +    │   (Konva.js)  │   (tabs)         │
│   table chat)  │   (center)    │   (right panel)  │
│  (left panel)  │               │                  │
└────────────────┴───────────────┴──────────────────┘
│  BOTTOM HOTBAR: Dice | Conditions | Notes         │
└──────────────────────────────────────────────────┘
```

### Active Map Resolution
```typescript
const activeMap = (maps && activeSession?.activeMapId
  ? (maps.find(m => m.id === activeSession.activeMapId) ?? maps[0])
  : maps?.[0]) ?? null;
```
The session stores an `activeMapId`. The DM can switch it via the map switcher UI in the DM tools panel, which calls `updateSession({ activeMapId: newMapId })`.

### Responsive Panels
The party chat/video column (left) and character sheet (right) collapse on small screens, controlled by the toggles in the top bar (message and user icons).

---

## 10. Map Canvas (Konva.js)

File: `artifacts/tavernos/src/components/vtt/MapCanvas.tsx`

### Layers (z-order, bottom to top)
1. **Map image** — background image (from map.imageData)
2. **Grid** — 50px cell lines drawn with Konva.Line
3. **Fog of war** — semi-transparent rectangles
4. **Tokens** — circles with name labels, HP bar, AC badge
5. **Toolbar** — floating tool palette (select/move/fog/place_token)

### Token Shape
Each token is a Konva Group containing:
- Circle with the token's color
- Text label (character name)
- HP bar (red/green strip at the bottom)
- AC badge (blue circle, top-left corner)

### Token Interaction
- **DM**: can drag tokens, place new tokens, remove tokens
- **Players**: read-only view (tokens not draggable)
- Drag end emits `token_move` socket event; all clients receive `token_moved` and update local state

### Token Placement Tool
DM opens a popover with inputs for:
- Token name
- Color (hex color picker)
- HP / Max HP
- AC (Armor Class)

On confirm, emits `token_place` with a generated UUID for the token ID.

### Fog of War
- Fog state is an object `{ revealed: FogRect[], hidden: FogRect[] }`
- DM uses fog tool to click+drag rectangles on the canvas
- `fog_update` socket event broadcasts fog state to all clients
- Players see fog rendered as semi-transparent dark rectangles

---

## 11. Character System

### Character Creation Wizard (7 Steps)
File: `artifacts/tavernos/src/pages/character-creator.tsx`

| Step | Content |
|---|---|
| 1 | Race & Subrace selection |
| 2 | Class & Subclass selection |
| 3 | Background selection |
| 4 | Ability score assignment (Standard Array: 15,14,13,12,10,8) |
| 5 | Skill proficiency selection (class-based allowance) |
| 6 | Equipment & Starting gold |
| 7 | Personality traits, ideals, bonds, flaws |

On completion (`handleComplete`), the wizard POSTs to `/api/campaigns/:cId/characters` with all data in `sheetData`.

### Skill Key Normalization
Skills are stored as snake_case keys in `sheetData.skills` (e.g. `animal_handling`, `sleight_of_hand`). The `SKILL_NAME_TO_KEY` map in character-creator.tsx converts display names to storage keys.

### Character Sheet Component
File: `artifacts/tavernos/src/components/vtt/CharacterSheet.tsx`

Displays and allows editing of:
- Basic stats (name, race, class, level, HP, AC, Speed)
- Ability scores + modifiers
- Saving throws
- Skills with proficiency checkboxes
- Attacks & Spellcasting
- Equipment
- Personality section

HP can be edited inline with +/- buttons; changes emit `hp_update` socket event.

---

## 12. Chat & Dice System

File: `artifacts/tavernos/src/components/vtt/ChatPanel.tsx`

### Chat / communications (left panel)
- **Session video** — LiveKit room stacked above chat (same session for all players).
- **Chat** — table talk only; messages with `type === 'dice'` are excluded from this stream so dice are not duplicated (they appear only on the **Rolls** tab on the right).
- **Rolls** (right sidebar tab) — dice message log, quick rolls, and skill check shortcuts (`RollsPanel`).
- **DM tools** — only in the DM Command Center drawer (`ChatPanel` `dmTools` variant).

### Dice Rolling
Uses `rpg-dice-roller` npm package for expression parsing:
```typescript
const roll = new DiceRoll('2d6+3');
roll.total  // numeric total
roll.output // formatted string e.g. "2d6+3: [4, 5]+3 = 12"
```

### Slash Commands
- `/r <expr>` or `/roll <expr>` — roll dice expression
- `/w <message>` — send a whisper (available to all users, not just DM)

### Whisper System
- **DM → Player**: DM selects a player character from the dropdown
- **Player → DM**: Player selects "🤫 Whisper → DM" from the dropdown
- Server auto-resolves DM userId when player whispers without specifying a recipient
- Message visibility filtering: DMs see all whispers; players see only their own

### Quick Roll Hotbar
Bottom bar includes quick-roll buttons for d4, d6, d8, d10, d12, d20, d100 and a custom expression input. Last roll result is displayed inline.

---

## 13. DM Command Center Drawer

### Trigger
A "⚔ DM" button in the top header bar (DM only) slides open a full-height overlay drawer from the right side of the screen.

### Drawer Contents (`ChatPanel` `dmTools` variant)
- **Initiative Manager** — drag-to-reorder initiative order
- **NPC Quick Add** — searches Open5e API (`https://api.open5e.com/v1/monsters/`) and adds NPC to initiative
- **Encounter Builder** — add creatures from Open5e to active encounter
- **Ambient Scene Triggers** — 6 preset scenes (cave drip, tavern music, battle drums, etc.) that announce to all players in chat
- **Secret Layer** — DM-private notes textarea (never sent to other clients)
- **Map Management** — create new maps (with local file upload), switch active map

### Map Switching
The DM can switch which map is displayed for all players by clicking a map in the switcher list. This calls `PUT /api/campaigns/:cId/sessions/:sId` with `{ activeMapId: mapId }`. All clients re-derive the active map from the session's `activeMapId`.

---

## 14. Initiative & Combat Tracking

### Initiative Strip (Top Bar)
File: `artifacts/tavernos/src/components/vtt/InitiativeBar.tsx`

- Horizontally scrollable list of combatant cards
- Active combatant highlighted with gold border and glow
- Round counter displayed
- DM controls: ⬅ Prev / Next ➡ buttons, Reset button

### InitiativeCombatant Type
```typescript
interface InitiativeCombatant {
  id: string;
  name: string;
  initiative: number;
  hp: number;
  maxHp: number;
  ac?: number;
  isPlayer: boolean;
  characterId?: string;
  tokenColor?: string;
}
```

### Advancing Turns
DM clicks Next/Prev → emits `initiative_advance` socket event → server increments/decrements `currentTurnIndex`, wraps round, saves to DB, broadcasts `turn_changed` to all clients → clients update their local initiative display.

### Round Tracking
When `roundNumber` increments (new round), the `turn_changed` event fires with the new `roundNumber`. The session page watches `activeSession.roundNumber` in a `useEffect` and calls `tickConditions(newRound)` to auto-expire timed conditions.

---

## 15. Condition Duration System

### State Shape
```typescript
const [activeConditions, setActiveConditions] = 
  useState<Array<{ name: string; expiresRound: number | null }>>([]);
```

### D&D 5e Conditions
Blinded, Charmed, Deafened, Exhaustion, Frightened, Grappled, Incapacitated, Invisible, Paralyzed, Petrified, Poisoned, Prone, Restrained, Stunned, Unconscious

### Toggling Conditions
```typescript
const toggleCondition = (name: string, durationRounds?: number) => { ... }
```
- Click condition button → toggle on/off with no expiry (indefinite)
- Shift+click → toggle with 1-round timer (sets `expiresRound = currentRound + 1`)
- Active conditions shown as chips in the bottom hotbar, displaying round expiry `(R5)` if timed

### Auto-Expiry
```typescript
useEffect(() => {
  const round = activeSession?.roundNumber || 1;
  if (round > prevRoundRef.current) {
    prevRoundRef.current = round;
    tickConditions(round);
  }
}, [activeSession?.roundNumber]);
```
`tickConditions` removes expired conditions and sends a system chat message for each expired condition.

---

## 16. Design System & Theming

### Color Palette (CSS Variables)
```css
--background:     #0E0B06   /* very dark brown-black */
--card:           #1A1208   /* dark parchment card */
--foreground:     #F2E8CE   /* parchment text */
--primary:        #C9A84C   /* gold */
--primary-light:  #E8CC7A   /* bright gold */
--primary-dim:    #7A6228   /* dark gold */
--secondary:      #2D1E0A   /* deep brown */
--ember:          #E07B39   /* orange-ember accent */
--magic:          #5B3FA6   /* purple magic */
--destructive:    #C0392B   /* crimson red */
--muted:          #3D2E1A   /* muted brown */
```

### Typography
- **Cinzel Decorative** — main titles, logo ("TavernOS")
- **Cinzel** — labels, buttons, tags, section headers (`font-label` class)
- **Crimson Pro** — body text, paragraphs (`font-body` class)
- All fonts loaded from Google Fonts

### Key Utility Classes
- `gold-text-glow` — CSS text-shadow for glowing gold headings
- `glass-panel` — frosted glass card effect (backdrop-filter + semi-transparent bg)
- `font-display` — Cinzel Decorative
- `font-label` — Cinzel
- `font-body` — Crimson Pro

### Shared Components
- `VttButton` — styled button with gold/ember variants
- `VttInput` — styled input with dark background and gold focus ring

---

## 17. Key Files Reference

### Backend (`artifacts/api-server/src/`)
| File | Purpose |
|---|---|
| `index.ts` | Entry point, reads PORT, starts HTTP server |
| `app.ts` | Express app setup, CORS, session, Socket.IO mount, all socket handlers |
| `routes/index.ts` | Mounts all sub-routers |
| `routes/auth.ts` | Login, /me, logout — tab identity aware |
| `routes/campaigns.ts` | Full CRUD for campaigns |
| `routes/characters.ts` | Full CRUD for characters |
| `routes/sessions.ts` | Session create/list/get/update |
| `routes/maps.ts` | Map create/list/get/delete |
| `routes/messages.ts` | Message post/list with whisper filtering |
| `middlewares/auth.ts` | requireAuth, requireCampaignMember, requireDm, tabIdentityMap, getEffectiveUserId |
| `types.ts` | Express session type augmentation, Request extensions |
| `lib/logger.ts` | Pino logger instance |

### Frontend (`artifacts/tavernos/src/`)
| File | Purpose |
|---|---|
| `App.tsx` | Router, QueryClient, tab ID registration |
| `main.tsx` | React root mount |
| `pages/login.tsx` | Username login form |
| `pages/dashboard.tsx` | Campaign list, create/join campaign |
| `pages/character-creator.tsx` | 7-step character creation wizard |
| `pages/session.tsx` | Main VTT game table (3-column layout) |
| `components/vtt/MapCanvas.tsx` | Konva.js map with tokens, fog, toolbar |
| `components/vtt/CharacterSheet.tsx` | Full D&D 5e character sheet |
| `components/vtt/InitiativeBar.tsx` | Initiative strip top bar |
| `components/vtt/ChatPanel.tsx` | Chat, dice, DM tools panel |
| `hooks/use-socket.ts` | Socket.IO connection + event wiring |
| `components/VttButton.tsx` | Shared styled button |
| `components/VttInput.tsx` | Shared styled input |

### Shared Libraries
| Package | Key Files |
|---|---|
| `lib/db` | `src/schema/*.ts` — Drizzle table definitions |
| `lib/api-spec` | `openapi.yaml` — Full API spec |
| `lib/api-client-react` | `src/generated/api.ts` — all hooks; `src/custom-fetch.ts` — fetch with tab ID |
| `lib/api-zod` | `src/generated/types.ts` — Zod schemas |

---

## 18. Running the Project

### Prerequisites
- Node.js 24+
- pnpm 9+
- PostgreSQL database (auto-provided in Replit via `DATABASE_URL`)

### Development
```bash
# Install all dependencies
pnpm install

# Push database schema
pnpm --filter @workspace/db run push

# Start API server (port 8080 by default)
pnpm --filter @workspace/api-server run dev

# Start frontend (port determined by PORT env var)
pnpm --filter @workspace/tavernos run dev

# Typecheck entire workspace
pnpm run typecheck

# Regenerate API client from openapi.yaml
pnpm --filter @workspace/api-spec run codegen
```

### Environment Variables
| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `SESSION_SECRET` | Yes (prod) | dev-only fallback | Express session secret |
| `PORT` | No | 8080 | API server port |
| `NODE_ENV` | No | development | `production` enables session hardening |
| `LIVEKIT_URL` | For video | — | WebSocket URL (e.g. `wss://….livekit.cloud`) — returned to clients with token |
| `LIVEKIT_API_KEY` | For video | — | LiveKit API key (server-only) |
| `LIVEKIT_API_SECRET` | For video | — | LiveKit API secret (server-only) |

### Production Security Notes
- `SESSION_SECRET` must be set — server exits with error if missing in `production` mode
- `cookie.secure = true` and `cookie.sameSite = 'strict'` in production
- The in-memory `tabIdentityMap` does not persist across server restarts (acceptable for the VTT use case)

---

## 19. Known Architecture Decisions & Trade-offs

### No Password Auth
Intentional simplicity for a local/private VTT tool. Username collision = same user. No JWT, no bcrypt. Easy to extend to real auth by adding a `passwordHash` field to `users`.

### In-Memory Tab Identity Map
`tabIdentityMap` lives in server process memory. A server restart clears all tab identities — users need to re-login. For a multi-process/multi-server deployment, this would need to move to Redis or the database. Acceptable for the Replit single-process environment.

### Messages Not Persisted to Socket
Chat messages are POSTed via REST to the database, then Socket.IO emits an event to trigger `queryClient.invalidateQueries()` on all clients. This means the message is always database-canonical, but adds a round-trip. The alternative (emit-only) would lose messages on page reload.

### activeConditions is Client-Local State
The condition tracker lives in React state on the session page — it is NOT synced via Socket.IO or persisted to the database. Each client tracks their own conditions. This was a deliberate scope decision; conditions can be added to the `game_sessions.settings` JSONB field and synced via socket if needed in future.

### Fog of War via Socket Only
Fog state is broadcast via socket and stored in the socket event handler's in-memory record per mapId. It is not persisted to the database between sessions. To persist fog: add a `fogData` JSONB column to the `maps` table and save on each `fog_update` event.

### Orval Code Generation
The entire API client is generated from `openapi.yaml`. Do NOT manually edit files in `lib/api-client-react/src/generated/` or `lib/api-zod/src/generated/` — they will be overwritten on the next codegen run. Change the spec, then regenerate.

---

*Document generated from the TavernOS build process. Last updated: March 2026.*
