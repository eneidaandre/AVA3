import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verifica sessão (sem forçar login)
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    // 2. Carrega turmas
    loadAvailableClasses(userId);
});

async function loadAvailableClasses(userId) {
    const container = document.getElementById('classes-container');
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px;"><i class="bx bx-loader-alt bx-spin" style="font-size: 2rem; color: #0b57d0;"></i></div>';

    // Busca turmas ativas (onde end_date é futuro ou nulo)
    // Join com Cursos para pegar o título do curso
    const today = new Date().toISOString().split('T')[0];
    
    const { data: classes, error } = await supabase
        .from('classes')
        .select(`
            *,
            courses (title, description),
            class_enrollments (user_id, status)
        `)
        // Opcional: filtrar apenas turmas abertas
        // .or(`end_date.gte.${today},end_date.is.null`) 
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        container.innerHTML = '<p style="text-align:center; color: red;">Erro ao carregar turmas.</p>';
        return;
    }

    container.innerHTML = '';

    if (!classes || classes.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: #666; grid-column: 1/-1;">Nenhuma turma disponível no momento.</p>';
        return;
    }

    // Renderiza Cards
    classes.forEach(cls => {
        const courseTitle = cls.courses?.title || 'Curso Geral';
        
        // Verifica se usuário já está matriculado
        let enrollmentStatus = null; // null, pending, active
        if (userId && cls.class_enrollments) {
            const enrollment = cls.class_enrollments.find(e => e.user_id === userId);
            if (enrollment) enrollmentStatus = enrollment.status;
        }

        // Define texto e ação do botão
        let btnHtml = '';
        if (!userId) {
            // Não logado -> Botão leva para login
            btnHtml = `<button onclick="window.location.href='login.html'" class="btn-enroll"><i class='bx bx-log-in'></i> Entrar para Inscrever-se</button>`;
        } else if (enrollmentStatus === 'active') {
            // Já ativo -> Botão Acessar
            btnHtml = `<button onclick="window.location.href='class-dashboard.html?id=${cls.id}'" class="btn-enroll" style="background-color: #10b981;"><i class='bx bx-play-circle'></i> Acessar Aula</button>`;
        } else if (enrollmentStatus === 'pending') {
            // Pendente -> Botão desabilitado
            btnHtml = `<button disabled class="btn-enroll" style="background-color: #f59e0b; cursor: default;"><i class='bx bx-time'></i> Aguardando Aprovação</button>`;
        } else {
            // Não matriculado -> Botão Inscrever
            btnHtml = `<button onclick="enrollInClass('${cls.id}', ${cls.requires_approval})" class="btn-enroll"><i class='bx bx-user-plus'></i> Matricular-se</button>`;
        }

        // Datas formatadas
        const startDate = cls.start_date ? new Date(cls.start_date).toLocaleDateString('pt-BR') : 'Imediato';

        const html = `
            <article class="course-card">
                <div class="card-header-img">
                    <i class='bx bx-book-reader'></i>
                </div>
                <div class="card-body">
                    <div class="badge-course">${courseTitle}</div>
                    <h3 class="card-title">${cls.name}</h3>
                    
                    <div class="card-meta">
                        <div><i class='bx bx-calendar'></i> Início: ${startDate}</div>
                        ${cls.max_students ? `<div><i class='bx bx-group'></i> Vagas limitadas</div>` : ''}
                    </div>

                    <div class="card-footer">
                        ${btnHtml}
                    </div>
                </div>
            </article>
        `;
        
        container.insertAdjacentHTML('beforeend', html);
    });
}

// Função Global de Matrícula
window.enrollInClass = async (classId, requiresApproval) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    const status = requiresApproval ? 'pending' : 'active';
    
    // Mostra loading (simples)
    const btn = document.activeElement;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Processando...';
    btn.disabled = true;

    const { error } = await supabase
        .from('class_enrollments')
        .insert({
            class_id: classId,
            user_id: session.user.id,
            status: status,
            progress_percent: 0
        });

    if (error) {
        alert("Erro ao realizar matrícula: " + error.message);
        btn.innerHTML = originalText;
        btn.disabled = false;
    } else {
        if (requiresApproval) {
            alert("Solicitação enviada! Aguarde a aprovação do administrador.");
            window.location.reload();
        } else {
            // Redireciona direto se for aprovação automática
            window.location.href = `class-dashboard.html?id=${classId}`;
        }
    }
};