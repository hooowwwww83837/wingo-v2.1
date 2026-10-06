const fs = require('fs');
const path = require('path');

const API = 'https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json';
const FILE = path.join(__dirname, 'wingo_data.json');
const MAX_ROUNDS = 10000;

async function fetchRounds() {
  try {
    const res = await fetch(API + '?ts=' + Date.now());
    if (!res.ok) { console.log('API not ok:', res.status); return null; }
    const json = await res.json();
    if (!json || !json.data || !json.data.list) { console.log('Bad response'); return null; }
    return json.data.list;
  } catch (e) {
    console.log('Fetch error:', e.message);
    return null;
  }
}

function loadExisting() {
  try {
    if (!fs.existsSync(FILE)) return { version: 3, count: 0, rounds: [] };
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    return { version: 3, count: 0, rounds: [] };
  }
}

async function main() {
  const existing = loadExisting();
  const existingIssues = new Set();
  if (Array.isArray(existing.rounds)) {
    existing.rounds.forEach(r => {
      if (typeof r === 'object' && r !== null && r.issue) existingIssues.add(r.issue);
    });
  }
  const list = await fetchRounds();
  if (!list || !list.length) { console.log('No data'); return; }
  const newRounds = [];
  list.forEach(it => {
    const iss = it.issueNumber;
    const num = parseInt(it.number);
    if (!iss || isNaN(num)) return;
    if (existingIssues.has(iss)) return;
    existingIssues.add(iss);
    newRounds.push({ issue: iss, num: num });
  });
  newRounds.sort((a, b) => (BigInt(a.issue) > BigInt(b.issue) ? -1 : 1));
  let allRounds = newRounds.concat(existing.rounds || []);
  if (allRounds.length > MAX_ROUNDS) allRounds = allRounds.slice(0, MAX_ROUNDS);
  const out = {
    version: 3,
    exportedAt: new Date().toISOString(),
    count: allRounds.length,
    rounds: allRounds
  };
  fs.writeFileSync(FILE, JSON.stringify(out, null, 2));
  console.log(`Added ${newRounds.length} new rounds. Total: ${allRounds.length}`);
}
main();
