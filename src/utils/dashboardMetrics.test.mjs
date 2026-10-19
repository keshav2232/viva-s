import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboardMetrics, sessionTime, validScore } from './dashboardMetrics.mjs';

test('zero is a valid score, missing and out-of-range scores are not', () => {
  assert.equal(validScore(0), true);
  for (const value of [null, undefined, '', '80', NaN, Infinity, -1, 101]) assert.equal(validScore(value), false);
  const data = buildDashboardMetrics([{ score: 0 }, { score: 100 }, { score: null }, { score: 90, reportData: { endedEarly: true } }]);
  assert.equal(data.average, 50);
  assert.equal(data.completed.length, 3);
  assert.equal(data.scored.length, 2);
});

test('orders exact timestamps and charts the latest six completed scores chronologically', () => {
  const records = Array.from({ length: 8 }, (_, i) => ({ id: i, score: i * 10, createdAt: `2026-10-19T${String(i + 10).padStart(2, '0')}:00:00Z` }));
  const data = buildDashboardMetrics(records);
  assert.deepEqual(data.ordered.map(s => s.id), [7, 6, 5, 4, 3, 2, 1, 0]);
  assert.deepEqual(data.recent.map(s => s.id), [2, 3, 4, 5, 6, 7]);
  assert.equal(data.change, 10);
  assert.equal(sessionTime({ createdAt: 0 }), 0);
});

test('keeps roles and academic subjects separate and suggests lowest recorded average', () => {
  const data = buildDashboardMetrics([
    { subject: 'Design', mode: 'academic', score: 90 },
    { subject: 'Design', mode: 'professional', score: 30 },
    { subject: 'Design', mode: 'professional', score: 50 },
  ]);
  assert.equal(data.areas.length, 2);
  assert.equal(data.focus.mode, 'professional');
  assert.equal(data.focus.average, 40);
  assert.equal(data.academic, 1);
  assert.equal(data.professional, 2);
});

test('empty and unscored histories never invent a score or trend', () => {
  for (const input of [undefined, null, [], [null, 'invalid', []]]) {
    const data = buildDashboardMetrics(input);
    assert.equal(data.average, null);
    assert.equal(data.change, null);
    assert.equal(data.focus, null);
  }
  const data = buildDashboardMetrics([{ subject: 'Biology', date: 'invalid' }]);
  assert.equal(data.areas[0].average, null);
  assert.equal(sessionTime(data.ordered[0]), null);
});
