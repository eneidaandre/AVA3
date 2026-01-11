// assets/js/admin.js
import { supabase, getSessionSafe } from './supabaseClient.js';
import { goTo } from './router.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function showMsg(type, text) {
  const el = $('#adminMsg');
  if (!el) return;
  el.hidden = false;
  el.classList.remove('ok', 'err');
  if (type === 'ok') el.classList.add('ok');
  if (type === 'err') el.classList.add('err');
  el.textContent = text;
}

function setStatus(text) {
  const el = $('#adminStatus');
  if (el) el.textContent = text;
}

function showAdminUI(show) {
  const cards = $('#adminCards');
  const panels = $('#adminPanels');
  if (cards) cards.hidden = !show;
  if (panels) panels.hidden = !show;
}

function hideAllPanels() {
  $$('#adminPanels .admin-panel').forEach((p) => (p.hidden = true));
}

function openPanel(key) {
  hideAllPanels();

  const map = {
    courses: '#panel-courses',
    'courses-new': '#panel-courses-new',
    users: '#panel-users',
    offers: '#panel-offers',
  };

  const sel = map[key];
  const el = sel ? $(sel) : null;
  if (el) el.hidden = false;
}

/**
 * Verifica admin:
 * 1) tenta RPC is_admin({uid}) com nomes de parâmetros diferentes (comum dar mismatch)
 * 2) fallback: consulta profiles.role do próprio usuário
 */
async function checkIsAdmin(uid) {
  // 1) RPC
  const tries = [{ uid }, { user_id: uid }, { p_uid: uid }];
  for (const args of tries) {
    try {
      const { data, error } = await supabase.rpc('is_admin', args);
      if (!error) return !!data;
    } catch (_) {}
  }

  // 2) fallback: profiles.role
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

async function countTable(table) {
  try {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) return null;
    return typeof count === 'number' ? count : null;
  } catch (_) {
    return null;
  }
}

async function loadKPIs() {
  const c = await countTable('courses');
  const u = await countTable('profiles');

  // offers: tenta tabela e view (se existir)
  const o =
    (await countTable('course_offers')) ??
    (await countTable('v_course_offers_full'));

  if ($('#kpiCourses')) $('#kpiCourses').textContent = c ?? '—';
  if ($('#kpiUsers')) $('#kpiUsers').textContent = u ?? '—';
  if ($('#kpiOffers')) $('#kpiOffers').textContent = o ?? '—';
}

/* ---------- Helpers tabela ---------- */
function clearTbody(idSel) {
  const tb = $(idSel);
  if (!tb) return;
  while (tb.firstChild) tb.removeChild(tb.firstChild);
}

function td(text) {
  const el = document.createElement('td');
  el.textContent = text ?? '';
  return el;
}

function btn(label, className = 'btn') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.textContent = label;
  return b;
}

/* ---------- Cursos ---------- */
async function loadCourses() {
  clearTbody('#coursesTbody');
  const tb = $('#coursesTbody');
  if (!tb) return;

  const { data, error } = await supabase
    .from('courses')
    .select('id, title, description, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    showMsg(
      'err',
      'Não consegui listar cursos. Verifique RLS/Policies da tabela courses.'
    );
    return;
  }

  if (!data?.length) {
    const tr = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 3;
    cell.textContent = 'Nenhum curso cadastrado.';
    tr.appendChild(cell);
    tb.appendChild(tr);
    return;
  }

  data.forEach((c) => {
    const tr = document.createElement('tr');

    tr.appendChild(td(c.title || ''));

    const desc = (c.description || '').toString();
    tr.appendChild(td(desc.length > 140 ? desc.slice(0, 140) + '…' : desc));

    const actions = document.createElement('td');
    actions.style.whiteSpace = 'nowrap';

    const edit = btn('Editar');
    edit.disabled = true; // você pediu por etapas: depois fazemos editar
    actions.appendChild(edit);

    tr.appendChild(actions);
    tb.appendChild(tr);
  });
}

async function bindCourseForm() {
  const form = $('#courseForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = ($('#c_title')?.value || '').trim();
    const description = ($('#c_desc')?.value || '').trim();

    if (!title) {
      showMsg('err', 'Informe o título do curso.');
      return;
    }

    const payload = { title };
    if (description) payload.description = description;

    const { error } = await supabase.from('courses').insert(payload);

    if (error) {
      showMsg(
        'err',
        'Erro ao salvar curso. Verifique policies (insert) em courses.'
      );
      return;
    }

    showMsg('ok', 'Curso cadastrado com sucesso!');
    form.reset();

    await loadKPIs();
    openPanel('courses');
    await loadCourses();
  });
}

/* ---------- Usuários ---------- */
async function loadUsers() {
  clearTbody('#usersTbody');
  const tb = $('#usersTbody');
  if (!tb) return;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, role')
    .order('name', { ascending: true })
    .limit(300);

  if (error) {
    showMsg(
      'err',
      'Não consegui listar usuários. Verifique policies (select) em profiles.'
    );
    return;
  }

  const rows = data || [];

  const render = (list) => {
    clearTbody('#usersTbody');

    if (!list.length) {
      const tr = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 4;
      cell.textContent = 'Nenhum usuário encontrado.';
      tr.appendChild(cell);
      tb.appendChild(tr);
      return;
    }

    list.forEach((u) => {
      const tr = document.createElement('tr');

      tr.appendChild(td(u.name || ''));
      tr.appendChild(td(u.email || ''));

      const roleCell = document.createElement('td');
      const sel = document.createElement('select');
      sel.style.padding = '10px 12px';
      sel.style.borderRadius = '12px';
      sel.style.border = '1px solid var(--line)';
      sel.style.background = 'var(--surface)';

      const curRole = String(u.role || '').toLowerCase();
      sel.add(new Option('aluno', 'aluno', false, curRole === 'aluno'));
      sel.add(new Option('admin', 'admin', false, curRole === 'admin'));

      roleCell.appendChild(sel);
      tr.appendChild(roleCell);

      const actions = document.createElement('td');
      const save = btn('Salvar', 'btn primary');

      save.onclick = async () => {
        const role = sel.value;

        const { error } = await supabase
          .from('profiles')
          .update({ role })
          .eq('id', u.id);

        if (error) {
          showMsg(
            'err',
            'Erro ao salvar role. Verifique policies (update) em profiles.'
          );
          return;
        }

        showMsg('ok', 'Permissão atualizada.');
        await loadKPIs();
      };

      actions.appendChild(save);
      tr.appendChild(actions);

      tb.appendChild(tr);
    });
  };

  render(rows);

  const search = $('#userSearch');
  if (search) {
    search.oninput = () => {
      const q = search.value.trim().toLowerCase();
      if (!q) return render(rows);

      render(
        rows.filter((u) => {
          const n = String(u.name || '').toLowerCase();
          const e = String(u.email || '').toLowerCase();
          return n.includes(q) || e.includes(q);
        })
      );
    };
  }
}

/* ---------- Turmas ---------- */
async function loadOffers() {
  clearTbody('#offersTbody');
  const tb = $('#offersTbody');
  if (!tb) return;

  const sources = ['v_course_offers_full', 'course_offers'];

  for (const src of sources) {
    const { data, error } = await supabase.from(src).select('*').limit(80);
    if (error) continue;

    const rows = data || [];

    if (!rows.length) {
      const tr = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 5;
      cell.textContent = 'Nenhuma turma encontrada.';
      tr.appendChild(cell);
      tb.appendChild(tr);
      return;
    }

    rows.forEach((r) => {
      const tr = document.createElement('tr');
      tr.appendChild(td(r.id ?? ''));

      const courseLabel =
        r.course_title || r.title || r.course_name || r.course_id || '';
      tr.appendChild(td(String(courseLabel)));

      tr.appendChild(td(r.status ?? ''));
      tr.appendChild(td(r.start_date ?? r.start_at ?? ''));
      tr.appendChild(td(r.end_date ?? r.end_at ?? ''));

      tb.appendChild(tr);
    });

    return;
  }

  showMsg(
    'err',
    'Não consegui listar turmas. Verifique view/tabela e policies.'
  );
}

/* ---------- Binds UI ---------- */
function bindNavButtons() {
  $$('[data-admin-open]').forEach((b) => {
    b.addEventListener('click', async () => {
      const key = b.getAttribute('data-admin-open');
      openPanel(key);

      if (key === 'courses') await loadCourses();
      if (key === 'users') await loadUsers();
      if (key === 'offers') await loadOffers();
    });
  });

  $('#btnReloadCourses')?.addEventListener('click', loadCourses);
  $('#btnReloadUsers')?.addEventListener('click', loadUsers);
  $('#btnReloadOffers')?.addEventListener('click', loadOffers);
}

/* ---------- Init ---------- */
async function init() {
  setStatus('Verificando acesso…');
  showAdminUI(false);

  const { session } = await getSessionSafe();
  if (!session) {
    showMsg('err', 'Você precisa entrar para acessar a área administrativa.');
    goTo('login.html');
    return;
  }

  const uid = session.user?.id;
  const isAdmin = await checkIsAdmin(uid);

  if (!isAdmin) {
    setStatus('Acesso negado');
    showMsg('err', 'Seu usuário não é admin. Você será redirecionada.');
    setTimeout(() => goTo('app.html'), 900);
    return;
  }

  setStatus('Acesso autorizado');
  showAdminUI(true);

  bindNavButtons();
  await bindCourseForm();

  await loadKPIs();

  // padrão: abre lista de cursos
  openPanel('courses');
  await loadCourses();
}

init();
