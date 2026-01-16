import { supabase } from './supabaseClient.js';

let currentUser = null;
let cvData = null;

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadProfile();
    await loadCV();
    await loadCertificates();
});

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) window.location.href = 'login.html';
    currentUser = session.user;
}

// 1. CARREGA DADOS BÁSICOS (PROFILE)
async function loadProfile() {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    if(profile) {
        document.getElementById('prof_name').value = profile.name || '';
        document.getElementById('prof_email').value = profile.email || currentUser.email;
        
        // Header Info
        document.getElementById('header-name').textContent = profile.name || 'Usuário';
        document.getElementById('header-email').textContent = profile.email || '---';
        document.getElementById('header-role').textContent = (profile.role || 'Estudante').toUpperCase();
        
        const initials = (profile.name || 'U').substring(0,2).toUpperCase();
        document.getElementById('header-avatar-initials').textContent = initials;
    }
}

// 2. CARREGA E POPULA O CV
async function loadCV() {
    const { data } = await supabase.from('user_cvs').select('*').eq('user_id', currentUser.id).maybeSingle();
    
    cvData = data || {}; // Cache

    // Popula campos simples
    document.getElementById('cv_title').value = cvData.title || '';
    document.getElementById('cv_bio').value = cvData.bio || '';
    document.getElementById('cv_phone').value = cvData.phone || '';
    document.getElementById('cv_linkedin').value = cvData.linkedin_url || '';
    document.getElementById('cv_portfolio').value = cvData.portfolio_url || '';
    document.getElementById('cv_skills').value = (cvData.skills || []).join(', ');

    // Popula Experiência
    const expContainer = document.getElementById('experience-list');
    expContainer.innerHTML = '';
    (cvData.experience || []).forEach(item => addExperienceField(item));

    // Popula Educação
    const eduContainer = document.getElementById('education-list');
    eduContainer.innerHTML = '';
    (cvData.external_education || []).forEach(item => addEducationField(item));
}

// 3. CARREGA CERTIFICADOS (Cursos Concluídos)
async function loadCertificates() {
    const container = document.getElementById('certificates-grid');
    
    // Busca matrículas onde o progresso é 100% ou status 'completed'
    // Como nem sempre o status está atualizado, verificamos ambos ou apenas status se sua lógica for sólida
    const { data: certs, error } = await supabase
        .from('class_enrollments')
        .select(`
            *,
            classes (name, courses (title, total_hours))
        `)
        .eq('user_id', currentUser.id)
        .eq('status', 'completed'); // Assumindo que seu sistema marca como completed

    if(error || !certs || certs.length === 0) {
        container.innerHTML = '<div class="col-12 text-center text-muted py-5"><i class="bx bx-certification fs-1"></i><p>Nenhum certificado disponível ainda.</p></div>';
        return;
    }

    container.innerHTML = '';
    
    certs.forEach(c => {
        // CARD DO CERTIFICADO
        const html = `
            <div class="col-md-6 col-lg-4">
                <div class="card h-100 border-0 shadow-sm certificate-card">
                    <div class="card-body text-center p-4">
                        <div class="mb-3 text-warning display-4"><i class='bx bxs-certification'></i></div>
                        <h6 class="fw-bold mb-1">${c.classes?.courses?.title}</h6>
                        <p class="text-muted small mb-3">Concluído em ${new Date(c.updated_at).toLocaleDateString()}</p>
                        <span class="badge bg-success bg-opacity-10 text-success border border-success mb-3">
                            <i class='bx bx-check'></i> Autenticado
                        </span>
                        <button class="btn btn-outline-primary btn-sm w-100 rounded-pill" onclick="alert('Visualização de PDF do certificado em breve!')">
                            <i class='bx bx-download'></i> Baixar
                        </button>
                    </div>
                </div>
            </div>`;
        container.insertAdjacentHTML('beforeend', html);
    });

    // POPULA LISTA PARA O PDF AUTOMATICAMENTE
    const printList = document.getElementById('ava3-certs-list');
    printList.innerHTML = '';
    certs.forEach(c => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${c.classes?.courses?.title}</strong> <span>${c.classes?.courses?.total_hours || 0}h • ${new Date(c.updated_at).getFullYear()}</span>`;
        printList.appendChild(li);
    });
}

// --- FUNÇÕES DE FORMULÁRIO (DINÂMICO) ---

window.addExperienceField = function(data = {}) {
    const tpl = document.getElementById('tpl-experience-item');
    const clone = tpl.content.cloneNode(true);
    clone.querySelector('.exp-company').value = data.company || '';
    clone.querySelector('.exp-role').value = data.role || '';
    clone.querySelector('.exp-period').value = data.start || ''; // usando start para periodo livre
    clone.querySelector('.exp-desc').value = data.description || '';
    document.getElementById('experience-list').appendChild(clone);
};

window.addEducationField = function(data = {}) {
    const tpl = document.getElementById('tpl-education-item');
    const clone = tpl.content.cloneNode(true);
    clone.querySelector('.edu-school').value = data.institution || '';
    clone.querySelector('.edu-degree').value = data.degree || '';
    clone.querySelector('.edu-year').value = data.year || '';
    document.getElementById('education-list').appendChild(clone);
};

// SALVAR PERFIL
document.getElementById('formProfile').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('prof_name').value;
    const { error } = await supabase.from('profiles').update({ name }).eq('id', currentUser.id);
    if(error) alert("Erro ao salvar: " + error.message);
    else {
        alert("Perfil atualizado!");
        location.reload();
    }
});

// SALVAR CURRÍCULO
document.getElementById('formCV').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Coleta Experiência
    const experience = [];
    document.querySelectorAll('#experience-list .experience-item').forEach(el => {
        experience.push({
            company: el.querySelector('.exp-company').value,
            role: el.querySelector('.exp-role').value,
            start: el.querySelector('.exp-period').value,
            description: el.querySelector('.exp-desc').value
        });
    });

    // Coleta Educação
    const education = [];
    document.querySelectorAll('#education-list .education-item').forEach(el => {
        education.push({
            institution: el.querySelector('.edu-school').value,
            degree: el.querySelector('.edu-degree').value,
            year: el.querySelector('.edu-year').value
        });
    });

    const cvPayload = {
        user_id: currentUser.id,
        title: document.getElementById('cv_title').value,
        bio: document.getElementById('cv_bio').value,
        phone: document.getElementById('cv_phone').value,
        linkedin_url: document.getElementById('cv_linkedin').value,
        portfolio_url: document.getElementById('cv_portfolio').value,
        skills: document.getElementById('cv_skills').value.split(',').map(s => s.trim()).filter(s => s),
        experience: experience,
        external_education: education,
        updated_at: new Date()
    };

    const { error } = await supabase.from('user_cvs').upsert(cvPayload);

    if(error) alert("Erro ao salvar CV: " + error.message);
    else alert("Currículo salvo com sucesso!");
});

// --- GERAR PDF (IMPRESSÃO) ---
window.generatePDF = function() {
    // 1. Preenche os dados de impressão com o que está no form (para garantir que é o mais recente)
    // ou usa o cache cvData. Vamos usar o DOM para pegar o estado visual atual.
    
    document.getElementById('print-name').textContent = document.getElementById('prof_name').value;
    document.getElementById('print-title').textContent = document.getElementById('cv_title').value;
    
    // Contato
    const phone = document.getElementById('cv_phone').value;
    const email = document.getElementById('prof_email').value;
    const linkedin = document.getElementById('cv_linkedin').value;
    
    let contactHtml = `<span>${email}</span>`;
    if(phone) contactHtml += `<span> • ${phone}</span>`;
    if(linkedin) contactHtml += `<span> • LinkedIn</span>`;
    document.getElementById('print-contact').innerHTML = contactHtml;

    // Resumo
    document.getElementById('print-summary').textContent = document.getElementById('cv_bio').value;
    if(!document.getElementById('cv_bio').value) document.getElementById('print-summary-sec').style.display = 'none';
    else document.getElementById('print-summary-sec').style.display = 'block';

    // Skills
    const skills = document.getElementById('cv_skills').value.split(',').filter(s=>s.trim());
    const skillsContainer = document.getElementById('print-skills');
    skillsContainer.innerHTML = '';
    skills.forEach(s => {
        skillsContainer.innerHTML += `<span>${s.trim()}</span>`;
    });
    if(skills.length === 0) document.getElementById('print-skills-sec').style.display = 'none';
    else document.getElementById('print-skills-sec').style.display = 'block';

    // Experiência
    const expContainer = document.getElementById('print-experience');
    expContainer.innerHTML = '';
    document.querySelectorAll('#experience-list .experience-item').forEach(el => {
        const company = el.querySelector('.exp-company').value;
        const role = el.querySelector('.exp-role').value;
        const period = el.querySelector('.exp-period').value;
        const desc = el.querySelector('.exp-desc').value;
        
        if(company || role) {
            expContainer.innerHTML += `
                <div class="cv-item">
                    <div class="cv-item-title">${role}</div>
                    <div class="cv-item-subtitle">${company} | ${period}</div>
                    <div class="cv-item-desc">${desc}</div>
                </div>`;
        }
    });

    // Formação
    const eduContainer = document.getElementById('print-education');
    eduContainer.innerHTML = '';
    document.querySelectorAll('#education-list .education-item').forEach(el => {
        const school = el.querySelector('.edu-school').value;
        const degree = el.querySelector('.edu-degree').value;
        const year = el.querySelector('.edu-year').value;
        
        if(school || degree) {
            eduContainer.innerHTML += `
                <div class="cv-item">
                    <div class="cv-item-title">${degree}</div>
                    <div class="cv-item-subtitle">${school} • ${year}</div>
                </div>`;
        }
    });

    // 2. Aciona Impressão
    window.print();
};

window.logout = async () => {
    await supabase.auth.signOut();
    location.href = 'login.html';
};