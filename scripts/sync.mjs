// Pulls the Norbert Life OS data from Notion and writes data/data.json.
// Requires NOTION_TOKEN in the environment (a Notion internal integration token
// that has been shared with the "Norbert — Life OS" page).

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const LIFE_TRACKER_DB_ID = "fbc5f96f-f75f-4772-bef8-56ae592d47f4";
const QUARTERLY_ARCHIVE_DB_ID = "45ce9c5e-d815-44c2-a299-638e4586cafe";
const ANNUAL_ARCHIVE_DB_ID = "3f02e35a-b54f-4c7c-8423-c91e090e9109";
const MONTHLY_ARCHIVE_DB_ID = "3133f8e3-71dc-430d-9557-b249f39ec144";
const WEEKLY_ARCHIVE_DB_ID = "47dff85c-6bf4-408e-b0f9-f0f0d2be654b";
const NOTION_VERSION = "2022-06-28";
const QUARTER_LENGTH_DAYS = 90;

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, "..", "data", "data.json");

async function main() {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    console.error("NOTION_TOKEN is not set. Export it in your shell before running this script.");
    process.exit(1);
  }

  const [lifeTrackerRows, quarterlyRows, annualRows, monthlyRows, weeklyRows] = await Promise.all([
    queryDatabase(LIFE_TRACKER_DB_ID, token),
    queryDatabase(QUARTERLY_ARCHIVE_DB_ID, token),
    queryDatabase(ANNUAL_ARCHIVE_DB_ID, token),
    queryDatabase(MONTHLY_ARCHIVE_DB_ID, token),
    queryDatabase(WEEKLY_ARCHIVE_DB_ID, token),
  ]);

  const lifeTracker = lifeTrackerRows
    .map(parseLifeTrackerRow)
    .filter((r) => r.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const quarters = quarterlyRows
    .map(parseQuarterlyRow)
    .filter((r) => r.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const annuals = annualRows
    .map(parseAnnualRow)
    .filter((r) => r.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const months = monthlyRows
    .map(parseMonthlyRow)
    .filter((r) => r.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const weeks = weeklyRows
    .map(parseWeeklyRow)
    .filter((r) => r.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const latest = lifeTracker[lifeTracker.length - 1] || null;
  const latestQuarter = quarters[0] || null;
  const latestAnnual = annuals[0] || null;
  const latestMonth = months[0] || null;
  const latestWeek = weeks[0] || null;

  const data = {
    generatedAt: new Date().toISOString(),
    overview: latest
      ? {
          period: latest.period,
          big3: parseBig3(latest.big3),
          sourceUrl: latest.sourceDoc || null,
          anchors: {
            workout: latest.workoutAnchor || null,
            presence: latest.presenceAnchor || null,
          },
        }
      : null,
    lifeScan: lifeTracker.map((r) => ({
      period: r.period,
      date: r.date,
      business: r.business,
      health: r.health,
      relationships: r.relationships,
      innerSteadiness: r.innerSteadiness,
      direction: r.direction,
    })),
    patterns: lifeTracker
      .filter((r) => r.patternNote && r.patternNote.trim().length > 0)
      .map((r) => ({
        period: r.period,
        date: r.date,
        cadence: r.cadence,
        note: r.patternNote,
        sourceUrl: r.sourceDoc || null,
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
    quarterProof: latestQuarter
      ? {
          period: latestQuarter.period,
          status: latestQuarter.status,
          focus: latestQuarter.focus,
          priorities: latestQuarter.priorities,
          proof: latestQuarter.proof,
          dateStart: latestQuarter.date,
          progressPct: computeQuarterProgress(latestQuarter),
        }
      : null,
    season: {
      annual: latestAnnual
        ? {
            period: latestAnnual.period,
            status: latestAnnual.status,
            focus: latestAnnual.focus,
            identity: latestAnnual.identity,
            priorities: latestAnnual.priorities,
          }
        : null,
      monthly: latestMonth
        ? {
            period: latestMonth.period,
            status: latestMonth.status,
            focus: latestMonth.focus,
            adjustment: latestMonth.adjustment,
            energyGauge: latestMonth.energyGauge,
          }
        : null,
      weekly: latestWeek
        ? {
            period: latestWeek.period,
            status: latestWeek.status,
            showUpAs: latestWeek.showUpAs,
            skillPracticing: latestWeek.skillPracticing,
          }
        : null,
    },
  };

  await writeFile(OUT_PATH, JSON.stringify(data, null, 2) + "\n", "utf-8");
  console.log(`Wrote ${OUT_PATH}`);
  console.log(`  Life Tracker rows: ${lifeTracker.length}`);
  console.log(`  Quarterly rows: ${quarters.length}`);
  console.log(`  Annual rows: ${annuals.length}`);
  console.log(`  Monthly rows: ${months.length}`);
  console.log(`  Weekly rows: ${weeks.length}`);
}

async function queryDatabase(databaseId, token) {
  const results = [];
  let cursor = undefined;

  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cursor ? { start_cursor: cursor } : {}),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Notion API error ${res.status} for database ${databaseId}: ${body}`);
    }

    const json = await res.json();
    results.push(...json.results);
    cursor = json.has_more ? json.next_cursor : undefined;
  } while (cursor);

  return results;
}

function parseLifeTrackerRow(page) {
  const p = page.properties;
  return {
    period: getTitle(p, "Period"),
    date: getDate(p, "Date"),
    cadence: getSelect(p, "Cadence"),
    business: getNumber(p, "Business"),
    health: getNumber(p, "Health & Energy"),
    relationships: getNumber(p, "Relationships"),
    innerSteadiness: getNumber(p, "Inner Steadiness"),
    direction: getNumber(p, "Direction"),
    workoutAnchor: getSelect(p, "Workout Anchor"),
    presenceAnchor: getSelect(p, "Presence Anchor"),
    big3: getText(p, "Big 3"),
    patternNote: getText(p, "Pattern Note"),
    sourceDoc: getUrl(p, "Source Doc"),
  };
}

function parseQuarterlyRow(page) {
  const p = page.properties;
  return {
    period: getTitle(p, "Period"),
    date: getDate(p, "Date"),
    status: getSelect(p, "Status"),
    focus: getText(p, "Quarter Focus"),
    priorities: getText(p, "Quarter Priorities"),
    proof: getText(p, "Quarter Proof"),
  };
}

function parseAnnualRow(page) {
  const p = page.properties;
  return {
    period: getTitle(p, "Period"),
    date: getDate(p, "Date"),
    status: getSelect(p, "Status"),
    focus: getText(p, "Year Focus"),
    identity: getText(p, "Year Identity"),
    priorities: getText(p, "Annual Priorities"),
  };
}

function parseMonthlyRow(page) {
  const p = page.properties;
  return {
    period: getTitle(p, "Period"),
    date: getDate(p, "Date"),
    status: getSelect(p, "Status"),
    focus: getText(p, "Month Focus"),
    adjustment: getText(p, "Monthly Adjustment"),
    energyGauge: getSelect(p, "Energy Gauge This Month"),
  };
}

function parseWeeklyRow(page) {
  const p = page.properties;
  return {
    period: getTitle(p, "Period"),
    date: getDate(p, "Date"),
    status: getSelect(p, "Status"),
    showUpAs: getText(p, "Show Up As"),
    skillPracticing: getText(p, "Skill Practicing"),
  };
}

function parseBig3(text) {
  if (!text) return [];

  const numbered = text
    .split(/\s*\d+\.\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (numbered.length > 1) return numbered;

  const semicolons = text
    .split(/\s*;\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (semicolons.length > 1) return semicolons;

  return [text.trim()];
}

function computeQuarterProgress(quarter) {
  if (quarter.status === "Closed Out") return 100;
  if (!quarter.date) return 0;
  const start = new Date(quarter.date);
  const end = new Date(start);
  end.setDate(end.getDate() + QUARTER_LENGTH_DAYS);
  const now = new Date();
  const pct = ((now - start) / (end - start)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/* ---------- Notion property helpers ---------- */

function getTitle(props, name) {
  const p = props[name];
  return p?.title?.map((t) => t.plain_text).join("") || "";
}

function getText(props, name) {
  const p = props[name];
  return p?.rich_text?.map((t) => t.plain_text).join("") || "";
}

function getNumber(props, name) {
  return props[name]?.number ?? null;
}

function getSelect(props, name) {
  return props[name]?.select?.name || null;
}

function getUrl(props, name) {
  return props[name]?.url || null;
}

function getDate(props, name) {
  return props[name]?.date?.start || null;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
