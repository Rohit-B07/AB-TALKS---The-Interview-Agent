# ABTalks — AI Interview Agent

Practice adaptive AI engineering interviews. A candidate profile is picked from
the landing page, an interview session is created, and the AI interviewer asks
questions based on the candidate's learning journey.

- **Phase 1** ships a fully working interview flow with deterministic mock
  questions, sessions, and a polished UI.
- **Phase 2** activates Gemini-backed planning, questioning, evaluation, and
  memory. Every AI call has a deterministic fallback, so an interview never
  crashes during an API outage.

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

The interviewer runs on Google Gemini. Without a key the app still works: every
Gemini call degrades to a deterministic, curriculum-aware fallback so the
interview continues (with the question source tracked internally as `fallback`).

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

## How the adaptive interview works

Each candidate answer flows through four AI services:

1. **Planner** decides the next step (new topic, follow-up, harder, or clarify),
   aiming for at least 4 distinct curriculum days across the interview.
2. **Question generator** turns the decision into a concrete, never-repeated
   question grounded in the candidate's curriculum and prior answers.
3. **Answer evaluator** scores the answer (1-5), extracts strengths and gaps,
   and recommends a difficulty direction.
4. **Memory** is updated after every answer (coverage, strengths, gaps, one-step
   difficulty progression, stage) and fed back into the next planning pass.

The interview completes after 8 questions spanning at least 4 curriculum days.
Every service validates Gemini's structured output, retries once with a
correction prompt, and falls back to a deterministic rule set if the model is
unavailable or returns garbage.

## Architecture

```
app/                  Next.js App Router (pages + API routes)
components/           React UI (landing, interview console)
lib/                  Shared client/server helpers
  ai/                 Gemini client, retries, error mapping, logging
  config.ts           Environment config + validation
prompts/              Phase 2 prompt templates
server/
  ai/                 AI services (planner, question generator, evaluator,
                      memory) + deterministic fallbacks
  api/                Request handling for the REST endpoints
  engine/             Interview engine factory + Gemini engine orchestration
  errors/             Domain errors + error codes
  schemas/            Zod schemas (single source of truth)
  services/           Business logic (candidates, curriculum, sessions, interviews)
  store/              In-memory session store
```

## Project Structure

- `data/curriculum.json` — 31-day AI engineering curriculum.
- `data/candidates.json` — mock candidate learning journeys.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
