const CATEGORY_META = [
  { key: "business", label: "Business", color: "var(--c-business)", raw: "#7C96B8" },
  { key: "health", label: "Health & Energy", color: "var(--c-health)", raw: "#8FAE86" },
  { key: "relationships", label: "Relationships", color: "var(--c-relationships)", raw: "#C0837E" },
  { key: "innerSteadiness", label: "Inner Steadiness", color: "var(--c-inner)", raw: "#A891B8" },
  { key: "direction", label: "Direction", color: "var(--c-direction)", raw: "#B9A986" },
];

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
  renderLifeScan(data.lifeScan || []);
  renderPatterns(data.patterns || []);
  renderQuarterProof(data.quarterProof);
  renderFooter(data.generatedAt);
}

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
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
    line.setAttribute("stroke", "#2B3040");
    line.setAttribute("stroke-width", "1");
    svg.appendChild(line);

    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", padL - 8);
    label.setAttribute("y", y + 4);
    label.setAttribute("text-anchor", "end");
    label.setAttribute("font-size", "11");
    label.setAttribute("font-family", "IBM Plex Mono, monospace");
    label.setAttribute("fill", "#6B7180");
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
    label.setAttribute("fill", "#9BA1AF");
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
