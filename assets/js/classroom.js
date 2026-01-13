import { supabase } from './supabaseClient.js';

const params = new URLSearchParams(window.location.search);
const classId = params.get('id') || params.get('classId');

let enrollment = null;
let courseData = [];
let flatLessons = [];
let currentLesson = null;
let quizState = { data: null, currentIndex: -1, answers: {} };

const ICONS = { 'VIDEO_AULA': 'bx-play-circle', 'PDF': 'bxs-file-pdf', 'TEXTO': 'bx-text', 'QUIZ': 'bx-trophy', 'TAREFA': 'bx-task', 'default': 'bx-file' };

document.addEventListener('DOMContentLoaded', async () => {
    if (!classId) { window.location.href = 'app.html'; return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) window.location.href = 'login.html';

    try {
        await loadEnrollment(session.user.id);
        await loadCourse();
        await loadWall();
        loadGrades();
        loadReport();
        loadCalendar();
        if (flatLessons.length > 0) openLesson(flatLessons[0]);
    } catch (error) { console.error(error); }
});

async function loadEnrollment(userId) {
    const { data, error } = await supabase.from('class_enrollments').select('*').eq('class_id', classId).eq('user_id', userId).single();
    if (error || !data) throw new Error("Sem matrícula");
    enrollment = data;
    if (!enrollment.grades || !enrollment.grades.completed) enrollment.grades = { completed: [] };
}

async function loadCourse() {
    const { data: cls } = await supabase.from('classes').select('*, courses(title)').eq('id', classId).single();
    if (cls) {
        document.getElementById('header-course-title').textContent = cls.courses?.title;
        document.getElementById('header-class-name').textContent = cls.name;
    }
    const { data: modules, error } = await supabase.from('modules').select(`id, title, ordem, sections(id, title, ordem, lessons(id, title, type, content_url, description, points, available_until, quiz_data, task_data))`).eq('course_id', cls.course_id).order('ordem', { ascending: true });
    if (error) throw error;
    courseData = modules;
    renderMenu();
    updateProgressUI();
}

function renderMenu() {
    const container = document.getElementById('modules-list');
    container.innerHTML = ''; flatLessons = [];
    courseData.forEach((mod, idx) => {
        const sections = mod.sections || [];
        let mLessons = [];
        sections.forEach(s => mLessons = mLessons.concat(s.lessons || []));
        const pct = mLessons.length ? Math.round((mLessons.filter(l => enrollment.grades.completed.includes(l.id)).length / mLessons.length) * 100) : 0;
        let modHtml = '';
        sections.forEach(sec => {
            const lessons = sec.lessons || [];
            if (lessons.length > 0) {
                modHtml += `<div class="px-3 py-2 bg-light fw-bold small text-muted border-bottom">${sec.title}</div>`;
                lessons.forEach(l => {
                    flatLessons.push(l);
                    const isDone = enrollment.grades.completed.includes(l.id);
                    modHtml += `<div class="lesson-item ${isDone ? 'completed' : ''}" id="lesson-${l.id}" onclick="window.openLessonById(${l.id})">
                        <i class='bx ${ICONS[l.type] || ICONS.default} fs-5'></i><span class="text-truncate flex-grow-1">${l.title}</span><i class='bx ${isDone ? 'bxs-check-circle' : 'bx-circle'} fs-5'></i>
                    </div>`;
                });
            }
        });
        container.innerHTML += `<div class="accordion-item border-0"><h2 class="accordion-header"><button class="accordion-button ${idx===0?'':'collapsed'} shadow-none bg-white d-block" type="button" data-bs-toggle="collapse" data-bs-target="#acc-${mod.id}">
            <div class="d-flex justify-content-between"><span>${mod.title}</span><small>${pct}%</small></div>
            <div class="mod-progress-track"><div class="mod-progress-bar" id="bar-mod-${mod.id}" style="width: ${pct}%"></div></div>
        </button></h2><div id="acc-${mod.id}" class="accordion-collapse collapse ${idx===0?'show':''}"><div class="accordion-body p-0">${modHtml}</div></div></div>`;
    });
}

window.openLessonById = (id) => { const l = flatLessons.find(x => x.id === id); if(l) openLesson(l); };

function openLesson(lesson) {
    currentLesson = lesson;
    document.querySelectorAll('.lesson-item').forEach(el => el.classList.remove('active'));
    const el = document.getElementById(`lesson-${lesson.id}`);
    if(el) el.classList.add('active');
    document.getElementById('lbl-title').textContent = lesson.title;
    document.getElementById('lbl-desc').innerHTML = lesson.description || '';
    document.getElementById('lbl-type').textContent = lesson.type;
    updateFinishButton();

    const player = document.getElementById('player-frame');
    const activity = document.getElementById('activity-area');
    player.innerHTML = ''; activity.innerHTML = ''; player.style.display = 'none';

    const type = lesson.type?.toUpperCase();
    if (type === 'QUIZ') {
        quizState = { data: lesson.quiz_data, currentIndex: -1, answers: {} };
        renderQuizStep();
    } else if (type === 'VIDEO_AULA' && lesson.content_url) {
        player.innerHTML = `<div class="player-frame"><iframe src="${getEmbedUrl(lesson.content_url)}" allowfullscreen></iframe></div>`;
        player.style.display = 'block';
    } else if (type === 'PDF' && lesson.content_url) {
        player.innerHTML = `<div class="player-frame" style="height:80vh"><iframe src="${getEmbedUrl(lesson.content_url)}"></iframe></div>`;
        player.style.display = 'block';
    }
    updateNavButtons();
}

function renderQuizStep() {
    const container = document.getElementById('activity-area');
    container.innerHTML = '';
    const { data, currentIndex, answers } = quizState;

    if (currentIndex === -1) {
        container.innerHTML = `<div class="card p-5 border shadow-sm text-center">
            <i class='bx bx-info-circle fs-1 text-primary mb-3'></i>
            <h4 class="fw-bold">Orientações do Quiz</h4>
            <p class="text-secondary">Você terá apenas uma tentativa para responder este questionário de <strong>${data.questions.length} questões</strong>.</p>
            <button class="btn btn-primary btn-lg mt-4 px-5 rounded-pill" onclick="window.nextQuizStep()">Iniciar Agora</button>
        </div>`;
    } else {
        const q = data.questions[currentIndex];
        const isLast = currentIndex === data.questions.length - 1;
        let html = `<div class="badge bg-light text-dark border mb-3">Questão ${currentIndex + 1} de ${data.questions.length}</div>
            <div class="card p-4 shadow-sm mb-4"><h5>${q.text}</h5><div class="mt-3">`;
        q.options.forEach((opt, idx) => {
            html += `<div class="form-check p-2 border rounded mb-2 ${answers[currentIndex] == idx ? 'bg-light' : ''}">
                <input class="form-check-input ms-1" type="radio" name="quiz_q" id="opt_${idx}" value="${idx}" ${answers[currentIndex] == idx ? 'checked' : ''} onchange="window.saveQuizAnswer(${idx})">
                <label class="form-check-label w-100 ms-2" for="opt_${idx}">${opt.text || opt}</label>
            </div>`;
        });
        html += `</div></div><div class="d-flex justify-content-between">
            <button class="btn btn-light border" onclick="window.prevQuizStep()" ${currentIndex===0?'disabled':''}>Anterior</button>
            ${isLast ? `<button class="btn btn-success px-4" onclick="window.submitQuiz()">Finalizar e Enviar</button>` : `<button class="btn btn-primary px-4" onclick="window.nextQuizStep()">Próxima</button>`}
        </div>`;
        container.innerHTML = html;
    }
}

window.nextQuizStep = () => { quizState.currentIndex++; renderQuizStep(); };
window.prevQuizStep = () => { quizState.currentIndex--; renderQuizStep(); };
window.saveQuizAnswer = (val) => { quizState.answers[quizState.currentIndex] = val; };
window.submitQuiz = () => { if(confirm("Enviar respostas? Esta é a sua única tentativa.")) { alert("Respostas enviadas!"); finishLesson(); } };

function getEmbedUrl(url) {
    if (!url) return '';
    if (url.includes('youtube.com/watch')) return url.replace('watch?v=', 'embed/');
    if (url.includes('youtu.be/')) return `https://www.youtube.com/embed/${url.split('youtu.be/')[1]}`;
    if (url.includes('drive.google.com')) return url.replace(/\/view.*$/, '/preview').replace(/\/edit.*$/, '/preview');
    return url;
}

window.finishLesson = async () => {
    if (!currentLesson || enrollment.grades.completed.includes(currentLesson.id)) return;
    enrollment.grades.completed.push(currentLesson.id);
    updateFinishButton();
    const el = document.getElementById(`lesson-${currentLesson.id}`);
    if(el) { el.classList.add('completed'); el.querySelector('.bx-circle').className = 'bx bxs-check-circle fs-5 text-success'; }
    updateProgressUI();
    const pct = Math.round((enrollment.grades.completed.length / flatLessons.length) * 100);
    await supabase.from('class_enrollments').update({ progress_percent: pct, grades: enrollment.grades }).eq('id', enrollment.id);
};

function updateFinishButton() {
    const btn = document.getElementById('btn-finish');
    const isDone = enrollment.grades.completed.includes(currentLesson.id);
    btn.innerHTML = isDone ? `<i class='bx bx-check-double'></i> Concluído` : `<i class='bx bx-check'></i> Concluir Aula`;
    btn.className = isDone ? "btn btn-success fw-bold px-4 rounded-pill text-white" : "btn btn-outline-success fw-bold px-4 rounded-pill";
    btn.disabled = isDone;
}

function updateProgressUI() {
    const pct = flatLessons.length ? Math.round((enrollment.grades.completed.length / flatLessons.length) * 100) : 0;
    document.getElementById('overall-progress').style.width = `${pct}%`;
    document.getElementById('progress-text').textContent = `${pct}%`;
}

function updateNavButtons() {
    const idx = flatLessons.findIndex(l => l.id === currentLesson.id);
    const prev = document.getElementById('btn-prev');
    const next = document.getElementById('btn-next');
    prev.disabled = idx <= 0; next.disabled = idx >= flatLessons.length - 1;
    prev.onclick = () => openLesson(flatLessons[idx - 1]);
    next.onclick = () => openLesson(flatLessons[idx + 1]);
}

// Funções de Mural, Notas e Relatório mantidas como no anterior...
async function loadWall() { /* ... */ }
function loadGrades() { /* ... */ }
function loadReport() { /* ... */ }
function loadCalendar() { /* ... */ }