import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGoal } from './lib/seo-goal.mjs';

test('requires first-page evidence for both today and yesterday', () => {
  const day = (date, visible) => ({ date, allPrimaryQueriesOnFirstPage: visible });
  assert.equal(evaluateGoal([day('2026-10-10', true), day('2026-10-11', true)], '2026-10-11'), true);
  assert.equal(evaluateGoal([day('2026-10-10', true), day('2026-10-11', false)], '2026-10-11'), false);
  assert.equal(evaluateGoal([day('2026-10-09', true), day('2026-10-11', true)], '2026-10-11'), false);
  assert.equal(evaluateGoal([day('2026-10-09', true), day('2026-10-10', true)], '2026-10-11'), false);
  assert.equal(evaluateGoal([], '2026-10-11'), false);
  assert.equal(evaluateGoal([day('2026-12-31', true), day('2027-01-01', true)], '2027-01-01'), true);
});
