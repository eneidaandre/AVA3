import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', init);

async function init() {
    await checkAuth();
    await loadCoursesSelect();
    await loadClasses();
}

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) window.location.href = 'login.html';
}

// 1. Carrega cursos para o Select do Modal
async function loadCoursesSelect() {
    const select = document.getElementById('course_select');
    // Limpa opções anteriores
    select.innerHTML = '<option value="">Carregando...</option>';

    const { data, error } = await supabase
        .from('courses')
        .select('id, title')
        .order('title');

    if (error) {
        console.error(error);
        select.innerHTML = '<option>Erro ao carregar cursos</option>';
        return;
    }

    select.innerHTML = '<option value="">Selecione...</option>';
    data.forEach(course => {
        const opt = document.createElement('option');
        opt.value = course.id;
        opt.textContent = course.title || 'Sem título';
        select.appendChild(opt);
    });
}

// 2. Carrega e Renderiza as Turmas
async function loadClasses() {
    const container = document.getElementById('classes-list');
    
    // Busca Turmas + Nome do Curso
    const { data: classes, error } = await supabase
        .from('classes')
        .select(`
            *,
            courses (title),
            class_enrollments (count)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = `<div class="alert alert-danger w-100">Erro: ${error.message}</div>`;
        return;
    }

    container.innerHTML = '';
    
    if (classes.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class='bx bx-group fs-1 text-muted'></i>
                <h5 class="text-muted mt-3">Nenhuma turma criada.</h5>
                <button class="btn btn-outline-primary mt-2" onclick="openClassModal()">Criar Primeira Turma</button>
            </div>
        `;
        return;
    }

    const tpl = document.getElementById('tpl-class-card');
    let totalStudents = 0;

    classes.forEach(cls => {
        const clone = tpl.content.cloneNode(true);
        const count = cls.class_enrollments && cls.class_enrollments[0] ? cls.class_enrollments[0].count : 0;
        totalStudents += count;

        clone.querySelector('.class-course-name').textContent = cls.courses?.title || 'Curso Desconhecido';
        clone.querySelector('.class-name').textContent = cls.name;
        clone.querySelector('.class-code').textContent = cls.code || '---';
        clone.querySelector('.class-count').textContent = count;
        
        // Formata datas
        let dateText = 'Sem datas definidas';
        if (cls.start_date) {
            const start = new Date(cls.start_date).toLocaleDateString();
            const end = cls.end_date ? new Date(cls.end_date).toLocaleDateString() : '...';
            dateText = `${start} até ${end}`;
        }
        clone.querySelector('.class-dates').innerHTML = `<i class='bx bx-calendar'></i> ${dateText}`;

        // Ações
        clone.querySelector('.btn-edit').onclick = () => editClass(cls);
        clone.querySelector('.btn-delete').onclick = () => deleteClass(cls.id);
        
        // --- CORREÇÃO DO LINK AQUI ---
        // Garante que o parâmetro seja ?id=... e previne o clique padrão
        const linkDash = `class-dashboard.html?id=${cls.id}`;
        
        clone.querySelectorAll('.btn-dashboard').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault(); 
                window.location.href = linkDash;
            };
        });

        container.appendChild(clone);
    });

    // Atualiza stats
    if(document.getElementById('stat-total')) document.getElementById('stat-total').textContent = classes.length;
    if(document.getElementById('stat-students')) document.getElementById('stat-students').textContent = totalStudents;
}

// 3. Modal e CRUD
window.openClassModal = function() {
    document.getElementById('formClass').reset();
    document.getElementById('class_id').value = '';
    new bootstrap.Modal(document.getElementById('modalClass')).show();
};

window.editClass = function(cls) {
    document.getElementById('class_id').value = cls.id;
    document.getElementById('course_select').value = cls.course_id;
    document.getElementById('class_name').value = cls.name;
    document.getElementById('class_code').value = cls.code || '';
    
    if(cls.start_date) document.getElementById('start_date').value = cls.start_date.split('T')[0];
    if(cls.end_date) document.getElementById('end_date').value = cls.end_date.split('T')[0];
    
    document.getElementById('max_students').value = cls.max_students || '';
    document.getElementById('requires_approval').checked = cls.requires_approval;
    document.getElementById('whatsapp_link').value = cls.whatsapp_link || '';

    new bootstrap.Modal(document.getElementById('modalClass')).show();
};

document.getElementById('formClass').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('class_id').value;
    const data = {
        course_id: document.getElementById('course_select').value,
        name: document.getElementById('class_name').value,
        code: document.getElementById('class_code').value || null,
        start_date: document.getElementById('start_date').value || null,
        end_date: document.getElementById('end_date').value || null,
        max_students: document.getElementById('max_students').value ? parseInt(document.getElementById('max_students').value) : null,
        requires_approval: document.getElementById('requires_approval').checked,
        whatsapp_link: document.getElementById('whatsapp_link').value || null
    };

    let error;
    if (id) {
        ({ error } = await supabase.from('classes').update(data).eq('id', id));
    } else {
        ({ error } = await supabase.from('classes').insert(data));
    }

    if (error) {
        alert("Erro ao salvar: " + error.message);
    } else {
        bootstrap.Modal.getInstance(document.getElementById('modalClass')).hide();
        loadClasses();
    }
});

window.deleteClass = async function(id) {
    if(confirm("Tem certeza? Todos os alunos matriculados serão removidos desta turma.")) {
        const { error } = await supabase.from('classes').delete().eq('id', id);
        if(error) alert("Erro: " + error.message);
        else loadClasses();
    }
};