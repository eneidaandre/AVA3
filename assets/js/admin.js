// assets/js/admin.js
import { supabase } from './supabaseClient.js';

function rel(path) {
  return new URL(`./${path}`, window.location.href).toString();
}

function setStatus(type, title, message) {
  const box = document.getElementById('adminStatus');
  if (!box) return;

  const icon =
    type === 'ok'
      ? '✅'
      : type === 'warn'
      ? '⚠️'
      : type === 'error'
      ? '❌'
      : '⏳';

  box.innerHTML = `
    <div class="admin-icon">${icon}</div>
    <div>
      <div class="admin-title">${title}</div>
      <div class="muted">${message}</div>
    </div>
  `;
}

async function requireAdmin() {
  // 1) precisa de sessão
  const { data: sData, error: sErr } = await supabase.auth.getSession();
  if (sErr) {
    setStatus('error', 'Erro ao ler sessão', sErr.message);
    return;
  }

  const session = sData?.session;
  if (!session) {
    setStatus(
      'warn',
      'Sem sessão',
      'Você não está logada. Indo para o login...'
    );
    window.location.replace(rel('login.html'));
    return;
  }

  // 2) precisa ser admin (profiles.role)
  const uid = session.user.id;

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('id, full_name, name, role')
    .eq('id', uid)
    .maybeSingle();

  if (pErr) {
    // quando RLS do profiles está errada, aqui dá erro
    setStatus(
      'error',
      'Sem permissão para ler seu perfil (profiles)',
      'Isso normalmente é RLS no Supabase. Ajuste a policy de SELECT do profiles para permitir o próprio usuário.'
    );
    console.error(pErr);
    return;
  }

  const role = (profile?.role || '').toLowerCase();
  const isAdmin = role === 'admin';

  if (!isAdmin) {
    setStatus(
      'warn',
      'Acesso negado',
      'Seu perfil não é admin. Indo para Minha área...'
    );
    window.location.replace(rel('app.html'));
    return;
  }

  // 3) liberou
  const name =
    profile?.full_name ||
    profile?.name ||
    session.user.user_metadata?.full_name ||
    session.user.user_metadata?.name ||
    session.user.email ||
    'Admin';

  setStatus('ok', 'Acesso autorizado', `Bem-vinda, ${name}.`);

  const badge = document.getElementById('adminUserBadge');
  if (badge) badge.textContent = `${name} • role: admin`;

  const content = document.getElementById('adminContent');
  if (content) content.style.display = 'block';
}

requireAdmin();
