// assets/js/entry.js
import { supabase, supabaseHealthCheck } from './supabaseClient.js';

const statusEl = document.getElementById('status');
const actionsEl = document.getElementById('actions');
const logsEl = document.getElementById('logs');

function log(msg) {
  if (logsEl) {
    logsEl.style.display = 'block';
    logsEl.textContent += msg + '\n';
  }
  console.log(msg);
}

function showActions() {
  if (actionsEl) actionsEl.style.display = 'flex';
}

function goTo(filename) {
  // sempre relativo (funciona em /AVA3/)
  const url = new URL(`./${filename}`, window.location.href);
  window.location.assign(url.toString());
}

function shouldStayHere() {
  const u = new URL(window.location.href);
  return u.searchParams.get('stay') === '1';
}

async function main() {
  try {
    log('[ENTRY] Iniciando...');

    const r = await supabaseHealthCheck();
    if (!r.ok) {
      if (statusEl)
        statusEl.innerHTML = `❌ Erro no Supabase: <code>${r.error}</code>`;
      showActions();
      return;
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      if (statusEl)
        statusEl.innerHTML = `❌ Erro ao ler sessão: <code>${error.message}</code>`;
      showActions();
      return;
    }

    const hasSession = !!data?.session;
    const email = data?.session?.user?.email || '';

    if (statusEl) {
      statusEl.innerHTML = hasSession
        ? `✅ Supabase OK <small>(sessão: <code>${email}</code>)</small>`
        : `✅ Supabase OK <small>(sem sessão — normal)</small>`;
    }

    if (hasSession && !shouldStayHere()) {
      goTo('app.html');
      return;
    }

    showActions();
  } catch (e) {
    const msg = e?.message || String(e);
    if (statusEl)
      statusEl.innerHTML = `❌ Erro inesperado: <code>${msg}</code>`;
    showActions();
  }
}

main();
