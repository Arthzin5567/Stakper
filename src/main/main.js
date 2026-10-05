// =============================================================================
// main.js  -  PROCESSO PRINCIPAL (MAIN PROCESS)
// =============================================================================
//
// Este e o ponto de entrada do app. O campo "main" do package.json aponta para
// este arquivo, entao quando alguem roda "npm start" o Electron comeca por aqui.
//
// Como pensar nele: se voce vem do mundo web, este arquivo e o "backend" do
// seu app desktop. Ele roda em Node.js de verdade (com acesso a fs, rede,
// banco de dados, sistema operacional, etc.) e e responsavel por:
//
//   - controlar o ciclo de vida do app (abrir, fechar, reabrir);
//   - criar e gerenciar as janelas;
//   - responder aos pedidos que a interface (renderer) faz via IPC;
//   - no futuro, falar com o MySQL (a interface NUNCA deve falar direto).
//
// Importante: aqui NAO existe DOM. Nada de document, window ou HTML. A tela
// vive em outro processo (o renderer), que e a pagina index.html + renderer.js.
// Os dois se comunicam por mensagens (IPC), com a ajuda do preload.js.
// =============================================================================

// "app" controla o ciclo de vida do aplicativo.
// "BrowserWindow" cria e controla janelas.
// "ipcMain" recebe mensagens enviadas pela interface (renderer).
// O sufixo "/main" garante que estamos importando so o que serve ao processo principal.
const { app, BrowserWindow, ipcMain } = require('electron/main')

// Modulo nativo do Node para montar caminhos de arquivo. Usamos ele (em vez de
// concatenar strings com "/") porque no Windows o separador e "\" e no Linux
// e "/". O path.join resolve isso sozinho. O prefixo "node:" indica que e um
// modulo embutido do Node, e nao um pacote do npm.
const path = require('node:path')

// Funcao que cria uma janela do app. Fica separada para podermos chamar de mais
// de um lugar (na inicializacao e quando o app for reativado no macOS).
const createWindow = () => {
  // Cria uma nova janela do desktop. Cada BrowserWindow carrega uma pagina web
  // dentro de um processo renderer proprio.
  const win = new BrowserWindow({
    // Tamanho inicial da janela, em pixels.
    width: 800,
    height: 600,
    // webPreferences controla o que a pagina dentro da janela pode fazer.
    // Os padroes do Electron ja sao seguros (contextIsolation ligado e
    // nodeIntegration desligado), entao so mexa aqui se souber o motivo.
    webPreferences: {
      // Caminho do script de preload. Ele roda dentro da janela ANTES da pagina
      // carregar e e a unica ponte autorizada entre a pagina e o Node.
      // __dirname e a pasta onde este arquivo (main.js) esta, entao o caminho
      // funciona independente de onde o comando foi executado.
      preload: path.join(__dirname, '..', 'preload', 'preload.js')
    }
  })

  // Carrega o HTML da interface dentro da janela. O caminho e relativo a raiz
  // do projeto. Se um dia o index.html mudar de pasta, ajuste aqui.
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))
}

// O Electron nao pode criar janelas antes de terminar de inicializar.
// whenReady() devolve uma Promise que resolve quando ele esta pronto,
// e e dentro dela que fazemos o setup inicial do app.
app.whenReady().then(() => {
  // Registra um "canal" de comunicacao chamado 'ping'. Sempre que a interface
  // chamar ipcRenderer.invoke('ping'), esta funcao roda aqui no processo
  // principal e o valor retornado volta para a interface como resposta.
  // Pense nisso como uma rota de API interna: o canal e a URL, e a funcao e
  // o controller. Este exemplo so devolve 'pong', serve para testar a ligacao.
  // Os handlers precisam ser registrados antes de a janela abrir para que
  // estejam prontos quando a pagina fizer a primeira chamada.
  ipcMain.handle('ping', () => 'pong')

  // Abre a primeira janela do app.
  createWindow()

  // No macOS e comum fechar todas as janelas mas manter o app vivo no Dock.
  // Quando o usuario clica no icone do Dock, o evento 'activate' dispara e,
  // se nao houver nenhuma janela aberta, criamos uma nova.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Disparado quando a ultima janela e fechada.
// Em Windows e Linux, fechar a ultima janela deve encerrar o app por completo.
// No macOS ('darwin') a convencao e o app continuar rodando no Dock, por isso
// so chamamos app.quit() nas outras plataformas.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})