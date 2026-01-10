// assets/js/app.js
import { supabaseHealthcheck } from './supabaseClient.js';

function setStatus(html) {
  const el = document.getElementById('status');
  if (el) el.innerHTML = html;
}

async function main() {
  setStatus('Conectando ao Supabase...');

  const res = await supabaseHealthcheck();

  if (!res.ok) {
    setStatus(`
      <b>❌ Falha ao conectar</b><br/>
      <small>${res.message || 'Erro desconhecido'}</small>
      <hr/>
      <small>Dica: confira se <code>config.js</code> tem aspas em URL e KEY.</small>
    `);
    return;
  }

  if (res.hasSession && res.user?.email) {
    setStatus(`
      <b>✅ Supabase OK</b><br/>
      Sessão ativa: <code>${res.user.email}</code>
    `);
  } else {
    setStatus(`
      <b>✅ Supabase OK</b><br/>
      Sessão: <code>não logado</code>
    `);
  }
}

main();
