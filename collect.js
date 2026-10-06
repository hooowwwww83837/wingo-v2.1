const fs = require('fs');
const path = require('path');

const API = 'https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json';
const FILE = path.join(__dirname, 'wingo_data.json');
const MAX_ROUNDS = 10000;

async function tryFetch(label, url, options) {
  console.log('──────────────────────────────');
  console.log('TRY:', label);
  console.log('URL:', url.slice(0, 120));
  try {
    const res = await fetch(url, options || {});
    console.log('STATUS:', res.status);
    if (!res.ok) return null;
    const text = await res.text();
    console.log('BODY LENGTH:', text.length);
    console.log('BODY START:', text.slice(0, 200));
    try {
      const json = JSON.parse(text);
      if (json && json.data && json.data.list && json.data.list.length) {
        console.log('✓ GOT', json.data.list.length, 'ROUNDS');
        return json.data.list;
      }
      console.log('✗ No list in response');
      return null;
    } catch (e) {
      console.log('✗ JSON parse failed:', e.message);
      return null;
    }
  } catch (e) {
    console.log('✗ FETCH ERROR:', e.message);
    return null;
  }
}

async function fetchRounds() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://bdg9.cc/'
  };

  const url1 = API + '?ts=' + Date.now();
  let data = await tryFetch('direct', url1, { headers });
  if (data) return data;

  data = await tryFetch('allorigins', 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url1), { headers });
  if (data) return data;

  data = await tryFetch('corsproxy', 'https://corsproxy.io/?' + encodeURIComponent(url1), { headers });
  if (data) return data;

  data = await tryFetch('codetabs', 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url1), { headers });
  if (data) return data;

  data = await tryFetch('thingproxy', 'https://thingproxy.freeboard.io/fetch/' + url1, { headers });
  if (data) return data;

  return null;
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
  console.log('══════════════════════════════════');
  console.log('COLLECTOR START:', new Date().toISOString());
  console.log('══════════════════════════════════');

  const existing = loadExisting();
  console.log('Existing rounds:', (existing.rounds || []).length);

  const existingIssues = new Set();
  if (Array.isArray(existing.rounds)) {
    existing.rounds.forEach(r => {
      if (typeof r === 'object' && r !== null && r.issue) existingIssues.add(r.issue);
    });
  }

  const list = await fetchRounds();

  if (!list || !list.length) {
    console.log('══════════════════════════════════');
    console.log('✗ FAILED: No data from any source');
    console.log('This means all proxies are blocked.');
    console.log('══════════════════════════════════');
    process.exit(1);
  }

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
  console.log('══════════════════════════════════');
  console.log('✓ ADDED:', newRounds.length, 'new rounds');
  console.log('✓ TOTAL:', allRounds.length, 'rounds');
  console.log('══════════════════════════════════');
}

main();
