import { supabase } from './supabaseClient.js';

/* ============================================================
   AVA3 • classroom.js (V14 FINAL)
   - SINO: Na aba do menu (#mural-badge)
   - IMAGEM: Renderiza <img> se for jpg/png
   - CONCLUIR: onclick direto no HTML
   - ABA: Troca automática para 'Aula'
   - NOTAS/CALENDARIO: Mantidos intactos
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
        injectCustomCSS(); // CSS para o sino e layout
        await checkAuth();
        parseUrl();

        // 1. Carrega Dados
        if (STATE.classId) {
            await loadClassData();
            await loadEnrollment();
        } else {
            await loadCourseData();
        }

        // 2. Carrega Conteúdo
        await loadCourseStructure();
        processLocksAndProgress(); 

        // 3. Renderiza Inicial
        renderNavigation();
        updateOverallProgress();
        
        // 4. Carrega Abas Extras (Se tiver turma)
        if (STATE.classId) {
            loadMural();     // Carrega posts e atualiza o sino da aba
            loadGrades();    // Carrega a tabela de notas
            loadCalendar();  // Carrega a agenda
        }

        setupEventListeners();
        autoOpenLesson();

    } catch (error) {
        console.error("Erro Fatal:", error);
        const layout = document.getElementById('classroomLayout');
        if(layout) {
            layout.innerHTML = `
            <div class="d-flex flex-column align-items-center justify-content-center vh-100 text-center p-4">
                <i class='bx bx-error-circle text-danger' style="font-size: 4rem;"></i>
                <h2 class="text-dark mt-3">Erro ao carregar</h2>
                <p class="text-muted fs-5">${error.message}</p>
                <a href="app.html" class="btn btn-primary rounded-pill px-5 py-2 mt-3">Voltar</a>
            </div>`;
        }
    }
}

// ============================================================
// 1. DADOS BÁSICOS
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
        if(!Array.isArray(STATE.progress.completed)) STATE.progress.completed = [];
        if(!STATE.progress.scores) STATE.progress.scores = {};
    }
}

async function loadCourseStructure() {
    const { data: modules, error } = await supabase.from('modules')
        .select(`
            id, title, ordem, settings, unlock_at, prerequisite_ids,
            sections (
                id, title, ordem, unlock_at, prerequisite_ids,
                lessons (
                    id, title, type, video_url, content_url, content, 
                    description, is_published, ordem, points, 
                    unlock_at, prerequisite_ids, task_data, quiz_data
                )
            )
        `)
        .eq('course_id', STATE.courseId)
        .order('ordem');

    if (error) throw error;
    STATE.structure = modules || [];
    
    STATE.lessonMap = {};
    STATE.structure.forEach(m => { 
        (m.sections || []).forEach(s => { 
            (s.lessons || []).forEach(l => { 
                STATE.lessonMap[l.id] = l.title; 
            }); 
        }); 
    });
}

// ============================================================
// 2. REGRAS (DATA E PRÉ-REQUISITOS)
// ============================================================

function processLocksAndProgress() {
    const now = new Date();
    STATE.flatLessons = [];

    STATE.structure.forEach(mod => {
        let modTotal = 0, modDone = 0;
        
        const modLock = checkLock(mod, now);
        mod.isLocked = modLock.locked; 
        mod.lockReason = modLock.reason;
        
        if(mod.sections) mod.sections.sort((a,b) => (a.ordem||0)-(b.ordem||0));
        
        (mod.sections || []).forEach(sec => {
            if(sec.lessons) sec.lessons.sort((a,b) => (a.ordem||0)-(b.ordem||0));
            
            (sec.lessons || []).forEach(les => {
                if(les.is_published === false) return;

                modTotal++;
                const isCompleted = STATE.progress.completed.includes(les.id);
                if (isCompleted) modDone++;

                let lockStatus = mod.isLocked 
                    ? { locked: true, reason: `Módulo bloqueado: ${mod.lockReason}` } 
                    : checkLock(les, now);
                
                STATE.flatLessons.push({ 
                    ...les, 
                    moduleId: mod.id, 
                    isLocked: lockStatus.locked, 
                    lockReason: lockStatus.reason, 
                    isCompleted: isCompleted 
                });
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
        if (missingId) {
            const name = STATE.lessonMap[missingId] || 'aula anterior';
            return { locked: true, reason: `Pré-requisito: Conclua a aula <b>"${name}"</b>.` };
        }
    }
    return { locked: false };
}

// ============================================================
// 3. MENU LATERAL
// ============================================================

function renderNavigation() {
    const list = document.getElementById('modules-list');
    if(!list) return;
    list.innerHTML = '';

    STATE.structure.forEach((mod, idx) => {
        let itemsHtml = '';
        
        (mod.sections || []).forEach(sec => {
            if (sec.title && sec.title.toLowerCase() !== 'default') {
                itemsHtml += `<div class="px-3 py-2 mt-2 text-uppercase fw-bold text-muted small" style="font-size:0.7rem;">${sec.title}</div>`;
            }

            (sec.lessons || []).forEach(les => {
                if(les.is_published === false) return;
                const flat = STATE.flatLessons.find(x => x.id === les.id);
                if(!flat) return;

                const isActive = (flat.id === STATE.currentLessonId);
                const typeIcon = ICONS[les.type] || ICONS.default;
                
                // STATUS NA DIREITA
                let statusHtml = "";
                if (flat.isLocked) {
                    statusHtml = `<i class='bx bx-lock-alt text-secondary fs-5' title="Bloqueado"></i>`;
                } else if (flat.isCompleted) {
                    statusHtml = `<i class='bx bxs-check-circle text-success fs-5' title="Concluído"></i>`;
                }

                let itemClass = "d-flex align-items-center justify-content-between p-3 cursor-pointer rounded-3 my-1 transition-all";
                if (isActive) itemClass += " bg-primary bg-opacity-10 text-primary fw-bold";
                else if (flat.isLocked) itemClass += " bg-light text-muted opacity-75";
                else itemClass += " bg-white text-dark hover-bg-light shadow-sm";

                const lockMsgSafe = flat.isLocked ? btoa(escape(flat.lockReason)) : "";
                const clickAction = flat.isLocked ? `window.showLockedAlert('${lockMsgSafe}')` : `window.selectLesson('${les.id}')`;

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
                    <div class="accordion-body p-0 ps-2 pt-1">${itemsHtml}</div>
                </div>
            </div>`;
    });
}

// ============================================================
// 4. SELEÇÃO DE AULA (COM ABA AUTOMÁTICA + CORREÇÃO IMAGEM)
// ============================================================

window.selectLesson = (id) => {
    const lesson = STATE.flatLessons.find(l => l.id === id);
    if (!lesson) return;
    if (lesson.isLocked) { window.showToast(lesson.lockReason, 'warning'); return; }

    STATE.currentLessonId = id;

    // --- CORREÇÃO 1: FORÇA ABA AULA ABRIR ---
    const tabBtn = document.getElementById('tab-aula-btn');
    if (tabBtn && window.bootstrap) {
        const tab = new bootstrap.Tab(tabBtn);
        tab.show();
    }

    renderNavigation();
    
    // Atualiza Texto Header
    if(document.getElementById('lbl-title')) document.getElementById('lbl-title').textContent = lesson.title;
    if(document.getElementById('lbl-type')) document.getElementById('lbl-type').textContent = lesson.type || 'AULA';
    const descEl = document.getElementById('lbl-desc');
    if(descEl) { descEl.textContent = lesson.description || ''; descEl.style.display = lesson.description ? 'block' : 'none'; }

    renderLessonContent(lesson);
    updateFinishButton(lesson.id);
    updateNavButtons(id);
};

// Helper Inteligente para Links
function getSmartEmbedUrl(url) {
    if (!url) return '';
    // YouTube
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([\w-]{11})/);
    if (ytMatch && ytMatch[1]) return `https://www.youtube.com/embed/${ytMatch[1]}`;
    // Drive
    if (url.includes('drive.google.com')) {
        const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
        if (idMatch && idMatch[1]) return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
    }
    return url;
}

function renderLessonContent(lesson) {
    const player = document.getElementById('player-frame');
    const area = document.getElementById('activity-area');
    player.style.display = 'none'; area.style.display = 'none'; area.innerHTML = '';

    const rawUrl = lesson.video_url || lesson.content_url || '';
    const smartUrl = getSmartEmbedUrl(rawUrl);

    // --- CORREÇÃO 2: DETECÇÃO DE IMAGEM REAL ---
    const isImage = /\.(jpeg|jpg|gif|png|webp)($|\?)/i.test(smartUrl);

    if (['VIDEO_AULA', 'VIDEO'].includes(lesson.type)) {
        player.style.display = 'block';
        player.innerHTML = `<iframe src="${smartUrl}" allowfullscreen style="border-radius:12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width:100%; height:100%;"></iframe>`;
    } 
    else if (lesson.type === 'TEXTO') {
        area.style.display = 'block';
        area.innerHTML = `<div class="card border-0 shadow-sm p-4 typography">${lesson.content || 'Sem conteúdo.'}</div>`;
    }
    else if (['QUIZ', 'TAREFA'].includes(lesson.type)) {
        area.style.display = 'block';
        area.innerHTML = `
            <div class="text-center py-5">
                <div class="bg-primary-subtle d-inline-flex p-4 rounded-circle mb-3"><i class='bx ${ICONS[lesson.type]} fs-1 text-primary'></i></div>
                <h4>Atividade Prática</h4>
                <button class="btn btn-primary px-5 py-3 rounded-pill shadow-sm fw-bold mt-3" onclick="window.openActivityDrawer('${lesson.id}')">INICIAR ATIVIDADE</button>
            </div>`;
    }
    else {
        area.style.display = 'block';
        if(smartUrl) {
            // Se for imagem, renderiza IMG. Se não, Iframe.
            if (isImage) {
                area.innerHTML = `<div class="text-center"><img src="${smartUrl}" class="img-fluid rounded shadow-sm" style="max-height:800px;"></div>`;
            } else {
                area.innerHTML = `<iframe src="${smartUrl}" style="width:100%; height:800px; border:0; border-radius:8px;"></iframe>`;
            }
        } else {
            area.innerHTML = `<div class="alert alert-warning">URL não definida.</div>`;
        }
    }
}

// ============================================================
// 5. AÇÃO CONCLUIR (FIXADO COM ONCLICK NO HTML)
// ============================================================

window.markAsFinished = async function() {
    if (!STATE.classId || !STATE.currentLessonId) return;

    // Salva localmente
    if (!STATE.progress.completed.includes(STATE.currentLessonId)) {
        STATE.progress.completed.push(STATE.currentLessonId);
    }

    // Atualiza UI
    updateFinishButton(STATE.currentLessonId);
    processLocksAndProgress(); 
    renderNavigation(); 
    updateOverallProgress();

    window.showToast("Aula concluída com sucesso!", "success");

    // Salva no Banco
    if (STATE.enrollmentId) {
        const percent = calculateTotalPercent();
        const { error } = await supabase.from('class_enrollments')
            .update({ grades: STATE.progress, progress_percent: percent })
            .eq('id', STATE.enrollmentId);
        
        if(error) console.error("Erro ao salvar:", error);
    }

    // Avança
    setTimeout(() => { const next = document.getElementById('btn-next'); if(next && !next.disabled) next.click(); }, 1500);
};

function updateFinishButton(id) {
    const btn = document.getElementById('btn-finish'); 
    const badge = document.getElementById('lesson-status');
    const isDone = STATE.progress.completed.includes(id);
    
    if (btn && badge) {
        if (isDone) { 
            btn.style.display = 'none'; 
            badge.style.display = 'inline-block'; 
        } else { 
            btn.style.display = 'inline-block'; 
            btn.disabled = false; 
            badge.style.display = 'none'; 
            // --- CORREÇÃO 3: Garante que o evento funcione ---
            btn.setAttribute('onclick', 'window.markAsFinished()');
        }
    }
}

// ============================================================
// 6. MURAL (SINO NA ABA!), NOTAS E CALENDÁRIO
// ============================================================

async function loadMural() {
    const container = document.getElementById('wall-container');
    const { data: posts } = await supabase.from('class_events').select('*').eq('class_id', STATE.classId).order('created_at', {ascending:false});
    
    // --- CORREÇÃO 4: SINO NA ABA (MENU SUPERIOR) ---
    const storageKey = `read_posts_${STATE.classId}`;
    const readPosts = JSON.parse(localStorage.getItem(storageKey)) || [];
    let unreadCount = 0;
    if (posts) posts.forEach(p => { if(!readPosts.includes(p.id)) unreadCount++; });

    const tabBadge = document.getElementById('mural-badge');
    if(tabBadge) {
        if(unreadCount > 0) {
            tabBadge.innerHTML = `<i class='bx bxs-bell-ring bx-tada'></i> ${unreadCount}`;
            // Força a exibição via style, pois seu CSS tinha display:none !important
            tabBadge.style.cssText = "display: inline-block !important;";
            tabBadge.className = 'badge bg-danger ms-1';
        } else {
            tabBadge.style.display = 'none';
        }
    }

    if (!container) return;
    if (!posts || posts.length === 0) {
        container.innerHTML = `<div class="text-center py-5 text-muted">Mural vazio.</div>`;
        return;
    }

    container.className = 'masonry-container';
    container.innerHTML = posts.map(post => {
        const isRead = readPosts.includes(post.id);
        const date = new Date(post.created_at).toLocaleDateString('pt-BR');
        const borderClass = !isRead ? 'border-start border-5 border-danger shadow' : 'border-0 shadow-sm';
        const bellHtml = !isRead ? `<div class="bell-notification"><i class='bx bxs-bell-ring bx-tada text-danger fs-4'></i></div>` : ``;
        let materialBtn = '';
        if(post.resource_url) materialBtn = `<a href="${post.resource_url}" target="_blank" class="d-block w-100 btn btn-sm btn-outline-primary rounded-pill mt-2">Acessar</a>`;

        return `
            <div class="masonry-item">
                <div class="card ${borderClass} h-100 position-relative hover-lift">
                    ${bellHtml}
                    <div class="card-body">
                        <h6 class="fw-bold mb-1">${post.title}</h6>
                        <small class="text-muted d-block mb-2">${date}</small>
                        <p class="small text-muted mb-2">${post.content}</p>
                        ${materialBtn}
                        ${!isRead ? `<button onclick="window.markPostRead('${post.id}')" class="btn btn-sm btn-light w-100 mt-2 text-primary border rounded-pill">Marcar lido</button>` : ''}
                    </div>
                </div>
            </div>`;
    }).join('');
}

window.markPostRead = (postId) => {
    const storageKey = `read_posts_${STATE.classId}`;
    const readPosts = JSON.parse(localStorage.getItem(storageKey)) || [];
    readPosts.push(postId);
    localStorage.setItem(storageKey, JSON.stringify(readPosts));
    loadMural(); // Recarrega para atualizar sino
    window.showToast("Marcado como lido!", "success");
};

async function loadGrades() {
    const container = document.getElementById('grades-list');
    if(!container) return;
    const graded = STATE.flatLessons.filter(l => (l.points && l.points > 0) || ['QUIZ', 'TAREFA'].includes(l.type));
    if (graded.length === 0) { container.innerHTML = `<div class="text-center py-5 text-muted">Sem atividades.</div>`; return; }
    
    let total=0, earned=0;
    const rows = graded.map(l => {
        const max = parseFloat(l.points) || 0; total += max;
        let score = STATE.progress.scores?.[l.id] !== undefined ? parseFloat(STATE.progress.scores[l.id]) : (l.isCompleted ? max : 0);
        earned += score;
        let badge = l.isCompleted ? '<span class="badge bg-success">Entregue</span>' : '<span class="badge bg-secondary">Pendente</span>';
        if(STATE.progress.scores?.[l.id]) badge = '<span class="badge bg-primary">Avaliado</span>';
        return `<tr><td>${l.title}</td><td class="text-center">${badge}</td><td class="text-end fw-bold">${score}/${max}</td></tr>`;
    }).join('');
    
    const percent = total === 0 ? 0 : Math.round((earned / total) * 100);
    container.innerHTML = `<div class="card border-0 shadow-sm mb-4 bg-primary text-white"><div class="card-body p-4 d-flex justify-content-between"><div><h5>Desempenho</h5><small>${percent}%</small></div><div class="fs-3 fw-bold">${earned}/${total}</div></div></div><div class="card border shadow-sm"><table class="table mb-0"><tbody>${rows}</tbody></table></div>`;
}

async function loadCalendar() {
    const container = document.getElementById('calendar-list');
    if(!container) return;
    let events = STATE.flatLessons.filter(l => l.unlock_at).map(l => ({ date: new Date(l.unlock_at), title: l.title }));
    const { data: posts } = await supabase.from('class_events').select('*').eq('class_id', STATE.classId).not('event_date', 'is', null);
    if(posts) posts.forEach(p => events.push({ date: new Date(p.event_date), title: p.title }));
    
    if(events.length === 0) { container.innerHTML = `<div class="text-center py-5 text-muted">Agenda vazia.</div>`; return; }
    events.sort((a,b) => a.date - b.date);
    
    container.innerHTML = '<ul class="list-group">' + events.map(ev => `<li class="list-group-item d-flex justify-content-between"><span>${ev.title}</span><span class="text-muted small">${ev.date.toLocaleDateString()}</span></li>`).join('') + '</ul>';
}

// ============================================================
// 7. UTILITÁRIOS
// ============================================================

window.showLockedAlert = (b64) => { window.showToast(unescape(atob(b64)), 'warning'); };

window.showToast = function(message, type = 'info') {
    const old = document.getElementById('custom-toast'); if(old) old.remove();
    const colors = { 'warning': '#f59e0b', 'success': '#10b981', 'info': '#3b82f6' };
    const icon = type === 'warning' ? 'bx-lock-alt' : 'bx-check-circle';
    const toast = document.createElement('div');
    toast.id = 'custom-toast';
    toast.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #fff; padding: 40px; border-radius: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.3); z-index: 9999; text-align: center; border-top: 10px solid ${colors[type]}; min-width: 350px;`;
    toast.innerHTML = `<i class='bx ${icon}' style="color:${colors[type]}; font-size: 4rem;"></i><div style="font-size:1.2rem; margin-top:15px; font-weight:bold;">${message}</div><button onclick="this.parentElement.remove()" class="btn btn-light mt-3 px-4 rounded-pill border">Fechar</button>`;
    document.body.appendChild(toast);
    setTimeout(() => { if(document.body.contains(toast)) toast.remove(); }, 4000);
};

function injectCustomCSS() {
    const style = document.createElement('style');
    style.innerHTML = `
        /* IMPORTANTE: Garante que o sino apareça mesmo se o CSS padrão esconder */
        #mural-badge { display: inline-block !important; } 
        
        .masonry-container { column-count: 2; column-gap: 1rem; }
        @media(max-width: 768px) { .masonry-container { column-count: 1; } }
        .masonry-item { break-inside: avoid; margin-bottom: 1rem; }
        .hover-lift { transition: transform 0.2s; } .hover-lift:hover { transform: translateY(-5px); }
        .bell-notification { position: absolute; top: 10px; right: 10px; }
    `;
    document.head.appendChild(style);
}

function setupEventListeners() {
    const btnFinish = document.getElementById('btn-finish');
    // Vincula também no load, por garantia
    if (btnFinish) btnFinish.setAttribute('onclick', 'window.markAsFinished()');
    
    const toggleBtn = document.getElementById('btn-toggle-nav');
    if (toggleBtn) toggleBtn.onclick = () => { document.body.classList.toggle('sidebar-collapsed'); };
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

function autoOpenLesson() {
    const next = STATE.flatLessons.find(l => !l.isLocked && !l.isCompleted);
    if(next) window.selectLesson(next.id); else if(STATE.flatLessons.length > 0 && !STATE.flatLessons[0].isLocked) window.selectLesson(STATE.flatLessons[0].id);
}

window.openActivityDrawer = (id) => { window.location.href=`task-builder.html?id=${id}`; };