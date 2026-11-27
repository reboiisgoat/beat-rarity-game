/* ============================================================
   GROWTH PREVIEW — streaks with freezes, stats, weekly league, beat export, video clips, Crate Club (supporter tier),
   tip jar / sponsor / ad slots, reminders and a local event log. Nothing here changes scoring.
   Payments, accounts and the real league need Phase B (Supabase + a payment provider); until then the club has a demo
   unlock and league rivals are simulated (and say so).
   ============================================================ */
const LIVE_URL = "reboiisgoat.github.io/beat-rarity-game";
const TIP_URL = "";                 // Ko-fi / Buy Me a Coffee link goes here
const CLUB_KEY = "beatrarity:v2:club", EVENTS_KEY = "beatrarity:v2:events", LEAGUE_KEY = "beatrarity:v2:league", REMIND_KEY = "beatrarity:v2:remind";
const CLUB_PRICE = { month: "£2.99 / month", year: "£23.99 / year", yearNote: "4 months free" };
const isClub = () => !!(store.get(CLUB_KEY) || {}).on;

/* ---------- event log (local; the same events go to Supabase in Phase B) ---------- */
function track(e, extra) {
  try {
    const log = store.get(EVENTS_KEY) || [];
    log.push(Object.assign({ e, d: TODAY, t: Date.now() }, extra || {}));
    if (log.length > 2000) log.splice(0, log.length - 2000);
    store.set(EVENTS_KEY, log);
  } catch (err) {}
}
function metrics() {
  const log = store.get(EVENTS_KEY) || [], days = [...new Set(log.filter(x => x.e === "visit").map(x => x.d))].sort((a, b) => a - b);
  const set = new Set(days), back = d => set.has(d + 1), backWeek = d => [...Array(7)].some((_, i) => set.has(d + 1 + i));
  const eligible1 = days.filter(d => d < TODAY), eligible7 = days.filter(d => d <= TODAY - 7);
  const n = e => log.filter(x => x.e === e).length;
  return {
    days: days.length,
    d1: eligible1.length ? Math.round(100 * eligible1.filter(back).length / eligible1.length) : null,
    d7: eligible7.length ? Math.round(100 * eligible7.filter(backWeek).length / eligible7.length) : null,
    starts: n("start"), finishes: n("finish"), shares: n("share") + n("clip"), exports: n("export"),
    clubViews: n("club_view"), joins: n("club_join"), tips: n("tip"), reminders: n("remind_on")
  };
}

/* ---------- streaks: one free freeze a week (Crate Club holds one more); a freeze covers a missed day ---------- */
const STREAK_KEY = "beatrarity:v2:streak";
const freezeCap = () => (isClub() ? 3 : 2);
function streakState() {
  const s = Object.assign({ last: 0, count: 0, best: 0, freezes: 1, fweek: 0, used: [] }, store.get(STREAK_KEY) || {});
  const wk = Math.floor(TODAY / 7);
  if (s.fweek !== wk) { s.freezes = Math.min(freezeCap(), (s.fweek ? s.freezes : 0) + 1); s.fweek = wk; store.set(STREAK_KEY, s); }   // a new freeze every week
  return s;
}
function streakNow() {
  const s = streakState(), gap = TODAY - s.last - 1;
  if (!s.last) return 0;
  return gap <= 0 || gap <= s.freezes ? s.count : 0;     // alive if played yesterday/today, or freezes cover the gap
}
function bumpStreak() {
  const s = streakState();
  if (s.last === TODAY) return s.count;
  const gap = TODAY - s.last - 1;
  if (s.last && gap > 0 && gap <= s.freezes) {             // freezes kept it alive
    s.freezes -= gap; for (let i = 1; i <= gap; i++) s.used.push(s.last + i);
    s.count += 1; S.freezeUsed = gap; track("freeze_used", { n: gap });
  } else s.count = s.last && gap <= 0 ? s.count + 1 : 1;
  s.last = TODAY; s.best = Math.max(s.best || 0, s.count); store.set(STREAK_KEY, s);
  if ([3, 7, 14, 30, 50, 100, 365].includes(s.count)) { S.milestone = s.count; track("milestone", { n: s.count }); }
  return s.count;
}
function nextPuzzleIn() {
  const now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
  const s = Math.max(0, Math.floor((mid - now) / 1000));
  return `${Math.floor(s / 3600)}h ${pad2(Math.floor(s / 60) % 60)}m`;
}
setInterval(() => { const el = document.getElementById("nextin"); if (el) el.textContent = nextPuzzleIn(); }, 20000);

/* ---------- your history, from saved crates ---------- */
function history() {
  const out = [];
  for (let d = Math.max(1, TODAY - 400); d <= TODAY; d++) {
    const c = store.get(cardKey(d)), m = store.get(modeKey(d));
    if (c) out.push({ d, game: "day", tier: c.result.tier, total: c.result.total, res: c.result });
    if (m) out.push({ d, game: "mode", tier: m.result.tier, total: m.result.total, res: m.result, mode: modeForDay(d) });
  }
  return out;
}

/* ---------- weekly league: 30 players, Bronze → Diamond; top 7 go up, bottom 5 go down ---------- */
const LEAGUES = [["bronze", "Bronze", "#b07a4a"], ["silver", "Silver", "#b9b9c2"], ["gold", "Gold", "#f2c230"], ["plat", "Platinum", "#5fd3b0"], ["diamond", "Diamond", "#7fb3ff"]];
const UP = 7, DOWN = 5;
const weekStart = () => TODAY - ((new Date().getDay() + 6) % 7);       // Monday's puzzle number
const BOT_NAMES = ["lofi.lu", "808mafia", "kxng_keys", "tapehiss", "miro beats", "snarelord", "dusty.fingers", "nova", "jules.wav", "bassface", "OKAYpluck",
  "rhodes_scholar", "hatroll", "cratedigger9", "mpc_mo", "sidechain sal", "velvetkick", "sub.zero", "glitchgoblin", "chopshop", "lazyloops", "kalimbakid",
  "trapdoor", "swingset", "the_quantizer", "minorkey", "bpm_bandit", "grailhunter", "vinyl.vic", "padthai", "stemcell", "afterbeat"];
function rng(seed) { let x = seed >>> 0 || 1; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); }
function leagueRows(week, tier, from) {      // from: the day you joined this league (rivals only count from then too)
  from = Math.max(week, from || week);
  const me = history().filter(h => h.d >= week && h.d < week + 7 && h.d <= TODAY).reduce((a, h) => a + h.total, 0);
  const rows = [{ name: "You", me: true, pts: me }];
  const r = rng(week * 97 + tier * 13 + 7);
  const names = BOT_NAMES.slice().sort(() => r() - 0.5).slice(0, 29);
  for (const name of names) {
    const skill = 10 + r() * 22 + tier * 5, play = 0.35 + r() * 0.5, modeP = 0.15 + r() * 0.35; let pts = 0;   // tuned so a daily player lands mid-table in Bronze
    for (let d = from; d < week + 7 && d <= TODAY; d++) {
      const rd = rng(week * 7919 + name.length * 31 + d * 101 + tier);
      if (rd() < play) pts += Math.max(0, skill + (rd() - 0.5) * 30);
      if (rd() < modeP) pts += Math.max(0, skill * 0.8 + (rd() - 0.5) * 24);
      if (d === TODAY) pts *= 0.4 + 0.6 * ((Date.now() / 86400000) % 1);   // today's points come in through the day
    }
    rows.push({ name, pts: Math.round(pts * 10) / 10 });
  }
  return rows.sort((a, b) => b.pts - a.pts || (a.me ? -1 : 1));
}
function leagueState() {
  const wk = weekStart();
  let L = store.get(LEAGUE_KEY) || { week: wk, tier: 0, last: null, joined: TODAY };
  if (L.week < wk) {                          // the week closed: promote / demote from the final table
    const rows = leagueRows(L.week, L.tier, L.joined), rank = rows.findIndex(x => x.me) + 1, played = rows.find(x => x.me).pts > 0;
    let tier = L.tier, moved = "stayed";
    if (played && rank <= UP && tier < LEAGUES.length - 1) { tier++; moved = "up"; }
    else if ((!played || rank > rows.length - DOWN) && tier > 0) { tier--; moved = "down"; }
    L = { week: wk, tier, last: { rank, moved, from: L.tier }, joined: wk }; store.set(LEAGUE_KEY, L);
  } else if (!store.get(LEAGUE_KEY)) store.set(LEAGUE_KEY, L);
  return L;
}

/* ---------- start screen: streak, countdown, league, club, tip jar, sponsor slot, reminders ---------- */
function growthStart() {
  const s = streakState(), st = streakNow(), played = !!store.get(cardKey(TODAY)), L = leagueState(), lg = LEAGUES[L.tier];
  const rows = leagueRows(L.week, L.tier, L.joined), rank = rows.findIndex(x => x.me) + 1;
  const sk = SKITS[S.pz.kit && S.pz.kit.skit];
  return `<div class="g-strip">
    <button class="g-tile" data-act="gStats"><span class="g-k">Streak</span><b class="g-fire${st ? " on" : ""}">${st || 0}<small>day${st === 1 ? "" : "s"}</small></b><span class="g-s">${"❄".repeat(s.freezes)}<i>${s.freezes} freeze${s.freezes === 1 ? "" : "s"}</i></span></button>
    <button class="g-tile" data-act="gLeague"><span class="g-k">League</span><b style="color:${lg[2]}">${lg[1]}</b><span class="g-s">#${rank} of 30</span></button>
    <button class="g-tile" data-act="gStats"><span class="g-k">${played ? "Next beat in" : "Today"}</span><b>${played ? `<span id="nextin">${nextPuzzleIn()}</span>` : "Unplayed"}</b><span class="g-s">${played ? "come back tomorrow" : "keep your streak"}</span></button>
  </div>
  ${L.last && !S.leagueSeen ? `<div class="g-note">${L.last.moved === "up" ? `Promoted to <b>${lg[1]}</b> — you finished #${L.last.rank} last week.` : L.last.moved === "down" ? `Dropped to <b>${lg[1]}</b> last week (#${L.last.rank}). Play daily to climb back.` : `You held ${lg[1]} last week (#${L.last.rank}).`}</div>` : ""}
  ${sk ? `<div class="g-sponsor"><span>Today's kit</span><b>${sk.name}</b><em>presented by <u>your brand here</u></em><small>sponsor slot · preview</small></div>` : ""}
  <div class="g-row">
    <button class="btn g-club" data-act="gClub">${isClub() ? "★ Crate Club member" : "★ Crate Club"}</button>
    <button class="btn" data-act="gRemind">${(store.get(REMIND_KEY) || {}).on ? "Reminder on" : "Remind me daily"}</button>
    <button class="btn" data-act="gTip">☕ Tip jar</button>
  </div>`;
}

/* ---------- results: milestone, clip, export, tip, the one ad slot ---------- */
function growthShare() {
  const club = isClub();
  return `${S.milestone && !S.practice ? `<div class="g-mile"><b>${S.milestone}-day streak</b><span>${S.milestone >= 30 ? "That's a habit. Respect." : S.milestone >= 7 ? "A full week of crates." : "You're on a roll."}</span></div>` : ""}
  ${S.freezeUsed && !S.practice ? `<div class="g-note">❄ A streak freeze covered ${S.freezeUsed === 1 ? "the day" : `${S.freezeUsed} days`} you missed.</div>` : ""}
  <div class="g-share">
    <p class="sechead">Share it<small>A 15-second clip of your beat for TikTok, Reels or Shorts. No spoilers: it shows your crate and rhythm, never which notes you picked.</small></p>
    <div class="g-row"><button class="btn go" data-act="gClip">🎬 Make a clip</button></div>
    <div id="gclip" class="g-clip"></div>
    <p class="sechead">Take your beat with you<small>Drop it into FL Studio, Ableton or Logic.</small></p>
    <div class="g-row"><button class="btn" data-act="gWav">⬇ WAV loop</button>
      <button class="btn ${club ? "" : "g-lock"}" data-act="${club ? "gMidi" : "gClub"}">${club ? "" : "🔒 "}MIDI</button>
      <button class="btn ${club ? "" : "g-lock"}" data-act="${club ? "gStems" : "gClub"}">${club ? "" : "🔒 "}Stems</button></div>
    <span class="fine" id="gmsg"></span>
  </div>
  ${club ? "" : `<div class="g-ad"><small>Ad space · preview</small><span>One ad lives here, after your result — never during a round, never before you play.</span></div>`}
  <div class="g-row g-tiprow"><button class="textbtn" data-act="gTip">☕ Enjoying it? Tip the maker</button></div>`;
}

/* ---------- stats ---------- */
function vStats() {
  const H = history(), day = H.filter(h => h.game === "day"), s = streakState(), club = isClub(), M = metrics();
  const tiers = CONFIG.CRATE_TIERS.map(t => t[1]), counts = tiers.map(t => day.filter(h => h.tier === t).length), maxC = Math.max(1, ...counts);
  const avg = day.length ? day.reduce((a, h) => a + h.total, 0) / day.length : 0, best = day.reduce((a, h) => (h.total > (a ? a.total : -1) ? h : a), null);
  const last = []; for (let d = TODAY - 13; d <= TODAY; d++) last.push(day.find(h => h.d === d));
  const maxT = Math.max(10, ...day.map(h => h.total));
  const laneAvg = club ? ["drums", "bass", "mel", "fx"].map(id => { const v = day.map(h => (h.res.lanes.find(l => l.lane === id) || {}).total || 0); return [id, v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0]; }) : [];
  const grails = club ? day.reduce((a, h) => a + h.res.lanes.reduce((b, l) => b + l.notes.filter(n => n.tier === "grail").length, 0), 0) : 0;
  return `<div class="lbl">Your stats</div><h2>${day.length ? `${day.length} crate${day.length === 1 ? "" : "s"} dug` : "No crates yet"}</h2>
  <div class="g-stats">
    <div><b>${streakNow()}</b><span>current streak</span></div><div><b>${s.best || 0}</b><span>best streak</span></div>
    <div><b>${avg.toFixed(1)}</b><span>average crate</span></div><div><b>${best ? best.total.toFixed(1) : "–"}</b><span>heaviest crate</span></div>
  </div>
  <p class="sechead">Last 14 days</p>
  <div class="g-bars">${last.map((h, i) => `<i title="${h ? h.total.toFixed(1) : "missed"}" style="height:${h ? 8 + 92 * h.total / maxT : 4}%" class="${h ? "" : "miss"}${s.used.includes(TODAY - 13 + i) ? " frz" : ""}"></i>`).join("")}</div>
  <p class="fine">Grey = missed · blue = covered by a streak freeze (${s.freezes} left; a new one every week, up to ${freezeCap()}).</p>
  <p class="sechead">Where your crates landed</p>
  <div class="g-dist">${tiers.map((t, i) => `<div><span>${t}</span><i style="width:${4 + 96 * counts[i] / maxC}%"></i><b>${counts[i]}</b></div>`).join("")}</div>
  ${club ? `<p class="sechead">Crate Club stats</p>
    <div class="g-dist">${laneAvg.map(([id, v]) => `<div><span>${(laneOf(id, null) || { name: id }).name.replace(/^The /, "")}</span><i style="width:${4 + 96 * v / Math.max(1, ...laneAvg.map(x => x[1]))}%"></i><b>${v.toFixed(1)}</b></div>`).join("")}</div>
    <p class="fine">Average weight per part · ${grails} Grail${grails === 1 ? "" : "s"} found all-time.</p>`
    : `<button class="g-locked" data-act="gClub">🔒 Per-part averages, Grails found and more with Crate Club →</button>`}
  <details class="g-metrics"><summary>Growth metrics (preview, this device only)</summary>
    <p class="fine">These are the numbers to watch once real players arrive. In Phase B they're counted across everyone in Supabase.</p>
    <div class="g-stats sm">
      <div><b>${M.days}</b><span>days visited</span></div><div><b>${M.d1 == null ? "–" : M.d1 + "%"}</b><span>came back next day</span></div>
      <div><b>${M.d7 == null ? "–" : M.d7 + "%"}</b><span>came back within a week</span></div><div><b>${M.starts ? Math.round(100 * M.finishes / M.starts) + "%" : "–"}</b><span>finished a run</span></div>
      <div><b>${M.shares}</b><span>shares &amp; clips</span></div><div><b>${M.exports}</b><span>exports</span></div>
      <div><b>${M.clubViews}/${M.joins}</b><span>club views / joins</span></div><div><b>${M.tips}</b><span>tip-jar taps</span></div>
    </div></details>
  <div class="links"><a href="#" data-act="today">Back</a><a href="#" data-act="gLeague">League</a><a href="#" data-act="archive">Archive</a></div>`;
}

/* ---------- league ---------- */
function vLeague() {
  const L = leagueState(), lg = LEAGUES[L.tier], rows = leagueRows(L.week, L.tier, L.joined), me = rows.findIndex(x => x.me);
  S.leagueSeen = true;
  const daysLeft = 7 - (TODAY - L.week);
  return `<div class="lbl">Weekly league</div><h2 style="color:${lg[2]}">${lg[1]} league</h2>
  <p class="sub">30 diggers, one week. Every crate you dig (daily beat + Mode of the day) adds its weight. Top ${UP} move up, bottom ${DOWN} move down. Ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.</p>
  <div class="g-tiers">${LEAGUES.map((x, i) => `<span class="${i === L.tier ? "on" : i < L.tier ? "past" : ""}" style="--c:${x[2]}">${x[1]}</span>`).join("")}</div>
  <ol class="g-table">${rows.map((r, i) => `${i === UP ? '<li class="g-cut up">▲ promotion zone</li>' : ""}${i === rows.length - DOWN ? '<li class="g-cut down">▼ drop zone</li>' : ""}<li class="${r.me ? "me" : ""}"><span>${i + 1}</span><b>${r.me ? "You" + (isClub() ? ' <em class="g-badge">★</em>' : "") : r.name}</b><i>${r.pts.toFixed(1)}</i></li>`).join("")}</ol>
  <p class="fine">Preview: the other 29 are simulated until accounts go live (Phase B). Your points are real — the sum of this week's crates.</p>
  <div class="links"><a href="#" data-act="today">Back</a><a href="#" data-act="gStats">Stats</a></div>`;
}

/* ---------- Crate Club ---------- */
function vClub() {
  const on = isClub();
  return `<div class="lbl">Crate Club</div><h2>${on ? "You're in. Thank you." : "Dig deeper"}</h2>
  <p class="sub">The daily beat and Mode of the day stay free forever. Crate Club pays for new sounds and keeps the lights on.</p>
  <div class="g-promise">Crate Club <b>never</b> buys score. Everyone digs the same puzzle with the same notes.</div>
  <ul class="g-perks">
    <li><b>Full archive</b><span>Every past day (free: the last 3).</span></li>
    <li><b>MIDI + stems export</b><span>Pull your beat into your DAW part by part.</span></li>
    <li><b>Deep stats</b><span>Per-part averages, Grails found, history.</span></li>
    <li><b>Extra streak freeze</b><span>Hold up to 3 instead of 2.</span></li>
    <li><b>Club badge</b><span>On your share card, clips and league row.</span></li>
    <li><b>Themes</b><span>Night, Tape and Neon.</span></li>
    <li><b>No ads</b><span>The results-screen ad slot disappears.</span></li>
    <li><b>New sound packs first</b><span>A week early.</span></li>
  </ul>
  ${on ? `<p class="sechead">Theme</p><div class="g-row">${["default", "night", "tape", "neon"].map(t => `<button class="btn ${(store.get(CLUB_KEY) || {}).theme === t || (!(store.get(CLUB_KEY) || {}).theme && t === "default") ? "go" : ""}" data-act="gTheme" data-t="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}</div>
    <div class="g-row"><button class="textbtn" data-act="gLeave">Leave the demo club</button></div>`
  : `<div class="g-prices"><button class="g-price" data-act="gJoin" data-p="month"><b>${CLUB_PRICE.month}</b><span>cancel any time</span></button>
     <button class="g-price best" data-act="gJoin" data-p="year"><em>${CLUB_PRICE.yearNote}</em><b>${CLUB_PRICE.year}</b><span>best value</span></button></div>
    <p class="fine">Preview: no payment is taken. Tapping a price turns on a demo membership so you can try every perk. Real checkout (Lemon Squeezy or Paddle, which handle EU VAT) arrives with accounts in Phase B.</p>`}
  <div class="links"><a href="#" data-act="today">Back</a></div>`;
}
function applyTheme() {
  const t = isClub() ? (store.get(CLUB_KEY) || {}).theme : null;
  document.documentElement.dataset.theme = t && t !== "default" ? t : "";
}

/* ---------- audio: render the beat offline (same mix as the game) ---------- */
async function renderBeat(pz, beat, bars, only) {
  audioInit(); try { await bakeKit(pz); } catch (e) {}
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext, sr = 44100, sd = 60 / pz.bpm / 4, len = bars * 16 * sd + 2.5;
  const off = new OAC(2, Math.ceil(sr * len), sr);
  const saved = { ctx, master, noiseBuf, roomIn, delayIn, delayNode, bassVoice, hatVoice, melVoices, VOICE, drumBus, melBus, lastHatSample };
  try {
    initGraph(off); VOICE = null; lastHatSample = null;
    for (let bar = 0; bar < bars; bar++) for (let step = 0; step < 16; step++) {
      const t = 0.05 + (bar * 16 + step) * sd + (step % 2 ? swingOf(pz) * sd : 0);
      for (const id of ["drums", "bass", "mel", "chords", "fx"]) {
        if (only && id !== only) continue;
        for (const n of (beat[id] || []).concat((pz.locked && pz.locked[id]) || [])) if (n.step === step) try { playNote(pz, id, n, t, n.glide); } catch (e) {}
      }
    }
  } finally { ({ ctx, master, noiseBuf, roomIn, delayIn, delayNode, bassVoice, hatVoice, melVoices, VOICE, drumBus, melBus, lastHatSample } = saved); }
  return new Promise((ok, no) => {
    off.oncomplete = e => ok(e.renderedBuffer);
    try { const p = off.startRendering(); if (p && p.then) p.then(ok, no); } catch (e) { no(e); }
  });
}
const barsFor = (pz, secs) => Math.max(2, Math.round(secs / (16 * 60 / pz.bpm / 4)));
function wavBytes(buf) {
  const ch = buf.numberOfChannels, n = buf.length, out = new DataView(new ArrayBuffer(44 + n * ch * 2)), w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); out.setUint32(4, 36 + n * ch * 2, true); w(8, "WAVE"); w(12, "fmt "); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
  out.setUint32(24, buf.sampleRate, true); out.setUint32(28, buf.sampleRate * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); w(36, "data"); out.setUint32(40, n * ch * 2, true);
  const data = [...Array(ch)].map((_, c) => buf.getChannelData(c)); let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, data[c][i])); out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
  return new Uint8Array(out.buffer);
}
/* MIDI: one track per part; drums on channel 10 with General MIDI notes; 96 ticks a beat (24 a step) */
const GM_DRUM = [36, 38, 42, 39, 46, 37, 40, 70, 63];
function midiBytes(pz, beat, bars) {
  const tracks = [], vlq = v => { const b = [v & 127]; while ((v >>= 7)) b.unshift((v & 127) | 128); return b; };
  const head = [0x4d, 0x54, 0x72, 0x6b], u32 = v => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
  const tempo = Math.round(60000000 / pz.bpm), str = s => [...s].map(c => c.charCodeAt(0) & 127);
  tracks.push([0, 0xff, 0x51, 3, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255, 0, 0xff, 0x58, 4, 4, 2, 24, 8, 0, 0xff, 0x2f, 0]);
  for (const id of ["drums", "bass", "mel", "chords"]) {
    const notes = (beat[id] || []).concat((pz.locked && pz.locked[id]) || []); if (!notes.length) continue;
    const ch = id === "drums" ? 9 : { bass: 0, mel: 1, chords: 2 }[id], ev = [];
    for (let bar = 0; bar < bars; bar++) for (const n of notes) {
      const pitch = id === "drums" ? GM_DRUM[n.row] || 37 : id === "bass" ? bassMidi(pz, n.row) : id === "chords" ? melMidi(pz, n.row) - 12 : melMidi(pz, n.row);
      const at = (bar * 16 + n.step) * 24, len = id === "drums" ? 12 : id === "chords" ? 96 : 40, reps = id === "drums" && n.row === 2 ? n.roll || 1 : 1;
      for (let r = 0; r < reps; r++) { const t = at + Math.round(r * 24 / reps); ev.push([t, 0x90 | ch, pitch, id === "drums" && n.row === 2 ? 80 : 100], [t + Math.min(len, 24 / reps * (reps > 1 ? 0.8 : 1) || len), 0x80 | ch, pitch, 0]); }
    }
    ev.sort((a, b) => a[0] - b[0] || (a[1] & 0xf0) - (b[1] & 0xf0));
    const name = str((laneOf(id, null) || { name: id }).name), bytes = [0, 0xff, 0x03, name.length, ...name]; let last = 0;
    if (id !== "drums") bytes.push(0, 0xc0 | ch, { bass: 38, mel: 4, chords: 89 }[id]);
    for (const [t, a, b, c] of ev) { bytes.push(...vlq(t - last), a, b, c); last = t; }
    bytes.push(0, 0xff, 0x2f, 0); tracks.push(bytes);
  }
  const out = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, tracks.length, 0, 96];
  for (const t of tracks) out.push(...head, ...u32(t.length), ...t);
  return new Uint8Array(out);
}
/* a stored (uncompressed) zip, for saving several files at once inside a Claude artifact */
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function zipBytes(files) {
  const crc = d => { let c = 0xffffffff; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const parts = [], central = []; let off = 0;
  const le = (v, n) => { const a = []; for (let i = 0; i < n; i++) a.push((v >>> (8 * i)) & 255); return a; };
  for (const f of files) {
    const name = new TextEncoder().encode(f.name), c = crc(f.data), sz = f.data.length;
    const hdr = [0x50, 0x4b, 3, 4, 20, 0, 0, 0, 0, 0, 0, 0, 0x21, 0, ...le(c, 4), ...le(sz, 4), ...le(sz, 4), ...le(name.length, 2), 0, 0];
    parts.push(new Uint8Array(hdr), name, f.data);
    central.push(new Uint8Array([0x50, 0x4b, 1, 2, 20, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0x21, 0, ...le(c, 4), ...le(sz, 4), ...le(sz, 4), ...le(name.length, 2), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...le(off, 4)]), name);
    off += hdr.length + name.length + sz;
  }
  const csz = central.reduce((a, p) => a + p.length, 0);
  const end = new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...le(files.length, 2), ...le(files.length, 2), ...le(csz, 4), ...le(off, 4), 0, 0]);
  return new Blob([...parts, ...central, end], { type: "application/zip" });
}
/* save: inside a Claude artifact through the downloads capability (zip / mp4 / webm only); elsewhere a normal download */
async function saveFiles(base, files, msgEl) {
  const say = t => { if (msgEl) msgEl.textContent = t; };
  const dl = window.claude && window.claude.use ? await window.claude.use("downloads").catch(() => null) : null;
  if (dl) {
    const single = files.length === 1 && /\.(mp4|webm|zip)$/.test(files[0].name);
    try { await dl.save(single ? { filename: files[0].name, data: files[0].blob || new Blob([files[0].data]) } : { filename: base + ".zip", data: zipBytes(files) }); say("Saved."); }
    catch (e) { say(e && e.code === "declined" ? "Download cancelled." : "Couldn't save here — try the live site."); }
    return;
  }
  for (const f of files) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(f.blob || new Blob([f.data])); a.download = f.name;
    document.body.appendChild(a); a.click(); a.remove(); await sleep(250);
  }
  say(files.length > 1 ? "Downloading " + files.length + " files." : "Downloaded.");
}
const fileBase = () => `beat-rarity-${pad3(S.day)}${S.modeGame ? "-" + S.pz.mode : ""}`;

/* ---------- 15-second vertical clip: your crate, a live grid and a visualiser, recorded with the beat ---------- */
async function makeClip(box) {
  const pz = S.pz, beat = S.beat, R = S.result, bars = barsFor(pz, 15), sd = 60 / pz.bpm / 4;
  box.innerHTML = `<p class="fine">Mixing your beat…</p>`;
  stop(); Radio.stop && Radio.stop(true);
  const buf = await renderBeat(pz, beat, bars);
  const types = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  const mime = window.MediaRecorder && types.find(t => MediaRecorder.isTypeSupported(t));
  if (!mime) { box.innerHTML = `<p class="fine">This browser can't record video. Try Chrome or Safari.</p>`; return; }
  const W = 720, H = 1280, cv = document.createElement("canvas"); cv.width = W; cv.height = H; cv.className = "g-canvas";
  box.innerHTML = ""; box.appendChild(cv);
  const msg = document.createElement("p"); msg.className = "fine"; msg.textContent = "Recording — 15 seconds…"; box.appendChild(msg);
  const g = cv.getContext("2d"), dest = ctx.createMediaStreamDestination(), an = ctx.createAnalyser(); an.fftSize = 256;
  const src = ctx.createBufferSource(); src.buffer = buf; src.connect(an); an.connect(dest); an.connect(ctx.destination);
  const stream = new MediaStream([...cv.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4e6 }), chunks = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || "#888";
  const col = { none: "#24221e", misfit: css("--bad"), dead: css("--t-dead"), bside: css("--t-bside"), white: css("--t-white"), fresh: css("--t-fresh"), promo: css("--t-promo"), test: css("--t-test"), grail: css("--t-grail") };
  const lanes = lanesOf(pz), strips = lanes.map(L => laneStrip(R, L.id)), freq = new Uint8Array(an.frequencyBinCount);
  const acc = css("--acc"), bg = css("--bg"), text = css("--text"), muted = css("--muted"), club = isClub();
  const t0 = ctx.currentTime + 0.15, dur = buf.duration - 1.5; let raf;
  const draw = () => {
    const t = ctx.currentTime - t0, step = t >= 0 ? Math.floor(t / sd) % 16 : -1;
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = acc; g.fillRect(0, 0, W, 10);
    g.textAlign = "left"; g.fillStyle = text; g.font = "800 46px system-ui, sans-serif"; g.fillText("BEAT", 56, 110); g.fillStyle = acc; g.fillText("RARITY", 56 + g.measureText("BEAT ").width, 110);
    g.textAlign = "right"; g.fillStyle = muted; g.font = "500 28px ui-monospace, monospace"; g.fillText(`No. ${pad3(S.day)}`, W - 56, 106);
    g.textAlign = "left"; g.fillStyle = muted; g.font = "500 30px system-ui, sans-serif"; g.fillText(`${pz.name} · ${pz.bpm} BPM · ${keyLabel(pz)}`, 56, 170);
    g.fillStyle = text; g.font = "800 210px system-ui, sans-serif"; g.fillText(R.total.toFixed(1), 50, 400);
    g.fillStyle = muted; g.font = "600 30px system-ui, sans-serif"; g.fillText("CRATE WEIGHT", 60, 450);
    g.fillStyle = col[tierIdOfName(R.tier)] || acc; g.font = "800 64px system-ui, sans-serif"; g.fillText(R.tier.toUpperCase(), 56, 540);
    if (club) { g.fillStyle = "#f2c230"; g.font = "700 26px system-ui, sans-serif"; g.fillText("★ CRATE CLUB", 60, 590); }
    const gx = 120, gy = 650, cw = 33, ch = 46, gap = 4;
    lanes.forEach((L, li) => {
      g.fillStyle = muted; g.font = "700 24px ui-monospace, monospace"; g.textAlign = "right"; g.fillText(L.short, gx - 16, gy + li * (ch + 14) + 32); g.textAlign = "left";
      strips[li].forEach((tid, s) => {
        const x = gx + s * (cw + gap), y = gy + li * (ch + 14), hot = s === step && tid !== "none";
        g.fillStyle = col[tid] || col.none; g.globalAlpha = tid === "none" ? 1 : hot ? 1 : 0.75; g.fillRect(x, y - (hot ? 6 : 0), cw, ch + (hot ? 12 : 0)); g.globalAlpha = 1;
      });
    });
    if (step >= 0) { g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(gx + step * (cw + gap) - 2, gy - 14, cw + 4, lanes.length * (ch + 14) + 14); }
    an.getByteFrequencyData(freq);
    const vy = 1110, bw = (W - 112) / 48;
    for (let i = 0; i < 48; i++) { const v = freq[Math.floor(i * freq.length / 64)] / 255, h = 6 + v * 150; g.fillStyle = i % 2 ? acc : text; g.globalAlpha = 0.35 + v * 0.65; g.fillRect(56 + i * bw, vy - h, bw - 4, h); }
    g.globalAlpha = 1; g.fillStyle = muted; g.font = "600 28px system-ui, sans-serif"; g.textAlign = "center";
    g.fillText("Can you dig a rarer crate?", W / 2, 1180); g.fillStyle = text; g.font = "700 30px ui-monospace, monospace"; g.fillText(LIVE_URL, W / 2, 1225);
    raf = requestAnimationFrame(draw);
  };
  draw(); rec.start(250); src.start(t0); track("clip_start");
  await new Promise(r => setTimeout(r, (dur + 0.4) * 1000));
  rec.stop(); src.stop(); cancelAnimationFrame(raf);
  await new Promise(r => (rec.onstop = r));
  const ext = mime.includes("mp4") ? "mp4" : "webm", blob = new Blob(chunks, { type: mime.split(";")[0] });
  msg.textContent = "";
  const vid = document.createElement("video"); vid.src = URL.createObjectURL(blob); vid.controls = true; vid.playsInline = true; vid.className = "g-canvas";
  cv.replaceWith(vid);
  const row = document.createElement("div"); row.className = "g-row";
  row.innerHTML = `<button class="btn go">⬇ Save clip (.${ext})</button>${navigator.canShare && navigator.canShare({ files: [new File([blob], "x." + ext, { type: blob.type })] }) ? '<button class="btn">Share…</button>' : ""}`;
  box.appendChild(row);
  const [saveB, shareB] = row.querySelectorAll("button");
  saveB.onclick = () => { track("clip"); saveFiles(fileBase(), [{ name: `${fileBase()}.${ext}`, blob }], msg); };
  if (shareB) shareB.onclick = () => { track("clip"); navigator.share({ files: [new File([blob], `${fileBase()}.${ext}`, { type: blob.type })], text: `My crate weighed ${R.total.toFixed(1)} on Beat Rarity No. ${pad3(S.day)} — ${LIVE_URL}` }).catch(() => {}); };
  box.appendChild(msg);
}

/* ---------- actions ---------- */
const gmsg = t => { const m = document.getElementById("gmsg"); if (m) m.textContent = t; };
Object.assign(ACT, {
  gStats(el, e) { e && e.preventDefault(); stop(); S.screen = "stats"; render(); },
  gLeague(el, e) { e && e.preventDefault(); stop(); track("league_view"); S.screen = "league"; render(); },
  gClub(el, e) { e && e.preventDefault(); stop(); track("club_view"); S.clubFrom = S.screen; S.screen = "club"; render(); },
  gJoin(el) { store.set(CLUB_KEY, { on: true, plan: el.dataset.p, since: TODAY }); track("club_join", { plan: el.dataset.p }); const s = streakState(); s.freezes = Math.min(freezeCap(), s.freezes + 1); store.set(STREAK_KEY, s); render(); },
  gLeave() { store.set(CLUB_KEY, { on: false }); applyTheme(); render(); },
  gTheme(el) { store.set(CLUB_KEY, Object.assign({}, store.get(CLUB_KEY), { theme: el.dataset.t })); applyTheme(); render(); },
  gTip() {
    track("tip");
    if (TIP_URL) { window.open(TIP_URL, "_blank", "noopener"); return; }
    sheet(`<h3>Tip jar</h3><p>This is where a Ko-fi or Buy Me a Coffee link goes. One tap, any amount, no account needed.</p><p class="fine">Preview: no link set yet (TIP_URL).</p>`);
  },
  gRemind() {
    const on = (store.get(REMIND_KEY) || {}).on, title = encodeURIComponent("Beat Rarity — today's crate"), details = encodeURIComponent(`A new beat to dig: https://${LIVE_URL}/`);
    const cal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&recur=RRULE:FREQ%3DDAILY`;
    sheet(`<h3>Daily reminder</h3><p>Pick one:</p>
      <div class="g-row"><a class="btn" href="${cal}" target="_blank" rel="noopener">Add to Google Calendar</a><button class="btn" data-act="gNotify">${on ? "Browser reminder: on" : "Browser reminder"}</button></div>
      <p class="fine">Browser reminders here are a preview: they fire while the game is open. Real push reminders (and email) need accounts — Phase B.</p>`);
  },
  async gNotify() {
    if (!("Notification" in window)) { gmsg("This browser can't show notifications."); return; }
    const p = await Notification.requestPermission().catch(() => "denied");
    if (p === "granted") { store.set(REMIND_KEY, { on: true }); track("remind_on"); try { new Notification("Beat Rarity", { body: "Reminders are on. A new crate drops at midnight." }); } catch (e) {} }
    closeSheetG(); render();
  },
  async gWav() {
    gmsg("Mixing…");
    try { const buf = await renderBeat(S.pz, S.beat, 4); track("export", { kind: "wav" }); await saveFiles(fileBase(), [{ name: fileBase() + ".wav", data: wavBytes(buf) }], document.getElementById("gmsg")); }
    catch (e) { logError(e); gmsg("Couldn't render the beat."); }
  },
  async gMidi() {
    track("export", { kind: "midi" });
    await saveFiles(fileBase(), [{ name: fileBase() + ".mid", data: midiBytes(S.pz, S.beat, 4) }], document.getElementById("gmsg"));
  },
  async gStems() {
    gmsg("Mixing each part…");
    try {
      const files = [];
      for (const L of lanesOf(S.pz)) { const buf = await renderBeat(S.pz, S.beat, 4, L.id); files.push({ name: `${fileBase()}-${L.id}.wav`, data: wavBytes(buf) }); gmsg(`Mixed ${files.length} of ${lanesOf(S.pz).length}…`); }
      files.push({ name: fileBase() + ".mid", data: midiBytes(S.pz, S.beat, 4) });
      track("export", { kind: "stems" }); await saveFiles(fileBase() + "-stems", files, document.getElementById("gmsg"));
    } catch (e) { logError(e); gmsg("Couldn't render the stems."); }
  },
  async gClip() {
    const box = document.getElementById("gclip"); if (!box || box.dataset.busy) return; box.dataset.busy = 1;
    try { audioInit(); await makeClip(box); } catch (e) { logError(e); box.innerHTML = `<p class="fine">Couldn't make the clip here.</p>`; }
    delete box.dataset.busy;
  },
  gCloseSheet() { closeSheetG(); }
});
const _copyShare = ACT.copyShare; ACT.copyShare = (...a) => { track("share"); return _copyShare(...a); };
const _copyChallenge = ACT.copyChallenge; if (_copyChallenge) ACT.copyChallenge = (...a) => { track("share", { kind: "challenge" }); return _copyChallenge(...a); };
function sheet(html) {
  closeSheetG();
  const d = document.createElement("div"); d.id = "gsheet"; d.className = "g-sheetwrap";
  d.innerHTML = `<div class="g-sheet" role="dialog">${html}<div class="g-row"><button class="textbtn" data-act="gCloseSheet">Close</button></div></div>`;
  d.addEventListener("click", e => { if (e.target === d) closeSheetG(); const b = e.target.closest("[data-act]"); if (b && ACT[b.dataset.act] && b.dataset.act !== "gCloseSheet") ACT[b.dataset.act](b, e); else if (b) closeSheetG(); });
  document.body.appendChild(d);
}
function closeSheetG() { const d = document.getElementById("gsheet"); if (d) d.remove(); }
applyTheme();
track("visit");
