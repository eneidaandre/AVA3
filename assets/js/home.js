// assets/js/home.js
import { supabase } from './supabaseClient.js';

function rel(path) {
  return new URL(`./${path}`, window.location.href).toString();
}

async function updateCTA() {
  const cta = document.getElementById('cta-primary');
  const cta2 = document.getElementById('cta-secondary');
  const note = document.getElementById('home-note');

  if (!cta) return;

  const { data, error } = await supabase.auth.getSession();
  if (error) return;

  const hasSession = !!data?.session;
  const email = data?.session?.user?.email || '';

  if (hasSession) {
    cta.textContent = 'Continuar no App';
    cta.onclick = () => window.location.assign(rel('app.html'));

    if (cta2) {
      cta2.textContent = 'Gerenciar conta';
      cta2.onclick = () => window.location.assign(rel('app.html'));
    }

    if (note)
      note.textContent = email
        ? `Sessão ativa: ${email}`
        : 'Sessão ativa detectada.';
  } else {
    cta.textContent = 'Entrar no AVA';
    cta.onclick = () => window.location.assign(rel('login.html'));

    if (cta2) {
      cta2.textContent = 'Ver o App (prévia)';
      cta2.onclick = () => window.location.assign(rel('app.html'));
    }

    if (note)
      note.textContent =
        'Você pode navegar aqui sem login. Para acessar cursos e recursos, faça login.';
  }
}

updateCTA();
supabase.auth.onAuthStateChange(() => updateCTA());
