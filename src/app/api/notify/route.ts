import { NextResponse } from "next/server";
import { getChannel } from "@/lib/rabbit";
import { randomUUID } from "crypto";

const EXCHANGE = "notifications";
const QUEUE = "email_notifications";
const ROUTING_KEY = "email";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { to, subject, body } =
      payload || ({} as { to?: string; subject?: string; body?: string });

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: "to, subject, and body are required" },
        { status: 400 }
      );
    }

    const ch = await getChannel();

    // Idempotent setup
    await ch.assertExchange(EXCHANGE, "direct", { durable: true });
    await ch.assertQueue(QUEUE, { durable: true });
    await ch.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);

    const message = {
      id: randomUUID(),
      kind: "email" as const,
      to,
      subject,
      body,
      createdAt: new Date().toISOString(),
    };

    const ok = ch.publish(
      EXCHANGE,
      ROUTING_KEY,
      Buffer.from(JSON.stringify(message)),
      { persistent: true, contentType: "application/json" }
    );

    return NextResponse.json({ ok, enqueued: message });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
