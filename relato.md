# Relatório e Roteiro de Apresentação: Comunicação Inter-Processos (IPC) em TypeScript

**Instituição:** Instituto Federal de Educação, Ciência e Tecnologia do Rio Grande do Norte (IFRN)  
**Campus:** Natal-Central / DIATINF  
**Curso:** Superior em Análise e Desenvolvimento de Sistemas  
**Disciplina:** Sistemas Operacionais  
**Grupo de Trabalho:** Arkângelo, Jadson e Luiz  

---

## 1. Comunicação entre Tarefas em TypeScript

### Informações Gerais
TypeScript é uma linguagem fortemente tipada baseada em JavaScript que executa sobre o runtime Node.js. Embora o JavaScript seja tradicionalmente *single-threaded* (utilizando um *Event Loop*), o Node.js expõe APIs nativas do sistema operacional para suportar threads secundárias (`worker_threads`), subprocessos (`child_process`) e sockets de rede (`net`), permitindo implementar modelos de Comunicação Inter-Processos (IPC).

### Qual o objetivo da comunicação entre tarefas?
O objetivo é permitir que tarefas paralelas ou concorrentes troquem informações, sincronizem suas execuções e compartilhem recursos de maneira segura. Isso possibilita decompor um problema complexo (como o padrão Produtor-Consumidor) em partes independentes, otimizando o uso de múltiplos núcleos do processador ou a distribuição em rede.

### Por que usar Docker e qual a sua configuração?
O uso do Docker garante um ambiente uniforme e isolado para execução do código TypeScript sem depender de configurações locais do sistema operacional ou versões do Node.js instaladas na máquina do usuário. Além disso, permite simular em um único computador múltiplos nós de rede conectados via redes virtuais (`bridge`), facilitando a demonstração de comunicação em sistemas distribuídos.

**Configuração do Docker utilizada:**
- **Dockerfile:** Baseado na imagem oficial `node:20-alpine`, instalando as dependências do projeto e executando os scripts via `tsx`.
- **docker-compose.yml:** Cria dois serviços (`servidor` e `cliente`) interligados por uma rede interna virtual do Docker (`rede-ipc`), simulando duas máquinas isoladas na rede.

---

## 2. Roteiro Prático e Divisão da Apresentação em Sala

---

### Parte 1: Cenário 1 — Threads no Mesmo Processo (Luiz)

#### Explicação:
A comunicação entre tarefas leves (*threads*) ocorre compartilhando o mesmo espaço de endereçamento de memória dentro de um único processo do Node.js.

Para alcançar alta performance e eliminar a cópia desnecessária de dados em memória, utiliza-se um **`SharedArrayBuffer`**. Essa estrutura reserva um bloco contínuo de memória RAM bruta acessível simultaneamente por ambas as threads:
- **Thread Produtora:** Instanciada via biblioteca nativa `worker_threads`, preenche o vetor compartilhado com 100 números inteiros aleatórios.
- **Thread Consumidora:** Aguarda o sinal da thread principal via troca de mensagens (`parentPort.postMessage`) indicando que a carga de dados está concluída, e então realiza a leitura direta da memória para somar todos os elementos.

#### Comando para executar no terminal:
```powershell
npm run cenario1
```

#### Resultado obtido no terminal:
```text
iniciou (Thread Principal)
# produzir - iniciado
# produzir [67, 91, 34, 101, 64... (total: 100)]
# produzir - terminado
### consumir - iniciado
### resultado -> 5518
### consumir - terminado
finalizou (Thread Principal)
```

#### Código Comentado (`src/typescript/cenario1_threads.ts`):
```typescript
import { Worker, isMainThread, workerData, parentPort } from 'worker_threads';

const TAMANHO_DADOS = 100;

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

if (isMainThread) {
  console.log('iniciou (Thread Principal)');
  
  // Aloca bloco de memória compartilhada direta (100 inteiros x 4 bytes cada)
  const sharedBuffer = new SharedArrayBuffer(TAMANHO_DADOS * Int32Array.BYTES_PER_ELEMENT);

  // Instancia as duas threads filhas passando a referência da memória compartilhada
  const produtor = new Worker(__filename, { workerData: { role: 'produtor', buffer: sharedBuffer } });
  const consumidor = new Worker(__filename, { workerData: { role: 'consumidor', buffer: sharedBuffer } });

  // Sincronização: aciona o consumidor somente após o produtor avisar que concluiu a geração
  produtor.on('message', (msg) => {
    if (msg === 'dados_prontos') {
      consumidor.postMessage('iniciar_consumo');
    }
  });

  let workersFinalizados = 0;
  const aoFinalizar = () => {
    workersFinalizados++;
    if (workersFinalizados === 2) console.log('finalizou (Thread Principal)');
  };

  produtor.on('exit', aoFinalizar);
  consumidor.on('exit', aoFinalizar);
} else {
  // Código executado pelas Threads filhas (Worker Threads)
  const { role, buffer } = workerData;
  const sharedArray = new Int32Array(buffer); // Mapeia o buffer para um array manipulável

  if (role === 'produtor') {
    console.log('# produzir - iniciado');
    for (let i = 0; i < TAMANHO_DADOS; i++) {
      sharedArray[i] = getRandomInt(0, 110);
    }
    console.log(`# produzir [${Array.from(sharedArray).slice(0, 5).join(', ')}... (total: ${TAMANHO_DADOS})]`);
    console.log('# produzir - terminado');
    parentPort?.postMessage('dados_prontos'); // Notifica a thread principal
  } else if (role === 'consumidor') {
    parentPort?.on('message', (msg) => {
      if (msg === 'iniciar_consumo') {
        console.log('### consumir - iniciado');
        let resultado = 0;
        for (let i = 0; i < TAMANHO_DADOS; i++) {
          resultado += sharedArray[i]; // Lê diretamente da memória compartilhada
        }
        console.log(`### resultado -> ${resultado}`);
        console.log('### consumir - terminado');
        process.exit(0);
      }
    });
  }
}
```

---

### Parte 2: Cenário 2 — Processos Distintos no Mesmo Computador (Arkângelo)

#### Explicação:
A comunicação é feita entre dois processos totalmente isolados pelo Sistema Operacional executando na mesma máquina.

Diferente do cenário de threads, cada processo possui seu próprio espaço de endereçamento de memória protegido pelo SO. Por essa razão, os dados não podem ser compartilhados via ponteiros de memória:
- É utilizada a API **`child_process.fork()`** do Node.js, que cria um processo filho independente.
- A comunicação ocorre por meio de canais IPC nativos (pipes anônimos / soquetes de domínio Unix gerenciados pelo sistema operacional).
- O processo pai gera os 100 números aleatórios e envia o payload serializado para o processo filho através de `filho.send()`. O filho escuta o evento via `process.on('message')`, realiza o processamento da soma e devolve o resultado final para o pai antes de ser encerrado.

#### Comando para executar no terminal:
```powershell
npm run cenario2
```

#### Resultado obtido no terminal:
```text
iniciou (Processo Pai)
# produzir - iniciado
# produzir [12, 85, 43, 99, 0... (total: 100)]
# produzir - terminado
### consumir - iniciado
### consumir - terminado
### resultado -> 5214
finalizou (Processo Pai)
```

#### Código Comentado (`src/typescript/cenario2_mesmo_pc.ts`):
```typescript
import { fork } from 'child_process';

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

if (!process.env.IS_CHILD) {
  // PROCESSO PAI
  console.log('iniciou (Processo Pai)');
  
  // Cria o processo filho isolado e estabelece o canal IPC (Pipe do SO)
  const child = fork(__filename, [], {
    env: { ...process.env, IS_CHILD: 'true' }
  });

  const TAMANHO_DADOS = 100;
  const dados: number[] = [];
  for (let i = 0; i < TAMANHO_DADOS; i++) {
    dados.push(getRandomInt(0, 110));
  }

  console.log('# produzir - iniciado');
  console.log(`# produzir [${dados.slice(0, 5).join(', ')}... (total: ${TAMANHO_DADOS})]`);
  console.log('# produzir - terminado');

  // Transmite o array serializado via Pipe do SO para o processo filho
  child.send({ tipo: 'DADOS', Payload: dados });

  // Escuta a resposta devolvida pelo processo filho
  child.on('message', (msg: any) => {
    if (msg.tipo === 'RESULTADO') {
      console.log(`### resultado -> ${msg.payload}`);
      console.log('finalizou (Processo Pai)');
      process.exit(0);
    }
  });
} else {
  // PROCESSO FILHO
  process.on('message', (msg: any) => {
    if (msg.tipo === 'DADOS') {
      console.log('### consumir - iniciado');
      const dados: number[] = msg.Payload;
      const resultado = dados.reduce((acc, curr) => acc + curr, 0);
      console.log('### consumir - terminado');
      
      // Retorna o cálculo para o processo pai através do canal IPC
      process.send?.({ tipo: 'RESULTADO', payload: resultado });
    }
  });
}
```

---

### Parte 3: Cenário 3 — Processos via Sockets TCP / Docker (jadson)

#### Explicação:
A comunicação é levada para a camada de rede usando o protocolo **TCP (Transmission Control Protocol)** via biblioteca nativa `net` do Node.js. Esse modelo permite a comunicação tanto em localhost quanto entre computadores fisicamente distantes ou contêineres em uma rede virtualizada.

O cenário simula dois ambientes isolados interligados por uma rede virtual `bridge`:
1. **Servidor (Consumidor):** Abre um soquete TCP escutando na porta 3000. Quando recebe a mensagem contendo o array em JSON, calcula a soma e responde na mesma conexão.
2. **Cliente (Produtor):** Conecta-se ao IP/hostname do servidor via TCP, gera os 100 números e envia pela rede. Aguarda a resposta do servidor com a soma e encerra a conexão.

#### Comandos para executar no terminal (Modo Local):
- **Terminal 1 (Abre o servidor):**
  ```powershell
  npm run cenario3:server
  ```
- **Terminal 2 (Executa o cliente):**
  ```powershell
  npm run cenario3:client
  ```

*(Opcional via Docker Compose)*:
```powershell
docker-compose up --build
```

#### Resultado obtido no terminal:
**Terminal do Servidor:**
```text
Servidor Consumidor escutando na porta 3000...
Cliente conectado via TCP.
### consumir - iniciado
### resultado -> 5380
### consumir - terminado
Cliente desconectado.
```

**Terminal do Cliente:**
```text
# produzir - iniciado
# produzir [44, 91, 12, 87, 65... (total: 100)]
# produzir - terminado
Conectado ao Servidor Consumidor.
### Resposta do Servidor -> Soma: 5380
```

#### Código do Servidor TCP (`src/typescript/cenario3_servidor.ts`):
```typescript
import * as net from 'net';

const PORT = 3000;

// Cria o servidor de conexões TCP
const server = net.createServer((socket) => {
  console.log('Cliente conectado via TCP.');

  socket.on('data', (data) => {
    console.log('### consumir - iniciado');
    const payload = JSON.parse(data.toString());
    const numeros: number[] = payload.dados;
    
    const resultado = numeros.reduce((acc, curr) => acc + curr, 0);
    console.log(`### resultado -> ${resultado}`);
    console.log('### consumir - terminado');

    // Envia o resultado de volta ao cliente pelo socket TCP
    socket.write(JSON.stringify({ resultado }));
    socket.end();
  });

  socket.on('end', () => {
    console.log('Cliente desconectado.');
  });
});

server.listen(PORT, () => {
  console.log(`Servidor Consumidor escutando na porta ${PORT}...`);
});
```

#### Código do Cliente TCP (`src/typescript/cenario3_cliente.ts`):
```typescript
import * as net from 'net';

const HOST = process.env.SERVER_HOST || '127.0.0.1';
const PORT = 3000;
const TAMANHO_DADOS = 100;

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const dados: number[] = [];
for (let i = 0; i < TAMANHO_DADOS; i++) {
  dados.push(getRandomInt(0, 110));
}

console.log('# produzir - iniciado');
console.log(`# produzir [${dados.slice(0, 5).join(', ')}... (total: ${TAMANHO_DADOS})]`);
console.log('# produzir - terminado');

// Conecta ao servidor TCP
const client = net.createConnection({ host: HOST, port: PORT }, () => {
  console.log('Conectado ao Servidor Consumidor.');
  // Transmite o vetor de dados serializado
  client.write(JSON.stringify({ dados }));
});

client.on('data', (data) => {
  const resposta = JSON.parse(data.toString());
  console.log(`### Resposta do Servidor -> Soma: ${resposta.resultado}`);
  client.end();
});
```

---

## 3. Conclusão

Através das três abordagens implementadas em TypeScript/Node.js, foi possível analisar na prática as principais formas de comunicação entre tarefas suportadas pelos sistemas operacionais modernos:
1. **Memória Compartilhada e Threads (`worker_threads` + `SharedArrayBuffer`):** Oferece velocidade máxima e zero overhead de cópia de dados, porém exige mecanismos cuidadosos de sincronização.
2. **Troca de Mensagens em IPC Local (`child_process` + `fork`):** Garante isolamento completo entre processos na mesma máquina através de Pipes do SO.
3. **Sockets de Rede TCP (`net` + Docker):** Proporciona desacoplamento total, permitindo que as tarefas executem em ambientes distribuídos ou contêineres isolados em rede.
