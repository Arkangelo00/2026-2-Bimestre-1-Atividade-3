import { Worker, isMainThread, workerData, parentPort } from "worker_threads";

const TAMANHO_DADOS = 100;

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

if (isMainThread) {
  console.log("iniciou (Thread Principal)");

  const sharedBuffer = new SharedArrayBuffer(
    TAMANHO_DADOS * Int32Array.BYTES_PER_ELEMENT,
  );

  const produtor = new Worker(__filename, {
    workerData: { role: "produtor", buffer: sharedBuffer },
  });
  const consumidor = new Worker(__filename, {
    workerData: { role: "consumidor", buffer: sharedBuffer },
  });

  // Adicionada tipagem explicita no parâmetro msg
  produtor.on("message", (msg: string) => {
    if (msg === "dados_prontos") {
      consumidor.postMessage("iniciar_consumo");
    }
  });

  let workersFinalizados = 0;
  const aoFinalizar = () => {
    workersFinalizados++;
    if (workersFinalizados === 2) {
      console.log("finalizou (Thread Principal)");
    }
  };

  produtor.on("exit", aoFinalizar);
  consumidor.on("exit", aoFinalizar);
} else {
  const { role, buffer } = workerData as {
    role: string;
    buffer: SharedArrayBuffer;
  };
  const sharedArray = new Int32Array(buffer);

  if (role === "produtor") {
    console.log("# produzir - iniciado");
    for (let i = 0; i < TAMANHO_DADOS; i++) {
      sharedArray[i] = getRandomInt(0, 110);
    }
    console.log(
      `# produzir [${Array.from(sharedArray).slice(0, 5).join(", ")}... (total: ${TAMANHO_DADOS})]`,
    );
    console.log("# produzir - terminado");
    parentPort?.postMessage("dados_prontos");
  } else if (role === "consumidor") {
    // Adicionada tipagem explicita no parâmetro msg
    parentPort?.on("message", (msg: string) => {
      if (msg === "iniciar_consumo") {
        console.log("### consumir - iniciado");
        let resultado = 0;
        for (let i = 0; i < TAMANHO_DADOS; i++) {
          resultado += sharedArray[i];
        }
        console.log(`### resultado -> ${resultado}`);
        console.log("### consumir - terminado");
        process.exit(0);
      }
    });
  }
}
