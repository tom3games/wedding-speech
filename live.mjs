import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 公開URLの確認。node live.mjs（ログインしていないブラウザで見る）。SKIPGH=1 で GitHub ページの確認を省く
// wedding-speech __NS__ を置き換え、「遊びの通し」をゲームに合わせて書く
import { chromium, webkit } from 'playwright'
import { execSync } from 'node:child_process'
// 個人のアカウント名は公開リポジトリに書かない。実行時に gh から取る（2026-11-02 live.mjs に名前が文字で入ったまま5本公開していた）
const OWNER = (() => { try { return execSync('gh api user -q .login', { encoding: 'utf8' }).trim().toLowerCase() } catch { return '' } })()
const URL0 = 'https://tom3games.github.io/wedding-speech/'
const out = []
for (const [name, bt, opts] of [['chromium', chromium, {}], ['webkit', webkit, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const b = await bt.launch(bt === chromium ? MUTE_LAUNCH : {}), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  p.on('requestfailed', r => errs.push('fail ' + r.url()))
  await p.goto(URL0 + '?t=' + Date.now(), { waitUntil: 'networkidle' })
  await p.waitForFunction(() => window.__wsReady, null, { timeout: 15000 })
  // ---- 遊びの通し（タイトル → 遊ぶ → 結果）。読んで当て続け、最後のお礼状まで ----
  await p.waitForFunction(() => window.__wsAll, null, { timeout: 20000 })
  await (bt === webkit ? p.tap('#bStart') : p.click('#bStart'))
  const play = await p.evaluate(() => {
    WS.dbg.pause(true); document.querySelector('#bSaySkip').click()
    for (let i = 0; i < 3000 && WS.G.mode !== 'end'; i++) {
      WS.dbg.step(6); const s = WS.state()
      if (s.mode === 'event' && s.ev.state === 'on') { if (s.ev.kind === 'two') WS.choose(s.ev.opts.indexOf(WS.evCorrect(WS.G.ev))); else if (s.ev.shown) WS.choose(0) }
      if (s.mode === 'play' && s.phase === 'turn') WS.choose(s.grades.indexOf('H'))
    }
    return { mode: WS.G.mode, rk: WS.G.result && WS.G.result.rk, mute: window.__muteOk() }
  })
  if (play.mode !== 'end' || !play.mute) errs.push('play ' + JSON.stringify(play))
  await p.evaluate(() => WS.dbg.step(320))
  await p.screenshot({ path: `shots/live-${name}.png` })
  const og = await p.evaluate(async () => { const r = await fetch(document.querySelector('meta[property="og:image"]').content); return r.status + ' ' + r.headers.get('content-type') })
  out.push(`${name}: og=${og} errors=${errs.length ? errs.join(' | ') : 'none'}`)
  await b.close()
}
if (process.env.SKIPGH) { console.log(out.join('\n')); process.exit(0) }
// ログアウト状態でリポジトリ・更新履歴に個人のIDが出ていないか
const b = await chromium.launch(MUTE_LAUNCH), p = await b.newPage()
for (const u of ['https://github.com/tom3games/wedding-speech', 'https://github.com/tom3games/wedding-speech/commits/main']) {
  const res = await p.goto(u, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
  out.push(`${u} status=${res.status()} owner=${OWNER && (await p.content()).toLowerCase().includes(OWNER) ? 'FOUND' : 'none'}`)
}
await b.close()
console.log(out.join('\n'))
