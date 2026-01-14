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
    
    // Garante que completed seja um array único para evitar duplicatas na contagem
    enrollment.grades.completed = [...new Set(enrollment.grades.completed)];
}

async function loadCourse() {
    const { data: cls } = await supabase.from('classes').select('*, courses(title)').eq('id', classId).single();
    if (cls) {
        document.getElementById('header-course-title').textContent = cls.courses?.title || 'Curso';
        document.getElementById('header-class-name').textContent = cls.name;
    }
    const { data: modules } = await supabase.from('modules').select(`*, sections(*, lessons(*))`).eq('course_id', cls.course_id).order('ordem');
    
    courseModules = modules; 

    const container = document.getElementById('modules-list');
    container.innerHTML = ''; flatLessons = [];
    
    modules.forEach((mod, index) => {
        const modId = `mod-${mod.id}`;
        let lessonsHtml = '';
        
        // Contadores locais do módulo
        let modLessonIds = [];

        mod.sections.forEach(sec => {
            if (sec.title && sec.lessons && sec.lessons.length > 0) {
                lessonsHtml += `<div class="section-title">${sec.title}</div>`;
            }

            sec.lessons.forEach(l => {
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
        });

        // CÁLCULO PRECISO DO MÓDULO
        const modTotal = modLessonIds.length;
        // Conta quantos dos IDs deste módulo estão na lista de concluídos
        const modDone = modLessonIds.filter(id => enrollment.grades.completed.includes(id)).length;
        
        let pct = modTotal > 0 ? Math.round((modDone/modTotal)*100) : 0;
        if(pct > 100) pct = 100;

        const colorClass = pct === 100 ? 'text-success' : 'text-muted';
        const showClass = index === 0 ? 'show' : '';
        const collapsedBtn = index === 0 ? '' : 'collapsed';

        container.innerHTML += `
            <div class="accordion-item">
                <h2 class="accordion-header">
                    <button class="accordion-button ${collapsedBtn}" type="button" data-bs-toggle="collapse" data-bs-target="#${modId}">
                        <div class="d-flex w-100 justify-content-between me-2 align-items-center">
                            <span>${mod.title}</span>
                            <div class="d-flex align-items-center">
                                <div class="mod-progress-track me-2"><div class="mod-progress-bar" style="width:${pct}%"></div></div>
                                <small class="fw-bold ${colorClass}">${pct}%</small>
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
                <h4 class="mb-3">${lesson.title}</h4>
                <audio controls><source src="${url}" type="audio/mpeg">Navegador sem suporte.</audio>
            </div>`;
    }
    // 3. PDF / DRIVE (COM BOTÃO DE DOWNLOAD)
    else if ((lesson.type === 'PDF' || lesson.type === 'MATERIAL') && url) {
        if(url.includes('drive.google.com') || url.endsWith('.pdf')) {
             activity.innerHTML = `<iframe class="pdf-viewer" src="${url}"></iframe>`;
        } else {
             activity.innerHTML = `<div class="text-center p-5 border rounded"><i class='bx bx-link-external fs-1'></i><p class="mt-2">Conteúdo Externo</p></div>`;
        }
        
        // BOTÃO DE DOWNLOAD / ABRIR
        activity.innerHTML += `
            <div class="d-flex justify-content-end mt-3 p-2 bg-light rounded border">
                <span class="me-auto align-self-center small text-muted">Caso não visualize, clique ao lado:</span>
                <a href="${lesson.content_url}" target="_blank" class="btn btn-primary btn-sm fw-bold">
                    <i class='bx bxs-download me-1'></i> Baixar / Abrir
                </a>
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

// === CÁLCULO DE PROGRESSO GERAL CORRIGIDO (MAX 100%) ===
function updateOverallProgress() {
    const total = flatLessons.length;
    
    // Filtra IDs completados que REALMENTE existem no curso atual
    // Isso remove IDs antigos ou inválidos que causam > 100%
    const validCompleted = enrollment.grades.completed.filter(id => flatLessons.some(l => l.id === id));
    
    const done = validCompleted.length;
    let pct = total === 0 ? 0 : Math.round((done / total) * 100);
    
    // Trava de segurança final
    if (pct > 100) pct = 100;

    document.getElementById('overall-progress').style.width = `${pct}%`;
    document.getElementById('progress-text').textContent = `${pct}%`;
}

// ... (Restante mantido) ...
window.toggleLessonStatus = async () => { if (currentLesson.type === 'QUIZ') return; const isDone = enrollment.grades.completed.includes(currentLesson.id); if (isDone) { enrollment.grades.completed = enrollment.grades.completed.filter(id => id !== currentLesson.id); const item = document.getElementById(`lesson-${currentLesson.id}`); if(item) { item.classList.remove('completed'); const icon = item.querySelector('.bxs-check-circle'); if(icon) icon.remove(); } } else { enrollment.grades.completed.push(currentLesson.id); const item = document.getElementById(`lesson-${currentLesson.id}`); if(item) { item.classList.add('completed'); if(!item.querySelector('.bxs-check-circle')) { item.insertAdjacentHTML('beforeend', "<i class='bx bxs-check-circle text-success'></i>"); } } } await supabase.from('class_enrollments').update({ grades: enrollment.grades }).eq('id', enrollment.id); updateOverallProgress(); loadCourse(); updateFinishButton(); };
function updateFinishButton() { const btn = document.getElementById('btn-finish'); const isDone = enrollment.grades.completed.includes(currentLesson.id); btn.onclick = window.toggleLessonStatus; if (currentLesson.type === 'QUIZ') { if (isDone) { btn.innerHTML = "<i class='bx bx-check-double'></i> Enviado"; btn.className = "btn btn-success rounded-pill fw-bold"; btn.disabled = true; } else { btn.innerHTML = "Pendente"; btn.className = "btn btn-secondary rounded-pill fw-bold"; btn.disabled = true; } } else { btn.disabled = false; if (isDone) { btn.innerHTML = "<i class='bx bx-check'></i> Concluído"; btn.className = "btn btn-success rounded-pill fw-bold"; btn.title = "Clique para desmarcar"; } else { btn.innerHTML = "Concluir Aula"; btn.className = "btn btn-outline-success rounded-pill fw-bold"; } } }
window.loadGrades = () => { const container = document.getElementById('grades-list'); container.innerHTML = ''; let hasGrades = false; const scores = enrollment.grades.scores || {}; courseModules.forEach(mod => { let modHtml = `<div class="grades-module-card"><div class="grades-module-header">${mod.title}</div><div>`; let countInMod = 0; mod.sections.forEach(sec => { sec.lessons.forEach(l => { if (l.points && l.points > 0) { hasGrades = true; countInMod++; const userScore = scores[l.id] !== undefined ? scores[l.id] : '-'; const statusBadge = userScore !== '-' ? '<span class="badge bg-success">Entregue</span>' : '<span class="badge bg-warning text-dark">Pendente</span>'; const scoreClass = userScore !== '-' ? 'done' : ''; modHtml += `<div class="grade-item-row"><div class="grade-info"><span class="grade-section-label">${sec.title || 'Atividade'}</span><span class="grade-title">${l.title}</span></div><div class="grade-status text-end"><div class="mb-1">${statusBadge}</div><span class="grade-score-box ${scoreClass}">${userScore} / ${l.points}</span></div></div>`; } }); }); modHtml += `</div></div>`; if (countInMod > 0) container.innerHTML += modHtml; }); if (!hasGrades) container.innerHTML = '<div class="alert alert-info text-center">Nenhuma atividade avaliativa.</div>'; };
function getReadPosts() { const key = `ava3_read_posts_${enrollment.id}`; return JSON.parse(localStorage.getItem(key) || '[]'); }
window.markPostRead = (postId, btn) => { const key = `ava3_read_posts_${enrollment.id}`; let read = getReadPosts(); if (!read.includes(postId)) { read.push(postId); localStorage.setItem(key, JSON.stringify(read)); const card = btn.closest('.wall-post'); card.classList.remove('unread'); const indicator = card.querySelector('.new-indicator'); if(indicator) indicator.remove(); btn.outerHTML = `<span class="text-success small fw-bold"><i class='bx bx-check-double'></i> Lido</span>`; checkUnreadMural(); } };
async function checkUnreadMural() { const { data: posts } = await supabase.from('class_posts').select('id').eq('class_id', classId); if (!posts) return; const read = getReadPosts(); const unreadCount = posts.filter(p => !read.includes(p.id)).length; const badge = document.getElementById('mural-badge'); if (badge) { if (unreadCount > 0) { badge.style.display = 'inline-block'; badge.textContent = unreadCount > 9 ? '9+' : unreadCount; } else { badge.style.display = 'none'; } } }
window.loadMural = async () => { const container = document.getElementById('wall-container'); container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>'; const { data: posts, error } = await supabase.from('class_posts').select('*').eq('class_id', classId).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }); container.innerHTML = ''; if (error || !posts || posts.length === 0) { container.innerHTML = '<div class="text-center py-5 text-muted"><p>Mural vazio.</p></div>'; checkUnreadMural(); return; } const readPosts = getReadPosts(); posts.forEach(post => { const isRead = readPosts.includes(post.id); const date = new Date(post.created_at).toLocaleDateString('pt-BR'); const pin = post.is_pinned ? `<i class='bx bx-pin text-danger fs-5' title="Fixado"></i>` : ''; let extras = ''; if (post.resource_url) extras += `<div class="mt-3"><a href="${post.resource_url}" target="_blank" class="btn btn-sm btn-outline-primary">Acessar Link</a></div>`; if (post.event_date) { const evtDate = new Date(post.event_date).toLocaleString(); extras += `<div class="mt-2 text-success fw-bold small p-2 bg-light rounded"><i class='bx bx-calendar'></i> Evento: ${evtDate}</div>`; } const unreadClass = isRead ? '' : 'unread'; const indicator = isRead ? '' : `<div class="new-indicator"><i class='bx bxs-bell-ring'></i></div>`; const actionBtn = isRead ? `<span class="text-success small fw-bold"><i class='bx bx-check-double'></i> Lido</span>` : `<button class="btn-mark-read" onclick="window.markPostRead('${post.id}', this)"><i class='bx bx-check'></i> Marcar como lido</button>`; const html = `<div class="wall-post post-${post.type} ${unreadClass}">${indicator}<div class="post-meta"><div><span class="post-badge bg-${post.type}">${post.type}</span><small class="text-muted ms-2">${date} ${pin}</small></div>${actionBtn}</div><h5 class="fw-bold text-dark mb-2">${post.title}</h5><div class="text-secondary" style="white-space: pre-wrap;">${post.content || ''}</div>${extras}</div>`; container.insertAdjacentHTML('beforeend', html); }); checkUnreadMural(); };
function initQuiz(lesson) { let qs = lesson.quiz_data?.questions || []; quizState = { data: { questions: qs }, currentIndex: -1, answers: {}, isFinished: false }; renderQuizStep(); }
function renderQuizStep() { const container = document.getElementById('activity-area'); const { data, currentIndex, answers, isFinished } = quizState; if (isFinished) { container.innerHTML = `<div class="text-center p-5 bg-light border rounded"><h3>Finalizado</h3></div>`; return; } if (currentIndex === -1) { container.innerHTML = `<div class="text-center p-5"><button class="btn btn-primary" onclick="window.nextQuizStep()">Iniciar Quiz</button></div>`; return; } const q = data.questions[currentIndex]; container.innerHTML = `<h5>${q.text}</h5>` + q.options.map((o,i)=>`<div class="quiz-option-card" onclick="window.saveAns(${i})"><input type="radio" name="q" ${answers[currentIndex]==i?'checked':''}> ${o.text||o}</div>`).join('') + `<div class="mt-3"><button class="btn btn-primary" onclick="window.nextQuizStep()">Próxima</button></div>`; }
window.nextQuizStep = () => { if (quizState.currentIndex < quizState.data.questions.length - 1) { quizState.currentIndex++; renderQuizStep(); } else { quizState.isFinished = true; calculateAndSaveScore(); } };
window.saveAns = (i) => { quizState.answers[quizState.currentIndex] = i; renderQuizStep(); };
async function calculateAndSaveScore() { let correct = 0; quizState.data.questions.forEach((q, i) => { if(q.options[quizState.answers[i]]?.isCorrect) correct++; }); const maxPoints = currentLesson.points || 0; const score = maxPoints > 0 ? (correct / quizState.data.questions.length) * maxPoints : 0; if (!enrollment.grades.completed.includes(currentLesson.id)) { enrollment.grades.completed.push(currentLesson.id); } if (!enrollment.grades.scores) enrollment.grades.scores = {}; enrollment.grades.scores[currentLesson.id] = parseFloat(score.toFixed(1)); await supabase.from('class_enrollments').update({ grades: enrollment.grades }).eq('id', enrollment.id); loadCourse(); updateOverallProgress(); openLesson(currentLesson); }
window.loadCertificate = () => { console.log("Aba certificado aberta"); };
window.loadCalendar = () => { document.getElementById('calendar-feed').innerHTML = '<div class="alert alert-light border">Agenda vazia.</div>'; };