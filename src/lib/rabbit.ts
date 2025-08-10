import amqplib from "amqplib";
import type { Channel } from "amqplib";

const RABBITMQ_URL =
  process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";

let channel: Channel | undefined;

export async function getChannel(): Promise<Channel> {
  if (channel) return channel;

  const conn = await amqplib.connect(RABBITMQ_URL);
  const ch = await conn.createChannel();

  conn.on("close", () => {
    channel = undefined;
  });

  channel = ch;
  return ch;
}
