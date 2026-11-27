s=open("index.html").read()
def rep(old,new,cnt=1):
    global s
    assert s.count(old)==cnt, (s.count(old), old[:90]); s=s.replace(old,new)
g=open("/home/claude/growth/growth.js").read()
css=open("/home/claude/growth/growth.css").read()
rep('''function streakNow() { const s = store.get("beatrarity:v2:streak"); return s && s.last >= TODAY - 1 ? s.count : 0; }
function bumpStreak() {
  const s = store.get("beatrarity:v2:streak") || { last: 0, count: 0 };
  if (s.last === TODAY) return s.count;
  const count = s.last === TODAY - 1 ? s.count + 1 : 1;
  store.set("beatrarity:v2:streak", { last: TODAY, count }); return count;
}
''','''// streakNow() / bumpStreak() live in the growth section (streak freezes)
''')
rep('''app.addEventListener("click", e => {
  if (doubleTapHat(e))''', g + '''
app.addEventListener("click", e => {
  if (doubleTapHat(e))''')
rep('''judge: vJudge }[S.screen]();''','''judge: vJudge, stats: vStats, league: vLeague, club: vClub }[S.screen]();''')
rep('''  ${vModeDay()}
  ${S.day < TODAY ?''','''  ${S.day === TODAY ? growthStart() : ""}
  ${vModeDay()}
  ${S.day < TODAY ?''')
rep('''<div class="links">${streak ? `<span class="streak">Streak ${streak}</span>` : ""}<a href="#" data-act="archive">Archive</a>''','''<div class="links">${streak ? `<span class="streak">Streak ${streak}</span>` : ""}<a href="#" data-act="archive">Archive</a><a href="#" data-act="gStats">Stats</a><a href="#" data-act="gLeague">League</a>''')
rep('''<div class="cf"><span>${streak ? `STREAK <b>${streak}</b>` : S.pz.name.toUpperCase()}</span>''','''<div class="cf"><span>${isClub() ? '<em class="g-badge">★</em> ' : ""}${streak ? `STREAK <b>${streak}</b>` : S.pz.name.toUpperCase()}</span>''')
rep('''<span class="fine" id="copymsg"></span></div>
  <details><summary>Choice log</summary>''','''<span class="fine" id="copymsg"></span></div>
  ${growthShare()}
  <details><summary>Choice log</summary>''')
rep('''<button data-act="pickDay" data-day="${d}"><div><b>${p.name}</b><br><span>No. ${pad3(d)} · ${dLabel(d)} · ${keyLabel(p)}</span></div><span>${p.bpm} BPM</span></button>''',
'''${(lk => `<button data-act="${lk ? "gClub" : "pickDay"}" data-day="${d}" class="${lk ? "g-archlock" : ""}"><div><b>${p.name}</b><br><span>No. ${pad3(d)} · ${dLabel(d)} · ${keyLabel(p)}</span></div><span>${lk ? "🔒 Club" : p.bpm + " BPM"}</span></button>`)(!isClub() && d < TODAY - 3)}''')
rep('''<p class="sub">Replay any past day. Archive runs are practice: unscored and kept out of the pool.</p>''','''<p class="sub">Replay any past day. Archive runs are practice: unscored and kept out of the pool.${isClub() ? "" : ' The last 3 days are free; older days are part of <a href="#" data-act="gClub">Crate Club</a>.'}</p>''')
rep('''  if (!scored) { if (pracUsed(game, S.day))''','''  S.milestone = 0; S.freezeUsed = 0; track("start", { game, scored });
  if (!scored) { if (pracUsed(game, S.day))''')
rep('''  } else store.set(pracKey(S.day), { beat: S.beat, log: S.session });
  S.screen = "reveal"; render(); runWeighIn();''','''  } else store.set(pracKey(S.day), { beat: S.beat, log: S.session });
  track("finish", { game: S.modeGame ? "mode" : "day", total: S.result.total, practice: S.practice });
  S.screen = "reveal"; render(); runWeighIn();''')
rep("</style>", css+"</style>")
open("index.html","w").write(s); print("ok")
