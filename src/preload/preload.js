// =============================================================================
// preload.js  -  A PONTE ENTRE A TELA E O PROCESSO PRINCIPAL
// =============================================================================
//
// Este e o arquivo que mais confunde quem esta chegando no Electron, entao
// vale a explicacao com calma.
//
// O problema: a interface (index.html + renderer.js) e uma pagina web e, por
// seguranca, ela NAO tem acesso ao Node. Nada de require('fs') ou conexao
// direta com o banco la dentro. Isso e proposital: se a pagina fosse
// comprometida (por exemplo, por um script malicioso), o atacante teria acesso
// ao computador do usuario.
//
// A solucao: o preload. Ele roda na janela ANTES da pagina carregar e tem um
// acesso limitado a APIs do Electron. Aqui decidimos, de forma explicita,
// quais funcoes a interface pode usar. Funciona como um cardapio: a tela so
// consegue pedir o que estiver listado aqui.
//
// Analogia web: o preload e como o "SDK" ou "client" da sua API. A interface
// chama funcoes simples (window.versions.ping()) e nao precisa saber como a
// mensagem chega no processo principal.
//
// Regra de ouro: exponha funcoes especificas e pequenas, nunca o ipcRenderer
// inteiro. Se expusermos o ipcRenderer cru, qualquer script na pagina poderia
// mandar mensagem para qualquer canal do processo principal.
// =============================================================================

// contextBridge: cria a ponte segura entre o preload e a pagina.
// ipcRenderer: envia mensagens ao processo principal (o lado cliente do IPC).
const { contextBridge, ipcRenderer } = require('electron')

// Cria na pagina o objeto global "window.versions" (ou simplesmente
// "versions") com as funcoes abaixo. Foi isso que o renderer.js usou para
// mostrar as versoes na tela. O primeiro parametro e o nome que a pagina vai
// enxergar e o segundo e o objeto com o que sera exposto.
contextBridge.exposeInMainWorld('versions', {
  // Estas tres funcoes leem as versoes direto do processo. Nao precisam falar
  // com o processo principal porque o preload ja tem acesso a "process".
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,

  // Esta funcao pede algo ao processo principal. O ipcRenderer.invoke envia
  // uma mensagem no canal 'ping' e devolve uma Promise com a resposta, que e
  // o 'pong' registrado com ipcMain.handle no main.js. O nome do canal precisa
  // ser exatamente o mesmo nos dois arquivos.
  ping: () => ipcRenderer.invoke('ping')
  // we can also expose variables, not just functions
})

// Exemplo do padrao que vamos repetir quando chegarmos no banco de dados
// (consulte o guia em docs/GUIA-ELECTRON.md):
//   tela chama window.api.users.list()
//     -> preload faz ipcRenderer.invoke('users:list')
//       -> main responde com ipcMain.handle('users:list', ...) consultando o MySQL


// Aqui vamos expor a API de tarefas.
// Mantido para compatibilidade com a estrutura atual do projeto.
contextBridge.exposeInMainWorld('stakper', {
  versions: {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron
  },
  ping: () => ipcRenderer.invoke('ping'),
  tarefas: {
    listar: (payload) => ipcRenderer.invoke('tarefas:listar', payload),
    criar: (payload) => ipcRenderer.invoke('tarefas:criar', payload),
    remover: (payload) => ipcRenderer.invoke('tarefas:remover', payload)
  },
  calendario: {
    listar: (payload) => ipcRenderer.invoke('calendario:listar', payload),
    criar: (payload) => ipcRenderer.invoke('calendario:criar', payload),
    associarTarefa: (payload) => ipcRenderer.invoke('calendario:associar-tarefa', payload),
    atualizar: (payload) => ipcRenderer.invoke('calendario:atualizar', payload),
    remover: (payload) => ipcRenderer.invoke('calendario:remover', payload)
  }
})
