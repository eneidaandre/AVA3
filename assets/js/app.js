import { supabase } from './supabaseClient.js';

const LAYOUT_URL = './assets/chrome.html';

async function initChrome() {
  ensureSlot('site-header');
  ensureSlot('site-sidebar');
  ensureSlot('site-footer');

  try {
    const res = await fetch(LAYOUT_URL);
    if (!res.ok) throw new Error('Menu error');
    const text = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');

    inject('site-header', doc, 'header');
    inject('site-sidebar', doc, 'sidebar');
    inject('site-footer', doc, 'footer');

    document.body.classList.add('has-sidebar');
    restoreState();

    await checkAuth(); 
    supabase.auth.onAuthStateChange(() => checkAuth());

    loadMyCourses();

  } catch (err) {
    console.error(err);
  }
}

async function loadMyCourses() {
    const container = document.getElementById('app-root');
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: enrollments, error } = await supabase
        .from('class_enrollments')
        .select(`
            *,
            classes (
                id, name, code,
                courses (title, description, image_url)
            )
        `)
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false });

    if (error) {
        container.innerHTML = `<div class="alert alert-danger">Erro: ${error.message}</div>`;
        return;
    }

    if (!enrollments || enrollments.length === 0) {
        container.innerHTML = `<div class="text-center py-5 text-muted"><h4>Nenhum curso.</h4></div>`;
        return;
    }

    container.innerHTML = '<div class="row g-4" id="courses-grid"></div>';
    const grid = document.getElementById('courses-grid');

    enrollments.forEach(enroll => {
        const cls = enroll.classes;
        const course = cls.courses;
        const progress = enroll.progress_percent || 0;
        
        let footerHtml = '';
        if (enroll.status === 'active') {
            // CORREÇÃO: Garante que o link use 'id'
            footerHtml = `<a href="classroom.html?id=${cls.id}" class="btn btn-primary w-100">Acessar Aula</a>`;
        } else {
            footerHtml = `<button class="btn btn-secondary w-100" disabled>${enroll.status}</button>`;
        }

        const col = document.createElement('div');
        col.className = 'col-md-4';
        col.innerHTML = `
            <div class="card h-100 shadow-sm">
                <div class="card-body">
                    <h5 class="card-title fw-bold">${course.title}</h5>
                    <p class="card-text text-muted small">${cls.name}</p>
                    <div class="progress mb-3" style="height: 5px;">
                        <div class="progress-bar" style="width: ${progress}%"></div>
                    </div>
                    ${footerHtml}
                </div>
            </div>
        `;
        grid.appendChild(col);
    });
}

// --- AUTH ---
async function checkAuth() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        document.getElementById('auth-actions').style.display = 'block';
        document.getElementById('user-pill').style.display = 'none';
        return;
    }
    
    document.getElementById('auth-actions').style.display = 'none';
    const userPill = document.getElementById('user-pill');
    if(userPill) userPill.style.display = 'flex';
    if(document.getElementById('user-name')) document.getElementById('user-name').textContent = session.user.email;

    // Admin Check
    const { data: rows } = await supabase.from('profiles').select('role').eq('id', session.user.id).limit(1);
    if (rows && rows[0] && rows[0].role === 'admin') {
        if(document.getElementById('link-admin')) document.getElementById('link-admin').style.display = 'block';
        if(document.getElementById('sidebar-admin-group')) document.getElementById('sidebar-admin-group').style.display = 'block';
    }
  } catch (e) { console.error(e); }
}

function ensureSlot(id) {
  if (!document.getElementById(id)) {
    const div = document.createElement('div');
    div.id = id;
    document.body.appendChild(div);
  }
}
function inject(id, doc, slot) {
  const el = document.getElementById(id);
  const content = doc.querySelector(`[data-slot="${slot}"]`);
  if (el && content) el.innerHTML = content.innerHTML;
}
function restoreState() {
  const btn = document.getElementById('sidebar-toggle');
  if (btn) btn.onclick = () => document.body.classList.toggle('sidebar-collapsed');
}

initChrome();