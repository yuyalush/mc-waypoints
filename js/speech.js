// ---- 状態変数 ----
let _SpeechRecognitionCtor = null;
let _rec           = null;         // 現在のセッションのインスタンス
let _onInterim     = null;
let _onDone        = null;
let _onError       = null;
let _isListening   = false;        // ユーザーが聴取意図を持っている
let _stopRequested = false;        // stopListening() で立てるフラグ
let _finalText     = '';
let _interimText   = '';           // iOS は isFinal が遅れるため interim も保持
let _readyAfter    = 0;            // この時刻以降なら start() 安全（ms）

// onend 後に次の start() まで空ける時間（iOS オーディオシステムの解放待ち）
const _COOLDOWN_MS = 500;

// ---- セッションごとに新インスタンスを生成 ----
//
// 【iOS WebKit の重要な制約】
// abort() をイベントハンドラ（onresult / onend）の内部から呼ぶと、
// WebKit の内部状態が壊れて以降のセッションで onresult が発火しなくなる。
// → abort() はユーザーコード（_startNewSession の割り込み時）からのみ呼ぶ。
// → 通常の認識完了は stop() を使い onend に全処理を委ねる。
//
// 【orange インジケータ（マイクマーク）について】
// iOS は onend 発火時にオーディオセッションを解放する。
// onresult(final) の直後に stop() を呼べば onend がすぐ発火するため、
// モーダル表示と同じタイミングでインジケータが消える。
function _startNewSession() {
  if (!_SpeechRecognitionCtor || !_isListening) return;

  // 既存セッションがあれば abort() で強制終了（ユーザーコードから呼ぶので安全）
  if (_rec) {
    const old = _rec;
    _rec = null;
    try { old.abort(); } catch {}
    _readyAfter = Date.now() + _COOLDOWN_MS;
  }

  const wait = Math.max(0, _readyAfter - Date.now());
  setTimeout(_doStart, wait);

  function _doStart() {
    if (!_isListening) return;

    const rec = new _SpeechRecognitionCtor();
    rec.lang            = 'ja-JP';
    // continuous: false に統一
    //   iOS : true を指定しても無視され発話後に自動 onend が発火する（実質 false）
    //   PC  : false にすることで発話後 onend が自動発火 → モーダル自動表示が機能する
    rec.continuous      = false;
    rec.interimResults  = true;
    rec.maxAlternatives = 3;

    rec.onresult = (e) => {
      if (_rec !== rec) return;
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          _finalText  += e.results[i][0].transcript;
          _interimText = '';
        } else {
          interim = e.results[i][0].transcript;
        }
      }
      if (interim) _interimText = interim;

      // final result が来たら stop() を呼んで onend を早期発火させる。
      // ※ abort() は呼ばない（iOS WebKit の状態破壊の原因になるため）。
      // ※ 処理（_onDone 呼び出し）は onend に委ねる。
      if (_finalText && !interim) {
        try { rec.stop(); } catch {}
        return;
      }

      // interim のみ: リアルタイム表示
      if (_onInterim) _onInterim((_finalText + interim).trim());
    };

    rec.onerror = (e) => {
      if (_rec !== rec) return;
      // stop()/abort() による aborted、無音タイムアウト、デバイス問題は無視して onend に任せる
      if (['no-speech', 'audio-capture', 'aborted'].includes(e.error)) return;
      if (e.error === 'not-allowed') {
        _rec = null; _isListening = false; _stopRequested = false;
        _finalText = ''; _interimText = '';
        if (_onError) _onError();
      }
      // その他エラーも onend が続けて発火するのでそちらで処理する
    };

    rec.onend = () => {
      if (_rec !== rec) return;
      _rec = null;
      // onend 発火 = iOS がオーディオセッションを解放した瞬間
      // 次の start() まで安全マージンを設ける
      _readyAfter = Date.now() + _COOLDOWN_MS;

      const raw = (_finalText || _interimText).trim();
      _finalText = ''; _interimText = '';

      if (_stopRequested) {
        _stopRequested = false;
        _isListening   = false;
        if (_onDone) _onDone(raw);
        return;
      }

      if (!_isListening) return;

      _isListening = false;
      if (raw) {
        if (_onDone) _onDone(raw);
      } else {
        // 無音タイムアウト: ボタンリセットのみ、モーダルは開かない
        if (_onError) _onError();
      }
    };

    _rec = rec;
    try {
      rec.start();
    } catch {
      setTimeout(() => {
        if (!_isListening || _rec !== rec) return;
        try { rec.start(); } catch {
          _rec         = null;
          _isListening = false;
          if (_onError) _onError();
        }
      }, 200);
    }
  }
}

// ---- 公開 API ----

export function initSpeech(onInterim, onDone, onError) {
  _onInterim = onInterim || null;
  _onDone    = onDone    || null;
  _onError   = onError   || null;
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return false;
  _SpeechRecognitionCtor = Ctor;
  return true;
}

export function startListening() {
  if (!_SpeechRecognitionCtor) return;
  _finalText     = '';
  _interimText   = '';
  _isListening   = true;
  _stopRequested = false;
  _startNewSession();
}

export function stopListening() {
  _isListening   = false;
  _stopRequested = true;
  if (_rec) try { _rec.stop(); } catch {}
  // フォールバック: onend が 500ms 以内に来ない場合に強制処理
  setTimeout(() => {
    if (!_stopRequested) return;
    _stopRequested = false;
    const raw = (_finalText || _interimText).trim();
    _finalText = ''; _interimText = '';
    if (_onDone) _onDone(raw);
  }, 500);
}

// ---- テキスト正規化 ----
function normalizeText(text) {
  return text
    // 全角数字 → 半角
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 0x30))
    // 漢数字 → 半角
    .replace(/[一二三四五六七八九〇十百千万]/g, kanjiToNum)
    // 「マイナス」テキスト → スペース付き -（前後の数字と分離するため）
    .replace(/マイナス/g, ' -')
    // 長音符（ー U+30FC / ｰ U+FF70）→ スペース付き -
    // iOS 音声認識が「マイナス」を長音符として返す場合の対応
    .replace(/[\u30FC\uFF70]/g, ' -')
    // 千単位区切りカンマを除去（"2,295" → "2295", "1,234,567" → "1234567"）
    // ※ 座標区切りとしてのカンマより先に処理する（最大2回で7桁まで対応）
    .replace(/(\d),(\d)/g, '$1$2')
    .replace(/(\d),(\d)/g, '$1$2')
    // 各種ダッシュ・マイナス記号を半角 - に統一
    // U+2010 HYPHEN, U+2011 NON-BREAKING HYPHEN, U+2012 FIGURE DASH,
    // U+2013 EN DASH, U+2014 EM DASH, U+2015 HORIZONTAL BAR,
    // U+2212 MINUS SIGN（iOS Edge が返す）, U+FF0D FULLWIDTH HYPHEN-MINUS
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFF0D]/g, ' -')
    // 数字の直後に来た - を分離（"226-22" → "226 -22"）
    .replace(/(\d)-/g, '$1 -')
    // "-" と直後の数字の間のスペースを除去（"- 22" → "-22"）
    .replace(/-\s+(\d)/g, '-$1')
    // 日本語文字・アルファベット等の直後に数字が来たらスペースを挿入
    .replace(/([^\d\s\-])(\d)/g, '$1 $2')
    // 読点・句点・カンマ → スペース
    .replace(/[、。,.，．]/g, ' ')
    // 連続スペース → 単一スペース
    .replace(/\s+/g, ' ')
    .trim();
}

function kanjiToNum(c) {
  const map = { '〇':'0','一':'1','二':'2','三':'3','四':'4','五':'5','六':'6','七':'7','八':'8','九':'9','十':'10','百':'100','千':'1000','万':'10000' };
  return map[c] || c;
}

// ---- 座標のみパース（名前なし）----
export function parseCoordOnly(raw) {
  const text = normalizeText(raw);
  // 厳密パターン（数字のみ）
  const strict = [
    [/^(-?\d+)\s+(-?\d+)\s+(-?\d+)$/, 3],              // x y z
    [/^X\s*(-?\d+)\s+Y\s*(-?\d+)\s+Z\s*(-?\d+)$/i, 3], // X:x Y:y Z:z
    [/^(-?\d+)\s+(-?\d+)$/, 2],                         // x z (y省略)
  ];
  for (const [pat, n] of strict) {
    const m = text.match(pat);
    if (m) {
      return n === 3
        ? { x: +m[1], y: +m[2], z: +m[3] }
        : { x: +m[1], y: 64,    z: +m[2] };
    }
  }
  // フォールバック: テキスト中の数字を順に抽出（「えーと 100 64 マイナス200」など）
  const nums = text.match(/-?\d+/g);
  if (nums && nums.length >= 3) return { x: +nums[0], y: +nums[1], z: +nums[2] };
  if (nums && nums.length === 2) return { x: +nums[0], y: 64, z: +nums[1] };
  return null;
}
