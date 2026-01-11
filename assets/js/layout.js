// assets/js/layout.js
// Layout blindado: renderiza header/footer/sidebar SEM depender do Supabase.
// Depois tenta carregar supabaseClient "por fora" para ler sessão, mostrar nome/email,
// trocar Entrar/Sair e liberar Admin somente para admin.

function ensureBoxicons() {
  if (document.querySelector('link[data-boxicons="1"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css';
  link.setAttribute('data-boxicons', '1');
  document.head.appendChild(link);
}

function rel(path) {
  return new URL(`./${path}`, window.location.href).toString();
}

function activePage() {
  return document.body?.dataset?.page || '';
}

function ensureHost(id, where = 'prepend') {
  let el = document.getElementById(id);
  if (el) return el;

  el = document.createElement('div');
  el.id = id;

  if (where === 'prepend') document.body.prepend(el);
  else document.body.appendChild(el);

  return el;
}

function ensureSidebarHosts() {
  // Sidebar só faz sentido nas páginas "app" e "admin"
  const page = activePage();
  const wantsSidebar = page === 'app' || page === 'admin';

  if (!wantsSidebar) return;

  // cria se não existir
  if (!document.getElementById('site-sidebar')) {
    const host = document.createElement('div');
    host.id = 'site-sidebar';

    // coloca depois do header host
    const headerHost = ensureHost('site-header', 'prepend');
    headerHost.insertAdjacentElement('afterend', host);
  }

  if (!document.getElementById('sidebar-overlay')) {
    const ov = document.createElement('div');
    ov.className = 'sidebar-overlay';
    ov.id = 'sidebar-overlay';
    document.body.appendChild(ov);
  }

  // classe que seu CSS já usa para “empurrar” o layout
  document.body.classList.add('has-sidebar');
}

function renderShell() {
  ensureBoxicons();

  const page = activePage();

  const headerHost = ensureHost('site-header', 'prepend');
  const footerHost = ensureHost('site-footer', 'append');

  ensureSidebarHosts();

  // Header
  headerHost.innerHTML = `
    <header class="site-header">
      <div class="inner">
        <div class="left" style="display:flex;align-items:center;gap:10px;">
          <button id="sidebar-toggle" class="btn icon" type="button" aria-label="Abrir menu" style="display:none;">
            <i class="bx bx-menu"></i>
          </button>

          <a class="brand" href="${rel('index.html')}">
            <span class="dot"></span>
            <span>AVA</span>
          </a>
        </div>

        <nav class="nav" aria-label="Menu principal">
          <a class="navlink ${page === 'home' ? 'active' : ''}" href="${rel(
    'index.html'
  )}">Início</a>
          <a class="navlink ${page === 'app' ? 'active' : ''}" href="${rel(
    'app.html'
  )}">Meus cursos</a>
          <a id="nav-admin" class="navlink ${
            page === 'admin' ? 'active' : ''
          }" href="${rel('admin.html')}" style="display:none;">Admin</a>
        </nav>

        <div class="right">
          <span id="user-pill" class="badge" style="display:none; gap:10px;">
            <i class="bx bx-user"></i>
            <span style="display:flex;flex-direction:column;line-height:1.1">
              <span id="user-name" style="font-weight:900;"></span>
              <span id="user-email" style="font-weight:700; opacity:.85; font-size:12px;"></span>
            </span>
          </span>

          <button id="auth-btn" class="btn primary" type="button">
            <i class="bx bx-log-in"></i> Entrar
          </button>
        </div>
      </div>
    </header>
  `;

  // Footer
  footerHost.innerHTML = `
    <footer class="site-footer">
      <div class="inner">
        <div>© ${new Date().getFullYear()} AVA</div>
        <div class="footer-links">
          <a href="${rel('index.html')}">Home</a>
          <a href="${rel('app.html')}">Meus cursos</a>
        </div>
      </div>
    </footer>
  `;

  // Sidebar (se existir host)
  const sidebarHost = document.getElementById('site-sidebar');
  if (sidebarHost) {
    sidebarHost.innerHTML = `
      <aside class="site-sidebar" aria-label="Menu lateral">
        <div class="side-group">
          <button class="side-item ${
            page === 'app' ? 'active' : ''
          }" type="button" data-go="app.html">
            <i class="bx bx-grid-alt"></i> <span class="side-label">Meus cursos</span>
          </button>

          <button id="side-admin" class="side-item ${
            page === 'admin' ? 'active' : ''
          }" type="button" data-go="admin.html" style="display:none;">
            <i class="bx bx-cog"></i> <span class="side-label">Admin</span>
          </button>
        </div>

        <div class="side-divider"></div>

        <div class="side-group">
          <button class="side-item" type="button" data-go="index.html">
            <i class="bx bx-home-alt"></i> <span class="side-label">Início</span>
          </button>
        </div>
      </aside>
    `;

    // botão toggle só aparece se sidebar existe (mobile drawer)
    const toggle = document.getElementById('sidebar-toggle');
    if (toggle) toggle.style.display = 'inline-flex';

    // navegação dos botões da sidebar
    sidebarHost.querySelectorAll('[data-go]').forEach((b) => {
      b.addEventListener('click', () => {
        const file = b.getAttribute('data-go');
        window.location.assign(rel(file));
      });
    });
  }

  // Toggle mobile sidebar
  const overlay = document.getElementById('sidebar-overlay');
  const toggleBtn = document.getElementById('sidebar-toggle');
  if (toggleBtn) {
    toggleBtn.onclick = () => document.body.classList.toggle('sidebar-open');
  }
  if (overlay) {
    overlay.onclick = () => document.body.classList.remove('sidebar-open');
  }
}

// ---------- AUTH: carregar “por fora” ----------
async function checkIsAdmin(supabase, uid) {
  // 1) tenta RPC (se existir)
  const tries = [{ uid }, { user_id: uid }, { p_uid: uid }];
  for (const args of tries) {
    try {
      const { data, error } = await supabase.rpc('is_admin', args);
      if (!error) return !!data;
    } catch (_) {}
  }

  // 2) fallback profiles.role
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', uid)
      .maybeSingle();

    if (error) return false;
    return String(data?.role || '').toLowerCase() === 'admin';
  } catch (_) {
    return false;
  }
}

function applyAuthUI({ session, displayName, email, isAdmin }) {
  const pill = document.getElementById('user-pill');
  const userName = document.getElementById('user-name');
  const userEmail = document.getElementById('user-email');
  const authBtn = document.getElementById('auth-btn');

  const navAdmin = document.getElementById('nav-admin');
  const sideAdmin = document.getElementById('side-admin');

  const authed = !!session;

  // classes úteis pro CSS (se você já usa)
  document.body.classList.toggle('is-authed', authed);

  if (pill && userName && userEmail) {
    if (authed) {
      pill.style.display = 'inline-flex';
      userName.textContent = displayName || email || '';
      userEmail.textContent = email || '';
    } else {
      pill.style.display = 'none';
      userName.textContent = '';
      userEmail.textContent = '';
    }
  }

  // Admin só aparece se admin
  const showAdmin = authed && !!isAdmin;
  if (navAdmin) navAdmin.style.display = showAdmin ? 'inline-flex' : 'none';
  if (sideAdmin) sideAdmin.style.display = showAdmin ? 'flex' : 'none';

  // botão único (direita): Entrar / Sair
  if (authBtn) {
    if (!authed) {
      authBtn.classList.add('primary');
      authBtn.innerHTML = `<i class="bx bx-log-in"></i> Entrar`;
      authBtn.onclick = () => window.location.assign(rel('login.html'));
    } else {
      authBtn.classList.remove('primary'); // opcional: deixa menos “forte” quando logado
      authBtn.innerHTML = `<i class="bx bx-log-out"></i> Sair`;
      // onclick do Sair é definido no initAuth (porque precisa do supabase)
    }
  }
}

async function initAuth() {
  // regra de proteção
  const requiresAuth = document.body.dataset.auth === 'required';
  const requiresAdmin = document.body.dataset.admin === 'required';

  // padrão: sem sessão (UI pronta mesmo assim)
  applyAuthUI({ session: null, displayName: '', email: '', isAdmin: false });

  // tenta carregar supabaseClient
  let supabase, getSessionSafe, getUserDisplayName;

  try {
    ({ supabase, getSessionSafe, getUserDisplayName } = await import(
      './supabaseClient.js'
    ));
  } catch (e) {
    // Se falhar, mantém layout “público”
    if (requiresAuth) window.location.assign(rel('login.html'));
    return;
  }

  async function refresh() {
    const { session } = await getSessionSafe();
    const email = session?.user?.email || '';
    const displayName = session ? getUserDisplayName(session) : '';
    const uid = session?.user?.id || null;

    let isAdmin = false;
    if (uid) isAdmin = await checkIsAdmin(supabase, uid);

    applyAuthUI({ session, displayName, email, isAdmin });

    // Guardas
    if (requiresAuth && !session) {
      window.location.assign(rel('login.html'));
      return;
    }

    if (requiresAdmin && (!session || !isAdmin)) {
      window.location.assign(rel('app.html'));
      return;
    }

    // Botão Sair (agora que temos supabase)
    const authBtn = document.getElementById('auth-btn');
    if (authBtn && session) {
      authBtn.onclick = async () => {
        await supabase.auth.signOut();
        window.location.assign(rel('index.html'));
      };
    }
  }

  // primeira leitura
  await refresh();

  // mudanças de auth (login/logout)
  supabase.auth.onAuthStateChange(() => {
    refresh();
  });
}

// BOOT
renderShell();
initAuth();
