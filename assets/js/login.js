import { supabase } from './supabaseClient.js';

// Utilitário para pegar elemento
const $ = (id) => document.getElementById(id);

// Elementos da UI
const msgEl = $('msg');
const viewLogin = $('view-login');
const viewSignup = $('view-signup');
const forgotBox = $('forgot-box');

// --- LÓGICA DE ABAS ---
document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const view = btn.getAttribute('data-view');
        
        // Ativa visualmente a aba
        document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Troca a tela
        if (view === 'login') {
            viewLogin.classList.remove('d-none');
            viewSignup.classList.add('d-none');
            forgotBox.classList.add('d-none');
        } else {
            viewLogin.classList.add('d-none');
            viewSignup.classList.remove('d-none');
            forgotBox.classList.add('d-none');
        }
        clearMsg();
    });
});

// Funções de Mensagem
function setMsg(type, html) {
    if (!msgEl) return;
    msgEl.className = `alert alert-${type}`; // success, danger, info
    msgEl.innerHTML = html;
    msgEl.classList.remove('d-none');
}

function clearMsg() {
    if (!msgEl) return;
    msgEl.classList.add('d-none');
    msgEl.innerHTML = '';
}

// --- AÇÃO DE LOGIN ---
$('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMsg();

    const email = $('login-email').value.trim();
    const password = $('login-pass').value;
    const btn = $('btn-login');

    if (!email || !password) {
        return setMsg('danger', 'Preencha todos os campos.');
    }

    btn.disabled = true;
    btn.innerHTML = 'Entrando...';

    // Tenta Logar
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        console.error("Erro Login:", error);
        btn.disabled = false;
        btn.innerHTML = 'Entrar';
        return setMsg('danger', `Falha ao entrar: ${error.message}`);
    }

    // Sucesso
    setMsg('success', '<i class="bi bi-check-circle-fill"></i> Login realizado! Redirecionando...');
    
    // REDIRECIONA PARA A INDEX (HOME)
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
});

// --- AÇÃO DE CADASTRO ---
$('signup-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMsg();

    const name = $('signup-name').value.trim();
    const email = $('signup-email').value.trim();
    const password = $('signup-pass').value;
    const btn = $('btn-signup');

    btn.disabled = true;
    btn.innerHTML = 'Processando...';

    // URL de redirecionamento após clicar no email
    const redirectTo = new URL('index.html', window.location.href).toString();

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { full_name: name },
            emailRedirectTo: redirectTo
        }
    });

    btn.disabled = false;
    btn.innerHTML = 'Cadastrar';

    if (error) {
        return setMsg('danger', `Erro ao cadastrar: ${error.message}`);
    }

    // Sucesso no envio
    setMsg('success', `
        <div>
            <strong>Cadastro realizado com sucesso!</strong><br>
            Enviamos um link de confirmação para <b>${email}</b>.<br>
            Verifique sua caixa de entrada e SPAM.
        </div>
    `);
    
    e.target.reset();
});

// --- ESQUECI MINHA SENHA ---
$('link-forgot')?.addEventListener('click', (e) => {
    e.preventDefault();
    viewLogin.classList.add('d-none');
    forgotBox.classList.remove('d-none');
    clearMsg();
});

$('forgot-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('forgot-email').value.trim();
    
    if(!email) return setMsg('danger', 'Digite seu e-mail.');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: new URL('reset.html', window.location.href).toString()
    });

    if (error) setMsg('danger', error.message);
    else setMsg('success', 'Link enviado! Verifique seu e-mail.');
});