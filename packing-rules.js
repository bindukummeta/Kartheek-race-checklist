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

const CIRCUITS = [
  { id: "rowrah", name: "Rowrah" },
  { id: "whilton", name: "Whilton Mill" },
  { id: "pfi", name: "PF International" },
  { id: "clay", name: "Clay Pigeon" },
  { id: "shenington", name: "Shenington" },
  { id: "other", name: "Other / not listed" },
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
      { name: "T-shirts", qty: "days+1", conditions: ["hot", "sunny", "mixed"] },
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
    items: [
      { name: "Night shorts", qty: "days", conditions: ["hot", "sunny", "mixed"] },
      { name: "Night shirts", qty: 2, conditions: ["all"] },
      { name: "Warm pyjamas", qty: 1, conditions: ["cold", "rainy"] },
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

// Resolve a qty rule against the number of days.
function resolveQty(qty, days) {
  if (typeof qty === "number") return qty;
  if (qty === "days") return days;
  if (qty === "days+1") return days + 1;
  if (qty === "days-1") return Math.max(1, days - 1);
  return 1;
}

// Build the final list for a given weather + days.
function buildChecklist(weather, days) {
  const result = [];
  for (const group of PACKING_RULES) {
    const items = group.items
      .filter((it) => it.conditions.includes("all") || it.conditions.includes(weather))
      .map((it) => ({ name: it.name, count: resolveQty(it.qty, days) }));
    if (items.length) result.push({ category: group.category, items });
  }
  return result;
}
