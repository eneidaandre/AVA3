import { supabase } from './supabaseClient.js';

let modalCourse = null;

async function initAdminPage() {
    console.log("🚀 Admin JS Iniciado");

    const modalEl = document.getElementById('modalCourse');
    if (modalEl && window.bootstrap) {
        modalCourse = new window.bootstrap.Modal(modalEl);
    }

    setupCourseForm();

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { window.location.href = 'login.html'; return; }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .maybeSingle();

        const role = profile?.role ? String(profile.role).toLowerCase().trim() : 'aluno';

        if (role !== 'admin') {
            // CORREÇÃO AQUI: Redireciona para index.html em vez de dashboard.html
            document.getElementById('admin-status').textContent = "Acesso Negado";
            document.getElementById('admin-status').className = "badge bg-danger";
            setTimeout(() => window.location.href = 'index.html', 1500); 
            return;
        }

        // Sucesso
        document.getElementById('admin-status').textContent = "Admin Conectado";
        document.getElementById('admin-status').className = "badge bg-success";
        document.getElementById('loading-spinner').style.display = 'none';
        document.getElementById('admin-dashboard').style.display = 'block';

        loadCounts();
        loadLists();

    } catch (err) {
        console.error("Erro Admin:", err);
    }
}

// ... (O RESTO DO CÓDIGO PERMANECE IGUAL) ...
// Copie o resto das funções (window.showPanel, setupCourseForm, etc) que te passei antes.
// Se quiser, posso reenviar o arquivo inteiro para garantir.

// === APENAS PARA COMPLETAR O ARQUIVO (Copie o resto abaixo) ===

window.showPanel = function(panelId) {
    document.querySelectorAll('.admin-panel').forEach(el => el.style.display = 'none');
    const target = document.getElementById('panel-' + panelId);
    if(target) target.style.display = 'block';
    
    const titles = { 'courses': 'Gerenciar Cursos', 'users': 'Gerenciar Usuários', 'offers': 'Gerenciar Turmas' };
    const titleEl = document.getElementById('panel-title');
    if(titleEl) titleEl.textContent = titles[panelId] || 'Visão Geral';
};

window.openNewCourseModal = function() {
    if (modalCourse) modalCourse.show();
}

function setupCourseForm() {
    const form = document.getElementById('formCourse');
    const titleInp = document.getElementById('course_title');
    const slugInp = document.getElementById('course_slug');

    if (titleInp && slugInp) {
        titleInp.addEventListener('input', () => {
            slugInp.value = titleInp.value.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const newCourse = {
                title: document.getElementById('course_title').value,
                slug: document.getElementById('course_slug').value || null,
                description: document.getElementById('course_desc').value,
                total_hours: parseFloat(document.getElementById('course_hours').value) || null,
                carga_horaria_horas: parseFloat(document.getElementById('course_hours').value) || null,
                status: document.getElementById('course_status').value,
                tipo: document.getElementById('course_type').value,
                status_inscricao: document.getElementById('course_enroll_status').value,
                image_url: document.getElementById('course_img').value,
            };

            const { data: { user } } = await supabase.auth.getUser();
            if (user) newCourse.created_by = user.id;

            const { error } = await supabase.from('courses').insert(newCourse);

            if (error) {
                alert("Erro ao salvar: " + error.message);
            } else {
                alert("Curso criado com sucesso!");
                form.reset(); 
                if (modalCourse) modalCourse.hide();
                loadCounts(); 
                loadLists(); 
            }
        });
    }
}

async function loadCounts() {
    const { count: courses } = await supabase.from('courses').select('*', { count: 'exact', head: true });
    document.getElementById('count-courses').textContent = courses || 0;
    
    const { count: users } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    document.getElementById('count-users').textContent = users || 0;
}

async function loadLists() {
    const tbody = document.getElementById('table-courses');
    const template = document.getElementById('template-course-row'); 
    tbody.innerHTML = ''; 

    const { data: courses } = await supabase
        .from('courses')
        .select('*')
        .order('id', { ascending: false })
        .limit(20);

    if (courses && courses.length > 0) {
        courses.forEach(c => {
            const clone = template.content.cloneNode(true);
            clone.querySelector('.row-id').textContent = `#${c.id}`;
            clone.querySelector('.row-title').textContent = c.title;
            clone.querySelector('.row-subtitle').textContent = `${c.tipo || 'OUTRO'} • ${c.carga_horaria_horas || 0}h`;
            
            const badge = clone.querySelector('.row-status');
            badge.textContent = c.status === 'published' ? 'Publicado' : 'Rascunho';
            badge.className = `badge row-status ${c.status === 'published' ? 'bg-success' : 'bg-secondary'}`;

            const btnEdit = clone.querySelector('.edit-btn');
            btnEdit.onclick = function() {
                window.location.href = 'course-editor.html?id=' + c.id;
            };

            tbody.appendChild(clone);
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">Nenhum curso encontrado.</td></tr>';
    }

    const tbodyUsers = document.getElementById('table-users');
    const templateUser = document.getElementById('template-user-row');
    tbodyUsers.innerHTML = '';
    
    const { data: users } = await supabase.from('profiles').select('*').limit(5);
    if(users) {
        users.forEach(u => {
            const clone = templateUser.content.cloneNode(true);
            clone.querySelector('.user-name').textContent = u.name || 'Sem nome';
            clone.querySelector('.user-email').textContent = u.email;
            clone.querySelector('.user-role').textContent = u.role || 'aluno';
            tbodyUsers.appendChild(clone);
        });
    }
}

initAdminPage();