/**
 * Pemberitahuan dari browser: bunyi, getar, dan pesan Telegram.
 * Telegram dikirim langsung dari perangkat ke api.telegram.org (tanpa server perantara).
 */

const TOKEN_RE = /^\d+:[\w-]+$/;

export async function sendTelegram({ token, chatId }, text, fetchFn = fetch) {
  const t = (token ?? '').trim();
  const chat = String(chatId ?? '').trim();
  if (!t || !chat) return { ok: false, error: 'Token dan Chat ID belum diisi' };
  if (!TOKEN_RE.test(t)) return { ok: false, error: 'Format token tidak valid' };
  try {
    // Body form-urlencoded = "simple request" (tanpa preflight CORS)
    const res = await fetchFn(`https://api.telegram.org/bot${t}/sendMessage`, {
      method: 'POST',
      body: new URLSearchParams({ chat_id: chat, text }),
    });
    const json = await res.json().catch(() => ({}));
    return json.ok ? { ok: true } : { ok: false, error: json.description || `HTTP ${res.status}` };
  } catch {
    return { ok: false, error: 'Tidak bisa terhubung ke Telegram' };
  }
}

export function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.onended = () => ctx.close();
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    /* bunyi tidak tersedia: abaikan */
  }
}

export function vibrate() {
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    /* getar tidak tersedia: abaikan */
  }
}
