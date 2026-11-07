// 結婚式の友人スピーチ: 画面の文言・事件・称号（日英）。スピーチの中身は speech.js
window.WD = (() => {
  const P = s => { const i = s.indexOf('|'); return { ja: s.slice(0, i).trim(), en: s.slice(i + 1).trim() } }
  // 事件。kind: two=3択（状況の一行 cue で正解が変わる）、quick=出た瞬間に押す
  // bad: 選ぶと事故（黒歴史と同じ数え方。2件目で司会が割って入る）
  const EVENTS = {
    dad: { kind: 'two', who: 'dad', line: P('新郎の父が乾杯しに来た|The groom\'s dad came up to toast'),
      opts: [{ k: 'later', ...P('お父さん、乾杯はのちほど|Dad, the toast comes later') }, { k: 'toast', ...P('では皆さま、ご一緒に乾杯！|Everyone, let us toast together!') }, { k: 'ignore', ...P('（聞こえないふりで続ける）|(Pretend not to hear him)') }],
      cues: [{ k: 'no', ok: 'later', ...P('司会が小さく首を横に振った|The emcee gives a tiny head shake') }, { k: 'yes', ok: 'toast', ...P('司会がうなずき、グラスを配りだした|The emcee nods, hands out glasses') }],
      win: { later: P('（父が照れて席に戻った）|(Dad sheepishly sits back down)'), toast: P('（会場中で、乾杯！）|(The whole hall: Cheers!)') }, lose: P('（父がひとりで乾杯した）|(Dad toasts all by himself)'), mood: [10, -10] },
    kid: { kind: 'two', who: 'kid', line: P('子ども「おじさん何言ってるの？」|Kid: "What are you even saying?"'),
      opts: [{ k: 'joke', ...P('おじさんも今、探してるんだ|I am looking for it too, kiddo') }, { k: 'kind', ...P('いい質問だね。ありがとう|Great question. Thank you') }, { k: 'shh', ...P('ちょっと静かにしててね|Could you be quiet a bit?') }],
      cues: [{ k: 'laugh', ok: 'joke', ...P('会場が、くすっと笑った|The hall chuckles') }, { k: 'pale', ok: 'kind', ...P('母親が真っ青で頭を下げている|His mom is pale, bowing to you') }],
      win: { joke: P('（会場がどっと沸いた）|(The hall roars)'), kind: P('（母親がほっと笑った）|(His mom smiles, relieved)') }, lose: P('（子どもが泣き出した）|(The kid bursts into tears)'), mood: [10, -10], laugh: 'joke' },
    knife: { kind: 'two', who: 'knife', line: P('司会がナイフを渡してきた|The emcee handed you a knife'),
      opts: [{ k: 'swap', ...P('（そっと返して、マイクをもらう）|(Quietly swap it for the mic)') }, { k: 'joke', ...P('入刀には、まだ早いですね|A bit early for the cake cutting') }, { k: 'raise', ...P('（ナイフを高く掲げて続ける）|(Raise the knife and carry on)') }],
      cues: [{ k: 'blind', ok: 'swap', ...P('司会は、まだ気づいていない|The emcee has not noticed') }, { k: 'seen', ok: 'joke', ...P('会場がざわっとこちらを見た|The whole hall is staring') }],
      win: { swap: P('（司会が赤面して頭を下げた）|(The emcee blushes and bows)'), joke: P('（会場が大笑い）|(Big laugh from the hall)') }, lose: P('（おばあちゃんが悲鳴を上げた）|(Grandma shrieks)'), mood: [10, -12], laugh: 'joke', bad: 'raise' },
    shout: { kind: 'two', who: 'drunk', line: P('同級生「元カノの話しろー！」|Classmate: "Tell us about his ex!"'),
      opts: [{ k: 'later', ...P('その話は、二次会でな|Save it for the after-party') }, { k: 'joke', ...P('元カノ？新婦さんしか知りません|Ex? I only know the bride') }, { k: 'tell', ...P('じゃあ、少しだけ……|Well, just a little...') }],
      cues: [{ k: 'frown', ok: 'later', ...P('上司が眉をひそめた|The boss frowns') }, { k: 'grin', ok: 'joke', ...P('新郎が苦笑いで手を合わせた|The groom grins, hands together') }],
      win: { later: P('（同級生が「ちぇっ」と座った）|(The classmate sits, sulking)'), joke: P('（会場から笑いと拍手）|(Laughs and applause)') }, lose: P('（会場が凍りついた）|(The hall freezes)'), mood: [10, -12], laugh: 'joke', bad: 'tell', baits: true },
    howl: { kind: 'quick', who: 'none', line: P('マイクがハウリングした！|The mic is howling!'),
      opts: [P('マイクを口から離す|Pull the mic away')], win: P('（音が止んだ。拍手が起きた）|(It stops. A few claps)'), lose: P('（キーン……皆が耳をふさいだ）|(Screech... everyone covers their ears)'), mood: [8, -8] },
    exbf: { kind: 'two', who: 'exbf', rare: true, line: P('新婦の元カレが号泣している|The bride\'s ex is sobbing'),
      opts: [{ k: 'skip', ...P('（見なかったことにして続ける）|(Pretend you saw nothing)') }, { k: 'thanks', ...P('遠方から、ありがとうございます|Thank you for coming so far') }, { k: 'call', ...P('あっ、元カレの方ですね？|Oh, you must be the ex?') }],
      cues: [{ k: 'froze', ok: 'skip', ...P('新婦が気づいて固まった|The bride noticed and froze') }, { k: 'wave', ok: 'thanks', ...P('新婦が笑って手を振った|The bride smiles and waves') }],
      win: { skip: P('（新婦がほっと息をついた）|(The bride breathes out)'), thanks: P('（元カレがさらに泣いた）|(The ex sobs even harder)') }, lose: P('（新婦の笑顔が止まった）|(The bride\'s smile freezes)'), mood: [10, -14], bad: 'call' },
  }
  const RANKS = ['legend', 'great', 'ok', 'meh', 'jiko', 'mute']
  const UI = {
    ja: {
      title: '結婚式の友人スピーチ', sub: '会場の顔を読んで、つなげ', series: '友人代表', start: 'マイクの前に立つ', howto: '遊び方', close: 'とじる', load: 'テーブルを整えています',
      intro: [['mc', '続きまして、新郎のご友人代表より'], ['mc', 'スピーチを頂戴いたします'], ['me', '（原稿を開いたら……真っ白だ）'], ['me', '（会場の顔を見て、つなぐしかない）']],
      mc: '司会', me: 'あなた', next: '次へ', skip: 'とばす',
      how: ['親友の結婚式。友人代表のスピーチで、原稿が真っ白になった。', '一文ごとに、目が合った卓の人がいる。その人の本音（笑いたい・泣きたい・早く終わってほしい・新郎をほめてほしい）に合う一文を、3つから選ぶ。本音は毎回くじで変わる。', '本音は卓の物としぐさで読む。物を押すと説明が出る。物は2つ。重ねると1つに絞れる。', 'キャンドルの火が消える前に選ぶ。黙っていると会場がざわつき、3回で司会にマイクを取られる。', '新郎の黒歴史は一番ウケそうに見える。言うと会場が凍る。2回で式が止まる。'],
      legal: '人物・会場はすべて架空です。笑い声: lonemonk（CC BY 3.0）。ほかの音は CC0 / パブリックドメイン。', privacy: 'プライバシー',
      tut: { look: '光の当たった卓の人と目が合っている', items: '卓の物を押すと、本音が読める', candle: 'キャンドルが消える前に、次の一文を' },
      silent: ['（会場がざわつき始めた）', '（グラスの音だけが響く）', '（司会がマイクに手をのばした）'],
      freeze: '（会場が凍りついた）', glare: '新郎が目で「やめろ」と言っている', mcCut: '以上、友人代表のスピーチでした！', mcMute: '素敵なお言葉、ありがとうございました！', bossLeave: '（上司が席を立った）',
      result: '新郎新婦より', save: '画像を保存', post: 'Xでポスト', again: 'もう一回', toTitle: 'タイトルへ',
      letterHead: '御礼', letterTo: '友人代表 様', letterBody: ['本日は心のこもったスピーチを', 'ありがとうございました'], cLaugh: '笑い', cTear: '涙', cJiko: '事故', unitT: '回', unitK: '件', from: '新郎・新婦より', title2: '称号',
      rankName: { legend: '伝説の友人代表', great: '名スピーチ賞', ok: '無難に着地', meh: '司会に救われた人', jiko: '出禁候補', mute: 'マイクの前の置物' },
      groom: { legend: '一生忘れない。ありがとう', great: '泣いたし笑った。最高', ok: 'ちょうどよかった。助かった', meh: '来てくれただけで嬉しい', jiko: '二次会は来なくていい', mute: '立ってくれて、ありがとう' },
      shareText: (rk, l, t, j) => `結婚式の友人スピーチで原稿が飛んだ。笑い${l}・涙${t}・事故${j}で「${rk}」 #バカゲー #結婚式スピーチ`,
    },
    en: {
      title: 'Best Man, No Notes', sub: 'Read the room. Keep talking', series: 'WEDDING TOAST', start: 'Step up to the mic', howto: 'How to play', close: 'Close', load: 'Setting the tables',
      intro: [['mc', 'Next, a speech from the groom\'s friend'], ['mc', 'The floor is yours'], ['me', '(I open my notes... blank)'], ['me', '(Read the room. Keep talking)']],
      mc: 'Emcee', me: 'You', next: 'Next', skip: 'Skip',
      how: ['Your best friend\'s wedding. You give the speech, and your notes are blank.', 'Each line, you lock eyes with someone. Pick the line that fits what they secretly want: a laugh, a cry, a short speech, or praise for the groom. It changes every time.', 'Read them from what is on their table and how they act. Tap an item to read it. Two items together narrow it to one.', 'Choose before the candle goes out. Silence makes the hall murmur; three times and the emcee takes the mic.', 'The groom\'s dark past looks like the biggest laugh. It freezes the room. Twice, and the wedding stops.'],
      legal: 'All people and venues are fictional. Laughter: lonemonk (CC BY 3.0). Other sounds CC0 / public domain.', privacy: 'Privacy',
      tut: { look: 'You lock eyes with the lit table', items: 'Tap their things to read them', candle: 'Pick a line before the candle dies' },
      silent: ['(The hall starts to murmur)', '(Only clinking glasses)', '(The emcee reaches for the mic)'],
      freeze: '(The hall freezes)', glare: 'The groom\'s eyes scream: STOP', mcCut: 'Thank you! That was our friend\'s speech!', mcMute: 'Thank you for those lovely words!', bossLeave: '(The boss stands up)',
      result: 'From the couple', save: 'Save image', post: 'Post on X', again: 'Play again', toTitle: 'Title',
      letterHead: 'Thank You', letterTo: 'Dear Best Friend', letterBody: ['Thank you for your', 'heartfelt speech today'], cLaugh: 'Laughs', cTear: 'Tears', cJiko: 'Disasters', unitT: '', unitK: '', from: 'With love, the couple', title2: 'Title',
      rankName: { legend: 'Legendary Best Friend', great: 'Speech of the Year', ok: 'Safe Landing', meh: 'Saved by the Emcee', jiko: 'Banned From Parties', mute: 'Mic-Stand Decoration' },
      groom: { legend: 'Never forgetting this. Thank you', great: 'I cried. I laughed. Perfect', ok: 'Just right. Thanks, man', meh: 'Glad you came, at least', jiko: 'Skip the after-party', mute: 'Thanks for... standing there' },
      shareText: (rk, l, t, j) => `My wedding speech notes went blank. ${l} laughs, ${t} tears, ${j} disasters: "${rk}" #wedding #indiegame`,
    },
  }
  return { EVENTS, RANKS, UI }
})()
