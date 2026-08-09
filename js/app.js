const CATEGORY_META = [
  { key: "business", label: "Business", raw: "#3F6690" },
  { key: "health", label: "Health & Energy", raw: "#4C7C4A" },
  { key: "relationships", label: "Relationships", raw: "#A8503B" },
  { key: "innerSteadiness", label: "Inner Steadiness", raw: "#6B4A80" },
  { key: "direction", label: "Direction", raw: "#8C6A2E" },
];

const TRACKERS_KEY = "norbert_trackers";
const TRACKER_LOG_KEY = "norbert_tracker_log";
const TRACKER_HISTORY_DAYS = 7;

const CADENCE_LABEL = {
  Daily: "Daily Check-In",
  Weekly: "Weekly Refit",
  Monthly: "Monthly Read",
  Quarterly: "Quarterly Season Set",
  Annual: "Annual Blueprint",
};

init();

async function init() {
  setupTabs();
  let data;
  try {
    const res = await fetch("data/data.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    renderLoadError(err);
    return;
  }
  renderOverview(data.overview);
  renderSeason(data.season, data.quarterProof);
  renderLifeScan(data.lifeScan || []);
  renderPatterns(data.patterns || []);
  renderQuarterProof(data.quarterProof);
  renderFooter(data.generatedAt);
  initTrackers();
}

function setupTabs() {
  const buttons = document.querySelectorAll(".nav-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => {
        b.classList.remove("is-active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");

      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("is-active"));
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("is-active");
    });
  });
}

function renderLoadError(err) {
  const main = document.querySelector(".app-main");
  main.innerHTML = `<div class="card"><p class="empty-state">Couldn't load dashboard data (${escapeHtml(String(err.message || err))}). If this is a fresh deploy, the first sync may not have run yet.</p></div>`;
}

/* ---------- Overview ---------- */

function renderOverview(overview) {
  const periodEl = document.getElementById("overview-period");
  const listEl = document.getElementById("big3-list");
  const sourceEl = document.getElementById("overview-source");
  const workoutBadge = document.getElementById("badge-workout");
  const presenceBadge = document.getElementById("badge-presence");

  if (!overview || (!overview.big3 || overview.big3.length === 0) && !overview.anchors) {
    periodEl.textContent = "";
    listEl.innerHTML = `<li class="empty-state" style="list-style:none;cursor:default;">No check-ins recorded yet.</li>`;
    sourceEl.style.display = "none";
    workoutBadge.textContent = "—";
    workoutBadge.className = "badge unknown";
    presenceBadge.textContent = "—";
    presenceBadge.className = "badge unknown";
    return;
  }

  periodEl.textContent = overview.period || "";

  if (overview.big3 && overview.big3.length > 0) {
    listEl.innerHTML = "";
    overview.big3.forEach((item, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="check-box">✓</span><span class="check-text"></span>`;
      li.querySelector(".check-text").textContent = item;
      li.addEventListener("click", () => li.classList.toggle("is-checked"));
      listEl.appendChild(li);
    });
  } else {
    listEl.innerHTML = `<li class="empty-state" style="list-style:none;cursor:default;">No Big 3 recorded for the latest period.</li>`;
  }

  if (overview.sourceUrl) {
    sourceEl.href = overview.sourceUrl;
    sourceEl.style.display = "";
  } else {
    sourceEl.style.display = "none";
  }

  setAnchorBadge(workoutBadge, overview.anchors && overview.anchors.workout);
  setAnchorBadge(presenceBadge, overview.anchors && overview.anchors.presence);
}

function setAnchorBadge(el, value) {
  const map = { Held: "held", Partial: "partial", Missed: "missed" };
  const cls = map[value] || "unknown";
  el.textContent = value || "No data";
  el.className = `badge ${cls}`;
}

/* ---------- Season ---------- */

function renderSeason(season, quarterProof) {
  const annual = season && season.annual;
  const monthly = season && season.monthly;
  const weekly = season && season.weekly;

  setCascadeField("season-annual-period", annual && annual.period);
  setCascadeField("season-annual-focus", (annual && annual.focus) || "No annual focus recorded yet.");
  setCascadeField("season-annual-identity", annual && annual.identity);
  setCascadeField("season-annual-priorities", annual && annual.priorities);

  const q = quarterProof || null;
  setCascadeField("season-quarter-period", q && q.period);
  setCascadeField("season-quarter-focus", (q && q.focus) || "No quarter focus recorded yet.");
  setCascadeField("season-quarter-priorities", q && q.priorities);

  setCascadeField("season-month-period", monthly && monthly.period);
  setCascadeField("season-month-focus", (monthly && monthly.focus) || "No monthly focus recorded yet.");
  setCascadeField("season-month-adjustment", monthly && monthly.adjustment);
  setCascadeField("season-month-energy", monthly && monthly.energyGauge);

  setCascadeField("season-week-period", weekly && weekly.period);
  setCascadeField("season-week-showup", (weekly && weekly.showUpAs) || "No 'show up as' recorded yet this week.");
  setCascadeField("season-week-skill", weekly && weekly.skillPracticing);
}

function setCascadeField(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!value) {
    el.textContent = "";
    return;
  }
  el.textContent = value;
}

/* ---------- Life Scan ---------- */

function renderLifeScan(rows) {
  const wrap = document.getElementById("lifescan-chart-wrap");
  const hint = document.getElementById("lifescan-hint");

  if (!rows || rows.length === 0) {
    wrap.innerHTML = `<p class="empty-state">No Life Scan check-ins recorded yet.</p>`;
    hint.textContent = "";
    return;
  }

  const sorted = [...rows].sort((a, b) => new Date(a.date) - new Date(b.date));
  const svg = buildLineChart(sorted);
  wrap.innerHTML = "";
  wrap.appendChild(svg);

  const legend = document.createElement("div");
  legend.className = "chart-legend";
  legend.innerHTML = CATEGORY_META.map(
    (c) => `<span class="chart-legend-item"><span class="chart-legend-dot" style="background:${c.raw}"></span>${c.label}</span>`
  ).join("");
  wrap.appendChild(legend);

  hint.textContent = sorted.length < 3
    ? `Only ${sorted.length} check-in${sorted.length === 1 ? "" : "s"} so far — trend lines will fill in as more history accumulates.`
    : "";
}

function buildLineChart(rows) {
  const width = 860;
  const height = 320;
  const padL = 34;
  const padR = 16;
  const padT = 20;
  const padB = 40;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const maxVal = Math.max(5, ...rows.flatMap((r) => CATEGORY_META.map((c) => r[c.key] ?? 0)));
  const yFor = (v) => padT + innerH - (v / maxVal) * innerH;
  const xFor = (i) => rows.length === 1 ? padL + innerW / 2 : padL + (i / (rows.length - 1)) * innerW;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Life Scan areas over time");

  // gridlines
  const gridSteps = maxVal <= 5 ? 5 : Math.ceil(maxVal);
  for (let g = 0; g <= gridSteps; g++) {
    const y = yFor(g);
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", padL);
    line.setAttribute("x2", width - padR);
    line.setAttribute("y1", y);
    line.setAttribute("y2", y);
    line.setAttribute("stroke", "#E5D8BE");
    line.setAttribute("stroke-width", "1");
    svg.appendChild(line);

    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", padL - 8);
    label.setAttribute("y", y + 4);
    label.setAttribute("text-anchor", "end");
    label.setAttribute("font-size", "11");
    label.setAttribute("font-family", "IBM Plex Mono, monospace");
    label.setAttribute("fill", "#9C927E");
    label.textContent = g;
    svg.appendChild(label);
  }

  // x labels
  rows.forEach((r, i) => {
    const x = xFor(i);
    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", x);
    label.setAttribute("y", height - padB + 20);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-size", "10.5");
    label.setAttribute("font-family", "IBM Plex Mono, monospace");
    label.setAttribute("fill", "#6B6255");
    label.textContent = r.period;
    svg.appendChild(label);
  });

  // series
  CATEGORY_META.forEach((cat) => {
    const points = rows.map((r, i) => [xFor(i), yFor(r[cat.key] ?? 0), r[cat.key]]);

    if (rows.length > 1) {
      const path = document.createElementNS(svgNS, "path");
      const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", cat.raw);
      path.setAttribute("stroke-width", "2");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      svg.appendChild(path);
    }

    points.forEach(([x, y, val]) => {
      if (val === undefined || val === null) return;
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("cx", x);
      dot.setAttribute("cy", y);
      dot.setAttribute("r", "3.5");
      dot.setAttribute("fill", cat.raw);
      const title = document.createElementNS(svgNS, "title");
      title.textContent = `${cat.label}: ${val}`;
      dot.appendChild(title);
      svg.appendChild(dot);
    });
  });

  return svg;
}

/* ---------- Patterns ---------- */

function renderPatterns(patterns) {
  const el = document.getElementById("patterns-timeline");
  if (!patterns || patterns.length === 0) {
    el.innerHTML = `<p class="empty-state">No pattern notes recorded yet.</p>`;
    return;
  }

  const sorted = [...patterns].sort((a, b) => new Date(b.date) - new Date(a.date));
  el.innerHTML = sorted.map((p) => {
    const tag = CADENCE_LABEL[p.cadence] || p.cadence || "";
    const dateLabel = formatDate(p.date);
    return `
      <div class="timeline-item">
        <div class="timeline-meta">
          <span class="timeline-period">${escapeHtml(p.period || "")}</span>
          ${tag ? `<span class="timeline-tag">${escapeHtml(tag)}</span>` : ""}
          <span class="timeline-date">${dateLabel}</span>
        </div>
        <p class="timeline-note">${escapeHtml(p.note || "")}</p>
        ${p.sourceUrl ? `<a class="timeline-link" href="${p.sourceUrl}" target="_blank" rel="noopener">View source in Notion →</a>` : ""}
      </div>
    `;
  }).join("");
}

/* ---------- Quarter Proof ---------- */

function renderQuarterProof(q) {
  const periodEl = document.getElementById("quarter-period");
  const focusEl = document.getElementById("quarter-focus");
  const proofTextEl = document.getElementById("quarter-proof-text");
  const statusLabelEl = document.getElementById("progress-status-label");
  const pctLabelEl = document.getElementById("progress-pct-label");
  const fillEl = document.getElementById("progress-fill");

  if (!q) {
    periodEl.textContent = "";
    focusEl.textContent = "";
    proofTextEl.innerHTML = `<span class="empty-state">No quarter data recorded yet.</span>`;
    statusLabelEl.textContent = "";
    pctLabelEl.textContent = "";
    fillEl.style.width = "0%";
    return;
  }

  periodEl.textContent = q.period || "";
  focusEl.textContent = q.focus || "";
  proofTextEl.textContent = q.proof && q.proof.trim().length > 0
    ? q.proof
    : "No proof statement recorded yet for this quarter.";

  const pct = Math.max(0, Math.min(100, q.progressPct ?? 0));
  fillEl.style.width = `${pct}%`;

  if (q.status === "Closed Out") {
    statusLabelEl.textContent = "Closed out";
  } else {
    statusLabelEl.textContent = "In progress — time elapsed this quarter";
  }
  pctLabelEl.textContent = `${Math.round(pct)}%`;
}

/* ---------- Trackers (localStorage only) ---------- */

function initTrackers() {
  document.getElementById("add-tracker-btn").addEventListener("click", handleAddTracker);
  document.getElementById("export-trackers-btn").addEventListener("click", handleExportTrackers);
  document.getElementById("import-trackers-input").addEventListener("change", handleImportTrackers);
  renderTrackers();
}

function loadTrackers() {
  try {
    return JSON.parse(localStorage.getItem(TRACKERS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveTrackers(trackers) {
  localStorage.setItem(TRACKERS_KEY, JSON.stringify(trackers));
}

function loadTrackerLog() {
  try {
    return JSON.parse(localStorage.getItem(TRACKER_LOG_KEY)) || {};
  } catch {
    return {};
  }
}

function saveTrackerLog(log) {
  localStorage.setItem(TRACKER_LOG_KEY, JSON.stringify(log));
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function lastNDayKeys(n) {
  const keys = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i);
    keys.push(`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`);
  }
  return keys;
}

function computeStreak(entries) {
  const d = new Date();
  let streak = 0;
  while (true) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (entries[key]) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function renderTrackers() {
  const trackers = loadTrackers();
  const log = loadTrackerLog();
  const listEl = document.getElementById("tracker-list");

  if (trackers.length === 0) {
    listEl.innerHTML = `<p class="tracker-empty">No trackers yet — add one above (floss, gym, water, whatever you want to keep honest).</p>`;
    return;
  }

  const today = todayKey();
  const days = lastNDayKeys(TRACKER_HISTORY_DAYS);

  listEl.innerHTML = "";
  trackers.forEach((t) => {
    const entries = log[t.id] || {};
    const isDoneToday = !!entries[today];
    const streak = computeStreak(entries);

    const row = document.createElement("div");
    row.className = "tracker-row";
    row.dataset.id = t.id;

    const dotsHtml = days.map((day) => `<span class="tracker-dot${entries[day] ? " is-done" : ""}"></span>`).join("");

    row.innerHTML = `
      <button class="tracker-check${isDoneToday ? " is-done" : ""}" aria-label="Toggle today for ${escapeHtml(t.name)}">✓</button>
      <div class="tracker-info">
        <span class="tracker-name">${escapeHtml(t.name)}</span>
        <div class="tracker-strip">${dotsHtml}</div>
      </div>
      <span class="tracker-streak">${streak}d streak</span>
      <button class="tracker-remove" aria-label="Remove ${escapeHtml(t.name)}">×</button>
    `;

    row.querySelector(".tracker-check").addEventListener("click", () => toggleTrackerToday(t.id));
    row.querySelector(".tracker-remove").addEventListener("click", () => removeTracker(t.id));

    listEl.appendChild(row);
  });
}

function handleAddTracker() {
  const name = prompt("Tracker name (e.g. Floss, Gym, Water):");
  if (!name || !name.trim()) return;
  const trackers = loadTrackers();
  trackers.push({ id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name: name.trim(), createdAt: new Date().toISOString() });
  saveTrackers(trackers);
  renderTrackers();
}

function toggleTrackerToday(id) {
  const log = loadTrackerLog();
  const today = todayKey();
  log[id] = log[id] || {};
  log[id][today] = !log[id][today];
  if (!log[id][today]) delete log[id][today];
  saveTrackerLog(log);
  renderTrackers();
}

function removeTracker(id) {
  const trackers = loadTrackers().filter((t) => t.id !== id);
  saveTrackers(trackers);
  const log = loadTrackerLog();
  delete log[id];
  saveTrackerLog(log);
  renderTrackers();
}

function handleExportTrackers() {
  const payload = {
    exportedAt: new Date().toISOString(),
    trackers: loadTrackers(),
    log: loadTrackerLog(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `norbert-trackers-${todayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function handleImportTrackers(evt) {
  const file = evt.target.files && evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      if (!Array.isArray(payload.trackers) || typeof payload.log !== "object") {
        throw new Error("File doesn't look like a trackers export.");
      }
      saveTrackers(payload.trackers);
      saveTrackerLog(payload.log);
      renderTrackers();
    } catch (err) {
      alert(`Couldn't import that file: ${err.message}`);
    } finally {
      evt.target.value = "";
    }
  };
  reader.readAsText(file);
}

/* ---------- Footer ---------- */

function renderFooter(generatedAt) {
  const el = document.getElementById("last-synced");
  if (!generatedAt) {
    el.textContent = "";
    return;
  }
  const d = new Date(generatedAt);
  el.textContent = `Last synced ${d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;
}

/* ---------- Utils ---------- */

function formatDate(iso) {
  if (!iso) return "";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
