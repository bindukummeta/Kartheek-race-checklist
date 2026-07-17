// Tests for the pure packing-rules helpers. Run: node --test
// No dependencies — uses Node's built-in test runner and assert module.
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  eveningLow, warmDayCoolEvening, coldNightRule,
  classifyDay, worstWeather, resolveQty, buildChecklist,
} = require("./packing-rules.js");

// Find a group / item quickly in a built checklist.
function group(groups, category) {
  return groups.find((g) => g.category === category);
}
function itemNames(groups, category) {
  const g = group(groups, category);
  return g ? g.items.map((i) => i.name) : [];
}
function count(groups, category, name) {
  const g = group(groups, category);
  const it = g && g.items.find((i) => i.name === name);
  return it ? it.count : undefined;
}

test("resolveQty handles fixed and day-relative rules", () => {
  assert.equal(resolveQty(2, 5), 2, "fixed number");
  assert.equal(resolveQty("days", 3), 3);
  assert.equal(resolveQty("days+1", 3), 4);
  assert.equal(resolveQty("days-1", 4), 3);
  assert.equal(resolveQty("days-2", 5), 3);
  assert.equal(resolveQty("days-2", 3), 1, "floors at 1");
  assert.equal(resolveQty("days-1", 1), 1, "floors at 1");
  assert.equal(resolveQty("unknown", 4), 1, "fallback is 1");
});

test("eveningLow: min temperature at or after 18:00", () => {
  const times = [
    "2026-07-16T17:00", "2026-07-16T18:00",
    "2026-07-16T21:00", "2026-07-16T23:00",
  ];
  assert.equal(eveningLow(times, [24, 16, 12, 10]), 10);
  assert.equal(eveningLow(["2026-07-16T09:00"], [20]), null, "no evening hours");
  assert.equal(eveningLow(null, null), null, "bad input");
  assert.equal(eveningLow(["2026-07-16T18:00"], ["x"]), null, "non-number skipped");
});

test("warmDayCoolEvening: warm day AND cool evening", () => {
  assert.equal(warmDayCoolEvening(25, 12), true);
  assert.equal(warmDayCoolEvening(24, 14), true, "boundaries: >23 and <15");
  assert.equal(warmDayCoolEvening(23, 12), false, "high not above 23");
  assert.equal(warmDayCoolEvening(25, 15), false, "evening not below 15");
  assert.equal(warmDayCoolEvening(25, null), false, "missing input");
});

test("coldNightRule: evening low below 15", () => {
  assert.equal(coldNightRule(12), true);
  assert.equal(coldNightRule(14.9), true);
  assert.equal(coldNightRule(15), false, "boundary is exclusive");
  assert.equal(coldNightRule(20), false);
  assert.equal(coldNightRule(null), false);
});

test("classifyDay maps forecast numbers to a category", () => {
  assert.equal(classifyDay(20, 5, 0), "rainy", "precip wins");
  assert.equal(classifyDay(8, 0, 0), "cold");
  assert.equal(classifyDay(25, 0, 6), "hot");
  assert.equal(classifyDay(18, 1, 2), "mixed");
  assert.equal(classifyDay(18, 0, 6), "sunny");
});

test("worstWeather picks the most demanding category", () => {
  assert.equal(worstWeather(["sunny", "rainy", "hot"]), "rainy");
  assert.equal(worstWeather(["sunny", "hot"]), "hot");
  assert.equal(worstWeather([]), "sunny", "defaults to sunny");
});

test("T-shirts are days-1 and Night shirts are days-2", () => {
  const g = buildChecklist("sunny", 4, { coldNight: false });
  assert.equal(count(g, "Clothing", "T-shirts"), 3, "days-1 of 4");
  assert.equal(count(g, "Sleep", "Night shirts"), 2, "days-2 of 4");
});

test("Balaclava is always in the essentials", () => {
  const g = buildChecklist("sunny", 2, {});
  assert.ok(itemNames(g, "Essentials (always)").includes("Balaclava"));
});

test("sleepwear: cold night -> pyjamas, mild night -> night shorts", () => {
  const cold = buildChecklist("sunny", 4, { coldNight: true });
  assert.ok(itemNames(cold, "Sleep").includes("Warm pyjamas"));
  assert.ok(!itemNames(cold, "Sleep").includes("Night shorts"));

  const mild = buildChecklist("sunny", 4, { coldNight: false });
  assert.ok(itemNames(mild, "Sleep").includes("Night shorts"));
  assert.ok(!itemNames(mild, "Sleep").includes("Warm pyjamas"));
  assert.equal(count(mild, "Sleep", "Night shorts"), 4, "night shorts are per-day");
});

test("sleepwear fallback to weather category when no forecast", () => {
  // coldNight omitted (null) -> use weather: cold/rainy => pyjamas, else shorts.
  const cold = buildChecklist("cold", 3, {});
  assert.ok(itemNames(cold, "Sleep").includes("Warm pyjamas"), "cold weather");
  const rainy = buildChecklist("rainy", 3, {});
  assert.ok(itemNames(rainy, "Sleep").includes("Warm pyjamas"), "rainy weather");
  const sunny = buildChecklist("sunny", 3, {});
  assert.ok(itemNames(sunny, "Sleep").includes("Night shorts"), "warm weather");
});

test("warmCoolEvening appends the suggestion section", () => {
  const on = buildChecklist("sunny", 2, { warmCoolEvening: true, coldNight: true });
  const last = on[on.length - 1];
  assert.equal(last.category, "Suggested for warm days / cool evenings");
  assert.deepEqual(last.items.map((i) => i.name), ["Trousers", "Shorts"]);
  assert.deepEqual(last.items.map((i) => i.count), [1, 1]);

  const off = buildChecklist("sunny", 2, { coldNight: false });
  assert.notEqual(
    off[off.length - 1].category,
    "Suggested for warm days / cool evenings"
  );
});
