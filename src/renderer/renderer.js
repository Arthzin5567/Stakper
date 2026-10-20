// =============================================================================
// renderer.js  -  O JAVASCRIPT DA TELA (RENDERER PROCESS)
// =============================================================================
//
// Este arquivo e carregado pelo index.html por uma tag <script>, e roda dentro
// da pagina, exatamente como o JavaScript de um site comum. Aqui voce tem
// document, window, eventos de clique, manipulacao de DOM e tudo o que ja
// conhece do front-end.
//
// O que voce NAO tem aqui: Node.js. Nao existe require(), nem fs, nem acesso
// direto ao banco. Tudo o que for alem da pagina precisa passar pelo preload,
// usando as funcoes que ele expos em "window". Neste exemplo, o objeto
// "versions" criado no preload.js.
//
// Dica: no Windows/Linux, aperte Ctrl+Shift+I com a janela aberta para abrir o
// DevTools (o mesmo do Chrome). O console.log deste arquivo aparece la, e NAO
// no terminal. Ja o console.log do main.js aparece no terminal.
// =============================================================================

// Pega o <p id="info"> do index.html para escrevermos o texto nele.
const information = document.getElementById('info')

// Preenche o paragrafo com as versoes. "versions" aqui e o mesmo objeto que o
// preload.js publicou com contextBridge.exposeInMainWorld('versions', ...).
// Cada chamada devolve uma string de versao lida do processo.
information.innerText = `This app is using Chrome (v${versions.chrome()}), Node.js (v${versions.node()}), and Electron (v${versions.electron()})`

// Funcao assincrona porque falar com o processo principal leva um tempinho e
// devolve uma Promise, igual a um fetch.
const func = async () => {
  // Fluxo completo desta linha:
  //   1. renderer chama window.versions.ping()
  //   2. o preload manda a mensagem pelo canal 'ping' (ipcRenderer.invoke)
  //   3. o main.js recebe no ipcMain.handle('ping') e responde 'pong'
  //   4. a resposta volta aqui e cai na variavel "response"
  const response = await window.versions.ping()
  console.log(response) // prints out 'pong'
}

const { registerTarefasHandlers } = require('./ipc/tarefas')
registerTarefasHandlers()

// Executa o teste assim que a pagina carrega. Se aparecer 'pong' no console do
// DevTools, a comunicacao entre as duas pontas esta funcionando.
func()