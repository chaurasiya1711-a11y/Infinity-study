require("dotenv").config();
const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const port = Number(process.env.PORT || 3000);
const db = new Database(path.join(__dirname, "infinity-study.db"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS learners (
  id TEXT PRIMARY KEY, display_name TEXT NOT NULL DEFAULT 'Learner',
  target INTEGER NOT NULL DEFAULT 90, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, learner_id TEXT NOT NULL,
  kind TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT, learner_id TEXT NOT NULL,
  plan_date TEXT NOT NULL, subject TEXT NOT NULL, task TEXT NOT NULL,
  minutes INTEGER NOT NULL DEFAULT 30, done INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS mistakes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, learner_id TEXT NOT NULL,
  subject TEXT NOT NULL, chapter TEXT NOT NULL, question TEXT NOT NULL,
  mistake_type TEXT NOT NULL, correction TEXT NOT NULL DEFAULT '',
  confidence INTEGER NOT NULL DEFAULT 2, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);
const insertLearner = db.prepare("INSERT OR IGNORE INTO learners (id, display_name, target) VALUES (?, ?, ?)");
const getLearner = db.prepare("SELECT * FROM learners WHERE id = ?");
function ensureLearner(id, name = "Learner", target = 90) {
  insertLearner.run(id, name, target);
  return getLearner.get(id);
}
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_, res) => res.json({ ok: true, app: "Infinity Study", version: "1.0.0", aiConfigured: Boolean(process.env.AI_API_KEY) }));

app.get("/api/profile/:id", (req, res) => {
  const learner = ensureLearner(req.params.id);
  res.json(learner);
});
app.put("/api/profile/:id", (req, res) => {
  const id = String(req.params.id).slice(0, 80);
  const name = String(req.body.name || "Learner").slice(0, 80);
  const target = Math.min(100, Math.max(1, Number(req.body.target || 90)));
  ensureLearner(id, name, target);
  db.prepare("UPDATE learners SET display_name=?, target=? WHERE id=?").run(name, target, id);
  res.json(getLearner.get(id));
});
app.get("/api/events/:id", (req, res) => {
  ensureLearner(req.params.id);
  const rows = db.prepare("SELECT * FROM events WHERE learner_id=? ORDER BY id DESC LIMIT 300").all(req.params.id);
  res.json(rows.map(r => ({...r, payload: JSON.parse(r.payload)})));
});
app.post("/api/events/:id", (req, res) => {
  const id = String(req.params.id).slice(0, 80);
  ensureLearner(id);
  const kind = String(req.body.kind || "activity").slice(0, 60);
  const payload = JSON.stringify(req.body.payload || {});
  db.prepare("INSERT INTO events (learner_id, kind, payload) VALUES (?, ?, ?)").run(id, kind, payload);
  res.json({ ok: true });
});
app.get("/api/plans/:id", (req, res) => {
  ensureLearner(req.params.id);
  res.json(db.prepare("SELECT * FROM plans WHERE learner_id=? ORDER BY plan_date, id").all(req.params.id));
});
app.post("/api/plans/:id", (req, res) => {
  const id = String(req.params.id).slice(0, 80);
  ensureLearner(id);
  const date = String(req.body.plan_date || new Date().toISOString().slice(0,10)).slice(0,10);
  const subject = String(req.body.subject || "Science").slice(0, 40);
  const task = String(req.body.task || "Revision").slice(0, 240);
  const minutes = Math.min(240, Math.max(5, Number(req.body.minutes || 30)));
  const result = db.prepare("INSERT INTO plans (learner_id, plan_date, subject, task, minutes) VALUES (?, ?, ?, ?, ?)").run(id, date, subject, task, minutes);
  res.json({ id: result.lastInsertRowid });
});
app.patch("/api/plans/:id/:planId", (req, res) => {
  const done = req.body.done ? 1 : 0;
  const result = db.prepare("UPDATE plans SET done=? WHERE id=? AND learner_id=?").run(done, Number(req.params.planId), req.params.id);
  res.json({ ok: result.changes > 0 });
});
app.delete("/api/plans/:id/:planId", (req, res) => {
  const result = db.prepare("DELETE FROM plans WHERE id=? AND learner_id=?").run(Number(req.params.planId), req.params.id);
  res.json({ ok: result.changes > 0 });
});
app.get("/api/mistakes/:id", (req, res) => {
  ensureLearner(req.params.id);
  res.json(db.prepare("SELECT * FROM mistakes WHERE learner_id=? ORDER BY id DESC LIMIT 200").all(req.params.id));
});
app.post("/api/mistakes/:id", (req, res) => {
  const id = String(req.params.id).slice(0, 80);
  ensureLearner(id);
  const b = req.body || {};
  const result = db.prepare(`INSERT INTO mistakes (learner_id, subject, chapter, question, mistake_type, correction, confidence)
  VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, String(b.subject||"Maths").slice(0,40), String(b.chapter||"General").slice(0,100), String(b.question||"").slice(0,1000), String(b.mistake_type||"Concept gap").slice(0,60), String(b.correction||"").slice(0,1500), Math.min(5,Math.max(1,Number(b.confidence||2))));
  res.json({ id: result.lastInsertRowid });
});
app.delete("/api/mistakes/:id/:mistakeId", (req, res) => {
  const result = db.prepare("DELETE FROM mistakes WHERE id=? AND learner_id=?").run(Number(req.params.mistakeId), req.params.id);
  res.json({ ok: result.changes > 0 });
});

// Real AI is enabled only when a server-side key is configured. Without it, the UI
// provides transparent local study prompts instead of pretending to be an AI model.
app.post("/api/ai/tutor", async (req, res) => {
  const { question, subject = "General", chapter = "General", mode = "teach" } = req.body || {};
  if (!question || !String(question).trim()) return res.status(400).json({ error: "Add a question first." });
  if (!process.env.AI_API_KEY) {
    return res.status(503).json({
      error: "AI is not configured yet.",
      fallback: `Study prompt for ${subject} — ${chapter}: ${String(question).trim()}\n\nTry this method:\n1. Identify exactly what the question asks.\n2. Write the relevant concept, formula, or definition.\n3. Solve one step at a time and check units/keywords.\n4. Verify the final answer against the question.\n\nFor a real AI explanation, add AI_API_KEY to your server environment and restart the app.`
    });
  }
  try {
    const base = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.AI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "gpt-4o-mini",
        temperature: 0.35,
        messages: [
          { role: "system", content: "You are Infinity Study, a patient Class 10 CBSE tutor. Teach in clear student-friendly English or Hinglish as appropriate. Never invent syllabus facts. Explain step by step, check assumptions, and ask a short follow-up question when useful. For homework, teach the method rather than only giving an unexplained answer. Mode: " + mode },
          { role: "user", content: `Subject: ${subject}\nChapter: ${chapter}\nQuestion: ${question}` }
        ]
      })
    });
    const data = await response.json();
    if (!response.ok) return res.status(502).json({ error: data.error?.message || "AI provider request failed." });
    res.json({ answer: data.choices?.[0]?.message?.content || "No answer returned." });
  } catch (e) {
    res.status(502).json({ error: "Could not reach the AI provider. Check server network/configuration." });
  }
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(port, () => console.log(`Infinity Study running at http://localhost:${port}`));
