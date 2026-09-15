// src/features/courses/duplicate-assessments.ts
function normalizeTitle(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

// src/lib/moodle-match.ts
var MOODLE_VERBS = /\s+(is\s+due|due|opens?|closes?|has\s+closed|is\s+open|submission\s+deadline|deadline)\s*$/i;
var CODE = /\b([A-Za-z]{3,4})[\s-]?(\d{3}[A-Za-z]?)\b/g;
function stripMoodleTitle(summary) {
  let s = summary.replace(CODE, " ");
  let before = "";
  while (before !== s) {
    before = s;
    s = s.replace(MOODLE_VERBS, "");
  }
  return s.replace(/\s+/g, " ").trim();
}
function codesIn(text) {
  const out = [];
  for (const m of text.matchAll(CODE)) out.push(`${m[1].toUpperCase()} ${m[2].toUpperCase()}`);
  return out;
}
function titlesMatch(a, b) {
  const x = normalizeTitle(a);
  const y = normalizeTitle(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length < 8 || !/\d/.test(short)) return false;
  return long.includes(short);
}
function sameLocalDay(a, b) {
  const x = new Date(a);
  const y = new Date(b);
  if (Number.isNaN(x.getTime()) || Number.isNaN(y.getTime())) return false;
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}
function findMoodleMismatches(tasks, assessments, courses) {
  const moodle = tasks.filter((t) => t.source === "moodle" && t.due);
  if (moodle.length === 0) return [];
  const byCode = /* @__PURE__ */ new Map();
  for (const c of courses) {
    for (const code of codesIn(c.code)) byCode.set(code, c.id);
  }
  const out = [];
  const claimed = /* @__PURE__ */ new Set();
  for (const task of moodle) {
    const hay = `${task.title} ${task.note ?? ""}`;
    const courseId = codesIn(hay).map((code) => byCode.get(code)).find(Boolean);
    if (!courseId) continue;
    const core = stripMoodleTitle(task.title);
    if (!core) continue;
    for (const a of assessments) {
      if (a.courseId !== courseId || !a.due || claimed.has(a.id)) continue;
      if (!titlesMatch(core, a.title)) continue;
      if (sameLocalDay(a.due, task.due)) continue;
      claimed.add(a.id);
      out.push({
        assessmentId: a.id,
        courseId,
        title: a.title,
        yourDue: a.due,
        moodleDue: task.due,
        viaTitle: task.title
      });
      break;
    }
  }
  return out;
}
export {
  codesIn,
  findMoodleMismatches,
  stripMoodleTitle,
  titlesMatch
};
