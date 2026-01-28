import { supabase } from './supabaseClient.js';

/* ============================================================
   AVA3 • classroom.js (V7: SINO NA ABA MURAL + CORREÇÕES GERAIS)
   ============================================================ */

const STATE = {
    classId: null,
    courseId: null,
    enrollmentId: null,
    user: null,
    
    structure: [],      
    lessonMap: {},      
    flatLessons: [],    
    progress: { completed: [], scores: {} }, 
    
    currentLessonId: null
};

const ICONS = {
    'VIDEO_AULA': 'bx-play-circle', 'VIDEO': 'bx-play-circle',
    'TEXTO': 'bx-paragraph', 'PDF': 'bxs-file-pdf',
    'QUIZ': 'bx-trophy', 'TAREFA': 'bx-task',
    'default': 'bx-file'
};

document.addEventListener("DOMContentLoaded", initClassroom);

async function initClassroom() {
    try {
        injectCustomCSS(); 
        await checkAuth();
        parseUrl();

        if (STATE.classId) {
            await loadClassData();
            await loadEnrollment();
        } else {
            await loadCourseData();
        }

        await loadCourseStructure();
        processLocksAndProgress(); 

        renderNavigation();
        updateOverallProgress();
        
        if (STATE.classId) {
            loadMural();     // Carrega Mural e atualiza a aba
            loadGrades();    // Carrega Notas
            loadCalendar();  // Carrega Calendário
        }

        setupEventListeners();
        autoOpenLesson();

    } catch (error) {
        console.error("Erro:", error);
        document.getElementById('classroomLayout').innerHTML = `
            <div class="d-flex flex-column align-items-center justify-content-center vh-100 text-center p-4">
                <i class='bx bx-error-circle text-danger' style="font-size: 4rem;"></i>
                <h2 class="text-dark mt-3">Erro ao carregar</h2>
                <p class="text-muted fs-5">${error.message}</p>
                <a href="app.html" class="btn btn-primary rounded-pill px-5 py-2 mt-3">Voltar</a>
            </div>`;
    }
}

// ============================================================
// 1. CARREGAMENTO DE DADOS
// ============================================================

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'login.html'; throw new Error("Não autenticado"); }
    STATE.user = session.user;
}

function parseUrl() {
    const params = new URLSearchParams(window.location.search);
    STATE.classId = params.get('id');
    STATE.courseId = params.get('courseId');
    if (!STATE.classId && !STATE.courseId) throw new Error("URL inválida.");
}

async function loadClassData() {
    const { data: cls, error } = await supabase.from('classes')
        .select(`*, courses (id, title)`).eq('id', STATE.classId).single();
    if (error) throw error;
    STATE.courseId = cls.course_id;
    if(document.getElementById('header-class-name')) document.getElementById('header-class-name').textContent = cls.name;
    if(document.getElementById('header-course-title')) document.getElementById('header-course-title').textContent = cls.courses?.title;
}

async function loadCourseData() {
    const { data: c } = await supabase.from('courses').select('*').eq('id', STATE.courseId).single();
    if(document.getElementById('header-class-name')) document.getElementById('header-class-name').textContent = "Visualização";
    if(document.getElementById('header-course-title')) document.getElementById('header-course-title').textContent = c.title;
}

async function loadEnrollment() {
    const { data } = await supabase.from('class_enrollments').select('*').eq('class_id', STATE.classId).eq('user_id', STATE.user.id).maybeSingle();
    if (data) {
        STATE.enrollmentId = data.id;
        STATE.progress = data.grades || { completed: [], scores: {} };
        if(!STATE.progress.completed) STATE.progress.completed = [];
        if(!STATE.progress.scores) STATE.progress.scores = {};
    }
}

async function loadCourseStructure() {
    const { data: modules, error } = await supabase.from('modules').select(`id, title, ordem, settings, unlock_at, prerequisite_ids, sections (id, title, ordem, unlock_at, prerequisite_ids, lessons (id, title, type, video_url, content_url, content, description, is_published, ordem, points, unlock_at, prerequisite_ids, task_data, quiz_data))`).eq('course_id', STATE.courseId).order('ordem');
    if (error) throw error;
    STATE.structure = modules || [];
    STATE.lessonMap = {};
    STATE.structure.forEach(m => { m.sections?.forEach(s => { s.lessons?.forEach(l => { STATE.lessonMap[l.id] = l.title; }); }); });
}

// ============================================================
// 2. REGRAS INTELIGENTES
// ============================================================

function processLocksAndProgress() {
    const now = new Date();
    STATE.flatLessons = [];
    STATE.structure.forEach(mod => {
        let modTotal = 0, modDone = 0;
        const modLock = checkLock(mod, now);
        mod.isLocked = modLock.locked; mod.lockReason = modLock.reason;
        
        if(mod.sections) mod.sections.sort((a,b) => (a.ordem||0)-(b.ordem||0));
        
        (mod.sections || []).forEach(sec => {
            if(sec.lessons) sec.lessons.sort((a,b) => (a.ordem||0)-(b.ordem||0));
            (sec.lessons || []).forEach(les => {
                if(les.is_published === false) return;
                modTotal++;
                const isCompleted = STATE.progress.completed.includes(les.id);
                if (isCompleted) modDone++;
                let lockStatus = mod.isLocked ? { locked: true, reason: `Módulo bloqueado: ${mod.lockReason}` } : checkLock(les, now);
                STATE.flatLessons.push({ ...les, moduleId: mod.id, isLocked: lockStatus.locked, lockReason: lockStatus.reason, isCompleted: isCompleted });
            });
        });
        mod.percent = modTotal === 0 ? 0 : Math.round((modDone / modTotal) * 100);
    });
}

function checkLock(item, now) {
    if (item.unlock_at) {
        const unlockDate = new Date(item.unlock_at);
        if (unlockDate > now) return { locked: true, reason: `Disponível em ${unlockDate.toLocaleDateString()} às ${unlockDate.toLocaleTimeString()}` };
    }
    let reqs = item.prerequisite_ids;
    if (typeof reqs === 'string') { try { reqs = JSON.parse(reqs); } catch(e) { reqs = []; } }
    if (Array.isArray(reqs) && reqs.length > 0) {
        const missingId = reqs.find(id => !STATE.progress.completed.includes(id));
        if (missingId) return { locked: true, reason: `Pré-requisito: Conclua a aula <b>"${STATE.lessonMap[missingId] || 'anterior'}"</b>.` };
    }
    return { locked: false };
}

// ============================================================
// 3. RENDERIZAÇÃO LATERAL (STATUS NA DIREITA)
// ============================================================

function renderNavigation() {
    const list = document.getElementById('modules-list');
    list.innerHTML = '';

    STATE.structure.forEach((mod, idx) => {
        let itemsHtml = '';
        
        (mod.sections || []).forEach(sec => {
            if (sec.title && sec.title.toLowerCase() !== 'default') {
                itemsHtml += `<div class="px-3 py-2 mt-2 text-uppercase fw-bold text-muted small" style="font-size:0.7rem; letter-spacing:0.5px;">${sec.title}</div>`;
            }

            (sec.lessons || []).forEach(les => {
                if(les.is_published === false) return;
                const flat = STATE.flatLessons.find(x => x.id === les.id);
                if(!flat) return;

                const isActive = (flat.id === STATE.currentLessonId);
                const typeIcon = ICONS[les.type] || ICONS.default;
                
                // STATUS (Cadeado ou Check)
                let statusHtml = "";
                if (flat.isLocked) {
                    statusHtml = `<i class='bx bx-lock-alt text-secondary fs-5' title="Bloqueado"></i>`;
                } else if (flat.isCompleted) {
                    statusHtml = `<i class='bx bxs-check-circle text-success fs-5' title="Concluído"></i>`;
                }

                let itemClass = "d-flex align-items-center justify-content-between p-3 cursor-pointer rounded-3 my-1 transition-all";
                if (isActive) itemClass += " bg-primary bg-opacity-10 text-primary fw-bold";
                else if (flat.isLocked) itemClass += " bg-light text-muted opacity-75";
                else if (flat.isCompleted) itemClass += " bg-white text-dark hover-bg-light";
                else itemClass += " bg-white text-dark hover-bg-light shadow-sm";

                const lockMsgSafe = flat.isLocked ? flat.lockReason.replace(/'/g, "&apos;").replace(/"/g, "&quot;") : "";
                const clickAction = flat.isLocked ? `window.showToast('${lockMsgSafe}', 'warning')` : `window.selectLesson('${les.id}')`;

                itemsHtml += `
                    <div class="${itemClass}" onclick="${clickAction}" id="nav-item-${les.id}">
                        <div class="d-flex align-items-center gap-3 overflow-hidden">
                            <i class='bx ${typeIcon} fs-4 ${isActive ? 'text-primary' : 'text-secondary'}'></i>
                            <div class="text-truncate small" style="line-height:1.2;">${les.title}</div>
                        </div>
                        
                        <div class="ms-2">${statusHtml}</div>
                    </div>
                `;
            });
        });

        const progressBadge = mod.percent === 100 
            ? `<span class="badge bg-success rounded-pill"><i class='bx bx-check'></i></span>`
            : `<span class="badge bg-secondary rounded-pill" style="font-size:0.7rem">${mod.percent}%</span>`;
        
        const collapseId = `collapse-${mod.id}`;
        const isOpen = idx === 0 || (mod.sections?.some(s => s.lessons?.some(l => l.id === STATE.currentLessonId)));
        
        list.innerHTML += `
            <div class="accordion-item border-0 bg-transparent mb-2">
                <h2 class="accordion-header">
                    <button class="accordion-button ${isOpen?'':'collapsed'} shadow-none fw-bold text-dark bg-white rounded-3 py-3" 
                            type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}">
                        <div class="d-flex align-items-center justify-content-between w-100 pe-3">
                            <div class="d-flex align-items-center gap-2">
                                ${mod.isLocked ? "<i class='bx bx-lock text-muted'></i>" : ""}
                                <span>${mod.title}</span>
                            </div>
                            ${!mod.isLocked ? progressBadge : ''}
                        </div>
                    </button>
                </h2>
                <div id="${collapseId}" class="accordion-collapse collapse ${isOpen?'show':''}" data-bs-parent="#modules-list">
                    <div class="accordion-body p-0 ps-2 pt-1">
                        ${itemsHtml}
                    </div>
                </div>
            </div>
        `;
    });
}

// ============================================================
// 4. MURAL (COM SINO NA ABA DE NAVEGAÇÃO)
// ============================================================

async function loadMural() {
    const container = document.getElementById('wall-container');
    
    // 1. Busca Posts
    const { data: posts } = await supabase.from('class_events').select('*')
        .eq('class_id', STATE.classId).order('is_pinned', {ascending:false}).order('created_at', {ascending:false});
    
    // 2. Lógica de Notificações
    const storageKey = `read_posts_${STATE.classId}`;
    const readPosts = JSON.parse(localStorage.getItem(storageKey)) || [];
    let unreadCount = 0;
    
    if (posts) {
        posts.forEach(p => { if(!readPosts.includes(p.id)) unreadCount++; });
    }

    // --- ATUALIZA O BADGE NA ABA (MURAL) ---
    // Procura o elemento badge dentro do botão da aba
    const badgeEl = document.getElementById('mural-badge'); 
    
    if(badgeEl) {
        if(unreadCount > 0) {
            badgeEl.innerHTML = `<i class='bx bxs-bell-ring bx-tada'></i> ${unreadCount}`;
            badgeEl.style.display = 'inline-block';
            // Garante cor vermelha para destaque
            badgeEl.className = 'badge bg-danger ms-1';
        } else {
            badgeEl.style.display = 'none';
        }
    }

    if (!container) return;

    if (!posts || posts.length === 0) {
        container.innerHTML = `<div class="text-center text-muted py-5 col-12"><i class='bx bx-news fs-1'></i><p>Nenhum aviso no mural.</p></div>`;
        return;
    }

    // 3. Renderiza o Conteúdo do Mural
    container.className = 'masonry-container';
    container.innerHTML = posts.map(post => {
        const isRead = readPosts.includes(post.id);
        const date = new Date(post.created_at).toLocaleDateString('pt-BR');
        let icon = 'bx-pin', colorClass = 'bg-warning bg-opacity-10 text-warning';
        if (post.type === 'material') { icon = 'bx-book-bookmark'; colorClass = 'bg-info bg-opacity-10 text-info'; }
        if (post.type === 'reuniao') { icon = 'bx-calendar-event'; colorClass = 'bg-success bg-opacity-10 text-success'; }

        // Borda de destaque se não lido
        const borderClass = !isRead ? 'border-start border-5 border-danger shadow' : 'border-0 shadow-sm';

        return `
            <div class="masonry-item">
                <div class="card ${borderClass} h-100 position-relative hover-lift">
                    <div class="card-body">
                        <div class="d-flex gap-3 mb-3">
                            <div class="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 ${colorClass}" style="width:48px; height:48px;">
                                <i class='bx ${icon} fs-3'></i>
                            </div>
                            <div>
                                <h6 class="fw-bold mb-0 text-dark">${post.title || 'Aviso'} ${post.is_pinned?'<i class="bx bxs-pin text-warning"></i>':''}</h6>
                                <small class="text-muted">${date}</small>
                            </div>
                        </div>
                        <p class="text-muted small mb-3" style="line-height:1.6;">${post.content}</p>
                        ${post.resource_url ? `<a href="${post.resource_url}" target="_blank" class="d-block w-100 btn btn-sm btn-outline-primary rounded-pill mb-3">Acessar Material</a>` : ''}
                        
                        ${!isRead ? `<button onclick="window.markPostRead('${post.id}')" class="btn btn-sm btn-light text-primary border rounded-pill w-100"><i class='bx bx-check-double'></i> Marcar lido</button>` : ''}
                    </div>
                </div>
            </div>`;
    }).join('');
}

window.markPostRead = (postId) => {
    const storageKey = `read_posts_${STATE.classId}`;
    const readPosts = JSON.parse(localStorage.getItem(storageKey)) || [];
    if(!readPosts.includes(postId)) {
        readPosts.push(postId);
        localStorage.setItem(storageKey, JSON.stringify(readPosts));
        loadMural(); // Recarrega para atualizar o sino na aba
        window.showToast("Marcado como lido!", "success");
    }
};

// ============================================================
// 5. NOTAS E CALENDÁRIO
// ============================================================

async function loadGrades() {
    const container = document.getElementById('grades-list');
    if(!container) return;
    const graded = STATE.flatLessons.filter(l => (l.points && l.points > 0) || ['QUIZ', 'TAREFA'].includes(l.type));
    
    if (graded.length === 0) { 
        container.innerHTML = `<div class="text-center py-5 text-muted"><i class='bx bx-notepad fs-1 mb-2'></i><p>Sem atividades avaliativas.</p></div>`; 
        return; 
    }

    let total=0, earned=0;
    const rows = graded.map(l => {
        const max = parseFloat(l.points) || 0;
        total += max;
        let score = STATE.progress.scores?.[l.id] !== undefined ? parseFloat(STATE.progress.scores[l.id]) : (l.isCompleted ? max : 0);
        earned += score;
        
        let badge = l.isCompleted ? '<span class="badge bg-success">Entregue</span>' : '<span class="badge bg-secondary">Pendente</span>';
        if(STATE.progress.scores?.[l.id]) badge = '<span class="badge bg-primary">Avaliado</span>';

        return `
            <tr>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <i class='bx ${ICONS[l.type]} text-muted'></i>
                        <span class="fw-bold text-dark small">${l.title}</span>
                    </div>
                </td>
                <td class="text-center">${badge}</td>
                <td class="text-end fw-bold text-primary">${score} / ${max}</td>
            </tr>`;
    }).join('');

    const percent = total === 0 ? 0 : Math.round((earned / total) * 100);
    container.innerHTML = `
        <div class="card border-0 shadow-sm mb-4 bg-primary text-white">
            <div class="card-body p-4 d-flex justify-content-between align-items-center">
                <div><h5 class="mb-0 fw-bold"><i class='bx bx-award'></i> Desempenho Geral</h5><small class="opacity-75">${percent}% de aproveitamento</small></div>
                <div class="fs-3 fw-bold">${earned} / ${total} pts</div>
            </div>
        </div>
        <div class="card border shadow-sm"><div class="table-responsive"><table class="table table-hover mb-0 align-middle"><tbody>${rows}</tbody></table></div></div>
    `;
}

async function loadCalendar() {
    const container = document.getElementById('calendar-list');
    if(!container) return;
    
    let events = STATE.flatLessons.filter(l => l.unlock_at).map(l => ({
        date: new Date(l.unlock_at), title: `Liberação: ${l.title}`, icon: 'bx-lock-open', type: 'lesson'
    }));
    
    const { data: posts } = await supabase.from('class_events').select('*').eq('class_id', STATE.classId).not('event_date', 'is', null);
    if(posts) posts.forEach(p => events.push({ date: new Date(p.event_date), title: p.title, icon: 'bx-calendar-event', type: 'event' }));

    if(events.length === 0) { container.innerHTML = `<div class="text-center py-5 text-muted"><i class='bx bx-calendar fs-1 mb-2'></i><p>Agenda vazia.</p></div>`; return; }
    
    events.sort((a,b) => a.date - b.date);
    const now = new Date();
    
    container.innerHTML = '<ul class="list-group list-group-flush rounded shadow-sm border">' + events.map(ev => {
        const isPast = ev.date < now;
        const d = ev.date;
        const color = ev.type === 'lesson' ? 'text-primary' : 'text-success';
        
        return `
            <li class="list-group-item d-flex align-items-center gap-3 py-3 ${isPast ? 'bg-light opacity-75' : 'bg-white'}">
                <div class="text-center border rounded p-2 ${isPast ? 'text-muted border-secondary' : 'border-primary'}" style="min-width:60px;">
                    <div class="fw-bold small text-dark">${d.getDate()}</div><div class="small text-uppercase text-muted">${d.toLocaleDateString('pt-BR',{month:'short'})}</div>
                </div>
                <div class="flex-grow-1"><h6 class="mb-0 fw-bold ${isPast?'text-muted text-decoration-line-through':'text-dark'}">${ev.title}</h6><small class="text-muted"><i class='bx bx-time'></i> ${d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small></div>
                <i class='bx ${ev.icon} fs-4 ${isPast ? 'text-muted' : color}'></i>
            </li>`;
    }).join('') + '</ul>';
}

// ============================================================
// 6. SELEÇÃO DE AULA
// ============================================================

window.selectLesson = (id) => {
    const lesson = STATE.flatLessons.find(l => l.id === id);
    if (!lesson) return;
    if (lesson.isLocked) { window.showToast(lesson.lockReason, 'warning'); return; }

    STATE.currentLessonId = id;

    const tabAulaBtn = document.getElementById('tab-aula-btn');
    if (tabAulaBtn && window.bootstrap) {
        const tabInstance = window.bootstrap.Tab.getOrCreateInstance(tabAulaBtn);
        tabInstance.show();
    }

    renderNavigation();
    if(document.getElementById('lbl-title')) document.getElementById('lbl-title').textContent = lesson.title;
    if(document.getElementById('lbl-type')) document.getElementById('lbl-type').textContent = lesson.type || 'AULA';
    const descEl = document.getElementById('lbl-desc');
    if(descEl) { descEl.textContent = lesson.description || ''; descEl.style.display = lesson.description ? 'block' : 'none'; }

    renderLessonContent(lesson);
    updateFinishButton(lesson.id);
    updateNavButtons(id);
};

function renderLessonContent(lesson) {
    const player = document.getElementById('player-frame');
    const area = document.getElementById('activity-area');
    player.style.display = 'none'; area.style.display = 'none'; area.innerHTML = '';

    if (['VIDEO_AULA', 'VIDEO'].includes(lesson.type)) {
        player.style.display = 'block';
        player.innerHTML = `<iframe src="${getEmbedUrl(lesson.video_url)}" allowfullscreen style="border-radius:12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);"></iframe>`;
    } 
    else if (lesson.type === 'TEXTO') {
        area.style.display = 'block';
        area.innerHTML = `<div class="card border-0 shadow-sm p-4 typography" style="max-width:800px; margin:0 auto;">${lesson.content || 'Sem conteúdo.'}</div>`;
    }
    else if (['QUIZ', 'TAREFA'].includes(lesson.type)) {
        area.style.display = 'block';
        area.innerHTML = `
            <div class="text-center py-5">
                <div class="bg-primary-subtle d-inline-flex p-4 rounded-circle mb-3">
                    <i class='bx ${ICONS[lesson.type]} fs-1 text-primary'></i>
                </div>
                <h4>Atividade Prática</h4>
                <p class="text-muted mb-4 fs-5">Esta aula requer uma atividade.</p>
                <button class="btn btn-primary px-5 py-3 rounded-pill shadow-sm fw-bold fs-5" onclick="window.openActivityDrawer('${lesson.id}')">
                    INICIAR ATIVIDADE
                </button>
            </div>`;
    }
    else {
        area.style.display = 'block';
        if(lesson.content_url) area.innerHTML = `<iframe src="${lesson.content_url}" style="width:100%; height:800px; border:0; border-radius:8px;"></iframe>`;
        else area.innerHTML = `<div class="alert alert-warning">URL não definida.</div>`;
    }
}

// ============================================================
// 7. UTILITÁRIOS
// ============================================================

window.showToast = function(message, type = 'info') {
    const old = document.getElementById('custom-toast');
    if(old) old.remove();

    const colors = { 'warning': '#f59e0b', 'success': '#10b981', 'info': '#3b82f6' };
    const icon = type === 'warning' ? 'bx-lock-alt' : (type === 'success' ? 'bx-check-circle' : 'bx-info-circle');

    const toast = document.createElement('div');
    toast.id = 'custom-toast';
    toast.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: #fff; padding: 40px 50px; border-radius: 24px;
        box-shadow: 0 30px 80px rgba(0,0,0,0.4); z-index: 9999;
        display: flex; flex-direction: column; align-items: center; text-align: center; gap: 20px;
        border-top: 10px solid ${colors[type]};
        animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        min-width: 450px; max-width: 90%;
    `;
    
    toast.innerHTML = `
        <i class='bx ${icon}' style="color:${colors[type]}; font-size: 5rem;"></i>
        <div style="font-size:1.8rem; color:#222; font-weight:bold;">Atenção</div>
        <div style="font-size:1.3rem; color:#555; line-height:1.5;">${message}</div>
        <button onclick="this.parentElement.remove()" class="btn btn-light border mt-4 px-5 py-2 rounded-pill fs-5">Entendi</button>
    `;
    document.body.appendChild(toast);
    setTimeout(() => { if(document.body.contains(toast)) { toast.style.animation = 'fadeOutCenter 0.3s forwards'; setTimeout(() => toast.remove(), 300); } }, 5000);
};

function injectCustomCSS() {
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes popIn { from {opacity:0; transform: translate(-50%, -40%) scale(0.9);} to {opacity:1; transform: translate(-50%, -50%) scale(1);} }
        @keyframes fadeOutCenter { to {opacity:0; transform: translate(-50%, -60%);} }
        .masonry-container { column-count: 2; column-gap: 1.5rem; }
        @media(max-width: 768px) { .masonry-container { column-count: 1; } }
        .masonry-item { break-inside: avoid; margin-bottom: 1.5rem; }
        .hover-lift { transition: transform 0.2s ease, box-shadow 0.2s ease; border-radius: 16px; overflow: hidden; }
        .hover-lift:hover { transform: translateY(-5px); box-shadow: 0 10px 30px rgba(0,0,0,0.08) !important; }
        .bell-notification { position: absolute; top: 15px; right: 15px; animation: swing 2s infinite ease-in-out; }
        @keyframes swing { 0%,100%{transform:rotate(0deg);} 20%{transform:rotate(15deg);} 40%{transform:rotate(-10deg);} 60%{transform:rotate(5deg);} 80%{transform:rotate(-5deg);} }
    `;
    document.head.appendChild(style);
}

function setupEventListeners() {
    const btnFinish = document.getElementById('btn-finish');
    if (btnFinish) btnFinish.onclick = window.markAsFinished;
    const toggleBtn = document.getElementById('btn-toggle-nav');
    if (toggleBtn) toggleBtn.onclick = () => { document.body.classList.toggle('sidebar-collapsed'); const icon = toggleBtn.querySelector('i'); if(icon) icon.className = document.body.classList.contains('sidebar-collapsed') ? 'bx bx-chevron-right' : 'bx bx-chevron-left'; };
}

window.markAsFinished = async function() {
    if (!STATE.classId || !STATE.currentLessonId) return;
    if (!STATE.progress.completed.includes(STATE.currentLessonId)) STATE.progress.completed.push(STATE.currentLessonId);

    updateFinishButton(STATE.currentLessonId);
    processLocksAndProgress(); 
    renderNavigation(); 
    updateOverallProgress();

    window.showToast("Aula concluída com sucesso! Avançando...", "success");

    if (STATE.enrollmentId) {
        const percent = calculateTotalPercent();
        await supabase.from('class_enrollments').update({ grades: STATE.progress, progress_percent: percent }).eq('id', STATE.enrollmentId);
    }
    setTimeout(() => { const next = document.getElementById('btn-next'); if(next && !next.disabled) next.click(); }, 2500);
};

function updateFinishButton(id) {
    const btn = document.getElementById('btn-finish'); const badge = document.getElementById('lesson-status');
    const isDone = STATE.progress.completed.includes(id);
    if (btn && badge) {
        if (isDone) { btn.style.display = 'none'; badge.style.display = 'inline-block'; } 
        else { btn.style.display = 'inline-block'; btn.disabled = false; badge.style.display = 'none'; }
    }
}

function updateOverallProgress() {
    const p = calculateTotalPercent();
    const bar = document.getElementById('overall-progress'); const txt = document.getElementById('progress-text');
    if(bar) bar.style.width = `${p}%`; if(txt) txt.textContent = `${p}%`;
}

function calculateTotalPercent() {
    const total = STATE.flatLessons.length; const done = STATE.progress.completed.length;
    return total === 0 ? 0 : Math.round((done / total) * 100);
}

function updateNavButtons(id) {
    const idx = STATE.flatLessons.findIndex(l => l.id === id);
    const prev = document.getElementById('btn-prev'); const next = document.getElementById('btn-next');
    if(prev) { prev.disabled = idx <= 0; prev.onclick = () => { if(idx > 0) window.selectLesson(STATE.flatLessons[idx-1].id); }; }
    if(next) { next.disabled = idx >= STATE.flatLessons.length - 1; next.onclick = () => { if(idx < STATE.flatLessons.length-1) window.selectLesson(STATE.flatLessons[idx+1].id); }; }
}

function getEmbedUrl(url) {
    if (!url) return ''; if (url.includes('embed/')) return url; if (url.includes('watch?v=')) return url.replace('watch?v=', 'embed/'); if (url.includes('youtu.be/')) return `https://www.youtube.com/embed/${url.split('/').pop()}`; return url;
}

function autoOpenLesson() {
    const next = STATE.flatLessons.find(l => !l.isLocked && !l.isCompleted);
    if(next) window.selectLesson(next.id); else if(STATE.flatLessons.length > 0 && !STATE.flatLessons[0].isLocked) window.selectLesson(STATE.flatLessons[0].id);
}

window.openActivityDrawer = (id) => { window.location.href=`task-builder.html?id=${id}`; };