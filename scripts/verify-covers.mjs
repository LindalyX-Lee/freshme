import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 7;
const root = resolve(import.meta.dirname, "..");

function readWindowAssignment(path, name) {
  const source = readFileSync(path, "utf8");
  const match = source.match(new RegExp(`window\\.${name}\\s*=\\s*([\\s\\S]*);\\s*$`));
  if (!match) throw new Error(`Cannot parse ${name}`);
  return Function(`"use strict"; return (${match[1]});`)();
}

const tracks = readWindowAssignment(resolve(root, "data/tracks-data.js"), "FRESHME_TRACKS");
const covers = readWindowAssignment(resolve(root, "data/covers-data.js"), "FRESHME_COVERS");

function dayNumber(key) {
  const [year, month, day] = key.split("-").map(Number);
  return Math.floor(new Date(year, month - 1, day).getTime() / DAY_MS);
}

function addDays(key, offset) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day + offset);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shuffled(items, random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function trackTheme(track) {
  const text = `${track?.title || ""} ${track?.note || ""}`.toLowerCase();
  if (text.includes("普庵") || text.includes("咒") || text.includes("mantra")) return "sound";
  if (text.includes("heart sutra") || text.includes("心经") || text.includes("金刚经") || text.includes("清静经") || text.includes("清靜經") || text.includes("sutra")) return "sutra";
  if (text.includes("道") || text.includes("清淨") || text.includes("tranquility")) return "dao";
  if (text.includes("guqin") || text.includes("古琴") || text.includes("琴")) return "guqin";
  if (text.includes("喜洋洋") || text.includes("喜气") || text.includes("喜氣")) return "joy";
  return "tea";
}

function buildMain(date) {
  const usable = tracks.main.filter((track) => track.fetchStatus === "ok" && track.playableSeconds > 0);
  const random = seededRandom(hashString(`${date}:0:freshme`));
  return shuffled(usable, random).slice(0, 1);
}

function selectCover(date, playlist, history) {
  const mainTheme = trackTheme(playlist.find((track, index) => index >= 2) || playlist[0]);
  const recentIds = new Set(
    Object.entries(history)
      .filter(([key]) => key !== date)
      .map(([, coverId]) => coverId)
  );
  const themed = covers.filter((cover) => cover.theme === mainTheme);
  const pool = themed.length ? themed : covers;
  const themedAvailable = themed.filter((cover) => !recentIds.has(cover.id));
  const allAvailable = covers.filter((cover) => !recentIds.has(cover.id));
  const candidates = themedAvailable.length ? themedAvailable : (allAvailable.length ? allAvailable : pool);
  const random = seededRandom(hashString(`${date}:${mainTheme}:cover`));
  return { cover: candidates[Math.floor(random() * candidates.length)], mainTheme };
}

const start = process.argv[2] || "2026-05-28";
const days = Number(process.argv[3] || 14);
const history = {};
const rows = [];

for (let offset = 0; offset < days; offset += 1) {
  const date = addDays(start, offset);
  const playlist = [tracks.opening[0], { ...tracks.opening[0] }, ...buildMain(date)];
  const { cover, mainTheme } = selectCover(date, playlist, history);
  history[date] = cover.id;
  for (const oldKey of Object.keys(history)) {
    if (dayNumber(oldKey) < dayNumber(date) - HISTORY_DAYS) delete history[oldKey];
  }
  rows.push({ date, coverId: cover.id, theme: cover.theme, mainTheme, title: cover.title });
}

const duplicateWithinWindow = rows.some((row, index) => {
  return rows.slice(Math.max(0, index - HISTORY_DAYS), index).some((prev) => prev.coverId === row.coverId);
});

console.log(`FreshMe cover verify: ${duplicateWithinWindow ? "FAIL" : "PASS"}`);
for (const row of rows) {
  console.log(`${row.date} ${row.coverId} ${row.theme} main=${row.mainTheme} ${row.title}`);
}

if (duplicateWithinWindow) process.exit(1);
