import { supabase } from './supabaseClient.js';

const params = new URLSearchParams(window.location.search);
const courseId = params.get('id');
let quill;
let dadosCurso = { id: null, titulo: "", status: "draft", descricao: "", modulos: [] };

document.addEventListener('DOMContentLoaded', async () => {
    if (!courseId) {
        alert("ID do curso não fornecido.");
        window.location.href = 'admin.html';
        return;
    }

    // Inicializa Quill
    quill = new Quill('#editor-container', {
        theme: 'snow',
        placeholder: 'Conteúdo da aula...',
        modules: { toolbar: [ ['bold', 'italic', 'underline'], ['blockquote', 'code-block'], [{ 'header': 1 }, { 'header': 2 }], [{ 'list': 'ordered'}, { 'list': 'bullet' }], ['link', 'image', 'video'], ['clean'] ] }
    });

    await checkAuth();
    await loadCourseData(); 
});

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) window.location.href = 'login.html';
}

async function loadCourseData() {
    try {
        const { data: course } = await supabase.from('courses').select('*').eq('id', courseId).single();
        dadosCurso = { ...dadosCurso, id: course.id, titulo: course.title, status: course.status, descricao: course.description };

        // Preenche Configurações
        document.getElementById('header-title').innerText = dadosCurso.titulo;
        document.getElementById('course-id-badge').innerText = `ID: ${course.id}`;
        document.getElementById('edit_title').value = dadosCurso.titulo;
        document.getElementById('edit_status').value = dadosCurso.status || 'draft';
        document.getElementById('edit_desc').value = dadosCurso.descricao || '';

        // Busca Estrutura
        const { data: modules } = await supabase.from('modules').select(`*, sections (*, lessons (*))`).eq('course_id', courseId).order('ordem', { ascending: true });
        
        if (modules) {
            // ORDENAÇÃO RIGOROSA NO FRONT-END
            modules.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
            
            modules.forEach(mod => {
                mod.sections = mod.sections || [];
                mod.sections.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
                
                mod.sections.forEach(sec => {
                    sec.lessons = sec.lessons || [];
                    sec.lessons.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
                });
            });
            dadosCurso.modulos = modules;
        }
        renderizarGrade();
    } catch (error) { console.error(error); }
}

function renderizarGrade() {
    const container = document.getElementById('modules-list');
    container.innerHTML = '';
    
    if (!dadosCurso.modulos.length) {
        document.getElementById('modules-empty').style.display = 'block';
        return;
    }
    document.getElementById('modules-empty').style.display = 'none';

    const tplModule = document.getElementById('tpl-module');
    const tplSection = document.getElementById('tpl-section');
    const tplLesson = document.getElementById('tpl-lesson');

    dadosCurso.modulos.forEach(mod => {
        const modClone = tplModule.content.cloneNode(true);
        modClone.querySelector('.mod-badge').innerText = `#${mod.ordem}`;
        modClone.querySelector('.mod-title').innerText = mod.title;
        const colId = `mod-${mod.id}`;
        modClone.querySelector('.module-header').setAttribute('data-bs-target', `#${colId}`);
        modClone.querySelector('.mod-collapse').id = colId;
        
        modClone.querySelector('.btn-edit').onclick = (e) => { e.stopPropagation(); editarModulo(mod); };
        modClone.querySelector('.btn-del').onclick = (e) => { e.stopPropagation(); excluir('modules', mod.id); };
        modClone.querySelector('.btn-add-sec').onclick = (e) => { abrirModalSecao(mod.id, e); };

        const secContainer = modClone.querySelector('.sections-container');
        mod.sections.forEach(sec => {
            const secClone = tplSection.content.cloneNode(true);
            secClone.querySelector('.sec-title').innerText = `${sec.ordem}. ${sec.title}`;
            secClone.querySelector('.btn-add-content').onclick = () => abrirModalConteudo(mod.id, sec.id);
            secClone.querySelector('.btn-edit').onclick = () => editarSecao(sec);
            secClone.querySelector('.btn-del').onclick = () => excluir('sections', sec.id);
            
            const lesContainer = secClone.querySelector('.content-container');
            sec.lessons.forEach(les => {
                const lesClone = tplLesson.content.cloneNode(true);
                let icone = 'bx-file', cls = 'ic-doc';
                if (les.type === 'VIDEO_AULA') { icone = 'bx-play'; cls = 'ic-video'; }
                
                lesClone.querySelector('.icon-circle').className = `icon-circle ${cls}`;
                lesClone.querySelector('.icon-circle').innerHTML = `<i class='bx ${icone}'></i>`;
                // Exibe Ordem + Título
                lesClone.querySelector('.lesson-title').innerText = `${les.ordem}. ${les.title}`;
                lesClone.querySelector('.lesson-type').innerText = les.type;
                
                lesClone.querySelector('.btn-edit').onclick = () => editarConteudo(les, mod.id, sec.id);
                lesClone.querySelector('.btn-del').onclick = () => excluir('lessons', les.id);
                lesClone.querySelector('.btn-preview').onclick = () => verPreview(les);
                
                lesContainer.appendChild(lesClone);
            });
            secContainer.appendChild(secClone);
        });
        container.appendChild(modClone);
    });
}

// === EDIÇÃO DE CONTEÚDO (PREENCHE TUDO) ===
window.editarConteudo = (item, mId, sId) => {
    document.getElementById('les_id').value = item.id;
    document.getElementById('les_module_id').value = mId;
    document.getElementById('les_section_id').value = sId;
    
    // PREENCHE TODOS OS CAMPOS
    document.getElementById('les_order').value = item.ordem || 1; // Ordem
    document.getElementById('les_title').value = item.title;
    document.getElementById('les_type').value = item.type; 
    document.getElementById('les_url').value = item.content_url || '';
    document.getElementById('les_points').value = item.points || 0;
    
    // PREENCHE O EDITOR
    if(quill) quill.root.innerHTML = item.description || '';
    
    // Datas e Checkboxes
    if(item.available_from) document.getElementById('les_start').value = item.available_from.slice(0,16);
    if(item.available_until) document.getElementById('les_end').value = item.available_until.slice(0,16);
    document.getElementById('les_published').checked = item.is_published !== false;
    document.getElementById('les_required').checked = item.is_required !== false;
    
    new bootstrap.Modal(document.getElementById('modalLesson')).show();
};

window.abrirModalConteudo = (mId, sId) => {
    document.getElementById('formLesson').reset();
    document.getElementById('les_id').value = '';
    document.getElementById('les_module_id').value = mId;
    document.getElementById('les_section_id').value = sId;
    if(quill) quill.root.innerHTML = '';
    
    // Sugere próxima ordem
    let nextOrder = 1;
    const mod = dadosCurso.modulos.find(m => m.id == mId);
    if(mod) {
        const sec = mod.sections.find(s => s.id == sId);
        if(sec && sec.lessons.length > 0) nextOrder = Math.max(...sec.lessons.map(l => l.ordem)) + 1;
    }
    document.getElementById('les_order').value = nextOrder;
    
    document.getElementById('les_published').checked = true;
    document.getElementById('les_required').checked = true;
    new bootstrap.Modal(document.getElementById('modalLesson')).show();
};

document.getElementById('formLesson').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('les_id').value;
    const data = {
        module_id: parseInt(document.getElementById('les_module_id').value),
        section_id: parseInt(document.getElementById('les_section_id').value),
        ordem: parseInt(document.getElementById('les_order').value) || 1, // SALVA ORDEM
        title: document.getElementById('les_title').value,
        type: document.getElementById('les_type').value,
        content_url: document.getElementById('les_url').value || null,
        points: parseFloat(document.getElementById('les_points').value) || 0,
        description: quill.root.innerHTML,
        is_published: document.getElementById('les_published').checked,
        is_required: document.getElementById('les_required').checked,
        available_from: document.getElementById('les_start').value || null,
        available_until: document.getElementById('les_end').value || null
    };

    let error;
    if (id) ({ error } = await supabase.from('lessons').update(data).eq('id', id));
    else ({ error } = await supabase.from('lessons').insert(data));

    if (error) alert(error.message);
    else {
        bootstrap.Modal.getInstance(document.getElementById('modalLesson')).hide();
        loadCourseData();
    }
});

// Outros salvamentos
document.getElementById('formEditCourse').addEventListener('submit', async (e) => { e.preventDefault(); const upd = { title: document.getElementById('edit_title').value, status: document.getElementById('edit_status').value, description: document.getElementById('edit_desc').value }; const { error } = await supabase.from('courses').update(upd).eq('id', courseId); if(error) alert(error.message); else alert("Salvo!"); });
document.getElementById('formModule').addEventListener('submit', async (e) => { e.preventDefault(); const id = document.getElementById('mod_id').value; const data = { course_id: parseInt(courseId), title: document.getElementById('mod_title').value, ordem: parseInt(document.getElementById('mod_order').value) }; let error; if(id) ({error} = await supabase.from('modules').update(data).eq('id', id)); else ({error} = await supabase.from('modules').insert(data)); if(error) alert(error.message); else { bootstrap.Modal.getInstance(document.getElementById('modalModule')).hide(); loadCourseData(); } });
document.getElementById('formSection').addEventListener('submit', async (e) => { e.preventDefault(); const id = document.getElementById('sec_id').value; const data = { module_id: parseInt(document.getElementById('sec_module_id').value), title: document.getElementById('sec_title').value, ordem: parseInt(document.getElementById('sec_order').value) }; let error; if(id) ({error} = await supabase.from('sections').update(data).eq('id', id)); else ({error} = await supabase.from('sections').insert(data)); if(error) alert(error.message); else { bootstrap.Modal.getInstance(document.getElementById('modalSection')).hide(); loadCourseData(); } });

// Modals Auxiliares
window.openModuleModal = () => { document.getElementById('formModule').reset(); document.getElementById('mod_id').value = ''; new bootstrap.Modal(document.getElementById('modalModule')).show(); };
window.editarModulo = (m) => { document.getElementById('mod_id').value = m.id; document.getElementById('mod_title').value = m.title; document.getElementById('mod_order').value = m.ordem; new bootstrap.Modal(document.getElementById('modalModule')).show(); };
window.abrirModalSecao = (mId, e) => { if(e) e.stopPropagation(); document.getElementById('formSection').reset(); document.getElementById('sec_id').value = ''; document.getElementById('sec_module_id').value = mId; new bootstrap.Modal(document.getElementById('modalSection')).show(); };
window.editarSecao = (s) => { document.getElementById('sec_id').value = s.id; document.getElementById('sec_module_id').value = s.module_id; document.getElementById('sec_title').value = s.title; document.getElementById('sec_order').value = s.ordem; new bootstrap.Modal(document.getElementById('modalSection')).show(); };
window.excluir = async (tbl, id) => { if(confirm('Apagar?')) { await supabase.from(tbl).delete().eq('id', id); loadCourseData(); } };
window.verPreview = (item) => { 
    document.getElementById('previewHeader').innerText = item.title; 
    document.getElementById('previewContent').innerHTML = item.description || 'Sem descrição'; 
    new bootstrap.Offcanvas(document.getElementById('drawerPreview')).show(); 
};