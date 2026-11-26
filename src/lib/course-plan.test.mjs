// node src/lib/course-plan.test.mjs
import { parsePrereq } from './prereq.ts'
import { autoPlace, checkPlan, nextTerm, termsAfter, rollForward, planKey, displayCode, planCredits } from './course-plan.ts'

let failed = 0
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ok   ${name}`)
  else {
    failed++
    console.log(`  FAIL ${name} ${detail}`)
  }
}

check('Fall -> Winter of next year', nextTerm('Fall 2026') === 'Winter 2027')
check('Winter -> Summer', nextTerm('Winter 2027') === 'Summer 2027')
check('Summer -> Fall', nextTerm('Summer 2027') === 'Fall 2027')
check('unknown term -> null', nextTerm('Sometime') === null)
check('termsAfter', termsAfter('Fall 2026', 4).join('|') === 'Winter 2027|Summer 2027|Fall 2027|Winter 2028')
check('planKey', planKey('comm 225') === 'COMM225' && planKey('COMP-248') === 'COMP248')
check('displayCode', displayCode('COMM225') === 'COMM 225' && displayCode('MBA642') === 'MBA 642')

const c = (code, credits = 3) => ({ code, title: code, credits })
const pre = new Map([
  ['COMM225', parsePrereq('Prerequisite: COMM 215.', 'COMM 225')],
  ['COMM308', parsePrereq('The following course must be completed previously: COMM 217. The following course must be completed previously or concurrently: COMM 220.', 'COMM 308')],
  ['COMM401', parsePrereq('Prerequisite: 60 credits.', 'COMM 401')],
])
const base = { completed: new Set(['COMM210']), inProgress: new Set(['COMM215']), credits: 30, inProgressCredits: 15 }
const v = (plan, i, code) => checkPlan(plan, base, pre).get(`${i}:${planKey(code)}`)

{
  const plan = { terms: [{ term: 'Winter 2027', courses: [c('COMM 225')] }] }
  check('a course you are taking now counts as done by then', v(plan, 0, 'COMM 225').verdict === 'ok')
}
{
  const plan = { terms: [{ term: 'Winter 2027', courses: [c('COMM 308')] }, { term: 'Summer 2027', courses: [c('COMM 217')] }] }
  const r = v(plan, 0, 'COMM 308')
  check('prerequisite planned later is flagged', r.verdict === 'missing' && /planned later, in Summer 2027/.test(r.message), r.message)
  check('the fix names the course', r.fixes.includes('COMM 217'))
}
{
  const plan = { terms: [{ term: 'Winter 2027', courses: [c('COMM 217'), c('COMM 308')] }] }
  const r = v(plan, 0, 'COMM 308')
  check('same term does not satisfy a plain prerequisite', r.verdict === 'missing' && /same term/.test(r.message), r.message)
}
{
  const plan = {
    terms: [
      { term: 'Winter 2027', courses: [c('COMM 217')] },
      { term: 'Summer 2027', work: true, courses: [] },
      { term: 'Fall 2027', courses: [c('COMM 220'), c('COMM 308')] },
    ],
  }
  check('earlier term + concurrent in the same term is fine', v(plan, 2, 'COMM 308').verdict === 'ok', v(plan, 2, 'COMM 308').message)
}
{
  const plan = { terms: [{ term: 'Winter 2027', courses: [c('COMM 401')] }] }
  check('credit floor not reached', v(plan, 0, 'COMM 401').verdict === 'missing' && /60 credits/.test(v(plan, 0, 'COMM 401').message))
  const later = { terms: [{ term: 'Winter 2027', courses: [c('A 1', 15)] }, { term: 'Summer 2027', courses: [c('COMM 401')] }] }
  check('credit floor reached through the plan', v(later, 1, 'COMM 401').verdict === 'ok')
}
{
  const plan = { terms: [{ term: 'Winter 2027', courses: [c('COMM 210'), c('COMM 215'), c('XYZ 100')] }, { term: 'Summer 2027', courses: [c('XYZ 100')] }] }
  check('already finished', v(plan, 0, 'COMM 210').verdict === 'repeat')
  check('taking it now', v(plan, 0, 'COMM 215').verdict === 'repeat')
  check('planned twice: the later one is flagged', v(plan, 1, 'XYZ 100').verdict === 'repeat' && v(plan, 0, 'XYZ 100').verdict === 'ok')
  check('plan credits', planCredits(plan) === 12)
}
{
  const old = { terms: [{ term: 'Fall 2026', courses: [c('OLD 1')] }, { term: 'Winter 2027', courses: [c('KEEP 1')] }, { term: 'Fall 2028', work: true, courses: [] }] }
  const r = rollForward(old, 'Fall 2026')
  check('past terms drop off', r.terms[0].term === 'Winter 2027' && r.terms[0].courses[0].code === 'KEEP 1')
  check('reaches as far as the furthest planned term', r.terms.at(-1).term === 'Fall 2028' && r.terms.at(-1).work === true)
  check('an empty plan gets four terms', rollForward({ terms: [] }, 'Fall 2026').terms.length === 4)
}

{
  const plan = { terms: [{ term: 'Winter 2027', courses: [] }, { term: 'Summer 2027', work: true, courses: [] }, { term: 'Fall 2027', courses: [] }] }
  const r = autoPlace(plan, [c('COMM 308'), c('COMM 217'), c('COMM 220'), c('COMM 225'), c('COMM 401')], base, pre)
  const at = (code) => r.placed.find((x) => x.course.code === code)?.index
  check('prerequisite goes first', at('COMM 217') === 0)
  check('dependent course waits a term and skips the work term', at('COMM 308') === 2, String(at('COMM 308')))
  check('concurrent one can share its term', at('COMM 220') <= 2)
  check('a course whose need is in progress goes in the first term', at('COMM 225') === 0)
  check('credit floor: 45 + 9 in Winter = 54, under 60 by Fall, so it is left', r.left.some((x) => x.code === 'COMM 401'), JSON.stringify(r))
  const full = autoPlace({ terms: [{ term: 'Winter 2027', courses: [c('A 1', 12)] }] }, [c('B 1'), c('B 2')], base, pre)
  check('respects the credit cap', full.placed.length === 1 && full.left.length === 1)
  check('does not re-add what is planned or done', autoPlace({ terms: [{ term: 'Winter 2027', courses: [c('B 1')] }] }, [c('B 1'), c('COMM 210')], base, pre).placed.length === 0)
}

if (failed) {
  console.log(`\n${failed} failed`)
  process.exit(1)
}
console.log('\nall passed')
