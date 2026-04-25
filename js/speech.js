let recognition  = null;
let _onInterim   = null;
let _onError     = null;
let _isListening = false;
let _finalText   = '';

export function initSpeech(onInterim, onError) {
  _onInterim = onInterim || null;
  _onError   = onError   || null;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return false;

  recognition = new SpeechRecognition();
  recognition.lang            = 'ja-JP';
  recognition.continuous      = true;   // 発話の途中で止まらない
  recognition.interimResults  = true;   // 暫定テキストをリアルタイム取得
  recognition.maxAlternatives = 3;

  recognition.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) {
        _finalText += e.results[i][0].transcript;
      } else {
        interim = e.results[i][0].transcript;
      }
    }
    // リアルタイム表示用コールバック
    const display = (_finalText + interim).trim();
    if (_onInterim) _onInterim(display);
    // 自動パースしない: ユーザーがマイクを再押しするまで聴き続ける
  };

  recognition.onerror = (e) => {
    // no-speech / audio-capture は一時的なもの → 無視して継続
    if (e.error === 'no-speech' || e.error === 'audio-capture') return;
    _isListening = false;
    if (recognition) try { recognition.stop(); } catch {}
    if (_onError) _onError();
  };

  recognition.onend = () => {
    // continuous=true でも端末によっては onend が来る → 聞き中なら再起動
    if (_isListening) {
      setTimeout(() => {
        if (_isListening) try { recognition.start(); } catch {}
      }, 100);
    }
  };

  return true;
}

export function startListening() {
  if (!recognition) return;
  _finalText   = '';
  _isListening = true;
  try { recognition.start(); } catch {}
}

export function stopListening() {
  _isListening = false;
  const raw = _finalText.trim();
  if (recognition) try { recognition.stop(); } catch {}
  return raw;
}

// ---- テキスト正規化 ----
function normalizeText(text) {
  return text
    // 全角数字 → 半角
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 0x30))
    // 漢数字 → 半角
    .replace(/[一二三四五六七八九〇十百千万]/g, kanjiToNum)
    // 「マイナス/－/−」の直前（非スペース）にスペースを挿入
    .replace(/([^\s])(マイナス|－|−)/g, '$1 $2')
    // マイナス表記 → -
    .replace(/マイナス|－|−/g, '-')
    // 日本語文字・アルファベット等の直後に数字が来たらスペースを挿入
    // （名前と座標が繋がった場合の分離）
    .replace(/([^\d\s\-])(\d)/g, '$1 $2')
    // 読点・句点・カンマ → スペース
    .replace(/[、。,.，．]/g, ' ')
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
