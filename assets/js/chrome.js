import { supabase } from './supabaseClient.js';
// Se tiver import { goTo } ... mantenha, se não usar, pode remover.

const LAYOUT_URL = './assets/chrome.html';

async function initChrome() {
  ensureSlot('site-header');
  ensureSlot('site-sidebar');
  ensureSlot('site-footer');

  try {
    // 1. Carrega o HTML do menu
    const res = await fetch(LAYOUT_URL);
    if (!res.ok) throw new Error('Falha ao carregar menu');
    const text = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');

    inject('site-header', doc, 'header');
    inject('site-sidebar', doc, 'sidebar');
    inject('site-footer', doc, 'footer');

    document.body.classList.add('has-sidebar');
    restoreState();

    // 2. Tenta restaurar visualmente o estado ADMIN antes mesmo de checar no banco
    // Isso evita que o menu "suma" enquanto carrega
    applyCachedRole();

    // 3. Verificação real de auth (Banco de dados)
    await checkAuth();

    // Monitora mudanças (login/logout em outras abas)
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            localStorage.removeItem('ava3_role'); // Limpa cache ao sair
            window.location.href = 'login.html';
        } else {
            checkAuth();
        }
    });

  } catch (err) {
    console.error('Erro no Chrome:', err);
  }
}

// Aplica visualmente o que está salvo no navegador para não piscar
function applyCachedRole() {
    const cachedRole = localStorage.getItem('ava3_role');
    const adminLink = document.getElementById('link-admin');
    const adminGroup = document.getElementById('sidebar-admin-group');

    if (cachedRole === 'admin') {
        if (adminLink) adminLink.style.display = 'flex';
        if (adminGroup) adminGroup.style.display = 'block';
    }
}

async function checkAuth() {
  try {
    const nameEl = document.getElementById('user-name');
    const userPillContainer = document.getElementById('user-pill');
    const authActions = document.getElementById('auth-actions');
    const logoutBtn = document.getElementById('side-logout');
    
    // Elementos Admin
    const adminLink = document.getElementById('link-admin');
    const adminGroup = document.getElementById('sidebar-admin-group');

    // 1. Verifica Sessão Local do Supabase
    const { data: { session }, error } = await supabase.auth.getSession();

    if (!session) {
      // Visitante
      if (userPillContainer) userPillContainer.style.display = 'none';
      if (authActions) authActions.style.display = 'block';
      
      // Esconde admin se não tiver sessão
      if (adminLink) adminLink.style.display = 'none';
      if (adminGroup) adminGroup.style.display = 'none';
      return;
    }

    // --- USUÁRIO LOGADO ---
    if (authActions) authActions.style.display = 'none';
    if (userPillContainer) userPillContainer.style.display = 'flex';

    // Botão Sair
    if (logoutBtn) {
      logoutBtn.style.display = 'flex';
      logoutBtn.onclick = async () => {
        localStorage.removeItem('ava3_role'); // Limpa cache
        await supabase.auth.signOut();
        window.location.href = 'login.html';
      };
    }

    // 2. Busca Perfil no Banco para confirmar Role
    const { data: rows } = await supabase
      .from('profiles')
      .select('name, role')
      .eq('id', session.user.id)
      .limit(1);

    const profile = rows?.[0];

    // Atualiza nome na tela
    const displayName = profile?.name || session.user.email;
    if (nameEl) nameEl.textContent = displayName;

    // --- LÓGICA DE ADMIN (CACHEADA) ---
    const roleRaw = profile?.role;
    const role = roleRaw ? String(roleRaw).toLowerCase().trim() : 'aluno';

    // Salva no navegador para a próxima vez ser instantâneo
    localStorage.setItem('ava3_role', role);

    // Aplica visibilidade final baseada no banco
    if (role === 'admin') {
      if (adminLink) adminLink.style.display = 'flex';
      if (adminGroup) adminGroup.style.display = 'block';
    } else {
      if (adminLink) adminLink.style.display = 'none';
      if (adminGroup) adminGroup.style.display = 'none';
    }

  } catch (e) {
    console.error('Erro no checkAuth:', e);
  }
}

// Funções Auxiliares
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
function restoreState() {
  const btn = document.getElementById('sidebar-toggle');
  if (btn)
    btn.onclick = () => document.body.classList.toggle('sidebar-collapsed');
}

initChrome();