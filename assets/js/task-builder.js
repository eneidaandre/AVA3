import { supabase } from './supabaseClient.js';

const params = new URLSearchParams(window.location.search);
const lessonId = params.get('id');

// --- ESTADO GLOBAL ---
// Estrutura do JSON da Tarefa
let taskData = {
    instructions: "", // Texto rico ou simples
    items: []         // Array de objetos { id, type, statement }
};

let lessonInfo = null;

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
    // Busca os dados da aula
    const { data, error } = await supabase
        .from('lessons')
        .select(`*, modules(id, title, courses(id, title))`)
        .eq('id', lessonId)
        .single();

    if (error || !data) { alert("Erro ao carregar aula."); return; }
    
    lessonInfo = data;

    // Carrega dados existentes da tarefa (se houver)
    // Assumindo que você tem uma coluna 'task_data' JSONB no banco
    if (data.task_data) {
        taskData = data.task_data;
    }

    // Preenche UI Header
    document.getElementById('task-title').textContent = data.title;
    document.getElementById('task-points').textContent = (data.points || 0) + ' pts';
    
    const cName = data.modules?.courses?.title || '...';
    const mName = data.modules?.title || '...';
    document.getElementById('task-hierarchy').innerHTML = `${cName} > ${mName}`;

    // Preenche Instruções
    document.getElementById('task-instructions').value = taskData.instructions || '';
    
    // Listener para salvar instruções no objeto
    document.getElementById('task-instructions').addEventListener('input', (e) => {
        taskData.instructions = e.target.value;
    });

    // Configura botão voltar
    document.getElementById('btn-back').onclick = () => {
        if (data.modules?.courses?.id) window.location.href = `course-editor.html?id=${data.modules.courses.id}`;
        else window.history.back();
    };

    renderTasks();
}

// --- CRUD DE ITENS ---

window.addTaskItem = function(type) {
    // type pode ser 'text' ou 'link'
    taskData.items.push({
        id: Date.now(),
        type: type,
        statement: "" // O enunciado da pergunta
    });
    renderTasks();
    
    // Scroll para o fim
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);
};

window.removeTaskItem = function(idx) {
    if(confirm("Remover este item da tarefa?")) {
        taskData.items.splice(idx, 1);
        renderTasks();
    }
};

window.renderTasks = function() {
    const container = document.getElementById('task-list');
    container.innerHTML = '';
    const tpl = document.getElementById('tpl-task-item');

    let countText = 0;
    let countLink = 0;

    taskData.items.forEach((item, idx) => {
        const clone = tpl.content.cloneNode(true);
        const card = clone.querySelector('.task-card');

        // Configuração Visual baseada no tipo
        const badge = clone.querySelector('.type-badge');
        const preview = clone.querySelector('.preview-area');
        
        if (item.type === 'text') {
            countText++;
            card.classList.add('type-text');
            badge.classList.add('bg-primary');
            badge.innerHTML = '<i class="bx bx-paragraph"></i> Dissertativa';
            preview.innerHTML = '<textarea class="form-control form-control-sm bg-white" rows="2" disabled placeholder="O aluno digitará a resposta aqui..."></textarea>';
        } else {
            countLink++;
            card.classList.add('type-link');
            badge.classList.add('bg-success');
            badge.innerHTML = '<i class="bx bx-link"></i> Envio de Link';
            preview.innerHTML = '<div class="input-group input-group-sm"><span class="input-group-text"><i class="bx bx-link"></i></span><input type="text" class="form-control bg-white" disabled placeholder="https://drive.google.com/..."></div>';
        }

        // Input do Enunciado
        const inputStatement = clone.querySelector('.item-statement');
        inputStatement.value = item.statement || '';
        inputStatement.oninput = (e) => { taskData.items[idx].statement = e.target.value; };

        // Botão Deletar
        clone.querySelector('.btn-delete').onclick = () => removeTaskItem(idx);

        container.appendChild(clone);
    });

    // Atualiza contadores laterais
    document.getElementById('count-text').textContent = countText;
    document.getElementById('count-link').textContent = countLink;
};

// --- SALVAR ---

window.saveTask = async function() {
    // Validação básica
    if (!taskData.instructions && taskData.items.length === 0) {
        alert("A tarefa está vazia. Adicione instruções ou itens.");
        return;
    }

    // Salva no Supabase
    // ATENÇÃO: Certifique-se que a coluna 'task_data' existe na tabela 'lessons'
    const { error } = await supabase
        .from('lessons')
        .update({ task_data: taskData }) 
        .eq('id', lessonId);

    if (error) {
        alert("Erro ao salvar: " + error.message);
    } else {
        alert("Tarefa salva com sucesso!");
    }
};