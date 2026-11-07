// 音の割り当て（全部録音素材。出所は CREDITS.md）。game.js はここの Sfx(n)・ambOn・Tension を呼ぶ
(() => {
  const KEY = 'ws_mute'
  try { Snd.muted = localStorage.getItem(KEY) === '1' } catch (e) {}
  const setM = Snd.setMute
  Snd.setMute = function (m) { setM.call(this, m); try { localStorage.setItem(KEY, m ? '1' : '0') } catch (e) {} }
  Snd.def({
    applause: 'snd/applause.mp3', laughBig: 'snd/laugh_big.mp3', laughSmall: 'snd/laugh_small.mp3', cough: 'snd/cough1.mp3',
    clink: ['snd/clink1.mp3', 'snd/clink2.mp3', 'snd/clink3.mp3'], paper: ['snd/paper1.mp3', 'snd/paper2.mp3', 'snd/paper3.mp3'], tap: 'snd/tap.mp3',
    knife: 'snd/knife.mp3', drum: 'snd/drumroll.mp3', bell: 'snd/bell.mp3', chair: 'snd/chair.mp3', step: ['snd/step1.mp3', 'snd/step2.mp3'], static: 'snd/static.mp3',
    stamp: 'snd/stamp.mp3', win: 'snd/win.mp3', win2: 'snd/win2.mp3', lose: 'snd/lose.mp3',
  })
  const CUE = {
    paper: [['paper', { vol: 0.55 }]], tap: [['tap', { vol: 0.5, jitter: 0 }]],
    // 当たり: 本音ごとに会場の返し方が違う（笑い声・拍手）
    hit_j: [['laughBig', { vol: 0.85, room: 0.3 }]], hit_t: [['applause', { vol: 0.35, room: 0.4 }]], hit_s: [['applause', { vol: 0.5, room: 0.3 }]], hit_p: [['applause', { vol: 0.6, room: 0.3 }], ['clink', { vol: 0.3, delay: 0.3 }]],
    miss: [['cough', { vol: 0.45, room: 0.4 }]], small: [['laughSmall', { vol: 0.55, room: 0.3 }]],
    freeze: [['clink', { vol: 0.5, rate: 0.8, room: 0.6 }], ['cough', { vol: 0.35, delay: 1.1, room: 0.5 }]], chair: [['chair', { vol: 0.9, room: 0.4 }], ['step', { vol: 0.6, delay: 0.4 }], ['step', { vol: 0.6, delay: 0.75 }]],
    ev_dad: [['chair', { vol: 0.8 }], ['clink', { vol: 0.6, delay: 0.4 }]], ev_kid: [['step', { vol: 0.5 }], ['step', { vol: 0.5, delay: 0.25 }]], ev_knife: [['knife', { vol: 0.7 }]], ev_shout: [['laughSmall', { vol: 0.5 }]], ev_exbf: [['cough', { vol: 0.4, rate: 1.2 }]],
    evok: [['laughBig', { vol: 0.7, room: 0.3 }]], evok2: [['applause', { vol: 0.45, room: 0.3 }]], toast: [['clink', { vol: 0.8 }], ['clink', { vol: 0.6, delay: 0.15 }], ['clink', { vol: 0.5, delay: 0.32 }], ['applause', { vol: 0.5, delay: 0.4 }]],
    stamp: [['stamp', { vol: 1 }]], drum: [['drum', { vol: 0.8 }]], bell: [['bell', { vol: 0.7, room: 0.5 }]], win: [['win', { vol: 0.8 }]], win2: [['win2', { vol: 0.8 }]], lose: [['lose', { vol: 0.8 }]],
    finale: [['applause', { vol: 0.9, room: 0.3 }], ['bell', { vol: 0.5, delay: 0.2, room: 0.5 }]],
  }
  window.Sfx = function (n) { Snd.played[n] = (Snd.played[n] || 0) + 1; for (const [k, o] of CUE[n] || []) Snd.play(k, o) }
  // マイクのハウリング: 録音の雑音を、鋭い帯域で通して「キーン」にする（素材の加工）
  window.Howl = function (vol = 0.25) {
    Snd.played.howl = (Snd.played.howl || 0) + 1
    if (!Snd.ctx) return; const c = Snd.ctx, buf = Snd.bufs['snd/static.mp3']; if (!buf || buf === 'loading') return
    const s = c.createBufferSource(), f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime
    s.buffer = buf; f1.type = f2.type = 'bandpass'; f1.frequency.value = 2600; f2.frequency.value = 2620; f1.Q.value = f2.Q.value = 60
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * 40, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6)
    s.connect(f1); f1.connect(f2); f2.connect(g); g.connect(Snd.sfxBus); s.start(t); s.stop(t + 1.7)
  }
  // 会場のざわめき。沈黙が続くほど大きくなる（k=0〜1）
  // 鳴っているループの音量だけを動かす（loop を呼び直すと頭から鳴り直すので使わない）
  const setAmb = (v, sec) => { Snd._tv = v; const l = Snd.loops.amb; if (!Snd.ctx || !l || !l.g) return; const g = l.g.gain, t = Snd.ctx.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(v, t + sec) }
  window.Tension = function (k) { if (!Snd._amb) return; const v = 0.09 + 0.22 * k; if (Math.abs(v - (Snd._tv || 0)) < 0.02) return; setAmb(v, 0.4) }
  window.ambOn = function () { if (Snd._amb) { Snd.init(); return } Snd._amb = 1; Snd.init(); Snd._tv = 0.09; Snd.loop('amb', 'snd/crowd.mp3', 0.09, 1) }
  window.Hush = function () { Snd.played.hush = (Snd.played.hush || 0) + 1; if (Snd._amb) setAmb(0.012, 0.25) }
})()
