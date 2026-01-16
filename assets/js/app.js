import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    // Se não estiver logado, manda para o login
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    loadMyCourses(session.user.id);
});

async function loadMyCourses(userId) {
    const container = document.getElementById('my-courses-list');
    
    // Loader
    container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
            <i class="bx bx-loader-alt bx-spin" style="font-size: 2rem; color: #ccc;"></i>
        </div>`;

    // Busca as matrículas do usuário
    // Trazendo dados da Turma (classes) e do Curso (courses) associados
    const { data: enrollments, error } = await supabase
        .from('class_enrollments')
        .select(`
            *,
            classes (
                id, 
                name,
                courses (title, description)
            )
        `)
        .eq('user_id', userId)
        .eq('status', 'active'); // Apenas matrículas ativas

    if (error) {
        console.error("Erro ao carregar cursos:", error);
        container.innerHTML = '<div style="grid-column: 1/-1; text-align:center;">Erro ao carregar seus cursos.</div>';
        return;
    }

    container.innerHTML = '';

    if (!enrollments || enrollments.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 50px; background: white; border-radius: 12px; border: 1px dashed #ccc;">
                <h3>Você ainda não tem cursos.</h3>
                <p class="text-muted">Explore as turmas disponíveis e comece a aprender.</p>
                <a href="index.html" class="btn-enroll" style="width: auto; padding: 10px 30px; display:inline-block; margin-top:10px;">
                    Ver Turmas Disponíveis
                </a>
            </div>`;
        return;
    }

    enrollments.forEach(enroll => {
        const cls = enroll.classes;
        const course = cls.courses;
        
        // Lógica de Progresso (Baseado na contagem de IDs concluídos no JSON)
        const completedCount = enroll.grades?.completed?.length || 0;
        // Aqui assumimos um valor visual fixo de progresso (no backend idealmente calculamos o total de aulas)
        // Como o total de aulas não vem fácil nessa query, usaremos o % salvo no banco se existir, ou um cálculo visual
        const progressPercent = enroll.progress_percent || 0;

        const html = `
            <article class="course-card">
                <div class="card-header-img">
                    <i class='bx bx-book-bookmark'></i>
                </div>
                <div class="card-body">
                    <div class="badge-course">${cls.name}</div>
                    <h3 class="card-title">${course?.title || 'Curso Sem Título'}</h3>
                    
                    <div class="card-meta">
                        <div class="progress-info" style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 5px;">
                            <span class="text-muted">Progresso</span>
                            <span class="text-bold text-primary">${progressPercent}%</span>
                        </div>
                        <div class="progress-container" style="background: #e2e8f0; height: 6px; border-radius: 3px; overflow: hidden;">
                            <div class="progress-bar" style="width: ${progressPercent}%; background: #10b981; height: 100%;"></div>
                        </div>
                        <div style="margin-top: 10px; font-size: 0.8rem; color: #666;">
                            <i class='bx bx-check-circle'></i> ${completedCount} lições concluídas
                        </div>
                    </div>

                    <div class="card-footer">
                        <a href="classroom.html?id=${cls.id}" class="btn-enroll" style="text-align: center; display: block; text-decoration: none;">
                            <i class='bx bx-play'></i> Continuar Estudando
                        </a>
                    </div>
                </div>
            </article>`;
        
        container.insertAdjacentHTML('beforeend', html);
    });
}