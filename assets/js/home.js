import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    loadAvailableClasses(userId);
});

async function loadAvailableClasses(userId) {
    const container = document.getElementById('classes-container');
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px;"><i class="bx bx-loader-alt bx-spin" style="font-size: 2rem; color: #0b57d0;"></i></div>';

    const { data: classes, error } = await supabase
        .from('classes')
        .select(`*, courses(title), class_enrollments(user_id, status)`)
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        container.innerHTML = '<p style="text-align:center;">Erro ao carregar turmas.</p>';
        return;
    }

    container.innerHTML = '';

    if (!classes || classes.length === 0) {
        container.innerHTML = '<div style="text-align:center; grid-column:1/-1; padding:40px; background:white; border-radius:12px;">Nenhuma turma disponível no momento.</div>';
        return;
    }

    classes.forEach(cls => {
        const courseTitle = cls.courses?.title || 'Curso Geral';
        
        let status = null;
        if (userId && cls.class_enrollments) {
            const enroll = cls.class_enrollments.find(e => e.user_id === userId);
            if (enroll) status = enroll.status;
        }

        let btn = '';
        if (!userId) {
            btn = `<button onclick="location.href='login.html'" class="btn-enroll"><i class='bx bx-log-in'></i> Entrar</button>`;
        } else if (status === 'active') {
            btn = `<button onclick="location.href='classroom.html?id=${cls.id}'" class="btn-enroll btn-access"><i class='bx bx-play'></i> Acessar Aula</button>`;
        } else if (status === 'pending') {
            btn = `<button disabled class="btn-enroll" style="background:#f59e0b; opacity:0.7;"><i class='bx bx-time'></i> Aguardando</button>`;
        } else {
            btn = `<button onclick="enroll('${cls.id}', ${cls.requires_approval})" class="btn-enroll"><i class='bx bx-plus'></i> Matricular-se</button>`;
        }

        const startDate = cls.start_date ? new Date(cls.start_date).toLocaleDateString('pt-BR') : 'Imediato';

        const html = `
            <article class="course-card">
                <div class="card-header-img"><i class='bx bx-book-reader'></i></div>
                <div class="card-body">
                    <div class="badge-course">${cls.name}</div>
                    <h3 class="card-title">${courseTitle}</h3>
                    
                    <div class="card-meta">
                        <i class='bx bx-calendar'></i> Início: ${startDate}
                    </div>

                    <div class="card-footer">
                        ${btn}
                    </div>
                </div>
            </article>`;
        container.insertAdjacentHTML('beforeend', html);
    });
}

window.enroll = async (classId, approval) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return location.href = 'login.html';

    const btn = document.activeElement;
    if(btn) { btn.innerHTML = '...'; btn.disabled = true; }

    const { error } = await supabase.from('class_enrollments').insert({
        class_id: classId,
        user_id: session.user.id,
        status: approval ? 'pending' : 'active',
        grades: { completed: [], scores: {} }
    });

    if (error) {
        alert("Erro: " + error.message);
        if(btn) { btn.innerHTML = 'Erro'; btn.disabled = false; }
    } else {
        if (approval) { alert("Solicitação enviada!"); location.reload(); }
        else { location.href = `classroom.html?id=${classId}`; }
    }
};