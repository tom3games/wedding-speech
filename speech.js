// 結婚式の友人スピーチ: スピーチの中身（日英）。処理は game.js
// 推理の芯: 同じ一文でも、目が合った卓の人の本音で当たりが変わる。本音は毎回くじ。台詞は卓に関係なく共通
// 本音（want）4つ: j=笑わせてほしい t=泣かせてほしい s=短く終わってほしい p=新郎を立ててほしい
// スピーチ10段。1歩 = [頭の中の一言, 一文4つ（型ごとに1つ）]。一文 = '型 一文|英'。画面には本音の一文＋ほか2つの3択（失敗談の歩と、同級生が叫んだ後は1つが黒歴史に入れ替わる）
// 4つとも「スピーチで言いそうな一文」で、丁寧さはそろえる。口調では当たりが分からない（tools/dialogue.mjs が型と字数を検算）
window.WT = (() => {
  const P = s => { const i = s.indexOf('|'); return i < 0 ? { ja: s, en: s } : { ja: s.slice(0, i).trim(), en: s.slice(i + 1).trim() } }
  const O = s => { const m = s.match(/^([jtsp]) (.+)$/); if (!m) throw new Error('bad line: ' + s); return { st: m[1], t: P(m[2]) } }
  const S = (think, ...opts) => ({ s: P(think), o: opts.map(O) })
  const WANTS = ['j', 't', 's', 'p']
  const WANT_NAME = { j: P('笑わせてほしい|wants to laugh'), t: P('泣かせてほしい|wants to cry'), s: P('短く終わってほしい|wants it short'), p: P('新郎を立ててほしい|wants the groom praised') }

  // ---- スピーチの段。順番は固定（名乗り→…→締め）。各段2通りのうちくじで1つ
  const SECTIONS = [
    ['hello', [
      S('（まずは名乗らないと……）|(Introduce yourself first...)',
        'j 新郎の親友の、自称一番手です|The groom\'s self-proclaimed No.1 pal',
        't 二十年、彼の隣にいた者です|I have stood beside him for 20 years',
        's 友人代表として、手短に申し上げます|As his friend, I will be brief',
        'p 彼に何度も救われた友人です|A friend he has rescued many times'),
      S('（名前……名前を言え）|(Your name... say your name)',
        'j 新郎に毎年、誕生日を忘れられる者です|The friend whose birthday he forgets',
        't 彼がいなければ、今の僕はいません|Without him, I would not be here',
        's ご紹介にあずかりました、友人です|I am the friend just introduced',
        'p 彼を一番近くで尊敬してきた者です|I have admired him the closest'),
    ]],
    ['meet', [
      S('（出会いの話……どこからだ）|(How you met... start where?)',
        'j 出会いは給食のプリンの取り合いです|We met fighting over a school pudding',
        't 転校初日、話しかけてくれたのが彼です|He was the first to talk to the new kid',
        's 出会いは中学。長い話は省きます|Junior high. I will skip the long part',
        'p 中学の頃から、彼は皆の中心でした|Even in school, he was at the center'),
      S('（あいつと会ったのは……）|(When did we meet...)',
        'j 初対面で、彼は僕の靴を履いて帰りました|Day one, he went home in my shoes',
        't 雨の日、傘を半分くれたのが始まりです|It began with half his umbrella',
        's 大学で会いました。以上が経緯です|We met in college. That is the story',
        'p 入学式で一番、堂々としていた男です|The most confident guy at orientation'),
    ]],
    ['school', [
      S('（学生時代の話を……）|(Something from school days...)',
        'j 彼のノートは、ほぼ僕のノートの写しです|His notes were basically copies of mine',
        't 部活を辞めかけた僕を、止めたのが彼です|He stopped me from quitting the team',
        's 学生時代は、とにかく楽しかったです|School was simply fun',
        'p 彼は文化祭で、皆をまとめる係でした|He led everyone at the school festival'),
      S('（学生の頃、あいつは……）|(Back in school, he...)',
        'j 修学旅行で、先生と同じ服でした|On the school trip, he dressed like the teacher',
        't 卒業式の日、黙って握手をくれました|At graduation, he silently shook my hand',
        's 学生時代の話は、またの機会に|School stories, another time',
        'p 彼は三年間、一度も遅刻しませんでした|Three years, never once late'),
    ]],
    ['good', [
      S('（あいつの良いところ……）|(His good points...)',
        'j 彼の長所は、寝起きの良さだけです|His one strength: waking up well',
        't 僕が落ちた夜、朝まで隣にいてくれました|The night I failed, he stayed till dawn',
        's 一言で言えば、いいやつです|In a word: a good guy',
        'p 頼まれた事は、必ずやり切る男です|He finishes whatever he takes on'),
      S('（どんな奴か、言わないと）|(Say what kind of guy he is)',
        'j 財布を三回なくして、三回戻った男です|Lost his wallet thrice, got it back thrice',
        't 黙って人の荷物を持つ男です|He carries your bags without a word',
        's 彼の人柄は、皆さんご存じの通りです|You all know what he is like',
        'p 彼がいると、なぜか場がまとまるんです|With him around, things come together'),
    ]],
    ['work', [
      S('（仕事ぶりも、何か……）|(Something about his work...)',
        'j 会社では、たぶん猫をかぶっています|At work, I bet he wears a disguise',
        't 初任給で、母親に花を贈った男です|His first paycheck bought his mom flowers',
        's 仕事の話は、上司の方にお任せします|I will leave work talk to his boss',
        'p 毎晩、資料を直してから寝ていました|He fixed his reports every night'),
      S('（働く姿……見たことないぞ）|(Never saw him at work...)',
        'j 名刺を初めて見た時、偽物かと思いました|His first business card looked fake',
        't 忙しくても、僕の電話には必ず出ました|Busy or not, he always took my calls',
        's 彼の仕事ぶりは、この会場が証明です|This hall proves how he works',
        'p 後輩に一番頼られているそうです|His juniors rely on him the most'),
    ]],
    ['fail', [
      S('（何か、笑える話を……）|(Something funny...)',
        'j 修学旅行に、枕を三つ持ってきた男です|He brought three pillows on a school trip',
        't 転んでも、笑って立ち上がる男です|He falls, and gets up laughing',
        's 失敗談は、二次会で披露します|Mistakes? Saved for the after-party',
        'p 失敗を、人のせいにしない男です|He never blames others'),
      S('（ここで、ひと笑い……）|(Time for a laugh...)',
        'j 運動会で、逆走して一位になりました|He won a race running the wrong way',
        't 部活で負けた日、一番泣いたのは彼です|When we lost, he cried the most',
        's 笑い話は、たくさんありますが割愛します|Lots of funny stories. I will skip them',
        'p 負けた日こそ、一番練習していました|After a loss, he trained the hardest'),
    ]],
    ['bride', [
      S('（新婦さんのことも……）|(Say something about the bride)',
        'j 新婦さんの前だと、彼は敬語になります|Near her, he switches to formal speech',
        't 彼女の話をする彼は、いつも笑顔でした|He always smiled talking about her',
        's 新婦さん、彼をよろしくお願いします|Please take good care of him',
        'p 彼が選んだ人です。間違いありません|He chose her. He chose right'),
      S('（二人のなれそめ、何だっけ）|(How did they meet again?)',
        'j 初デートの店、彼は三回道を間違えました|He got lost three times on date one',
        't 「この人と生きる」と、彼は言いました|He said: she is the one for life',
        's お二人のなれそめは、ご存じの通りです|You all know how they met',
        'p あの彼が、本気で努力した恋です|For her, he truly tried his best'),
    ]],
    ['parents', [
      S('（ご両親にも、一言……）|(A word for the parents...)',
        'j 彼の寝ぐせは、お父さん譲りだそうです|His bedhead comes from his dad',
        't 彼の優しさは、ご両親そのものです|His kindness is his parents\' own',
        's ご両家の皆さま、おめでとうございます|Congratulations to both families',
        'p こんな立派な息子さんを、ありがとう|Thank you for raising such a fine son'),
      S('（ご家族のこと、何か……）|(Something about the family...)',
        'j 実家に行くと、必ず三杯おかわりされます|At his home, they serve you thirds',
        't お母さんの手紙を、彼は今も持っています|He still keeps his mom\'s letter',
        's ご家族の皆さま、おめでとうございます|Congratulations to the whole family',
        'p 家族思いの彼なら、いい家庭を作ります|A family man will build a fine home'),
    ]],
    ['wish', [
      S('（二人に、何か言わないと）|(A message for the two...)',
        'j 喧嘩したら、まず僕に電話をください|If you fight, call me first',
        't 帰りたくなる家を、二人で作ってください|Build a home you long to return to',
        's 末永くお幸せに。それだけです|Be happy, always. That is all',
        'p 彼となら、どんな日も大丈夫です|With him, every day will be fine'),
      S('（お祝いの言葉……）|(Words of celebration...)',
        'j 結婚記念日は、僕がリマインドします|I will remind him of your anniversary',
        't 今日の二人を、僕はずっと覚えています|I will always remember you two today',
        's お二人の幸せを、心から願っています|I wish you both every happiness',
        'p 彼なら、必ず新婦さんを守ります|He will always protect her'),
    ]],
    ['close', [
      S('（そろそろ、締めないと）|(Time to wrap up)',
        'j 以上、彼の元同居人からでした|That was his former roommate',
        't 本当に、本当におめでとう|Truly, truly, congratulations',
        's 以上で、お祝いの言葉とします|With that, I close my speech',
        'p 自慢の親友です。おめでとうございます|My proud best friend. Congratulations'),
      S('（最後の一言……）|(The last line...)',
        'j 二次会の幹事も、僕です。以上です|I am also the after-party host. Done',
        't 出会ってくれて、ありがとう|Thank you for being my friend',
        's 簡単ですが、お祝いの言葉といたします|Brief, but those are my wishes',
        'p 世界一の新郎です。おめでとう|The best groom in the world. Congrats'),
    ]],
  ]

  // ---- 黒歴史（罠）。一番笑いが取れそうに見える。1回目は新郎が目で止め、2回目で司会が割って入る
  const BLACK = [
    P('実は新郎、元カノに二百万借りてまして|Actually, he owes his ex two million yen'),
    P('酔って噴水に入り、保護された男です|He once got drunk and swam in a fountain'),
    P('元カノの誕生日が、今も暗証番号です|His PIN is still his ex\'s birthday'),
    P('元カノ、実は今日この会場にいます|His ex is actually here today'),
  ]

  // ---- 卓の人。本音のくじは3つの候補から1つ。turn の人は途中で本音が変わる
  const GUESTS = {
    boss: { name: P('新郎の上司|The groom\'s boss'), table: P('松|Pine'), wants: ['p', 's', 'j'] },
    gran: { name: P('新婦の祖母|The bride\'s grandma'), table: P('竹|Bamboo'), wants: ['t', 's', 'p'], turn: 0.4 },
    ex: { name: P('元カノらしき人|Maybe his ex'), table: P('梅|Plum'), wants: ['s', 't', 'p'] },
    drunk: { name: P('酔った同級生|The drunk classmate'), table: P('桜|Cherry'), wants: ['j', 't', 'p'], turn: 1 },
    couple: { name: P('新郎新婦|The couple'), table: P('高砂|Head table'), wants: ['t', 'j', 's'] },
  }
  // 当たった時（卓の人ごと × 本音ごと）。2つのうち交互
  const HIT = {
    boss: { j: ['わっはっは！その通りだ|Ha ha! So true', '（腹を抱えて笑っている）|(Holding his belly, laughing)'], t: ['（眼鏡を外して目を拭いた）|(Removes glasses, wipes eyes)', '……いい話じゃないか|...What a fine story'], s: ['うむ。簡潔でよろしい|Good. Concise', '（深くうなずき、時計をしまった）|(Nods, puts his watch away)'], p: ['うむ、うちの誇りだ|Indeed, he is our pride', '（隣に「うちの部下」と自慢）|(Tells his neighbor: my guy)'] },
    gran: { j: ['ほっほっほ。愉快だねえ|Ho ho ho. How fun', '（口元を押さえて笑った）|(Laughs behind her hand)'], t: ['（ハンカチで目を押さえた）|(Presses a hanky to her eyes)', '……長生きして、よかった|...Glad I lived this long'], s: ['ええ、ええ。それでいい|Yes, yes. That will do', '（ほっとして、お茶を飲んだ）|(Relieved, sips her tea)'], p: ['まあ、立派な人だこと|My, what a fine man', '孫を任せられるねえ|I can trust him with her'] },
    ex: { j: ['（思わず吹き出した）|(Bursts out laughing)', 'ふふっ。あの人らしい|Heh. So like him'], t: ['（目元をそっと拭った）|(Dabs her eyes)', '……幸せになってね|...Be happy'], s: ['（小さく息をついた）|(Lets out a small breath)', '……うん、それでいい|...Yes. That is enough'], p: ['……知ってる。そういう人|...I know. He is like that', '（小さくうなずいた）|(A small nod)'] },
    drunk: { j: ['ぎゃはは！最高かよ！|Ha! You are the best!', '（テーブルを叩いて笑ってる）|(Pounding the table, laughing)'], t: ['（号泣している）|(Sobbing loudly)', 'うっ……いいやつなんだよ|Sniff... he is a good guy'], s: ['いいぞ、短いの最高！|Yes! Short is the best!', '（拍手しながら立ち上がった）|(Stands up clapping)'], p: ['そうだ！あいつはすげえんだ|Yes! He is amazing!', '（「だろ？」と隣に言った）|(Tells his neighbor: see?)'] },
    couple: { j: ['（二人で顔を見合わせて笑った）|(They look at each other, laughing)', '（新郎が吹き出した）|(The groom bursts out laughing)'], t: ['（新婦が泣き、新郎ももらい泣き）|(She cries; so does he)', '（二人で目元を押さえた）|(Both dab their eyes)'], s: ['（二人が深くおじぎをした）|(They bow deeply)', '（新郎が小さく親指を立てた）|(The groom gives a small thumbs-up)'], p: ['（新郎が照れて頭をかいた）|(The groom scratches his head, shy)', '（新婦が誇らしげに笑った）|(The bride smiles proudly)'] },
  }
  // 外した時。本音のヒントになる（卓の人ごと × 本音ごと）
  const COLD = {
    boss: { j: '固いなあ。笑わせてくれ|So stiff. Make us laugh', t: '……心に響かんな|...That did not move me', s: '（腕時計を二度見た）|(Checks his watch twice)', p: 'で、仕事ぶりは？|And his work?' },
    gran: { j: '……もう少し、明るい話を|...Something cheerful?', t: 'もっと、心のこもった話を|Something from the heart', s: '（こっくり、こっくり）|(Nodding off)', p: '孫の婿は、どんな人だい？|What kind of man is he?' },
    ex: { j: '……重いって|...Too heavy', t: '……きれいごとね|...Empty words', s: '（バッグを膝に乗せた）|(Puts her bag on her lap)', p: '……あの人の良さ、それだけ？|...That is all you see in him?' },
    drunk: { j: 'かてーよ！笑わせろー|Too stiff! Make us laugh!', t: '泣かせろよぉ……|Make me cry, man...', s: '長えよー|Too long!', p: 'もっとあいつを持ち上げろ|Hype him up more!' },
    couple: { j: '（新郎が「固いって」と口パク）|(Groom mouths: too stiff)', t: '（新婦がハンカチを握ったまま）|(Bride still gripping her hanky)', s: '（新郎が司会をちらっと見た）|(Groom glances at the emcee)', p: '（新郎が少し寂しそうだ）|(The groom looks a bit let down)' },
  }

  // ---- 手がかり。卓の物（押すと説明）としぐさ。1つが1〜2個の本音を指し、重ねると1つに絞れる
  const ITEMS = {
    hanky: { w: 't', ...P('レースのハンカチ。もう握っている|A lace hanky, already in hand') },
    letter: { w: 't', ...P('封をした手紙。読む前から涙目|A sealed letter. Teary already') },
    photo: { w: 'tp', ...P('新郎の子どもの頃の写真|A childhood photo of the groom') },
    tissue: { w: 'tj', ...P('ティッシュ。泣く用か、笑う用か|Tissues. For tears or for laughs') },
    beer: { w: 'j', ...P('空き瓶が三本。もう出来上がっている|Three empty bottles. Already loud') },
    nose: { w: 'j', ...P('鼻メガネ。余興の残り|Joke glasses left from a skit') },
    phone: { w: 'jp', ...P('スマホで撮影中。撮れ高がほしい|Filming. Wants good footage') },
    card: { w: 'p', ...P('名刺入れ。会社の顔で来ている|A card case. Here for the company') },
    seat: { w: 'p', ...P('席次表の新郎の名に赤丸|The groom\'s name circled in red') },
    camera: { w: 'pt', ...P('一眼カメラ。晴れ姿を撮りたい|A big camera. For his big day') },
    ticket: { w: 's', ...P('新幹線の切符と腕時計|A train ticket and a wristwatch') },
    medicine: { w: 's', ...P('胃薬。長い話は胃にくる|Stomach pills. Long talks hurt') },
  }
  const GEST = [
    { w: 's', ...P('腕時計を、ちらっと見た|Sneaks a look at the watch') },
    { w: 's', ...P('足を組み替えて、出口を見た|Recrosses legs, eyes the exit') },
    { w: 's', ...P('料理が冷めていくのを見ている|Watching the food go cold') },
    { w: 't', ...P('ハンカチを目元に当てた|Brings a hanky to the eyes') },
    { w: 't', ...P('鼻をすすって、うなずいた|Sniffles and nods') },
    { w: 'tp', ...P('新郎を、目を細めて見ている|Gazes at the groom, eyes soft') },
    { w: 'j', ...P('グラスを掲げて、身を乗り出した|Raises a glass, leans in') },
    { w: 'j', ...P('隣の人と、くすくす笑っている|Giggling with a neighbor') },
    { w: 'jp', ...P('「いいぞー」と口だけ動かした|Mouths: "Go on!"') },
    { w: 'p', ...P('背筋を伸ばして、深くうなずいた|Sits up straight, nods deeply') },
    { w: 'p', ...P('「うちの子が」と隣に話している|Tells a neighbor: "our boy..."') },
  ]
  const SWITCH = { drunk: P('酔いが回って、目つきが変わった|The drink kicked in. New look in his eyes'), gran: P('おばあちゃん、少し疲れてきた|Grandma is getting tired') }
  return { WANTS, WANT_NAME, SECTIONS, BLACK, GUESTS, HIT, COLD, ITEMS, GEST, SWITCH, P }
})()
