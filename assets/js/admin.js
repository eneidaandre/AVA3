// assets/js/admin.js
import { supabase, getSessionSafe } from './supabaseClient.js';

const pillText = document.getElementById('admin-pill-text');
const guardBox = document.getElementById('admin-guard-box');
const guardMsg = document.getElementById('admin-guard-msg');
const guardHint = document.getElementById('admin-guard-hint');

const content = document.getElementById('admin-content');
const logsEl = document.getElementById('admin-logs');

const statUsers = document.getElementById('stat-users');
const statCourses = document.getElementById('stat-courses');
const statOffers = document.getElementById('stat-offers');

const usersTableBody = document.querySelector('#users-table tbody');
const usersEmpty = document.getElementById('users-empty');

const courseForm = document.getElementById('course-form');
const courseTitle = document.getElementById('course-title');
const courseType = document.getElementById('course-type');
const courseDesc = document.getElementById('course-desc');
const courseMsg = document.getElementById('course-msg');

const coursesTableBody = document.querySelector('#courses-table tbody');
const coursesEmpty = document.getElementById('courses-empty');

function log(msg) {
  const line = `[ADMIN] ${msg}`;
  console.log(line);
  if (logsEl) logsEl.textContent += line + '\n';
}

function setPill(text) {
  if (pillText) pillText.textContent = text;
}

function showHint(html) {
  if (!guardHint) return;
  guardHint.style.display = 'block';
  guardHint.innerHTML = html;
}

function redirectTo(url) {
  window.location.assign(new URL(`./${url}`, window.location.href).toString());
}

async function getMyRole(uid) {
  // precisa de policy: profiles_select_own
  const { data, error } = await supabase
    .from('profiles')
    .select('role,name,email')
    .eq('id', uid)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data || null;
}

async function guardAdmin() {
  setPill('Verificando acesso…');
  log('Checando sessão...');
  const { session, error } = await getSessionSafe();

  if (error) {
    guardMsg.textContent = 'Erro ao ler sessão: ' + error;
    showHint(
      `Dica: abra o site por <b>http://</b> (Live Server / GitHub Pages), não por <b>file://</b>.`
    );
    throw new Error(error);
  }

  if (!session) {
    guardMsg.textContent = 'Você não está logado(a). Indo para o login...';
    setPill('Sem sessão');
    redirectTo('login.html?next=admin.html');
    return null;
  }

  const uid = session.user.id;
  log(`Sessão OK. uid=${uid}`);

  log('Buscando role no profiles...');
  let profile = null;

  try {
    profile = await getMyRole(uid);
  } catch (e) {
    guardMsg.textContent = 'Não consegui ler seu perfil no banco (profiles).';
    setPill('Falha ao verificar');

    showHint(`
      <b>Provável causa:</b> RLS/policy do <code>profiles</code> bloqueando SELECT com anon key.<br/>
      Cole no Supabase as policies sugeridas (profiles_select_own).<br/><br/>
      <b>Erro:</b> <code>${e.message}</code>
    `);

    throw e;
  }

  if (!profile) {
    guardMsg.textContent = 'Seu perfil não foi encontrado na tabela profiles.';
    setPill('Perfil ausente');
    showHint(`
      <b>Provável causa:</b> o <code>profiles.id</code> não bate com o UID do Auth.<br/>
      Vá em <b>Authentication → Users</b>, copie o UID e crie/ajuste o registro na tabela <code>profiles</code>.
    `);
    return null;
  }

  log(`Perfil encontrado. role=${profile.role}`);
  if (profile.role !== 'admin') {
    guardMsg.textContent = 'Acesso negado: seu usuário não é admin.';
    setPill('Acesso negado');
    showHint(`Você será redirecionado(a) para o App.`);
    setTimeout(() => redirectTo('app.html'), 900);
    return null;
  }

  // OK admin
  setPill('Acesso autorizado');
  guardBox.style.display = 'none';
  content.style.display = 'grid';
  return profile;
}

async function loadStats() {
  // counts
  const usersQ = supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true });
  const coursesQ = supabase
    .from('courses')
    .select('id', { count: 'exact', head: true });
  const offersQ = supabase
    .from('course_offers')
    .select('id', { count: 'exact', head: true });

  const [u, c, o] = await Promise.allSettled([usersQ, coursesQ, offersQ]);

  statUsers.textContent = u.status === 'fulfilled' ? u.value.count ?? '—' : '—';
  statCourses.textContent =
    c.status === 'fulfilled' ? c.value.count ?? '—' : '—';
  statOffers.textContent =
    o.status === 'fulfilled' ? o.value.count ?? '—' : '—';
}

function renderUsers(rows) {
  usersTableBody.innerHTML = '';
  if (!rows || rows.length === 0) {
    usersEmpty.style.display = 'block';
    return;
  }
  usersEmpty.style.display = 'none';

  for (const r of rows) {
    const tr = document.createElement('tr');

    const name = r.name || '—';
    const email = r.email || '—';
    const role = r.role || 'aluno';

    tr.innerHTML = `
      <td>${escapeHtml(name)}</td>
      <td>${escapeHtml(email)}</td>
      <td>
        <select class="input" data-role-select="1" data-id="${r.id}">
          <option value="aluno" ${
            role === 'aluno' ? 'selected' : ''
          }>aluno</option>
          <option value="admin" ${
            role === 'admin' ? 'selected' : ''
          }>admin</option>
        </select>
      </td>
      <td>
        <button class="btn ghost" data-save-role="1" data-id="${r.id}">
          <i class="bx bx-check"></i> Salvar
        </button>
      </td>
    `;

    usersTableBody.appendChild(tr);
  }
}

function renderCourses(rows) {
  coursesTableBody.innerHTML = '';
  if (!rows || rows.length === 0) {
    coursesEmpty.style.display = 'block';
    return;
  }
  coursesEmpty.style.display = 'none';

  for (const r of rows) {
    const tr = document.createElement('tr');

    const title = r.title || '—';
    const type = r.type || r.course_type || '';
    const desc = r.description || '';

    tr.innerHTML = `
      <td><b>${escapeHtml(title)}</b></td>
      <td>${escapeHtml(type || '—')}</td>
      <td class="muted">${escapeHtml(desc || '—')}</td>
      <td>
        <button class="btn ghost" data-del-course="1" data-id="${r.id}">
          <i class="bx bx-trash"></i> Excluir
        </button>
      </td>
    `;

    coursesTableBody.appendChild(tr);
  }
}

async function loadUsers() {
  log('Carregando usuários...');
  const { data, error } = await supabase
    .from('profiles')
    .select('id,name,email,role')
    .order('email', { ascending: true });

  if (error) throw new Error(error.message);
  renderUsers(data || []);
}

async function loadCourses() {
  log('Carregando cursos...');
  const { data, error } = await supabase
    .from('courses')
    .select('id,title,description,type')
    .order('title', { ascending: true });

  if (error) {
    // fallback se não existir coluna "type"
    log('Falhou select com type, tentando fallback sem type...');
    const r2 = await supabase
      .from('courses')
      .select('id,title,description')
      .order('title', { ascending: true });

    if (r2.error) throw new Error(r2.error.message);
    // normaliza para render
    renderCourses((r2.data || []).map((x) => ({ ...x, type: '' })));
    return;
  }

  renderCourses(data || []);
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function onSaveRole(userId, newRole) {
  log(`Atualizando role do usuário ${userId} -> ${newRole}`);
  const { error } = await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId);

  if (error) throw new Error(error.message);
}

async function onCreateCourse(payload) {
  log('Criando curso...');
  const { data, error } = await supabase
    .from('courses')
    .insert(payload)
    .select('id,title,description,type')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

async function onDeleteCourse(id) {
  log(`Excluindo curso ${id}`);
  const { error } = await supabase.from('courses').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

function bindEvents() {
  usersTableBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-save-role="1"]');
    if (!btn) return;

    const id = btn.getAttribute('data-id');
    const sel = usersTableBody.querySelector(`select[data-id="${id}"]`);
    const role = sel?.value || 'aluno';

    btn.disabled = true;
    try {
      await onSaveRole(id, role);
      log('Role atualizada com sucesso.');
    } catch (err) {
      log('ERRO role: ' + err.message);
      alert('Erro ao salvar role: ' + err.message);
    } finally {
      btn.disabled = false;
    }
  });

  courseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    courseMsg.textContent = '';
    const title = courseTitle.value.trim();
    const type = courseType.value.trim();
    const description = courseDesc.value.trim();

    const payload = { title };
    if (description) payload.description = description;
    if (type) payload.type = type; // se a coluna existir

    const btn = document.getElementById('course-save');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
      await onCreateCourse(payload);
      courseTitle.value = '';
      courseType.value = '';
      courseDesc.value = '';
      courseMsg.textContent = '✅ Curso salvo.';
      await loadStats();
      await loadCourses();
    } catch (err) {
      log('ERRO curso: ' + err.message);
      courseMsg.textContent = '❌ ' + err.message;
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="bx bx-save"></i> Salvar curso`;
    }
  });

  coursesTableBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-del-course="1"]');
    if (!btn) return;

    const id = btn.getAttribute('data-id');
    if (!confirm('Excluir este curso?')) return;

    btn.disabled = true;
    try {
      await onDeleteCourse(id);
      await loadStats();
      await loadCourses();
    } catch (err) {
      log('ERRO delete curso: ' + err.message);
      alert('Erro ao excluir: ' + err.message);
    } finally {
      btn.disabled = false;
    }
  });
}

async function main() {
  try {
    const profile = await guardAdmin();
    if (!profile) return;

    log('Admin OK. Carregando dados...');
    bindEvents();

    await loadStats();
    await loadUsers();
    await loadCourses();

    log('Pronto.');
  } catch (e) {
    log('FALHA: ' + (e?.message || String(e)));
  }
}

main();
