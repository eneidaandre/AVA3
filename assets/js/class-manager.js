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

// === HELPER GLOBAL PARA O MODAL (CORREÇÃO CRÍTICA) ===
window.selectBg = function(url) {
    const preview = document.getElementById('cert-bg-preview');
    const input = document.getElementById('cert_bg_url');
    if(preview) preview.src = url;
    if(input) input.value = url;
    document.querySelectorAll('.bg-option').forEach(el => el.classList.remove('active'));
    const clicked = Array.from(document.querySelectorAll('.bg-option')).find(el => el.src === url);
    if(clicked) clicked.classList.add('active');
};

// 1. Carrega cursos
async function loadCoursesSelect() {
    const select = document.getElementById('course_select');
    select.innerHTML = '<option value="">Carregando...</option>';
    const { data, error } = await supabase.from('courses').select('id, title').order('title');
    if (error) { console.error(error); return; }
    select.innerHTML = '<option value="">Selecione...</option>';
    data.forEach(course => {
        const opt = document.createElement('option');
        opt.value = course.id;
        opt.textContent = course.title || 'Sem título';
        select.appendChild(opt);
    });
}

// 2. Carrega Turmas
async function loadClasses() {
    const container = document.getElementById('classes-list');
    const { data: classes, error } = await supabase.from('classes').select(`*, courses (title), class_enrollments (count)`).order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = `<div class="alert alert-danger w-100">Erro: ${error.message}</div>`;
        return;
    }
    container.innerHTML = '';
    if (classes.length === 0) {
        container.innerHTML = '<div class="col-12 text-center py-5"><h5 class="text-muted">Nenhuma turma criada.</h5></div>';
        return;
    }

    const tpl = document.getElementById('tpl-class-card');

    classes.forEach(cls => {
        const clone = tpl.content.cloneNode(true);
        const count = cls.class_enrollments?.[0]?.count || 0;

        clone.querySelector('.class-course-name').textContent = cls.courses?.title || 'Curso';
        clone.querySelector('.class-name').textContent = cls.name;
        clone.querySelector('.class-code').textContent = cls.code || '---';
        clone.querySelector('.class-count').textContent = count;
        
        // Ações
        clone.querySelector('.btn-edit').onclick = () => editClass(cls);
        clone.querySelector('.btn-delete').onclick = () => deleteClass(cls.id);
        
        // --- BOTÃO CERTIFICADO ---
        const btnCert = clone.querySelector('.btn-cert');
        if(btnCert) {
            btnCert.onclick = (e) => {
                e.preventDefault();
                openCertificateModal(cls);
            };
        }
        
        const linkDash = `class-dashboard.html?id=${cls.id}`;
        clone.querySelectorAll('.btn-dashboard').forEach(btn => {
            btn.onclick = (e) => { e.preventDefault(); window.location.href = linkDash; };
        });

        container.appendChild(clone);
    });
}

// 3. Modal e CRUD de Turma (Mantido)
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
    if (id) ({ error } = await supabase.from('classes').update(data).eq('id', id));
    else ({ error } = await supabase.from('classes').insert(data));

    if (error) alert("Erro: " + error.message);
    else {
        bootstrap.Modal.getInstance(document.getElementById('modalClass')).hide();
        loadClasses();
    }
});

window.deleteClass = async function(id) {
    if(confirm("Tem certeza?")) {
        const { error } = await supabase.from('classes').delete().eq('id', id);
        if(error) alert("Erro: " + error.message);
        else loadClasses();
    }
};

// --- 4. LÓGICA DO CERTIFICADO ---

window.openCertificateModal = async function(cls) {
    document.getElementById('formCertificate').reset();
    document.getElementById('cert_class_id').value = cls.id;
    document.getElementById('preview-course-name').textContent = cls.courses?.title || 'CURSO';
    window.selectBg('https://via.placeholder.com/800x600/e0e7ff/333?text=Modelo+Padrao'); // Reset visual

    try {
        const { data, error } = await supabase.from('class_certificates').select('*').eq('class_id', cls.id).single();
        if (data) {
            if(data.bg_template) window.selectBg(data.bg_template);
            document.getElementById('signer1_name').value = data.signer1_name || '';
            document.getElementById('signer1_role').value = data.signer1_role || '';
            document.getElementById('signer2_name').value = data.signer2_name || '';
            document.getElementById('signer2_role').value = data.signer2_role || '';
            document.getElementById('cert_back_bg_url').value = data.back_bg_url || '';
            document.getElementById('cert_reg_format').value = data.reg_format || '';
            document.getElementById('cert_legal_text').value = data.validation_text || '';
        }
    } catch(e) {}

    new bootstrap.Modal(document.getElementById('modalCertificate')).show();
};

document.getElementById('formCertificate').addEventListener('submit', async (e) => {
    e.preventDefault();
    const classId = document.getElementById('cert_class_id').value;
    
    const data = {
        class_id: classId,
        bg_template: document.getElementById('cert_bg_url').value,
        signer1_name: document.getElementById('signer1_name').value,
        signer1_role: document.getElementById('signer1_role').value,
        signer2_name: document.getElementById('signer2_name').value,
        signer2_role: document.getElementById('signer2_role').value,
        back_bg_url: document.getElementById('cert_back_bg_url').value,
        reg_format: document.getElementById('cert_reg_format').value,
        validation_text: document.getElementById('cert_legal_text').value,
        updated_at: new Date()
    };

    const { error } = await supabase.from('class_certificates').upsert(data, { onConflict: 'class_id' });

    if (error) alert("Erro ao salvar: " + error.message);
    else {
        alert("Configurações salvas!");
        bootstrap.Modal.getInstance(document.getElementById('modalCertificate')).hide();
    }
});