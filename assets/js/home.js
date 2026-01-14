import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Verifica usuário
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    loadAvailableClasses(userId);
});

async function loadAvailableClasses(userId) {
    const container = document.getElementById('classes-container');
    
    // Busca turmas
    const { data: classes, error } = await supabase
        .from('classes')
        .select(`
            *,
            courses (title, description),
            class_enrollments (user_id, status)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Erro:", error);
        container.innerHTML = '<p style="text-align:center; color:red;">Não foi possível carregar as turmas.</p>';
        return;
    }

    container.innerHTML = '';

    if (!classes || classes.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px; background: white; border-radius: 16px; border: 1px dashed #ccc;">
                <i class='bx bx-folder-open' style="font-size: 3rem; color: #ddd;"></i>
                <h4 class="mt-3 text-muted">Nenhuma turma aberta no momento.</h4>
            </div>`;
        return;
    }

    classes.forEach(cls => {
        const courseTitle = cls.courses?.title || 'Curso Geral';
        
        // Verifica status da matrícula
        let status = null;
        if (userId && cls.class_enrollments) {
            const enrollment = cls.class_enrollments.find(e => e.user_id === userId);
            if (enrollment) status = enrollment.status;
        }

        // Configura o botão de ação do card
        let actionBtn = '';
        let cardLink = '';

        if (!userId) {
            // Visitante
            actionBtn = `<button onclick="location.href='login.html'" class="btn-card-action">Entrar</button>`;
            cardLink = "login.html";
        } else if (status === 'active') {
            // Aluno
            actionBtn = `<button onclick="location.href='classroom.html?id=${cls.id}'" class="btn-card-action" style="color:#10b981; background:#ecfdf5;">Acessar</button>`;
            cardLink = `classroom.html?id=${cls.id}`;
        } else if (status === 'pending') {
            // Pendente
            actionBtn = `<span class="text-warning small fw-bold"><i class='bx bx-time'></i> Aguardando</span>`;
        } else {
            // Disponível
            actionBtn = `<button onclick="enrollInClass('${cls.id}', ${cls.requires_approval})" class="btn-card-action">Matricular</button>`;
        }

        const startDate = cls.start_date ? new Date(cls.start_date).toLocaleDateString('pt-BR') : 'Imediato';
        const cardClick = cardLink ? `onclick="location.href='${cardLink}'" style="cursor:pointer"` : '';

        const html = `
            <article class="course-card">
                <div class="card-header-img" ${cardClick}>
                    <i class='bx bx-book-open'></i>
                    ${cls.requires_approval ? '<span class="card-status-badge">Requer Aprovação</span>' : ''}
                </div>
                <div class="card-body">
                    <div class="badge-course">${cls.name}</div>
                    <h3 class="card-title" ${cardClick}>${courseTitle}</h3>
                    
                    <div class="card-meta">
                        <small class="text-muted"><i class='bx bx-calendar'></i> Início: ${startDate}</small>
                        ${actionBtn}
                    </div>
                </div>
            </article>
        `;
        
        container.insertAdjacentHTML('beforeend', html);
    });
}

// Matrícula
window.enrollInClass = async (classId, requiresApproval) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }

    const status = requiresApproval ? 'pending' : 'active';
    const btn = document.activeElement;
    if(btn) { btn.innerHTML = '...'; btn.disabled = true; }

    const { error } = await supabase.from('class_enrollments').insert({
        class_id: classId,
        user_id: session.user.id,
        status: status,
        grades: { completed: [], scores: {} }
    });

    if (error) {
        alert("Erro: " + error.message);
        if(btn) { btn.innerHTML = 'Erro'; btn.disabled = false; }
    } else {
        if (requiresApproval) {
            alert("Solicitação enviada!");
            window.location.reload();
        } else {
            window.location.href = `classroom.html?id=${classId}`;
        }
    }
};