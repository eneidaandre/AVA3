import { supabase } from './supabaseClient.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// Globais para Modais
let modalCourse = null;
let modalNewUser = null;
let modalEditUser = null;
let modalViewMsg = null;
let modalSiteConfig = null;
let searchTimeout = null;

async function initAdminPage() {
    console.log("🚀 Admin JS Iniciado");

    if (window.bootstrap) {
        // Inicializa Modais se o Bootstrap estiver carregado
        const ids = {
            'modalCourse': 'modalCourse', 
            'modalNewUser': 'modalNewUser', 
            'modalEditUser': 'modalEditUser', 
            'modalViewMessage': 'modalViewMsg',
            'modalSiteConfig': 'modalSiteConfig'
        };
        
        const mCourse = document.getElementById('modalCourse');
        if(mCourse) modalCourse = new window.bootstrap.Modal(mCourse);

        const mNewUser = document.getElementById('modalNewUser');
        if(mNewUser) modalNewUser = new window.bootstrap.Modal(mNewUser);

        const mEditUser = document.getElementById('modalEditUser');
        if(mEditUser) modalEditUser = new window.bootstrap.Modal(mEditUser);

        const mViewMsg = document.getElementById('modalViewMessage');
        if(mViewMsg) modalViewMsg = new window.bootstrap.Modal(mViewMsg);

        const mSiteConfig = document.getElementById('modalSiteConfig');
        if(mSiteConfig) modalSiteConfig = new window.bootstrap.Modal(mSiteConfig);
    }

    setupCourseForm();
    setupUserForms();
    setupUserSearch();
    setupSystemConfig();

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { window.location.href = 'login.html'; return; }

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
        const role = profile?.role ? String(profile.role).toLowerCase().trim() : 'aluno';

        if (role !== 'admin') {
            document.getElementById('admin-status').textContent = "Acesso Negado";
            document.getElementById('admin-status').className = "badge bg-danger";
            setTimeout(() => window.location.href = 'index.html', 1500); 
            return;
        }

        document.getElementById('admin-status').textContent = "Admin Conectado";
        document.getElementById('admin-status').className = "badge bg-success";
        document.getElementById('loading-spinner').style.display = 'none';
        document.getElementById('admin-dashboard').style.display = 'block';

        loadCounts();
        loadCourses();
        loadUsers(); 
        loadMessages();

    } catch (err) {
        console.error("Erro Admin:", err);
    }
}

// --- NAVEGAÇÃO ENTRE PAINÉIS ---
window.showPanel = function(panelId) {
    document.querySelectorAll('.admin-panel').forEach(el => el.style.display = 'none');
    const target = document.getElementById('panel-' + panelId);
    if(target) target.style.display = 'block';
    
    const titles = { 
        'courses': 'Gerenciar Cursos', 
        'users': 'Gerenciar Usuários', 
        'offers': 'Gerenciar Turmas',
        'messages': 'Mensagens Recebidas'
    };
    const titleEl = document.getElementById('panel-title');
    if(titleEl) titleEl.textContent = titles[panelId] || 'Visão Geral';
};

// =========================================================
// MÓDULO: CURSOS
// =========================================================
window.openNewCourseModal = function() { if (modalCourse) modalCourse.show(); }

function setupCourseForm() {
    const form = document.getElementById('formCourse');
    const titleInp = document.getElementById('course_title');
    const slugInp = document.getElementById('course_slug');

    if (titleInp && slugInp) {
        titleInp.addEventListener('input', () => {
            slugInp.value = titleInp.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
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
            if (error) alert("Erro: " + error.message);
            else {
                alert("Curso criado!");
                form.reset(); 
                modalCourse.hide();
                loadCounts(); 
                loadCourses(); 
            }
        });
    }
}

async function loadCourses() {
    const tbody = document.getElementById('table-courses');
    const template = document.getElementById('template-course-row'); 
    tbody.innerHTML = ''; 
    const { data: courses } = await supabase.from('courses').select('*').order('id', { ascending: false }).limit(20);
    if (courses) {
        courses.forEach(c => {
            const clone = template.content.cloneNode(true);
            clone.querySelector('.row-id').textContent = `#${c.id}`;
            clone.querySelector('.row-title').textContent = c.title;
            clone.querySelector('.row-subtitle').textContent = `${c.tipo || 'OUTRO'} • ${c.carga_horaria_horas || 0}h`;
            const badge = clone.querySelector('.row-status');
            badge.textContent = c.status === 'published' ? 'Publicado' : 'Rascunho';
            badge.className = `badge row-status ${c.status === 'published' ? 'bg-success' : 'bg-secondary'}`;
            clone.querySelector('.edit-btn').onclick = () => window.location.href = 'course-editor.html?id=' + c.id;
            tbody.appendChild(clone);
        });
    }
}

// =========================================================
// MÓDULO: USUÁRIOS
// =========================================================

function setupUserForms() {
    // 1. NOVO USUÁRIO
    const formNew = document.getElementById('formNewUser');
    if(formNew) {
        formNew.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.submitter;
            btn.disabled = true; btn.innerHTML = 'Criando...';

            const name = document.getElementById('new_user_name').value.trim();
            const email = document.getElementById('new_user_email').value.trim();
            const password = document.getElementById('new_user_password').value;
            const role = document.getElementById('new_user_role').value;

            // Cliente temporário para criar usuário sem deslogar o admin
            const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

            const { data, error } = await tempClient.auth.signUp({
                email, password,
                options: { data: { full_name: name } }
            });

            if(error) {
                alert("Erro ao criar conta: " + error.message);
                btn.disabled = false; btn.innerHTML = 'Cadastrar';
                return;
            }

            if(data.user) {
                await supabase.from('profiles').update({ role: role, name: name }).eq('id', data.user.id);
                alert(`Usuário cadastrado!\nUm e-mail de confirmação foi enviado para ${email}.`);
                formNew.reset();
                modalNewUser.hide();
                loadUsers();
            }
            btn.disabled = false; btn.innerHTML = 'Cadastrar';
        });
    }

    // 2. EDITAR USUÁRIO
    const formEdit = document.getElementById('formEditUser');
    if(formEdit) {
        formEdit.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit_user_id').value;
            const updates = {
                name: document.getElementById('edit_user_name').value,
                role: document.getElementById('edit_user_role').value
            };

            const { error } = await supabase.from('profiles').update(updates).eq('id', id);

            if(error) alert("Erro ao atualizar: " + error.message);
            else {
                alert("Dados salvos com sucesso!");
                modalEditUser.hide();
                loadUsers(); 
            }
        });
    }
}

window.openNewUserModal = function() {
    document.getElementById('formNewUser').reset();
    if(modalNewUser) modalNewUser.show();
};

window.openEditUserModal = function(id, name, role) {
    document.getElementById('edit_user_id').value = id;
    document.getElementById('edit_user_name').value = name;
    document.getElementById('edit_user_role').value = role;
    document.getElementById('edit_user_uid').value = id;
    if(modalEditUser) modalEditUser.show();
};

window.deleteUser = async function(id) {
    if(!confirm("⚠️ PERIGO: Tem certeza absoluta?\n\nIsso removerá todo o histórico e matrículas deste usuário.\n\nEssa ação não pode ser desfeita.")) return;
    
    // Passo 1: Remover Matrículas (Class Enrollments) - Manual Cascade
    const { error: errEnroll } = await supabase.from('class_enrollments').delete().eq('user_id', id);
    if (errEnroll) console.error("Erro ao limpar matrículas:", errEnroll);

    // Passo 2: Remover o Perfil
    const { error } = await supabase.from('profiles').delete().eq('id', id);

    if (error) {
        alert("Erro ao excluir usuário: " + error.message + "\n\nVerifique se o usuário possui outros vínculos (como cursos criados).");
    } else {
        alert("Usuário e dados associados removidos com sucesso.");
        loadUsers(document.getElementById('user-search-input').value);
        loadCounts();
    }
};

function setupUserSearch() {
    const input = document.getElementById('user-search-input');
    if(!input) return;
    input.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => { loadUsers(e.target.value); }, 500);
    });
}

async function loadUsers(term = '') {
    const tbody = document.getElementById('table-users');
    const statusDiv = document.getElementById('users-loading-status');
    const tpl = document.getElementById('template-user-row');
    
    if(!tbody) return;

    tbody.innerHTML = '';
    statusDiv.style.display = 'block';
    statusDiv.innerHTML = '<div class="spinner-border spinner-border-sm text-primary"></div> Carregando...';

    let query = supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(100);
    if (term.length > 0) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%`);

    const { data: users, error } = await query;

    if (error) { statusDiv.textContent = "Erro ao buscar usuários."; return; }
    if (!users || users.length === 0) { statusDiv.textContent = "Nenhum usuário encontrado."; return; }

    statusDiv.style.display = 'none';

    users.forEach(u => {
        const clone = tpl.content.cloneNode(true);
        const role = u.role || 'aluno';
        
        let displayName = u.name;
        // Se nome for igual ao email ou vazio, tenta melhorar a exibição
        if (!displayName || displayName === u.email) displayName = u.name || '(Sem Nome)';
        
        clone.querySelector('.user-name').textContent = displayName;
        clone.querySelector('.user-id').textContent = u.id.substring(0,8) + '...';
        clone.querySelector('.user-email').textContent = u.email;
        
        const btnRole = clone.querySelector('.user-role-btn');
        btnRole.textContent = role.toUpperCase();
        
        // Estilização do botão de Role
        btnRole.className = 'btn btn-sm dropdown-toggle fw-bold text-uppercase user-role-btn shadow-sm';
        if (role === 'admin') btnRole.classList.add('btn-dark', 'border-dark');
        else if (role === 'professor') btnRole.classList.add('btn-outline-dark', 'active');
        else if (role === 'gerente') btnRole.classList.add('btn-outline-danger');
        else btnRole.classList.add('btn-outline-secondary');

        // Ações
        clone.querySelectorAll('.dropdown-item[data-value]').forEach(item => {
            item.onclick = (e) => { e.preventDefault(); changeGlobalRole(u.id, item.dataset.value); };
        });
        clone.querySelector('.btn-edit-user').onclick = () => window.openEditUserModal(u.id, displayName, role);
        clone.querySelector('.btn-delete-user').onclick = () => window.deleteUser(u.id);

        tbody.appendChild(clone);
    });
}

async function changeGlobalRole(userId, newRole) {
    if(!confirm(`Alterar perfil para "${newRole.toUpperCase()}"?`)) return;
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) alert("Erro: " + error.message);
    else loadUsers(document.getElementById('user-search-input').value);
}

// =========================================================
// MÓDULO: FALE CONOSCO
// =========================================================
async function loadMessages() {
    const tbody = document.getElementById('table-messages');
    const empty = document.getElementById('messages-empty');
    if(!tbody) return;

    tbody.innerHTML = '';
    
    const { data: msgs, error } = await supabase.from('contact_messages').select('*').order('created_at', { ascending: false });

    if(error) { empty.textContent = "Erro ao carregar mensagens."; return; }
    if(!msgs || msgs.length === 0) { empty.textContent = "Nenhuma mensagem recebida."; return; }

    empty.style.display = 'none';

    msgs.forEach(msg => {
        const tr = document.createElement('tr');
        const weight = msg.is_read ? 'normal' : 'bold';
        const bg = msg.is_read ? '' : 'bg-light';
        
        tr.className = `${bg}`;
        tr.innerHTML = `
            <td class="ps-4 text-muted small" style="width: 120px;">${new Date(msg.created_at).toLocaleDateString()}</td>
            <td style="font-weight: ${weight}"><div>${msg.name}</div><small class="text-muted">${msg.email}</small></td>
            <td style="font-weight: ${weight}">
                <span class="badge bg-secondary bg-opacity-10 text-secondary border me-1">${msg.subject || 'Geral'}</span>
                ${msg.is_read ? '' : '<span class="badge bg-danger ms-1">Nova</span>'}
            </td>
            <td class="text-end pe-4">
                <button class="btn btn-sm btn-outline-primary rounded-circle btn-view-msg" title="Ler"><i class='bx bx-envelope-open'></i></button>
            </td>
        `;
        tr.querySelector('.btn-view-msg').onclick = () => openMessageModal(msg);
        tbody.appendChild(tr);
    });
}

function openMessageModal(msg) {
    document.getElementById('msg-view-subject').textContent = msg.subject || 'Sem Assunto';
    document.getElementById('msg-view-name').textContent = msg.name;
    document.getElementById('msg-view-email').textContent = msg.email;
    document.getElementById('msg-view-date').textContent = new Date(msg.created_at).toLocaleString();
    document.getElementById('msg-view-content').textContent = msg.message;

    // Botão Excluir (Modal)
    const btnDel = document.getElementById('btn-delete-msg-modal');
    btnDel.onclick = async () => {
        if(confirm("Excluir esta mensagem?")) {
            await supabase.from('contact_messages').delete().eq('id', msg.id);
            modalViewMsg.hide();
            loadMessages();
            loadCounts();
        }
    };

    // Marcar como lida
    if(!msg.is_read) {
        supabase.from('contact_messages').update({ is_read: true }).eq('id', msg.id).then(() => loadMessages());
    }

    if(modalViewMsg) modalViewMsg.show();
}

// =========================================================
// MÓDULO: CONFIGURAÇÕES DO SITE
// =========================================================
function setupSystemConfig() {
    const form = document.getElementById('formSiteConfig');
    if(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const updates = {
                address: document.getElementById('conf_address').value,
                email_support: document.getElementById('conf_email_sup').value,
                email_commercial: document.getElementById('conf_email_com').value,
                whatsapp: document.getElementById('conf_whatsapp').value,
                map_url: document.getElementById('conf_map').value,
                updated_at: new Date()
            };
            const { error } = await supabase.from('site_config').update(updates).eq('id', 1);
            if (error) alert("Erro ao salvar: " + error.message);
            else {
                alert("Configurações atualizadas!");
                modalSiteConfig.hide();
            }
        });
    }
}

window.openSiteConfig = async function() {
    if(modalSiteConfig) modalSiteConfig.show();
    
    const { data, error } = await supabase.from('site_config').select('*').eq('id', 1).single();
    if (data) {
        document.getElementById('conf_address').value = data.address || '';
        document.getElementById('conf_email_sup').value = data.email_support || '';
        document.getElementById('conf_email_com').value = data.email_commercial || '';
        document.getElementById('conf_whatsapp').value = data.whatsapp || '';
        document.getElementById('conf_map').value = data.map_url || '';
    }
};

// =========================================================
// ESTATÍSTICAS GERAIS
// =========================================================
async function loadCounts() {
    const { count: courses } = await supabase.from('courses').select('*', { count: 'exact', head: true });
    const { count: users } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: msgs } = await supabase.from('contact_messages').select('*', { count: 'exact', head: true });
    const { count: classes } = await supabase.from('classes').select('*', { count: 'exact', head: true }).eq('enrollment_open', true);
    
    if(document.getElementById('count-courses')) document.getElementById('count-courses').textContent = courses || 0;
    if(document.getElementById('count-users')) document.getElementById('count-users').textContent = users || 0;
    if(document.getElementById('count-messages')) document.getElementById('count-messages').textContent = msgs || 0;
    if(document.getElementById('count-offers')) document.getElementById('count-offers').textContent = classes || 0;
}

initAdminPage();