// 遊び方ごとの点と称号の分布。node sim.mjs [回数=12]（音は出さない）
// 人間の速さ: 読む bot は一文ごとに2.5〜4.5秒かけて押す（くじ）。読む bot は画面に出ている物（卓の物2つ・しぐさ・事件の状況）だけを使う
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
import { spawn } from 'node:child_process'
const N = +(process.argv[2] || 12), PORT = 5893, ONLY = process.env.ONLYBOTS?.split(',')
const srv = spawn(process.execPath, ['server.mjs'], { cwd: import.meta.dirname, env: { ...process.env, PORT: String(PORT) } }); await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 } }); await muteContext(ctx)
await ctx.addInitScript(() => { try { localStorage.setItem('ws_played', '1'); localStorage.setItem('ws_tut', '1') } catch (e) {} })
const p = await ctx.newPage(); p.on('pageerror', e => console.log('PAGEERROR', e.message)); await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__wsReady); await p.waitForFunction(() => window.__wsAll)
const LIB = `
  const guess = () => { let w = ['j','t','s','p']; for (const s of s_.itemsW) w = w.filter(x => s.includes(x)); if (w.length > 1 && s_.gestW) { const v = w.filter(x => s_.gestW.includes(x)); if (v.length) w = v } return w[0] }
  const polite = t => (t.match(/です|ます|ください|ございます|ません|ましょう/g) || []).length * 100 + t.length
  const evRead = () => { const e = s_.ev, E = WS.D.EVENTS[e.k]; return e.cue ? s_.ev.opts.indexOf(E.cues.find(c => c.k === e.cue).ok) : 0 }
`
const BOTS = {
  read: { talk: `const i = s_.styles.indexOf(guess()); return i >= 0 ? i : s_.styles.findIndex(x => x !== 'b')`, ev: `return evRead()` },
  slowRead: { talk: `const i = s_.styles.indexOf(guess()); return i >= 0 ? i : s_.styles.findIndex(x => x !== 'b')`, ev: `return evRead()`, delay: [9, 13] },
  black: { talk: `const i = s_.styles.indexOf('b'); return i >= 0 ? i : (mem.r() * 3) | 0`, ev: `return (mem.r() * s_.ev.opts.length) | 0` },
  tone: { talk: `let k = 0; s_.texts.forEach((t, i) => { if (polite(t) > polite(s_.texts[k])) k = i }); return k`, ev: `return 0` },
  sameJ: { talk: `const i = s_.styles.indexOf('j'); return i >= 0 ? i : s_.styles.findIndex(x => x !== 'b')`, ev: `return (mem.r() * s_.ev.opts.length) | 0` },
  sameT: { talk: `const i = s_.styles.indexOf('t'); return i >= 0 ? i : s_.styles.findIndex(x => x !== 'b')`, ev: `return (mem.r() * s_.ev.opts.length) | 0` },
  sameS: { talk: `const i = s_.styles.indexOf('s'); return i >= 0 ? i : s_.styles.findIndex(x => x !== 'b')`, ev: `return (mem.r() * s_.ev.opts.length) | 0` },
  sameP: { talk: `const i = s_.styles.indexOf('p'); return i >= 0 ? i : s_.styles.findIndex(x => x !== 'b')`, ev: `return (mem.r() * s_.ev.opts.length) | 0` },
  random: { talk: `return (mem.r() * 3) | 0`, ev: `return (mem.r() * s_.ev.opts.length) | 0` },
  nothing: { talk: null, ev: null },
}
const rows = []
for (const [name, bot] of Object.entries(BOTS)) {
  if (ONLY && !ONLY.includes(name)) continue
  const res = []
  for (let seed = 1; seed <= N; seed++) {
    res.push(await p.evaluate(([LIB, bot, seed]) => {
      WS.dbg.pause(true); WS.start(seed * 7919, { skipIntro: true })
      let rs = seed * 991 + 7; const mem = { r: () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296 } }
      const talk = bot.talk && new Function('s_', 'mem', LIB + bot.talk), evf = bot.ev && new Function('s_', 'mem', LIB + bot.ev)
      const [d0, d1] = bot.delay || [2.5, 4.5]
      let wait = 0, lastK = '', g = 0, t0 = WS.G.t
      while (g++ < 100000) {
        WS.dbg.tick(6); const s = WS.state()
        if (s.mode === 'stop' || s.mode === 'end' || (s.mode === 'play' && s.phase === 'gone')) break
        const key = s.mode + ':' + s.step + ':' + s.phase + ':' + (s.ev ? s.ev.k + s.ev.state + s.ev.shown : '')
        if (s.mode === 'event' && s.ev.state === 'on') {
          if (!evf) { lastK = key; continue }
          if (key !== lastK) { lastK = key; wait = Math.round((s.ev.kind === 'quick' ? 0.6 : d0 + mem.r() * (d1 - d0)) * 10) }
          if (wait-- > 0) continue
          if (s.ev.kind === 'quick') { if (s.ev.shown) WS.choose(0); continue }
          WS.choose(evf(s, mem)); continue
        }
        if (s.mode !== 'play' || s.phase !== 'turn') { lastK = key; continue }
        if (key !== lastK) { lastK = key; wait = Math.round((d0 + mem.r() * (d1 - d0)) * 10) }
        if (wait-- > 0 || !talk) continue
        WS.choose(talk(s, mem)); lastK = ''
      }
      // 終わり方を確定させて称号を出す
      for (let i = 0; i < 400 && WS.G.mode !== 'end' && WS.G.mode !== 'stop'; i++) WS.dbg.tick(6)
      const s = WS.state(), secs = WS.G.t - t0
      return { score: s.score, rk: WS.rankOf(), laugh: s.laugh, tear: s.tear, jiko: s.jiko, silent: s.silent, hits: s.hits, misses: s.misses, evOk: s.evOk, evAll: s.evAll, secs }
    }, [LIB, bot, seed]))
  }
  const avg = k => (res.reduce((a, r) => a + r[k], 0) / res.length)
  const rk = {}; for (const r of res) rk[r.rk] = (rk[r.rk] || 0) + 1
  rows.push({ bot: name, score: avg('score').toFixed(1), min: Math.min(...res.map(r => r.score)), max: Math.max(...res.map(r => r.score)), hit: (avg('hits') / Math.max(0.01, avg('hits') + avg('misses'))).toFixed(2), laugh: avg('laugh').toFixed(1), tear: avg('tear').toFixed(1), jiko: avg('jiko').toFixed(1), silent: avg('silent').toFixed(1), ev: `${avg('evOk').toFixed(1)}/${avg('evAll').toFixed(1)}`, secs: avg('secs').toFixed(0), ranks: Object.entries(rk).map(([k, v]) => `${k}${v}`).join(' ') })
}
console.log(`| bot | 点(平均) | 最低 | 最高 | 当たり率 | 笑い | 涙 | 事故 | 沈黙 | 事件 | 秒 | 称号 |`)
console.log(`|---|---|---|---|---|---|---|---|---|---|---|---|`)
for (const r of rows) console.log(`| ${r.bot} | ${r.score} | ${r.min} | ${r.max} | ${r.hit} | ${r.laugh} | ${r.tear} | ${r.jiko} | ${r.silent} | ${r.ev} | ${r.secs} | ${r.ranks} |`)
await b.close(); srv.kill()
