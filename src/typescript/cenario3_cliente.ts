import * as net from "net";

const HOST = process.env.SERVER_HOST || "localhost";
const PORT = 3000;

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

console.log("# [Cliente Produtor] Produzindo dados...");
const dados: number[] = Array.from({ length: 100 }, () => getRandomInt(0, 110));

const client = new net.Socket();

client.connect(PORT, HOST, () => {
  console.log(`# [Cliente Produtor] Conectado ao servidor ${HOST}:${PORT}`);
  client.write(JSON.stringify(dados));
});

client.on("data", (data) => {
  const resposta = JSON.parse(data.toString());
  console.log("# [Cliente Produtor] Resposta do servidor:", resposta);
  client.destroy();
});

client.on("close", () => {
  console.log("# [Cliente Produtor] Conexão fechada.");
});

client.on("error", (err) => {
  console.error("[Cliente Produtor] Erro na conexão TCP:", err.message);
});
