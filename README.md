# Infinity Study — Ascend MVP

A responsive, modular Class 10 CBSE study platform starter. This is an actual project (frontend + backend), not a screenshot or a mockup.

## Included
- Mission Control dashboard and daily study missions
- Study Vault with chapter starter notes, concepts, formula anchors and revision checklists
- Practice Arena with mixed diagnostic questions and worked explanations
- AI Study Coach endpoint compatible with OpenAI-style chat-completions APIs
- Study planner and focus timer
- Mistake Lab with error-type tracking
- Progress analytics and JSON backup export
- Express backend, SQLite persistence for profile, plans, mistakes and activity events
- Mobile-responsive interface and installable web-app manifest

## Run locally
Requires Node.js 20+.

```bash
npm install
cp .env.example .env
npm start
```

Then open `http://localhost:3000`.

## Enable the real AI tutor
1. Obtain an API key from an AI provider that supports the OpenAI chat-completions API.
2. Put it in `.env` as `AI_API_KEY=...`.
3. Optionally set `AI_BASE_URL` and `AI_MODEL`.
4. Restart the server.

**Never put the API key in `public/app.js` or commit `.env` to source control.** If no key is set, the coach deliberately shows a transparent fallback instead of pretending a live AI response exists.

## Deploy
Deploy the Node app to a service that supports Node.js and persistent disk storage. Set environment variables in the host dashboard. SQLite requires persistent storage if you want data to survive redeploys. For a multi-user public launch, add proper authentication, rate limiting, CSRF/security headers, per-user authorization, backups, and a managed database before exposing it publicly.

## Important limitations
This is a working MVP, not a finished commercial product. It does not yet include login/account recovery, cross-device cloud sync, OCR/photo question input, a teacher dashboard, complete verified notes for every Class 10 CBSE chapter, or automatic official syllabus syncing. The included chapter notes and questions are starters. Confirm the current syllabus and chapter inclusion with the school's official CBSE materials and NCERT textbooks.

## Data
Browser-side progress is stored in localStorage. The backend also stores profiles, plans, mistakes, and event logs in SQLite. Local and server data are not yet merged into a single cross-device sync system.
