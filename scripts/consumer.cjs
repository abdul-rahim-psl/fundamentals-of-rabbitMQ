const amqplib = require("amqplib");
const fs = require("fs");
const path = require("path");

const RABBITMQ_URL =
  process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";
const EXCHANGE = "notifications";
const QUEUE = "email_notifications";
const ROUTING_KEY = "email";

const dataDir = path.join(__dirname, "..", "data");
const dataFile = path.join(dataDir, "processed.json");

function ensureDataFile() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, "[]", "utf8");
}

function appendResult(entry) {
  ensureDataFile();
  const raw = fs.readFileSync(dataFile, "utf8");
  const arr = JSON.parse(raw);
  arr.push(entry);
  fs.writeFileSync(dataFile, JSON.stringify(arr, null, 2));
}

(async () => {
  const conn = await amqplib.connect(RABBITMQ_URL);
  const ch = await conn.createChannel();

  await ch.assertExchange(EXCHANGE, "direct", { durable: true });
  await ch.assertQueue(QUEUE, { durable: true });
  await ch.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);

  ch.prefetch(5);

  console.log("Consumer started. Waiting for messages...");
  ch.consume(
    QUEUE,
    async (msg) => {
      if (!msg) return;

      try {
        const content = JSON.parse(msg.content.toString());
        console.log("Processing email:", content);

        await new Promise((res) => setTimeout(res, 1000));

        appendResult({
          id: content.id,
          to: content.to,
          subject: content.subject,
          processedAt: new Date().toISOString(),
          status: "sent",
        });

        ch.ack(msg);
      } catch (e) {
        console.error("Processing failed, requeueing...", e);
        ch.nack(msg, false, true);
      }
    },
    { noAck: false }
  );

  process.on("SIGINT", async () => {
    console.log("\nShutting down consumer...");
    await ch.close();
    await conn.close();
    process.exit(0);
  });
})();
