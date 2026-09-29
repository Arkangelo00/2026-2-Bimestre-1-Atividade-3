# Relatório e Roteiro de Apresentação: Comunicação Inter-Processos (IPC) em TypeScript

**Instituição:** Instituto Federal de Educação, Ciência e Tecnologia do Rio Grande do Norte (IFRN)  
**Campus:** Natal-Central / DIATINF  
**Curso:** Superior em Análise e Desenvolvimento de Sistemas  
**Disciplina:** Sistemas Operacionais  
**Equipe:** Arkângelo, Jadson e Luiz  

---

## 1. Fundamentação Teórica

### Visão Geral e Objetivo do IPC
TypeScript executa sobre o runtime Node.js. Embora o JavaScript utilize tradicionalmente uma única linha de execução (*single-threaded*) com *Event Loop*, o Node.js expõe APIs do sistema operacional para suportar threads secundárias (`worker_threads`), subprocessos (`child_process`) e conexões de rede (`net`).

O objetivo da Comunicação Inter-Processos (IPC) é permitir que tarefas paralelas troquem dados e sincronizem a execução para resolver um problema de forma cooperativa — como no padrão **Produtor-Consumidor**, onde uma tarefa gera os dados e outra realiza o processamento (soma do vetor de 100 números).

### Utilização do Docker
O Docker padroniza o ambiente de execução independentemente das configurações da máquina local. Ele permite simular em um único computador múltiplos nós isolados conectados em uma rede virtual (`bridge`), demonstrando a comunicação em sistemas distribuídos de forma fiel.

- **Dockerfile:** Baseado na imagem `node:20-alpine`, gerenciando dependências e execução via `tsx`.
- **docker-compose.yml:** Sobe dois containers (`servidor` e `cliente`) interligados pela rede `rede-ipc`.

---

## 2. Roteiro de Apresentação em Sala de Aula

---

### Integrante 1: Arkângelo — Introdução, Conceitos e Cenário 1

#### Texto Expositivo para Apresentação
> A comunicação entre tarefas é essencial na computação concorrente e distribuída, permitindo que processos dividam cargas de trabalho e sincronizem estados para resolver problemas conjuntos.
> 
> O Docker é utilizado para garantir reprodutibilidade do ambiente e isolamento em redes virtuais, simulando diferentes nós sem contaminar o sistema hospedeiro.
> 
> No **Cenário 1**, a comunicação ocorre na mesma linha de execução (mesmo processo) utilizando a biblioteca `worker_threads` e memória compartilhada via `SharedArrayBuffer`. A Thread Produtora grava 100 inteiros diretamente no buffer de memória e envia um sinal para a Thread Consumidora realizar a leitura e soma sem necessidade de cópia de dados pelo sistema operacional.

#### Código Comentado (`src/typescript/cenario1_threads.ts`)
```typescript
import { Worker, isMainThread, workerData, parentPort } from 'worker_threads';

const TAMANHO_DADOS = 100;

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

if (isMainThread) {
  console.log('iniciou (Thread Principal)');
  
  // Aloca bloco de memória compartilhada direto na RAM (400 bytes para 100 inteiros de 32 bits)
  const sharedBuffer = new SharedArrayBuffer(TAMANHO_DADOS * Int32Array.BYTES_PER_ELEMENT);

  // Instancia as duas threads passando a referência da memória compartilhada
  const produtor = new Worker(__filename, { workerData: { role: 'produtor', buffer: sharedBuffer } });
  const consumidor = new Worker(__filename, { workerData: { role: 'consumidor', buffer: sharedBuffer } });

  // Orquestração de mensagens entre threads
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
  const sharedArray = new Int32Array(buffer); // Aponta a view typed array para o buffer

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
