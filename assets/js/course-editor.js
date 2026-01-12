/* ARQUIVO: assets/js/course-editor.js */
import { supabase } from './supabaseClient.js';

// --- VARIÁVEIS GLOBAIS ---
const params = new URLSearchParams(window.location.search);
const courseId = params.get('id');

// Estrutura local para renderização
let dadosCurso = {
    id: null,
    titulo: "",
    status: "draft",
    descricao: "",
    modulos: []
};

// --- 1. INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', async () => {
    if (!courseId) {
        alert("ID do curso não fornecido na URL.");
        return;
    }

    await checkAuth();
    await loadCourseData(); 
    configurarEventos();
});

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) window.location.href = 'login.html';
}

// --- 2. CARREGAMENTO DE DADOS ---
async function loadCourseData() {
    try {
        // 1. Busca Curso
        const { data: course, error: errCourse } = await supabase
            .from('courses')
            .select('*')
            .eq('id', courseId)
            .single();

        if (errCourse) throw errCourse;

        dadosCurso.id = course.id;
        dadosCurso.titulo = course.title || course.titulo; 
        dadosCurso.status = course.status;
        dadosCurso.descricao = course.description || course.descricao;

        // Atualiza Interface
        document.getElementById('header-title').innerText = dadosCurso.titulo;
        document.getElementById('course-id-badge').innerText = `ID: ${course.id}`;
        
        document.getElementById('edit_title').value = dadosCurso.titulo;
        document.getElementById('edit_status').value = dadosCurso.status || 'draft';
        document.getElementById('edit_desc').value = dadosCurso.descricao || '';

        // 2. Busca Módulos, Seções e Aulas
        const { data: modules, error: errModules } = await supabase
            .from('modules')
            .select(`
                *,
                sections (
                    *,
                    lessons (*)
                )
            `)
            .eq('course_id', courseId)
            .order('ordem', { ascending: true });

        if (errModules) throw errModules;

        // Organiza hierarquia
        if (modules) {
            modules.forEach(mod => {
                mod.secoes = mod.sections || [];
                mod.secoes.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

                mod.secoes.forEach(sec => {
                    // Mapeia lessons para 'conteudos'
                    sec.conteudos = sec.lessons || [];
                    sec.conteudos.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
                });
            });
            dadosCurso.modulos = modules;
        }

        renderizarGrade();

    } catch (error) {
        console.error("Erro ao carregar dados:", error);
    }
}

// --- 3. RENDERIZAÇÃO ---
function renderizarGrade() {
    const container = document.getElementById('modules-list');
    const emptyState = document.getElementById('modules-empty');
    container.innerHTML = '';

    if (!dadosCurso.modulos || dadosCurso.modulos.length === 0) {
        if(emptyState) emptyState.style.display = 'block';
        return;
    }
    if(emptyState) emptyState.style.display = 'none';

    const tplModule = document.getElementById('tpl-module');
    const tplSection = document.getElementById('tpl-section');
    const tplLesson = document.getElementById('tpl-lesson');
    const tplBtnQuiz = document.getElementById('tpl-btn-quiz');

    dadosCurso.modulos.forEach(mod => {
        const modClone = tplModule.content.cloneNode(true);
        modClone.querySelector('.mod-badge').innerText = `#${mod.ordem}`;
        modClone.querySelector('.mod-title').innerText = mod.title || mod.titulo; 
        
        const collapseId = `collapse-mod-${mod.id}`;
        modClone.querySelector('.module-header').setAttribute('data-bs-target', `#${collapseId}`);
        modClone.querySelector('.mod-collapse').id = collapseId;

        modClone.querySelector('.btn-edit').onclick = (e) => { e.stopPropagation(); editarModulo(mod); };
        modClone.querySelector('.btn-del').onclick = (e) => { e.stopPropagation(); excluirGenerico('modules', mod.id); };
        modClone.querySelector('.btn-add-sec').onclick = (e) => { abrirModalSecao(mod.id, e); };

        const secoesContainer = modClone.querySelector('.sections-container');

        if (mod.secoes) {
            mod.secoes.forEach(sec => {
                const secClone = tplSection.content.cloneNode(true);
                secClone.querySelector('.sec-title').innerText = sec.title || sec.titulo;
                
                secClone.querySelector('.btn-add-content').onclick = () => abrirModalConteudo(mod.id, sec.id);
                secClone.querySelector('.btn-edit').onclick = () => editarSecao(sec);
                secClone.querySelector('.btn-del').onclick = () => excluirGenerico('sections', sec.id);

                const contentContainer = secClone.querySelector('.content-container');

                if (sec.conteudos) {
                    sec.conteudos.forEach(cont => {
                        const lessonClone = tplLesson.content.cloneNode(true);
                        
                        let icone = 'bx-file', classeIcone = 'ic-doc';
                        const tipo = (cont.type || 'TEXTO').toUpperCase();
                        
                        if (tipo === 'VIDEO_AULA') { icone = 'bx-play'; classeIcone = 'ic-video'; }
                        if (tipo === 'QUIZ') { icone = 'bx-trophy'; classeIcone = 'ic-task'; }

                        const iconEl = lessonClone.querySelector('.icon-circle');
                        iconEl.className = `icon-circle ${classeIcone}`;
                        iconEl.innerHTML = `<i class='bx ${icone}'></i>`;

                        lessonClone.querySelector('.lesson-title').innerText = cont.title;
                        lessonClone.querySelector('.lesson-type').innerText = tipo;

                        if (cont.points > 0) {
                            const badge = lessonClone.querySelector('.lesson-points');
                            badge.innerText = `${cont.points} pts`;
                            badge.style.display = 'inline-block';
                        }

                        // Preview
                        lessonClone.querySelector('.lesson-click-area').onclick = () => verPreview(cont);

                        // Botão Quiz
                        const actionArea = lessonClone.querySelector('.actions-area');
                        if (tipo === 'QUIZ') {
                            const btnQuizClone = tplBtnQuiz.content.cloneNode(true);
                            btnQuizClone.querySelector('a').href = `quiz-builder.html?id=${cont.id}`; 
                            actionArea.insertBefore(btnQuizClone, actionArea.firstChild);
                        }

                        lessonClone.querySelector('.btn-preview').onclick = () => verPreview(cont);
                        lessonClone.querySelector('.btn-edit').onclick = () => editarConteudo(cont, mod.id, sec.id);
                        lessonClone.querySelector('.btn-del').onclick = () => excluirGenerico('lessons', cont.id);

                        contentContainer.appendChild(lessonClone);
                    });
                }
                secoesContainer.appendChild(secClone);
            });
        }
        container.appendChild(modClone);
    });
}

// --- 4. PREVIEW ---
window.verPreview = function(item) {
    if (!item) return;
    const tipo = (item.type || 'TEXTO').toUpperCase();
    
    document.getElementById('previewHeader').innerText = item.title;
    document.getElementById('previewDesc').innerText = `${tipo}`;

    const previewContent = document.getElementById('previewContent');
    const quizArea = document.getElementById('quiz-action-area');
    const btnQuiz = document.getElementById('btn-config-quiz');

    if (tipo === 'QUIZ') {
        quizArea.style.display = 'block';
        btnQuiz.href = `quiz-builder.html?id=${item.id}`;
        previewContent.innerHTML = `<div class="text-center p-5"><i class='bx bx-trophy fs-1 text-warning mb-3'></i><h5>Quiz Interativo</h5></div>`;
    } else {
        quizArea.style.display = 'none';
        if (item.content_url && item.content_url.includes('http')) {
            let url = item.content_url;
            if(url.includes('youtube.com/watch')) url = url.replace('watch?v=', 'embed/');
            previewContent.innerHTML = `<iframe src="${url}" width="100%" height="100%" style="min-height:400px; border:0" allowfullscreen></iframe>`;
        } else {
            previewContent.innerHTML = `<div class="p-4">${item.description || 'Sem descrição.'}</div>`;
        }
    }
    new bootstrap.Offcanvas(document.getElementById('drawerPreview')).show();
};

// --- 5. FUNÇÕES DE MODAL E SALVAR (CORRIGIDO PARA O SEU SCHEMA) ---

// === SALVAR CURSO ===
document.getElementById('formEditCourse').addEventListener('submit', async (e) => {
    e.preventDefault();
    const updates = {
        title: document.getElementById('edit_title').value,
        status: document.getElementById('edit_status').value,
        description: document.getElementById('edit_desc').value
    };
    const { error } = await supabase.from('courses').update(updates).eq('id', courseId);
    if (error) alert("Erro: " + error.message);
    else { alert("Curso salvo!"); loadCourseData(); }
});

// === MÓDULO ===
window.openModuleModal = () => { 
    document.getElementById('formModule').reset(); 
    document.getElementById('mod_id').value = ''; 
    new bootstrap.Modal(document.getElementById('modalModule')).show(); 
};

window.editarModulo = (mod) => {
    document.getElementById('mod_id').value = mod.id;
    document.getElementById('mod_title').value = mod.title || mod.titulo;
    document.getElementById('mod_order').value = mod.ordem;
    new bootstrap.Modal(document.getElementById('modalModule')).show();
};

document.getElementById('formModule').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('mod_id').value;
    
    const data = {
        course_id: parseInt(courseId), 
        title: document.getElementById('mod_title').value,
        ordem: parseInt(document.getElementById('mod_order').value) || 1
    };

    let error;
    if (id) ({ error } = await supabase.from('modules').update(data).eq('id', id));
    else ({ error } = await supabase.from('modules').insert(data));

    if (error) alert("Erro ao salvar módulo: " + error.message);
    else {
        bootstrap.Modal.getInstance(document.getElementById('modalModule')).hide();
        loadCourseData();
    }
});

// === SEÇÃO ===
window.abrirModalSecao = (mId, e) => { 
    if(e) e.stopPropagation(); 
    document.getElementById('formSection').reset(); 
    document.getElementById('sec_id').value = '';
    document.getElementById('sec_module_id').value = mId; 
    new bootstrap.Modal(document.getElementById('modalSection')).show(); 
};

window.editarSecao = (sec) => {
    document.getElementById('sec_id').value = sec.id;
    document.getElementById('sec_module_id').value = sec.module_id; 
    document.getElementById('sec_title').value = sec.title || sec.titulo;
    document.getElementById('sec_order').value = sec.ordem;
    new bootstrap.Modal(document.getElementById('modalSection')).show();
};

document.getElementById('formSection').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('sec_id').value;
    const data = {
        module_id: parseInt(document.getElementById('sec_module_id').value),
        title: document.getElementById('sec_title').value,
        ordem: parseInt(document.getElementById('sec_order').value) || 1
    };

    let error;
    if (id) ({ error } = await supabase.from('sections').update(data).eq('id', id));
    else ({ error } = await supabase.from('sections').insert(data));

    if (error) alert("Erro ao salvar seção: " + error.message);
    else {
        bootstrap.Modal.getInstance(document.getElementById('modalSection')).hide();
        loadCourseData();
    }
});

// === AULA / CONTEÚDO (LESSONS) - MAPPED TO SCHEMA ===
window.abrirModalConteudo = (mId, sId) => {
    document.getElementById('formLesson').reset();
    document.getElementById('les_id').value = '';
    // Importante: Estes IDs ocultos garantem o relacionamento correto
    document.getElementById('les_module_id').value = mId; 
    document.getElementById('les_section_id').value = sId;
    
    // Defaults visuais
    if(document.getElementById('les_published')) document.getElementById('les_published').checked = true;
    if(document.getElementById('les_required')) document.getElementById('les_required').checked = true;
    
    new bootstrap.Modal(document.getElementById('modalLesson')).show();
};

window.editarConteudo = (item, mId, sId) => {
    document.getElementById('les_id').value = item.id;
    document.getElementById('les_module_id').value = mId;
    document.getElementById('les_section_id').value = sId;
    
    // Mapeamento Banco -> Form
    document.getElementById('les_title').value = item.title;
    document.getElementById('les_type').value = item.type; 
    document.getElementById('les_url').value = item.content_url || '';
    document.getElementById('les_points').value = item.points || 0;
    
    if(document.getElementById('les_desc')) document.getElementById('les_desc').value = item.description || '';
    
    // Datas (available_from/until)
    if(item.available_from) document.getElementById('les_start').value = item.available_from.slice(0,16);
    if(item.available_until) document.getElementById('les_end').value = item.available_until.slice(0,16);
    
    document.getElementById('les_published').checked = item.is_published !== false;
    document.getElementById('les_required').checked = item.is_required !== false;
    
    new bootstrap.Modal(document.getElementById('modalLesson')).show();
};

document.getElementById('formLesson').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('les_id').value;
    
    // MAPEAMENTO CORRETO: Form -> Banco
    const data = {
        module_id: parseInt(document.getElementById('les_module_id').value), // OBRIGATÓRIO (NOT NULL)
        section_id: parseInt(document.getElementById('les_section_id').value) || null,
        
        title: document.getElementById('les_title').value,
        type: document.getElementById('les_type').value,
        content_url: document.getElementById('les_url').value || null,
        points: parseFloat(document.getElementById('les_points').value) || 0,
        description: document.getElementById('les_desc').value || null,
        
        is_published: document.getElementById('les_published').checked,
        is_required: document.getElementById('les_required').checked,
        
        // Datas
        available_from: document.getElementById('les_start').value || null,
        available_until: document.getElementById('les_end').value || null
    };

    console.log("Enviando para Supabase:", data); // Debug no console

    let error;
    if (id) {
        ({ error } = await supabase.from('lessons').update(data).eq('id', id));
    } else {
        ({ error } = await supabase.from('lessons').insert(data));
    }

    if (error) {
        console.error("Erro Supabase:", error);
        alert("Erro ao salvar aula: " + error.message);
    } else {
        bootstrap.Modal.getInstance(document.getElementById('modalLesson')).hide();
        loadCourseData();
    }
});

// === EXCLUIR ===
window.excluirGenerico = async (table, id) => {
    if(!confirm('Confirma exclusão?')) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if(error) alert("Erro: " + error.message);
    else loadCourseData();
};

function configurarEventos() {
    // Eventos já configurados
}

// ... (Todo o código anterior) ...

// ============================================================
// LÓGICA DO BANCO DE QUESTÕES (REUSO)
// ============================================================

let globalQuestionsBank = []; // Cache temporário das questões carregadas

window.openQuestionBank = async function() {
    const modal = new bootstrap.Modal(document.getElementById('modalBank'));
    modal.show();

    // Limpa e mostra loading
    const container = document.getElementById('bank-list');
    container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div><p>Buscando questões...</p></div>';

    // 1. Busca todas as lições que têm quiz_data (exceto a atual)
    const { data: lessons, error } = await supabase
        .from('lessons')
        .select('id, title, quiz_data')
        .not('quiz_data', 'is', null)
        .neq('id', lessonId); // Não buscar da própria aula

    if (error) {
        container.innerHTML = `<div class="alert alert-danger">Erro ao buscar banco: ${error.message}</div>`;
        return;
    }

    // 2. Processa e unifica as questões
    globalQuestionsBank = [];
    const sources = new Set();

    lessons.forEach(lesson => {
        // Verifica se o quiz_data tem o formato novo (obj) ou antigo (array)
        let qArray = [];
        if (Array.isArray(lesson.quiz_data)) {
            qArray = lesson.quiz_data;
        } else if (lesson.quiz_data && lesson.quiz_data.questions) {
            qArray = lesson.quiz_data.questions;
        }

        if (qArray.length > 0) {
            sources.add(lesson.title);
            qArray.forEach(q => {
                globalQuestionsBank.push({
                    source: lesson.title, // De onde veio
                    originalData: q // Os dados da questão (enunciado, opções...)
                });
            });
        }
    });

    // 3. Preenche o Select de Filtro de Fontes
    const sourceSelect = document.getElementById('bank-source-filter');
    sourceSelect.innerHTML = '<option value="">Todas as Aulas (Fontes)</option>';
    sources.forEach(source => {
        sourceSelect.innerHTML += `<option value="${source}">${source}</option>`;
    });

    // 4. Renderiza a lista
    renderBankList(globalQuestionsBank);
};

function renderBankList(questions) {
    const container = document.getElementById('bank-list');
    container.innerHTML = '';

    if (questions.length === 0) {
        container.innerHTML = '<div class="alert alert-warning">Nenhuma questão encontrada em outras aulas.</div>';
        return;
    }

    questions.forEach((item, index) => {
        const q = item.originalData;
        const textPreview = q.text ? q.text.substring(0, 120) + '...' : '(Sem enunciado)';
        
        // Cria o card da questão no banco
        const div = document.createElement('div');
        div.className = 'card p-3 shadow-sm border-0 bank-item-row';
        div.dataset.search = (q.text || '').toLowerCase(); // Para filtro rápido
        div.dataset.source = item.source; // Para filtro de fonte

        div.innerHTML = `
            <div class="d-flex gap-3 align-items-start">
                <div class="form-check">
                    <input class="form-check-input bank-checkbox" type="checkbox" value="${index}" style="transform: scale(1.3);">
                </div>
                <div class="flex-grow-1 cursor-pointer" onclick="this.previousElementSibling.querySelector('input').click()">
                    <div class="d-flex justify-content-between mb-1">
                        <span class="badge bg-light text-dark border">${item.source}</span>
                        <span class="badge bg-secondary">${q.options ? q.options.length : 0} alternativas</span>
                    </div>
                    <p class="mb-0 fw-bold text-dark" style="font-size: 0.95rem;">${q.text}</p>
                    ${q.feedback ? `<small class="text-muted"><i class='bx bx-message-detail'></i> Com feedback cadastrado</small>` : ''}
                </div>
            </div>
        `;
        container.appendChild(div);
    });

    // Listener para contar selecionados
    document.querySelectorAll('.bank-checkbox').forEach(chk => {
        chk.addEventListener('change', updateBankCount);
    });
}

// Filtro em tempo real (Search + Dropdown)
window.filterBank = function() {
    const term = document.getElementById('bank-search').value.toLowerCase();
    const source = document.getElementById('bank-source-filter').value;
    const rows = document.querySelectorAll('.bank-item-row');

    rows.forEach(row => {
        const textMatch = row.dataset.search.includes(term);
        const sourceMatch = source === "" || row.dataset.source === source;

        if (textMatch && sourceMatch) {
            row.style.display = 'block';
        } else {
            row.style.display = 'none';
        }
    });
};

function updateBankCount() {
    const count = document.querySelectorAll('.bank-checkbox:checked').length;
    document.getElementById('bank-selected-count').textContent = count;
}

// Ação Final: Importar
window.importFromBank = function() {
    const checkboxes = document.querySelectorAll('.bank-checkbox:checked');
    let added = 0;

    checkboxes.forEach(chk => {
        const index = parseInt(chk.value);
        const bankItem = globalQuestionsBank[index];
        
        if (bankItem) {
            // CLONAGEM PROFUNDA (Importante para não linkar por referência)
            // Gera um novo ID para a questão importada
            const newQuestion = JSON.parse(JSON.stringify(bankItem.originalData));
            newQuestion.id = Date.now() + Math.random(); 
            
            quizData.questions.push(newQuestion);
            added++;
        }
    });

    if (added > 0) {
        renderQuestions();
        updatePointsDisplay();
        
        // Fecha o modal
        const modalEl = document.getElementById('modalBank');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();

        // Feedback visual
        alert(`${added} questões importadas com sucesso!`);
        
        // Rola até o final
        setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 300);
    } else {
        alert("Selecione pelo menos uma questão.");
    }
};