// assets/js/login.js
import { supabase } from './supabaseClient.js';
import { goTo } from './router.js';

const form = document.getElementById('form-login');
const emailEl = document.getElementById('email');
const passEl = document.getElementById('password');
const msgEl = document.getElementById('msg');
const btn = document.getElementById('btn-login');

function setMsg(text, type = 'info') {
  msgEl.className = `msg ${type}`;
  msgEl.textContent = text || '';
}

async function boot() {
  // Se já tem sessão, não faz sentido ficar no login
  const { data } = await supabase.auth.getSession();
  if (data?.session) goTo('app.html');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setMsg('');

  const email = (emailEl.value || '').trim();
  const password = passEl.value || '';

  if (!email || !password) {
    setMsg('Preencha e-mail e senha.', 'err');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Entrando...';

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMsg(`Erro: ${error.message}`, 'err');
      return;
    }

    if (!data?.session) {
      setMsg(
        'Login OK, mas sessão não foi criada. Verifique o Supabase.',
        'err'
      );
      return;
    }

    setMsg('Login realizado! Indo para o App...', 'ok');
    goTo('app.html');
  } catch (err) {
    console.error(err);
    setMsg(`Erro inesperado: ${err?.message || err}`, 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
});

boot();
