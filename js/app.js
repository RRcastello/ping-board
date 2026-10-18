import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { normalizePhone, validateButton, waLink } from './phone.js';

const $ = (id) => document.getElementById(id);

const views = ['loading', 'setup', 'login', 'board'];
function showView(name) {
  for (const v of views) $(`view-${v}`).hidden = v !== name;
  $('signout-btn').hidden = name !== 'board';
}

function setMsg(el, text, kind = '') {
  el.textContent = text || '';
  el.dataset.kind = kind;
}

// ---------------------------------------------------------------------------
// Config checks
// ---------------------------------------------------------------------------

function configProblem() {
  if (!SUPABASE_URL || SUPABASE_URL.includes('YOUR-PROJECT-REF') ||
      !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.startsWith('YOUR-')) {
    return 'Add your Supabase URL and anon key to js/config.js. See the README, step 6.';
  }
  if (isSecretKey(SUPABASE_ANON_KEY)) {
    return 'js/config.js contains a SECRET (service_role) key. Remove it right away, ' +
      'rotate it in Supabase, and use the anon / publishable key instead.';
  }
  return null;
}

function isSecretKey(key) {
  if (key.startsWith('sb_secret_')) return true;
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json).role === 'service_role';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const problem = configProblem();
if (problem) {
  $('setup-msg').textContent = problem;
  showView('setup');
  throw new Error(problem);
}

// Errors Supabase puts in the URL when a login link is expired or invalid.
const urlError = readUrlError();

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});

const redirectTo = location.origin + location.pathname;
let currentUser = null;
let buttons = [];
let editingId = null;

sb.auth.onAuthStateChange((event, session) => {
  // Don't await Supabase calls inside this callback; defer them.
  setTimeout(() => handleSession(session), 0);
});

(async () => {
  const { data, error } = await sb.auth.getSession();
  cleanUrl();
  if (error) {
    showLogin();
    setMsg($('login-msg'), friendlyLinkError(error.message), 'error');
    return;
  }
  if (!data.session) {
    showLogin();
    if (urlError) setMsg($('login-msg'), friendlyLinkError(urlError), 'error');
  }
})();

function readUrlError() {
  const params = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  return params.get('error_description') || hash.get('error_description') ||
    params.get('error') || hash.get('error') || null;
}

function cleanUrl() {
  if (location.search || location.hash) {
    history.replaceState(null, '', location.pathname);
  }
}

function friendlyLinkError(text) {
  const t = String(text).toLowerCase();
  if (t.includes('expired') || t.includes('invalid')) {
    return 'That login link has expired or was already used. Ask for a new one.';
  }
  if (t.includes('code verifier') || t.includes('code_verifier')) {
    return 'Open the link in the same browser you asked for it in, or type the code from the email instead.';
  }
  return `Sign-in failed: ${text}`;
}

function handleSession(session) {
  const user = session?.user ?? null;
  if (user && currentUser?.id === user.id) return; // token refresh, nothing to do
  currentUser = user;
  if (user) {
    showBoard();
  } else {
    buttons = [];
    $('board-list').replaceChildren();
    showLogin();
  }
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

let loginEmail = '';

function showLogin() {
  showView('login');
}

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('login-email').value.trim().toLowerCase();
  const msg = $('login-msg');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setMsg(msg, 'Enter a valid email address.', 'error');
    return;
  }
  const btn = e.submitter || $('login-form').querySelector('button');
  btn.disabled = true;
  setMsg(msg, 'Sending…');

  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
  });

  // Emails not on the allowlist are rejected by the server-side hook. Show the
  // same screen as a success so the page doesn't reveal who is on the list.
  if (error && !/not-allowed/i.test(error.message)) {
    btn.disabled = false;
    const rate = error.status === 429 || /rate limit|seconds/i.test(error.message);
    setMsg(msg, rate
      ? 'Too many login emails just now. Wait a minute and try again.'
      : `Could not send the email: ${error.message}`, 'error');
    return;
  }

  loginEmail = email;
  $('sent-to').textContent = email;
  $('login-form').hidden = true;
  $('login-sent').hidden = false;
  setMsg(msg, '');
  $('login-code').focus();
  // Supabase only allows one email per address per minute.
  setTimeout(() => { btn.disabled = false; }, 60_000);
});

$('code-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = $('login-code').value.replace(/\D/g, '');
  const msg = $('login-msg');
  if (token.length < 6) {
    setMsg(msg, 'Enter the code from the email.', 'error');
    return;
  }
  setMsg(msg, 'Checking…');
  const { error } = await sb.auth.verifyOtp({ email: loginEmail, token, type: 'email' });
  if (error) {
    setMsg(msg, 'That code is wrong or has expired. Check the latest email, or ask for a new one.', 'error');
    return;
  }
  setMsg(msg, '');
});

$('login-restart').addEventListener('click', () => {
  $('login-sent').hidden = true;
  $('login-form').hidden = false;
  $('login-code').value = '';
  setMsg($('login-msg'), '');
  $('login-email').focus();
});

$('signout-btn').addEventListener('click', async () => {
  await sb.auth.signOut({ scope: 'local' });
});

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

async function showBoard() {
  showView('board');
  $('login-form').hidden = false;
  $('login-sent').hidden = true;
  $('user-line').textContent = `Signed in as ${currentUser.email}`;
  await loadButtons();
}

async function loadButtons() {
  const msg = $('board-msg');
  const { data, error } = await sb
    .from('buttons')
    .select('id, label, contact_name, phone, message, created_at')
    .order('created_at', { ascending: true });
  if (error) {
    setMsg(msg, `Could not load your buttons: ${error.message}`, 'error');
    return;
  }
  setMsg(msg, '');
  buttons = data;
  renderButtons();
}

const PENCIL_SVG =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zm17.7-10.2a1 1 0 0 0 0-1.42l-2.33-2.33a1 1 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';

function renderButtons() {
  const list = $('board-list');
  // Built with textContent only, so nothing a user types can become HTML.
  const tiles = buttons.map((b) => {
    const tile = document.createElement('div');
    tile.className = 'tile';

    const a = document.createElement('a');
    a.className = 'tile-main';
    a.href = waLink(b.phone, b.message);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';

    const label = document.createElement('span');
    label.className = 'tile-label';
    label.textContent = b.label;

    const sub = document.createElement('span');
    sub.className = 'tile-sub';
    sub.textContent = b.contact_name ? `${b.contact_name} · +${b.phone}` : `+${b.phone}`;

    a.append(label, sub);

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'tile-edit';
    edit.setAttribute('aria-label', `Edit “${b.label}”`);
    edit.innerHTML = PENCIL_SVG; // static markup, no user data
    edit.addEventListener('click', () => openEditor(b));

    tile.append(a, edit);
    return tile;
  });
  list.replaceChildren(...tiles);
  $('board-empty').hidden = buttons.length > 0;
}

// ---------------------------------------------------------------------------
// Add / edit dialog
// ---------------------------------------------------------------------------

const dialog = $('edit-dialog');
const form = $('edit-form');
const f = form.elements;

$('add-btn').addEventListener('click', () => openEditor(null));
$('edit-cancel').addEventListener('click', () => dialog.close());

function openEditor(b) {
  editingId = b?.id ?? null;
  $('edit-title').textContent = b ? 'Edit button' : 'New button';
  f.label.value = b?.label ?? '';
  f.contact_name.value = b?.contact_name ?? '';
  f.phone.value = b ? `+${b.phone}` : '';
  f.message.value = b?.message ?? '';
  $('edit-delete').hidden = !b;
  showFieldErrors({});
  setMsg($('edit-msg'), '');
  updatePhoneHint();
  dialog.showModal();
  f.label.focus();
}

function showFieldErrors(errors) {
  for (const p of form.querySelectorAll('.field-error')) {
    const name = p.dataset.for;
    p.textContent = errors[name] || '';
    f[name].setAttribute('aria-invalid', errors[name] ? 'true' : 'false');
  }
}

function updatePhoneHint() {
  const r = normalizePhone(f.phone.value);
  $('phone-hint').textContent = r.ok ? `Opens a chat with +${r.phone}` : '';
}
f.phone.addEventListener('input', updatePhoneHint);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const result = validateButton({
    label: f.label.value,
    contact_name: f.contact_name.value,
    phone: f.phone.value,
    message: f.message.value,
  });
  showFieldErrors(result.errors);
  if (!result.ok) {
    form.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }

  const save = $('edit-save');
  save.disabled = true;
  setMsg($('edit-msg'), 'Saving…');

  const query = editingId
    ? sb.from('buttons').update(result.value).eq('id', editingId)
    : sb.from('buttons').insert(result.value);
  const { error } = await query;

  save.disabled = false;
  if (error) {
    setMsg($('edit-msg'), `Could not save: ${error.message}`, 'error');
    return;
  }
  dialog.close();
  await loadButtons();
});

$('edit-delete').addEventListener('click', async () => {
  const b = buttons.find((x) => x.id === editingId);
  if (!b || !confirm(`Delete “${b.label}”?`)) return;
  const { error } = await sb.from('buttons').delete().eq('id', editingId);
  if (error) {
    setMsg($('edit-msg'), `Could not delete: ${error.message}`, 'error');
    return;
  }
  dialog.close();
  await loadButtons();
});
