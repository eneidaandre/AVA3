import { supabase } from './supabaseClient.js';
import { goTo } from './router.js';

const LAYOUT_URL = './assets/chrome.html';

async function initChrome() {
  ensureSlot('site-header');
  ensureSlot('site-sidebar');
  ensureSlot('site-footer');

  try {
    const res = await fetch(LAYOUT_URL);
    if (!res.ok) throw new Error('Erro ao carregar menu');
    const text = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');

    inject('site-header', doc, 'header');
    inject('site-sidebar', doc, 'sidebar');
    inject('site-footer', doc, 'footer');

    // Restaura o estado da barra (fechada/aberta)
    restoreSidebarState();

    // Inicia verificação de dados
    checkAuthAndProfile();
  } catch (err) {
    console.error(err);
  }
}

// === LÓGICA DO PERFIL E NOME (AQUI ESTÁ A CORREÇÃO) ===
async function checkAuthAndProfile() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const pill = document.getElementById('user-pill');
    const actions = document.getElementById('auth-actions');
    const nameEl = document.getElementById('user-name');
    const logoutBtn = document.getElementById('side-logout');

    const adminLink = document.getElementById('link-admin');
    const adminGroup = document.getElementById('sidebar-admin-group');

    // Reseta visual (esconde tudo por segurança)
    if (pill) pill.style.display = 'none';
    if (actions) actions.style.display = 'block'; // Mostra botão entrar por padrão
    if (adminLink) adminLink.style.display = 'none';
    if (adminGroup) adminGroup.style.display = 'none';

    if (session) {
      // 1. Oculta botão entrar e mostra pílula do usuário
      if (actions) actions.style.display = 'none';
      if (pill) pill.style.display = 'flex';
      if (logoutBtn) {
        logoutBtn.style.display = 'flex';
        logoutBtn.onclick = async () => {
          await supabase.auth.signOut();
          goTo('login.html');
        };
      }

      // 2. BUSCAR DADOS NA TABELA 'PROFILES' (Conforme sua imagem)
      // O nome está na coluna 'name' e o cargo em 'role'
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      // Define o nome a ser exibido
      let displayName = 'Aluno';

      if (profile && profile.name) {
        displayName = profile.name; // Pega da tabela profiles
      } else if (session.user.user_metadata?.full_name) {
        displayName = session.user.user_metadata.full_name; // Fallback
      } else {
        displayName = session.user.email.split('@')[0]; // Último recurso
      }

      // Atualiza o HTML
      if (nameEl) nameEl.textContent = displayName;

      // 3. Verifica Admin
      if (profile && profile.role === 'admin') {
        if (adminLink) adminLink.style.display = 'block';
        if (adminGroup) adminGroup.style.display = 'block';
      }
    }
  } catch (e) {
    console.warn('Erro ao carregar perfil:', e);
  }
}

// === LÓGICA DE CLIQUE (ABRIR/FECHAR) ===
document.addEventListener('click', (e) => {
  if (
    e.target.closest('#sidebar-toggle') ||
    e.target.closest('#sidebar-overlay')
  ) {
    const isMobile = window.innerWidth <= 900;
    const body = document.body;

    if (isMobile) {
      body.classList.toggle('sidebar-open');
    } else {
      // Desktop: Alterna classe collapsed
      body.classList.toggle('sidebar-collapsed');

      // Salva preferência
      const collapsed = body.classList.contains('sidebar-collapsed');
      localStorage.setItem('sidebar_collapsed', collapsed);
    }
  }
});

function restoreSidebarState() {
  if (window.innerWidth > 900) {
    const collapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    document.body.classList.add('has-sidebar');
    if (collapsed) document.body.classList.add('sidebar-collapsed');
  }
}

function ensureSlot(id) {
  if (!document.getElementById(id)) {
    const div = document.createElement('div');
    div.id = id;
    if (id === 'site-footer') document.body.appendChild(div);
    else document.body.insertBefore(div, document.body.firstChild);
  }
}

function inject(id, doc, slot) {
  const el = document.getElementById(id);
  const content = doc.querySelector(`[data-slot="${slot}"]`);
  if (el && content) el.innerHTML = content.innerHTML;
}

initChrome();
