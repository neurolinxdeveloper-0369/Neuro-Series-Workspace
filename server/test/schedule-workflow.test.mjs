import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { dueScheduleTargets, parseScheduleTime, validateSchedule } from '../dist/modules/routines/schedule.js';
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const { routineService } = await import('../dist/modules/routines/routine.service.js');

const scheduled = {
  type: 'schedule', is_active: true, icon: 'sun', schedule_time: '07:00 AM IST', schedule_off_time: '10:00 PM IST', repeat_days: ['Fri'],
};

test('schedule runs only at its ON/OFF times on selected IST weekdays', () => {
  assert.deepEqual(dueScheduleTargets(scheduled, new Date('2026-11-20T01:30:00Z')), [true]);
  assert.deepEqual(dueScheduleTargets(scheduled, new Date('2026-11-20T01:31:00Z')), []);
  assert.deepEqual(dueScheduleTargets(scheduled, new Date('2026-11-20T16:30:00Z')), [false]);
  assert.deepEqual(dueScheduleTargets(scheduled, new Date('2026-11-21T01:30:00Z')), []);
  assert.deepEqual(dueScheduleTargets({ ...scheduled, is_active: false }, new Date('2026-11-20T01:30:00Z')), []);
});

test('overnight OFF belongs to the weekday on which the ON interval started', () => {
  const overnight = { ...scheduled, schedule_time: '22:00', schedule_off_time: '06:00' };
  assert.deepEqual(dueScheduleTargets(overnight, new Date('2026-11-20T16:30:00Z')), [true]);
  assert.deepEqual(dueScheduleTargets(overnight, new Date('2026-11-21T00:30:00Z')), [false]);
  assert.deepEqual(dueScheduleTargets(overnight, new Date('2026-11-20T00:30:00Z')), []);
});

test('scene icon choice never turns it into an automatic schedule', () => {
  assert.deepEqual(dueScheduleTargets({ ...scheduled, type: 'scene', icon: 'clock' }, new Date('2026-11-20T01:30:00Z')), []);
});

test('invalid and ambiguous times are rejected rather than wrapped into another hour', () => {
  assert.equal(parseScheduleTime('12:00 AM IST'), 0);
  assert.equal(parseScheduleTime('12:00 PM'), 720);
  assert.equal(parseScheduleTime('23:59'), 1439);
  for (const value of ['24:00', '25:00', '12:60', '00:30 AM', '13:00 PM']) assert.equal(parseScheduleTime(value), null);
  assert.ok(validateSchedule({ type: 'schedule', scheduleTime: '07:00', scheduleOffTime: '07:00' }));
  assert.ok(validateSchedule({ type: 'schedule', scheduleTime: '25:00' }));
  assert.ok(validateSchedule({ type: 'schedule', scheduleTime: '07:00', repeatDays: ['Invalid'] }));
  assert.equal(validateSchedule({ type: 'schedule', scheduleTime: '07:00', scheduleOffTime: '22:00', repeatDays: ['Fri'] }), null);
});

test('manual schedule execution is rejected without dispatching device actions', async context => {
  context.mock.method(routineService, 'getRoutineById', async () => scheduled);
  const dispatch = context.mock.method(routineService, 'dispatchActions', async () => ({ success: true }));
  await assert.rejects(routineService.executeRoutine('schedule', 'owner'), /Schedules run automatically/);
  assert.equal(dispatch.mock.calls.length, 0);
});

test('manual scene execution dispatches immediately, even with a clock icon', async context => {
  const scene = { ...scheduled, type: 'scene', icon: 'clock' };
  context.mock.method(routineService, 'getRoutineById', async () => scene);
  const dispatch = context.mock.method(routineService, 'dispatchActions', async () => ({ success: true, executedActions: 1, failedActions: 0 }));
  assert.equal((await routineService.executeRoutine('scene', 'owner')).success, true);
  assert.equal(dispatch.mock.calls.length, 1);
  assert.equal(dispatch.mock.calls[0].arguments[0], scene);
});
