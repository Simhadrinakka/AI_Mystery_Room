# AI Mystery Room

Create fictional detective cases from a scenario, inspect evidence, and submit one accusation.

## Setup

1. Install Node.js 20+, npm, and MongoDB (local or Atlas).
2. Run `npm install` at the repository root.
3. Run `npm install` in `server` and `client`.
4. Copy `.env.example` to `server/.env` and configure MongoDB, JWT, and Gemini credentials.
5. Create `client/.env` with `VITE_API_URL=http://localhost:5000/api/v1`.
6. Run `npm run seed:demo` in the root for a no-key demo case.
7. Run `npm run dev` and open http://localhost:5173.

Gemini model IDs are configurable through `GEMINI_TEXT_MODEL` and `GEMINI_IMAGE_MODEL`. Generated image files are stored under `server/uploads` in development. Cases, people, and evidence are AI-generated fiction.
