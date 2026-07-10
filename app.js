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

  const formCard = $("form-card");
  const resultCard = $("result-card");
  const checklistEl = $("checklist");
  const resultTitle = $("result-title");
  const resultMeta = $("result-meta");
  const progressBadge = $("progress-badge");

  // Populate circuit dropdown from packing-rules.js
  CIRCUITS.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    circuitSel.appendChild(opt);
  });

  // Keep the day count in sync when dates are chosen.
  function syncDaysFromDates() {
    if (fromInput.value && toInput.value) {
      const from = new Date(fromInput.value);
      const to = new Date(toInput.value);
      const diff = Math.round((to - from) / 86400000) + 1; // inclusive
      if (diff >= 1) daysInput.value = diff;
    }
  }
  fromInput.addEventListener("change", syncDaysFromDates);
  toInput.addEventListener("change", syncDaysFromDates);

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

  function updateProgress() {
    const boxes = checklistEl.querySelectorAll('input[type="checkbox"]');
    if (!boxes.length) {
      progressBadge.textContent = "0%";
      return;
    }
    const done = [...boxes].filter((b) => b.checked).length;
    progressBadge.textContent = Math.round((done / boxes.length) * 100) + "%";
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
      section.appendChild(h);

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
        section.appendChild(row);
      });
      checklistEl.appendChild(section);
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
