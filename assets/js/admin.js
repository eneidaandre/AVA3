import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

/**
 * ✅ CONFIGURE AQUI
 * - Use a ANON KEY (pode ficar no front; quem protege é o RLS) :contentReference[oaicite:4]{index=4}
 * - NUNCA use SERVICE_ROLE no front :contentReference[oaicite:5]{index=5}
 */
const SUPABASE_URL = 'COLE_AQUI_SUA_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'COLE_AQUI_SUA_SUPABASE_ANON_KEY';

// Para onde mandar quem não está logado
const LOGIN_PAGE = './login.html'; // ajuste se o seu login tiver outro nome/caminho
// Para onde mandar quem não for admin
const FALLBACK_PAGE = './index.html'; // ajuste para sua home real

const elStatus = document.getElementById('statusCard');
const elContent = document.getElementById('adminContent');
const elUserChip = document.getElementById('userChip');
const elUserName = document.getElementById('userName');
const btnLogout = document.getElementById('btnLogout');

function setStatus(title, message, isError = false) {
  if (!elStatus) return;
  const h1 = elStatus.querySelector('h1');
  const p = elStatus.querySelector('p');
  if (h1) h1.textContent = title;
  if (p) p.textContent = message;
  if (isError) {
    elStatus.style.borderColor = 'rgba(220, 38, 38, 0.35)';
  }
}

function hardRedirect(url) {
  window.location.replace(url);
}

function assertConfig() {
  if (!SUPABASE_URL || SUPABASE_URL.includes('COLE_AQUI')) return false;
  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('COLE_AQUI'))
    return false;
  return true;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getSessionUser() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data?.session?.user || null;
}

/**
 * Checa se usuário é admin via profiles.role (papel global) :contentReference[oaicite:6]{index=6}
 * Observação: o front só “melhora UX”; o bloqueio real é RLS :contentReference[oaicite:7]{index=7}
 */
async function fetchMyProfileRole(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

function showAdminUI(profile) {
  // topo
  if (elUserChip) elUserChip.hidden = false;
  if (btnLogout) btnLogout.hidden = false;
  if (elUserName) elUserName.textContent = profile?.name || 'Admin';

  // conteúdo
  if (elStatus) elStatus.hidden = true;
  if (elContent) elContent.hidden = false;

  // logout
  btnLogout?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    hardRedirect(LOGIN_PAGE);
  });
}

async function requireAdmin() {
  // 0) config
  if (!assertConfig()) {
    setStatus(
      'Configuração incompleta',
      'Defina SUPABASE_URL e SUPABASE_ANON_KEY em assets/js/admin.js.',
      true
    );
    return;
  }

  // 1) precisa estar logado
  const user = await getSessionUser();
  if (!user) {
    setStatus(
      'Acesso restrito',
      'Você precisa entrar com sua conta para continuar.'
    );
    // pequeno atraso só para exibir feedback (sem “espera” longa)
    setTimeout(() => hardRedirect(LOGIN_PAGE), 350);
    return;
  }

  // 2) precisa ser admin
  const profile = await fetchMyProfileRole(user.id);

  if (String(profile?.role).toLowerCase() !== 'admin') {
    // Não é admin
    setStatus(
      'Acesso negado',
      'Sua conta não tem permissão de administrador para acessar esta página.',
      true
    );
    setTimeout(() => hardRedirect(FALLBACK_PAGE), 700);
    return;
  }

  // 3) ok -> libera
  showAdminUI(profile);
}

/**
 * Inicializa e mantém a página coerente se trocar sessão/usuário
 */
requireAdmin().catch((err) => {
  console.error(err);
  setStatus(
    'Erro ao verificar acesso',
    'Verifique se o RLS permite ler o próprio profile.',
    true
  );
});

// Se quiser reagir a troca de sessão (login/logout) em tempo real:
supabase.auth.onAuthStateChange((_event, session) => {
  // Se saiu, volta pro login
  if (!session?.user) hardRedirect(LOGIN_PAGE);
});
