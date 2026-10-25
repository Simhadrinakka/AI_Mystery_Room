# AI Mystery Room: Product & Technical Specification

**Version:** 1.0  |  **Status:** Source of truth for implementation  |  **Audience:** Codex (AI coding agent) and human reviewers

> **Instruction to Codex:** This document is the single source of truth. Implement exactly what is written here. If something is ambiguous, choose the simplest option consistent with this spec, record the decision in `/docs/DECISIONS.md`, and continue. Do not add features listed under Non-Goals. Build in the milestone order given in Section 17.

---

## 1. Project Overview

**AI Mystery Room** is a web app where a user types a short scenario or story seed (for example: *"A jewel disappeared from a wedding party at a hilltop villa"*). The backend uses Google Gemini to invent a complete fictional investigation: a cast of suspects, a hidden culprit, a timeline, and a set of fabricated evidence (WhatsApp-style chats, images, CCTV footage, and more). The user reviews the evidence like a detective, then accuses one suspect. The app reveals whether they were right, explains the full solution, and shows a score.

**Core promise:** every case is unique, solvable from the evidence alone, and generated from the user's own idea.

## 2. Goals and Non-Goals

### Goals

- Generate a coherent, **solvable** mystery from a short user prompt.
- Present evidence in realistic, immersive formats (chat UI, image gallery, CCTV viewer, documents).
- Let the user select a culprit and receive a verdict with explanation.
- Keep the culprit **secret on the server** until the user submits an accusation.
- Be buildable by an AI agent from this spec alone.

### Non-Goals (do NOT build in v1)

- Multiplayer or real-time collaboration.
- Payments, subscriptions, or paywalls.
- Native mobile apps (web must be responsive, that is enough).
- Real video generation (see Section 8.4; CCTV is simulated with image frames).
- User-uploaded evidence.
- Social sharing feeds or public case marketplace.
- Admin dashboard.

## 3. Tech Stack (fixed)

| Layer | Choice |
| --- | --- |
| Frontend | React 18 + Vite, React Router v6, Tailwind CSS, Zustand (state), Axios |
| Backend | Node.js 20 + Express 4 |
| Database | MongoDB (Atlas or local) with Mongoose 8 |
| AI | Google Gemini via official `@google/genai` SDK (text + image generation) |
| Auth | JWT (access token in httpOnly cookie), bcrypt for passwords |
| Validation | Zod (both server request validation and Gemini output validation) |
| Image storage | Local disk `/server/uploads` in dev; abstracted behind a `StorageService` so S3/Cloudinary can be swapped in later |
| Testing | Vitest (client), Jest + Supertest (server) |
| Language | JavaScript (ES modules) with JSDoc types. TypeScript is optional; do not mix. |

**Gemini models must be configurable by env var, never hardcoded:** `GEMINI_TEXT_MODEL` and `GEMINI_IMAGE_MODEL`. Default the text model to a current Gemini Flash-class model and the image model to a current Gemini image-generation model. Verify the exact model IDs in the official Gemini docs at implementation time.

## 4. User Roles

- **Guest:** can view landing page and a pre-seeded demo case (read-only play, no saving).
- **Registered user:** can generate cases, play them, view history and scores.

## 5. Core User Flow

1. User lands on **Home** and reads how it works.
2. User signs up or logs in.
3. On **New Case**, user enters a scenario (20 to 600 characters) and optionally picks difficulty (Easy / Medium / Hard) and tone (Realistic / Noir / Cozy / Thriller).
4. Backend creates a case with status `generating`. The UI shows a progress screen that polls for status.
5. When status becomes `ready`, user enters the **Case Room**.
6. User reads the briefing, meets the suspects, and opens evidence items.
7. User can write notes and pin evidence to a **Detective Board** (simple list of pinned items with notes).
8. User opens the **Accuse** dialog, picks one suspect, and writes a short reasoning (required, 10 to 500 chars).
9. Backend evaluates the accusation and returns the **Verdict**: correct or wrong, the true culprit, motive, method, a timeline, and which clues were decisive.
10. User sees score and can start a new case.

## 6. Case Generation Pipeline (backend, most important section)

Generation is a **multi-stage pipeline**, not a single prompt. Each stage's output is validated with Zod before the next stage runs. On validation failure, retry that stage up to 2 times with the validation error appended to the prompt. After retries fail, mark the case `failed` with an error message.

### Stage 1: Case Bible (text, JSON)

Input: user scenario, difficulty, tone. Output (the secret ground truth):

```json
{
  "title": "string",
  "setting": { "location": "string", "date": "YYYY-MM-DD", "summary": "string" },
  "incident": { "type": "theft|murder|sabotage|disappearance|fraud|other", "description": "string", "occurredAt": "ISO datetime" },
  "suspects": [
    { "id": "s1", "name": "string", "age": 0, "role": "string", "relationToVictim": "string",
      "publicBio": "string", "secret": "string", "alibi": "string", "alibiIsTrue": true,
      "appearancePrompt": "string describing looks for image generation" }
  ],
  "culprit": { "suspectId": "s1", "motive": "string", "method": "string", "mistakes": ["string"] },
  "timeline": [ { "time": "ISO datetime", "event": "string", "suspectIds": ["s1"], "isPublic": true } ],
  "redHerrings": [ { "suspectId": "s2", "description": "string" } ]
}
```

**Rules the prompt must enforce:**

- Exactly 4 suspects (Easy), 5 (Medium), 6 (Hard). All fictional. **No real people, brands-as-defendants, or celebrities.**
- Exactly one culprit.
- The culprit must have at least 2 `mistakes` that can be shown through evidence.
- Every non-culprit suspect needs a plausible motive or suspicious behavior (a red herring) that is later explained away.
- Content must be PG-13: no graphic violence, no sexual content. Murder is allowed but non-graphic.
- The case must be solvable by deduction from evidence only.

### Stage 2: Evidence Plan (text, JSON)

Input: the Case Bible. Output: a list of evidence items to produce. Counts by difficulty:

| Difficulty | Chat threads | Images | CCTV clips | Other docs | Total |
| --- | --- | --- | --- | --- | --- |
| Easy | 2 | 2 | 1 | 1 | 6 |
| Medium | 3 | 3 | 2 | 2 | 10 |
| Hard | 4 | 4 | 2 | 3 | 13 |

Each plan item: `{ id, type, title, purpose, supportsSuspectIds, incriminates (suspectId|null), isRedHerring (bool), timestamp, clueRevealed }`.

**Solvability constraint:** at least 2 items must directly contradict the culprit's alibi or reveal one of their `mistakes`. No single item should name the culprit outright (except Easy difficulty, where one strong item is allowed).

### Stage 3: Evidence Generation (per item, in parallel with concurrency limit of 3)

See Section 8 for each evidence type's format.

### Stage 4: Consistency Check (text, JSON)

Send the Case Bible plus all generated evidence text. Ask Gemini to return `{ consistent: bool, issues: [string] }`. If inconsistent, regenerate only the offending items once. If still inconsistent, accept and log a warning.

### Stage 5: Finalize

Split the data into **public** and **secret** parts (Section 9), save, set status `ready`.

**Progress reporting:** update `case.generationProgress` (`{ stage, percent, message }`) after every stage so the client can poll.

## 7. Gemini Integration Requirements

- All Gemini calls go through one module: `server/src/services/gemini.service.js`. No other file imports the SDK.
- Text calls use **structured JSON output** (response MIME type `application/json` with a schema where supported) and are validated with Zod.
- Set a per-call timeout of 60 seconds and 2 retries with exponential backoff (1s, 3s).
- Image calls are wrapped in `generateImage(prompt, { aspectRatio })` returning a Buffer.
- If image generation fails after retries, fall back to a **placeholder SVG** with the evidence caption, and set `item.imageFallback = true`. Never block the whole case on one image.
- Keep all prompts in `server/src/prompts/*.js` as exported functions, one file per stage. Prompts must be unit-testable pure functions.
- Log token usage and latency per call (console in dev).
- Moderate the user's scenario first: a short Gemini classification call returning `{ allowed: bool, reason }`. Reject scenarios involving real named people, sexual content, minors in danger, self-harm, hate, or instructions for real crimes. Return HTTP 422 with a friendly message.

## 8. Evidence Types

All evidence shares a base shape:

```json
{ "id": "e1", "type": "chat|image|cctv|document", "title": "string", "description": "string",
  "timestamp": "ISO datetime", "discovered": false, "payload": { } }
```

### 8.1 Chat (WhatsApp-style)

Payload:

```json
{ "platform": "whatsapp", "participants": [{ "suspectId": "s1", "displayName": "string" }],
  "isGroup": false,
  "messages": [ { "sender": "s1", "text": "string", "time": "ISO datetime", "status": "read", "deleted": false, "edited": false } ] }
```

- 12 to 30 messages per thread, natural informal language, realistic timestamps, occasional typos, emojis, and "This message was deleted" entries where useful as clues.
- UI: render as a chat bubble view (green outgoing, white incoming, grey background, date separators, ticks). It must look like a messaging app but **must not use WhatsApp logos or trademarked assets**; label it generically as "Chat Log" in the header.

### 8.2 Image

Payload: `{ "imageUrl": "string", "caption": "string", "prompt": "string", "exifLike": { "takenAt": "ISO", "location": "string" }, "imageFallback": false }`

- Generated with Gemini image model. Prompts must request a realistic photo style, **no readable text that matters to the clue** (AI text rendering is unreliable), and **no real people or faces of public figures**.
- Clue details must be expressed visually (an object out of place, a muddy shoe, an open window) and also stated in the hidden `clueRevealed` field for the verdict.
- UI: gallery grid with lightbox, zoom, and a metadata panel (time and place).

### 8.3 Document

Payload: `{ "kind": "receipt|email|note|log|report", "markdown": "string" }`

- Rendered as a styled paper-like card. Sanitize markdown on render.

### 8.4 CCTV Footage (simulated)

Real video generation is out of scope. A "clip" is a **timed sequence of 4 to 8 generated still frames** with a timestamp overlay, played back like a surveillance recording.

Payload:

```json
{ "cameraName": "string", "location": "string",
  "frames": [ { "imageUrl": "string", "timestamp": "ISO datetime", "caption": "string", "prompt": "string" } ],
  "frameDurationMs": 1500 }
```

- Frame prompts must request grainy, low-resolution, high-angle, black-and-white or desaturated CCTV style, with consistent location across frames.
- UI: a `CctvPlayer` component with play/pause, scrub bar, frame timestamp overlay (monospace, top-left), "REC" blinking dot, camera name, and a scanline CSS effect.
- **Stretch (not in v1):** swap frames for Gemini/Veo video when available.

## 9. Data Model (Mongoose)

### User

`{ _id, name, email (unique, lowercase), passwordHash, createdAt }`

### Case

```js
{
  _id, userId (ref User, indexed),
  scenarioInput: String, difficulty: 'easy'|'medium'|'hard', tone: String,
  status: 'generating'|'ready'|'failed'|'solved'|'abandoned',
  generationProgress: { stage: String, percent: Number, message: String },
  errorMessage: String,

  // PUBLIC (safe to send to client)
  title: String,
  briefing: String,                 // narrative intro
  setting: { location, date, summary },
  incidentSummary: String,          // what happened, without revealing who
  suspects: [{ id, name, age, role, relationToVictim, publicBio, statedAlibi, avatarUrl }],
  evidence: [Evidence],             // public payloads only

  // SECRET (select: false on every field, never serialized to client before verdict)
  solution: {
    culpritSuspectId, motive, method, mistakes: [String],
    fullTimeline: [...], redHerrings: [...],
    evidenceClueMap: [{ evidenceId, clueRevealed, incriminates, isRedHerring }],
    suspectSecrets: [{ suspectId, secret, alibiIsTrue }]
  },

  // PLAYER STATE
  notes: String,
  pinnedEvidenceIds: [String],
  viewedEvidenceIds: [String],
  hintsUsed: Number,
  accusation: { suspectId, reasoning, submittedAt, isCorrect, score },

  createdAt, updatedAt
}
```

**Critical security rule:** `solution` must be defined with `select: false`. A response serializer (`toPublicCase()`) must whitelist public fields. Add a Jest test that fails if any API response before verdict contains the string of `solution.culpritSuspectId` outside the suspect list context or any `solution` key.

### Indexes

`Case: { userId: 1, createdAt: -1 }`, `User: { email: 1 } unique`.

## 10. REST API

Base path `/api/v1`. All responses JSON. Errors use `{ error: { code, message, details? } }`. Auth routes set an httpOnly, SameSite=Lax cookie.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/register` | no | Create user |
| POST | `/auth/login` | no | Login |
| POST | `/auth/logout` | yes | Clear cookie |
| GET | `/auth/me` | yes | Current user |
| POST | `/cases` | yes | Body `{ scenario, difficulty, tone }`. Moderates, creates case with status `generating`, starts pipeline asynchronously, returns `{ caseId }` (HTTP 202) |
| GET | `/cases` | yes | List user's cases (id, title, status, difficulty, createdAt, score) |
| GET | `/cases/:id` | yes | Public case view. If `generating`, returns progress only |
| GET | `/cases/:id/status` | yes | `{ status, generationProgress, errorMessage }` for polling |
| PATCH | `/cases/:id/notes` | yes | Save notes and pinned evidence |
| POST | `/cases/:id/evidence/:evidenceId/view` | yes | Mark viewed |
| POST | `/cases/:id/hint` | yes | Returns one progressive hint (max 3). Hints are generated from `solution` without naming the culprit |
| POST | `/cases/:id/accuse` | yes | Body `{ suspectId, reasoning }`. One accusation per case. Returns verdict |
| POST | `/cases/:id/regenerate` | yes | Retry a `failed` case |
| DELETE | `/cases/:id` | yes | Delete case and its images |
| GET | `/demo-case` | no | Pre-seeded demo case (public view) |
| GET | `/health` | no | Health check |

**Verdict response:**

```json
{ "isCorrect": true, "culprit": { "suspectId": "s1", "name": "string" },
  "motive": "string", "method": "string", "timeline": [], "decisiveEvidence": [{ "evidenceId": "e3", "explanation": "string" }],
  "redHerringExplanations": [], "reasoningFeedback": "string", "score": 0 }
```

`reasoningFeedback` is a short Gemini-generated critique comparing the player's reasoning to the real solution (2 to 4 sentences, constructive).

### Rate limits and validation

- `POST /cases`: max 5 per user per hour, max 1 concurrent `generating` case per user.
- Auth routes: 10 requests per 15 minutes per IP.
- Global: 100 requests per minute per IP. Use `express-rate-limit`, `helmet`, `cors` (allow only `CLIENT_URL`), `express-mongo-sanitize`.
- Validate every body and param with Zod.

## 11. Scoring

- Correct accusation: **base 100**.
- Wrong accusation: **0** base, but the full solution is still revealed.
- Modifiers (only if correct): minus 10 per hint used (min 0 from hints); plus 20 for Hard, plus 10 for Medium; plus up to 20 based on percentage of decisive evidence viewed before accusing (viewed decisive / total decisive times 20, rounded).
- Final score is an integer clamped between 0 and 150. Compute **server-side only**.

## 12. Frontend Specification

### Routes

| Path | Page | Auth |
| --- | --- | --- |
| `/` | Landing (hero, how it works, demo CTA) | no |
| `/login`, `/register` | Auth forms | no |
| `/new` | New Case form | yes |
| `/cases` | My Cases history | yes |
| `/cases/:id/generating` | Progress screen (poll status every 2s) | yes |
| `/cases/:id` | Case Room | yes |
| `/cases/:id/verdict` | Verdict page | yes |
| `/demo` | Demo case room (read-only) | no |
| `*` | 404 | no |

### Case Room layout (desktop)

- **Left sidebar:** case title, briefing (collapsible), suspect cards, hint button.
- **Center:** evidence viewer (renders the selected evidence by type).
- **Right sidebar:** evidence list (grouped by type with icons and a viewed checkmark), detective notes textarea (autosave debounced 800 ms), pinned items.
- **Bottom bar:** large "Make Accusation" button.
- Mobile: tabbed layout (Briefing, Evidence, Suspects, Notes).

### Key components

`EvidenceList`, `EvidenceViewer`, `ChatLogViewer`, `ImageGallery`, `CctvPlayer`, `DocumentCard`, `SuspectCard`, `AccuseModal` (select suspect, reasoning textarea, confirm step warning that this is final), `HintButton`, `NotesPanel`, `GenerationProgress`, `VerdictReveal` (animated reveal), `ScoreCard`, `ProtectedRoute`, `Toast`, `Loader`.

### UX requirements

- Dark "detective office" theme as default (deep charcoal, amber accent, subtle paper textures); readable contrast (WCAG AA).
- Loading skeletons for all fetches; friendly error states with retry.
- The progress screen shows stage names ("Inventing suspects", "Planting clues", "Developing photos", "Reviewing CCTV") with a progress bar.
- Keyboard accessible dialogs, alt text on all images (use caption).
- State: Zustand stores `authStore`, `caseStore`. API layer in `client/src/api/*.js` using a single Axios instance with `withCredentials: true`.

## 13. Project Structure

```
ai-mystery-room/
  client/
    src/ api/ components/ pages/ store/ hooks/ utils/ styles/ App.jsx main.jsx
  server/
    src/
      config/ (env.js, db.js)
      models/ (User.js, Case.js)
      routes/ (auth.routes.js, case.routes.js, demo.routes.js)
      controllers/
      middleware/ (auth.js, validate.js, errorHandler.js, rateLimit.js)
      services/ (gemini.service.js, caseGenerator.service.js, scoring.service.js, storage.service.js, moderation.service.js)
      prompts/ (bible.prompt.js, evidencePlan.prompt.js, chat.prompt.js, image.prompt.js, cctv.prompt.js, document.prompt.js, consistency.prompt.js, hint.prompt.js, verdict.prompt.js)
      schemas/ (zod schemas for every Gemini output and API body)
      utils/ (serializers.js, asyncHandler.js, logger.js)
      app.js server.js
    uploads/
    tests/
  docs/ (DECISIONS.md)
  .env.example
  README.md
  package.json (root scripts: dev, build, test)
```

## 14. Environment Variables

```
# server/.env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/ai-mystery-room
JWT_SECRET=change-me
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
GEMINI_API_KEY=
GEMINI_TEXT_MODEL=
GEMINI_IMAGE_MODEL=
IMAGE_CONCURRENCY=3
MAX_CASES_PER_HOUR=5

# client/.env
VITE_API_URL=http://localhost:5000/api/v1
```

The Gemini API key must **never** reach the client or be committed. Provide `.env.example` with empty values.

## 15. Non-Functional Requirements

- **Performance:** Easy case generation target under 90 seconds, Hard under 180 seconds. UI never blocks on generation.
- **Reliability:** Pipeline is resumable by stage. If the server restarts mid-generation, a startup job marks stale `generating` cases (older than 10 minutes) as `failed`.
- **Security:** passwords hashed with bcrypt (cost 12), httpOnly cookies, input sanitization, sanitized markdown rendering, no secrets in logs, solution never leaked.
- **Safety:** moderation on input (Section 7); all content fictional; add a footer disclaimer: "All cases, people, and evidence are AI-generated fiction."
- **Accessibility:** semantic HTML, focus management in modals, color contrast AA.
- **Observability:** structured logs per pipeline stage with caseId.

## 16. Testing and Acceptance Criteria

### Required tests

- Zod schema tests with valid and invalid Gemini outputs.
- Pipeline test with a **mocked Gemini service** (a `MockGemini` fixture returning canned JSON) covering success, retry, and failure paths.
- API tests: auth, create case, status polling, accuse (correct and wrong), one-accusation rule, rate limiting.
- **Leak test:** public case endpoints never include `solution`.
- Scoring service unit tests.
- Client: component tests for `ChatLogViewer`, `CctvPlayer`, `AccuseModal`.

### Definition of done (v1)

1. A new user can register, submit a scenario, and see a progress screen.
2. A case reaches `ready` with the evidence counts listed in Section 6.
3. All four evidence types render correctly in the viewer.
4. The user can accuse once and sees a correct verdict, solution, and score.
5. Inspecting any network response before verdict reveals no culprit information.
6. App works on a 375 px wide screen.
7. `npm run dev` starts client and server; `npm test` passes; README explains setup in under 10 steps.
8. A seeded demo case works without a Gemini key (`npm run seed:demo`).

## 17. Build Order (milestones)

1. **Scaffold:** monorepo, Express app, Vite app, Mongo connection, env validation, health route, lint and prettier.
2. **Auth:** models, routes, JWT cookie, `ProtectedRoute`, login and register pages.
3. **Gemini service and moderation:** text JSON calls, retry, timeout, `MockGemini`, Zod schemas.
4. **Pipeline stages 1 and 2:** Case Bible and Evidence Plan with tests.
5. **Evidence generation:** chat, document, image, CCTV, with storage service and placeholder fallback.
6. **Consistency check, finalize, serializer, leak test.**
7. **Case APIs:** create, status, get, notes, view, hint.
8. **Frontend generation flow:** New Case form, progress screen.
9. **Case Room UI:** layout, all viewers, notes, pinning.
10. **Accusation and verdict:** API, scoring, `AccuseModal`, `VerdictReveal`.
11. **History, demo case, landing page, polish, responsive pass.**
12. **Docs and hardening:** README, rate limits, error states, final test pass.

## 18. Prompt Design Guidelines for Codex

- Every prompt states: role ("You are a mystery novelist and forensic consultant"), the exact JSON schema, hard rules (count limits, PG-13, fictional only), and "Return only valid JSON, no markdown fences."
- Pass the Case Bible as context to every later stage so names, times, and facts stay consistent.
- Use ISO datetimes everywhere and keep the timeline in a single timezone (`Asia/Kolkata` by default, configurable).
- Chat prompts must give each suspect a distinct voice (formality, slang, emoji use) taken from their bio.
- Image prompts must be self-contained (include setting, lighting, camera angle, style) because image calls have no memory.
- Keep character appearance consistent by reusing each suspect's `appearancePrompt` verbatim in any image that includes them. Do not render faces in close-up for CCTV.

## 19. Open Questions (Codex: use the stated default, do not stop to ask)

| Question | Default |
| --- | --- |
| Language of cases | English only in v1 |
| Social login | Not in v1; email and password only |
| Case sharing | Not in v1 |
| Image hosting in production | Local disk behind `StorageService` |
| Regenerate individual evidence | Not in v1 |

## 20. Glossary

- **Case Bible:** the hidden full truth of the mystery.
- **Evidence item:** one piece of fabricated proof shown to the player.
- **Red herring:** evidence or behavior that points to an innocent suspect.
- **Public case:** the sanitized view sent to the client.
- **Verdict:** the post-accusation reveal of the full solution.
