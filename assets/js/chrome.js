import { supabase } from './supabaseClient.js';
import { goTo } from './router.js';

// mantém seu arquivo, só adiciono versionamento p/ evitar cache chato do GitHub Pages
const LAYOUT_URL = './assets/chrome.html?v=20260111_1';

/**
 * ✅ Fallback de UI (não é segurança do banco — RLS continua mandando)
 * Coloque aqui SOMENTE quem deve enxergar o menu Admin.
 */
const ADMIN_EMAILS = new Set([
  'eneidaandre@gmail.com', // <-- seu admin (ajuste se quiser)
]);

const ADMIN_UIDS = new Set([
  // se você tiver certeza do auth.uid() do admin, pode colocar aqui também
  // 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
]);

async function initChrome() {
  ensureSlot('site-header');
  ensureSlot('site-sidebar');
  ensureSlot('site-footer');

  try {
    const res = await fetch(LAYOUT_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Menu error: ${res.status}`);
    const text = await res.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');

    inject('site-header', doc, 'header');
    inject('site-sidebar', doc, 'sidebar');
    inject('site-footer', doc, 'footer');

    document.body.classList.add('has-sidebar');
    restoreState();

    // roda uma vez e também sempre que logar/deslogar
    await checkAuth();
    supabase.auth.onAuthStateChange(async () => {
      await checkAuth();
    });
  } catch (err) {
    console.error('[Chrome] Falha ao carregar chrome.html:', err);
  }
}

// ======================
// AUTH + ADMIN VISIBILITY
// ======================
async function checkAuth() {
  // elementos do chrome.html (injetados)
  const pill = document.getElementById('user-pill');
  const actions = document.getElementById('auth-actions');
  const nameEl = document.getElementById('user-name');
  const logoutBtn = document.getElementById('side-logout');

  const adminLink = document.getElementById('link-admin');
  const adminGroup = document.getElementById('sidebar-admin-group');

  // Sempre começa escondendo o admin (estado seguro)
  if (adminLink) adminLink.style.display = 'none';
  if (adminGroup) adminGroup.style.display = 'none';

  try {
    const {
      data: { session },
      error: sessErr,
    } = await supabase.auth.getSession();

    if (sessErr) console.warn('[Auth] getSession error:', sessErr.message);

    if (!session) {
      // VISITANTE
      if (pill) pill.style.display = 'none';
      if (actions) actions.style.display = 'block';
      if (logoutBtn) logoutBtn.style.display = 'none';
      return;
    }

    // LOGADO
    const email = (session.user?.email || '').toLowerCase().trim();
    const uid = (session.user?.id || '').trim();

    if (pill) pill.style.display = 'flex';
    if (actions) actions.style.display = 'none';

    if (logoutBtn) {
      logoutBtn.style.display = 'flex';
      logoutBtn.onclick = async () => {
        await supabase.auth.signOut();
        goTo('login.html');
      };
    }

    // Nome default (não depende do profiles)
    if (nameEl) nameEl.textContent = email ? email.split('@')[0] : 'Usuário';

    // 1) Tenta pegar role/nome no profiles (sem quebrar)
    let roleNorm = '';
    try {
      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('name, role')
        .eq('id', uid)
        .maybeSingle();

      if (profErr) {
        console.warn('[Auth] profiles read error:', profErr.message);
      } else if (profile) {
        if (nameEl)
          nameEl.textContent =
            profile.name || (email ? email.split('@')[0] : 'Usuário');
        roleNorm = String(profile.role || '')
          .trim()
          .toLowerCase();
      }
    } catch (e) {
      // se der erro inesperado, não derruba tudo
      console.warn('[Auth] profiles exception:', e);
    }

    // 2) Decide se é admin (role OU fallback allowlist)
    const isAdmin =
      roleNorm === 'admin' ||
      ADMIN_EMAILS.has(email) ||
      ADMIN_UIDS.has(uid) ||
      String(session.user?.app_metadata?.role || '').toLowerCase() ===
        'admin' ||
      String(session.user?.user_metadata?.role || '').toLowerCase() === 'admin';

    console.log('[Auth] email:', email);
    console.log('[Auth] uid:', uid);
    console.log('[Auth] roleNorm:', roleNorm);
    console.log('[Auth] isAdmin:', isAdmin);

    if (isAdmin) {
      if (adminLink) adminLink.style.display = 'block';
      if (adminGroup) adminGroup.style.display = 'block';
      wireAdminLinks(adminLink, adminGroup);
    }
  } catch (e) {
    console.error('[Auth] Erro fatal no Auth:', e);
  }
}

// força abrir admin.html mesmo se router interceptar
function wireAdminLinks(adminLink, adminGroup) {
  if (adminLink && adminLink.dataset.wired !== '1') {
    adminLink.dataset.wired = '1';
    adminLink.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        window.location.href = adminLink.getAttribute('href');
      },
      true
    );
  }

  const sideA = adminGroup ? adminGroup.querySelector('a[href]') : null;
  if (sideA && sideA.dataset.wired !== '1') {
    sideA.dataset.wired = '1';
    sideA.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        window.location.href = sideA.getAttribute('href');
      },
      true
    );
  }
}

// ======================
// SIDEBAR TOGGLE + LAYOUT
// ======================
document.addEventListener('click', (e) => {
  if (
    e.target.closest('#sidebar-toggle') ||
    e.target.closest('#sidebar-overlay')
  ) {
    const isMobile = window.innerWidth <= 900;
    if (isMobile) {
      document.body.classList.toggle('sidebar-open');
    } else {
      document.body.classList.toggle('sidebar-collapsed');
      localStorage.setItem(
        'sidebar_collapsed',
        document.body.classList.contains('sidebar-collapsed')
      );
    }
  }
});

function restoreState() {
  if (window.innerWidth > 900) {
    const collapsed = localStorage.getItem('sidebar_collapsed') === 'true';
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
