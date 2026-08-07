# ABTalks — AI Interview Agent

Practice adaptive AI engineering interviews. A candidate profile is picked from
the landing page, an interview session is created, and the AI interviewer asks
questions based on the candidate's learning journey.

- **Phase 1** ships a fully working interview flow with deterministic mock
  questions, sessions, and a polished UI.
- **Phase 2** swaps the mock engine for Gemini-backed planning, questioning,
  evaluation, and memory (the AI layer is prepared but not yet active).

## Getting Started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Available Scripts

| Command            | Description                       |
| ------------------ | --------------------------------- |
| `npm run dev`      | Start the development server      |
| `npm run build`    | Create a production build         |
| `npm run start`    | Run the production server         |
| `npm run lint`     | Lint the codebase                 |
| `npm run typecheck`| Type-check with `tsc --noEmit`    |
| `npm test`         | Run the vitest test suite         |

## AI Setup

Phase 1 does not require any AI configuration. Before Phase 2 runs, add your
Google Gemini API key:

1. Copy the environment template:

   ```bash
   cp .env.example .env.local
   ```

2. Open `.env.local` and add your key:

   ```
   GEMINI_API_KEY=YOUR_KEY
   ```

   Get a free key at <https://aistudio.google.com/apikey>.

3. Restart the development server:

   ```bash
   npm run dev
   ```

No other setup is required. The app reads the key, validates it, and prepares
the Gemini client lazily. Optional tuning knobs live in `.env.example`
(`GEMINI_MODEL`, `AI_TIMEOUT_MS`, `AI_MAX_RETRIES`, `AI_DEBUG`).

## Architecture

```
app/                  Next.js App Router (pages + API routes)
components/           React UI (landing, interview console)
lib/                  Shared client/server helpers
  ai/                 Gemini client, retries, error mapping, logging
  config.ts           Environment config + validation
prompts/              Phase 2 prompt templates (placeholders)
server/
  ai/                 Phase 2 AI service classes (placeholders)
  api/                Request handling for the REST endpoints
  engine/             Mock interview engine (Phase 2 swap point)
  errors/             Domain errors + error codes
  schemas/            Zod schemas (single source of truth)
  services/           Business logic (candidates, curriculum, sessions)
  store/              In-memory session store
```

## Project Structure

- `data/curriculum.json` — 31-day AI engineering curriculum.
- `data/candidates.json` — mock candidate learning journeys.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
