// 画面を撮る。node shot.mjs [幅x高さ] [webkit]（音は出さない）。shots/ に title・intro・play・item・react・event・black・end を出す
import { chromium, webkit } from 'playwright'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const ROOT = import.meta.dirname, PORT = 5892
mkdirSync(ROOT + '/shots', { recursive: true })
const [w, h] = (process.argv[2] || '390x844').split('x').map(Number), WK = process.argv[3] === 'webkit'
const srv = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } }); await new Promise(r => setTimeout(r, 400))
const b = await (WK ? webkit : chromium).launch(WK ? {} : MUTE_LAUNCH)
const ctx = await b.newContext({ locale: process.env.LANG_EN ? 'en-US' : 'ja-JP', viewport: { width: w, height: h }, deviceScaleFactor: 2, ...(WK ? { isMobile: true, hasTouch: true } : {}) }); await muteContext(ctx)
const p = await ctx.newPage(); const errs = []
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) }); p.on('requestfailed', r => { if (!/fonts\./.test(r.url())) errs.push('fail ' + r.url()) })
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__wsReady, null, { timeout: 20000 }); await p.waitForFunction(() => window.__wsAll, null, { timeout: 20000 }); await p.waitForTimeout(600)
const tag = `${w}x${h}${WK ? '-wk' : ''}`, snap = n => p.screenshot({ path: `${ROOT}/shots/${tag}-${n}.png` })
const run = n => p.evaluate(n => WS.dbg.step(n), n)
const toTurn = async () => { for (let i = 0; i < 600; i++) { const s = await p.evaluate(() => { WS.dbg.step(10); return WS.state() }); if (s.mode === 'play' && s.phase === 'turn') return s; if (s.mode === 'event' && s.ev.state === 'on') return s; if (s.mode === 'end' || s.mode === 'stop') return s } }
await snap('title')
await p.click('#bStart'); await p.evaluate(() => WS.dbg.pause(true)); await run(30); await snap('intro')
await p.click('#bSayNext'); await p.click('#bSayNext'); await run(20); await snap('intro-blank')
await p.click('#bSaySkip'); await toTurn(); await run(60); await snap('play')
const s0 = await p.evaluate(() => WS.state()); await p.evaluate(n => WS.tapItem(n), s0.items[0]); await run(2); await snap('item')
await p.evaluate(() => { const s = WS.state(); WS.choose(s.grades.indexOf('H')) }); await run(30); await snap('react')
await toTurn(); await run(60); await p.evaluate(() => WS.forceEvent('dad', 'yes')); await run(70); await snap('event-dad')
await p.evaluate(() => WS.dbg.step(900)); await toTurn()
await p.evaluate(() => WS.forceEvent('knife', 'seen')); await run(70); await snap('event-knife')
await p.evaluate(() => WS.dbg.step(900)); await toTurn(); await run(60)
await p.evaluate(() => { const s = WS.state(); if (!s.styles.includes('b')) { WS.G.run.choices[0] = { st: 'b', t: WS.T.BLACK[0] } } WS.choose(WS.G.run.choices.findIndex(c => c.st === 'b')) }); await run(40); await snap('black1'); await run(110); await snap('black1-glare')
await toTurn(); await run(40); await snap('play2')
console.log(JSON.stringify(await p.evaluate(() => { const m = WS.people.drunk.mesh; return [WS.G.mode, WS.state().focus, m.visible, m.position.toArray(), m.userData.img, WS.people.drunk.faint, WS.people.drunk.gone, m.material.color.r] }))); await p.evaluate(() => { WS.G.run.choices[0] = { st: 'b', t: WS.T.BLACK[1] }; WS.choose(0) }); await run(200); await p.waitForTimeout(100); await snap('stop')
await p.evaluate(() => WS.result()); await run(300); await p.waitForTimeout(200); await snap('end')
console.log(tag, errs.length ? errs.join('\n') : 'no errors')
await b.close(); srv.kill()
