import { supabase } from './supabaseClient.js';

const $ = (id) => document.getElementById(id);

// --- LOGIN ---
$('form-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    showMsg(); 

    const email = $('login-email').value.trim();
    const password = $('login-pass').value;
    const btn = $('btn-login-submit');

    btn.disabled = true;
    btn.innerText = 'Entrando...';

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        btn.disabled = false;
        btn.innerText = 'Entrar';
        return showMsg('error', 'Erro: ' + error.message);
    }

    showMsg('success', 'Login realizado! Redirecionando...');
    setTimeout(() => { window.location.href = 'index.html'; }, 1000);
});

// --- CADASTRO ---
$('form-signup')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    showMsg();

    const name = $('signup-name').value.trim();
    const email = $('signup-email').value.trim();
    const password = $('signup-pass').value;
    const btn = $('btn-signup-submit');

    if (name.length < 3) return showMsg('error', 'Digite seu nome completo.');

    btn.disabled = true;
    btn.innerText = 'Criando conta...';

    const redirectTo = new URL('index.html', window.location.href).toString();

    // 1. Cria a conta
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { 
            data: { full_name: name }, // Envia meta-dados
            emailRedirectTo: redirectTo 
        }
    });

    if (error) {
        btn.disabled = false;
        btn.innerText = 'Cadastrar';
        return showMsg('error', error.message);
    }

    // 2. Correção de Nome (Fallback): Se entrou direto, força o update no profile
    if (data?.session && data?.user) {
        // Se o banco salvou o email no nome, isso corrige agora mesmo
        await supabase.from('profiles').update({ name: name }).eq('id', data.user.id);
        
        window.location.assign('./app.html');
        return;
    }

    btn.disabled = false;
    btn.innerText = 'Cadastrar';
    showMsg('success', '✅ Conta criada! Verifique seu e-mail (inclusive SPAM) para confirmar o acesso.');
    e.target.reset();
});

// --- ESQUECI SENHA ---
$('act-forgot')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('section-login').style.display = 'none';
    document.getElementById('section-forgot').style.display = 'block';
});

$('form-forgot')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('forgot-email').value.trim();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: new URL('reset.html', window.location.href).toString()
    });

    if (error) showMsg('error', error.message);
    else showMsg('success', 'Link enviado para o e-mail.');
});

// Helper
function showMsg(type, text) {
    const el = $('msg');
    if (!type) {
        el.className = 'alert d-none';
        return;
    }
    el.className = `alert alert-${type}`;
    el.innerText = text;
    el.classList.remove('d-none');
}