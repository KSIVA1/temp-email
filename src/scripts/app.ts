// ─────────────────────────────────────────────────────────────────────────
//  InboxForNow — client interactivity
//  Prototype logic. Real polling against the Cloudflare Worker API replaces
//  simulateOne() and the MOCK_MAILS table; the rest of the wiring stays.
// ─────────────────────────────────────────────────────────────────────────

type Mail = {
  id: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  preview: string;
  bodyHtml: string;     // assumed already sanitized server-side
  receivedAt: number;   // epoch ms
  read: boolean;
  otp?: string;         // extracted code if detected
};

type ApiMessage = {
  id: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  preview: string;
  bodyHtml: string;
  receivedAt: number;
  otp?: string;
};

type HistoryEntry = {
  address: string;
  createdAt: number;
  expiredAt: number;
};

type Settings = {
  sound: boolean;
  notifications: boolean; // user has opted in
};

const API_BASE = import.meta.env.PUBLIC_API_BASE || 'https://api.inboxfornow.com';
const IS_DEV = import.meta.env.DEV;

let RECEIVING_DOMAINS = ['veqla.com'];

const ANIMALS = [
  'fox', 'heron', 'otter', 'wren', 'pine', 'crane', 'badger', 'lynx',
  'sparrow', 'marten', 'rook', 'vole', 'dove', 'wolf', 'bear', 'eagle',
  'hawk', 'finch', 'robin', 'swift', 'falcon', 'osprey', 'raven', 'jay',
  'owl', 'hare', 'mole', 'shrew', 'stoat', 'ferret', 'bison', 'moose',
  'elk', 'deer', 'stag', 'ram', 'goat', 'lamb', 'puma', 'tiger',
  'lion', 'panther', 'jaguar', 'cobra', 'viper', 'gecko', 'newt', 'toad',
  'frog', 'salmon', 'trout', 'bass', 'pike', 'perch', 'carp', 'cod',
  'tuna', 'seal', 'whale', 'walrus', 'panda', 'koala', 'sloth', 'lemur',
  'chimp', 'gibbon', 'tapir', 'camel', 'llama', 'alpaca', 'zebra', 'rhino',
  'hippo', 'gator', 'iguana', 'parrot', 'macaw', 'toucan', 'stork', 'ibis',
  'egret', 'pelican', 'puffin', 'tern', 'gull', 'lark', 'pipit', 'dingo',
  'jackal', 'hyena', 'mink', 'orca', 'ray', 'squid', 'clam', 'snail',
  'crab', 'moth', 'beetle', 'ant', 'wasp', 'cricket', 'mantis', 'cicada',
  'coral', 'starling', 'magpie', 'thrush', 'oriole', 'bunting', 'plover',
  'curlew', 'avocet', 'gannet', 'grouse', 'quail', 'pheasant', 'condor',
  'kite', 'ermine', 'bobcat', 'coyote', 'emu', 'kiwi', 'skunk',
];

const DEFAULT_TTL = 10 * 60; // seconds
const HISTORY_MAX = 5;
// Read whatever <title> the page shipped with — so per-page titles
// (e.g. "Temporary email for Discord — InboxForNow") are preserved when
// we slap an unread-count prefix on top of them.
const TITLE_BASE  = document.title;

// ── State ─────────────────────────────────────────────────────────────────

const state = {
  inboxId: '',
  localPart: 'fox9821',
  domain: RECEIVING_DOMAINS[0],
  createdAt: Date.now(),
  expiresAt: Date.now() + DEFAULT_TTL * 1000,
  mail: [] as Mail[],
  qrShown: false,
  imagesOn: false,
  activeMailId: null as string | null,
  unread: 0,
  history: [] as HistoryEntry[],
  settings: { sound: false, notifications: false } as Settings,
};

let pollTimer = 0;
let lastMessageTs = 0;
let consecutiveErrors = 0;

// ── Persistence helpers ──────────────────────────────────────────────────

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem('ifn-settings');
    if (!raw) return { sound: false, notifications: false };
    const parsed = JSON.parse(raw);
    return {
      sound: !!parsed.sound,
      notifications: !!parsed.notifications && Notification?.permission === 'granted',
    };
  } catch { return { sound: false, notifications: false }; }
}

function saveSettings() {
  try { localStorage.setItem('ifn-settings', JSON.stringify(state.settings)); } catch {}
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem('ifn-history');
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch { return []; }
}

function saveHistory() {
  try { localStorage.setItem('ifn-history', JSON.stringify(state.history)); } catch {}
}

// ── Helpers ──────────────────────────────────────────────────────────────

function $<T extends Element>(sel: string): T {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Missing selector: ${sel}`);
  return el;
}
function $opt<T extends Element>(sel: string): T | null {
  return document.querySelector<T>(sel);
}

function generateLocal(): string {
  const a = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const num = Math.floor(10000 + Math.random() * 90000);
  return `${a}${num}`;
}

function pad(n: number): string { return n.toString().padStart(2, '0'); }

function fmtRelative(t: number): string {
  const diff = Math.max(0, Date.now() - t);
  if (diff < 60_000) return 'just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]!));
}
function escapeAttr(s: string): string { return escapeHtml(s); }

// ── OTP detection ────────────────────────────────────────────────────────
//
// Strategy: strip HTML to text, then look for likely verification codes.
// Priority is in this order:
//   1. Content inside `<span class="otp">` — explicit
//   2. A 4–8 digit number that follows or sits near a keyword (code, verify,
//      pin, verification)
//   3. A standalone 4–8 digit number
// Returns the normalized code (digits or alphanumerics, no separators).

const OTP_KEYWORDS = /\b(code|verification|verify|otp|pin|one[\s-]?time|passcode|password)\b/i;
const OTP_PATTERN  = /\b(?:\d[\s-]?){3,7}\d\b|\b[A-Z0-9]{4,8}\b/;

function detectOTP(html: string): string | null {
  // 1. Explicit .otp tag
  const explicit = html.match(/<[^>]+class\s*=\s*["'][^"']*\botp\b[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
  if (explicit) {
    const code = explicit[1].replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, '').replace(/[\s-]/g, '').trim();
    if (/^[A-Z0-9]{4,10}$/i.test(code)) return code.toUpperCase();
  }

  // Strip HTML to plain text for further scanning
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 2. Near a keyword: pick the closest digit/alpha pattern after a keyword
  const keyword = OTP_KEYWORDS.exec(text);
  if (keyword) {
    const window = text.slice(keyword.index, keyword.index + 120);
    const m = OTP_PATTERN.exec(window);
    if (m) {
      const code = m[0].replace(/[\s-]/g, '');
      if (/^[A-Z0-9]{4,10}$/i.test(code) && !/^[a-z]+$/i.test(code)) return code.toUpperCase();
    }
  }

  // 3. Standalone — only return if it looks like a clear code
  const standalone = text.match(/\b\d{3}[\s-]?\d{3}\b|\b\d{4,8}\b/);
  if (standalone) {
    const code = standalone[0].replace(/[\s-]/g, '');
    if (/^\d{4,8}$/.test(code)) return code;
  }

  return null;
}

function formatOTPForDisplay(code: string): string {
  // Space-separate every 3 chars for visual grouping ("418229" → "418 229")
  if (code.length === 6) return `${code.slice(0, 3)} ${code.slice(3)}`;
  if (code.length === 8) return `${code.slice(0, 4)} ${code.slice(4)}`;
  return code;
}

// ── Address ──────────────────────────────────────────────────────────────

function fullAddress(): string {
  return `${state.localPart}@${state.domain}`;
}

function renderAddress() {
  $<HTMLSpanElement>('#addr-local').textContent = state.localPart;
  $<HTMLSpanElement>('#addr-domain').textContent = state.domain;
  $<HTMLDivElement>('#reader-to').textContent = fullAddress();
  if (state.qrShown) renderQr();
}

function pushCurrentToHistory() {
  if (!state.localPart) return;
  const entry: HistoryEntry = {
    address: fullAddress(),
    createdAt: state.createdAt,
    expiredAt: Date.now(),
  };
  state.history = [entry, ...state.history.filter((h) => h.address !== entry.address)].slice(0, HISTORY_MAX);
  saveHistory();
  renderHistory();
}

async function regenerate() {
  pushCurrentToHistory();
  await createFreshInbox();
}

async function createFreshInbox(showToast = true) {
  stopPolling();
  const inbox = await createInbox();
  const [localPart, domain] = inbox.address.split('@');
  state.inboxId = inbox.id;
  state.localPart = localPart;
  state.domain = domain;
  state.createdAt = Date.now();
  state.expiresAt = inbox.expiresAt;
  state.mail = [];
  state.unread = 0;
  state.activeMailId = null;
  lastMessageTs = 0;
  updateTitleBadge();
  renderAddress();
  renderTimer();
  renderMail();
  closeReader();
  startPolling();
  if (showToast) toast({ message: 'Fresh address generated' });
}

function copyAddress() {
  navigator.clipboard.writeText(fullAddress()).then(() => {
    toast({ message: `Copied · ${fullAddress()}`, kind: 'success' });
    flashCopy();
  }).catch(() => {
    toast({ message: 'Could not copy. Try selecting manually.' });
  });
}

function flashCopy() {
  const btn = $<HTMLButtonElement>('#copy-btn');
  btn.classList.add('btn--flash');
  window.setTimeout(() => btn.classList.remove('btn--flash'), 500);
}

// ── Timer ────────────────────────────────────────────────────────────────

function renderTimer() {
  const secsLeft = Math.max(0, Math.floor((state.expiresAt - Date.now()) / 1000));
  
  const d = Math.floor(secsLeft / 86400);
  const h = Math.floor((secsLeft % 86400) / 3600);
  const m = Math.floor((secsLeft % 3600) / 60);
  const s = secsLeft % 60;

  const clockEl = $<HTMLSpanElement>('#timer-clock');

  if (d >= 1) {
    clockEl.innerHTML = `<span class="address__clock-n">${d}d</span> <span class="address__clock-n">${pad(h)}</span><span class="address__clock-c">:</span><span class="address__clock-n">${pad(m)}</span><span class="address__clock-c">:</span><span class="address__clock-n">${pad(s)}</span>`;
  } else if (h >= 1) {
    clockEl.innerHTML = `<span class="address__clock-n">${pad(h)}</span><span class="address__clock-c">:</span><span class="address__clock-n">${pad(m)}</span><span class="address__clock-c">:</span><span class="address__clock-n">${pad(s)}</span>`;
  } else {
    clockEl.innerHTML = `<span class="address__clock-n">${pad(m)}</span><span class="address__clock-c">:</span><span class="address__clock-n">${pad(s)}</span>`;
  }

  if (secsLeft === 0 && state.expiresAt !== 0) {
    pushCurrentToHistory();
    state.mail = [];
    state.unread = 0;
    state.activeMailId = null;
    updateTitleBadge();
    closeReader();
    renderMail();
    openExpiredModal();
    state.expiresAt = 0; // sentinel — frozen
  }
}

async function extend(seconds: number) {
  if (!state.inboxId) return;
  const res = await apiFetch(`/api/inbox/${state.inboxId}/extend`, {
    method: 'POST',
    body: JSON.stringify({ seconds }),
  });
  const body = await res.json() as { expiresAt: number };
  state.expiresAt = body.expiresAt;
  renderTimer();
  const label = seconds >= 86400 ? '+24 hours'
              : seconds >= 3600  ? '+1 hour'
              : '+10 minutes';
  toast({ message: `Timer extended · ${label}` });
}

async function burnNow() {
  if (state.inboxId) {
    await apiFetch(`/api/inbox/${state.inboxId}`, { method: 'DELETE' });
  }
  pushCurrentToHistory();
  stopPolling();
  state.inboxId = '';
  state.expiresAt = Date.now();
  renderTimer();
  toast({ message: 'Inbox deleted.' });
}

async function fetchActiveDomains() {
  const res = await apiFetch('/api/domains/active');
  const body = await res.json() as { domains?: string[] };
  if (Array.isArray(body.domains) && body.domains.length > 0) {
    RECEIVING_DOMAINS = body.domains;
  }
}

async function createInbox(): Promise<{ id: string; address: string; expiresAt: number }> {
  const turnstileToken = await getTurnstileToken();
  const res = await apiFetch('/api/inbox', {
    method: 'POST',
    body: JSON.stringify({ turnstileToken }),
    headers: turnstileToken ? { 'Content-Type': 'application/json' } : undefined,
  });
  return res.json();
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    throw new ApiError(res.status, `API ${res.status}`);
  }
  return res;
}

async function getTurnstileToken(): Promise<string | undefined> {
  const widget = document.getElementById('turnstile-widget');
  const turnstile = (window as any).turnstile;
  if (!widget || !turnstile) return undefined;
  if (!widget.dataset.widgetId && widget.dataset.sitekey) {
    widget.dataset.widgetId = turnstile.render(widget, {
      sitekey: widget.dataset.sitekey,
      size: 'invisible',
    });
  }
  if (!widget.dataset.widgetId) return undefined;
  return turnstile.execute(widget.dataset.widgetId, { async: true });
}

function handleApiError(err?: Error | string) {
  let message = 'Could not reach the inbox service. Tap to retry.';
  let label = 'Unavailable';

  if (typeof err === 'string') {
    message = err;
  } else if (err instanceof ApiError) {
    if (err.status === 429) {
      label = 'Rate limited';
      message = 'Too many requests. Please wait a few minutes and try again.';
    }
  }

  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (isOffline) label = 'Offline';

  setStatus('alert', label);
  const empty = $<HTMLDivElement>('#empty-state');
  empty.dataset.error = 'true';
  const retry = empty.querySelector<HTMLButtonElement>('[data-api-retry]');
  if (retry) retry.hidden = false;
  toast({ message });
}

function clearApiError() {
  consecutiveErrors = 0;
  const empty = $<HTMLDivElement>('#empty-state');
  delete empty.dataset.error;
  const retry = empty.querySelector<HTMLButtonElement>('[data-api-retry]');
  if (retry) retry.hidden = true;
}

// ── QR ───────────────────────────────────────────────────────────────────

function toggleQr() {
  state.qrShown = !state.qrShown;
  const panel = $<HTMLDivElement>('#qr-panel');
  const btn = $<HTMLButtonElement>('#qr-btn');
  panel.hidden = !state.qrShown;
  btn.setAttribute('aria-expanded', String(state.qrShown));
  if (state.qrShown) renderQr();
}

function renderQr() {
  // Decorative QR-style placeholder. Real apps should ship a QR lib.
  const seed = fullAddress();
  const size = 21;
  const cells: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 131 + seed.charCodeAt(i)) >>> 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      h = (h * 1103515245 + 12345) >>> 0;
      cells[y][x] = ((h >> 16) & 1) === 1;
    }
  }
  const drawFinder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
      const onBorder = x === 0 || y === 0 || x === 6 || y === 6;
      const inCore   = x >= 2 && x <= 4 && y >= 2 && y <= 4;
      cells[oy + y][ox + x] = onBorder || inCore;
    }
  };
  drawFinder(0, 0); drawFinder(size - 7, 0); drawFinder(0, size - 7);

  const cell = 100 / size;
  let rects = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (cells[y][x]) {
        rects += `<rect x="${(x * cell).toFixed(2)}" y="${(y * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}"/>`;
      }
    }
  }
  const svg = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" fill="currentColor">${rects}</svg>`;
  $<HTMLDivElement>('#qr-canvas').innerHTML = svg;
}

// ── Status pill ──────────────────────────────────────────────────────────

function setStatus(kind: 'waiting' | 'active' | 'alert', label: string) {
  const pill = $<HTMLSpanElement>('#status-pill');
  pill.dataset.status = kind;
  $<HTMLSpanElement>('#status-label').textContent = label;
}

// ── Mail list rendering ──────────────────────────────────────────────────

function renderMail(enteringId?: string) {
  const list = $<HTMLUListElement>('#mail-list');
  list.innerHTML = '';
  if (state.mail.length === 0) {
    list.classList.remove('has-items');
    $<HTMLDivElement>('#empty-state').style.display = '';
    if ($<HTMLDivElement>('#empty-state').dataset.error !== 'true') setStatus('waiting', 'Waiting');
    return;
  }
  list.classList.add('has-items');
  $<HTMLDivElement>('#empty-state').style.display = 'none';
  setStatus('active', `${state.mail.length} ${state.mail.length === 1 ? 'message' : 'messages'}`);

  for (const m of state.mail) {
    const isEntering = m.id === enteringId;
    const li = document.createElement('li');
    li.className = 'envelope'
      + (m.read ? '' : ' envelope--new')
      + (isEntering ? ' envelope--enter' : '');
    li.dataset.id = m.id;
    const otpBadge = m.otp ? `<span class="envelope__code" title="Verification code">${escapeHtml(formatOTPForDisplay(m.otp))}</span>` : '';
    li.innerHTML = `
      <button class="envelope__btn" type="button" aria-label="Read message from ${escapeAttr(m.fromName)}">
        <div class="envelope__stamp" aria-hidden="true">${escapeHtml(fromInitials(m.fromName))}</div>
        <div class="envelope__body">
          <div class="envelope__top">
            <span class="envelope__from">${escapeHtml(m.fromName)}</span>
            <span class="envelope__time">${escapeHtml(fmtRelative(m.receivedAt))}</span>
          </div>
          <div class="envelope__subject">${escapeHtml(m.subject)}</div>
          <div class="envelope__bottom">
            <span class="envelope__preview">${escapeHtml(m.preview)}</span>
            ${otpBadge}
          </div>
        </div>
        ${m.read ? '' : '<span class="envelope__dot" aria-label="unread"></span>'}
      </button>
    `;
    list.appendChild(li);
    if (isEntering) {
      // Strip the entrance class once the CSS animation has played, so a
      // re-render doesn't trigger it again.
      window.setTimeout(() => li.classList.remove('envelope--enter'), 700);
    }
  }
}

function startPolling() {
  stopPolling();
  if (!state.inboxId) return;
  pollTimer = window.setInterval(() => {
    void pollMessages();
  }, 3000);
  void pollMessages();
}

function stopPolling() {
  if (pollTimer) window.clearInterval(pollTimer);
  pollTimer = 0;
}

async function pollMessages() {
  if (!state.inboxId) return;
  try {
    const res = await apiFetch(`/api/inbox/${state.inboxId}/messages?since=${lastMessageTs}`);
    const body = await res.json() as { messages?: ApiMessage[] };
    consecutiveErrors = 0;
    clearApiError();
    const incoming = (body.messages || [])
      .filter((m) => !state.mail.some((existing) => existing.id === m.id))
      .sort((a, b) => a.receivedAt - b.receivedAt);
    for (const apiMessage of incoming) {
      const mail: Mail = { ...apiMessage, read: false };
      lastMessageTs = Math.max(lastMessageTs, mail.receivedAt);
      state.mail = [mail, ...state.mail].slice(0, 12);
      if (document.hidden) {
        state.unread += 1;
        updateTitleBadge();
      }
      renderMail(mail.id);
      setStatus('alert', 'New');
      toast({ mail });
      playChime();
      maybeNotify(mail);
    }
  } catch (err) {
    consecutiveErrors++;
    if (consecutiveErrors >= 2) {
      handleApiError(err instanceof Error ? err : undefined);
    }
  }
}

function fromInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Title badge (unread counter when tab hidden) ─────────────────────────

function updateTitleBadge() {
  if (state.unread > 0 && document.hidden) {
    document.title = `(${state.unread}) ` + TITLE_BASE;
  } else {
    document.title = TITLE_BASE;
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    state.unread = 0;
    updateTitleBadge();
  }
});

// ── Reader ───────────────────────────────────────────────────────────────

function openReader(mailId: string) {
  const m = state.mail.find((x) => x.id === mailId);
  if (!m) return;
  m.read = true;
  state.activeMailId = mailId;
  renderMail();

  $<HTMLSpanElement>('#reader-from-name').textContent = m.fromName;
  $<HTMLSpanElement>('#reader-from-email').textContent = m.fromEmail;
  $<HTMLHeadingElement>('#reader-subject').textContent = m.subject;
  $<HTMLDivElement>('#reader-to').textContent = fullAddress();

  const date = new Date(m.receivedAt);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const days   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const hh = pad(date.getHours()); const mm = pad(date.getMinutes());
  $<HTMLElement>('#reader-stamp-date').textContent =
    `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()} · ${hh}:${mm}`;

  // OTP chip — render above the body if a code was detected
  const otpHost = $<HTMLDivElement>('#reader-otp');
  if (m.otp) {
    const formatted = formatOTPForDisplay(m.otp);
    otpHost.hidden = false;
    otpHost.innerHTML = `
      <div class="otp-chip">
        <div class="otp-chip__meta">
          <span class="otp-chip__label">Verification code</span>
          <span class="otp-chip__hint">Auto-detected from this message</span>
        </div>
        <div class="otp-chip__code" id="otp-code">${escapeHtml(formatted)}</div>
        <button class="btn btn--primary otp-chip__copy" type="button" data-otp="${escapeAttr(m.otp)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <rect x="9" y="9" width="11" height="11" rx="2"/>
            <path d="M5 15V6a2 2 0 0 1 2-2h9" stroke-linecap="round"/>
          </svg>
          Copy code
        </button>
      </div>
    `;
  } else {
    otpHost.hidden = true;
    otpHost.innerHTML = '';
  }

  $<HTMLDivElement>('#reader-body').innerHTML = m.bodyHtml;

  $<HTMLElement>('#reader').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  state.imagesOn = false;
  $<HTMLDivElement>('#reader-body').classList.remove('images-on');
}

function closeReader() {
  $<HTMLElement>('#reader').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  state.activeMailId = null;
}

function copyOTP(code: string) {
  navigator.clipboard.writeText(code).then(() => {
    toast({ message: `Code ${formatOTPForDisplay(code)} copied`, kind: 'success' });
  }).catch(() => {
    toast({ message: 'Could not copy code.' });
  });
}

function toggleReaderImages() {
  state.imagesOn = !state.imagesOn;
  const body = $<HTMLDivElement>('#reader-body');
  body.classList.toggle('images-on', state.imagesOn);
  const btn = $<HTMLButtonElement>('#reader-images-btn');
  btn.innerHTML = state.imagesOn
    ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3l18 18M10.5 10.5a2 2 0 1 0 3 3M3 3h18v18M21 15l-5-5-3 3" stroke-linecap="round" stroke-linejoin="round"/></svg> Hide images`
    : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21" stroke-linecap="round" stroke-linejoin="round"/></svg> Show images`;
}

// ── Toast ─────────────────────────────────────────────────────────────────
//
// Two flavours:
//   - Plain:  { message, kind? }                          — short status
//   - Mail:   { mail }                                    — interactive card
//             includes sender + subject + optional code + Copy code + View

type ToastInput =
  | { message: string; kind?: 'success' | 'default' }
  | { mail: Mail };

let toastDismissTimer = 0;

function toast(input: ToastInput) {
  const root = $<HTMLDivElement>('#toast');
  window.clearTimeout(toastDismissTimer);

  if ('mail' in input) {
    const m = input.mail;
    const code = m.otp ? formatOTPForDisplay(m.otp) : null;
    root.dataset.variant = 'mail';
    root.innerHTML = `
      <div class="toast__icon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <rect x="3" y="5" width="18" height="14" rx="2"/>
          <path d="M3 7 L12 13 L21 7" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="toast__body">
        <div class="toast__title">${escapeHtml(m.fromName)} ${code ? `· <span class="toast__code">${escapeHtml(code)}</span>` : ''}</div>
        <div class="toast__sub">${escapeHtml(m.subject)}</div>
      </div>
      <div class="toast__actions">
        ${m.otp ? `<button class="btn btn--tiny btn--primary" data-toast-copy="${escapeAttr(m.otp)}">Copy code</button>` : ''}
        <button class="btn btn--tiny btn--ghost" data-toast-view="${escapeAttr(m.id)}">View</button>
        <button class="toast__close" aria-label="Dismiss" data-toast-close>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg>
        </button>
      </div>
    `;
    root.classList.add('is-shown');
    toastDismissTimer = window.setTimeout(() => root.classList.remove('is-shown'), 8000);
  } else {
    const kind = input.kind || 'default';
    root.dataset.variant = 'plain';
    root.innerHTML = `
      <div class="toast__icon" aria-hidden="true">
        ${kind === 'success'
          ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
          : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01" stroke-linecap="round"/></svg>`
        }
      </div>
      <div class="toast__body">
        <div class="toast__title">${escapeHtml(input.message)}</div>
      </div>
    `;
    root.classList.add('is-shown');
    toastDismissTimer = window.setTimeout(() => root.classList.remove('is-shown'), 2400);
  }
}

function dismissToast() {
  const root = $<HTMLDivElement>('#toast');
  root.classList.remove('is-shown');
  window.clearTimeout(toastDismissTimer);
}

// ── Sound ────────────────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null;

function playChime() {
  if (!state.settings.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioCtx;
    if (!ctx) return;

    // Two-note ping: 880 Hz → 1175 Hz, ~180ms, gentle envelope.
    const now = ctx.currentTime;
    const make = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.18, now + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    };
    make(880, 0, 0.18);
    make(1175, 0.09, 0.22);
  } catch { /* no audio is fine */ }
}

function toggleSound() {
  state.settings.sound = !state.settings.sound;
  saveSettings();
  refreshSoundUI();
  if (state.settings.sound) {
    playChime();
    toast({ message: 'Sound on', kind: 'success' });
  } else {
    toast({ message: 'Sound off' });
  }
}

function refreshSoundUI() {
  const btn = $<HTMLButtonElement>('#sound-toggle');
  btn.setAttribute('aria-pressed', String(state.settings.sound));
  btn.setAttribute('aria-label', state.settings.sound ? 'Mute notifications' : 'Enable notification sound');
}

// ── Desktop notifications ────────────────────────────────────────────────

async function toggleNotifications() {
  if (typeof Notification === 'undefined') {
    toast({ message: 'This browser doesn\'t support desktop notifications.' });
    return;
  }
  if (state.settings.notifications) {
    state.settings.notifications = false;
    saveSettings();
    refreshNotificationsUI();
    toast({ message: 'Notifications off' });
    return;
  }
  let perm: NotificationPermission = Notification.permission;
  if (perm === 'default') {
    perm = await Notification.requestPermission();
  }
  if (perm === 'granted') {
    state.settings.notifications = true;
    saveSettings();
    refreshNotificationsUI();
    toast({ message: 'Notifications on', kind: 'success' });
  } else {
    toast({ message: 'Notifications were blocked.' });
  }
}

function refreshNotificationsUI() {
  const btn = $<HTMLButtonElement>('#notif-toggle');
  btn.setAttribute('aria-pressed', String(state.settings.notifications));
  btn.setAttribute('aria-label', state.settings.notifications ? 'Disable desktop notifications' : 'Enable desktop notifications');
}

function maybeNotify(m: Mail) {
  if (!state.settings.notifications) return;
  if (!document.hidden) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const body = m.otp ? `Code: ${formatOTPForDisplay(m.otp)} · ${m.subject}` : m.subject;
    const n = new Notification(`${m.fromName} → InboxForNow`, {
      body,
      icon: '/icons/icon.svg',
      tag: 'ifn-mail',
    });
    n.onclick = () => {
      window.focus();
      openReader(m.id);
      n.close();
    };
  } catch { /* ignore */ }
}

// ── History ──────────────────────────────────────────────────────────────

function renderHistory() {
  const host = $opt<HTMLElement>('#history');
  if (!host) return;
  if (state.history.length === 0) {
    host.hidden = true;
    host.innerHTML = '';
    return;
  }
  host.hidden = false;
  const items = state.history.map((h) => `
    <li class="history__item">
      <div class="history__main">
        <span class="history__addr">${escapeHtml(h.address)}</span>
        <span class="history__when">${escapeHtml(fmtRelative(h.createdAt))} · expired</span>
      </div>
      <div class="history__actions">
        <button class="btn btn--tiny btn--ghost" type="button" data-history-copy="${escapeAttr(h.address)}" aria-label="Copy ${escapeAttr(h.address)}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <rect x="9" y="9" width="11" height="11" rx="2"/>
            <path d="M5 15V6a2 2 0 0 1 2-2h9" stroke-linecap="round"/>
          </svg>
          Copy
        </button>
        <button class="history__remove" type="button" data-history-remove="${escapeAttr(h.address)}" aria-label="Remove from history">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg>
        </button>
      </div>
    </li>
  `).join('');
  host.innerHTML = `
    <div class="history__head">
      <span class="label"><span class="label__dot label__dot--idle" aria-hidden="true"></span>Recently used</span>
      <button class="history__clear" type="button" id="history-clear">Clear all</button>
    </div>
    <ul class="history__list">${items}</ul>
  `;
}

function clearHistory() {
  state.history = [];
  saveHistory();
  renderHistory();
  toast({ message: 'History cleared' });
}

// ── Mock incoming mail ────────────────────────────────────────────────────

type MailCategory = 'code' | 'link' | 'news';

const MOCK_MAILS: (Omit<Mail, 'id' | 'receivedAt' | 'read' | 'otp'> & { category: MailCategory })[] = [
  {
    category: 'code',
    fromName: 'Discord',
    fromEmail: 'noreply@discord.com',
    subject: 'Verify your Discord account',
    preview: 'Your verification code is 418229. It expires in 10 minutes.',
    bodyHtml: `
      <p>Hi there,</p>
      <p>Your verification code is:</p>
      <p><span class="otp">418&nbsp;229</span></p>
      <p>This code expires in 10 minutes. If you didn't request it, ignore this message — no further action is needed.</p>
      <p>— The Discord team</p>
      <div class="image-placeholder">Discord wordmark image · blocked for your safety</div>
    `,
  },
  {
    category: 'code',
    fromName: 'Stripe',
    fromEmail: 'no-reply@stripe.com',
    subject: 'Your Stripe verification code',
    preview: 'Use this code to sign in: 938421. Never share it with anyone.',
    bodyHtml: `
      <p>Hi,</p>
      <p>To finish signing in to your Stripe account, enter this code:</p>
      <p><span class="otp">938421</span></p>
      <p>This code is good for 10 minutes. We will never ask for it on the phone.</p>
      <p>If this wasn't you, you can safely ignore this message.</p>
    `,
  },
  {
    category: 'code',
    fromName: 'GitHub',
    fromEmail: 'noreply@github.com',
    subject: '[GitHub] Please verify your email address',
    preview: 'Verification code: 274 016 — enter it to confirm this address.',
    bodyHtml: `
      <p>Hey there,</p>
      <p>To finish setting up your GitHub account, enter this verification code:</p>
      <p><span class="otp">274 016</span></p>
      <p>If you didn't request this, you can ignore the email.</p>
      <p>Thanks,<br/>The GitHub Team</p>
    `,
  },
  {
    category: 'link',
    fromName: 'Notion',
    fromEmail: 'team@notion.so',
    subject: 'Sign in to Notion',
    preview: 'A login link was requested for this address. It expires in 1 hour.',
    bodyHtml: `
      <p>Hello,</p>
      <p>Tap the button to sign in to your workspace.</p>
      <p><a href="#">Sign me in →</a></p>
      <blockquote>If this wasn't you, no action is needed — the link will quietly expire.</blockquote>
      <p>— Notion</p>
    `,
  },
  {
    category: 'link',
    fromName: 'Slack',
    fromEmail: 'auth@slack.com',
    subject: 'Your magic sign-in link',
    preview: 'Use this link to sign in to your workspace. It expires in 15 minutes.',
    bodyHtml: `
      <p>Hi,</p>
      <p>Click the button below to sign in to your Slack workspace.</p>
      <p><a href="#">Sign in to Slack →</a></p>
      <p>This magic link expires in 15 minutes and can only be used once.</p>
    `,
  },
  {
    category: 'news',
    fromName: 'Substack',
    fromEmail: 'no-reply@substack.com',
    subject: 'Confirm your subscription',
    preview: 'Thanks for subscribing. Click the link in this email to confirm.',
    bodyHtml: `
      <p>Hi friend,</p>
      <p>You're one click away from receiving the next issue of <em>The Quiet Letter</em>.</p>
      <p><a href="#">Confirm my subscription</a></p>
      <p>Welcome aboard.</p>
    `,
  },
];

function pickMock(category?: MailCategory) {
  const pool = category ? MOCK_MAILS.filter((m) => m.category === category) : MOCK_MAILS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function simulateOne(category?: MailCategory) {
  const template = pickMock(category);
  const mail: Mail = {
    ...template,
    id: 'm_' + Math.random().toString(36).slice(2, 10),
    receivedAt: Date.now(),
    read: false,
    otp: detectOTP(template.bodyHtml) || undefined,
  };
  state.mail = [mail, ...state.mail].slice(0, 12);

  if (document.hidden) {
    state.unread += 1;
    updateTitleBadge();
  }

  renderMail(mail.id);
  setStatus('alert', 'New');
  toast({ mail });
  playChime();
  maybeNotify(mail);

  // ease the alert back to "active" after the burst
  window.setTimeout(() => {
    if (state.mail.length) {
      setStatus('active', `${state.mail.length} ${state.mail.length === 1 ? 'message' : 'messages'}`);
    }
  }, 2200);
}

// ── Onboarding tour ──────────────────────────────────────────────────────

type TourStep = {
  target: string;
  title: string;
  body: string;
  placement?: 'auto' | 'top' | 'bottom';
};

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="address"]',
    title: 'Your throwaway address',
    body: 'Already generated and live. Copy it and paste it into any signup form — your real inbox stays out of it.',
  },
  {
    target: '[data-tour="postbox"]',
    title: 'Messages land here in real time',
    body: 'Verification codes, magic links and newsletter confirms appear within seconds. Codes are auto-detected and surfaced in a big tap-to-copy chip so you barely have to read the message.',
  },
  {
    target: '[data-tour="timer"]',
    title: 'Ten minutes, then it\'s gone',
    body: 'The address self-destructs and everything in the inbox is hard-deleted. Extend it with the chips below, or hit New address to start over.',
  },
];

let tourIdx = 0;
let tourResizeRaf = 0;

function startTour() {
  tourIdx = 0;
  const root = document.getElementById('tour');
  if (!root) return;
  root.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  renderTourStep();
}

function endTour() {
  const root = document.getElementById('tour');
  if (!root) return;
  root.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  try { localStorage.setItem('ifn-onboarded', '1'); } catch {}
}

function renderTourStep() {
  const root = document.getElementById('tour');
  const spotlight = document.getElementById('tour-spotlight');
  const panel = document.getElementById('tour-panel');
  if (!root || !spotlight || !panel) return;

  const step = TOUR_STEPS[tourIdx];
  if (!step) { endTour(); return; }
  root.setAttribute('data-step', String(tourIdx));

  // Update copy
  (document.getElementById('tour-title') as HTMLElement).textContent = step.title;
  (document.getElementById('tour-body')  as HTMLElement).textContent = step.body;

  // Step dots
  const dots = document.getElementById('tour-steps')!.children;
  for (let i = 0; i < dots.length; i++) {
    const d = dots[i] as HTMLElement;
    d.classList.toggle('is-active', i === tourIdx);
    d.classList.toggle('is-done',   i  < tourIdx);
  }

  // Next button label on last step
  (document.getElementById('tour-next') as HTMLButtonElement).innerHTML =
    tourIdx === TOUR_STEPS.length - 1
      ? `Got it`
      : `Next <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  // Position the spotlight + panel
  positionTour();
}

function positionTour() {
  const root = document.getElementById('tour');
  if (!root || root.getAttribute('aria-hidden') !== 'false') return;
  const step = TOUR_STEPS[tourIdx];
  if (!step) return;
  const target = document.querySelector<HTMLElement>(step.target);
  const spotlight = document.getElementById('tour-spotlight');
  const panel = document.getElementById('tour-panel');
  if (!target || !spotlight || !panel) return;

  // Scroll the target into view first
  const rect = target.getBoundingClientRect();
  const vh = window.innerHeight;
  if (rect.top < 80 || rect.bottom > vh - 80) {
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  // Re-measure after a beat (so the smooth scroll settles)
  window.requestAnimationFrame(() => {
    const r = target.getBoundingClientRect();
    const padding = 8;
    spotlight.style.top    = `${r.top - padding}px`;
    spotlight.style.left   = `${r.left - padding}px`;
    spotlight.style.width  = `${r.width + padding * 2}px`;
    spotlight.style.height = `${r.height + padding * 2}px`;

    // Panel placement — below if target is in upper 60% of viewport, otherwise above
    const panelW = Math.min(360, window.innerWidth - 32);
    const panelH = panel.offsetHeight || 200;
    const placeBelow = r.bottom + panelH + 24 < window.innerHeight - 16
      || r.top < window.innerHeight * 0.5;

    let panelTop  = placeBelow ? r.bottom + 16 : r.top - panelH - 16;
    let panelLeft = r.left + r.width / 2 - panelW / 2;

    // Clamp horizontally to viewport
    if (panelLeft < 16) panelLeft = 16;
    if (panelLeft + panelW > window.innerWidth - 16) panelLeft = window.innerWidth - 16 - panelW;
    if (panelTop < 16) panelTop = 16;
    if (panelTop + panelH > window.innerHeight - 16) panelTop = window.innerHeight - 16 - panelH;

    panel.style.top  = `${panelTop}px`;
    panel.style.left = `${panelLeft}px`;
  });
}

function bindTour() {
  const next = document.getElementById('tour-next');
  const prev = document.getElementById('tour-prev');
  next?.addEventListener('click', () => {
    if (tourIdx >= TOUR_STEPS.length - 1) endTour();
    else { tourIdx++; renderTourStep(); }
  });
  prev?.addEventListener('click', () => {
    if (tourIdx > 0) { tourIdx--; renderTourStep(); }
  });
  document.querySelectorAll('[data-tour-skip]').forEach((el) => {
    el.addEventListener('click', endTour);
  });

  // Reposition on resize / scroll
  const reposition = () => {
    if (tourResizeRaf) cancelAnimationFrame(tourResizeRaf);
    tourResizeRaf = requestAnimationFrame(positionTour);
  };
  window.addEventListener('resize', reposition);
  window.addEventListener('scroll', reposition, { passive: true });

  // Replay link
  document.querySelectorAll<HTMLElement>('[data-tour-replay]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      try { localStorage.removeItem('ifn-onboarded'); } catch {}
      startTour();
    });
  });

  // Esc closes
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('tour')?.getAttribute('aria-hidden') === 'false') {
      endTour();
    }
  });
}

// ── Expired modal ─────────────────────────────────────────────────────────

let expiredLastFocus: HTMLElement | null = null;

function openExpiredModal() {
  const root = document.getElementById('expired-modal');
  if (!root || root.getAttribute('aria-hidden') === 'false') return;
  expiredLastFocus = (document.activeElement instanceof HTMLElement) ? document.activeElement : null;
  root.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  // Focus the primary CTA after the transition starts
  window.requestAnimationFrame(() => {
    document.getElementById('xm-action')?.focus();
  });
}

function closeExpiredModal() {
  const root = document.getElementById('expired-modal');
  if (!root || root.getAttribute('aria-hidden') !== 'false') return;
  root.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  // Return focus to the refresh button, since that's the equivalent control
  const fallback = document.getElementById('refresh-btn') as HTMLElement | null;
  (expiredLastFocus ?? fallback)?.focus();
  expiredLastFocus = null;
}

function bindExpiredModal() {
  document.querySelectorAll('[data-xm-dismiss]').forEach((el) => {
    el.addEventListener('click', closeExpiredModal);
  });
  document.getElementById('xm-action')?.addEventListener('click', () => {
    closeExpiredModal();
    void regenerate().catch(() => handleApiError('Could not generate a new address. Tap to retry.'));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('expired-modal')?.getAttribute('aria-hidden') === 'false') {
      closeExpiredModal();
    }
  });
}

function maybeStartTourOnFirstVisit() {
  try {
    if (localStorage.getItem('ifn-onboarded')) return;
  } catch { return; }
  // Wait for the page to settle before opening the tour
  window.setTimeout(startTour, 1100);
}

// ── Boot ──────────────────────────────────────────────────────────────────

function bindEvents() {
  $<HTMLButtonElement>('#copy-btn').addEventListener('click', copyAddress);
  $<HTMLButtonElement>('#refresh-btn').addEventListener('click', () => void regenerate().catch(() => handleApiError('Could not generate a new address. Tap to retry.')));
  $<HTMLButtonElement>('#qr-btn').addEventListener('click', toggleQr);
  $<HTMLButtonElement>('#burn-btn').addEventListener('click', () => void burnNow().catch(() => handleApiError('Could not delete this inbox.')));

  document.querySelectorAll<HTMLButtonElement>('[data-extend]').forEach((b) => {
    b.addEventListener('click', () => void extend(parseInt(b.dataset.extend!, 10)).catch(() => handleApiError('Could not extend this inbox.')));
  });

  document.querySelectorAll<HTMLElement>('[data-reader-close]').forEach((el) => {
    el.addEventListener('click', closeReader);
  });
  $<HTMLButtonElement>('#reader-images-btn').addEventListener('click', toggleReaderImages);
  $<HTMLButtonElement>('#reader-delete-btn').addEventListener('click', () => {
    if (!state.activeMailId) return;
    const id = state.activeMailId;
    void apiFetch(`/api/inbox/${state.inboxId}/messages/${id}`, { method: 'DELETE' })
      .then(() => {
        state.mail = state.mail.filter((m) => m.id !== id);
        closeReader();
        renderMail();
        toast({ message: 'Message deleted.' });
      })
      .catch(() => handleApiError('Could not delete this message.'));
  });

  // OTP chip copy (inside the reader)
  $<HTMLElement>('#reader').addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const otpBtn = t.closest<HTMLButtonElement>('[data-otp]');
    if (otpBtn) copyOTP(otpBtn.dataset.otp!);
  });

  // Mail list — clicks
  $<HTMLUListElement>('#mail-list').addEventListener('click', (e) => {
    const li = (e.target as HTMLElement).closest('.envelope') as HTMLLIElement | null;
    if (!li) return;
    openReader(li.dataset.id!);
  });

  // Demo message picker — three labeled categories replace the random button
  document.querySelectorAll<HTMLButtonElement>('[data-demo]').forEach((b) => {
    if (!IS_DEV) return;
    b.addEventListener('click', () => {
      const cat = b.dataset.demo as MailCategory;
      simulateOne(cat);
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-api-retry]').forEach((b) => {
    b.addEventListener('click', () => {
      void bootInbox().catch(() => handleApiError());
    });
  });

  // Toast actions (delegated)
  $<HTMLDivElement>('#toast').addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const copy = t.closest<HTMLButtonElement>('[data-toast-copy]');
    const view = t.closest<HTMLButtonElement>('[data-toast-view]');
    const close = t.closest('[data-toast-close]');
    if (copy)  { copyOTP(copy.dataset.toastCopy!); dismissToast(); }
    if (view)  { openReader(view.dataset.toastView!); dismissToast(); }
    if (close) dismissToast();
  });

  // History — delegated
  const hist = $opt<HTMLElement>('#history');
  if (hist) {
    hist.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const copy   = t.closest<HTMLButtonElement>('[data-history-copy]');
      const remove = t.closest<HTMLButtonElement>('[data-history-remove]');
      const clear  = t.closest('#history-clear');
      if (copy) {
        navigator.clipboard.writeText(copy.dataset.historyCopy!).then(() => {
          toast({ message: `Copied · ${copy.dataset.historyCopy}`, kind: 'success' });
        });
      }
      if (remove) {
        state.history = state.history.filter((h) => h.address !== remove.dataset.historyRemove);
        saveHistory();
        renderHistory();
      }
      if (clear) clearHistory();
    });
  }

  // Theme toggle
  $<HTMLButtonElement>('#theme-toggle').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    const next = cur === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('ifn-theme', next); } catch {}
  });

  // Sound toggle
  $<HTMLButtonElement>('#sound-toggle').addEventListener('click', toggleSound);

  // Notifications toggle
  $<HTMLButtonElement>('#notif-toggle').addEventListener('click', toggleNotifications);

  // Esc closes reader / dismisses toast
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.activeMailId) closeReader();
      else dismissToast();
    }
  });

  // Online / offline awareness
  window.addEventListener('online', () => {
    clearApiError();
    if (state.mail.length === 0) {
      setStatus('waiting', 'Waiting');
    } else {
      setStatus('active', `${state.mail.length} ${state.mail.length === 1 ? 'message' : 'messages'}`);
    }
    if (state.inboxId) {
      void pollMessages();
    } else {
      void bootInbox().catch(() => handleApiError());
    }
  });

  window.addEventListener('offline', () => {
    const empty = $<HTMLDivElement>('#empty-state');
    empty.dataset.error = 'true';
    const retry = empty.querySelector<HTMLButtonElement>('[data-api-retry]');
    if (retry) retry.hidden = false;
    setStatus('alert', 'Offline');
  });
}

async function bootInbox() {
  try {
    await fetchActiveDomains();
    await createFreshInbox(false);
    clearApiError();
  } catch (err) {
    state.localPart = generateLocal();
    state.domain = RECEIVING_DOMAINS[Math.floor(Math.random() * RECEIVING_DOMAINS.length)];
    state.createdAt = Date.now();
    state.expiresAt = Date.now() + DEFAULT_TTL * 1000;
    renderAddress();
    renderTimer();
    renderMail();
    handleApiError(err instanceof Error ? err : undefined);
  }
}

function boot() {
  state.history = loadHistory();
  state.settings = loadSettings();

  renderAddress();
  renderTimer();
  renderMail();
  renderHistory();
  bindEvents();
  bindTour();
  bindExpiredModal();
  refreshSoundUI();
  refreshNotificationsUI();
  void bootInbox();

  window.setInterval(renderTimer, 1000);

  // First-time visitors get the three-step onboarding tour
  maybeStartTourOnFirstVisit();

  // Demo flourish — first session only. Land a CODE-bearing mail so the
  // OTP feature is immediately visible without the user having to fish for it.
  if (IS_DEV && !sessionStorage.getItem('ifn-demo-shown')) {
    sessionStorage.setItem('ifn-demo-shown', '1');
    window.setTimeout(() => simulateOne('code'), 4200);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
