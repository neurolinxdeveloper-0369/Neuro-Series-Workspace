import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SwitchCommandState } from '../dist/utils/switch-command-state.js';

function harness(context, send = async () => ({})) {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const states = new Map([[1, false], [2, false]]);
  const errors = [];
  const requests = [];
  const controller = new SwitchCommandState({ 1: false, 2: false }, {
    send: (channel, state) => { requests.push([channel, state]); return send(channel, state); },
    display: (channel, state) => states.set(channel, state),
    fail: (channel, reason) => errors.push([channel, reason]),
  });
  context.after(() => controller.dispose());
  return { controller, states, errors, requests };
}

test('HTTP acceptance alone never confirms a switch; rollback occurs at three seconds', async context => {
  const { controller, states, errors } = harness(context);
  controller.toggle(1);
  assert.equal(states.get(1), true);
  await Promise.resolve();
  context.mock.timers.tick(2999);
  assert.equal(states.get(1), true);
  context.mock.timers.tick(1);
  assert.equal(states.get(1), false);
  assert.equal(errors.length, 1);
});

test('matching hardware confirmation cancels rollback only for its own channel', context => {
  const { controller, states, errors } = harness(context);
  controller.toggle(1); controller.toggle(2);
  controller.observe(2, true);
  context.mock.timers.tick(3000);
  assert.equal(states.get(1), false);
  assert.equal(states.get(2), true);
  assert.deepEqual(errors.map(([channel]) => channel), [1]);
});

test('rapid taps show the latest target immediately and serialize/coalesce transport requests', async context => {
  let resolve;
  const first = new Promise(done => { resolve = done; });
  let calls = 0;
  const { controller, states, requests, errors } = harness(context, () => ++calls === 1 ? first : Promise.resolve());
  controller.toggle(1); controller.toggle(1); controller.toggle(1);
  assert.equal(states.get(1), true);
  assert.deepEqual(requests, [[1, true]]);
  controller.observe(1, false);
  assert.equal(states.get(1), true);
  resolve(); await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(requests, [[1, true], [1, true]]);
  controller.observe(1, true);
  context.mock.timers.tick(3000);
  assert.equal(states.get(1), true);
  assert.equal(errors.length, 0);
});

test('a superseded HTTP failure cannot roll back the latest tap', async context => {
  let reject;
  let calls = 0;
  const first = new Promise((_, fail) => { reject = fail; });
  const { controller, states, requests, errors } = harness(context, () => ++calls === 1 ? first : Promise.resolve());
  controller.toggle(1); controller.toggle(1);
  reject(new Error('Old request failed')); await Promise.resolve(); await Promise.resolve();
  assert.equal(states.get(1), false);
  assert.deepEqual(requests, [[1, true], [1, false]]);
  controller.observe(1, false);
  context.mock.timers.tick(3000);
  assert.equal(errors.length, 0);
});

test('mismatched reports do not acknowledge the target and older snapshots cannot overwrite newer state', context => {
  const { controller, states, errors } = harness(context);
  controller.observe(1, false, 100);
  controller.toggle(1);
  controller.observe(1, false, 110);
  context.mock.timers.tick(3000);
  assert.equal(states.get(1), false);
  assert.equal(errors.length, 1);
  controller.observe(1, true, 120);
  controller.observe(1, false, 115);
  assert.equal(states.get(1), true);
});

test('disposal and offline cancellation clear pending watchdogs', context => {
  const { controller, states, errors } = harness(context);
  controller.toggle(1); controller.toggle(2);
  controller.cancel('Device offline');
  assert.equal(states.get(1), false);
  assert.equal(states.get(2), false);
  assert.equal(errors.length, 2);
  controller.toggle(1);
  controller.dispose();
  context.mock.timers.tick(3000);
  assert.equal(errors.length, 2);
});

test('each new tap gets its own three-second deadline and reverts to the last hardware state', async context => {
  let resolve;
  const first = new Promise(done => { resolve = done; });
  const { controller, states, requests, errors } = harness(context, () => first);
  controller.toggle(1);
  context.mock.timers.tick(2000);
  controller.toggle(1);
  controller.observe(1, true);
  assert.equal(states.get(1), false);
  context.mock.timers.tick(1000);
  assert.equal(errors.length, 0);
  context.mock.timers.tick(2000);
  assert.equal(states.get(1), true);
  assert.equal(errors.length, 1);
  resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(requests.length, 1, 'expired requests must not dispatch after the timeout');
});
