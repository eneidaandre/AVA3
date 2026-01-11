// assets/js/chrome.js
import { goTo } from './router.js';

function ensureBoxicons() {
  if (document.querySelector('link[data-boxicons="1"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css';
  link.setAttribute('data-boxicons', '1');
  document.head.appendChild(link);
}

function rel(file) {
  return new URL(`./${file}`, window.location.href).toString();
}

function $(sel) {
  return document.querySelector(sel);
}

function setActiveLinks() {
  const page = document.body.dataset.page || '';
  document.querySelectorAll('[data-page]').forEach((a) => {
    const p = a.getAttribute('data-page');
    if (!p) return;
    a.classList.toggle('active', p === page);
  });
}

function toggleAdminLinks(show) {
  document.querySelectorAll('[data-admin-only]').forEach((el) => {
    el.style.display = show ? '' : 'none';
  });
}

function setUserUI({ session, displayName, email }) {
  const pill = $('#user-pill');
  const nameEl = $('#user-name');
  const emailEl = $('#user-email');
  const authBtn = $('#auth-btn');
  const sideLogout = $('#side-logout');

  const authed = !!session;
  document.body.classList.toggle('is-authed', authed);

  if (pill && nameEl && emailEl) {
    if (authed) {
      pill.style.display = 'inline-flex';
      nameEl.textContent = displayName || email || '';
      emailEl.textContent = email || '';
    } else {
      pill.style.display = 'none';
      nameEl.textContent = '';
      emailEl.textContent = '';
    }
  }

  // botão único à direita: Entrar/Sair
  if (authBtn) {
    if (!authed) {
      authBtn.classList.add('primary');
      authBtn.innerHTML = `<i class="bx bx-log-in"></i> Entrar`;
      authBtn.onclick = () => goTo('login.html');
    } else {
      authBtn.classList.remove('primary');
      authBtn.innerHTML = `<i class="bx bx-log-out"></i> Sair`;
      // onclick será ligado após importar supabase
    }
  }

  // “Sair” também no menu lateral (só quando logado)
  if (sideLogout) sideLogout.style.display = authed ? '' : 'none';
}

async function checkIsAdmin(supabase, uid) {
  // tenta RPC
  const tries = [{ uid }, { user_id: uid }, { p_uid: uid }];
  for (const args of tries) {
    try {
      const { data, error } = await supabase.rpc('is_admin', args);
      if (!error) return !!data;
    } catch (_) {}
  }

  // fallback: profiles.role
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

function bindSidebarToggle() {
  const toggle = $('#sidebar-toggle');
  const overlay = $('#sidebar-overlay');

  if (toggle) {
    toggle.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-open');
    });
  }

  if (overlay) {
    overlay.addEventListener('click', () => {
      document.body.classList.remove('sidebar-open');
    });
  }
}

async function injectChrome() {
  ensureBoxicons();

  const headerHost = $('#site-header');
  const footerHost = $('#site-footer');
  const sidebarHost = $('#site-sidebar'); // opcional

  if (!headerHost || !footerHost) return;

  const res = await fetch('./assets/partials/chrome.html', {
    cache: 'no-store',
  });
  const html = await res.text();

  const temp = document.createElement('div');
  temp.innerHTML = html;

  const header = temp.querySelector('[data-slot="header"]')?.firstElementChild;
  const footer = temp.querySelector('[data-slot="footer"]')?.firstElementChild;
  const sidebarWrap = temp
    .querySelector('[data-slot="sidebar"]')
    ?.cloneNode(true);

  headerHost.innerHTML = '';
  footerHost.innerHTML = '';

  if (header) headerHost.appendChild(header);
  if (footer) footerHost.appendChild(footer);

  // sidebar só injeta se a página tiver o host
  if (sidebarHost && sidebarWrap) {
    sidebarHost.innerHTML = '';
    // sidebarWrap contém <aside> + overlay
    Array.from(sidebarWrap.childNodes).forEach((n) =>
      sidebarHost.appendChild(n)
    );
    document.body.classList.add('has-sidebar');
    bindSidebarToggle();
  }

  // ano no footer
  const y = $('#year');
  if (y) y.textContent = String(new Date().getFullYear());

  setActiveLinks();
}

async function initAuth() {
  const requiresAuth = document.body.dataset.auth === 'required';
  const requiresAdmin = document.body.dataset.admin === 'required';

  // UI base (deslogado) — já aparece SEM supabase
  setUserUI({ session: null, displayName: '', email: '' });
  toggleAdminLinks(false);

  // agora tenta supabase
  let supabase, getSessionSafe, getUserDisplayName;

  try {
    ({ supabase, getSessionSafe, getUserDisplayName } = await import(
      './supabaseClient.js'
    ));
  } catch (_) {
    if (requiresAuth) goTo('login.html');
    return;
  }

  async function refresh() {
    const { session } = await getSessionSafe();
    const email = session?.user?.email || '';
    const displayName = session ? getUserDisplayName(session) : '';

    // guard auth
    if (requiresAuth && !session) {
      goTo('login.html');
      return;
    }

    let isAdmin = false;
    if (session?.user?.id) {
      isAdmin = await checkIsAdmin(supabase, session.user.id);
    }

    // guard admin
    if (requiresAdmin && (!session || !isAdmin)) {
      goTo('app.html');
      return;
    }

    setUserUI({ session, displayName, email });
    toggleAdminLinks(!!isAdmin);

    // ligar Sair (topo e sidebar) somente quando logado
    const authBtn = $('#auth-btn');
    const sideLogout = $('#side-logout');

    const doLogout = async () => {
      await supabase.auth.signOut();
      goTo('index.html');
    };

    if (session && authBtn) authBtn.onclick = doLogout;
    if (session && sideLogout) sideLogout.onclick = doLogout;
  }

  await refresh();
  supabase.auth.onAuthStateChange(() => refresh());
}

(async function boot() {
  await injectChrome();
  await initAuth();
})();
