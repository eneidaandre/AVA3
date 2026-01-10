// assets/js/appPage.js
import { supabase } from './supabaseClient.js';
import { goTo } from './router.js';

const subtitle = document.getElementById('subtitle');
const statusEl = document.getElementById('status');
const btnLogout = document.getElementById('btn-logout');

function setStatus(html) {
  statusEl.innerHTML = html;
}

async function requireSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    setStatus(`❌ Erro ao ler sessão: <code>${error.message}</code>`);
    subtitle.textContent = 'Erro';
    return;
  }

  const session = data?.session;

  if (!session) {
    subtitle.textContent = 'Sem sessão';
    setStatus('🔒 Você não está logado. Indo para o login...');
    goTo('login.html');
    return;
  }

  const email = session.user?.email || '(sem e-mail)';
  subtitle.textContent = `Logado como ${email}`;
  setStatus(`✅ Sessão ativa. Usuário: <code>${email}</code>`);
}

btnLogout.addEventListener('click', async () => {
  btnLogout.disabled = true;
  btnLogout.textContent = 'Saindo...';

  try {
    await supabase.auth.signOut();
    goTo('login.html');
  } finally {
    btnLogout.disabled = false;
    btnLogout.textContent = 'Sair';
  }
});

requireSession();
