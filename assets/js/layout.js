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
  // sempre relativo (funciona no /AVA3/)
  return new URL(`./${path}`, window.location.href).toString();
}

function getActivePage() {
  // defina <body data-page="home"> etc.
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
          <a class="brand" href="${rel('index.html')}">
            <span class="dot"></span>
            <span>AVA</span>
          </a>

          <nav class="nav" aria-label="Menu principal">
            <a class="navlink ${page === 'home' ? 'active' : ''}" href="${rel(
      'index.html'
    )}">Início</a>
            <a class="navlink ${page === 'login' ? 'active' : ''}" href="${rel(
      'login.html'
    )}">Entrar</a>
            <a class="navlink ${page === 'app' ? 'active' : ''}" href="${rel(
      'app.html'
    )}">App</a>
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
            <a href="${rel('login.html')}">Login</a>
            <a href="${rel('app.html')}">App</a>
          </div>
        </div>
      </footer>
    `;
  }
}

async function syncAuthUI() {
  const authLink = document.getElementById('auth-link');
  const logoutBtn = document.getElementById('logout-btn');
  const userPill = document.getElementById('user-pill');
  const userEmail = document.getElementById('user-email');

  if (!authLink || !logoutBtn) return;

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    // se der erro, mantém botão de entrar
    return;
  }

  const session = data?.session;
  const email = session?.user?.email || '';

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
  supabase.auth.onAuthStateChange(() => {
    // atualiza header/cta automaticamente
    syncAuthUI();
  });
}

// Boot
renderHeaderFooter();
syncAuthUI();
watchAuthChanges();
