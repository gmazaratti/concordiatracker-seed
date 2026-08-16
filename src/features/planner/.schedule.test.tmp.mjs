// src/features/today/widgets/meeting-times.ts
var DAY_TOKENS = {
  sun: 0,
  mon: 1,
  tue: 2,
  tues: 2,
  wed: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  fri: 5,
  sat: 6
};
function parseMeetingTimes(raw) {
  if (!raw?.trim()) return [];
  return raw.split(/[;\n]/).flatMap((part) => parseOnePattern(part));
}
function parseOnePattern(raw) {
  const m = raw.trim().match(/^(.*?)\s+(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})$/);
  if (!m) return [];
  const [, dayPart, start, end] = m;
  const toMinutes2 = (t) => {
    const [h, min] = t.split(":").map(Number);
    return h * 60 + min;
  };
  return dayPart.split(/[·,/]| and /i).map((d) => DAY_TOKENS[d.trim().toLowerCase().slice(0, 5)] ?? DAY_TOKENS[d.trim().toLowerCase().slice(0, 3)]).filter((d) => d !== void 0).map((day) => ({ day, startMinutes: toMinutes2(start), start, end }));
}

// src/features/planner/schedule.ts
var toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
function placeSections(chosen) {
  const out = [];
  for (const { code, section } of chosen) {
    for (const slot of parseMeetingTimes(section.meetingTimes ?? "")) {
      out.push({ code, section, slot });
    }
  }
  return out;
}
function findConflicts(placed) {
  const out = [];
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i];
      const b = placed[j];
      if (a.slot.day !== b.slot.day) continue;
      if (a.section.classNumber === b.section.classNumber) continue;
      const aStart = toMinutes(a.slot.start);
      const aEnd = toMinutes(a.slot.end);
      const bStart = toMinutes(b.slot.start);
      const bEnd = toMinutes(b.slot.end);
      const overlap = Math.min(aEnd, bEnd) - Math.max(aStart, bStart);
      if (overlap > 0) out.push({ a, b, day: a.slot.day, minutes: overlap });
    }
  }
  return out;
}
function findCampusGaps(placed, minMinutes = 45) {
  const out = [];
  const byDay = /* @__PURE__ */ new Map();
  for (const p of placed) byDay.set(p.slot.day, [...byDay.get(p.slot.day) ?? [], p]);
  for (const [day, items] of byDay) {
    const ordered = [...items].sort((x, y) => toMinutes(x.slot.start) - toMinutes(y.slot.start));
    for (let i = 0; i < ordered.length - 1; i++) {
      const from = ordered[i];
      const to = ordered[i + 1];
      const a = from.section.location?.trim();
      const b = to.section.location?.trim();
      if (!a || !b || a === b) continue;
      const gap = toMinutes(to.slot.start) - toMinutes(from.slot.end);
      if (gap >= 0 && gap < minMinutes) out.push({ from, to, day, minutes: gap });
    }
  }
  return out;
}
function gridBounds(placed) {
  if (placed.length === 0) return { start: 8 * 60, end: 18 * 60 };
  let start = Infinity;
  let end = -Infinity;
  for (const p of placed) {
    start = Math.min(start, toMinutes(p.slot.start));
    end = Math.max(end, toMinutes(p.slot.end));
  }
  return { start: Math.floor(start / 60) * 60, end: Math.ceil(end / 60) * 60 };
}
function weeklyHours(placed) {
  const minutes = placed.reduce(
    (sum, p) => sum + (toMinutes(p.slot.end) - toMinutes(p.slot.start)),
    0
  );
  return Math.round(minutes / 60 * 10) / 10;
}
function daysOff(placed) {
  const used = new Set(placed.map((p) => p.slot.day));
  return [1, 2, 3, 4, 5].filter((d) => !used.has(d));
}
function clashesWithBlocks(meetingTimes, blocks) {
  const slots = parseMeetingTimes(meetingTimes ?? "");
  if (slots.length === 0) return [];
  const hit = [];
  for (const b of blocks) {
    const bStart = toMinutes(b.start);
    const bEnd = toMinutes(b.end);
    for (const slot of slots) {
      if (slot.day !== b.day) continue;
      const overlap = Math.min(toMinutes(slot.end), bEnd) - Math.max(toMinutes(slot.start), bStart);
      if (overlap > 0 && !hit.includes(b)) hit.push(b);
    }
  }
  return hit;
}
export {
  clashesWithBlocks,
  daysOff,
  findCampusGaps,
  findConflicts,
  gridBounds,
  placeSections,
  toMinutes,
  weeklyHours
};
