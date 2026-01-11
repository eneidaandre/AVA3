// assets/js/layout.js
// Layout global: header, footer, sidebar (quando existir), e controle de menus por sessão/role.

function rel(path) {
  return new URL(`./${path}`, window.location.href).toString();
}

function getActivePage() {
  return document.body.dataset.page || '';
}

function ensureBoxicons() {
  if (document.querySelector('link[data-boxicons="1"]')) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css';
  link.setAttribute('data-boxicons', '1');
  document.head.appendChild(link);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => {
    const m = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return m[c] || c;
  });
}

async function getSupabaseClient() {
  // supabaseClient.js deve existir em assets/js/
  try {
    const mod = await import('./supabaseClient.js');
    return mod.supabase;
  } catch (e) {
    console.warn('[layout] Falha ao importar supabaseClient.js', e);
    return null;
  }
}

function renderHeaderFooter() {
  ensureBoxicons();

  const page = getActivePage();
  const headerHost = document.getElementById('site-header');
  const footerHost = document.getElementById('site-footer');
  const sidebarHost = document.getElementById('site-sidebar');

  // HEADER
  if (headerHost) {
    headerHost.innerHTML = `
      <header class="site-header">
        <div class="inner">
          <a class="brand" href="${rel('index.html')}">
            <span class="dot"></span>
            <span>AVA</span>
          </a>

          <button id="sidebar-toggle" class="btn icon ghost" type="button" aria-label="Abrir/fechar menu lateral">
            <i class="bx bx-menu"></i>
          </button>

          <nav class="nav" aria-label="Menu principal">
            <a id="nav-home" class="navlink ${
              page === 'home' ? 'active' : ''
            }" href="${rel('index.html')}">Início</a>

            <a id="nav-app" class="navlink ${
              page === 'app' ? 'active' : ''
            }" href="${rel('app.html')}" style="display:none;">
              Minha área
            </a>

            <a id="nav-admin" class="navlink ${
              page === 'admin' ? 'active' : ''
            }" href="${rel('admin.html')}" style="display:none;">
              Admin
            </a>
          </nav>

          <div class="right">
            <span id="user-pill" class="badge" style="display:none;">
              <i class="bx bx-user"></i> <span id="user-name"></span>
            </span>

            <a id="auth-link" class="btn primary" href="${rel('login.html')}">
              <i class="bx bx-log-in"></i> Entrar
            </a>

            <button id="logout-btn" class="btn ghost" style="display:none;">
              <i class="bx bx-log-out"></i> Sair
            </button>
          </div>
        </div>
      </header>
    `;
  }

  // SIDEBAR (só aparece se existir #site-sidebar na página)
  if (sidebarHost) {
    document.body.classList.add('has-sidebar');

    sidebarHost.innerHTML = `
      <aside class="sidebar" id="sidebar" aria-label="Menu lateral">
        <div class="sidebar-top">
          <div class="sidebar-title">Menu</div>
          <button class="btn icon ghost sidebar-collapse" id="sidebar-collapse" type="button" aria-label="Recolher menu lateral">
            <i class="bx bx-chevron-left"></i>
          </button>
        </div>

        <nav class="sidebar-nav">
          <a class="sidelink" id="side-app" href="${rel('app.html')}">
            <i class="bx bx-grid-alt"></i>
            <span>Minha área</span>
          </a>

          <a class="sidelink" id="side-admin" href="${rel('admin.html')}">
            <i class="bx bx-cog"></i>
            <span>Admin</span>
          </a>

          <div class="sidebar-sep"></div>

          <a class="sidelink" id="side-home" href="${rel('index.html')}">
            <i class="bx bx-home"></i>
            <span>Início</span>
          </a>
        </nav>

        <div class="sidebar-footer">
          <button id="side-logout" class="btn ghost w-100" type="button">
            <i class="bx bx-log-out"></i> Sair
          </button>
        </div>
      </aside>

      <div class="sidebar-backdrop" id="sidebar-backdrop" aria-hidden="true"></div>
    `;
  }

  // FOOTER
  if (footerHost) {
    footerHost.innerHTML = `
      <footer class="site-footer">
        <div class="inner">
          <div>© ${new Date().getFullYear()} AVA • Protótipo</div>
          <div class="footer-links">
            <a href="${rel('index.html')}">Home</a>
            <a id="foot-login" href="${rel('login.html')}">Login</a>
            <a id="foot-app" href="${rel(
              'app.html'
            )}" style="display:none;">Minha área</a>
            <a id="foot-admin" href="${rel(
              'admin.html'
            )}" style="display:none;">Admin</a>
          </div>
        </div>
      </footer>
    `;
  }
}

function setActiveLinks() {
  const page = getActivePage();
  const byId = (id) => document.getElementById(id);

  // Top nav
  byId('nav-home')?.classList.toggle('active', page === 'home');
  byId('nav-app')?.classList.toggle('active', page === 'app');
  byId('nav-admin')?.classList.toggle('active', page === 'admin');

  // Side nav
  byId('side-app')?.classList.toggle('active', page === 'app');
  byId('side-admin')?.classList.toggle('active', page === 'admin');
  byId('side-home')?.classList.toggle('active', page === 'home');
}

function setupSidebarToggles() {
  const sidebar = document.getElementById('sidebar');
  const collapseBtn = document.getElementById('sidebar-collapse');
  const toggleBtn = document.getElementById('sidebar-toggle');
  const backdrop = document.getElementById('sidebar-backdrop');

  if (!sidebar) return;

  const setCollapsed = (collapsed) => {
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    localStorage.setItem('ava_sidebar_collapsed', collapsed ? '1' : '0');
  };

  const setMobileOpen = (open) => {
    document.body.classList.toggle('sidebar-open', open);
  };

  // restaura estado (desktop)
  const saved = localStorage.getItem('ava_sidebar_collapsed');
  if (saved === '1') setCollapsed(true);

  collapseBtn?.addEventListener('click', () => {
    setCollapsed(!document.body.classList.contains('sidebar-collapsed'));
  });

  toggleBtn?.addEventListener('click', () => {
    // mobile: abre/fecha
    setMobileOpen(!document.body.classList.contains('sidebar-open'));
  });

  backdrop?.addEventListener('click', () => setMobileOpen(false));

  // fechando ao navegar no mobile
  sidebar.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => setMobileOpen(false));
  });
}

async function fetchProfileRole(supabase, uid) {
  // tenta ler role/nome na tabela profiles
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, name, role')
      .eq('id', uid)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  } catch (e) {
    // Se RLS bloquear, isso vai falhar — e aí tratamos como não-admin.
    console.warn(
      '[layout] Não foi possível ler profiles (RLS?)',
      e?.message || e
    );
    return null;
  }
}

async function applyAuthUI() {
  const supabase = await getSupabaseClient();

  const authLink = document.getElementById('auth-link');
  const logoutBtn = document.getElementById('logout-btn');
  const userPill = document.getElementById('user-pill');
  const userNameEl = document.getElementById('user-name');

  const navApp = document.getElementById('nav-app');
  const navAdmin = document.getElementById('nav-admin');

  const footLogin = document.getElementById('foot-login');
  const footApp = document.getElementById('foot-app');
  const footAdmin = document.getElementById('foot-admin');

  const sideApp = document.getElementById('side-app');
  const sideAdmin = document.getElementById('side-admin');
  const sideLogout = document.getElementById('side-logout');

  // Fallback: se supabase nem carregar, mantém UI pública.
  if (!supabase) {
    navApp && (navApp.style.display = 'none');
    navAdmin && (navAdmin.style.display = 'none');
    footApp && (footApp.style.display = 'none');
    footAdmin && (footAdmin.style.display = 'none');
    if (userPill) userPill.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (authLink) {
      authLink.href = rel('login.html');
      authLink.innerHTML = `<i class="bx bx-log-in"></i> Entrar`;
      authLink.style.display = 'inline-flex';
    }
    sideAdmin && (sideAdmin.style.display = 'none');
    sideLogout && (sideLogout.style.display = 'none');
    return;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn('[layout] Erro getSession:', error.message);
    return;
  }

  const session = data?.session;
  const user = session?.user;

  if (!session) {
    // DESLOGADO
    navApp && (navApp.style.display = 'none');
    navAdmin && (navAdmin.style.display = 'none');
    footApp && (footApp.style.display = 'none');
    footAdmin && (footAdmin.style.display = 'none');
    footLogin && (footLogin.style.display = 'inline');

    if (userPill) userPill.style.display = 'none';

    if (logoutBtn) logoutBtn.style.display = 'none';
    if (authLink) {
      authLink.href = rel('login.html');
      authLink.innerHTML = `<i class="bx bx-log-in"></i> Entrar`;
      authLink.style.display = 'inline-flex';
    }

    // sidebar (se existir): some tudo que é “privado”
    sideApp && (sideApp.style.display = 'none');
    sideAdmin && (sideAdmin.style.display = 'none');
    sideLogout && (sideLogout.style.display = 'none');

    return;
  }

  // LOGADO
  const uid = user.id;
  const email = user.email || '';

  // busca profile (role + nome)
  const profile = await fetchProfileRole(supabase, uid);
  const role = (profile?.role || '').toLowerCase();
  const isAdmin = role === 'admin';

  const displayName =
    profile?.full_name ||
    profile?.name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    email ||
    'Conta';

  // Top nav
  navApp && (navApp.style.display = 'inline-flex');
  navAdmin && (navAdmin.style.display = isAdmin ? 'inline-flex' : 'none');

  // Footer
  footLogin && (footLogin.style.display = 'none');
  footApp && (footApp.style.display = 'inline');
  footAdmin && (footAdmin.style.display = isAdmin ? 'inline' : 'none');

  // user pill
  if (userPill && userNameEl) {
    userPill.style.display = 'inline-flex';
    userNameEl.textContent = displayName;
    userPill.title = esc(email);
  }

  // Botões Entrar/Sair
  if (authLink) authLink.style.display = 'none';
  if (logoutBtn) logoutBtn.style.display = 'inline-flex';

  // Sidebar
  if (sideApp) sideApp.style.display = 'flex';
  if (sideAdmin) sideAdmin.style.display = isAdmin ? 'flex' : 'none';
  if (sideLogout) sideLogout.style.display = 'inline-flex';

  const doLogout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      window.location.assign(rel('index.html'));
    }
  };

  logoutBtn && (logoutBtn.onclick = doLogout);
  sideLogout && sideLogout.addEventListener('click', doLogout);

  // Se estiver em /admin e NÃO for admin: manda pro app
  if (getActivePage() === 'admin' && !isAdmin) {
    window.location.replace(rel('app.html'));
    return;
  }
}

async function applyGuards() {
  const authMode = document.body.dataset.auth; // "required" se quiser proteger
  if (authMode !== 'required') return;

  const supabase = await getSupabaseClient();
  if (!supabase) {
    // se não dá pra ler supabase, manda pro login para evitar página “quebrada”
    window.location.replace(rel('login.html'));
    return;
  }

  const { data } = await supabase.auth.getSession();
  if (!data?.session) {
    window.location.replace(rel('login.html'));
  }
}

async function boot() {
  renderHeaderFooter();
  setActiveLinks();
  setupSidebarToggles();
  await applyAuthUI();
  await applyGuards();

  const supabase = await getSupabaseClient();
  if (supabase) {
    supabase.auth.onAuthStateChange((event) => {
      // Evita loop: INITIAL_SESSION dispara no carregamento.
      if (
        event === 'SIGNED_IN' ||
        event === 'SIGNED_OUT' ||
        event === 'USER_UPDATED'
      ) {
        window.location.reload();
      }
    });
  }
}

boot();
