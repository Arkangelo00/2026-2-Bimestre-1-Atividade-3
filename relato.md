# Relatório sobre implementação de comunicação entre tarefas em TypeScript

## Introdução
Este relato faz parte do processo avaliativo da disciplina de Sistemas Operacionais no curso superior em Análise e Desenvolvimento de Sistemas, ofertado na Diretoria Acadêmica de Gestão e Tecnologia da Informação (DIATINF) no campus Natal-Central do Instituto Federal de Educação, Ciência e Tecnologia do Rio Grande do Norte (IFRN).

Tem como objetivo principal relatar as implementações de comunicação entre tarefas na linguagem **TypeScript (Node.js)**.

O grupo de trabalho foi formado por: **Arkângelo, Jadson e Luiz**.

---

## Comunicação entre tarefas em TypeScript

### Informações gerais
TypeScript é uma linguagem fortemente tipada baseada em JavaScript que executa sobre o runtime Node.js. Embora o JavaScript seja conhecido por possuir um modelo single-threaded com *Event Loop*, o Node.js expõe APIs nativas do sistema operacional para suportar threads secundárias (`worker_threads`), subprocessos (`child_process`) e sockets de rede (`net`), permitindo implementar modelos complexos de Comunicação Inter-Processos (IPC).

### Qual o objetivo de comunicação entre tarefas?
O objetivo é permitir que tarefas paralelas ou concorrentes troquem informações, sincronizem suas execuções e compartilhem recursos de maneira segura. Isso possibilita decompor um problema complexo (como o padrão Produtor-Consumidor) em partes independentes, otimizando o uso de múltiplos núcleos do processador ou a distribuição em rede.

### Explicar porque usar Docker nesse trabalho. Qual a configuração do Docker?
O uso do Docker garante um ambiente uniforme e isolado para execução do código TypeScript sem depender de configurações locais do sistema operacional ou versões do Node.js instaladas na máquina do usuário. Além disso, permite simular em um único computador múltiplos nós de rede conectados via redes virtuais (`bridge`), facilitando a demonstração de comunicação em sistemas distribuídos.

**Configuração do Docker utilizada:**
- **Dockerfile:** Baseado na imagem oficial `node:20-alpine`, instalando as dependências do projeto e compilando o TypeScript via `ts-node`.
- **docker-compose.yml:** Cria dois serviços (`servidor` e `cliente`) interligados por uma rede interna virtual do Docker (`rede-ipc`), simulando duas máquinas isoladas na rede.

---

## Comunicação entre tarefas com linhas de execução no mesmo processo

### Código
Utilizamos a biblioteca `worker_threads` do Node.js associada à memória compartilhada em baixo nível via `SharedArrayBuffer` e sincronização por troca de mensagens entre a thread principal e os workers.

```typescript
import { Worker, isMainThread, workerData, parentPort } from 'worker_threads';

const TAMANHO_DADOS = 100;

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

if (isMainThread) {
  console.log('iniciou (Thread Principal)');
  const sharedBuffer = new SharedArrayBuffer(TAMANHO_DADOS * Int32Array.BYTES_PER_ELEMENT);

  const produtor = new Worker(__filename, { workerData: { role: 'produtor', buffer: sharedBuffer } });
  const consumidor = new Worker(__filename, { workerData: { role: 'consumidor', buffer: sharedBuffer } });

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
  const { role, buffer } = workerData;
  const sharedArray = new Int32Array(buffer);

  if (role === 'produtor') {
    console.log('# produzir - iniciado');
    for (let i = 0; i < TAMANHO_DADOS; i++) {
      sharedArray[i] = getRandomInt(0, 110);
    }
    console.log(`# produzir [${Array.from(sharedArray).slice(0, 5).join(', ')}... (total: ${TAMANHO_DADOS})]`);
    console.log('# produzir - terminado');
    parentPort?.postMessage('dados_prontos');
  } else if (role === 'consumidor') {
    parentPort?.on('message', (msg) => {
      if (msg === 'iniciar_consumo') {
        console.log('### consumir - iniciado');
        let resultado = 0;
        for (let i = 0; i < TAMANHO_DADOS; i++) {
          resultado += sharedArray[i];
        }
        console.log(`### resultado -> ${resultado}`);
        console.log('### consumir - terminado');
        process.exit(0);
      }
    });
  }
}
