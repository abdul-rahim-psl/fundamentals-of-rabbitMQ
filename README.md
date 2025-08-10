# RabbitMQ + Next.js Learning Project

Purpose

- Learn RabbitMQ fundamentals by building a small, testable flow end to end using Next.js.
- Concepts covered: exchanges, queues, bindings, routing keys, message persistence, acknowledgments (ack/nack), and prefetch/back-pressure.

- Producer: Next.js API route publishes messages.
- Broker: RabbitMQ with a direct exchange named `notifications`.
- Queue: `email_notifications` bound with routing key `email`.
- Consumer: Node worker processes messages and records results.
- UI: Simple page to enqueue messages and view processed results.

RabbitMQ fundamentals (quick guide)

- Broker: The RabbitMQ server that receives, routes, and stores messages.
- Exchange: Receives messages from producers and routes them to queues.
  - Types: direct, fanout, topic, headers. We use direct (exact routing-key match).
- Queue: Buffer that stores messages for consumers until they’re acknowledged.
- Binding: Rule that connects an exchange to a queue with a routing key.
- Routing key: A string used by exchanges to decide which queue(s) receive the message.
- Durability & persistence:
  - Durable exchange/queue survive broker restarts.
  - Persistent messages are written to disk if queues are durable.
- Acknowledgments:
  - ack: remove the message from the queue after successful processing.
  - nack/requeue: return the message to the queue for retry on failure.
- Prefetch: Limits how many unacked messages a consumer can hold (back-pressure control).

System architecture

- Next.js API producer: `src/app/api/notify/route.ts`
  - Publishes to exchange `notifications` (type: direct) with routing key `email`.
  - Declares exchange/queue/binding idempotently.
- RabbitMQ broker: `amqp://localhost:5672` (via Docker) with management UI at `http://localhost:15672`.
- Queue: `email_notifications` bound to `notifications` with routing key `email`.
- Consumer worker: `scripts/consumer.cjs`
  - Listens on `email_notifications`, simulates sending an email, then `ack`s.
  - Appends processed results to `data/processed.json`.
- Results API: `src/app/api/results/route.ts`
  - Serves processed results for the UI.
- UI: `src/app/page.tsx`
  - Form to enqueue an email; list to display processed results.

Message flow

1. User fills the form in the UI and submits.
2. UI calls `POST /api/notify` with `{ to, subject, body }`.
3. API publishes to exchange `notifications` using routing key `email`.
4. Binding routes the message to queue `email_notifications`.
5. Consumer receives the message, simulates work, writes to `data/processed.json`, and `ack`s.
6. UI periodically fetches `GET /api/results` and shows processed entries.

Run locally
Prerequisites

- Docker (for RabbitMQ), Node.js 18+.

Environment

- Copy `.env.example` to `.env.local` (already provided):
  - `RABBITMQ_URL=amqp://guest:guest@localhost:5672`

Start RabbitMQ (Management UI enabled)

- `docker run -d --rm -p 5672:5672 -p 15672:15672 --name rabbitmq rabbitmq:3-management`
- UI: http://localhost:15672 (user: `guest`, pass: `guest`)

Install and run

- Install deps: `npm install`
- Start consumer (worker): `npm run consumer`
- Start Next.js dev server: `npm run dev` (http://localhost:3000)

Try it

- In the UI, enter an email, subject, and body, then enqueue.
- Watch the consumer terminal log “Processing…” and see the entry appear in the UI list.
- Inspect the queue/exchange in the RabbitMQ UI to see messages arrive and be consumed.

Files of interest

- Producer: `src/app/api/notify/route.ts`
- Consumer: `scripts/consumer.cjs`
- Results API: `src/app/api/results/route.ts`
- Shared RabbitMQ helper: `src/lib/rabbit.ts`
- UI page: `src/app/page.tsx`

Next steps (optional)

- Replace simulated email with real SMTP via Nodemailer.
- Add retries with a Dead-Letter Exchange (DLX) and TTL.
- Use a topic exchange for pattern-based routing (e.g., `notifications.email.critical`).
- Persist results to a database (SQLite/Postgres) instead of a JSON file.
