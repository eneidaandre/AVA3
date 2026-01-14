import { supabase } from './supabaseClient.js';

const params = new URLSearchParams(window.location.search);
const classId = params.get('id') || params.get('classId');

let enrollment = null;
let flatLessons = [];
let courseModules = []; 
let currentLesson = null;
let quizState = { data: null, currentIndex: -1, answers: {}, isFinished: false };

const ICONS = { 
    'VIDEO_AULA': 'bx-play-circle', 
    'VIDEO': 'bx-movie-play',
    'AUDIO': 'bx-headphone',
    'PODCAST': 'bx-podcast',
    'PDF': 'bxs-file-pdf', 
    'QUIZ': 'bx-trophy', 
    'TAREFA': 'bx-task',
    'MATERIAL': 'bx-link',
    'default': 'bx-file' 
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!classId) { window.location.href = 'app.html'; return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) window.location.href = 'login.html';

    try {
        await loadEnrollment(session.user.id);
        await loadCourse();
        
        if (flatLessons.length > 0) {
            const validIds = flatLessons.map(l => l.id);
            enrollment.grades.completed = enrollment.grades.completed.filter(id => validIds.includes(id));
            
            const next = flatLessons.find(l => !enrollment.grades.completed.includes(l.id)) || flatLessons[0];
            openLesson(next);
        }
        
        updateOverallProgress();
        checkUnreadMural(); 
    } catch (error) { console.error("Erro:", error); }
});

async function loadEnrollment(userId) {
    const { data, error } = await supabase.from('class_enrollments').select('*').eq('class_id', classId).eq('user_id', userId).single();
    if (error || !data) throw new Error("Sem matrícula");
    enrollment = data;
    if (!enrollment.grades) enrollment.grades = { completed: [], scores: {} };
    if (!enrollment.grades.scores) enrollment.grades.scores = {};
    enrollment.grades.completed = [...new Set(enrollment.grades.completed)];
}

async function loadCourse() {
    // 1. Busca dados da Turma e Curso
    const { data: cls } = await supabase.from('classes').select('*, courses(title)').eq('id', classId).single();
    if (cls) {
        document.getElementById('header-course-title').textContent = cls.courses?.title || 'Curso';
        document.getElementById('header-class-name').textContent = cls.name;
    }

    // 2. Busca Conteúdo (Módulos -> Seções -> Aulas)
    const { data: modules } = await supabase
        .from('modules')
        .select(`
            *, 
            sections (
                *, 
                lessons (*)
            )
        `)
        .eq('course_id', cls.course_id)
        .order('ordem', { ascending: true }); // Ordena módulos no banco
    
    // === LÓGICA DE ORDENAÇÃO RIGOROSA (CORREÇÃO PEDIDA) ===
    if (modules) {
        // Ordena Módulos (garantia extra)
        modules.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

        modules.forEach(mod => {
            // Ordena Seções dentro do módulo
            if (mod.sections) {
                mod.sections.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
                
                mod.sections.forEach(sec => {
                    // Ordena Aulas dentro da seção
                    if (sec.lessons) {
                        sec.lessons.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
                    }
                });
            }
        });
    }

    courseModules = modules; 

    const container = document.getElementById('modules-list');
    container.innerHTML = ''; flatLessons = [];
    
    // 3. Renderiza na tela
    modules.forEach((mod, index) => {
        const modId = `mod-${mod.id}`;
        let lessonsHtml = '';
        let modLessonIds = [];

        mod.sections.forEach(sec => {
            // Título da Seção
            if (sec.title) {
                lessonsHtml += `<div class="section-title">${sec.title}</div>`;
            }

            if (sec.lessons) {
                sec.lessons.forEach(l => {
                    // Ignora aulas não publicadas (opcional, mas recomendado para aluno)
                    if (l.is_published === false) return;

                    flatLessons.push(l);
                    modLessonIds.push(l.id);
                    
                    const isDone = enrollment.grades.completed.includes(l.id);
                    const iconClass = ICONS[l.type] || ICONS.default;

                    lessonsHtml += `
                        <div class="lesson-item ${isDone?'completed':''}" id="lesson-${l.id}" onclick="window.openLessonById(${l.id})">
                            <i class='bx ${iconClass} fs-5'></i>
                            <span class="text-truncate flex-grow-1">${l.title}</span>
                            ${isDone ? "<i class='bx bxs-check-circle text-success'></i>" : ""}
                        </div>`;
                });
            }
        });

        // Cálculo de Progresso do Módulo
        const modTotal = modLessonIds.length;
        const modDone = modLessonIds.filter(id => enrollment.grades.completed.includes(id)).length;
        let pct = modTotal > 0 ? Math.round((modDone/modTotal)*100) : 0;
        if(pct > 100) pct = 100;

        const colorClass = pct === 100 ? 'text-success' : 'text-muted';
        const showClass = index === 0 ? 'show' : '';
        const collapsedBtn = index === 0 ? '' : 'collapsed';

        // Renderiza o Acordeão do Módulo
        container.innerHTML += `
            <div class="accordion-item">
                <h2 class="accordion-header">
                    <button class="accordion-button ${collapsedBtn}" type="button" data-bs-toggle="collapse" data-bs-target="#${modId}">
                        <div class="d-flex w-100 justify-content-between me-2 align-items-center">
                            <span>${mod.title}</span>
                            <div class="d-flex align-items-center">
                                <div class="mod-progress-track me-2"><div class="mod-progress-bar" style="width:${pct}%"></div></div>
                                <small class="fw-bold ${colorClass}" style="font-size:0.75rem;">${pct}%</small>
                            </div>
                        </div>
                    </button>
                </h2>
                <div id="${modId}" class="accordion-collapse collapse ${showClass}" data-bs-parent="#modules-list">
                    <div class="accordion-body p-0">${lessonsHtml}</div>
                </div>
            </div>`;
    });
}

window.openLessonById = (id) => { const l = flatLessons.find(x => x.id === id); if(l) openLesson(l); };

function openLesson(lesson) {
    currentLesson = lesson;
    forceSwitchToContent();
    document.querySelectorAll('.lesson-item').forEach(el => el.classList.remove('active'));
    const activeItem = document.getElementById(`lesson-${lesson.id}`);
    if(activeItem) activeItem.classList.add('active');
    
    document.getElementById('lbl-title').textContent = lesson.title;
    document.getElementById('lbl-type').textContent = lesson.type; // Exibe o tipo
    document.getElementById('lbl-desc').innerHTML = lesson.description || '';
    
    const activity = document.getElementById('activity-area');
    const playerFrame = document.getElementById('player-frame');
    activity.innerHTML = ''; 
    playerFrame.style.display = 'none'; 
    playerFrame.innerHTML = '';

    const url = getEmbedUrl(lesson.video_url || lesson.content_url);

    // 1. VIDEO
    if (lesson.type === 'VIDEO_AULA' || lesson.type === 'VIDEO') {
        playerFrame.style.display = 'flex';
        playerFrame.innerHTML = `<iframe src="${url}" allowfullscreen></iframe>`;
    } 
    // 2. AUDIO
    else if (lesson.type === 'AUDIO' || lesson.type === 'PODCAST') {
        activity.innerHTML = `
            <div class="audio-container">
                <i class='bx bx-headphone display-1 text-primary mb-3'></i>
                <h4 class="mb-3">Reproduzir Áudio</h4>
                <audio controls><source src="${url}" type="audio/mpeg">Navegador sem suporte.</audio>
            </div>`;
    }
    // 3. PDF / DRIVE
    else if ((lesson.type === 'PDF' || lesson.type === 'MATERIAL') && url) {
        if(url.includes('drive.google.com') || url.endsWith('.pdf')) {
             activity.innerHTML = `<iframe class="pdf-viewer" src="${url}"></iframe>`;
        } else {
             activity.innerHTML = `<div class="text-center p-5 border rounded"><i class='bx bx-link-external fs-1'></i><p class="mt-2">Conteúdo Externo</p></div>`;
        }
        activity.innerHTML += `
            <div class="d-flex justify-content-end mt-3 p-2 bg-light rounded border">
                <a href="${lesson.content_url}" target="_blank" class="btn btn-primary btn-sm fw-bold"><i class='bx bxs-download me-1'></i> Baixar / Abrir</a>
            </div>`;
    }
    // 4. QUIZ
    else if (lesson.type === 'QUIZ') {
        const score = enrollment.grades.scores ? enrollment.grades.scores[lesson.id] : undefined;
        if (enrollment.grades.completed.includes(lesson.id) && score !== undefined) {
            activity.innerHTML = `<div class="text-center p-5 bg-white border rounded shadow-sm"><h3 class="text-success">Concluído</h3><p>Nota: ${score} / ${lesson.points}</p></div>`;
        } else {
            initQuiz(lesson);
        }
    }
    // 5. TAREFA
    else if (lesson.type === 'TAREFA') {
        activity.innerHTML = `<div class="text-center p-5 border rounded"><i class='bx bx-task fs-1 text-primary'></i><h4>Tarefa</h4><p>Envie sua atividade conforme as instruções acima.</p><button class="btn btn-primary">Enviar Resposta</button></div>`;
    }

    updateFinishButton();
}

function forceSwitchToContent() {
    const tabAulaBtn = document.querySelector('button[data-bs-target="#tab-aula"]');
    if (tabAulaBtn && !tabAulaBtn.classList.contains('active')) {
        const tabInstance = bootstrap.Tab.getOrCreateInstance(tabAulaBtn);
        tabInstance.show();
    }
}

function getEmbedUrl(url) { 
    if(!url) return '';
    if (url.includes('watch?v=')) return url.replace('watch?v=', 'embed/'); 
    if (url.includes('youtu.be/')) return url.replace('youtu.be/', 'youtube.com/embed/');
    if (url.includes('drive.google.com') && url.includes('/view')) return url.replace('/view', '/preview');
    return url; 
}

function updateOverallProgress() {
    const total = flatLessons.length;
    const validCompleted = enrollment.grades.completed.filter(id => flatLessons.some(l => l.id === id));
    const done = validCompleted.length;
    let pct = total === 0 ? 0 : Math.round((done / total) * 100);
    if (pct > 100) pct = 100;
    document.getElementById('overall-progress').style.width = `${pct}%`;
    document.getElementById('progress-text').textContent = `${pct}%`;
}

// ... (RESTANTE MANTIDO IGUAL) ...
window.toggleLessonStatus = async () => { if (currentLesson.type === 'QUIZ') return; const isDone = enrollment.grades.completed.includes(currentLesson.id); if (isDone) { enrollment.grades.completed = enrollment.grades.completed.filter(id => id !== currentLesson.id); const item = document.getElementById(`lesson-${currentLesson.id}`); if(item) { item.classList.remove('completed'); const icon = item.querySelector('.bxs-check-circle'); if(icon) icon.remove(); } } else { enrollment.grades.completed.push(currentLesson.id); const item = document.getElementById(`lesson-${currentLesson.id}`); if(item) { item.classList.add('completed'); if(!item.querySelector('.bxs-check-circle')) { item.insertAdjacentHTML('beforeend', "<i class='bx bxs-check-circle text-success'></i>"); } } } await supabase.from('class_enrollments').update({ grades: enrollment.grades }).eq('id', enrollment.id); updateOverallProgress(); loadCourse(); updateFinishButton(); };
function updateFinishButton() { const btn = document.getElementById('btn-finish'); const isDone = enrollment.grades.completed.includes(currentLesson.id); btn.onclick = window.toggleLessonStatus; if (currentLesson.type === 'QUIZ') { if (isDone) { btn.innerHTML = "<i class='bx bx-check-double'></i> Enviado"; btn.className = "btn btn-success rounded-pill fw-bold"; btn.disabled = true; } else { btn.innerHTML = "Pendente"; btn.className = "btn btn-secondary rounded-pill fw-bold"; btn.disabled = true; } } else { btn.disabled = false; if (isDone) { btn.innerHTML = "<i class='bx bx-check'></i> Concluído"; btn.className = "btn btn-success rounded-pill fw-bold"; btn.title = "Clique para desmarcar"; } else { btn.innerHTML = "Concluir Aula"; btn.className = "btn btn-outline-success rounded-pill fw-bold"; } } }
window.loadGrades = () => { const container = document.getElementById('grades-list'); container.innerHTML = ''; let hasGrades = false; const scores = enrollment.grades.scores || {}; courseModules.forEach(mod => { let modHtml = `<div class="grades-module-card"><div class="grades-module-header">${mod.title}</div><div>`; let countInMod = 0; mod.sections.forEach(sec => { if(sec.lessons) sec.lessons.forEach(l => { if (l.points && l.points > 0) { hasGrades = true; countInMod++; const userScore = scores[l.id] !== undefined ? scores[l.id] : '-'; const statusBadge = userScore !== '-' ? '<span class="badge bg-success">Entregue</span>' : '<span class="badge bg-warning text-dark">Pendente</span>'; const scoreClass = userScore !== '-' ? 'done' : ''; modHtml += `<div class="grade-item-row"><div class="grade-info"><span class="grade-section-label">${sec.title || 'Atividade'}</span><span class="grade-title">${l.title}</span></div><div class="grade-status text-end"><div class="mb-1">${statusBadge}</div><span class="grade-score-box ${scoreClass}">${userScore} / ${l.points}</span></div></div>`; } }); }); modHtml += `</div></div>`; if (countInMod > 0) container.innerHTML += modHtml; }); if (!hasGrades) container.innerHTML = '<div class="alert alert-info text-center">Nenhuma atividade avaliativa.</div>'; };
function getReadPosts() { const key = `ava3_read_posts_${enrollment.id}`; return JSON.parse(localStorage.getItem(key) || '[]'); }
window.markPostRead = (postId, btn) => { const key = `ava3_read_posts_${enrollment.id}`; let read = getReadPosts(); if (!read.includes(postId)) { read.push(postId); localStorage.setItem(key, JSON.stringify(read)); const card = btn.closest('.wall-post'); card.classList.remove('unread'); const indicator = card.querySelector('.new-badge'); if(indicator) indicator.remove(); btn.outerHTML = `<span class="btn-mark-read read"><i class='bx bx-check-double'></i> Lido</span>`; checkUnreadMural(); } };
async function checkUnreadMural() { const { data: posts } = await supabase.from('class_posts').select('id').eq('class_id', classId); if (!posts) return; const read = getReadPosts(); const unreadCount = posts.filter(p => !read.includes(p.id)).length; const badge = document.getElementById('mural-badge'); if (badge) { if (unreadCount > 0) { badge.style.display = 'inline-block'; badge.textContent = unreadCount > 9 ? '9+' : unreadCount; } else { badge.style.display = 'none'; } } }
function initQuiz(lesson) { let qs = lesson.quiz_data?.questions || []; quizState = { data: { questions: qs }, currentIndex: -1, answers: {}, isFinished: false }; renderQuizStep(); }
function renderQuizStep() { const container = document.getElementById('activity-area'); const { data, currentIndex, answers, isFinished } = quizState; if (isFinished) { container.innerHTML = `<div class="text-center p-5 bg-light border rounded"><h3>Finalizado</h3></div>`; return; } if (currentIndex === -1) { container.innerHTML = `<div class="text-center p-5"><button class="btn btn-primary" onclick="window.nextQuizStep()">Iniciar Quiz</button></div>`; return; } const q = data.questions[currentIndex]; container.innerHTML = `<h5>${q.text}</h5>` + q.options.map((o,i)=>`<div class="quiz-option-card" onclick="window.saveAns(${i})"><input type="radio" name="q" ${answers[currentIndex]==i?'checked':''}> ${o.text||o}</div>`).join('') + `<div class="mt-3"><button class="btn btn-primary" onclick="window.nextQuizStep()">Próxima</button></div>`; }
window.nextQuizStep = () => { if (quizState.currentIndex < quizState.data.questions.length - 1) { quizState.currentIndex++; renderQuizStep(); } else { quizState.isFinished = true; calculateAndSaveScore(); } };
window.saveAns = (i) => { quizState.answers[quizState.currentIndex] = i; renderQuizStep(); };
async function calculateAndSaveScore() { let correct = 0; quizState.data.questions.forEach((q, i) => { if(q.options[quizState.answers[i]]?.isCorrect) correct++; }); const maxPoints = currentLesson.points || 0; const score = maxPoints > 0 ? (correct / quizState.data.questions.length) * maxPoints : 0; if (!enrollment.grades.completed.includes(currentLesson.id)) { enrollment.grades.completed.push(currentLesson.id); } if (!enrollment.grades.scores) enrollment.grades.scores = {}; enrollment.grades.scores[currentLesson.id] = parseFloat(score.toFixed(1)); await supabase.from('class_enrollments').update({ grades: enrollment.grades }).eq('id', enrollment.id); loadCourse(); updateOverallProgress(); openLesson(currentLesson); }
window.loadCertificate = () => { console.log("Aba certificado aberta"); };
window.loadCalendar = () => { document.getElementById('calendar-feed').innerHTML = '<div class="alert alert-light border">Agenda vazia.</div>'; };