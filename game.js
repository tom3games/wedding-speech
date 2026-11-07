// 結婚式の友人スピーチ（原稿が飛んだ）本体
// 1プレイ = スピーチ8段。段ごとに目が合った卓の人がいて、その人の本音（くじ）に合う一文を3択から選ぶ
// 台詞は卓に関係なく共通。当たりは卓の物としぐさで読む。新郎の黒歴史は罠（1回目は新郎が目で止め、2回目で司会が割って入る）
// 描画は three.js（会場・卓・切り抜きの人物）、時間は固定60Hz（performance.now で数える）
import * as THREE from './vendor/three.module.min.js?v=3'
import { setupLook } from './look.js?v=3'
window.__jsUp = true
const D = window.WD, T = window.WT
const $ = s => document.querySelector(s)
const store = { get(k) { try { return localStorage.getItem(k) } catch (e) { return null } }, set(k, v) { try { localStorage.setItem(k, v) } catch (e) {} } }
let lang = store.get('ws_lang') || ((navigator.language || 'ja').startsWith('ja') ? 'ja' : 'en')
const L = () => D.UI[lang]
const tx = o => (o ? (o[lang] ?? o.ja) : '')
const len = s => [...s].length
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const V = '?v=3'

// ---------- 釣り合いの数字（sim.mjs で確かめる）
// 一文の制限時間 = 読む時間（2.5秒 + 頭の中の一言1字0.12秒 + 3択1字0.06秒）を 10〜12秒に収めたもの。最初の一文は14秒、初めての1回は+2秒
const NUM = {
  START: 50, HIT: 16, MISS: -14, SPREAD: 3, CPL_HIT: 3, CPL_MISS: -3, SIL: -12, SIL_ALL: -3, SIL_CPL: -5, SIL_OUT: 3,
  TRAP: -18, TRAP_DRUNK: 4, TRAP_CPL: -25, JIKO_OUT: 2, EV_OK: 4, EV_OK_CPL: 6, EV_NG: -5, EV_NG_CPL: -6,
  TURN_MIN: 10, TURN_MAX: 12, FIRST: 14, READ0: 2.5, READ_LINE: 0.12, READ_OPT: 0.06, ROOKIE: 2, SETTLE: 0.7,
  EV_MIN: 8, EV_QUICK: 1.8, TRAP_P: 0.3,
  RANK: { legend: 85, great: 72, ok: 58, legendMiss: 1 },
}
const TABLES = ['boss', 'gran', 'ex', 'drunk']
const STEPS = T.SECTIONS.length   // 10。最後（締め）は新郎新婦
const FAIL = T.SECTIONS.findIndex(([k]) => k === 'fail')   // 失敗談の段（黒歴史が必ず混ざる）

// ---------- 1回のくじ。同じ種なら同じ本音・同じ物・同じ順番・同じ事件
function pickItems(want, r, avoid = []) {
  const pool = Object.keys(T.ITEMS).filter(k => T.ITEMS[k].w.includes(want) && !avoid.includes(k))
  const a = []; while (a.length < 2 && pool.length) a.push(pool.splice((r() * pool.length) | 0, 1)[0])
  return a
}
function buildRun(seed, o = {}) {
  const r = rng(seed), pick = a => a[(r() * a.length) | 0]
  const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0;[a[i], a[j]] = [a[j], a[i]] } return a }
  // 本音: 4つの卓で少なくとも3種類（いつも同じ型が勝たないように）
  let wants
  for (let k = 0; k < 30; k++) { wants = Object.fromEntries(TABLES.map(t => [t, pick(T.GUESTS[t].wants)])); if (new Set(Object.values(wants)).size >= 3) break }
  wants.couple = pick(T.GUESTS.couple.wants)
  if (o.wants) Object.assign(wants, o.wants)
  // 途中で本音が変わる人（同級生は必ず、祖母はたまに疲れて「短く」に）
  const sw = {}
  if (r() < T.GUESTS.drunk.turn) sw.drunk = { at: FAIL, to: pick(T.GUESTS.drunk.wants.filter(w => w !== wants.drunk)) }
  if (r() < T.GUESTS.gran.turn && wants.gran !== 's') sw.gran = { at: FAIL + 1, to: 's' }
  const items = Object.fromEntries([...TABLES, 'couple'].map(t => [t, pickItems(wants[t], r)]))
  // 目が合う順番: 4卓を2周＋1回（締めの前まで9段）。続けて同じ卓にしない。同級生は酔ったあと（失敗談以降）に1回は来る
  let focus
  for (let k = 0; k < 50; k++) {
    focus = [...shuffle(TABLES), ...shuffle(TABLES), ...shuffle(TABLES).slice(0, STEPS - 1 - 8)]
    if (focus.every((f, i) => !i || f !== focus[i - 1]) && focus.slice(FAIL).includes('drunk')) break
  }
  focus.push('couple')
  const nodes = T.SECTIONS.map(([, alts]) => pick(alts))
  // 黒歴史: 失敗談（4段目）は必ず。ほかは名乗りと締め以外でくじ
  const trapAt = new Set([FAIL]); for (let i = 1; i < STEPS - 1; i++) if (i !== FAIL && r() < NUM.TRAP_P) trapAt.add(i)
  // 事件: 3つ。段の切れ目（名乗りの直後と締めの直前は外す）。たまに元カレ（レア）
  const normal = Object.keys(D.EVENTS).filter(k => !D.EVENTS[k].rare), evs = shuffle(normal).slice(0, 3)
  if (r() < 0.15) evs[(r() * 3) | 0] = 'exbf'
  const slots = shuffle([1, 2, 3, 4, 6, 7]).slice(0, 3).sort((a, b) => a - b)
  const evQ = evs.map((k, i) => { const E = D.EVENTS[k]; return { k, after: slots[i], cue: E.cues ? pick(E.cues) : null, delay: 0.6 + r() * 0.7, done: false } })
  const run = {
    seed, r, shuffle, wants, want0: { ...wants }, sw, items, focus, nodes, trapAt, evQ, black0: (r() * T.BLACK.length) | 0, gest0: (r() * 11) | 0,
    mood: Object.fromEntries([...TABLES, 'couple'].map(t => [t, NUM.START])), laugh: 0, tear: 0, jiko: 0, silent: 0, hits: 0, misses: 0, blackSaid: 0, evOk: 0, evAll: 0,
    step: -1, node: null, choices: null, state: 'wait', baited: false, announce: {}, switched: {}, log: [],
  }
  return run
}

// ---------- 状態
const G = { mode: 'title', t: 0, tasks: [], run: null, gen: 0, clock: null, ev: null, ended: null, result: null, snap: null, cam: null, shake: 0, flash: 0 }
const later = (d, fn) => { const gen = G.gen; G.tasks.push({ at: G.t + d, fn: () => { if (G.gen === gen) fn() } }) }
const sayMin = s => Math.max(2.2, 1.2 + 0.09 * len(s))

// ---------- 画面の文字
function say(s, cls = '', anchor = null) { const b = $('#bubble'); b.textContent = s; b.className = cls + (anchor || cls === 'me' ? '' : ' free'); b.hidden = false; G.anchor = anchor; layout() }
function hideBubble() { $('#bubble').hidden = true; G.anchor = null }
function setClue(s, cls = '') { const c = $('#clue'); c.textContent = s; c.className = cls; c.hidden = false }
function hideClue() { $('#clue').hidden = true }
function setLines(list, opt = {}) {
  const box = $('#paper')
  if (!box.children.length) for (let i = 0; i < 3; i++) { const b = document.createElement('button'); b.className = 'ln'; b.textContent = ' '; b.disabled = true; b.addEventListener('click', () => { Snd.init(); choose(i) }); box.appendChild(b) }
  ;[...box.children].forEach((b, i) => {
    const c = list && list[i]
    b.textContent = c ? (typeof c === 'string' ? c : tx(c.t || c)) : ' '
    b.disabled = !c || !!opt.off
    b.className = 'ln' + (opt.ev && c ? ' ev' : '') + (opt.pick === i ? ' pick' : '')
  })
  layout()
}

// ---------- 始める
function show(v) { for (const id of ['vTitle', 'vPlay', 'vEnd']) $('#' + id).hidden = id !== v; layout() }
function startRun(seed, o = {}) {
  ambOn(); hideAll()
  G.gen++
  G.seed = seed ?? ((Math.random() * 1e9) | 0)
  const run = G.run = buildRun(G.seed, o)
  Object.assign(G, { tasks: [], clock: null, ev: null, ended: null, result: null, snap: null, rookie: store.get('ws_played') !== '1', tut: store.get('ws_tut') !== '1' })
  resetHall(run)
  window.TM && TM.start()
  show('vPlay'); setLines(null)
  if (!$('#mcPeek').getAttribute('src')) $('#mcPeek').src = 'img/mc_w.webp' + V
  aim('wide')
  if (o.skipIntro) { G.mode = 'play'; later(0.3, () => nextStep()); return }
  G.mode = 'intro'; G.introI = 0; sayLine(); $('#say').hidden = false
}
function sayLine() {
  const [who, s] = L().intro[G.introI]
  $('#sayNm').textContent = who === 'mc' ? L().mc : L().me; $('#sayLine').textContent = s
  const im = $('#sayImg'); if (who === 'mc') { im.src = 'img/mc.webp' + V; im.hidden = false } else im.hidden = true
  $('#paper').classList.toggle('blank', who === 'me')
  if (who === 'me') { setLines([' ', ' ', ' '].map(() => '　'), { off: true }); Sfx('paper') }
}
function introNext() { Sfx('paper'); G.introI++; if (G.introI >= L().intro.length) introEnd(); else sayLine() }
function introEnd() { if (G.mode !== 'intro') return; $('#say').hidden = true; $('#paper').classList.remove('blank'); G.mode = 'play'; later(0.2, () => nextStep()) }
function hideAll() { for (const id of ['#say', '#stopper', '#how']) $(id).hidden = true; hideBubble(); hideClue(); $('#hand').hidden = true }

// ---------- 一歩ずつ
function wantOf(run, k) { return run.wants[k] }
function makeChoices(run, node, step, focusKey) {
  const want = wantOf(run, focusKey)
  const hit = node.o.find(o => o.st === want), rest = run.shuffle(node.o.filter(o => o.st !== want)).slice(0, 2)
  if (run.trapAt.has(step) || run.baited) { rest[1] = { st: 'b', t: T.BLACK[(run.black0 + run.blackSaid + step) % T.BLACK.length] }; run.baited = false }
  return run.shuffle([hit, ...rest])
}
function turnLimit(run, node, choices) {
  const read = NUM.READ0 + NUM.READ_LINE * len(tx(node.s)) + NUM.READ_OPT * choices.reduce((a, c) => a + len(tx(c.t)), 0)
  const base = run.step === 0 ? NUM.FIRST : Math.min(NUM.TURN_MAX, Math.max(NUM.TURN_MIN, read))
  return base + (G.rookie ? NUM.ROOKIE : 0)
}
function nextStep() {
  const run = G.run; if (!run || G.mode !== 'play') return
  // 段の切れ目に事件を挟む（いま終わった段のあと）
  if (run.step >= 0 && run.step < STEPS - 1 && maybeEvent()) return
  run.step++
  if (run.step >= STEPS) return finish()
  // 途中で本音が変わる（変わった卓は、次に目が合った時に一行で知らせる）
  for (const [k, s] of Object.entries(run.sw)) if (!run.switched[k] && run.step >= s.at) { run.switched[k] = true; run.wants[k] = s.to; run.items[k] = pickItems(s.to, run.r, run.items[k]); run.announce[k] = true; placeItems(k); run.log.push(`switch:${k}:${s.to}`) }
  present()
}
function present(again) {
  const run = G.run, step = run.step, fk = run.focus[step], node = run.nodes[step]
  run.node = node; run.fk = fk; run.state = 'turn'
  if (!again || !run.choices) run.choices = makeChoices(run, node, step, fk)
  aim(fk)
  setLines(run.choices)
  say(tx(node.s), 'me')
  const want = wantOf(run, fk), gs = T.GEST.filter(x => x.w.includes(want)); run.gest = gs[(run.gest0 + step) % gs.length]
  $('#hand').hidden = true
  if (run.announce[fk]) { run.announce[fk] = false; setClue(tx(T.SWITCH[fk]), 'warn') }
  else if (G.tut && step === 0) { setClue(L().tut.items, 'tip'); $('#hand').hidden = false }
  else if (G.tut && step === 1) { setClue(L().tut.candle, 'tip'); store.set('ws_tut', '1') }
  else setClue(tx(run.gest))
  if (!again) { setMc(false); run.limit = turnLimit(run, node, run.choices); G.clock = { t0: G.t + NUM.SETTLE, t1: G.t + NUM.SETTLE + run.limit, howled: false } }
  else if (G.clock) G.clock.t1 = Math.max(G.clock.t1, G.t + 3)
}

// ---------- 選ぶ
function choose(i) {
  if (G.mode === 'event') return evChoose(i)
  const run = G.run; if (G.mode !== 'play' || !run || run.state !== 'turn') return false
  const c = run.choices[i]; if (!c) return false
  run.state = 'react'; G.clock = null; $('#hand').hidden = true; Tension(0)
  setLines(run.choices, { off: true, pick: i }); Sfx('paper')
  if (c.st === 'b') return blackSaid()
  const fk = run.fk, want = wantOf(run, fk), hit = c.st === want
  mood(fk, hit ? NUM.HIT : NUM.MISS)
  for (const k of [...TABLES, 'couple']) if (k !== fk && run.wants[k] === c.st) mood(k, NUM.SPREAD)
  if (fk !== 'couple') mood('couple', hit ? NUM.CPL_HIT : NUM.CPL_MISS)
  if (hit) { run.hits++; if (want === 'j') run.laugh++; if (want === 't') run.tear++ } else run.misses++
  run.log.push(`${step()}:${fk}:${want}:${c.st}:${hit ? 'H' : 'M'}`)
  const k2 = (run.hits + run.misses) % 2
  const line = hit ? T.HIT[fk][want][k2] : T.COLD[fk][want]
  react(fk, hit ? (want === 't' ? 't' : want === 's' ? 'n' : 'h') : 'c', T.P(line), hit ? 'hit_' + want : 'miss', hit ? '' : 'cold')
  if (step() === STEPS - 1) snapLater()
  later(sayMin(tx(T.P(line))) + 0.2, () => nextStep())
  return true
}
const step = () => G.run ? G.run.step : -1
function mood(k, d) { const run = G.run; run.mood[k] = Math.max(0, Math.min(100, run.mood[k] + d)) }
function react(k, face, line, sfx, cls) {
  setFace(k, face, 2.4); if (face !== 'c' && face !== 'n') bob(k)
  if (face === 'n') nod(k)
  if (face === 'c') shakeP(k)
  Sfx(sfx); hideClue()
  say(tx(line), cls, k)
}
// 黒歴史を言った
function blackSaid() {
  const run = G.run; run.blackSaid++; run.jiko++; run.log.push(`${step()}:black`)
  for (const k of TABLES) mood(k, k === 'drunk' ? NUM.TRAP_DRUNK : NUM.TRAP)
  mood('couple', NUM.TRAP_CPL)
  Hush(); Sfx('freeze')
  setFace('drunk', 'h', 3); setFace('boss', 'c', 3); setFace('gran', 'c', 3); setFace('ex', 'c', 3); faint('gran', 0.35)
  say(L().freeze, 'cold', run.fk); hideClue()
  if (run.jiko >= NUM.JIKO_OUT) return later(1.6, () => forcedEnd('jiko'))
  // 1回目: 新郎が目で止める
  later(1.5, () => { aim('couple'); setFace('groom', 'g', 3); setClue(L().glare, 'warn'); say(L().freeze, 'cold', 'couple') })
  later(4.2, () => { Tension(0.1); faint('gran', 0); nextStep() })
  return true
}
// 黙っていた（キャンドルが消えた）
function silence() {
  const run = G.run; run.state = 'react'; G.clock = null; run.silent++; run.log.push(`${step()}:silent`)
  mood(run.fk, NUM.SIL); for (const k of TABLES) if (k !== run.fk) mood(k, NUM.SIL_ALL); mood('couple', NUM.SIL_CPL)
  setLines(run.choices, { off: true }); $('#hand').hidden = true
  setFace(run.fk, 'c', 2); Sfx('miss'); setMc(true); G.peekHold = G.t + sayMin('　'.repeat(12))
  const s = L().silent[(run.silent - 1) % L().silent.length]
  say(s, 'cold', null); hideClue()
  if (run.silent >= NUM.SIL_OUT) return later(1.6, () => forcedEnd('mute'))
  later(sayMin(s), () => { setMc(false); nextStep() })
}

// ---------- 事件
const evCorrect = ev => ev.cue ? ev.cue.ok : 'quick'
function maybeEvent() {
  const run = G.run, e = run.evQ.find(e => !e.done && e.after === run.step)
  if (!e) return false
  e.done = true; startEvent(e); return true
}
function startEvent(e) {
  const run = G.run, E = D.EVENTS[e.k]
  G.mode = 'event'; run.evAll++; run.log.push(`ev:${e.k}`)
  const ev = G.ev = { ...e, E, at: G.t, shown: E.kind !== 'quick', state: 'on', order: run.shuffle(E.opts.map((_, i) => i)) }
  showEventVisual(e.k, true)
  Sfx('ev_' + e.k); if (e.k === 'howl') { Howl(0.3); G.shake = 0.8 }
  const line = tx(E.line)
  say(line, E.who === 'none' ? 'mc' : E.who === 'knife' ? 'mc' : '', E.who === 'knife' ? 'mc' : E.who === 'none' ? null : E.who)
  if (e.cue) setClue(tx(e.cue), 'tip'); else hideClue()
  let lim
  if (E.kind === 'two') lim = Math.max(NUM.EV_MIN, NUM.READ0 + NUM.READ_LINE * (len(line) + (e.cue ? len(tx(e.cue)) : 0)) + NUM.READ_OPT * E.opts.reduce((a, o) => a + len(tx(o)), 0))
  else lim = e.delay + NUM.EV_QUICK
  lim += G.rookie ? 1 : 0
  ev.t1 = G.t + lim; G.clock = { t0: G.t, t1: ev.t1, howled: true }
  setEvLines()
}
function setEvLines() {
  const ev = G.ev
  if (ev.state !== 'on') return setLines(null)
  if (ev.E.kind === 'two') setLines(ev.order.map(i => ev.E.opts[i]), { ev: true })
  else setLines(ev.shown ? [ev.E.opts[0]] : null, { ev: true })
}
function evChoose(i) {
  const ev = G.ev; if (!ev || ev.state !== 'on') return false
  if (ev.E.kind === 'quick') { if (i !== 0 || !ev.shown) return false; evResolve(true, 'quick'); return true }
  const o = ev.E.opts[ev.order[i]]; if (!o) return false
  setLines(ev.order.map(j => ev.E.opts[j]), { off: true, pick: i, ev: true })
  evResolve(o.k === evCorrect(ev), o.k); return true
}
function evResolve(ok, k) {
  const run = G.run, ev = G.ev, E = ev.E; ev.state = 'done'; ev.ok = ok; G.clock = null; Tension(0)
  if (!(E.kind === 'two' && k)) setLines(null)
  run.log.push(`ev:${ev.k}:${ok ? 'ok' : k || 'timeout'}`)
  let line, bad = false
  if (ok) {
    run.evOk++; for (const t of TABLES) mood(t, NUM.EV_OK); mood('couple', NUM.EV_OK_CPL)
    line = E.win.ja ? E.win : E.win[k]
    if (E.laugh && E.laugh === k) { run.laugh++; Sfx('evok') } else if (k === 'toast') Sfx('toast'); else Sfx('evok2')
    if (k === 'toast') G.flash = 0.5
  } else {
    for (const t of TABLES) mood(t, NUM.EV_NG); mood('couple', NUM.EV_NG_CPL)
    line = E.lose; Sfx('miss')
    if (E.bad && k === E.bad) { bad = true; run.jiko++; Hush(); Sfx('freeze'); setFace('boss', 'c', 3); setFace('gran', 'c', 3); faint('gran', 0.35) }
  }
  if (ev.k === 'shout' && k === 'tell') run.baited = true
  if (ev.k === 'shout' && !ok && k !== 'tell') run.baited = true
  const s = tx(line)
  say(s, ok ? '' : 'cold', ev.k === 'kid' || ev.k === 'dad' || ev.k === 'exbf' ? ev.k : ev.k === 'shout' ? 'drunk' : null); hideClue()
  if (bad && run.jiko >= NUM.JIKO_OUT) return later(1.6, () => forcedEnd('jiko'))
  later(sayMin(s) + 0.3, () => {
    if (G.ev !== ev) return
    showEventVisual(ev.k, false); faint('gran', 0); Tension(0.1)
    G.ev = null; G.mode = 'play'; nextStep()
  })
}

// ---------- 終わり方
function finish() {
  const run = G.run; run.state = 'gone'; G.ended = 'done'
  Sfx('finale'); aim('wide'); hideBubble(); hideClue(); setLines(null)
  for (const k of [...TABLES]) setFace(k, run.mood[k] >= 55 ? 'h' : 'n', 3)
  later(2.4, () => goResult())
}
function forcedEnd(kind) {
  const run = G.run, u = L(); G.ended = kind; G.mode = 'stop'; G.clock = null; run.state = 'gone'
  setLines(null); hideClue()
  if (kind === 'jiko') { faint('gran', 1); leave('boss'); Sfx('chair'); aim('wide') }
  setMc(true)
  later(0.9, () => { if (!G.snap) takeSnap() })
  later(kind === 'jiko' ? 1.2 : 0.2, () => {
    hideBubble()
    $('#stopLine').textContent = kind === 'jiko' ? u.mcCut : u.mcMute
    const st = $('#stopStamp'); st.textContent = kind === 'jiko' ? (lang === 'ja' ? '式、中断' : 'HALTED') : (lang === 'ja' ? 'マイク没収' : 'MIC TAKEN'); st.classList.remove('in')
    $('#bStop').textContent = u.result; $('#bStop').hidden = true; $('#stopper').hidden = false
    later(1.3, () => { st.classList.add('in'); Sfx('stamp') })
    later(2.0, () => { $('#bStop').hidden = false })
  })
  window.TM && TM.end(score(), false)
}
function score() { const r = G.run; if (!r) return 0; const ks = [...TABLES, 'couple']; return Math.round(ks.reduce((a, k) => a + r.mood[k], 0) / ks.length) }
function rankOf() {
  if (G.ended === 'mute') return 'mute'
  if (G.ended === 'jiko') return 'jiko'
  const s = score(), j = G.run.jiko
  if (s >= NUM.RANK.legend && !j && G.run.misses <= NUM.RANK.legendMiss) return 'legend'
  if (s >= NUM.RANK.great) return 'great'
  if (s >= NUM.RANK.ok) return 'ok'
  return 'meh'
}
function goResult() { if (G.ended === 'done') window.TM && TM.end(score(), true); result() }

// ---------- 結果（お礼状）
function result() {
  store.set('ws_played', '1')
  hideAll(); G.mode = 'end'; G.ev = null; G.clock = null; setLines(null)
  if (!G.snap) takeSnap()
  const run = G.run
  G.result = { rk: rankOf(), score: score(), laugh: run.laugh, tear: run.tear, jiko: run.jiko, stage: 0 }
  show('vEnd'); fitLetter()
  for (const id of ['#bAgain', '#bSave', '#bPost']) $(id).disabled = true
  drawLetter()
  const id = (G.resId = (G.resId || 0) + 1), at = [0.6, 1.2, 1.8]
  at.forEach((d, i) => later(d, () => { if (G.resId !== id) return; G.result.stage = i + 1; drawLetter(); Sfx('paper') }))
  later(2.4, () => { if (G.resId === id) Sfx('drum') })
  later(4.2, () => {
    if (G.resId !== id) return
    G.result.stage = 4; drawLetter(); Sfx('stamp')
    const rk = G.result.rk; Sfx(rk === 'legend' || rk === 'great' ? 'win' : rk === 'ok' ? 'win2' : 'lose'); if (rk === 'legend' || rk === 'great') Sfx('finale')
    for (const b of ['#bAgain', '#bSave', '#bPost']) $(b).disabled = false
  })
}
function fitLetter() {
  const box = $('#letterBox').getBoundingClientRect(), c = $('#letter'); if (!box.width) return
  const s = Math.min(box.width / 1080, box.height / 1350); c.style.width = Math.floor(1080 * s) + 'px'; c.style.height = Math.floor(1350 * s) + 'px'
}
function fitText(x, s, max, size, font) { let f = size; do { x.font = font.replace('#', f + 'px'); if (x.measureText(s).width <= max) break; f -= 2 } while (f > 12); return f }
function drawLetter() {
  const d = G.result; if (!d) return
  const c = $('#letter'), x = c.getContext('2d'), u = L(), W = 1080, H = 1350
  const MIN = '"Shippori Mincho B1", serif', HAND = '"Klee One", serif'
  x.save(); x.clearRect(0, 0, W, H)
  // 紙
  x.fillStyle = '#f8f2e6'; x.fillRect(0, 0, W, H)
  const g = x.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 900); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(150,120,80,.18)'); x.fillStyle = g; x.fillRect(0, 0, W, H)
  x.strokeStyle = '#b8955a'; x.lineWidth = 3; x.strokeRect(36, 36, W - 72, H - 72); x.lineWidth = 1.5; x.strokeRect(50, 50, W - 100, H - 100)
  // 見出し
  x.fillStyle = '#3a2a1a'; x.textAlign = 'center'; x.textBaseline = 'alphabetic'
  x.font = `800 ${lang === 'ja' ? 76 : 64}px ${MIN}`; x.fillText(u.letterHead, W / 2, 150)
  // 写真（会場の一枚）。少し傾けて貼る
  if (G.snap) {
    x.save(); x.translate(W / 2, 430); x.rotate(-0.025)
    const pw = 780, ph = 420; x.fillStyle = '#fff'; x.shadowColor = 'rgba(0,0,0,.25)'; x.shadowBlur = 18; x.shadowOffsetY = 6; x.fillRect(-pw / 2 - 16, -ph / 2 - 16, pw + 32, ph + 32); x.shadowColor = 'transparent'
    const sw = G.snap.width, sh = G.snap.height, k = Math.max(pw / sw, ph / sh), cw = pw / k, ch = ph / k
    x.drawImage(G.snap, (sw - cw) / 2, (sh - ch) * 0.42, cw, ch, -pw / 2, -ph / 2, pw, ph)
    x.restore()
  }
  // 宛名と本文
  x.textAlign = 'left'; x.fillStyle = '#3a2a1a'
  x.font = `800 44px ${MIN}`; x.fillText(u.letterTo, 120, 735)
  x.font = `600 34px ${HAND}`; u.letterBody.forEach((s, i) => x.fillText(s, 140, 795 + i * 48))
  // 数（笑い・涙・事故）。ひとつずつ出す
  const cnt = [[u.cLaugh, d.laugh, u.unitT, '#3a2a1a'], [u.cTear, d.tear, u.unitT, '#3a2a1a'], [u.cJiko, d.jiko, u.unitK, '#a3241c']]
  cnt.forEach(([lab, n, unit, col], i) => {
    if (d.stage < i + 1) return
    const cx = 230 + i * 310; x.textAlign = 'center'
    x.fillStyle = '#8a6a3a'; x.font = `600 30px ${MIN}`; x.fillText(lab, cx, 920)
    x.fillStyle = col; x.font = `800 86px ${MIN}`; x.fillText(String(n), cx - (unit ? 18 : 0), 1010)
    if (unit) { x.font = `600 30px ${MIN}`; x.fillText(unit, cx + 42, 1008) }
  })
  x.strokeStyle = 'rgba(184,149,90,.6)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(120, 1036); x.lineTo(W - 120, 1036); x.stroke()
  // 称号（発表まで見せない）＋新郎の一言
  if (d.stage >= 4) {
    const name = u.rankName[d.rk], red = '#c8271f'
    x.save(); x.translate(W / 2, 1150); x.rotate(-0.06)
    const fs = fitText(x, name, 720, lang === 'ja' ? 104 : 70, `800 #px ${MIN}`), tw = x.measureText(name).width
    x.strokeStyle = red; x.lineWidth = 7; x.strokeRect(-tw / 2 - 30, -fs * 0.9, tw + 60, fs * 1.3)
    x.fillStyle = red; x.textAlign = 'center'; x.fillText(name, 0, fs * 0.13)
    x.restore()
    x.textAlign = 'left'; x.fillStyle = '#23304d'; const q = lang === 'ja' ? `新郎「${u.groom[d.rk]}」` : `Groom: "${u.groom[d.rk]}"`
    const qf = fitText(x, q, W - 240, 36, `600 #px ${HAND}`); x.fillText(q, 120, 1252)
    x.textAlign = 'right'; x.fillStyle = '#6a5440'; x.font = `600 28px ${MIN}`; x.fillText(u.from, W - 150, 1290)
  } else {
    x.textAlign = 'center'; x.fillStyle = 'rgba(58,42,26,.35)'; x.font = `600 30px ${MIN}`; x.fillText(u.title2 + ' ……', W / 2, 1150)
  }
  x.restore()
}

// ---------- 3D の会場
const cv = $('#cv')
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true })
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x1b1410)
scene.fog = new THREE.Fog(0x2a1d14, 9, 22)
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 60)
const look = setupLook(renderer, scene, { exposure: 1.05, sky: 0xffe9cc, ground: 0x4a3024, hemi: 0.75, sunColor: 0xffe2b8, sun: 1.1, sunPos: [2, 8, 4], target: [0, 0, -5], fill: 0.3 })
const loader = new THREE.TextureLoader()
const TEX = {}
const texOf = n => TEX[n] || null
function loadTex(n) {
  return new Promise(res => {
    if (TEX[n]) return res(TEX[n])
    loader.load('img/' + n + '.webp' + V, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; TEX[n] = t; res(t) }, undefined, () => { console.error('img ' + n); res(null) })
  })
}
const ME = new THREE.Vector3(0, 0, 0)
const CAM0 = new THREE.Vector3(0.42, 1.72, 0.85)
const POS = {
  // カメラから見た向き: 上司 -28°・元カノ -9°・祖母 +14°・同級生 +30°。近い卓の人が奥の卓を隠さない
  boss: new THREE.Vector3(-1.55, 0, -2.86), gran: new THREE.Vector3(1.77, 0, -4.58), ex: new THREE.Vector3(-0.77, 0, -6.65), drunk: new THREE.Vector3(4.6, 0, -7.0),
  couple: new THREE.Vector3(-3.6, 0, 0.9), mc: new THREE.Vector3(2.9, 0, -1.0), back1: new THREE.Vector3(1.25, 0, -10.8), back2: new THREE.Vector3(-3.4, 0, -11.0), side: new THREE.Vector3(-4.3, 0, -7.6),
}
const FILL = { boss: ['f1', 'f3'], gran: ['f3', 'f2'], ex: ['f2', 'f4'], drunk: ['f4', 'f1'], back1: ['f1', 'f2'], back2: ['f3', 'f4'], side: ['f2', 'f1'] }
const people = {}   // 名前 → { mesh, base, face, until, ... }
const itemMeshes = []
const hall = new THREE.Group(); scene.add(hall)

function carpetTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d')
  x.fillStyle = '#5e1d24'; x.fillRect(0, 0, 256, 256)
  x.strokeStyle = 'rgba(214,170,96,.38)'; x.lineWidth = 3
  for (const [cx, cy] of [[64, 64], [192, 192], [192, 64], [64, 192]]) { x.beginPath(); x.ellipse(cx, cy, 34, 20, (cx + cy) % 128 ? 0.8 : -0.8, 0, 7); x.stroke(); x.beginPath(); x.arc(cx, cy, 6, 0, 7); x.stroke() }
  x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 1; for (let i = 0; i < 256; i += 4) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke() }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 12); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t
}
function textTex(s, o = {}) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160; const x = c.getContext('2d')
  x.fillStyle = '#fbf6ea'; x.fillRect(0, 0, 256, 160); x.strokeStyle = '#b8955a'; x.lineWidth = 6; x.strokeRect(8, 8, 240, 144)
  x.fillStyle = '#3a2a1a'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `800 ${o.size || 84}px "Shippori Mincho B1", serif`; x.fillText(s, 128, 84)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}
const M = {
  cloth: new THREE.MeshStandardMaterial({ color: 0xf6f1e7, roughness: 0.85 }), wall: new THREE.MeshStandardMaterial({ color: 0xeadcc4, roughness: 0.9 }), gold: new THREE.MeshStandardMaterial({ color: 0xc9a25e, roughness: 0.35, metalness: 0.6 }),
  plate: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }), glass: new THREE.MeshStandardMaterial({ color: 0xe8f2f6, roughness: 0.05, transparent: true, opacity: 0.35 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x4a6a46, roughness: 0.8 }), rose: new THREE.MeshStandardMaterial({ color: 0xf4e4e0, roughness: 0.7 }), pink: new THREE.MeshStandardMaterial({ color: 0xe0a6aa, roughness: 0.7 }),
  wax: new THREE.MeshStandardMaterial({ color: 0xfff6e6, roughness: 0.6, emissive: 0x332211 }), wood: new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.6 }),
}
const flameTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.3, 'rgba(255,190,90,.8)'); g.addColorStop(1, 'rgba(255,150,40,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t })()
const flames = []
function addFlame(parent, x, y, z, s = 0.09) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); m.position.set(x, y, z); m.scale.set(s, s * 1.5, s); parent.add(m); flames.push(m); return m }
// 切り抜きの人物（いつもカメラの方を向く板）
function person(key, img, x, y, z, h, o = {}) {
  const geo = new THREE.PlaneGeometry(h * 2 / 3, h); geo.translate(0, h / 2, 0)
  const mat = new THREE.MeshBasicMaterial({ map: texOf(img), transparent: true, alphaTest: 0.03, color: new THREE.Color(o.dim ?? 0.8, o.dim ?? 0.8, o.dim ?? 0.8), fog: true })
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.renderOrder = o.order || 0
  scene.add(m)
  const p = people[key] = { key, mesh: m, base: img, face: 'n', until: 0, x, y, z, h, bobAt: -9, nodAt: -9, shakeAt: -9, faint: 0, faintT: 0, gone: 0, goneT: 0, dim: o.dim ?? 0.8, vis: o.vis ?? true }
  m.visible = !!p.vis
  return p
}
function table(key, pos, name) {
  const g = new THREE.Group(); g.position.copy(pos); hall.add(g)
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.04, 40), M.cloth); top.position.y = 0.76; g.add(top)
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.83, 0.9, 0.74, 40, 1, true), M.cloth); skirt.position.y = 0.37; g.add(skirt)
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.5; const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.012, 20), M.plate); pl.position.set(Math.cos(a) * 0.58, 0.785, Math.sin(a) * 0.58); g.add(pl); const gl = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.022, 0.16, 10), M.glass); gl.position.set(Math.cos(a + 0.25) * 0.62, 0.86, Math.sin(a + 0.25) * 0.62); g.add(gl) }
  // 卓の花（写真の切り抜き。カメラの方を向く）。中に火の点いたキャンドルが写っている
  const cp = board('centerpiece', 0.56); if (cp) { cp.position.set(0, 0.765, -0.08); g.add(cp); addFlame(g, -0.2, 0.97, -0.06, 0.07); addFlame(g, 0.2, 0.97, -0.06, 0.07) }
  if (name) { const card = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.125), new THREE.MeshBasicMaterial({ map: textTex(name), fog: true })); card.position.set(0, 0.85, 0.5); card.rotation.x = -0.25; g.add(card); g.userData.card = card }
  return g
}
// 写真の切り抜きの板（下端が原点）。カメラの方を向かせる板は boards に入れる
const boards = []
function board(img, w) { const t = texOf(img); if (!t) return null; const h = w * t.image.height / t.image.width, geo = new THREE.PlaneGeometry(w, h); geo.translate(0, h / 2, 0); const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.05, fog: true, color: 0xe8e0d6 })); boards.push(m); return m }
const tables = {}
function buildHall() {
  // 床・壁・奥の壁（写真）
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 18), new THREE.MeshStandardMaterial({ map: carpetTex(), roughness: 0.95 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -5); hall.add(floor)
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(21, 14), new THREE.MeshBasicMaterial({ map: texOf('bg'), fog: false, color: 0xd8cbb8 })); bg.position.set(0, 4.5, -14); hall.add(bg)
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(18, 7), M.wall); w.position.set(sx * 6.5, 3.5, -5); w.rotation.y = -sx * Math.PI / 2; hall.add(w)
    for (let z = 1; z > -14; z -= 3) { const pil = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7, 0.4), M.gold); pil.position.set(sx * 6.35, 3.5, z); hall.add(pil); const sc = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe2a8 })); sc.position.set(sx * 6.2, 2.3, z - 1.5); hall.add(sc); addFlame(hall, sx * 6.15, 2.3, z - 1.5, 0.7) }
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(14, 18), new THREE.MeshStandardMaterial({ color: 0x3a2a20 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 5.2, -5); hall.add(ceil)
  for (const [x, z] of [[0, -3], [0, -8.5]]) { const ch = new THREE.Group(); ch.position.set(x, 4.3, z); hall.add(ch); for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; addFlame(ch, Math.cos(a) * 0.6, -Math.abs(Math.sin(i)) * 0.2, Math.sin(a) * 0.6, 0.35) } addFlame(ch, 0, -0.3, 0, 1.4); const pl = new THREE.PointLight(0xffd9a0, 6, 9, 1.6); ch.add(pl) }
  // 卓
  const names = { boss: T.GUESTS.boss.table, gran: T.GUESTS.gran.table, ex: T.GUESTS.ex.table, drunk: T.GUESTS.drunk.table }
  for (const k of [...TABLES, 'back1', 'back2', 'side']) tables[k] = table(k, POS[k], names[k] ? tx(names[k]) : null)
  // 人物（卓の奥に座る）。主役は真ん中、ほかは左右に
  for (const k of [...TABLES, 'back1', 'back2', 'side']) {
    const p = POS[k], f = FILL[k]
    if (TABLES.includes(k)) person(k, k, p.x, 0.5, p.z - 0.62, 0.92, { dim: 0.8 })
    person(k + '_f1', f[0], p.x - 0.66, 0.5, p.z - 0.3, 0.9, { dim: 0.62 }); person(k + '_f2', f[1], p.x + 0.66, 0.5, p.z - 0.3, 0.9, { dim: 0.62 })
    if (!TABLES.includes(k)) person(k + '_f3', ['f1', 'f2', 'f3', 'f4'].find(x => !f.includes(x)), p.x, 0.5, p.z - 0.62, 0.9, { dim: 0.6 })
  }
  // 高砂（新郎新婦の席）
  const hc = POS.couple, ht = new THREE.Group(); ht.position.copy(hc); hall.add(ht)
  const tb = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.78, 2.1), M.cloth); tb.position.y = 0.39; ht.add(tb)
  const gar = board('garland', 2.1); if (gar) { gar.position.set(0.42, 0.42, 0); ht.add(gar) }
  const wallF = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.4), new THREE.MeshBasicMaterial({ map: texOf('flowerwall'), color: 0xcfc4b8, fog: true })); wallF.position.set(-1.0, 1.25, 0); wallF.rotation.y = Math.PI / 2; ht.add(wallF)
  person('groom', 'groom', hc.x - 0.45, 0.5, hc.z - 0.38, 0.95, { dim: 0.9 }); person('bride', 'bride', hc.x - 0.45, 0.5, hc.z + 0.38, 0.95, { dim: 0.9 })
  // 司会の台（画像に台が写っている）
  person('mc', 'mc', POS.mc.x, 0, POS.mc.z, 1.85, { dim: 0.85 })
  // 事件の人（ふだんは隠す）
  person('dad', 'dad', 0.95, 0.72, -1.9, 1.02, { dim: 0.95, vis: false }); person('kid', 'kid', 0.62, 0.0, -1.7, 1.0, { dim: 0.95, vis: false }); person('exbf', 'exbf', POS.back1.x + 0.66, 0.5, POS.back1.z - 0.3, 0.9, { dim: 0.95, vis: false })
  // 立っている人（父・子ども・司会）の足元の影
  const shTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c) })()
  for (const k of ['kid', 'dad', 'mc']) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(people[k].x, 0.01, people[k].z); scene.add(m); people[k].shadow = m }
  // 光の当たる卓（目が合っている所）
  const spot = G.spot = new THREE.SpotLight(0xfff0d6, 30, 14, 0.32, 0.6, 1.4); spot.position.set(0, 5, -2); scene.add(spot); scene.add(spot.target)
}
// 卓の物を並べ直す（本音が変わった時も）
function placeItems(k) {
  for (let i = itemMeshes.length - 1; i >= 0; i--) if (itemMeshes[i].userData.table === k) { itemMeshes[i].removeFromParent(); itemMeshes.splice(i, 1) }
  const run = G.run; if (!run || !tables[k] && k !== 'couple') return
  const g = k === 'couple' ? null : tables[k]
  run.items[k].forEach((n, i) => {
    const tex = texOf('i_' + n); if (!tex) return
    const ar = tex.image.width / tex.image.height, w = Math.min(0.22 * ar, 0.27)
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / ar), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05, fog: true }))
    m.geometry.translate(0, m.geometry.parameters.height / 2, 0)
    if (g) { m.position.set(i ? 0.27 : -0.29, 0.78, 0.42); g.add(m) }
    else { m.position.set(POS.couple.x + 0.3, 0.78, POS.couple.z + (i ? 0.2 : -0.2)); scene.add(m) }
    m.userData = { table: k, item: n }; itemMeshes.push(m)
  })
}
function resetHall(run) {
  for (const p of Object.values(people)) { p.face = 'n'; p.until = 0; p.faint = 0; p.faintT = 0; p.gone = 0; p.goneT = 0; p.bobAt = p.nodAt = p.shakeAt = -9; p.enterAt = null; setMap(p.mesh, texOf(p.base)); p.mesh.userData.img = null; p.mesh.position.set(p.x, p.y, p.z) }
  for (const k of ['dad', 'kid', 'exbf']) people[k].vis = false
  for (const k of [...TABLES, 'couple']) placeItems(k)
  setMc(false)
}
const FACES = { boss: 'nhtc', gran: 'nhtc', ex: 'nhtc', drunk: 'nhtc', groom: 'nhg', bride: 'nht' }
function faceImg(p, f) { const ok = FACES[p.key]; if (f === 'n' || !ok || !ok.includes(f)) return p.base; return texOf(p.base + '_' + f) ? p.base + '_' + f : p.base }
function setFace(k, f, sec = 2) {
  if (k === 'couple') { setFace('groom', f === 'c' ? 'n' : f === 't' ? 'h' : f, sec); setFace('bride', f === 'c' ? 'n' : f, sec); return }
  const p = people[k]; if (!p) return; p.face = f; p.until = G.t + sec
}
const bob = k => { if (k === 'couple') { bob('groom'); bob('bride'); return } if (people[k]) people[k].bobAt = G.t }
const nod = k => { if (k === 'couple') { nod('groom'); nod('bride'); return } if (people[k]) people[k].nodAt = G.t }
const shakeP = k => { if (k === 'couple') return; if (people[k]) people[k].shakeAt = G.t }
const faint = (k, v) => { if (people[k]) people[k].faintT = v }
const leave = k => { if (people[k]) people[k].goneT = 1 }
function setMap(m, t) { if (!t || m.material.map === t) return; const was = !!m.material.map; m.material.map = t; if (!was) m.material.needsUpdate = true }
function setMc(w) { const p = people.mc; if (p) { p.face = w ? 'w' : 'n'; p.until = w ? 1e9 : 0; setMap(p.mesh, texOf(w ? 'mc_w' : 'mc') || texOf('mc')) } }
function showEventVisual(k, on) {
  if (k === 'dad' || k === 'kid' || k === 'exbf') { const p = people[k]; p.vis = on; p.enterAt = G.t; if (on) aim(k) }
  if (k === 'knife') { aim('mc'); people.mc.bobAt = G.t }
  if (k === 'shout' && on) { aim('drunk'); setFace('drunk', 'h', 6); bob('drunk') }
  if (k === 'howl' && on) aim('wide')
}

// ---------- カメラ（自分の肩越し。目が合った卓に寄る）
const AIM = {}
function aimSpec(k) {
  if (k === 'wide') return { at: new THREE.Vector3(0.9, 0.9, -6.2), fov: 52 }
  if (k === 'couple') return { at: new THREE.Vector3(POS.couple.x - 0.2, 1.0, POS.couple.z), fov: 34 }
  if (k === 'mc') return { at: new THREE.Vector3(POS.mc.x, 1.25, POS.mc.z), fov: 34 }
  if (k === 'dad') return { at: new THREE.Vector3(0.95, 1.25, -1.9), fov: 44 }
  if (k === 'kid') return { at: new THREE.Vector3(0.62, 0.7, -1.7), fov: 46 }
  if (k === 'exbf') return { at: new THREE.Vector3(POS.back1.x + 0.5, 1.0, POS.back1.z), fov: 20 }
  const p = POS[k], dist = CAM0.distanceTo(p)
  // 縦長の画面は横が狭いので、卓の物（中心から左右に約0.3m）が横に収まるところまで引く
  const asp = VW / Math.max(1, VH), side = 2 * Math.atan(0.62 / dist / asp) * 180 / Math.PI
  return { at: new THREE.Vector3(p.x, 1.0, p.z), fov: THREE.MathUtils.clamp(Math.max(2 * Math.atan(1.0 / dist) * 180 / Math.PI, side), 14, 48) }
}
function aim(k) { G.aimKey = k; const s = aimSpec(k); AIM.at = s.at; AIM.fov = s.fov; if (G.spot) { const p = POS[k]; G.spotOn = !!(p && TABLES.includes(k)) || k === 'couple'; if (p) { G.spot.target.position.set(p.x, 0.7, p.z); G.spot.position.set(p.x + 0.4, 5, p.z + 1.5) } } }
const camAt = new THREE.Vector3(0.1, 0.85, -6), camPos = CAM0.clone(); let camFov = 50
function updateCamera(dt, snap) {
  if (!AIM.at) aim('wide')
  const k = snap ? 1 : 1 - Math.exp(-dt * 3.2)
  camAt.lerp(AIM.at, k); camFov += (AIM.fov - camFov) * k
  const sway = Math.sin(G.t * 0.7) * 0.012, sh = G.shake > 0 ? (Math.random() - 0.5) * 0.03 * G.shake : 0
  camPos.set(CAM0.x + sway + sh, CAM0.y + Math.sin(G.t * 0.9) * 0.008, CAM0.z)
  camera.position.copy(camPos); camera.fov = camFov; camera.aspect = VW / Math.max(1, VH); camera.updateProjectionMatrix()
  camera.lookAt(camAt)
  // 狙った物を、紙より上の見えている所の真ん中あたりに
  const f = G.mode === 'title' || G.mode === 'end' ? 0.5 : Math.max(0.2, (G.noteTop || VH * 0.6) / VH * 0.48)
  const a = Math.atan((0.5 - f) * 2 * Math.tan(camFov * Math.PI / 360))
  camera.rotateX(-a)
}
function updatePeople(dt) {
  const tmp = new THREE.Vector3()
  for (const p of Object.values(people)) {
    const m = p.mesh
    // 顔
    if (p.key !== 'mc') { const want = G.t < p.until ? p.face : 'n'; const img = faceImg(p, want); if (m.userData.img !== img && texOf(img)) { setMap(m, texOf(img)); m.userData.img = img } }
    // 絵が届いていない人は出さない（白い板にしない）
    if (!p.vis || !m.material.map) { m.visible = false; if (p.shadow) p.shadow.visible = false; continue }
    m.visible = true; if (p.shadow) { p.shadow.visible = true; p.shadow.position.x = m.position.x }
    // 向き（カメラへ。横だけ回す）
    tmp.set(camera.position.x, m.position.y, camera.position.z); m.lookAt(tmp)
    // 動き: 乗り出す・うなずく・首を振る・倒れかける・立ち去る
    const bk = Math.max(0, 1 - (G.t - p.bobAt) / 0.8), nk = Math.max(0, 1 - (G.t - p.nodAt) / 1.2), sk = Math.max(0, 1 - (G.t - p.shakeAt) / 0.5)
    p.faint += (p.faintT - p.faint) * Math.min(1, dt * 3); p.gone += (p.goneT - p.gone) * Math.min(1, dt * 1.2)
    let y = p.y + Math.sin(bk * Math.PI) * 0.06 + Math.sin(G.t * 1.3 + p.x) * 0.006, x = p.x + Math.sin(G.t * 40) * 0.02 * sk, z = p.z
    if (p.gone > 0.01) { y += 0.3 * Math.min(1, p.gone * 2); x += p.gone * 2.4 }
    if (p.enterAt != null && p.key === 'dad') x += Math.max(0, 1 - (G.t - p.enterAt) / 0.8) * 1.8
    m.position.set(x, y, z)
    m.rotateX(-Math.sin(nk * Math.PI * 2) * 0.08)
    m.rotateZ(-p.faint * 0.9)
    // 目が合っている人だけ明るく
    const lit = G.mode !== 'title' && (G.run && (G.run.fk === p.key || (G.run.fk === 'couple' && (p.key === 'groom' || p.key === 'bride')))) || ['dad', 'kid', 'exbf'].includes(p.key) || (G.aimKey === 'couple' && (p.key === 'groom' || p.key === 'bride')) || (G.aimKey === 'mc' && p.key === 'mc')
    const target = lit ? 1.04 : p.dim, c = m.material.color; c.r += (target - c.r) * Math.min(1, dt * 4); c.g = c.b = c.r
  }
  for (const it of [...itemMeshes, ...boards]) { it.getWorldPosition(tmp); const lk = new THREE.Vector3(camera.position.x, tmp.y, camera.position.z); it.lookAt(lk) }
  for (let i = 0; i < flames.length; i++) { const f = flames[i], s = f.userData.s || (f.userData.s = f.scale.x); const k = 1 + Math.sin(G.t * 11 + i * 1.7) * 0.08; f.scale.set(s * k, s * 1.5 * k, s) }
  if (G.spot) G.spot.intensity += ((G.spotOn ? 30 : 0) - G.spot.intensity) * Math.min(1, dt * 3)
}

// ---------- 画面の大きさ・文字の位置
let VW = innerWidth, VH = innerHeight, DPR = 1
function resize() {
  VW = innerWidth; VH = innerHeight; DPR = Math.min(2, window.devicePixelRatio || 1)
  renderer.setPixelRatio(DPR); renderer.setSize(VW, VH, false)
  layout(); if (!$('#vEnd').hidden) fitLetter()
}
const proj = new THREE.Vector3()
function headOf(k) {
  if (k === 'couple') return new THREE.Vector3(POS.couple.x - 0.45, 1.5, POS.couple.z)
  if (k === 'mc') return new THREE.Vector3(POS.mc.x, 1.75, POS.mc.z)
  const p = people[k]; if (!p) return null
  return new THREE.Vector3(p.mesh.position.x, p.mesh.position.y + p.h * 0.92, p.mesh.position.z)
}
function layout() {
  const note = $('#note'); if (!note || $('#vPlay').hidden) return
  const clueTop = $('#clueRow').getBoundingClientRect().top
  G.noteTop = clueTop
  const me = $('#me'); me.style.top = Math.round(clueTop - me.offsetHeight * 0.62) + 'px'
  const b = $('#bubble'); if (b.hidden) return
  const bh = b.offsetHeight, bw = b.offsetWidth
  if (b.classList.contains('me')) { b.style.left = '16px'; b.style.top = Math.round(clueTop - bh - 10) + 'px'; return }
  let x = VW / 2, y = 90
  const h = G.anchor && headOf(G.anchor)
  if (h) { proj.copy(h).project(camera); if (proj.z < 1) { x = (proj.x * 0.5 + 0.5) * VW; y = (-proj.y * 0.5 + 0.5) * VH - bh - 14 } }
  x = Math.max(bw / 2 + 10, Math.min(VW - bw / 2 - 10, x)); y = Math.max(58, Math.min(clueTop - bh - 12, y))
  b.style.left = Math.round(x) + 'px'; b.style.top = Math.round(y) + 'px'
}
function placeHand() {
  const h = $('#hand'); if (h.hidden || !G.run) return
  const it = itemMeshes.find(m => m.userData.table === G.run.fk); if (!it) return
  it.getWorldPosition(proj); proj.y += 0.08; proj.project(camera)
  h.style.left = Math.round((proj.x * 0.5 + 0.5) * VW - 6) + 'px'; h.style.top = Math.round((-proj.y * 0.5 + 0.5) * VH + 4) + 'px'
}

// ---------- キャンドル（残り時間）。火が小さくなり、消えると黙ったことになる。バーは出さない
const cc = $('#candle').getContext('2d')
function drawCandle() {
  const W = 88, H = 128, x = cc, c = G.clock
  const left = c ? Math.max(0, Math.min(1, (c.t1 - G.t) / (c.t1 - c.t0))) : 1, live = !!c
  x.clearRect(0, 0, W, H)
  // 受け皿と蝋
  x.fillStyle = '#c9a25e'; x.beginPath(); x.ellipse(44, 118, 30, 7, 0, 0, 7); x.fill()
  const top = 66; const g = x.createLinearGradient(30, 0, 58, 0); g.addColorStop(0, '#f2e6cf'); g.addColorStop(0.5, '#fffaf0'); g.addColorStop(1, '#e3d4b8'); x.fillStyle = g; x.fillRect(31, top, 26, 114 - top)
  x.fillStyle = '#fffaf0'; x.beginPath(); x.ellipse(44, top, 13, 4, 0, 0, 7); x.fill()
  x.strokeStyle = '#2b2218'; x.lineWidth = 2; x.beginPath(); x.moveTo(44, top); x.lineTo(44 + (left < 0.3 && live ? Math.sin(G.t * 9) * 2 : 0), top - 9); x.stroke()
  if (left <= 0.001 && live) { x.strokeStyle = 'rgba(200,200,200,.5)'; x.lineWidth = 2; x.beginPath(); for (let i = 0; i < 10; i++) x.lineTo(44 + Math.sin(G.t * 3 + i) * 5, top - 12 - i * 5); x.stroke(); return }
  // 火: 残り時間で大きさ、残り少ないと揺れて傾く
  const s = 0.35 + 0.65 * left, wob = left < 0.3 && live ? Math.sin(G.t * 23) * (1 - left / 0.3) : Math.sin(G.t * 7) * 0.08
  x.save(); x.translate(44, top - 9); x.rotate(wob * 0.35); x.scale(s, s)
  const fg = x.createRadialGradient(0, -16, 2, 0, -14, 30); fg.addColorStop(0, 'rgba(255,240,190,.55)'); fg.addColorStop(1, 'rgba(255,170,60,0)'); x.fillStyle = fg; x.beginPath(); x.arc(0, -16, 30, 0, 7); x.fill()
  x.fillStyle = '#ffb648'; x.beginPath(); x.moveTo(0, -46); x.bezierCurveTo(12, -26, 11, -8, 0, 0); x.bezierCurveTo(-11, -8, -12, -26, 0, -46); x.fill()
  x.fillStyle = '#fff3c8'; x.beginPath(); x.moveTo(0, -30); x.bezierCurveTo(6, -18, 5, -6, 0, -2); x.bezierCurveTo(-5, -6, -6, -18, 0, -30); x.fill()
  x.restore()
}

// ---------- 写真（お礼状に貼る）
function takeSnap() {
  renderFrame()
  const c = document.createElement('canvas'), w = cv.width, h = cv.height, ch = Math.min(h, Math.round(w * 0.62))
  c.width = Math.min(900, w); c.height = Math.round(c.width * ch / w)
  const y0 = Math.max(0, Math.round((G.noteTop || h * 0.6) * DPR * 0.5 - ch / 2))
  c.getContext('2d').drawImage(cv, 0, y0, w, ch, 0, 0, c.width, c.height)
  G.snap = c
}
function snapLater() { later(0.9, () => { if (!G.snap) takeSnap() }) }

// ---------- ループ（固定60Hz）
let acc = 0, last = performance.now(), paused = false
function stepSim(dt) {
  G.t += dt
  const due = G.tasks.filter(t => t.at <= G.t); G.tasks = G.tasks.filter(t => t.at > G.t); for (const t of due) t.fn()
  const run = G.run, c = G.clock
  if (G.mode === 'play' && run && run.state === 'turn' && c) {
    if (!$('#how').hidden) { c.t1 += dt; c.t0 += dt }
    else {
      const left = (c.t1 - G.t) / (c.t1 - c.t0)
      if (G.t > c.t0) Tension(Math.min(1, Math.max(0, 1 - left)))
      if (left < 0.5 && people.mc && people.mc.face !== 'w') setMc(true)
      if (left < 0.22 && !c.howled) { c.howled = true; Howl(0.18); G.shake = 0.5 }
      if (G.t >= c.t1) silence()
    }
  }
  const ev = G.ev
  if (G.mode === 'event' && ev && ev.state === 'on') {
    if (!ev.shown && G.t >= ev.at + ev.delay) { ev.shown = true; setEvLines() }
    if (G.t >= ev.t1) evResolve(false, null)
  }
  G.shake = Math.max(0, G.shake - dt * 1.2); G.flash *= 0.92
  updateCamera(dt); updatePeople(dt)
}
// 司会ののぞき込み（0=隠れる、1=半分のぞく）。残り時間が半分を切ると出てくる
function peekAmount() { const c = G.clock; if (G.mode === 'stop') return 1; if (!c || G.mode !== 'play') return G.peekHold && G.t < G.peekHold ? 1 : 0; const left = (c.t1 - G.t) / (c.t1 - c.t0); return left < 0.5 ? Math.min(1, (0.5 - left) / 0.35) : 0 }
let peekK = 0
function renderFrame() { peekK += (peekAmount() - peekK) * 0.12; const pk = $('#mcPeek'); if (pk) pk.style.transform = `translateX(${(100 - 60 * peekK).toFixed(1)}%)`; renderer.render(scene, camera); drawCandle(); layout(); placeHand(); $('#flash').style.opacity = G.flash > 0.01 ? G.flash : 0 }
function frame() {
  const n = performance.now(); let dt = Math.min(0.25, (n - last) / 1000); last = n
  if (!paused) { acc += dt; while (acc >= 1 / 60) { stepSim(1 / 60); acc -= 1 / 60 } }
  renderFrame(); requestAnimationFrame(frame)
}

// ---------- 入力
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
function tapAt(X, Y) {
  if (!G.run || (G.mode !== 'play' && G.mode !== 'event')) return null
  ndc.set(X / VW * 2 - 1, -(Y / VH) * 2 + 1); ray.setFromCamera(ndc, camera)
  const hit = ray.intersectObjects(itemMeshes, false)[0]
  let obj = hit && hit.object
  if (!obj) { // 物は画面で小さいので、指が少し外れても一番近い物を拾う（44px 以内）
    let best = 44
    for (const m of itemMeshes) { m.getWorldPosition(proj); proj.y += 0.06; proj.project(camera); if (proj.z > 1) continue
      const d = Math.hypot((proj.x * 0.5 + 0.5) * VW - X, (-proj.y * 0.5 + 0.5) * VH - Y); if (d < best) { best = d; obj = m } }
  }
  if (!obj) return null
  const n = obj.userData.item; setClue(tx(T.ITEMS[n])); Sfx('tap'); $('#hand').hidden = true
  return n
}
function itemXY(n) { const it = itemMeshes.find(m => m.userData.item === n && m.userData.table === G.run.fk); if (!it) return null; it.getWorldPosition(proj); proj.y += 0.06; proj.project(camera); return { x: (proj.x * 0.5 + 0.5) * VW, y: (-proj.y * 0.5 + 0.5) * VH } }
function tapItem(n) { const it = itemMeshes.find(m => m.userData.item === n && m.userData.table === G.run.fk); if (!it) return null; it.getWorldPosition(proj); proj.y += 0.06; proj.project(camera); return tapAt((proj.x * 0.5 + 0.5) * VW, (-proj.y * 0.5 + 0.5) * VH) }
function buildHow() { const u = L(); $('#howBody').innerHTML = `<h2>${u.howto}</h2>` + u.how.map(s => `<p>${s}</p>`).join('') + `<small>${u.legal}</small><a href="privacy.html">${u.privacy}</a>` }
function applyLang() {
  const u = L(); document.documentElement.lang = lang; document.title = lang === 'ja' ? '結婚式の友人スピーチ（原稿が飛んだ）' : 'Best Man, No Notes'
  $('#tSeries').textContent = u.series; $('#tTitle').innerHTML = lang === 'ja' ? '結婚式の<br>友人スピーチ<em>原稿が飛んだ</em>' : 'BEST MAN,<br>NO NOTES<em>wedding toast</em>'
  $('#tSub').textContent = u.sub; $('#bStart').textContent = u.start; $('#bHow').textContent = u.howto; $('#howBtn').textContent = u.close; $('#loadT').textContent = u.load
  $('#bLang').textContent = lang === 'ja' ? 'EN' : 'JA'
  $('#bSayNext').textContent = u.next; $('#bSaySkip').textContent = u.skip; $('#bSave').textContent = u.save; $('#bPost').textContent = u.post; $('#bAgain').textContent = u.again; $('#bTitle').textContent = u.toTitle
  buildHow()
  for (const k of Object.keys(tables)) { const card = tables[k].userData.card; if (card && T.GUESTS[k]) { card.material.map = textTex(tx(T.GUESTS[k].table), { size: lang === 'ja' ? 84 : 40 }); card.material.needsUpdate = true } }
  if (G.mode === 'intro') sayLine()
  const run = G.run
  if (run && run.state === 'turn' && G.mode === 'play') present(true)
  if (G.mode === 'event' && G.ev && G.ev.state === 'on') { say(tx(G.ev.E.line), $('#bubble').className, G.anchor); if (G.ev.cue) setClue(tx(G.ev.cue), 'tip'); setEvLines() }
  if (G.mode === 'end' && G.result) drawLetter()
}
function bind() {
  const on = (id, fn) => $(id).addEventListener('click', e => { Snd.init(); fn(e) })
  on('#bStart', () => { Sfx('tap'); startRun() })
  on('#bHow', () => { $('#how').hidden = false }); on('#howBtn', () => { $('#how').hidden = true })
  on('#bLang', () => { lang = lang === 'ja' ? 'en' : 'ja'; store.set('ws_lang', lang); applyLang() })
  on('#bMute', () => { Snd.setMute(!Snd.muted); muteIcon() })
  on('#bSayNext', introNext); on('#bSaySkip', introEnd)
  on('#bStop', () => result())
  on('#bAgain', () => { Sfx('tap'); startRun() })
  on('#bTitle', () => { G.gen++; G.mode = 'title'; G.run = null; G.result = null; hideAll(); aim('wide'); show('vTitle') })
  on('#bSave', () => { window.TM && TM.share('save'); $('#letter').toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'wedding-speech.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000) }) })
  on('#bPost', () => {
    window.TM && TM.share('x'); const u = L(), r = G.result
    const text = u.shareText(u.rankName[r.rk], r.laugh, r.tear, r.jiko)
    open('https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent('https://tom3games.github.io/wedding-speech/'), '_blank')
  })
  cv.addEventListener('pointerdown', e => tapAt(e.clientX, e.clientY))
  window.addEventListener('resize', resize)
  document.addEventListener('click', e => { if (e.target && e.target.id === 'tmSupport') window.TM && TM.support() })
}
function muteIcon() { $('#icoSnd').style.opacity = Snd.muted ? 0.35 : 1; $('#bMute').setAttribute('aria-pressed', Snd.muted ? 'true' : 'false') }


// ---------- 検証の窓口
window.WS = {
  G, D, T, NUM, Snd, buildRun, choose, result, rankOf, score, tapAt, tapItem, itemXY, evCorrect, people, itemMeshes, takeSnap, drawLetter,
  start: (seed, o) => startRun(seed, o),
  forceEvent: (k, cueK) => { const run = G.run; if (G.mode !== 'play' || !run || run.state !== 'turn') return false; const E = D.EVENTS[k]; run.state = 'react'; G.clock = null; startEvent({ k, after: run.step, cue: E.cues ? (E.cues.find(c => c.k === cueK) || E.cues[0]) : null, delay: 0.6, done: true }); return true },
  // 画面に出ている物だけを返す（読むbotはここしか見ない）。_want と grades は検証と「わざと外す」botだけが使う
  state: () => {
    const run = G.run, c = run && run.choices, ev = G.ev, fk = run ? run.fk : null
    return {
      mode: G.mode, phase: run ? run.state : null, step: run ? run.step : -1, focus: fk,
      items: run && fk ? [...run.items[fk]] : [], itemsW: run && fk ? run.items[fk].map(k => T.ITEMS[k].w) : [], gestW: run && run.gest ? run.gest.w : null,
      styles: c ? c.map(o => o.st) : [], texts: c ? c.map(o => o.t.ja) : [], lines: [...document.querySelectorAll('#paper .ln')].map(b => b.textContent),
      _want: run && fk ? run.wants[fk] : null, grades: c && run ? c.map(o => o.st === run.wants[fk] ? 'H' : o.st === 'b' ? 'B' : 'M') : [],
      ev: ev ? { k: ev.k, kind: ev.E.kind, state: ev.state, shown: ev.shown, cue: ev.cue ? ev.cue.k : null, opts: ev.order.map(i => ev.E.opts[i].k) } : null,
      left: G.clock ? G.clock.t1 - G.t : null, limit: G.clock ? G.clock.t1 - G.clock.t0 : null,
      laugh: run ? run.laugh : 0, tear: run ? run.tear : 0, jiko: run ? run.jiko : 0, silent: run ? run.silent : 0, hits: run ? run.hits : 0, misses: run ? run.misses : 0, evOk: run ? run.evOk : 0, evAll: run ? run.evAll : 0,
      ended: G.ended, score: score(), rk: G.result ? G.result.rk : null,
      bubble: $('#bubble').hidden ? null : $('#bubble').textContent, clue: $('#clue').hidden ? null : $('#clue').textContent,
    }
  },
  dbg: { pause: p => { paused = p }, step: n => { for (let i = 0; i < n; i++) stepSim(1 / 60); renderFrame() }, render: renderFrame, tick: n => { for (let i = 0; i < n; i++) stepSim(1 / 60) } },
  aimTo: k => aim(k),
  setLang: l => { lang = l; applyLang() },
}

// ---------- 起動: 本物の読み込み数でキャンドルの蝋が積もる
const FIRST = ['bg', 'centerpiece', 'garland', 'flowerwall', 'boss', 'gran', 'ex', 'drunk', 'groom', 'bride', 'mc', 'f1', 'f2', 'f3', 'f4', ...Object.keys(T.ITEMS).map(k => 'i_' + k)]
const LATER = ['mc_w', 'groom_h', 'groom_g', 'bride_h', 'bride_t', 'dad', 'kid', 'exbf', ...['boss', 'gran', 'ex', 'drunk'].flatMap(k => ['_h', '_t', '_c'].map(f => k + f))]
let done = 0
const FILLW = () => { const k = done / FIRST.length, h = 58 * k; const f = $('#loadWax'); f.setAttribute('y', 108 - h); f.setAttribute('height', h) }
const hideLoad = () => { const l = $('#loading'); if (l.dataset.gone) return; l.dataset.gone = 1; l.style.opacity = 0; setTimeout(() => { l.hidden = true }, 360) }
setTimeout(hideLoad, 12000)
resize(); applyLang(); muteIcon(); bind(); setLines(null)
Promise.all(FIRST.map(n => loadTex(n).then(() => { done++; FILLW() }))).then(() => {
  buildHall(); aim('wide'); updateCamera(0, true)
  document.fonts && document.fonts.load && Promise.all(['800 30px "Shippori Mincho B1"', '600 30px "Klee One"', '700 16px "Zen Kaku Gothic New"'].map(f => document.fonts.load(f, 'あ'))).then(() => applyLang()).catch(() => {})
  hideLoad(); requestAnimationFrame(frame); window.__wsReady = true
  Promise.all(LATER.map(loadTex)).then(() => { window.__wsAll = true })
})
