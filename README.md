# YouTube Mini Player para Windows

Um mini player flutuante minimalista de vídeos do YouTube para Windows, inspirado no modo Picture-in-Picture (PiP), desenvolvido com **Tauri 2**, **React 19**, **TypeScript**, **Vite** e **Rust**.

---

## 🌟 Funcionalidades Principais

- **Janela Flutuante Minimalista (PiP):**
  - Janela sem bordas nativas e sem barra de título convencional.
  - Proporção padrão 16:9 com cantos arredondados e fundo escuro (`#0c0d0e`).
  - Arraste livre em qualquer área designada (`data-tauri-drag-region`).
  - Posicionamento automático inicial no canto inferior direito da tela (respeitando a barra de tarefas do Windows).
  - Redimensionamento fácil e presets de proporção 16:9 (`Small: 360x202`, `Medium: 448x252`, `Large: 640x360`, `Extra Large: 800x450`).
  - **Sempre no Topo (Always-on-Top):** Mantém-se visível sobre qualquer aplicativo, com controle para ligar/desligar a qualquer momento.

- **Controles Flutuantes com Efeito Hover:**
  - Camada de controles translúcida em *glassmorphism* que aparece ao passar o cursor sobre a janela.
  - Ocultação automática após 1,8 segundos sem movimento do mouse.
  - Botões de **Play/Pause**, **Próximo**, **Anterior**, **Reiniciar Vídeo**, **Barra de Progresso (Seek)**, **Volume/Mudo**, **Fixar/Desafixar no topo**, **Tamanho de Janela** e **Fechar**.

- **Fila de Reprodução Sequencial (Queue / Playlist):**
  - Reprodução contínua e sequencial: ao terminar um vídeo, inicia automaticamente o próximo da fila.
  - Identificação clara do item atual e status de cada vídeo (`Em reprodução`, `Aguardando`, `Concluído`, `Indisponível`).
  - Gaveta de fila elegante: permite visualizar miniaturas (thumbnails), títulos, reordenar vídeos (subir/descer), remover individualmente ou limpar a fila.
  - Não interrompe a reprodução atual ao adicionar novos itens ao final da fila.
  - Prevenção automática de links duplicados (configurável).

- **Adição Rápida via Atalho Global (`Ctrl + Shift + A`):**
  - Atalho global de teclado que abre uma pequena janela flutuante independente e sem bordas, mesmo se outro aplicativo (como editor de código ou navegador) estiver focado.
  - Suporta colar links do clipboard instantaneamente.
  - Permite escolher entre:
    - **Adicionar à Fila** (`Enter`)
    - **Adicionar e Reproduzir Imediatamente** (`Shift + Enter`)
  - Limpa o campo e recolhe a interface após o envio sem interromper o fluxo de trabalho.
  - Janela reutilizada sem criar duplicatas no sistema operacional.

- **Compatibilidade Ampla com URLs do YouTube:**
  - Links convencionais: `https://www.youtube.com/watch?v=VIDEO_ID`
  - Links encurtados: `https://youtu.be/VIDEO_ID`
  - YouTube Shorts: `https://www.youtube.com/shorts/VIDEO_ID`
  - Transmissões ao vivo: `https://www.youtube.com/live/VIDEO_ID`
  - Links com playlist ou ID direto de 11 caracteres.
  - Busca automática de título e autor via YouTube oEmbed oficial (sem necessidade de chaves de API pagas).

- **Persistência Local Completa:**
  - Salva a fila de reprodução, o índice atual, volume e configurações locais entre reinicializações do aplicativo.

---

## ⌨️ Atalhos de Teclado

### Atalhos Globais (Funcionam em qualquer tela/aplicativo no Windows)

| Atalho | Ação |
| :--- | :--- |
| `Ctrl + Shift + Space` | **Mostrar / Ocultar** o Mini Player (o áudio continua tocando em segundo plano) |
| `Ctrl + Shift + A` | **Abrir janela de Adição Rápida** de vídeos |
| `Ctrl + Shift + ►` (Right) | Avançar para o **Próximo vídeo** da fila |
| `Ctrl + Shift + ◄` (Left) | Voltar para o **Vídeo anterior** |
| `Ctrl + Shift + T` | Alternar modo **Sempre no Topo** (Always on Top) |

### Atalhos Locais (Quando a janela do player estiver ativa)

| Tecla | Ação |
| :--- | :--- |
| `Space` | **Play / Pause** da reprodução atual |
| `Esc` | Fechar gaveta de fila ou fechar janela rápida de adição |
| `Enter` | Confirmar adição à fila (na janela rápida) |
| `Shift + Enter` | Adicionar e reproduzir imediatamente (na janela rápida) |

---

## 🛠️ Stack Tecnológica e Decisões de Arquitetura

1. **Tauri 2.x:**
   - Framework para construção de aplicativos desktop leves e seguros com Rust no backend e WebView2 nativo no Windows.
   - Consumo de memória drásticamente inferior ao Electron (~30-50MB em vez de centenas de MB).
   - Plugins oficiais: `@tauri-apps/plugin-global-shortcut` e `@tauri-apps/plugin-opener`.
2. **Rust:**
   - Gerencia recursos nativos do sistema: registro de atalhos globais resilientes, posicionamento matemático no canto da área de trabalho do monitor primário, always-on-top, redimensionamento proporcional e ciclo de vida das janelas.
3. **React 19 + TypeScript + Vite:**
   - Interface rápida, fortemente tipada e modular com hot-reload veloz.
4. **YouTube IFrame Player API:**
   - Instância única lógica e reutilizável do player oficial do YouTube.
   - Detecta eventos `ENDED` (0), `PLAYING` (1), `PAUSED` (2) e erros (códigos 2, 5, 100, 101, 150) com transições sequenciais sem recriar o iframe desnecessariamente.
5. **Lucide Icons:**
   - Ícones limpos e minimalistas (`lucide-react`).

---

## 🚀 Como Executar o Projeto Localmente

### Pré-requisitos
- **Windows 10 ou 11** com Microsoft Edge WebView2 (nativo no Windows).
- **Node.js** (versão 18+ recomendada).
- **Rust e Cargo** (instalados via `rustup`).
- **Build Tools do Visual Studio C++** (MSVC toolchain).

### Instalação de Dependências

```bash
# Na raiz do projeto (C:\dev\miniplayer):
npm install
```

### Executar em Modo de Desenvolvimento

```bash
npm run tauri dev
```
O comando iniciará o servidor Vite em `http://localhost:1420` e abrirá a janela do Tauri em modo debug com recarregamento em tempo real (HMR).

---

## 📦 Como Gerar o Executável e Instaladores de Produção

Para compilar a versão final otimizada para Windows:

```bash
npm run tauri build
```

Após o término da compilação, os seguintes arquivos são gerados:

1. **Instalador NSIS (.exe):**
   - Caminho: `src-tauri/target/release/bundle/nsis/YouTube Mini Player_0.1.0_x64-setup.exe` (~1.4 MB)
2. **Instalador MSI (.msi):**
   - Caminho: `src-tauri/target/release/bundle/msi/YouTube Mini Player_0.1.0_x64_en-US.msi` (~2.1 MB)
3. **Executável Portátil Standalone (.exe):**
   - Caminho: `src-tauri/target/release/tauri-app.exe` (~4.5 MB)

---

## 📁 Estrutura de Diretórios

```
miniplayer/
├── src/
│   ├── components/
│   │   ├── input/
│   │   │   └── YoutubeUrlForm.tsx      # Formulário inicial de URL e guia
│   │   ├── player/
│   │   │   ├── MiniPlayer.tsx          # Container principal do player flutuante
│   │   │   ├── PlayerControls.tsx      # Controles em overlay com animações
│   │   │   └── YoutubeEmbed.tsx        # Integração YouTube IFrame API
│   │   ├── queue/
│   │   │   └── QueueDrawer.tsx         # Gaveta retrátil da fila de reprodução
│   │   ├── quick-add/
│   │   │   └── QuickAddWindow.tsx      # Janela flutuante de adição rápida
│   │   └── ui/
│   │       ├── Icons.tsx               # Ícones customizados e YouTube SVG
│   │       └── Toast.tsx               # Notificações visuais discretas
│   ├── hooks/
│   │   ├── useMouseVisibility.ts       # Detecção de inatividade e hover
│   │   └── usePlayerQueue.ts           # Gestão central da fila e persistência
│   ├── services/
│   │   ├── native.service.ts           # Comunicação com comandos Tauri e IPC
│   │   └── youtube.service.ts          # oEmbed e carregador assíncrono do IFrame
│   ├── styles/
│   │   └── globals.css                 # Estilos visuais dark mode e glassmorphism
│   ├── types/
│   │   └── player.types.ts             # Tipos TypeScript centralizados
│   ├── utils/
│   │   └── youtube-url.ts              # Validador e extrator de URLs e IDs
│   ├── App.tsx                         # Roteamento de janelas e visualizações
│   └── main.tsx                        # Ponto de entrada React
├── src-tauri/
│   ├── capabilities/
│   │   ├── default.json                # Permissões das janelas
│   │   └── desktop.json                # Permissões do plugin de atalhos globais
│   ├── src/
│   │   ├── lib.rs                      # Lógica Rust nativa, comandos e atalhos
│   │   └── main.rs                     # Entrypoint binário do Tauri
│   ├── Cargo.toml                      # Dependências Rust
│   └── tauri.conf.json                 # Configurações de janelas e build do Tauri 2
├── package.json
└── README.md
```

---

## ⚠️ Limitações Conhecidas e Tratamento

1. **Restrições de Incorporação de Determinados Vídeos:**
   - Alguns criadores ou detentores de direitos musicais desativam a reprodução incorporada em players externos (código de erro 101/150 da YouTube API). O aplicativo detecta esses erros automaticamente, exibe um aviso discreto, disponibiliza um botão para abrir diretamente no YouTube no navegador e avança automaticamente para o próximo item da fila.
2. **Políticas de Autoplay do WebView2:**
   - O WebView2 do Windows pode solicitar uma interação inicial do usuário antes de permitir autoplay com áudio ligado caso as políticas do sistema estejam estritas. O aplicativo inclui um botão de reprodução explícito no formulário inicial para garantir conformidade.
3. **Conflito de Atalhos no Windows:**
   - Caso algum atalho global (ex: `Ctrl + Shift + Space`) já esteja registrado com exclusividade por outro utilitário em execução no sistema, o Tauri registra os demais atalhos normalmente sem travar a aplicação.
