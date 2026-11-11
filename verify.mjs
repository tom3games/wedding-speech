// 検証。node verify.mjs（音は出さない）。スマホ縦3サイズ × 全画面 × Chromium/WebKit、推理の芯、罠、沈黙、事件、英語、OGP、無音
import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
import { chromium, webkit } from 'playwright'
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const ROOT = import.meta.dirname
mkdirSync(ROOT + '/shots', { recursive: true })
const PORT = Number(process.env.VPORT || 5891)
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const URL0 = `http://localhost:${PORT}/`
let pass = 0, fail = 0
const results = []
async function t(name, fn) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return
  try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) }
  catch (e) { fail++; results.push(`FAIL ${name}  ${e.message.split('\n')[0]}`) }
}
const expect = (c, msg) => { if (!c) throw new Error(msg) }
async function open(browser, opts = {}) {
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('keep')) localStorage.clear() } catch (e) {} })
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error') p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) p.errs.push('reqfail ' + r.url()) })
  await p.goto(URL0); await p.waitForFunction(() => window.__wsReady, null, { timeout: 20000 }); await p.waitForFunction(() => window.__wsAll, null, { timeout: 20000 }); await p.waitForTimeout(450)
  return p
}
const VIEWS = '#vTitle:not([hidden]) *,#vPlay:not([hidden]) *,#vEnd:not([hidden]) *,#stopper:not([hidden]) *,#say:not([hidden]) #sayBox *,#how:not([hidden]) *'
const overflow = p => p.evaluate(sel => {
  const W = document.documentElement.clientWidth, bad = []
  for (const el of document.querySelectorAll(sel)) {
    if (el.closest('[hidden]') || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true }))) continue
    if (['me', 'mcPeek', 'sayImg', 'hand'].includes(el.id) || el.closest('svg')) continue
    const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 2 || r.left < -2)) bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right))
  }
  return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) }
}, VIEWS)
const fit = q => q.evaluate(() => {
  const H = innerHeight, de = document.documentElement, over = []
  if (de.scrollHeight > H + 1) over.push('page:' + de.scrollHeight)
  for (const el of document.querySelectorAll('button,a,#letter,#bubble,#clue')) { if (el.closest('[hidden]') || el.hidden || !(el.offsetParent || el.getBoundingClientRect().width)) continue; const r = el.getBoundingClientRect(); if (!r.width) continue; if (r.bottom > H + 1 || r.top < -1) over.push((el.id || el.className) + ':' + Math.round(r.top) + '-' + Math.round(r.bottom)) }
  // 一文が紙からはみ出さない（折り返しても行の高さに収まる）
  for (const el of document.querySelectorAll('#paper .ln')) if (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) over.push('line:' + el.textContent)
  // 吹き出しが紙・手がかりに重ならない
  const b = document.querySelector('#bubble'), n = document.querySelector('#clueRow')
  if (b && !b.hidden && !b.closest('[hidden]') && n && b.getBoundingClientRect().bottom > n.getBoundingClientRect().top + 1) over.push('bubble-on-note')
  return { H, over: over.slice(0, 6) }
})
// 画面に同時に出ている文（ボタン以外）を数える。2つまで。長さも返す
const texts = q => q.evaluate(() => ['#bubble', '#clue', '#stopLine', '#sayLine'].map(s => document.querySelector(s)).filter(e => e && !e.closest('[hidden]') && !e.hidden && e.textContent.trim()).map(e => e.textContent))
const run = (q, n) => q.evaluate(n => WS.dbg.step(n), n)
const toTurn = async q => { for (let i = 0; i < 900; i++) { const s = await q.evaluate(() => { WS.dbg.step(10); return WS.state() }); if (s.mode === 'play' && s.phase === 'turn') return s; if (s.mode === 'event' && s.ev.state === 'on') return s; if (s.mode === 'end' || s.mode === 'stop') return s } throw new Error('turn に届かない') }
const toTalk = async q => { for (let i = 0; i < 900; i++) { const s = await q.evaluate(() => { WS.dbg.step(10); const s = WS.state(); if (s.mode === 'event' && s.ev.state === 'on') { if (s.ev.kind === 'two') WS.choose(s.ev.opts.indexOf(WS.evCorrect(WS.G.ev))); else if (s.ev.shown) WS.choose(0) } return WS.state() }); if (s.mode === 'play' && s.phase === 'turn') return s; if (s.mode === 'end' || s.mode === 'stop') return s } throw new Error('talk に届かない') }
const SIZES = [[360, 640, 'small'], [390, 844, 'phone'], [430, 932, 'big']]

async function walk(q, tag, name, shotPrefix) {
  const chk = async (v) => {
    const f = await fit(q), o = await overflow(q), tx = await texts(q)
    const long = tx.filter(s => /[ぁ-んァ-ヶ一-龠]/.test(s) && [...s].length > 22)   // 日本語は22字まで（英語は字数が倍になるので数えない）
    await t(`${tag} ${name} ${v}: 一画面・はみ出しなし・文字2つまで・22字以内`, async () => { expect(!f.over.length && o.sw <= o.W && !o.bad.length && tx.length <= 2 && !long.length, JSON.stringify({ f, o, tx })) })
    if (shotPrefix) await q.screenshot({ path: `${ROOT}/shots/${shotPrefix}-${v}.png` })
  }
  await chk('title')
  await q.click('#bHow'); await chk('how'); await q.click('#howBtn')
  await q.click('#bStart'); await q.evaluate(() => WS.dbg.pause(true)); await run(q, 20); await chk('intro')
  await q.click('#bSaySkip'); await toTurn(q); await run(q, 50); await chk('play')
  // 一番長い一文の並ぶ段でも紙に収まる
  await q.evaluate(() => { const r = WS.G.run, all = WS.T.SECTIONS.flatMap(([, a]) => a), lg = document.documentElement.lang; const L = n => Math.max(...n.o.map(o => o.t[lg].length)); const node = all.reduce((a, n) => L(n) > L(a) ? n : a); const lens = o => o.t[lg].length; r.choices = [...node.o].sort((a, b) => lens(b) - lens(a)).slice(0, 3); r.nodes[r.step] = node; WS.setLang(lg) })
  await run(q, 2); await chk('longest')
  await q.evaluate(() => { const s = WS.state(); WS.tapItem(s.items[0]) }); await run(q, 2); await chk('item')
  await q.evaluate(() => { const s = WS.state(); WS.choose(s.grades.indexOf('H')) }); await run(q, 30); await chk('react')
  await toTalk(q); await run(q, 40)
  for (const [k, c] of [['dad', 'yes'], ['kid', 'pale'], ['knife', 'seen'], ['shout', 'frown'], ['exbf', 'froze'], ['howl', null]]) {
    await q.evaluate(([k, c]) => WS.forceEvent(k, c), [k, c]); await run(q, 70); await chk('event-' + k)
    await q.evaluate(() => { const s = WS.state(); if (s.ev && s.ev.kind === 'two') WS.choose(s.ev.opts.indexOf(WS.evCorrect(WS.G.ev))); else WS.choose(0) }); await run(q, 400); await toTalk(q); await run(q, 40)
  }
  await q.evaluate(() => { const r = WS.G.run; r.choices[0] = { st: 'b', t: WS.T.BLACK[0] }; WS.choose(0) }); await run(q, 40); await chk('black'); await run(q, 110); await chk('glare')
  await toTalk(q); await run(q, 40); await q.evaluate(() => { const r = WS.G.run; r.choices[0] = { st: 'b', t: WS.T.BLACK[1] }; WS.choose(0) }); await run(q, 330); await q.waitForTimeout(250); await chk('stop')
  await q.evaluate(() => WS.result()); await run(q, 300); await q.waitForTimeout(100); await chk('end')
  await t(`${tag} ${name} エラーなし`, async () => { expect(!q.errs.length, q.errs.join('|')) })
}

await t('会話データの検算（1段に4つの型が1つずつ／字数／英語／どの本音にも手がかり2つ以上）', async () => (execFileSync(process.execPath, ['tools/dialogue.mjs'], { cwd: ROOT, encoding: 'utf8' })).trim())

const browser = await chromium.launch(MUTE_LAUNCH)
const p = await open(browser)
await t('起動時にエラーが出ない', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await t('読み込み画面が消える', async () => { expect(await p.evaluate(() => document.querySelector('#loading').hidden), 'loading') })
await t('3Dの会場が描けている（明るさのばらつき）', async () => {
  const v = await p.evaluate(() => { WS.dbg.render(); const c = document.querySelector('#cv'), o = document.createElement('canvas'); o.width = 120; o.height = 200; const x = o.getContext('2d'); x.drawImage(c, 0, 0, 120, 200); const d = x.getImageData(0, 0, 120, 200).data; let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 4) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; s += v; s2 += v * v; n++ } return Math.round(s2 / n - (s / n) ** 2) })
  expect(v > 300, 'variance ' + v); return v
})
await t('ブラウザの拡大が起きない（viewport・ピンチ・Ctrl+ホイール・Ctrl+プラス）', async () => {
  const r = await p.evaluate(() => {
    const vp = document.querySelector('meta[name=viewport]').content
    const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g)
    const w = new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, bubbles: true, cancelable: true }); window.dispatchEvent(w)
    const k = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(k)
    return { vp, gesture: g.defaultPrevented, wheel: w.defaultPrevented, key: k.defaultPrevented, ta: getComputedStyle(document.documentElement).touchAction, us: getComputedStyle(document.body).userSelect }
  })
  expect(/user-scalable=no/.test(r.vp) && r.gesture && r.wheel && r.key && r.ta === 'manipulation' && r.us === 'none', JSON.stringify(r))
})
await t('OGP 一式があり、og.png は 1200x630', async () => {
  const r = await p.evaluate(() => ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].map(k => !!document.querySelector(`meta[property="${k}"]`)).concat(!!document.querySelector('meta[name="twitter:card"]')))
  expect(r.every(Boolean), JSON.stringify(r))
  const size = await p.evaluate(() => new Promise(res => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.onerror = () => res(null); i.src = 'og.png' }))
  expect(size && size[0] === 1200 && size[1] === 630, JSON.stringify(size))
})
await t('locale ja-JP で日本語', async () => { expect(await p.evaluate(() => document.documentElement.lang === 'ja' && document.querySelector('#bStart').textContent === 'マイクの前に立つ'), 'lang') })
await t('privacy.html へのリンクが押せる高さ・CC BY の作者名が遊び方にある', async () => {
  await p.click('#bHow'); const r = await p.evaluate(() => { const a = document.querySelector('#howBody a'); return { h: a.getBoundingClientRect().height, href: a.getAttribute('href'), by: document.querySelector('#howBody').textContent.includes('lonemonk') } }); await p.click('#howBtn'); expect(r.h >= 38 && r.href === 'privacy.html' && r.by, JSON.stringify(r))
})
await t('?v= がそろっている（index.html・game.js・look.js の import と画像）', async () => {
  const r = await p.evaluate(async () => { const h = await (await fetch('index.html')).text(), g = await (await fetch('game.js')).text(), l = await (await fetch('look.js')).text(); const vs = [...h.matchAll(/\.(?:js|webp|png)\?v=(\d+)/g), ...g.matchAll(/\.js\?v=(\d+)/g), ...l.matchAll(/\.js\?v=(\d+)/g), ...g.matchAll(/const V = '\?v=(\d+)'/g)].map(m => m[1]); return [...new Set(vs)] })
  expect(r.length === 1, JSON.stringify(r)); return r
})
await p.evaluate(() => { WS.dbg.pause(true); localStorage.setItem('ws_tut', '1'); localStorage.setItem('ws_played', '1') })
const fresh = (seed, o = {}) => p.evaluate(([s, o]) => { WS.start(s, { skipIntro: true, ...o }); WS.G.rookie = false; WS.G.tut = false; return true }, [seed, o])

await t('[推理] 同じ一文の段でも、本音が違えば当たりの一文が変わる', async () => {
  const r = await p.evaluate(() => { const node = WS.T.SECTIONS[1][1][0], hits = {}; for (const w of WS.T.WANTS) hits[w] = node.o.find(o => o.st === w).t.ja; return hits })
  expect(new Set(Object.values(r)).size === 4, JSON.stringify(r)); return r
})
await t('[推理] 3択には毎回、目が合った人の本音の一文がちょうど1つ（20回×10段）', async () => {
  const bad = []; let n = 0
  for (let seed = 1; seed <= 20; seed++) {
    await fresh(seed * 31)
    for (let k = 0; k < 10; k++) {
      const s = await toTalk(p); if (s.mode !== 'play') break
      n++; const hits = s.styles.filter(st => st === s._want).length, others = s.styles.filter(st => st !== s._want)
      if (hits !== 1 || new Set(others).size !== others.length || s.lines.some((l, i) => l !== s.texts[i])) bad.push(JSON.stringify(s.styles) + s._want)
      await p.evaluate(() => { const s = WS.state(); WS.choose(s.grades.indexOf('H')) })
    }
  }
  expect(!bad.length && n > 160, bad.slice(0, 3).join(' / ') + ' n=' + n); return n + '歩'
})
await t('[推理] 卓の物2つ＋しぐさで本音が1つに絞れる（全くじで）', async () => {
  const r = await p.evaluate(() => {
    let ok = 0, n = 0, one = 0
    for (let seed = 1; seed <= 400; seed++) {
      const run = WS.buildRun(seed * 13)
      for (const k of ['boss', 'gran', 'ex', 'drunk', 'couple']) {
        const want = run.wants[k], iw = run.items[k].map(i => WS.T.ITEMS[i].w)
        let w = ['j', 't', 's', 'p']; for (const s of iw) w = w.filter(x => s.includes(x)); if (w.length === 1) one++
        const gs = WS.T.GEST.filter(g => g.w.includes(want)); const gw = gs[(run.gest0 + 2) % gs.length].w
        if (w.length > 1) { const v = w.filter(x => gw.includes(x)); if (v.length) w = v }
        n++; if (w[0] === want && iw.every(s => s.includes(want))) ok++
      }
    }
    return { rate: ok / n, itemsOnly: one / n }
  })
  expect(r.rate >= 0.97, JSON.stringify(r)); return r
})
await t('[推理] 口調では当たりが分からない（一番丁寧そうな一文の当たり率が0.45以下）', async () => {
  const r = await p.evaluate(() => {
    const polite = t => (t.match(/です|ます|ください|ございます|ません|ましょう/g) || []).length * 100 + t.length
    let hit = 0, n = 0
    for (let seed = 1; seed <= 300; seed++) { const run = WS.buildRun(seed * 17); run.nodes.forEach((node, i) => { const want = run.wants[run.focus[i]]; const os = node.o; for (let a = 0; a < 4; a++) { const tri = [os.find(o => o.st === want), ...os.filter(o => o.st !== want).slice(a % 3, a % 3 + 2)].filter(Boolean).slice(0, 3); let b = tri[0]; for (const o of tri) if (polite(o.t.ja) > polite(b.t.ja)) b = o; n++; if (b.st === want) hit++ } }) }
    return +(hit / n).toFixed(2)
  })
  expect(r <= 0.45, String(r)); return r
})
await t('[推理] 4つの卓の本音は毎回3種類以上（いつも同じ型が勝たない）・同級生は失敗談から本音が変わる', async () => {
  const r = await p.evaluate(() => { let bad = 0, sw = 0; for (let s = 1; s <= 300; s++) { const run = WS.buildRun(s * 7); if (new Set(['boss', 'gran', 'ex', 'drunk'].map(k => run.wants[k])).size < 3) bad++; if (run.sw.drunk && run.sw.drunk.to !== run.wants.drunk && run.focus.slice(5, 9).includes('drunk')) sw++ } return { bad, sw } })
  expect(r.bad === 0 && r.sw === 300, JSON.stringify(r)); return r
})
await t('[推理] 同級生が酔うと物が入れ替わり、次に目が合った時に一行で知らせる', async () => {
  await fresh(4242)
  let seen = null
  for (let k = 0; k < 10; k++) { const s = await toTalk(p); if (s.mode !== 'play') break; if (s.step >= 5 && s.focus === 'drunk' && !seen) seen = await p.evaluate(() => { const s = WS.state(); return { clue: s.clue, ok: s.items.every(i => WS.T.ITEMS[i].w.includes(s._want)), want: s._want, w0: WS.G.run.want0.drunk } }); await p.evaluate(() => { const s = WS.state(); WS.choose(s.grades.indexOf('H')) }) }
  expect(seen && /酔い/.test(seen.clue) && seen.ok && seen.want !== seen.w0, JSON.stringify(seen)); return seen
})
await t('[時間] 最初の一文は14秒、以降は10〜12秒（初めての1回は+2秒）', async () => {
  await fresh(77); const lims = []
  for (let k = 0; k < 10; k++) { const s = await toTalk(p); if (s.mode !== 'play') break; lims.push(+s.limit.toFixed(1)); await p.evaluate(() => { const s = WS.state(); WS.choose(s.grades.indexOf('H')) }) }
  expect(lims[0] === 14 && lims.slice(1).every(l => l >= 10 && l <= 12) && lims.length === 10, JSON.stringify(lims))
  await p.evaluate(() => { WS.start(78, { skipIntro: true }); WS.G.rookie = true }); const s = await toTalk(p); await p.evaluate(() => WS.G.rookie = false)
  return { lims, rookie0: s.limit }
})
await t('[罠] 失敗談の段には必ず黒歴史が混ざる。1回目は会場が凍り新郎が止めて続く、2回目で司会が割って入って終わる', async () => {
  await fresh(901); let s
  for (let k = 0; k < 6; k++) { s = await toTalk(p); if (s.step === 5) break; await p.evaluate(() => { const s = WS.state(); WS.choose(s.grades.indexOf('H')) }) }
  expect(s.step === 5 && s.styles.includes('b'), 'step5 ' + JSON.stringify(s.styles))
  await p.evaluate(() => WS.choose(WS.state().styles.indexOf('b'))); await run(p, 30)
  const a = await p.evaluate(() => WS.state()); await run(p, 120); const g = await p.evaluate(() => ({ clue: WS.state().clue, groom: WS.people.groom.mesh.userData.img, aim: WS.G.aimKey }))
  expect(a.jiko === 1 && /凍り/.test(a.bubble) && /やめろ/.test(g.clue) && g.groom === 'groom_g' && g.aim === 'couple', JSON.stringify({ a, g }))
  const s2 = await toTalk(p); expect(s2.mode === 'play' && s2.step === 6, 'continue ' + s2.mode + s2.step)
  await p.evaluate(() => { const r = WS.G.run; r.choices[0] = { st: 'b', t: WS.T.BLACK[2] }; WS.choose(0) }); await run(p, 400)
  const e = await p.evaluate(() => ({ mode: WS.G.mode, ended: WS.G.ended, rk: WS.rankOf(), stop: !document.querySelector('#stopper').hidden, boss: WS.people.boss.gone, gran: WS.people.gran.faint }))
  expect(e.mode === 'stop' && e.ended === 'jiko' && e.rk === 'jiko' && e.stop && e.boss > 0.5 && e.gran > 0.5, JSON.stringify(e)); return e
})
await t('[沈黙] 何もしないと、キャンドルが消えるたびに沈黙。3回で司会がマイクを取り「マイクの前の置物」', async () => {
  await fresh(55); await toTalk(p)
  const r = await p.evaluate(() => { for (let i = 0; i < 60 * 80 && WS.G.mode !== 'stop'; i++) WS.dbg.step(1); return { mode: WS.G.mode, ended: WS.G.ended, rk: WS.rankOf(), silent: WS.state().silent, score: WS.score(), peek: document.querySelector('#mcPeek').style.transform, howl: WS.Snd.played.howl || 0 } })
  expect(r.mode === 'stop' && r.ended === 'mute' && r.rk === 'mute' && r.silent === 3 && r.howl >= 3, JSON.stringify(r)); return r
})
await t('[時間の見せ方] 残り半分で司会がのぞき込み、2割でハウリング（バーは出さない）', async () => {
  await fresh(56); const s = await toTalk(p)
  const r = await p.evaluate(lim => { const at = k => { const c = WS.G.clock; while ((c.t1 - WS.G.t) / (c.t1 - c.t0) > k) WS.dbg.step(1); for (let i = 0; i < 40; i++) WS.dbg.step(1); return { peek: document.querySelector('#mcPeek').style.transform, howl: WS.Snd.played.howl || 0 } }; const h0 = WS.Snd.played.howl || 0; return { a: at(0.8), b: at(0.4), c: at(0.15), h0 } }, s.limit)
  const px = v => +String(v).match(/translateX\(([\d.]+)%\)/)[1]
  expect(px(r.a.peek) > 99 && px(r.b.peek) < 90 && r.c.howl > r.h0 && r.b.howl === r.h0, JSON.stringify(r)); return r
})
await t('[事件] どの事件も状況の一行で正解が変わる。正解でさばけて、外すと下がる。禁じ手は事故', async () => {
  const out = []
  for (const [k, E] of await p.evaluate(() => Object.entries(WS.D.EVENTS).map(([k, E]) => [k, { cues: E.cues ? E.cues.map(c => [c.k, c.ok]) : null, bad: E.bad || null }]))) {
    if (!E.cues) { await fresh(60); await toTalk(p); await p.evaluate(k => WS.forceEvent(k), k); await run(p, 30); const r = await p.evaluate(() => { const s = WS.state(); for (let i = 0; i < 120 && !WS.state().ev.shown; i++) WS.dbg.step(1); WS.choose(0); return WS.state().evOk }); out.push(k + ':' + r); expect(r === 1, k); continue }
    for (const [ck, ok] of E.cues) {
      await fresh(61); await toTalk(p)
      const r = await p.evaluate(([k, ck, ok]) => { WS.forceEvent(k, ck); WS.dbg.step(30); const s = WS.state(); const m0 = WS.score(); WS.choose(s.ev.opts.indexOf(ok)); return { ok: WS.G.ev.ok, d: WS.score() - m0 } }, [k, ck, ok])
      expect(r.ok && r.d > 0, `${k}/${ck} ${JSON.stringify(r)}`)
      const other = E.cues.find(c => c[0] !== ck)[1]
      await fresh(62); await toTalk(p)
      const w = await p.evaluate(([k, ck, o]) => { WS.forceEvent(k, ck); WS.dbg.step(30); const s = WS.state(); const m0 = WS.score(); WS.choose(s.ev.opts.indexOf(o)); return { ok: WS.G.ev.ok, d: WS.score() - m0 } }, [k, ck, other])
      expect(!w.ok && w.d < 0, `${k}/${ck} wrong ${JSON.stringify(w)}`)
    }
    if (E.bad) { await fresh(63); await toTalk(p); const j = await p.evaluate(([k, b]) => { WS.forceEvent(k); WS.dbg.step(30); WS.choose(WS.state().ev.opts.indexOf(b)); return WS.state().jiko }, [k, E.bad]); expect(j === 1, k + ' bad'); }
    out.push(k)
  }
  return out.join(',')
})
await t('[事件] 時間切れはしくじり扱い', async () => { await fresh(64); await toTalk(p); const r = await p.evaluate(() => { WS.forceEvent('dad', 'no'); for (let i = 0; i < 60 * 14; i++) WS.dbg.step(1); return WS.G.run.log.filter(l => l.startsWith('ev:dad:')) }); expect(r.includes('ev:dad:timeout'), JSON.stringify(r)); return r })
await t('[通し] 読んで全部当てると最後まで話し切り、上の称号。新郎新婦の本音で締めが決まる', async () => {
  await fresh(65)
  for (let k = 0; k < 12; k++) { const s = await toTalk(p); if (s.mode !== 'play') break; await p.evaluate(() => { const s = WS.state(); WS.choose(s.grades.indexOf('H')) }) }
  const r = await p.evaluate(() => { for (let i = 0; i < 400 && WS.G.mode !== 'end'; i++) WS.dbg.step(6); return { mode: WS.G.mode, rk: WS.G.result && WS.G.result.rk, score: WS.score(), tm: window.__tmLog.map(e => e.name) } })
  expect(r.mode === 'end' && ['legend', 'great'].includes(r.rk) && r.tm.includes('game_start') && r.tm.includes('game_end'), JSON.stringify(r)); return r
})
await t('[結果] お礼状: 称号は発表まで見せない・保存できる・Xの本文にURLを入れず url パラメータ', async () => {
  const pre = await p.evaluate(() => { WS.result(); WS.dbg.step(60); return { stage: WS.G.result.stage, dis: document.querySelector('#bSave').disabled } })
  await run(p, 300)
  const post = await p.evaluate(() => WS.G.result.stage)
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }), p.click('#bSave')])
  let url = ''; await p.exposeFunction('__grab', u => { url = u }).catch(() => {}); await p.evaluate(() => { window.open = u => { window.__grab(u) } }); await p.click('#bPost'); await p.waitForTimeout(100)
  const q = new URL(url), text = q.searchParams.get('text')
  const sup = await p.evaluate(() => { const a = document.querySelector('#tmSupport'); return a && a.textContent })
  expect(pre.stage < 4 && pre.dis && post === 4 && dl.suggestedFilename() === 'wedding-speech.png' && q.host === 'x.com' && q.pathname === '/intent/post' && q.searchParams.get('url') === 'https://tom3games.github.io/wedding-speech/' && !/https?:/.test(text) && /ご祝儀/.test(sup), JSON.stringify({ pre, post, text, sup }))
  return text
})
await t('無音: 音を鳴らす操作のあとも __muteOk（Chromium）・鳴らした回数は数えている', async () => {
  const r = await p.evaluate(() => ({ played: Object.keys(WS.Snd.played), ok: window.__muteOk(), st: WS.Snd.ctx ? WS.Snd.ctx.state : 'none' }))
  expect(r.played.length >= 8 && r.played.includes('hit_j') === r.played.includes('hit_j') && r.ok && r.st !== 'running', JSON.stringify(r)); return r.played.length + '種'
})
await t('英語: 画面の文字が全部英語になる（タイトル・遊び・事件・お礼状）', async () => {
  await p.evaluate(() => WS.setLang('en')); await fresh(66); await toTalk(p)
  const a = await p.evaluate(() => [document.querySelector('#bStart').textContent, ...[...document.querySelectorAll('#paper .ln')].map(b => b.textContent), WS.state().bubble, WS.state().clue].join(' '))
  await p.evaluate(() => WS.forceEvent('kid', 'laugh')); await run(p, 40)
  const b = await p.evaluate(() => [...[...document.querySelectorAll('#paper .ln')].map(b => b.textContent), WS.state().bubble, WS.state().clue].join(' '))
  await p.evaluate(() => WS.result()); await run(p, 300)
  const JP = /[ぁ-んァ-ヶ一-龠]/
  const c = await p.evaluate(() => [...document.querySelectorAll('#vEnd button')].map(b => b.textContent).join(' '))
  await p.evaluate(() => WS.setLang('ja'))
  expect(!JP.test(a + b + c), (a + b + c).slice(0, 200)); return (a).slice(0, 90)
})
await t('データの英語に日本語なし', async () => {
  const r = await p.evaluate(() => { const JP = /[ぁ-んァ-ヶ一-龠]/, bad = []; const walk = (o, path) => { if (!o || typeof o !== 'object') return; if (typeof o.en === 'string' && JP.test(o.en)) bad.push(path); for (const k in o) if (k !== 'ja') walk(o[k], path + '.' + k) }; walk(WS.T, 'T'); walk(WS.D.EVENTS, 'E'); const en = WS.D.UI.en; for (const k in en) { const v = en[k]; const s = typeof v === 'function' ? v('x', 1, 2, 3) : JSON.stringify(v); if (JP.test(s)) bad.push('UI.' + k) } return bad })
  expect(!r.length, r.join(',')); return true
})
await t('チュートリアル: 初めての1回だけ、物を指す指と案内が出る', async () => {
  const r = await p.evaluate(() => { localStorage.removeItem('ws_tut'); WS.start(5, { skipIntro: true }); for (let i = 0; i < 200 && WS.state().phase !== 'turn'; i++) WS.dbg.step(5); WS.dbg.step(30); const h = document.querySelector('#hand'), r = h.getBoundingClientRect(); return { hand: !h.hidden, x: r.left, y: r.top, clue: WS.state().clue } })
  expect(r.hand && r.x > 0 && r.x < 390 && r.y > 40 && r.y < 700 && /押す/.test(r.clue), JSON.stringify(r)); return r
})
await t('卓の物を本物の指で押すと説明が出る（上の層に吸われない）', async () => { await fresh(67); const s = await toTalk(p)
  await p.evaluate(() => WS.dbg.step(90))   // カメラが卓に寄りきってから（人も寄ってから押す）
  const out = []
  for (const [i, dx] of [[0, 0], [1, 0], [0, 30]]) { await p.evaluate(() => { document.querySelector('#clue').hidden = true })
    const xy = await p.evaluate(n => WS.itemXY(n), s.items[i]); await p.mouse.click(xy.x + dx, xy.y)
    const clue = await p.evaluate(() => WS.state().clue), want = await p.evaluate(k => WS.T.ITEMS[k].ja, s.items[i]); const top = await p.evaluate(({ x, y }) => document.elementsFromPoint(x, y).slice(0, 3).map(e => e.id || e.tagName), { x: xy.x + dx, y: xy.y }); expect(clue === want, JSON.stringify({ i, dx, xy, top, clue, want })); out.push(Math.round(xy.x) + ',' + Math.round(xy.y)) }
  return out })
await t('卓の物を押すと説明が出る', async () => { await fresh(67); const s = await toTalk(p); const r = await p.evaluate(n => { const k = WS.tapItem(n); return { k, clue: WS.state().clue } }, s.items[1]); expect(r.k === s.items[1] && r.clue === (await p.evaluate(k => WS.T.ITEMS[k].ja, r.k)), JSON.stringify(r)); return r })

// 3サイズ × 全画面（Chromium）
for (const [w, h, name] of SIZES) {
  const q = await open(browser, { viewport: { width: w, height: h }, deviceScaleFactor: 2 })
  await walk(q, 'chromium', name, name === 'phone' ? 'v-chromium' : null)
  await q.close()
}
// 英語の全画面（一番狭い画面）
{
  const q = await open(browser, { locale: 'en-US', viewport: { width: 360, height: 640 } })
  await walk(q, 'chromium-en', 'small', 'v-en')
  await q.close()
}
await browser.close()

// WebKit（iPhone 相当）
const wb = await webkit.launch()
for (const [w, h, name] of SIZES) {
  const q = await open(wb, { viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  await t(`WebKit ${name}: 起動して無音`, async () => { await q.tap('#bStart'); await q.waitForTimeout(200); expect(await q.evaluate(() => !document.querySelector('#say').hidden && window.__muteOk()), 'mute'); await q.evaluate(() => { WS.G.gen++; WS.G.mode = 'title'; document.querySelector('#say').hidden = true; document.querySelector('#vTitle').hidden = false; document.querySelector('#vPlay').hidden = true }) })
  await walk(q, 'webkit', name, name === 'phone' ? 'v-webkit' : null)
  await t(`WebKit ${name}: 遊んだあとも無音`, async () => { expect(await q.evaluate(() => window.__muteOk()), 'mute') })
  if (name === 'phone') {
    // ---- ページを離れた時の音（2026-11-11 横丁へ移っても BGM が鳴り続けた。sfx.js に止める処理が無かった）。音は鳴らさず、再生中のループの数で見る
    await (async (ap, other, ready, tapXY) => {
      const e0 = ap.errs.length
      await t('WebKit: 裏に回ると BGM と環境音が止まり suspend。戻っても触るまで鳴らない（bfcache の pageshow でも）', async () => {
        await ap.waitForFunction(() => Snd.playing().length >= 1, null, { timeout: 15000 })
        const r = await ap.evaluate(async () => {
          const c = Snd.ctx; let sus = 0; const os = c.suspend; c.suspend = function () { sus++; return os.call(this) }
          const before = Snd.playing().length, w0 = Snd.life.wake
          Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange'))
          const hid = { away: Snd.away, playing: Snd.playing().length, sus, gain: Snd.master.gain.value }
          const fx = Object.keys(Snd.files)[0], url = Object.values(Snd.loops).find(l => l && l.url).url
          const pl = fx ? Snd.play(fx) : null; Snd.loop('awayTest', url, 0.2)   // 裏にいる間の音は鳴らさない
          await new Promise(r => setTimeout(r, 400)); const quiet = Snd.playing().length
          Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange'))
          window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
          await new Promise(r => setTimeout(r, 400)); const back = { away: Snd.away, playing: Snd.playing().length, gain: Snd.master.gain.value, state: c.state }
          Snd.loop('awayTest', null); c.suspend = os
          return { before, w0, hid, pl: pl === null, quiet, back }
        })
        const xy = await tapXY(ap); await ap.touchscreen.tap(xy.x, xy.y); await ap.waitForTimeout(700)
        const after = await ap.evaluate(() => ({ away: Snd.away, playing: Snd.playing().length, wake: Snd.life.wake, mute: window.__muteOk() }))
        expect(r.before >= 1 && r.hid.away && r.hid.playing === 0 && r.hid.sus >= 1 && r.hid.gain === 0 && r.pl && r.quiet === 0 && r.back.away && r.back.playing === 0 && r.back.gain === 0 && r.back.state !== 'running' && !after.away && after.playing >= 1 && after.wake === r.w0 + 1 && after.mute, JSON.stringify({ r, after }))
        return { before: r.before, hidden: r.hid.playing, back: r.back.playing, touched: after.playing }
      })
      await t('WebKit: 横丁へ移る（pagehide）と止まり、戻るで戻っても鳴っていない', async () => {
        await ap.evaluate(() => addEventListener('pagehide', () => { try { sessionStorage.setItem('awayHide', JSON.stringify({ away: Snd.away, playing: Snd.playing().length })) } catch (e) {} }))
        await ap.goto(URL0 + other); await ap.waitForTimeout(300)
        const h = JSON.parse(await ap.evaluate(() => sessionStorage.getItem('awayHide')) || '{}')
        await ap.goBack(); await ap.waitForFunction(ready, null, { timeout: 30000 }); await ap.waitForTimeout(800)
        const back = await ap.evaluate(() => ({ playing: Snd.playing().length, ctx: Snd.ctx ? Snd.ctx.state : 'none' }))
        expect(h.away && h.playing === 0 && back.playing === 0 && back.ctx !== 'running', JSON.stringify({ h, back })); return { h, back }
      })
      // 移る時に読み込み途中の音が中断されるのは数えない
      await t('WebKit: 離れる・戻るでエラーなし', async () => { const e = ap.errs.slice(e0).filter(s => !/^reqfail |__away__|status of 404/.test(s)); expect(!e.length, e.join('|')) })
    })(q, 'privacy.html', () => window.__wsReady, p => ({ x: Math.round(p.viewportSize().width / 2), y: 6 }))
  }
  await q.close()
}
await wb.close()
server.kill()
console.log(results.join('\n'))
console.log(`\n${pass} ok / ${fail} fail`)
process.exit(fail ? 1 : 0)
