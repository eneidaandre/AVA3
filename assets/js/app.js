import { getSessionSafe, getUserDisplayName } from './supabaseClient.js';

const appRoot = document.getElementById('app-root');
const logsEl = document.getElementById('logs');

function log(msg) {
  if (logsEl) {
    logsEl.style.display = 'block';
    logsEl.textContent += msg + '\n';
  }
  // Console log para debug
  console.log(msg);
}

async function main() {
  log('[APP] Carregando sessão...');

  // Verifica se o elemento existe antes de tentar escrever nele
  if (appRoot) {
    appRoot.innerHTML = '<div class="muted">Verificando autenticação...</div>';
  }

  const { session, error } = await getSessionSafe();

  if (error) {
    if (appRoot)
      appRoot.innerHTML = `<div style="color:red">❌ Erro: ${error}</div>`;
    log('[ERR] ' + error);
    return;
  }

  if (!session) {
    // Se não tem sessão, o chrome.js vai cuidar dos botões de login
    if (appRoot) appRoot.innerHTML = `<div>⚠️ Você não está logado.</div>`;
    log('[WARN] Sem sessão');
    return;
  }

  const name = getUserDisplayName(session);

  // Mostra mensagem de sucesso na área principal
  if (appRoot) {
    appRoot.innerHTML = `
        <div style="padding: 20px; background: #e0e7ff; border-radius: 8px; color: #333;">
            <h3>✅ Bem-vindo(a), ${name}!</h3>
            <p>Seus cursos serão listados aqui.</p>
        </div>
      `;
  }
  log('[OK] Sessão ativa: ' + name);
}

main();
