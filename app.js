(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = "racepack.state.v1";

  const circuitSel = $("circuit");
  const daysInput = $("days");
  const fromInput = $("from");
  const toInput = $("to");
  const weatherSel = $("weather");
  const generateBtn = $("generate");
  const forecastBtn = $("use-forecast");
  const forecastStatus = $("forecast-status");

  const formCard = $("form-card");
  const resultCard = $("result-card");
  const checklistEl = $("checklist");
  const resultTitle = $("result-title");
  const resultMeta = $("result-meta");
  const progressBadge = $("progress-badge");
  const allPackedEl = $("all-packed");

  // Populate circuit dropdown from packing-rules.js
  CIRCUITS.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    circuitSel.appendChild(opt);
  });

  // Keep the day count in sync as soon as dates are chosen. With both dates set
  // it uses the inclusive range; with only "From" it assumes a single day.
  function syncDaysFromDates() {
    if (fromInput.value && toInput.value) {
      const from = new Date(fromInput.value);
      const to = new Date(toInput.value);
      const diff = Math.round((to - from) / 86400000) + 1; // inclusive
      if (diff >= 1) daysInput.value = diff;
    } else if (fromInput.value) {
      daysInput.value = 1;
    }
  }
  fromInput.addEventListener("change", syncDaysFromDates);
  toInput.addEventListener("change", syncDaysFromDates);
  fromInput.addEventListener("input", syncDaysFromDates);
  toInput.addEventListener("input", syncDaysFromDates);

  function currentSelections() {
    return {
      circuit: circuitSel.value,
      days: Math.max(1, parseInt(daysInput.value, 10) || 1),
      from: fromInput.value,
      to: toInput.value,
      weather: weatherSel.value,
    };
  }

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (_) {
      return {};
    }
  }
  function saveState(patch) {
    const next = Object.assign(loadState(), patch);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function keyFor(sel, category, name) {
    return [sel.circuit, sel.weather, sel.days, category, name].join("|");
  }

  // Collapse a section once every item in it is ticked; expand it otherwise.
  function updateSection(section) {
    const boxes = section.querySelectorAll('input[type="checkbox"]');
    const allDone = boxes.length && [...boxes].every((b) => b.checked);
    section.classList.toggle("complete", !!allDone);
    if (allDone) section.classList.add("collapsed");
    else section.classList.remove("collapsed");
  }

  function updateProgress() {
    const boxes = checklistEl.querySelectorAll('input[type="checkbox"]');
    if (!boxes.length) {
      progressBadge.textContent = "0%";
      allPackedEl.classList.add("hidden");
      return;
    }
    const done = [...boxes].filter((b) => b.checked).length;
    const pct = Math.round((done / boxes.length) * 100);
    progressBadge.textContent = pct + "%";
    allPackedEl.classList.toggle("hidden", pct !== 100);
  }

  function renderChecklist(sel) {
    const groups = buildChecklist(sel.weather, sel.days);
    const ticks = loadState().ticks || {};
    checklistEl.innerHTML = "";

    groups.forEach((group) => {
      const section = document.createElement("div");
      section.className = "checklist-group";
      const h = document.createElement("h3");
      h.textContent = group.category;
      // Tap a heading to collapse/expand its section manually.
      h.addEventListener("click", () => section.classList.toggle("collapsed"));
      section.appendChild(h);

      const rows = document.createElement("div");
      rows.className = "group-rows";
      section.appendChild(rows);

      group.items.forEach((item) => {
        const id = keyFor(sel, group.category, item.name);
        const row = document.createElement("label");
        row.className = "check-row";
        const box = document.createElement("input");
        box.type = "checkbox";
        box.checked = !!ticks[id];
        box.addEventListener("change", () => {
          const t = loadState().ticks || {};
          t[id] = box.checked;
          saveState({ ticks: t });
          row.classList.toggle("done", box.checked);
          updateSection(section);
          updateProgress();
        });
        if (box.checked) row.classList.add("done");
        const text = document.createElement("span");
        text.className = "check-text";
        text.textContent = item.name;
        const qty = document.createElement("span");
        qty.className = "check-qty";
        qty.textContent = "×" + item.count;
        row.append(box, text, qty);
        rows.appendChild(row);
      });
      checklistEl.appendChild(section);
      updateSection(section);
    });

    const circuitName = (CIRCUITS.find((c) => c.id === sel.circuit) || {}).name || "Trip";
    resultTitle.textContent = circuitName + " — " + sel.days + (sel.days > 1 ? " days" : " day");
    resultMeta.textContent = WEATHER_LABELS[sel.weather] || sel.weather;
    updateProgress();
  }

  function showResults(sel) {
    formCard.classList.add("hidden");
    resultCard.classList.remove("hidden");
    renderChecklist(sel);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Fetch the forecast for the selected circuit + dates, then set the weather
  // dropdown to the toughest day. Falls back to manual on any failure.
  async function autoWeather() {
    const circuit = CIRCUITS.find((c) => c.id === circuitSel.value);
    if (!circuit || circuit.lat == null) {
      forecastStatus.textContent = "Pick a listed circuit to use the forecast.";
      return;
    }
    if (!fromInput.value) {
      forecastStatus.textContent = "Pick a 'From' date first.";
      return;
    }
    const start = fromInput.value;
    const end = toInput.value || start;
    forecastStatus.textContent = "Checking the forecast…";
    forecastBtn.disabled = true;
    try {
      const url =
        "https://api.open-meteo.com/v1/forecast" +
        "?latitude=" + circuit.lat + "&longitude=" + circuit.lon +
        "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,sunshine_duration" +
        "&timezone=auto&start_date=" + start + "&end_date=" + end;
      const res = await fetch(url);
      if (!res.ok) throw new Error("bad response");
      const data = await res.json();
      const d = data.daily;
      if (!d || !d.time || !d.time.length) throw new Error("no forecast");
      const cats = d.time.map((_, i) =>
        classifyDay(
          d.temperature_2m_max[i],
          d.precipitation_sum[i],
          (d.sunshine_duration[i] || 0) / 3600
        )
      );
      const worst = worstWeather(cats);
      weatherSel.value = worst;
      const low = Math.round(Math.min.apply(null, d.temperature_2m_min));
      const high = Math.round(Math.max.apply(null, d.temperature_2m_max));
      forecastStatus.textContent =
        "Forecast: " + low + "–" + high + " °C → set weather to " +
        (WEATHER_LABELS[worst] || worst) + " (change it if you like).";
    } catch (_) {
      forecastStatus.textContent =
        "Couldn't get the forecast (offline or date too far ahead) — pick weather manually.";
    } finally {
      forecastBtn.disabled = false;
    }
  }
  forecastBtn.addEventListener("click", autoWeather);

  generateBtn.addEventListener("click", () => {
    const sel = currentSelections();
    saveState({ last: sel });
    showResults(sel);
  });

  $("edit").addEventListener("click", () => {
    resultCard.classList.add("hidden");
    formCard.classList.remove("hidden");
  });

  $("reset-ticks").addEventListener("click", () => {
    saveState({ ticks: {} });
    showResults(loadState().last || currentSelections());
  });

  // Restore last trip on open.
  const saved = loadState().last;
  if (saved) {
    circuitSel.value = saved.circuit || CIRCUITS[0].id;
    daysInput.value = saved.days || 2;
    if (saved.from) fromInput.value = saved.from;
    if (saved.to) toInput.value = saved.to;
    weatherSel.value = saved.weather || "sunny";
    showResults(saved);
  }
})();
