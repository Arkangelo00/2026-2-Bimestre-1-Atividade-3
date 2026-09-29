import * as net from "net";

const PORT = 3000;

const server = net.createServer((socket) => {
  console.log(
    "### [Servidor Consumidor] Cliente conectado:",
    socket.remoteAddress,
  );

  socket.on("data", (data) => {
    console.log("### [Servidor Consumidor] Dados recebidos via TCP Socket.");
    try {
      const dados: number[] = JSON.parse(data.toString());
      const resultado = dados.reduce((acc, val) => acc + val, 0);
      console.log(`### [Servidor Consumidor] Soma calculada -> ${resultado}`);

      socket.write(JSON.stringify({ status: "ok", resultado }));
    } catch (err) {
      console.error("Erro ao processar pacote TCP:", err);
    }
  });

  socket.on("end", () => {
    console.log("### [Servidor Consumidor] Conexão encerrada pelo cliente.");
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor Consumidor escutando na porta ${PORT}...`);
});
