import { supabase } from './supabaseClient.js';

const params = new URLSearchParams(window.location.search);
const classId = params.get('id') || params.get('classId');

let currentClassData = null; 
let staffMembers = []; // Cache para o dropdown de tarefas

document.addEventListener('DOMContentLoaded', async () => {
    if (!classId) {
        alert("ID da turma não encontrado.");
        window.location.href = 'class-manager.html';
        return;
    }
    await checkAuth();
    
    await loadClassHeader();
    await loadStudents(); // Carrega alunos e popula staff
    loadPosts(); 
    loadTeamTasks(); // Carrega tasks para atualizar o badge (sininho)
});

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) window.location.href = 'login.html';
}

// 1. HEADER
async function loadClassHeader() {
    const { data: cls, error } = await supabase
        .from('classes')
        .select(`*, courses (title)`)
        .eq('id', classId)
        .single();

    if (error) { console.error(error); return; }
    currentClassData = cls;

    document.getElementById('dash-class-name').textContent = cls.name;
    document.getElementById('dash-course-name').textContent = cls.courses?.title || 'Curso Base';
    document.getElementById('dash-code').textContent = cls.code || 'S/ CÓDIGO';
    
    if (cls.start_date) {
        const d1 = new Date(cls.start_date).toLocaleDateString();
        const d2 = cls.end_date ? new Date(cls.end_date).toLocaleDateString() : '?';
        document.getElementById('dash-dates').innerHTML = `<i class='bx bx-calendar'></i> ${d1} até ${d2}`;
    }
    if (cls.whatsapp_link) {
        const btn = document.getElementById('dash-whatsapp');
        btn.href = cls.whatsapp_link;
        btn.style.display = 'inline-flex';
    }
    
    // Preencher Modal Edição
    document.getElementById('edit_class_name').value = cls.name;
    document.getElementById('edit_class_code').value = cls.code || '';
    const dFmt = (d) => d ? d.split('T')[0] : '';
    document.getElementById('edit_start_date').value = dFmt(cls.start_date);
    document.getElementById('edit_end_date').value = dFmt(cls.end_date);
    document.getElementById('edit_enrollment_start').value = dFmt(cls.enrollment_start);
    document.getElementById('edit_enrollment_deadline').value = dFmt(cls.enrollment_deadline);
    if(document.getElementById('edit_enrollment_open')) document.getElementById('edit_enrollment_open').checked = cls.enrollment_open;
    if(document.getElementById('edit_is_hidden')) document.getElementById('edit_is_hidden').checked = cls.is_hidden;
}

// 2. ALUNOS & STAFF
async function loadStudents() {
    const tbody = document.getElementById('students-table-body');
    const empty = document.getElementById('students-empty');
    
    const { data: enrolls, error } = await supabase
        .from('class_enrollments')
        .select(`id, status, joined_at, progress_percent, profiles (id, name, email, role)`)
        .eq('class_id', classId)
        .order('joined_at', { ascending: false });

    if (error) return;

    document.getElementById('dash-total-students').textContent = enrolls.length;
    tbody.innerHTML = '';
    staffMembers = []; // Limpa cache
    
    if (enrolls.length === 0) {
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    const tpl = document.getElementById('tpl-student-row');

    enrolls.forEach(row => {
        const clone = tpl.content.cloneNode(true);
        const profile = row.profiles || {};
        const name = profile.name || 'Sem nome';
        const role = profile.role || 'aluno';

        // Popula Staff se não for aluno
        if (role !== 'aluno') staffMembers.push({ id: profile.id, name: name, role: role });

        const initials = name.substring(0,2).toUpperCase();
        clone.querySelector('.student-avatar').textContent = initials;
        clone.querySelector('.student-name').textContent = name;
        clone.querySelector('.student-email').textContent = profile.email || '---';
        
        const badge = clone.querySelector('.student-status');
        badge.textContent = translateStatus(row.status);
        badge.className = `badge rounded-pill ${getStatusClass(row.status)}`;

        clone.querySelector('.student-progress-bar').style.width = `${row.progress_percent || 0}%`;
        clone.querySelector('.student-progress-text').textContent = `${row.progress_percent || 0}%`;
        clone.querySelector('.student-date').textContent = new Date(row.joined_at).toLocaleDateString();

        if (row.status === 'pending') {
            const btn = clone.querySelector('.btn-approve');
            btn.style.display = 'inline-block';
            btn.onclick = () => updateEnrollmentStatus(row.id, 'active');
        }
        clone.querySelector('.btn-remove').onclick = () => removeStudent(row.id);

        // --- CORREÇÃO VISUAL: BOTÃO PERFIL (Outline azul, fundo transparente) ---
        const roleBtn = clone.querySelector('.profile-role-btn');
        const roleMap = { 'aluno': '🎓 Estudante', 'professor': '👨‍🏫 Professor', 'tutor': '🤝 Tutor', 'gerente': '🏗️ Gerente', 'admin': '⚡ Admin' };
        roleBtn.textContent = roleMap[role] || role;
        
        // Remove classes de cor sólida se existirem e garante o outline
        roleBtn.className = 'btn btn-sm btn-outline-primary dropdown-toggle profile-role-btn fw-bold';
        
        // Se for admin/gerente, dar um destaque extra sutil opcional (mantendo outline)
        if(role === 'admin' || role === 'gerente') {
            roleBtn.style.borderWidth = '2px'; 
        }

        clone.querySelectorAll('.dropdown-item[data-role]').forEach(item => {
            item.onclick = (e) => { e.preventDefault(); changeUserRole(profile.id, item.dataset.role); };
        });

        tbody.appendChild(clone);
    });

    populateStaffSelect();
}

function populateStaffSelect() {
    const select = document.getElementById('team_task_assignee');
    if(!select) return;
    
    // Mantém a primeira opção (Geral)
    select.innerHTML = '<option value="">Para: Equipe Geral</option>';
    
    staffMembers.forEach(member => {
        const opt = document.createElement('option');
        opt.value = member.name; // Salvamos o nome para facilitar exibição
        opt.textContent = `${member.name} (${member.role})`;
        select.appendChild(opt);
    });
}

async function changeUserRole(userId, newRole) {
    if(!confirm(`Mudar perfil para ${newRole}?`)) return;
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) alert("Erro: " + error.message);
    else { loadStudents(); }
}

// 3. MURAL
async function loadPosts() {
    const container = document.getElementById('posts-feed');
    const { data: posts, error } = await supabase
        .from('class_posts')
        .select('*')
        .eq('class_id', classId)
        .neq('type', 'INTERNAL') 
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) return;
    container.innerHTML = '';
    
    if (!posts || posts.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-5"><i class="bx bx-news fs-1"></i><p>Mural vazio.</p></div>';
        return;
    }

    const tpl = document.getElementById('tpl-post-card');
    posts.forEach(post => {
        const clone = tpl.content.cloneNode(true);
        clone.querySelector('.post-card').classList.add(`post-${post.type}`);
        clone.querySelector('.post-title').textContent = post.title;
        clone.querySelector('.post-content').textContent = post.content || '';
        const badge = clone.querySelector('.post-badge');
        badge.textContent = post.type;
        const bgMap = { 'AVISO': 'warning text-dark', 'MATERIAL': 'primary', 'EVENTO': 'success' };
        badge.className = `badge bg-${bgMap[post.type] || 'secondary'}`;

        if (post.is_pinned) clone.querySelector('.post-title').innerHTML = `<i class='bx bx-pin text-danger'></i> ${post.title}`;
        if (post.resource_url) {
            const lnk = clone.querySelector('.post-link');
            lnk.href = post.resource_url;
            lnk.style.display = 'inline-flex';
        }
        clone.querySelector('.btn-delete-post').onclick = async () => {
            if(confirm("Excluir?")) {
                await supabase.from('class_posts').delete().eq('id', post.id);
                loadPosts();
            }
        };
        container.appendChild(clone);
    });
}

// 4. TAREFAS DA EQUIPE
window.loadTeamTasks = async function() {
    const container = document.getElementById('team-tasks-list');
    if(container) container.innerHTML = '<div class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></div>';

    const { data: tasks, error } = await supabase
        .from('class_posts')
        .select('*')
        .eq('class_id', classId)
        .eq('type', 'INTERNAL')
        .order('created_at', { ascending: false });

    if (error) return;
    
    // Atualiza Badge de Notificação
    const pendingCount = tasks.filter(t => !t.is_pinned).length; // is_pinned usado como 'concluído'
    const badge = document.getElementById('team-notification-badge');
    if (badge) {
        badge.textContent = pendingCount;
        badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
    }

    // Se estiver na aba, renderiza a lista
    if (container) {
        container.innerHTML = '';
        if (!tasks || tasks.length === 0) {
            container.innerHTML = `<div class="text-center text-muted py-5 border rounded border-dashed"><i class="bx bx-check-double fs-1"></i><p class="mb-0">Nenhuma pendência.</p></div>`;
            return;
        }

        const tpl = document.getElementById('tpl-team-task');
        tasks.forEach(task => {
            const clone = tpl.content.cloneNode(true);
            const card = clone.querySelector('.task-internal-item');
            const check = clone.querySelector('.task-check');
            const text = clone.querySelector('.task-text');
            const assigneeEl = clone.querySelector('.task-assignee');

            text.textContent = task.title; 
            clone.querySelector('.task-meta').textContent = new Date(task.created_at).toLocaleDateString();
            
            // O campo 'content' guarda o nome do responsável
            if(task.content && task.content !== 'Task Interna') {
                assigneeEl.innerHTML = `<i class='bx bx-user'></i> ${task.content}`;
            }

            check.checked = task.is_pinned;
            if (task.is_pinned) card.classList.add('done');

            check.onchange = async () => {
                const isDone = check.checked;
                isDone ? card.classList.add('done') : card.classList.remove('done');
                await supabase.from('class_posts').update({ is_pinned: isDone }).eq('id', task.id);
                // Atualiza contagem
                window.loadTeamTasks(); 
            };

            clone.querySelector('.btn-delete-task').onclick = async () => {
                if(confirm("Apagar nota?")) {
                    await supabase.from('class_posts').delete().eq('id', task.id);
                    window.loadTeamTasks();
                }
            };
            container.appendChild(clone);
        });
    }
};

const formTeamTask = document.getElementById('formTeamTask');
if(formTeamTask) {
    formTeamTask.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('team_task_input');
        const select = document.getElementById('team_task_assignee');
        const text = input.value.trim();
        const assignee = select.value || 'Equipe Geral';

        if (!text) return;

        const { error } = await supabase.from('class_posts').insert({
            class_id: classId,
            type: 'INTERNAL',
            title: text,
            content: assignee, // Salva o nome do responsável aqui
            is_pinned: false
        });

        if (error) alert("Erro: " + error.message);
        else {
            input.value = '';
            window.loadTeamTasks();
        }
    });
}

// 5. MODAL EDIÇÃO
window.openEditClassModal = function() { new bootstrap.Modal(document.getElementById('modalEditClass')).show(); };
window.openCertificates = function() { alert("Em breve."); };
window.deleteClass = async function() {
    if(!confirm("Excluir turma e todos os dados?")) return;
    await supabase.from('class_enrollments').delete().eq('class_id', classId);
    await supabase.from('class_posts').delete().eq('class_id', classId);
    await supabase.from('classes').delete().eq('id', classId);
    window.location.href = 'class-manager.html';
};
const formEditClass = document.getElementById('formEditClass');
if(formEditClass) {
    formEditClass.addEventListener('submit', async (e) => {
        e.preventDefault();
        const updates = {
            name: document.getElementById('edit_class_name').value,
            start_date: document.getElementById('edit_start_date').value || null,
            end_date: document.getElementById('edit_end_date').value || null,
            enrollment_start: document.getElementById('edit_enrollment_start').value || null,
            enrollment_deadline: document.getElementById('edit_enrollment_deadline').value || null,
            enrollment_open: document.getElementById('edit_enrollment_open').checked,
            is_hidden: document.getElementById('edit_is_hidden').checked
        };
        await supabase.from('classes').update(updates).eq('id', classId);
        bootstrap.Modal.getInstance(document.getElementById('modalEditClass')).hide();
        loadClassHeader();
    });
}

// 6. MATRÍCULA
window.openAddStudentModal = function() {
    document.getElementById('search-student-input').value = '';
    document.getElementById('student-search-results-list').innerHTML = '<div class="text-center py-4 text-muted small border rounded bg-white">Digite...</div>';
    document.getElementById('search-status').textContent = '';
    new bootstrap.Modal(document.getElementById('modalAddStudent')).show();
};
window.searchStudentToEnroll = async function() {
    const term = document.getElementById('search-student-input').value.trim();
    if(term.length < 3) return;
    const list = document.getElementById('student-search-results-list');
    list.innerHTML = '...';
    const { data: users } = await supabase.from('profiles').select('id, name, email').or(`name.ilike.%${term}%,email.ilike.%${term}%`).limit(5);
    list.innerHTML = '';
    if(!users?.length) { list.innerHTML = 'Nada encontrado'; return; }
    users.forEach(u => {
        const div = document.createElement('div');
        div.className = 'card border p-2 d-flex flex-row justify-content-between align-items-center mb-1';
        div.innerHTML = `<div><strong>${u.name}</strong><br><small>${u.email}</small></div><button class="btn btn-sm btn-outline-primary" onclick="window.confirmEnroll('${u.id}', this)">+</button>`;
        list.appendChild(div);
    });
};
window.confirmEnroll = async function(uid, btn) {
    btn.disabled = true;
    const { error } = await supabase.from('class_enrollments').insert({ class_id: classId, user_id: uid, status: 'active', progress_percent: 0 });
    if(error) alert(error.message);
    else { btn.className = 'btn btn-sm btn-success'; btn.textContent = 'OK'; loadStudents(); }
};
window.updateEnrollmentStatus = async (id, st) => { if(confirm('Confirmar?')) { await supabase.from('class_enrollments').update({status:st}).eq('id',id); loadStudents(); } };
window.removeStudent = async (id) => { if(confirm('Remover?')) { await supabase.from('class_enrollments').delete().eq('id',id); loadStudents(); } };

const formPost = document.getElementById('formPost');
if(formPost) {
    formPost.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            class_id: classId,
            type: document.getElementById('post_type').value,
            title: document.getElementById('post_title').value,
            content: document.getElementById('post_content').value,
            resource_url: document.getElementById('post_url').value || null,
            event_date: document.getElementById('post_date').value || null,
            is_pinned: document.getElementById('post_pinned').checked
        };
        await supabase.from('class_posts').insert(data);
        e.target.reset(); loadPosts();
    });
}

function translateStatus(st) { const map = { active: 'Ativo', pending: 'Pendente', rejected: 'Rejeitado', dropped: 'Trancado', completed: 'Concluído' }; return map[st] || st; }
function getStatusClass(st) { const map = { active: 'badge-subtle-success', pending: 'badge-subtle-warning', rejected: 'badge-subtle-danger', dropped: 'badge-subtle-secondary', completed: 'badge-subtle-primary' }; return map[st] || 'bg-secondary'; }