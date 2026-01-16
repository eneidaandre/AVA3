import { supabase } from './supabaseClient.js';

// Certifique-se que o arquivo HTML está nesta pasta
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
    
    setupSidebarToggle();
    highlightActiveLink(); // <--- NOVA FUNÇÃO: Marca o link ativo

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

    // Configura botão de logout
    const btnLogout = document.getElementById('side-logout');
    if (btnLogout) {
        btnLogout.onclick = async () => {
            if(confirm("Deseja sair?")) {
                await supabase.auth.signOut();
            }
        };
    }

  } catch (err) {
    console.error('Erro ao inicializar interface (Chrome):', err);
  }
}

// Verifica a URL atual e adiciona classe 'active' no menu lateral
function highlightActiveLink() {
    const path = window.location.pathname;
    const page = path.split("/").pop(); // ex: 'admin.html'

    const links = document.querySelectorAll('.side-item, .navlink');
    links.forEach(link => {
        const href = link.getAttribute('href');
        // Se o href contiver o nome da página atual
        if (href && href.includes(page) && page !== '') {
            link.style.color = 'var(--brand)';
            link.style.backgroundColor = 'var(--sidebar-hover)';
            link.style.fontWeight = 'bold';
        }
    });
}

// --- RESTANTE DAS FUNÇÕES (Mantidas iguais) ---
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  updateUI(session);
}

function updateUI(session) {
  const userPill = document.getElementById('user-pill');
  const authActions = document.getElementById('auth-actions');
  const userNameEl = document.getElementById('user-name');
  const logoutBtn = document.getElementById('side-logout');

  if (session) {
    if(authActions) authActions.style.display = 'none';
    if(userPill) userPill.style.display = 'flex';
    if(logoutBtn) logoutBtn.style.display = 'flex';

    const name = session.user.user_metadata?.full_name || session.user.email;
    if(userNameEl) userNameEl.textContent = name;

    checkRole(session.user.id);
  } else {
    if(authActions) authActions.style.display = 'block';
    if(userPill) userPill.style.display = 'none';
    if(logoutBtn) logoutBtn.style.display = 'none';
    
    const adminGroup = document.getElementById('sidebar-admin-group');
    if(adminGroup) adminGroup.style.display = 'none';
  }
}

async function checkRole(uid) {
  // Tenta ler do cache primeiro para evitar flicker
  const cachedRole = localStorage.getItem('ava3_role');
  if (cachedRole) applyRoleUI(cachedRole);

  const { data } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle();
  if (data) {
    const role = data.role || 'aluno';
    localStorage.setItem('ava3_role', role);
    applyRoleUI(role);
  }
}

function applyRoleUI(role) {
  const adminGroup = document.getElementById('sidebar-admin-group');
  const linkAdmin = document.getElementById('link-admin');
  
  // Mostra gestão para Admin, Gerente e Professor
  if (['admin', 'gerente', 'professor'].includes(role)) {
    if(adminGroup) adminGroup.style.display = 'block';
    if(linkAdmin) linkAdmin.style.display = 'inline-block';
  } else {
    if(adminGroup) adminGroup.style.display = 'none';
    if(linkAdmin) linkAdmin.style.display = 'none';
  }
}

function applyCachedRole() {
  const cachedRole = localStorage.getItem('ava3_role');
  if (cachedRole) applyRoleUI(cachedRole);
}

function ensureSlot(id) {
  if (!document.getElementById(id)) {
    const div = document.createElement('div');
    div.id = id;
    if (id === 'site-footer') document.body.appendChild(div);
    else document.body.insertBefore(div, document.body.firstChild);
  }
}

function inject(id, doc, slotName) {
  const container = document.getElementById(id);
  const source = doc.querySelector(`[data-slot="${slotName}"]`);
  if (container && source) container.innerHTML = source.innerHTML;
}

function setupSidebarToggle() {
  const btn = document.getElementById('sidebar-toggle');
  if (btn) {
    btn.onclick = (e) => {
      e.stopPropagation();
      if (window.innerWidth <= 900) {
        document.body.classList.toggle('sidebar-open');
        let overlay = document.getElementById('sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'sidebar-overlay';
            overlay.className = 'sidebar-overlay';
            overlay.onclick = () => document.body.classList.remove('sidebar-open');
            document.body.appendChild(overlay);
        }
      } else {
        document.body.classList.toggle('sidebar-collapsed');
      }
    };
  }
}

// Inicia
initChrome();