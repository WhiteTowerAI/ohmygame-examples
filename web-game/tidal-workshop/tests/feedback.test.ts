import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GainQueue, GAIN_INTERVAL, gainNumber } from '../src/feedback.ts';
import { advance, freshState } from '../src/economy.ts';

test('automatic salvage, crafting and sales all produce gain events', () => {
  const queue = new GainQueue();
  queue.production({ scrap: 8, parts: 2, coins: 16, trips: 1 });
  assert.deepEqual(queue.drain(0), [
    { resource: 'scrap', amount: 8, source: 'automatic' },
    { resource: 'parts', amount: 2, source: 'automatic' },
    { resource: 'coins', amount: 16, source: 'automatic' },
  ]);
  assert.deepEqual(queue.drain(1), []);
});
test('high-frequency gains are bounded without dropping earned amounts', () => {
  const queue = new GainQueue();
  let shown = 0, batches = 0;
  for (let now = 0; now < 10000; now += 10) {
    queue.add('scrap', 3);
    for (const gain of queue.drain(now)) { shown += gain.amount; batches++; }
  }
  for (const gain of queue.drain(10000 + GAIN_INTERVAL)) shown += gain.amount;
  assert.equal(shown, 3000);
  assert.ok(batches <= 14);
  assert.deepEqual(queue.snapshot(), []);
});
test('resource batching is independent; manual and contract gains respond sooner', () => {
  const queue = new GainQueue();
  queue.add('scrap', 1, 'manual'); queue.drain(0);
  queue.add('scrap', 1, 'manual'); queue.add('coins', 84, 'contract');
  assert.deepEqual(queue.drain(100), [{ resource: 'coins', amount: 84, source: 'contract' }]);
  assert.deepEqual(queue.drain(250), [{ resource: 'scrap', amount: 1, source: 'manual' }]);
});
test('gross production still shows when automatic machines consume inventory immediately', () => {
  const state = freshState(0); state.salvage = 1; state.presses = [null];
  const result = advance(state, 4);
  assert.equal(result.scrap, 4); assert.equal(state.scrap, 0);
  const queue = new GainQueue(); queue.production(result);
  assert.equal(queue.drain(0)[0].amount, 4);
});
test('manual output is identified, queues clear on overlays and invalid gains are ignored', () => {
  const queue = new GainQueue();
  queue.production({ scrap: 0, parts: 1, coins: 0, trips: 0 }, true);
  assert.deepEqual(queue.drain(0), [{ resource: 'parts', amount: 1, source: 'manual' }]);
  for (const amount of [0, -1, Infinity, NaN]) queue.add('scrap', amount);
  assert.deepEqual(queue.snapshot(), []);
  queue.add('parts', 1); queue.clear(); assert.deepEqual(queue.drain(1), []);
  queue.add('parts', 1); assert.equal(queue.drain(1).length, 1);
});
test('floating values keep fractional payouts and large resources readable', () => {
  assert.equal(gainNumber(1), '1'); assert.equal(gainNumber(13.6), '13.6');
  assert.equal(gainNumber(1200), '1.2K'); assert.equal(gainNumber(2400000), '2.4M');
  assert.equal(gainNumber(3000000000), '3.0B');
});
