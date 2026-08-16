import { gradeToPercent } from "./grade";
const GRADE_SCALE = [
  { min: 90, letter: "A+", points: 4.3 },
  { min: 85, letter: "A", points: 4 },
  { min: 80, letter: "A-", points: 3.7 },
  { min: 77, letter: "B+", points: 3.3 },
  { min: 73, letter: "B", points: 3 },
  { min: 70, letter: "B-", points: 2.7 },
  { min: 67, letter: "C+", points: 2.3 },
  { min: 63, letter: "C", points: 2 },
  { min: 60, letter: "C-", points: 1.7 },
  { min: 57, letter: "D+", points: 1.3 },
  { min: 53, letter: "D", points: 1 },
  { min: 50, letter: "D-", points: 0.7 },
  { min: 0, letter: "F", points: 0 }
];
function letterToPercent(raw) {
  const key = raw.trim().toUpperCase().replace(/\s+/g, "");
  const band = GRADE_SCALE.find((b) => b.letter === key);
  return band ? band.min : null;
}
const GRADE_LETTERS = GRADE_SCALE.map((b) => b.letter);
function parseFinalGrade(raw) {
  const text = raw.trim();
  if (!text) return null;
  const n = Number(text.replace(/%$/, ""));
  if (!Number.isNaN(n)) return n >= 0 && n <= 100 ? n : null;
  return letterToPercent(text);
}
function percentToGrade(percent) {
  const band = GRADE_SCALE.find((b) => percent >= b.min) ?? GRADE_SCALE.at(-1);
  return { letter: band.letter, points: band.points };
}
const GRADE_TARGETS = GRADE_SCALE.filter(
  (b) => b.points > 0
).map((b) => ({ letter: b.letter, min: b.min }));
function gradeTerms(assessments) {
  const byKind = /* @__PURE__ */ new Map();
  for (const a of assessments) {
    const percent = gradeToPercent(a.grade);
    if (percent === null) continue;
    const acc = byKind.get(a.kind) ?? { weight: 0, points: 0 };
    acc.weight += a.weight;
    acc.points += percent * a.weight / 100;
    byKind.set(a.kind, acc);
  }
  return [...byKind.entries()].map(([kind, v]) => ({ kind, weight: v.weight, percent: v.points / v.weight * 100 })).sort((a, b) => b.weight - a.weight);
}
function weightedAverage(terms) {
  const totalWeight = terms.reduce((sum, t) => sum + t.weight, 0);
  if (totalWeight === 0) return null;
  const earned = terms.reduce((sum, t) => sum + t.weight * t.percent, 0);
  return earned / totalWeight;
}
function coursePercent(assessments) {
  return weightedAverage(gradeTerms(assessments));
}
function courseFinalPercent(course, assessments) {
  if (course.archived && typeof course.finalPercent === "number") return course.finalPercent;
  return coursePercent(assessments.filter((a) => a.courseId === course.id));
}
function currentGpa(courses, assessments) {
  let credits = 0;
  let points = 0;
  for (const course of courses) {
    const percent = courseFinalPercent(course, assessments);
    if (percent === null) continue;
    credits += course.credits;
    points += percentToGrade(percent).points * course.credits;
  }
  if (credits === 0) return null;
  return points / credits;
}
function termRecords(courses, assessments, sortTerms) {
  const byTerm = /* @__PURE__ */ new Map();
  for (const c of courses) {
    const list = byTerm.get(c.term) ?? [];
    list.push(c);
    byTerm.set(c.term, list);
  }
  return sortTerms([...byTerm.keys()]).map((term) => {
    const list = byTerm.get(term) ?? [];
    let credits = 0;
    for (const c of list) {
      if (courseFinalPercent(c, assessments) !== null) credits += c.credits;
    }
    return { term, courses: list, gpa: currentGpa(list, assessments), credits };
  });
}
function courseStanding(assessments) {
  let gradedWeight = 0;
  let earnedPoints = 0;
  let totalWeight = 0;
  for (const a of assessments) {
    totalWeight += a.weight;
    const percent = gradeToPercent(a.grade);
    if (percent !== null) {
      gradedWeight += a.weight;
      earnedPoints += percent * a.weight / 100;
    }
  }
  return {
    currentPercent: gradedWeight === 0 ? null : earnedPoints / gradedWeight * 100,
    gradedWeight,
    remainingWeight: totalWeight - gradedWeight,
    totalWeight,
    earnedPoints
  };
}
function gradeNeeded(assessments, targetPercent) {
  const { earnedPoints, remainingWeight, totalWeight } = courseStanding(assessments);
  if (remainingWeight <= 0) return { kind: "no-remaining" };
  const needed = (targetPercent / 100 * totalWeight - earnedPoints) / (remainingWeight / 100);
  if (needed <= 0) return { kind: "secured" };
  if (needed > 100) return { kind: "unreachable", percent: needed };
  return { kind: "needed", percent: needed, remainingWeight };
}
function projectedCoursePercent(assessments, assumedRemaining) {
  const { earnedPoints, remainingWeight, totalWeight } = courseStanding(assessments);
  if (totalWeight === 0) return null;
  return (earnedPoints + assumedRemaining / 100 * remainingWeight) / totalWeight * 100;
}
function projectedGpa(courses, assessments, overrideCourseId, overridePercent) {
  let credits = 0;
  let points = 0;
  for (const course of courses) {
    const percent = course.id === overrideCourseId ? overridePercent : coursePercent(assessments.filter((a) => a.courseId === course.id));
    if (percent === null) continue;
    credits += course.credits;
    points += percentToGrade(percent).points * course.credits;
  }
  if (credits === 0) return null;
  return points / credits;
}
export {
  GRADE_LETTERS,
  GRADE_TARGETS,
  courseFinalPercent,
  coursePercent,
  courseStanding,
  currentGpa,
  gradeNeeded,
  gradeTerms,
  letterToPercent,
  parseFinalGrade,
  percentToGrade,
  projectedCoursePercent,
  projectedGpa,
  termRecords,
  weightedAverage
};
