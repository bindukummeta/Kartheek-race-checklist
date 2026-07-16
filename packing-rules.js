/*
 * PACKING RULES — this is the ONLY file you need to edit to change quantities.
 *
 * Each item has a `qty` which is either:
 *   - a number            -> fixed quantity (e.g. 1 toothbrush)
 *   - "days"              -> one per day
 *   - "days+1"            -> one per day, plus a spare
 *   - "days-1"            -> one fewer than days (min 1)
 *
 * `conditions` lists which weather types the item applies to.
 * Use "all" to always include it regardless of weather.
 */

// `lat`/`lon` power the optional auto-weather lookup. "Other" has none, so it
// always falls back to manual weather selection.
const CIRCUITS = [
  { id: "rowrah", name: "Rowrah", lat: 54.5519, lon: -3.4424 },
  { id: "whilton", name: "Whilton Mill", lat: 52.276, lon: -1.0887 },
  { id: "pfi", name: "PF International", lat: 52.9856, lon: -0.6089 },
  { id: "clay", name: "Clay Pigeon", lat: 50.8236, lon: -2.555 },
  { id: "shenington", name: "Shenington", lat: 52.0814, lon: -1.4767 },
  { id: "other", name: "Other / not listed", lat: null, lon: null },
];

const WEATHER_LABELS = {
  hot: "🔥 Hot",
  sunny: "☀️ Sunny",
  mixed: "⛅ Mixed",
  rainy: "🌧️ Rainy",
  cold: "❄️ Cold",
};

// Ordered categories so the checklist reads sensibly.
const PACKING_RULES = [
  {
    category: "Clothing",
    items: [
      { name: "Shorts", qty: "days", conditions: ["hot", "sunny", "mixed"] },
      { name: "T-shirts", qty: "days-1", conditions: ["hot", "sunny", "mixed"] },
      { name: "Long-sleeve tops", qty: "days", conditions: ["cold", "rainy", "mixed"] },
      { name: "Trousers / joggers", qty: "days-1", conditions: ["cold", "rainy", "mixed"] },
      { name: "Fleece / hoodie", qty: 1, conditions: ["cold", "mixed", "rainy"] },
      { name: "Waterproof jacket", qty: 1, conditions: ["rainy", "mixed", "cold"] },
      { name: "Sun hat / cap", qty: 1, conditions: ["hot", "sunny"] },
      { name: "Beanie", qty: 1, conditions: ["cold"] },
    ],
  },
  {
    category: "Sleep",
    // Sleepwear (night shorts vs warm pyjamas) is chosen by night temperature in
    // buildChecklist; only the always-needed night shirts live here.
    items: [
      { name: "Night shirts", qty: "days-2", conditions: ["all"] },
    ],
  },
  {
    category: "Essentials (always)",
    items: [
      { name: "Underwear", qty: "days+1", conditions: ["all"] },
      { name: "Socks", qty: "days+1", conditions: ["all"] },
      { name: "Racing shirts", qty: 2, conditions: ["all"] },
      { name: "Race suit", qty: 1, conditions: ["all"] },
      { name: "Gloves", qty: 1, conditions: ["all"] },
      { name: "Balaclava", qty: 1, conditions: ["all"] },
      { name: "Trainers", qty: 1, conditions: ["all"] },
    ],
  },
  {
    category: "Toiletries",
    items: [
      { name: "Toothbrush", qty: 1, conditions: ["all"] },
      { name: "Toothpaste", qty: 1, conditions: ["all"] },
      { name: "Deodorant", qty: 1, conditions: ["all"] },
      { name: "Shower gel / shampoo", qty: 1, conditions: ["all"] },
      { name: "Sunscreen", qty: 1, conditions: ["hot", "sunny"] },
      { name: "Towel", qty: 1, conditions: ["all"] },
    ],
  },
  {
    category: "Weather extras",
    items: [
      { name: "Wellies", qty: 1, conditions: ["rainy"] },
      { name: "Umbrella", qty: 1, conditions: ["rainy", "mixed"] },
      { name: "Sunglasses", qty: 1, conditions: ["hot", "sunny"] },
      { name: "Extra water bottle", qty: 1, conditions: ["hot"] },
    ],
  },
];

// Extra items suggested when a day is warm but the evening turns cool — you want
// shorts for the day and trousers for after dark. Shown as its own section.
const WARM_COOL_SUGGESTION = {
  category: "Suggested for warm days / cool evenings",
  items: [
    { name: "Trousers", qty: 1, conditions: ["all"] },
    { name: "Shorts", qty: 1, conditions: ["all"] },
  ],
};

// Thresholds for the warm-day / cool-evening suggestion.
const WARM_DAY_HIGH_C = 23; // day high must be ABOVE this
const COOL_EVENING_LOW_C = 15; // evening low must be BELOW this
const EVENING_FROM_HOUR = 18; // "after 6 in the evening"

// Sleepwear switches to warm pyjamas when the night is below this; otherwise
// night shorts. Same 18:00+ evening low signal as the suggestion above.
const COLD_NIGHT_LOW_C = 15;

// Sleepwear options, chosen by night temperature in buildChecklist.
const NIGHT_SHORTS = { name: "Night shorts", qty: "days" };
const WARM_PYJAMAS = { name: "Warm pyjamas", qty: 1 };

// True when the night (evening low, after 6pm) is cold enough for pyjamas.
function coldNightRule(eveningLowC) {
  return typeof eveningLowC === "number" && eveningLowC < COLD_NIGHT_LOW_C;
}

// Lowest temperature at or after 18:00 across the given hourly series. `times`
// are ISO strings ("YYYY-MM-DDTHH:mm") aligned with `temps`. Returns null when
// there are no evening hours to read.
function eveningLow(times, temps) {
  if (!Array.isArray(times) || !Array.isArray(temps)) return null;
  let low = null;
  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    const temp = temps[i];
    if (typeof t !== "string" || typeof temp !== "number") continue;
    const hour = parseInt(t.slice(11, 13), 10);
    if (isNaN(hour) || hour < EVENING_FROM_HOUR) continue;
    if (low === null || temp < low) low = temp;
  }
  return low;
}

// True when the day is warm (high above 23°C) yet the evening is cool (low below
// 15°C after 6pm) — the case where you'd pack both shorts and trousers.
function warmDayCoolEvening(dayHigh, eveningLowC) {
  if (typeof dayHigh !== "number" || typeof eveningLowC !== "number") return false;
  return dayHigh > WARM_DAY_HIGH_C && eveningLowC < COOL_EVENING_LOW_C;
}

// Map a day's forecast (max temp °C, precipitation mm, sunshine hours) to one of
// our weather categories. Tweak these thresholds to taste.
function classifyDay(maxTempC, precipMm, sunshineHours) {
  if (precipMm >= 3) return "rainy";
  if (maxTempC <= 10) return "cold";
  if (maxTempC >= 23) return "hot";
  if (precipMm >= 0.5) return "mixed";
  if (sunshineHours != null && sunshineHours >= 5) return "sunny";
  return "mixed";
}

// Pick the single "worst/most demanding" category across the trip so K packs for
// the toughest day. Order: rainy > cold > hot > mixed > sunny.
function worstWeather(categories) {
  const rank = { rainy: 5, cold: 4, hot: 3, mixed: 2, sunny: 1 };
  return categories.reduce(
    (worst, c) => ((rank[c] || 0) > (rank[worst] || 0) ? c : worst),
    "sunny"
  );
}

// Resolve a qty rule against the number of days.
function resolveQty(qty, days) {
  if (typeof qty === "number") return qty;
  if (qty === "days") return days;
  if (qty === "days+1") return days + 1;
  if (qty === "days-1") return Math.max(1, days - 1);
  if (qty === "days-2") return Math.max(1, days - 2);
  return 1;
}

// Cold-weather categories used as the sleepwear fallback when no forecast ran.
const COLD_WEATHER = ["cold", "rainy"];

// Build the final list for a given weather + days.
//  - opts.coldNight       -> pyjamas instead of night shorts (true/false from the
//                            forecast; when null/undefined, fall back to weather)
//  - opts.warmCoolEvening -> appends the warm-day / cool-evening suggestion
function buildChecklist(weather, days, opts) {
  opts = opts || {};
  // Pick sleepwear by night temperature: cold night -> pyjamas, else night shorts.
  // Without a forecast signal, fall back to the weather category.
  const cold = opts.coldNight == null
    ? COLD_WEATHER.indexOf(weather) >= 0
    : !!opts.coldNight;
  const sleepwear = cold ? WARM_PYJAMAS : NIGHT_SHORTS;
  const result = [];
  for (const group of PACKING_RULES) {
    const items = group.items
      .filter((it) => it.conditions.includes("all") || it.conditions.includes(weather))
      .map((it) => ({ name: it.name, count: resolveQty(it.qty, days) }));
    if (group.category === "Sleep") {
      items.push({ name: sleepwear.name, count: resolveQty(sleepwear.qty, days) });
    }
    if (items.length) result.push({ category: group.category, items });
  }
  if (opts.warmCoolEvening) {
    result.push({
      category: WARM_COOL_SUGGESTION.category,
      items: WARM_COOL_SUGGESTION.items.map((it) => ({
        name: it.name,
        count: resolveQty(it.qty, days),
      })),
    });
  }
  return result;
}
