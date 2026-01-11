// assets/js/layout.js
import { supabase } from './supabaseClient.js';

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

function renderHeaderFooter() {
  ensureBoxicons();

  const page = getActivePage();
  const headerHost = document.getElementById('site-header');
  const footerHost = document.getElementById('site-footer');

  if (headerHost) {
    headerHost.innerHTML = `
      <header class="site-header">
        <div class="inner">
          <div class="brand-row">
            <button class="icon-btn" id="sidebar-toggle" type="button" aria-label="Menu">
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
    )}">Minha área</a>
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
            <a href="${rel('app.html')}">Minha área</a>
            <a href="${rel('admin.html')}">Admin</a>
          </div>
        </div>
      </footer>
    `;
  }
}

function renderSidebar() {
  const host = document.getElementById('site-sidebar');
  if (!host) return;

  document.body.classList.add('has-sidebar');

  host.innerHTML = `
    <aside class="site-sidebar" aria-label="Menu lateral">
      <div class="side-top">
        <div class="side-title">Menu</div>
        <button class="icon-btn" id="sidebar-collapse" type="button" aria-label="Recolher">
          <i class="bx bx-chevrons-left"></i>
        </button>
      </div>

      <nav class="side-nav">
        <a class="side-item" href="${rel('app.html')}" data-side="app">
          <i class="bx bx-grid-alt"></i>
          <span class="side-label">Minha área</span>
        </a>

        <a class="side-item" href="${rel('admin.html')}" data-side="admin">
          <i class="bx bx-cog"></i>
          <span class="side-label">Admin</span>
        </a>

        <a class="side-item" href="${rel('index.html')}" data-side="home">
          <i class="bx bx-home"></i>
          <span class="side-label">Início</span>
        </a>
      </nav>

      <div class="side-bottom">
        <button class="side-item danger" id="side-logout" type="button">
          <i class="bx bx-log-out"></i>
          <span class="side-label">Sair</span>
        </button>
      </div>
    </aside>

    <div class="sidebar-overlay" id="sidebar-overlay" aria-hidden="true"></div>
  `;

  // ativo
  const page = getActivePage();
  host.querySelectorAll('[data-side]').forEach((a) => {
    if (a.getAttribute('data-side') === page) a.classList.add('active');
  });

  // estado recolhido
  const collapsed = localStorage.getItem('ava_sidebar_collapsed') === '1';
  document.body.classList.toggle('sidebar-collapsed', collapsed);

  const overlay = document.getElementById('sidebar-overlay');
  const toggle = document.getElementById('sidebar-toggle');
  const collapse = document.getElementById('sidebar-collapse');

  function openMobile() {
    document.body.classList.add('sidebar-open');
    if (overlay) overlay.style.display = 'block';
  }
  function closeMobile() {
    document.body.classList.remove('sidebar-open');
    if (overlay) overlay.style.display = 'none';
  }

  toggle?.addEventListener('click', () => {
    // mobile: abre overlay
    if (window.matchMedia('(max-width: 980px)').matches) {
      if (document.body.classList.contains('sidebar-open')) closeMobile();
      else openMobile();
      return;
    }
    // desktop: alterna recolhido
    const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('ava_sidebar_collapsed', isCollapsed ? '1' : '0');
  });

  collapse?.addEventListener('click', () => {
    const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('ava_sidebar_collapsed', isCollapsed ? '1' : '0');
  });

  overlay?.addEventListener('click', closeMobile);
  window.addEventListener('resize', () => {
    if (!window.matchMedia('(max-width: 980px)').matches) closeMobile();
  });

  // logout no sidebar
  const sideLogout = document.getElementById('side-logout');
  sideLogout?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.assign(rel('index.html'));
  });
}

function redirectToLogin(next) {
  const u = new URL(rel('login.html'));
  if (next) u.searchParams.set('next', next);
  window.location.assign(u.toString());
}

async function syncAuthUI() {
  const authLink = document.getElementById('auth-link');
  const logoutBtn = document.getElementById('logout-btn');
  const userPill = document.getElementById('user-pill');
  const userEmail = document.getElementById('user-email');

  if (!authLink || !logoutBtn) return;

  const { data, error } = await supabase.auth.getSession();
  if (error) return;

  const session = data?.session;
  const email = session?.user?.email || '';

  document.body.classList.toggle('is-authed', !!session);

  // proteção de rota
  const authNeed = document.body.dataset.auth || '';
  if (authNeed === 'required' && !session) {
    redirectToLogin(
      `${getActivePage()}.html`.replace('home.html', 'index.html')
    );
    return;
  }
  if (authNeed === 'admin' && !session) {
    redirectToLogin('admin.html');
    return;
  }

  if (session) {
    authLink.href = rel('app.html');
    authLink.innerHTML = `<i class="bx bx-grid-alt"></i> Ir para o App`;

    logoutBtn.style.display = 'inline-flex';
    if (userPill && userEmail) {
      userPill.style.display = 'inline-flex';
      userEmail.textContent = email || 'sessão ativa';
    }
  } else {
    authLink.href = rel('login.html');
    authLink.innerHTML = `<i class="bx bx-log-in"></i> Entrar`;

    logoutBtn.style.display = 'none';
    if (userPill) userPill.style.display = 'none';
  }

  logoutBtn.onclick = async () => {
    await supabase.auth.signOut();
    window.location.assign(rel('index.html'));
  };
}

function watchAuthChanges() {
  supabase.auth.onAuthStateChange(() => syncAuthUI());
}

// Boot
renderHeaderFooter();
renderSidebar();
syncAuthUI();
watchAuthChanges();
