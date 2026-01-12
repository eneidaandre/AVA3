import { supabase } from './supabaseClient.js';

const params = new URLSearchParams(window.location.search);
const lessonId = params.get('id');

// --- ESTADO GLOBAL ---
let quizData = {
    settings: {
        mode: 'manual', // 'manual' ou 'bank'
        drawCount: 5,
        externalSource: 'current',
        shuffle: true
    },
    questions: []
};

let lessonInfo = null;
let globalQuestionsBank = []; // Cache para o modal de busca

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', init);

async function init() {
    if (!lessonId) { alert("ID inválido"); return; }
    await checkAuth();
    await loadLessonData();
}

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) window.location.href = 'login.html';
}

async function loadLessonData() {
    const { data, error } = await supabase
        .from('lessons')
        .select(`*, modules(id, title, courses(id, title))`)
        .eq('id', lessonId)
        .single();

    if (error || !data) { alert("Erro ao carregar."); return; }
    
    lessonInfo = data;
    
    // Migra estrutura antiga (array) para nova (objeto) se necessário
    if (Array.isArray(data.quiz_data)) {
        quizData.questions = data.quiz_data;
    } else if (data.quiz_data) {
        quizData = data.quiz_data;
        if(!quizData.settings) quizData.settings = {};
    }

    // Preenche UI
    document.getElementById('quiz-title').textContent = data.title;
    document.getElementById('quiz-points').textContent = (data.points || 0) + ' pts';
    
    const cName = data.modules?.courses?.title || '...';
    const mName = data.modules?.title || '...';
    document.getElementById('quiz-hierarchy').innerHTML = `${cName} > ${mName}`;

    document.getElementById('btn-back').onclick = () => {
        if (data.modules?.courses?.id) window.location.href = `course-editor.html?id=${data.modules.courses.id}`;
        else window.history.back();
    };

    // UI Settings
    document.getElementById('quiz-mode').value = quizData.settings.mode || 'manual';
    document.getElementById('draw-count').value = quizData.settings.drawCount || 5;
    document.getElementById('external-bank-source').value = quizData.settings.externalSource || 'current';

    updateSettingsUI();
    renderQuestions();
    updatePointsDisplay();
}

// --- LOGICA UI & SETTINGS ---

window.updateSettings = function() {
    quizData.settings.mode = document.getElementById('quiz-mode').value;
    quizData.settings.externalSource = document.getElementById('external-bank-source').value;
    
    updateSettingsUI();
    updatePointsDisplay();
};

function updateSettingsUI() {
    const isBank = quizData.settings.mode === 'bank';
    document.getElementById('bank-settings').style.display = isBank ? 'flex' : 'none';
    document.getElementById('alert-bank').style.display = isBank ? 'block' : 'none';
    document.getElementById('alert-fixed').style.display = isBank ? 'none' : 'block';
}

window.updatePointsDisplay = function() {
    const countInput = document.getElementById('draw-count').value;
    quizData.settings.drawCount = parseInt(countInput) || 1;

    const totalPoints = lessonInfo.points || 0;
    const totalQuestions = quizData.questions.length;
    
    let applied = totalQuestions;
    if (quizData.settings.mode === 'bank') {
        applied = quizData.settings.drawCount;
        if(applied > totalQuestions) applied = totalQuestions;
    }

    const val = applied > 0 ? (totalPoints / applied).toFixed(2) : 0;
    
    document.getElementById('points-per-question').textContent = `${val} pts`;
    document.getElementById('count-total').textContent = totalQuestions;
    document.getElementById('count-applied').textContent = applied;
};

// --- RENDERIZAÇÃO ---

window.renderQuestions = function() {
    const container = document.getElementById('questions-list');
    container.innerHTML = '';
    const tplQ = document.getElementById('tpl-question');
    const tplO = document.getElementById('tpl-option');

    quizData.questions.forEach((q, qIdx) => {
        const qClone = tplQ.content.cloneNode(true);
        
        qClone.querySelector('.question-label').textContent = `#${qIdx + 1}`;
        
        // Texto
        const txt = qClone.querySelector('.question-text');
        txt.value = q.text || '';
        txt.oninput = (e) => quizData.questions[qIdx].text = e.target.value;

        // Feedback
        const feed = qClone.querySelector('.question-feedback');
        feed.value = q.feedback || '';
        feed.oninput = (e) => quizData.questions[qIdx].feedback = e.target.value;
        if(q.feedback) {
            feed.parentElement.classList.add('show');
            feed.parentElement.previousElementSibling.innerHTML = '<i class="bx bx-message-detail"></i> Ocultar Feedback';
        }

        // Delete Questão
        qClone.querySelector('.btn-delete').onclick = () => {
            if(confirm("Remover questão?")) {
                quizData.questions.splice(qIdx, 1);
                renderQuestions();
            }
        };

        // Opções
        const optsDiv = qClone.querySelector('.options-container');
        qClone.querySelector('.btn-add-opt').onclick = () => addOption(qIdx);

        q.options.forEach((opt, oIdx) => {
            const oClone = tplO.content.cloneNode(true);
            
            const check = oClone.querySelector('.correct-indicator');
            if (opt.isCorrect) check.classList.add('active');
            check.onclick = () => {
                quizData.questions[qIdx].options.forEach((o, i) => o.isCorrect = (i === oIdx));
                renderQuestions();
            };

            const inp = oClone.querySelector('.option-input');
            inp.value = opt.text || '';
            inp.oninput = (e) => quizData.questions[qIdx].options[oIdx].text = e.target.value;

            oClone.querySelector('.btn-remove-opt').onclick = () => {
                quizData.questions[qIdx].options.splice(oIdx, 1);
                renderQuestions();
            };

            optsDiv.appendChild(oClone);
        });

        container.appendChild(qClone);
    });

    updatePointsDisplay();
};

// --- CRUD ---

window.addQuestion = function() {
    quizData.questions.push({
        id: Date.now(),
        text: "",
        feedback: "",
        options: [{text:"", isCorrect:false}, {text:"", isCorrect:false}]
    });
    renderQuestions();
    setTimeout(() => window.scrollTo({top: document.body.scrollHeight, behavior:'smooth'}), 200);
};

window.addOption = function(qIdx) {
    quizData.questions[qIdx].options.push({text:"", isCorrect:false});
    renderQuestions();
};

// --- IMPORTADOR GIFT ---

window.modalImportGIFT = function() {
    new bootstrap.Modal(document.getElementById('modalGIFT')).show();
};

window.processGIFT = function() {
    const text = document.getElementById('gift-input').value;
    if (!text.trim()) return;

    const clean = text.replace(/\/\/.*$/gm, '');
    const blocks = clean.split(/\n\s*\n/).filter(b => b.trim().length > 0);
    let count = 0;

    blocks.forEach(block => {
        let qText = block.trim();
        let titleMatch = qText.match(/^::(.*?)::/);
        if(titleMatch) qText = qText.replace(titleMatch[0], '').trim();

        let answerMatch = qText.match(/\{(.*?)\}/s);
        if(answerMatch) {
            let options = [];
            let ansContent = answerMatch[1];
            qText = qText.replace(answerMatch[0], '').trim();

            let regex = /([=~])([^#=~]+)(?:#([^=~]+))?/g;
            let m;
            while ((m = regex.exec(ansContent)) !== null) {
                options.push({
                    text: m[2].trim(),
                    isCorrect: m[1] === '=',
                    feedback: m[3] ? m[3].trim() : ''
                });
            }
            if(options.length) {
                quizData.questions.push({ id: Date.now()+Math.random(), text: qText, options });
                count++;
            }
        }
    });

    alert(`${count} importadas.`);
    bootstrap.Modal.getInstance(document.getElementById('modalGIFT')).hide();
    document.getElementById('gift-input').value = '';
    renderQuestions();
};

// --- BANCO DE QUESTÕES (GLOBAL SEARCH) ---

window.openQuestionBank = async function() {
    const modal = new bootstrap.Modal(document.getElementById('modalBank'));
    modal.show();

    const list = document.getElementById('bank-list');
    list.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div><p>Buscando...</p></div>';

    // Busca todas as lições exceto a atual
    const { data: lessons, error } = await supabase
        .from('lessons')
        .select('id, title, quiz_data')
        .not('quiz_data', 'is', null)
        .neq('id', lessonId);

    if (error) {
        list.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
        return;
    }

    // Processa os dados
    globalQuestionsBank = [];
    const sources = new Set();

    lessons.forEach(l => {
        let qs = [];
        if (Array.isArray(l.quiz_data)) qs = l.quiz_data;
        else if (l.quiz_data?.questions) qs = l.quiz_data.questions;

        if (qs.length > 0) {
            sources.add(l.title);
            qs.forEach(q => {
                globalQuestionsBank.push({
                    source: l.title,
                    data: q
                });
            });
        }
    });

    // Filtros
    const select = document.getElementById('bank-source-filter');
    select.innerHTML = '<option value="">Todas as Fontes</option>';
    sources.forEach(s => select.innerHTML += `<option value="${s}">${s}</option>`);

    renderBankList(globalQuestionsBank);
};

window.renderBankList = function(items) {
    const list = document.getElementById('bank-list');
    list.innerHTML = '';
    
    if(!items.length) {
        list.innerHTML = '<div class="alert alert-warning">Nenhuma questão encontrada.</div>';
        return;
    }

    items.forEach((item, idx) => {
        const q = item.data;
        const div = document.createElement('div');
        div.className = 'card p-3 shadow-sm border-0 bank-item-row';
        div.dataset.source = item.source;
        div.dataset.text = (q.text || '').toLowerCase();
        
        div.innerHTML = `
            <div class="d-flex gap-3 align-items-start">
                <div class="form-check">
                    <input class="form-check-input bank-chk" type="checkbox" value="${idx}" style="transform: scale(1.3);">
                </div>
                <div class="flex-grow-1 cursor-pointer" onclick="this.previousElementSibling.querySelector('input').click()">
                    <div class="d-flex justify-content-between mb-1">
                        <span class="badge bg-light text-dark border">${item.source}</span>
                        <span class="badge bg-secondary">${q.options?.length || 0} opts</span>
                    </div>
                    <p class="mb-0 fw-bold text-dark">${q.text}</p>
                </div>
            </div>
        `;
        list.appendChild(div);
    });

    document.querySelectorAll('.bank-chk').forEach(c => c.addEventListener('change', () => {
        document.getElementById('bank-selected-count').innerText = document.querySelectorAll('.bank-chk:checked').length;
    }));
};

window.filterBank = function() {
    const txt = document.getElementById('bank-search').value.toLowerCase();
    const src = document.getElementById('bank-source-filter').value;
    
    const rows = document.querySelectorAll('.bank-item-row');
    rows.forEach(r => {
        const matchTxt = r.dataset.text.includes(txt);
        const matchSrc = src === "" || r.dataset.source === src;
        r.style.display = (matchTxt && matchSrc) ? 'block' : 'none';
    });
};

window.importFromBank = function() {
    const chks = document.querySelectorAll('.bank-chk:checked');
    let count = 0;
    chks.forEach(c => {
        const item = globalQuestionsBank[c.value];
        if(item) {
            // Clone profundo para não vincular referência
            const clone = JSON.parse(JSON.stringify(item.data));
            clone.id = Date.now() + Math.random();
            quizData.questions.push(clone);
            count++;
        }
    });

    if(count > 0) {
        alert(`${count} importadas!`);
        bootstrap.Modal.getInstance(document.getElementById('modalBank')).hide();
        renderQuestions();
    } else {
        alert("Selecione algo.");
    }
};

// --- SALVAR ---

window.saveQuiz = async function() {
    if(!quizData.questions.length) { alert("Adicione questões."); return; }

    const { error } = await supabase
        .from('lessons')
        .update({ quiz_data: quizData })
        .eq('id', lessonId);

    if(error) alert("Erro: " + error.message);
    else alert("Salvo com sucesso!");
};