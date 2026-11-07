// SNS 用の画像 og.png（1200x630）。一番おもしろい場面（黒歴史を言って新郎が目で止める）＋お礼状＋タイトル。node og.mjs
import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
const ROOT = import.meta.dirname, PORT = 5895
const srv = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } }); await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH)
const ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 760 }, deviceScaleFactor: 2 }); await muteContext(ctx)
await ctx.addInitScript(() => { try { localStorage.setItem('ws_tut', '1'); localStorage.setItem('ws_played', '1') } catch (e) {} })
const p = await ctx.newPage(); await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__wsAll); await p.waitForTimeout(600)
// 場面1: 失敗談の段で黒歴史を選ぶ → 会場が凍り、新郎が目で止める
await p.evaluate(() => { WS.dbg.pause(true); WS.start(901, { skipIntro: true }); for (let k = 0; k < 400; k++) { WS.dbg.step(10); const s = WS.state(); if (s.mode === 'event' && s.ev.state === 'on') WS.choose(s.ev.kind === 'two' ? s.ev.opts.indexOf(WS.evCorrect(WS.G.ev)) : 0); if (s.mode === 'play' && s.phase === 'turn') { if (s.styles.includes('b') && s.step >= 5) break; WS.choose(s.grades.indexOf('H')) } } })
await p.evaluate(() => { WS.choose(WS.state().styles.indexOf('b')); WS.dbg.step(200) })
const a = await p.screenshot({ type: 'png' })
// 場面2: お礼状
await p.evaluate(() => { WS.G.run.laugh = 3; WS.G.run.tear = 2; WS.result(); WS.dbg.step(320) })
const c = await p.locator('#letter').screenshot({ type: 'png' })
const og = await b.newPage({ viewport: { width: 1200, height: 630 } })
await og.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Klee+One:wght@600&family=Shippori+Mincho+B1:wght@800&display=swap" rel="stylesheet"><style>
body{margin:0;width:1200px;height:630px;overflow:hidden;background:radial-gradient(ellipse at 70% 40%,#4a3424,#160f0a);font-family:"Shippori Mincho B1",serif;position:relative}
.ph{position:absolute;top:28px;left:40px;height:574px;border-radius:14px;box-shadow:0 18px 40px rgba(0,0,0,.6);transform:rotate(-2deg)}
.lt{position:absolute;top:300px;left:330px;height:300px;transform:rotate(5deg);box-shadow:0 12px 30px rgba(0,0,0,.6)}
.t{position:absolute;left:600px;top:60px;width:560px;color:#f6ead2}
.s{font-size:28px;letter-spacing:.4em;color:#d9bd84}
h1{font-size:84px;line-height:1.12;margin:14px 0 6px}
h1 em{display:block;font-style:normal;font-size:52px;color:#f08f8f}
p{font-family:"Klee One",serif;font-size:30px;line-height:1.5;color:#efe0c4;margin:22px 0 0}
</style></head><body>
<img class="ph" src="data:image/png;base64,${a.toString('base64')}">
<img class="lt" src="data:image/png;base64,${c.toString('base64')}">
<div class="t"><div class="s">友人代表</div><h1>結婚式の<br>友人スピーチ<em>原稿が飛んだ</em></h1><p>原稿が真っ白。会場の顔を読んで<br>次の一文を選べ。<br>新郎の黒歴史は、言うな。</p></div>
</body></html>`)
await og.waitForTimeout(1200)
await og.screenshot({ path: ROOT + '/og.png' })
console.log('og.png', readFileSync(ROOT + '/og.png').length)
await b.close(); srv.kill()
