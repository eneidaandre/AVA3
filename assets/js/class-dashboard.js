import { supabase } from './supabaseClient.js';

const params = new URLSearchParams(window.location.search);
// Garante leitura do ID independente de como veio (id ou classId)
const classId = params.get('id') || params.get('classId');

document.addEventListener('DOMContentLoaded', async () => {
    if (!classId) {
        alert("ID da turma não encontrado.");
        window.location.href = 'class-manager.html';
        return;
    }
    await checkAuth();
    
    loadClassHeader();
    loadStudents();
    loadPosts();
});

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) window.location.href = 'login.html';
}

// 1. CARREGA CABEÇALHO
async function loadClassHeader() {
    const { data: cls, error } = await supabase
        .from('classes')
        .select(`*, courses (title)`)
        .eq('id', classId)
        .single();

    if (error) { console.error(error); return; }

    document.getElementById('dash-class-name').textContent = cls.name;
    document.getElementById('dash-course-name').textContent = cls.courses?.title || 'Curso';
    document.getElementById('dash-code').textContent = cls.code || 'S/ COD';
    
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
}

// 2. ALUNOS
async function loadStudents() {
    const tbody = document.getElementById('students-table-body');
    const empty = document.getElementById('students-empty');
    
    const { data: enrolls, error } = await supabase
        .from('class_enrollments')
        .select(`
            id, status, joined_at, progress_percent,
            profiles (name, email)
        `)
        .eq('class_id', classId)
        .order('joined_at', { ascending: false });

    if (error) { console.error(error); return; }

    document.getElementById('dash-total-students').textContent = enrolls.length;

    tbody.innerHTML = '';
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
        const email = profile.email || '---';
        const initials = name.substring(0,2).toUpperCase();
        
        clone.querySelector('.student-avatar').textContent = initials;
        clone.querySelector('.student-name').textContent = name;
        clone.querySelector('.student-email').textContent = email;
        
        const badge = clone.querySelector('.student-status');
        badge.textContent = translateStatus(row.status);
        badge.className = `badge bg-${getStatusColor(row.status)}`;

        const prog = row.progress_percent || 0;
        clone.querySelector('.student-progress-bar').style.width = `${prog}%`;
        clone.querySelector('.student-progress-text').textContent = `${prog}%`;

        clone.querySelector('.student-date').textContent = new Date(row.joined_at).toLocaleDateString();

        const btnApprove = clone.querySelector('.btn-approve');
        if (row.status === 'pending') {
            btnApprove.style.display = 'inline-block';
            btnApprove.onclick = () => updateEnrollmentStatus(row.id, 'active');
        }

        clone.querySelector('.btn-remove').onclick = () => removeStudent(row.id);

        tbody.appendChild(clone);
    });
}

// --- FUNÇÕES DE MATRÍCULA MANUAL (BUSCA INTELIGENTE) ---

window.openAddStudentModal = function() {
    document.getElementById('search-student-input').value = '';
    document.getElementById('student-search-results-list').innerHTML = '<div class="text-center py-4 text-muted small border rounded bg-white">Digite nome ou email para buscar...</div>';
    document.getElementById('search-status').textContent = '';
    new bootstrap.Modal(document.getElementById('modalAddStudent')).show();
};

// Busca ao pressionar Enter
const searchInput = document.getElementById('search-student-input');
if(searchInput) {
    searchInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') searchStudentToEnroll();
    });
}

window.searchStudentToEnroll = async function() {
    const term = document.getElementById('search-student-input').value.trim();
    if (term.length < 3) {
        alert("Digite pelo menos 3 caracteres.");
        return;
    }

    const list = document.getElementById('student-search-results-list');
    const status = document.getElementById('search-status');
    
    list.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div></div>';
    status.textContent = 'Buscando...';

    // Busca por NOME ou EMAIL (Case Insensitive)
    const { data: users, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .or(`name.ilike.%${term}%,email.ilike.%${term}%`)
        .limit(10);

    if (error) {
        list.innerHTML = `<div class="alert alert-danger small mb-0">${error.message}</div>`;
        return;
    }

    if (!users || users.length === 0) {
        list.innerHTML = `<div class="alert alert-warning small mb-0 text-center">Nenhum usuário encontrado.</div>`;
        status.textContent = '0 resultados';
        return;
    }

    status.textContent = `${users.length} encontrados`;
    renderSearchResults(users);
};

function renderSearchResults(users) {
    const list = document.getElementById('student-search-results-list');
    list.innerHTML = '';

    users.forEach(user => {
        const div = document.createElement('div');
        div.className = 'card border shadow-sm';
        
        // Iniciais
        const name = user.name || 'Sem Nome';
        const email = user.email || 'Email oculto';
        const initials = name.substring(0, 2).toUpperCase();

        div.innerHTML = `
            <div class="card-body p-2 d-flex align-items-center justify-content-between">
                <div class="d-flex align-items-center gap-2 overflow-hidden">
                    <div class="student-avatar bg-secondary text-white small" style="width:32px; height:32px; font-size:0.8rem;">${initials}</div>
                    <div class="text-truncate">
                        <div class="fw-bold text-dark small text-truncate" style="max-width: 180px;">${name}</div>
                        <div class="text-muted small text-truncate" style="font-size: 0.75rem; max-width: 180px;">${email}</div>
                    </div>
                </div>
                <button class="btn btn-sm btn-outline-success fw-bold" onclick="window.confirmEnroll('${user.id}', this)">
                    <i class='bx bx-plus'></i> Incluir
                </button>
            </div>
        `;
        list.appendChild(div);
    });
}

// Função chamada ao clicar no botão "Incluir" da lista
window.confirmEnroll = async function(userId, btn) {
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i>';

    const { error } = await supabase
        .from('class_enrollments')
        .insert({
            class_id: classId,
            user_id: userId,
            status: 'active', // Matriculado direto
            progress_percent: 0
        });

    if (error) {
        btn.disabled = false;
        btn.innerHTML = originalText;
        if (error.code === '23505') alert("Este aluno já está matriculado nesta turma.");
        else alert("Erro: " + error.message);
    } else {
        // Sucesso visual
        btn.classList.remove('btn-outline-success');
        btn.classList.add('btn-success');
        btn.innerHTML = '<i class="bx bx-check"></i> Feito';
        
        // Atualiza a tabela de alunos atrás do modal
        loadStudents();
    }
};

// ------------------------------------------

async function updateEnrollmentStatus(id, newStatus) {
    if(!confirm(`Mudar status para ${newStatus}?`)) return;
    const { error } = await supabase.from('class_enrollments').update({ status: newStatus }).eq('id', id);
    if (!error) loadStudents();
}

async function removeStudent(id) {
    if(!confirm("Remover aluno da turma?")) return;
    const { error } = await supabase.from('class_enrollments').delete().eq('id', id);
    if (!error) loadStudents();
}

function translateStatus(st) {
    const map = { active: 'Ativo', pending: 'Pendente', rejected: 'Rejeitado', dropped: 'Trancado', completed: 'Concluído' };
    return map[st] || st;
}
function getStatusColor(st) {
    const map = { active: 'success', pending: 'warning', rejected: 'danger', dropped: 'secondary', completed: 'primary' };
    return map[st] || 'secondary';
}

// 3. MURAL (POSTS)
async function loadPosts() {
    const container = document.getElementById('posts-feed');
    const { data: posts, error } = await supabase
        .from('class_posts')
        .select('*')
        .eq('class_id', classId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) return;

    container.innerHTML = '';
    if (posts.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-5"><i class="bx bx-news fs-1"></i><p>Mural vazio.</p></div>';
        return;
    }

    const tpl = document.getElementById('tpl-post-card');

    posts.forEach(post => {
        const clone = tpl.content.cloneNode(true);
        const card = clone.querySelector('.post-card');
        card.classList.add(`post-${post.type}`);
        
        clone.querySelector('.post-title').textContent = post.title;
        clone.querySelector('.post-content').textContent = post.content || '';
        
        const badge = clone.querySelector('.post-badge');
        badge.textContent = post.type;
        const bgMap = { 'AVISO': 'warning text-dark', 'MATERIAL': 'primary', 'EVENTO': 'success' };
        badge.className = `badge bg-${bgMap[post.type] || 'secondary'}`;

        if (post.is_pinned) {
            clone.querySelector('.post-title').innerHTML = `<i class='bx bx-pin text-danger'></i> ${post.title}`;
        }

        if (post.resource_url || post.event_date) {
            clone.querySelector('.post-extras').style.display = 'block';
            if (post.resource_url) {
                const lnk = clone.querySelector('.post-link');
                lnk.href = post.resource_url;
                lnk.style.display = 'inline-flex';
            }
            if (post.event_date) {
                const dt = clone.querySelector('.post-event-date');
                dt.style.display = 'inline-flex';
                dt.querySelector('span').textContent = new Date(post.event_date).toLocaleString();
            }
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

document.getElementById('formPost').addEventListener('submit', async (e) => {
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

    const { error } = await supabase.from('class_posts').insert(data);
    if (error) alert("Erro: " + error.message);
    else {
        e.target.reset();
        loadPosts();
    }
});