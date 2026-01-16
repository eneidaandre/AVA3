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

async function loadCoursesSelect() {
    const select = document.getElementById('course_select');
    // Ordena por ID decrescente para os mais recentes aparecerem primeiro
    const { data, error } = await supabase
        .from('courses')
        .select('id, title')
        .order('id', { ascending: false });

    if (error) return;
    
    select.innerHTML = '<option value="">Selecione pelo código (#ID)...</option>';
    
    data.forEach(course => {
        const opt = document.createElement('option');
        opt.value = course.id;
        // FORMATO: #ID - Nome do Curso
        opt.textContent = `#${course.id} - ${course.title}`;
        select.appendChild(opt);
    });
}

async function loadClasses() {
    const container = document.getElementById('classes-list');
    const { data: classes, error } = await supabase.from('classes')
        .select(`*, courses (title), class_enrollments (count)`)
        .order('created_at', { ascending: false });

    if (error) { container.innerHTML = "Erro ao carregar."; return; }
    container.innerHTML = '';

    if (classes.length === 0) {
        container.innerHTML = '<div class="col-12 text-center py-5 text-muted">Nenhuma turma criada ainda.</div>';
        return;
    }

    const tpl = document.getElementById('tpl-class-card');
    const fmt = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '--/--';

    classes.forEach(cls => {
        const clone = tpl.content.cloneNode(true);
        const count = cls.class_enrollments?.[0]?.count || 0;
        
        clone.querySelector('.class-course-name').textContent = cls.courses?.title || 'Curso Geral';
        clone.querySelector('.class-name').textContent = cls.name;
        clone.querySelector('.class-count').textContent = count;
        clone.querySelector('.class-code-badge').textContent = cls.code ? `COD: ${cls.code}` : 'S/ CÓDIGO';
        
        clone.querySelector('.class-deadline-info').textContent = fmt(cls.enrollment_deadline);
        
        const statusBadge = clone.querySelector('.class-status-badge');
        if (cls.status === 'rascunho') {
            statusBadge.className = "badge bg-warning text-dark";
            statusBadge.textContent = "Rascunho";
        } else if (cls.is_hidden) {
            statusBadge.className = "badge bg-secondary";
            statusBadge.textContent = "Oculta";
        } else {
            statusBadge.className = "badge bg-success";
            statusBadge.textContent = "Ativa";
        }

        clone.querySelector('.btn-dashboard').onclick = () => {
            window.location.href = `class-dashboard.html?id=${cls.id}`;
        };

        container.appendChild(clone);
    });
}

window.openClassModal = function() {
    document.getElementById('formClass').reset();
    document.getElementById('class_id').value = '';
    
    const codeInput = document.getElementById('class_code');
    codeInput.value = '';
    codeInput.disabled = false;
    codeInput.placeholder = "Ex: T26-A (Único)";

    new bootstrap.Modal(document.getElementById('modalClass')).show();
};

document.getElementById('formClass').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('class_id').value;
    
    const data = {
        course_id: document.getElementById('course_select').value,
        name: document.getElementById('class_name').value,
        code: document.getElementById('class_code').value.trim() || null,
        enrollment_open: document.getElementById('enrollment_open').checked,
        enrollment_start: document.getElementById('enrollment_start').value || null,
        enrollment_deadline: document.getElementById('enrollment_deadline').value || null,
        start_date: document.getElementById('start_date').value || null,
        end_date: document.getElementById('end_date').value || null,
        max_students: document.getElementById('max_students').value ? parseInt(document.getElementById('max_students').value) : null,
        requires_approval: document.getElementById('requires_approval').checked,
        status: 'published'
    };

    let error;
    if (id) {
        if(document.getElementById('class_code').disabled) delete data.code;
        ({ error } = await supabase.from('classes').update(data).eq('id', id));
    } else {
        ({ error } = await supabase.from('classes').insert(data));
    }

    if (error) {
        if(error.code === '23505') alert("Erro: Este código de turma já existe.");
        else alert(error.message);
    } else {
        bootstrap.Modal.getInstance(document.getElementById('modalClass')).hide();
        loadClasses();
    }
});