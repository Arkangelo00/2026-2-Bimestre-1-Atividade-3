import { fork, ChildProcess } from "child_process";

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

if (process.argv[2] === "filho") {
  // Processo Consumidor (Filho)
  process.on("message", (dados: number[]) => {
    console.log("### [Filho] consumir - iniciado");
    console.log(`### [Filho] dados recebidos (tamanho): ${dados.length}`);
    const resultado = dados.reduce((acc, val) => acc + val, 0);
    console.log(`### [Filho] resultado -> ${resultado}`);
    console.log("### [Filho] consumir - terminado");
    if (process.send) process.send({ status: "sucesso", resultado });
    process.exit(0);
  });
} else {
  // Processo Produtor (Pai)
  console.log("[Pai] iniciou");

  const processoFilho: ChildProcess = fork(__filename, ["filho"]);

  console.log("# [Pai] produzir - iniciado");
  const dados: number[] = Array.from({ length: 100 }, () =>
    getRandomInt(0, 110),
  );
  console.log("# [Pai] dados produzidos com sucesso.");
  console.log("# [Pai] enviar dados ao filho via IPC Pipe");

  processoFilho.send(dados);

  processoFilho.on("message", (msg) => {
    console.log("[Pai] Confirmação recebida do filho:", msg);
  });

  processoFilho.on("exit", () => {
    console.log("[Pai] finalizou");
  });
}
