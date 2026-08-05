// Dev-only tests, not shipped with the site. Run with: node --test tests/

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hhmmToMin,
  offsetInShift,
  buildSegments,
  SHIFT_MINUTES,
} from "../js/roster.js";

const DAY = { start: "0600", end: "1800" };
const NIGHT = { start: "1800", end: "0600" };

test("offsetInShift handles the midnight wrap for the night shift", () => {
  assert.equal(offsetInShift("1800", NIGHT), 0);
  assert.equal(offsetInShift("2300", NIGHT), 300);
  assert.equal(offsetInShift("0000", NIGHT), 360);
  assert.equal(offsetInShift("0600", NIGHT), 720);
});

test("offsetInShift handles the day shift with no wrap", () => {
  assert.equal(offsetInShift("0600", DAY), 0);
  assert.equal(offsetInShift("1800", DAY), 720);
});

test("buildSegments tiles the full 720 minutes with no rows (fully uncovered)", () => {
  const segs = buildSegments([], NIGHT);
  const total = segs.reduce((sum, s) => sum + (s.end - s.start), 0);
  assert.equal(total, SHIFT_MINUTES);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].uncovered, true);
});

test("buildSegments tiles to 720 for a full-shift single assignment", () => {
  const segs = buildSegments(
    [{ member: "T. O'Neil", start: "1800", end: "0600" }],
    NIGHT
  );
  const total = segs.reduce((sum, s) => sum + (s.end - s.start), 0);
  assert.equal(total, SHIFT_MINUTES);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].uncovered, undefined);
});

test("buildSegments handles a three-way split with a trailing uncovered gap", () => {
  const rows = [
    { member: "T. O'Neil", start: "1800", end: "2300" },
    { member: "N. Ibarra", start: "2300", end: "0000" },
    { member: "S. Delgado", start: "0000", end: "0500" },
  ];
  const segs = buildSegments(rows, NIGHT);
  const total = segs.reduce((sum, s) => sum + (s.end - s.start), 0);
  assert.equal(total, SHIFT_MINUTES);

  assert.equal(segs.length, 4);
  assert.deepEqual(
    segs.map((s) => s.uncovered ?? false),
    [false, false, false, true]
  );

  const last = segs.at(-1);
  assert.equal(last.uncovered, true);
  assert.equal(last.start, 300 + 60 + 300);
  assert.equal(last.end, SHIFT_MINUTES);
});

test("buildSegments inserts a gap between out-of-order, non-adjacent rows", () => {
  const rows = [
    { member: "Late Start", start: "2000", end: "0600" },
  ];
  const segs = buildSegments(rows, NIGHT);
  const total = segs.reduce((sum, s) => sum + (s.end - s.start), 0);
  assert.equal(total, SHIFT_MINUTES);
  assert.equal(segs[0].uncovered, true);
  assert.equal(segs[0].start, 0);
  assert.equal(segs[0].end, offsetInShift("2000", NIGHT));
});

test("hhmmToMin accepts short forms", () => {
  assert.equal(hhmmToMin("600"), 360);
  assert.equal(hhmmToMin(600), 360);
  assert.equal(hhmmToMin("0600"), 360);
});
