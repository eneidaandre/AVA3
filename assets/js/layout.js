// assets/js/layout.js
// Layout global (header + footer + sidebar) "blindado":
// - NÃO depende do Supabase para renderizar
// - tenta carregar Supabase depois (dynamic import) só para sessão/logout/proteção

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

function getActivePage() {
  return document.body.dataset.page || '';
}

function hasSidebarHost() {
  return !!document.getElementById('site-sidebar');
}

function renderHeaderFooter() {
  ensureBoxicons();

  const page = getActivePage();
  const headerHost = document.getElementById('site-header');
  const footerHost = document.getElementById('site-footer');

  const showToggle = hasSidebarHost();

  if (headerHost) {
    headerHost.innerHTML = `
      <header class="site-header">
        <div class="inner">
          <div class="left" style="display:flex; align-items:center; gap:10px;">
            ${
              showToggle
                ? `<button class="btn ghost" id="sidebar-toggle" title="Menu" aria-label="Abrir menu">
                     <i class="bx bx-menu"></i>
                   </button>`
                : ``
            }

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
    )}">App</a>

            <a class="navlink ${page === 'admin' ? 'active' : ''}" href="${rel(
      'admin.html'
    )}">Admin</a>
          </nav>

          <div class="right">
            <span id="user-pill" class="badge" style="display:none;">
              <i class="bx bx-user"></i> <span id="user-email"></span>
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

  if (footerHost) {
    footerHost.innerHTML = `
      <footer class="site-footer">
        <div class="inner">
          <div>© ${new Date().getFullYear()} AVA • Protótipo</div>
          <div class="footer-links">
            <a href="${rel('index.html')}">Home</a>
            <a href="${rel('app.html')}">App</a>
            <a href="${rel('admin.html')}">Admin</a>
          </div>
        </div>
      </footer>
    `;
  }
}

function renderSidebar() {
  const host = document.getElementById('site-sidebar');
  if (!host) {
    document.body.classList.remove('has-sidebar');
    return;
  }

  const page = getActivePage();
  document.body.classList.add('has-sidebar');

  host.innerHTML = `
    <aside class="site-sidebar" aria-label="Menu lateral">
      <div class="side-group">
        <a class="side-item ${page === 'app' ? 'active' : ''}" href="${rel(
    'app.html'
  )}">
          <i class="bx bx-grid-alt"></i>
          <span class="side-label">Minha área</span>
        </a>

        <a class="side-item ${page === 'admin' ? 'active' : ''}" href="${rel(
    'admin.html'
  )}">
          <i class="bx bx-cog"></i>
          <span class="side-label">Admin</span>
        </a>

        <a class="side-item ${page === 'home' ? 'active' : ''}" href="${rel(
    'index.html'
  )}">
          <i class="bx bx-home"></i>
          <span class="side-label">Início</span>
        </a>

        <div class="side-divider"></div>

        <div id="side-user" class="badge" style="display:none; justify-content:flex-start;">
          <i class="bx bx-user"></i>
          <span id="side-user-email" class="side-label"></span>
        </div>

        <button id="side-logout" class="side-item" style="display:none;">
          <i class="bx bx-log-out"></i>
          <span class="side-label">Sair</span>
        </button>
      </div>
    </aside>
  `;

  // overlay (se existir no HTML, só usamos; se não, criamos)
  let overlay = document.getElementById('sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'sidebar-overlay';
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
  } else {
    overlay.classList.add('sidebar-overlay');
  }

  // Toggle no header
  const btnToggle = document.getElementById('sidebar-toggle');
  if (btnToggle) {
    btnToggle.onclick = () => {
      document.body.classList.toggle('sidebar-open');
    };
  }

  // Click no overlay fecha
  overlay.onclick = () => document.body.classList.remove('sidebar-open');

  // ESC fecha
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.body.classList.remove('sidebar-open');
  });
}

function setAuthUI(session) {
  const authLink = document.getElementById('auth-link');
  const logoutBtn = document.getElementById('logout-btn');
  const userPill = document.getElementById('user-pill');
  const userEmail = document.getElementById('user-email');

  const sideUser = document.getElementById('side-user');
  const sideUserEmail = document.getElementById('side-user-email');
  const sideLogout = document.getElementById('side-logout');

  const isAuthed = !!session;
  const email = session?.user?.email || '';

  if (isAuthed) {
    if (authLink) {
      authLink.href = rel('app.html');
      authLink.innerHTML = `<i class="bx bx-grid-alt"></i> Ir para o App`;
    }

    if (logoutBtn) logoutBtn.style.display = 'inline-flex';
    if (userPill && userEmail) {
      userPill.style.display = 'inline-flex';
      userEmail.textContent = email || 'sessão ativa';
    }

    if (sideUser && sideUserEmail) {
      sideUser.style.display = 'inline-flex';
      sideUserEmail.textContent = email || 'sessão ativa';
    }
    if (sideLogout) sideLogout.style.display = 'flex';
  } else {
    if (authLink) {
      authLink.href = rel('login.html');
      authLink.innerHTML = `<i class="bx bx-log-in"></i> Entrar`;
    }
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (userPill) userPill.style.display = 'none';

    if (sideUser) sideUser.style.display = 'none';
    if (sideLogout) sideLogout.style.display = 'none';
  }
}

async function loadSupabaseSafe() {
  try {
    const mod = await import('./supabaseClient.js');
    return mod?.supabase || null;
  } catch (e) {
    // Falhou carregar supabaseClient.js -> layout continua funcionando
    console.warn('[layout] Supabase não carregou:', e?.message || e);
    return null;
  }
}

function enforceAuthIfNeeded(session) {
  const required = document.body.dataset.auth === 'required';
  if (!required) return;

  if (!session) {
    window.location.assign(rel('login.html'));
  }
}

async function bootAuth() {
  const supabase = await loadSupabaseSafe();
  if (!supabase) {
    // Sem supabase: mantém UI “visitante”
    setAuthUI(null);
    return;
  }

  // Sessão atual
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn('[layout] erro getSession:', error.message);
    setAuthUI(null);
    return;
  }

  const session = data?.session || null;
  setAuthUI(session);
  enforceAuthIfNeeded(session);

  // Logout (topo)
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await supabase.auth.signOut();
      window.location.assign(rel('index.html'));
    };
  }

  // Logout (lateral)
  const sideLogout = document.getElementById('side-logout');
  if (sideLogout) {
    sideLogout.onclick = async () => {
      await supabase.auth.signOut();
      window.location.assign(rel('index.html'));
    };
  }

  // Mudanças de auth em tempo real
  supabase.auth.onAuthStateChange(async () => {
    const r = await supabase.auth.getSession();
    const s = r?.data?.session || null;
    setAuthUI(s);
    enforceAuthIfNeeded(s);
  });
}

// Boot “blindado”
renderHeaderFooter();
renderSidebar();
setAuthUI(null);
bootAuth();
