import { supabase } from './supabaseClient.js';

console.log('[login.js] carregou ✅', window.location.href);

const $ = (id) => document.getElementById(id);

const msgEl = $('msg');
const viewLogin = $('view-login');
const viewSignup = $('view-signup');
const forgotBox = $('forgot-box');

function safe(el, name) {
  if (!el) console.warn(`[login.js] elemento não encontrado: ${name}`);
  return el;
}

safe(msgEl, '#msg');
safe(viewLogin, '#view-login');
safe(viewSignup, '#view-signup');
safe(forgotBox, '#forgot-box');

function setMsg(type, html) {
  if (!msgEl) return;
  msgEl.className = `alert alert-${type}`;
  msgEl.innerHTML = html;
  msgEl.classList.remove('d-none');
}

function clearMsg() {
  if (!msgEl) return;
  msgEl.classList.add('d-none');
  msgEl.innerHTML = '';
}

function showView(name) {
  clearMsg();
  if (forgotBox) forgotBox.classList.add('d-none');

  if (!viewLogin || !viewSignup) return;

  if (name === 'signup') {
    viewLogin.classList.add('d-none');
    viewSignup.classList.remove('d-none');
  } else {
    viewSignup.classList.add('d-none');
    viewLogin.classList.remove('d-none');
  }

  // marca abas
  document.querySelectorAll('[data-view]').forEach((b) => {
    const v = b.getAttribute('data-view');
    b.classList.toggle('active', v === name);
  });

  console.log('[login.js] view =>', name);
}

function togglePass(inputId, btnId) {
  const input = $(inputId);
  const btn = $(btnId);
  if (!input || !btn) return;

  const icon = btn.querySelector('i');
  const isPass = input.type === 'password';
  input.type = isPass ? 'text' : 'password';
  if (icon) icon.className = isPass ? 'bi bi-eye-slash' : 'bi bi-eye';
}

function goTo(filename) {
  const url = new URL(`./${filename}`, window.location.href);
  window.location.assign(url.toString());
}

// ✅ Clique nas abas (captura até se for <a>, <button>, etc.)
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-view]');
  if (!el) return;

  const v = el.getAttribute('data-view');
  if (v === 'login' || v === 'signup') {
    e.preventDefault();
    showView(v);
  }
});

// Mostrar/ocultar senha
$('btn-toggle-pass-login')?.addEventListener('click', () =>
  togglePass('login-pass', 'btn-toggle-pass-login')
);
$('btn-toggle-pass-signup')?.addEventListener('click', () =>
  togglePass('signup-pass', 'btn-toggle-pass-signup')
);

// Login
$('login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMsg();

  const email = $('login-email')?.value?.trim();
  const password = $('login-pass')?.value;

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error)
      return setMsg(
        'danger',
        `❌ Não foi possível entrar: <b>${error.message}</b>`
      );

    setMsg('success', `✅ Login realizado! Redirecionando...`);
    setTimeout(() => goTo('app.html'), 400);
  } catch (err) {
    setMsg('danger', `❌ Erro inesperado: <b>${err?.message || err}</b>`);
  }
});

// Cadastro
$('signup-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMsg();

  const fullName = $('signup-name')?.value?.trim();
  const email = $('signup-email')?.value?.trim();
  const password = $('signup-pass')?.value;

  try {
    const redirectTo = new URL('./app.html', window.location.href).toString();

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: redirectTo },
    });

    if (error)
      return setMsg(
        'danger',
        `❌ Não foi possível cadastrar: <b>${error.message}</b>`
      );

    setMsg(
      'success',
      `✅ Cadastro enviado! <small>Se a confirmação por e-mail estiver ativa, confirme na sua caixa de entrada/SPAM.</small>`
    );

    showView('login');
    if ($('login-email')) $('login-email').value = email || '';
  } catch (err) {
    setMsg('danger', `❌ Erro inesperado: <b>${err?.message || err}</b>`);
  }
});

// Esqueci senha
$('link-forgot')?.addEventListener('click', (e) => {
  e.preventDefault();
  if (!forgotBox) return;
  forgotBox.classList.toggle('d-none');
  if ($('forgot-email') && $('login-email'))
    $('forgot-email').value = $('login-email').value.trim();
});

// Enviar reset
$('forgot-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMsg();

  const email = $('forgot-email')?.value?.trim();
  try {
    const redirectTo = new URL('./reset.html', window.location.href).toString();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error)
      return setMsg(
        'danger',
        `❌ Falha ao enviar link: <b>${error.message}</b>`
      );

    setMsg(
      'success',
      `✅ Link enviado! <small>Verifique inbox e SPAM.</small>`
    );
  } catch (err) {
    setMsg('danger', `❌ Erro inesperado: <b>${err?.message || err}</b>`);
  }
});

// Google (opcional)
$('btn-google')?.addEventListener('click', async () => {
  clearMsg();
  try {
    const redirectTo = new URL('./app.html', window.location.href).toString();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) setMsg('danger', `❌ Google: <b>${error.message}</b>`);
  } catch (err) {
    setMsg('danger', `❌ Erro inesperado: <b>${err?.message || err}</b>`);
  }
});

// Inicial
showView('login');
