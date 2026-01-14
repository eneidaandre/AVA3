import { supabase } from './supabaseClient.js';

const LAYOUT_URL = './assets/chrome.html';

async function initChrome() {
  ensureSlot('site-header');
  ensureSlot('site-sidebar');
  ensureSlot('site-footer');

  try {
    const res = await fetch(LAYOUT_URL);
    if (!res.ok) throw new Error(`Não foi possível carregar o arquivo: ${LAYOUT_URL}`);
    
    const text = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');

    inject('site-header', doc, 'header');
    inject('site-sidebar', doc, 'sidebar');
    inject('site-footer', doc, 'footer');

    document.body.classList.add('has-sidebar');
    
    // === AQUI A CONFIGURAÇÃO DO BOTÃO ===
    setupSidebarToggle();

    applyCachedRole(); 
    await checkAuth(); 

    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            localStorage.removeItem('ava3_role');
            window.location.href = 'login.html';
        } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
            checkAuth();
        }
    });

  } catch (err) {
    console.error('Erro ao inicializar interface (Chrome):', err);
  }
}

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
    const adminLink = document.getElementById('link-admin');
    const adminGroup = document.getElementById('sidebar-admin-group');

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      if (userPillContainer) userPillContainer.style.display = 'none';
      if (authActions) authActions.style.display = 'block';
      if (adminLink) adminLink.style.display = 'none';
      if (adminGroup) adminGroup.style.display = 'none';
      return;
    }

    if (authActions) authActions.style.display = 'none';
    if (userPillContainer) userPillContainer.style.display = 'flex';

    if (logoutBtn) {
      logoutBtn.style.display = 'flex';
      logoutBtn.onclick = async () => {
        localStorage.removeItem('ava3_role');
        await supabase.auth.signOut();
        window.location.href = 'login.html';
      };
    }

    const { data: rows } = await supabase
      .from('profiles')
      .select('name, role')
      .eq('id', session.user.id)
      .limit(1);

    const profile = rows?.[0];
    if (nameEl) nameEl.textContent = profile?.name || session.user.email;

    const role = profile?.role ? String(profile.role).toLowerCase().trim() : 'aluno';
    localStorage.setItem('ava3_role', role);

    if (role === 'admin') {
      if (adminLink) adminLink.style.display = 'flex';
      if (adminGroup) adminGroup.style.display = 'block';
    } else {
      if (adminLink) adminLink.style.display = 'none';
      if (adminGroup) adminGroup.style.display = 'none';
    }

  } catch (e) {
    console.error('Erro na verificação de autenticação:', e);
  }
}

function ensureSlot(id) {
  if (!document.getElementById(id)) {
    const div = document.createElement('div');
    div.id = id;
    if (id === 'site-footer') {
        document.body.appendChild(div);
    } else {
        document.body.insertBefore(div, document.body.firstChild);
    }
  }
}

function inject(id, doc, slotName) {
  const container = document.getElementById(id);
  const source = doc.querySelector(`[data-slot="${slotName}"]`);
  if (container && source) {
    container.innerHTML = source.innerHTML;
  }
}

// === CORREÇÃO DA LÓGICA DO MENU (PC vs CELULAR) ===
function setupSidebarToggle() {
  const btn = document.getElementById('sidebar-toggle');
  const overlay = document.getElementById('sidebar-overlay'); // Fundo escuro no mobile

  if (btn) {
    btn.onclick = (e) => {
      e.stopPropagation(); // Impede clique duplo
      
      // Se a tela for menor que 900px (Celular/Tablet)
      if (window.innerWidth <= 900) {
        document.body.classList.toggle('sidebar-open'); // Abre o menu deslizando
      } else {
        document.body.classList.toggle('sidebar-collapsed'); // Encolhe o menu
      }
    };
  }

  // Fecha o menu ao clicar no fundo escuro (Mobile)
  if (overlay) {
    overlay.onclick = () => {
      document.body.classList.remove('sidebar-open');
    };
  }
}

initChrome();