// スピーチと事件の全文を Markdown に書き出し、形を検算する。node tools/dialogue.mjs [出力先.md]
// 検算: 1段に4つの型（笑い・涙・短く・立てる）が1つずつ・字数・英語に日本語なし・どの本音にも物2つ以上としぐさ2つ以上・どの卓の人にも当たりと外れの反応
import { readFileSync, writeFileSync } from 'node:fs'
import vm from 'node:vm'
const ROOT = new URL('..', import.meta.url).pathname
const ctx = { window: {} }; vm.createContext(ctx)
vm.runInContext(readFileSync(ROOT + 'speech.js', 'utf8'), ctx)
vm.runInContext(readFileSync(ROOT + 'data.js', 'utf8'), ctx)
const T = ctx.window.WT, D = ctx.window.WD
const NAME = { j: '笑わせてほしい', t: '泣かせてほしい', s: '短く終わってほしい', p: '新郎を立ててほしい' }
const WHY = { j: '新郎をいじって笑いに変える一文（ただし黒歴史は言わない）', t: '思い出と感謝で胸に来る一文', s: '話を切り上げる・省く一文', p: '新郎の人柄や仕事を持ち上げる一文' }
const errs = []
const LIM = { think: 16, line: 19, react: 17, clue: 18 }
const len = s => [...s].length
const JP = /[ぁ-んァ-ヶ一-龠]/
const out = ['# 結婚式の友人スピーチ 会話と手がかりの全文', '', '自動生成（`node tools/dialogue.mjs 出力.md`。speech.js と data.js から書き出す）。ゲームの中身そのもの。', '',
  '## 推理の仕組み', '',
  '- 本音は4つ: ' + Object.entries(NAME).map(([k, v]) => `${v}（${k}）`).join('・') + '。4つの卓の人と新郎新婦は、毎回くじでその人が持ちうる3つから1つ（4卓で少なくとも3種類）',
  '- スピーチは10段（名乗り→出会い→学生時代→人柄→仕事→失敗談→新婦→ご両親へ→二人へ→締め）。各段の一文は卓に関係なく共通。段ごとに目が合う卓（光が当たる）が変わり、その人の本音で当たりの一文が変わる',
  '- 画面の3択 = 本音に合う一文1つ＋ほかの型から2つ。失敗談の段（と、くじで25%の段、同級生に「元カノの話しろ」と言われた次の段）は1つが新郎の黒歴史に入れ替わる',
  '- 手がかり: 卓の物2つ（押すと説明）＋しぐさの一行（段ごとに変わる）。1つで2つの本音を指す物があり、2つ重ねると1つに絞れる',
  '- 当たり: その人の書き下ろしの反応＋表情（笑い・涙・うなずき）＋会場の笑い声か拍手。同じ本音の卓も少し上がる。外れ: 本音のヒントになる一言＋不機嫌な顔',
  '- 同級生は失敗談（6段目）から本音が変わる（物が入れ替わり、次に目が合った時「酔いが回って、目つきが変わった」）。祖母はたまに7段目から「短く」に変わる',
  '- 締めは新郎新婦（高砂）の本音で決まる。高砂の卓の物で読む',
  '- 黒歴史: 1回目は会場が凍り、新郎が目で止める（全卓の機嫌が大きく下がり、事故1件）。2回目で司会が割って入り、上司が席を立ち、祖母が倒れかけて終わり（称号「出禁候補」）',
  '- 黙る: キャンドルの火が消える（最初の一文14秒・以降10〜12秒）と沈黙。半分を切ると司会が画面の端からのぞき込み、残り2割でマイクがハウリング。3回で司会がマイクを取って終わり（称号「マイクの前の置物」）', '']
out.push('## 手がかり → 本音', '', '### 卓の物（押すと説明）', '')
for (const [k, v] of Object.entries(T.ITEMS)) { out.push(`- ${k}「${v.ja}」→ ${[...v.w].map(w => NAME[w]).join(' か ')}`); if (len(v.ja) > LIM.clue) errs.push(`物の説明が長い ${len(v.ja)}字「${v.ja}」`); if (JP.test(v.en)) errs.push('英語に日本語: ' + v.en) }
out.push('', '### しぐさの一行', '')
for (const g of T.GEST) { out.push(`- 「${g.ja}」→ ${[...g.w].map(w => NAME[w]).join(' か ')}`); if (len(g.ja) > LIM.clue) errs.push(`しぐさが長い ${len(g.ja)}字「${g.ja}」`) }
for (const w of T.WANTS) {
  const it = Object.keys(T.ITEMS).filter(k => T.ITEMS[k].w.includes(w)), gs = T.GEST.filter(g => g.w.includes(w))
  if (it.length < 2) errs.push(`本音 ${w}: 物が2つ未満`)
  if (gs.length < 2) errs.push(`本音 ${w}: しぐさが2つ未満`)
  out.push('', `- ${NAME[w]}を指す物: ${it.join('・')}（単独で決まる物: ${it.filter(k => T.ITEMS[k].w.length === 1).join('・') || 'なし'}）`)
}
out.push('', '### 本音ごとに、なぜその一文が当たるか', '')
for (const w of T.WANTS) out.push(`- ${NAME[w]}: ${WHY[w]}が当たり`)
out.push('', '## 卓の人', '')
for (const [k, g] of Object.entries(T.GUESTS)) {
  out.push(`### ${g.name.ja}（${k}・卓「${g.table.ja}」）`, '', `本音のくじ: ${g.wants.map(w => NAME[w]).join('・')}` + (g.turn ? `／途中で本音が変わる（${k === 'drunk' ? '必ず' : 'たまに'}）` : ''), '')
  for (const w of T.WANTS) {
    const h = T.HIT[k] && T.HIT[k][w], c = T.COLD[k] && T.COLD[k][w]
    if (!h || h.length < 2) errs.push(`${k} ${w}: 当たりの反応が2つない`)
    if (!c) errs.push(`${k} ${w}: 外れの反応がない`)
    for (const s of [...(h || []), c].filter(Boolean)) { const [ja, en] = s.split('|'); if (len(ja) > LIM.react) errs.push(`反応が長い ${len(ja)}字「${ja}」`); if (!en || JP.test(en)) errs.push('反応の英語: ' + s) }
    if (!g.wants.includes(w)) continue
    const items = Object.keys(T.ITEMS).filter(x => T.ITEMS[x].w.includes(w))
    out.push(`- 本音が「${NAME[w]}」の回: 卓に ${items.map(x => '「' + T.ITEMS[x].ja.split('。')[0] + '」').join('か')} のうち2つ、しぐさは「${T.GEST.filter(x => x.w.includes(w)).map(x => x.ja).join('」「')}」など → ${WHY[w]}を選ぶ`)
    out.push(`  - 当たると「${h.map(x => x.split('|')[0]).join('」か「')}」／外すと「${c.split('|')[0]}」`)
  }
  out.push('')
}
out.push('## スピーチの全文（段ごと・2通りのうちくじで1つ）', '')
const steps = ['名乗り', '出会い', '学生時代', '人柄', '仕事', '失敗談', '新婦', 'ご両親へ', '二人へ', '締め']
T.SECTIONS.forEach(([k, alts], i) => {
  out.push(`### ${i + 1}. ${steps[i]}（${k}）` + (k === 'fail' ? ' ※黒歴史が必ず混ざる' : k === 'close' ? ' ※目が合うのは新郎新婦' : ''), '')
  alts.forEach((n, a) => {
    const ts = n.o.map(o => o.st).sort().join('')
    if (ts !== 'jpst') errs.push(`${k}#${a}: 型が4つそろっていない (${ts})`)
    if (len(n.s.ja) > LIM.think) errs.push(`${k}#${a}: 頭の中の一言が長い ${len(n.s.ja)}字「${n.s.ja}」`)
    if (JP.test(n.s.en)) errs.push(`${k}#${a}: 英語に日本語`)
    out.push(`**${'AB'[a]}** 頭の中「${n.s.ja}」`)
    for (const o of n.o) {
      if (len(o.t.ja) > LIM.line) errs.push(`${k}#${a}: 一文が長い ${len(o.t.ja)}字「${o.t.ja}」`)
      if (JP.test(o.t.en)) errs.push(`${k}#${a}: 英語に日本語「${o.t.en}」`)
      out.push(`- ${NAME[o.st]}人に当たる「${o.t.ja}」`)
    }
    out.push('')
  })
})
out.push('### 黒歴史（罠。一番ウケそうに見える）', '')
for (const b of T.BLACK) { out.push(`- 「${b.ja}」`); if (len(b.ja) > LIM.line) errs.push(`黒歴史が長い「${b.ja}」`) }
out.push('', '## 事件（段の切れ目に3つ。状況の一行で正解が変わる）', '')
for (const [k, E] of Object.entries(D.EVENTS)) {
  out.push(`### ${k}${E.rare ? '（レア）' : ''}「${E.line.ja}」`, '')
  if (E.kind === 'quick') { out.push(`- 出た瞬間に「${E.opts[0].ja}」を押す。成功「${E.win.ja}」／遅れる「${E.lose.ja}」`, ''); continue }
  for (const c of E.cues) { const o = E.opts.find(o => o.k === c.ok); out.push(`- 「${c.ja}」の時 → 「${o.ja}」が正解 →「${E.win[c.ok].ja}」`); if (len(c.ja) > LIM.clue) errs.push(`事件の状況が長い「${c.ja}」`) }
  const bad = E.opts.find(o => o.k === E.bad), never = E.opts.filter(o => !E.cues.some(c => c.ok === o.k))
  out.push(`- いつも外れ: ${never.map(o => '「' + o.ja + '」').join('')}${bad ? '（事故として数える）' : ''} →「${E.lose.ja}」`, '')
  for (const o of E.opts) if (len(o.ja) > LIM.line) errs.push(`事件の選択肢が長い「${o.ja}」`)
}
const md = out.join('\n')
if (process.argv[2]) writeFileSync(process.argv[2], md)
if (errs.length) { console.error(errs.join('\n')); process.exit(1) }
console.log(`ok: 段${T.SECTIONS.length}×2・一文${T.SECTIONS.reduce((a, [, x]) => a + x.length * 4, 0)}・物${Object.keys(T.ITEMS).length}・しぐさ${T.GEST.length}・事件${Object.keys(D.EVENTS).length}`)
