# RabbitMQ Architecture Flow

## Overview

Email Notification System Flow
The system operates through the following sequence:

User Interaction: User interacts with the UI component (page.tsx)

Notification Request: The UI sends a POST request to /api/notify with recipient, subject, and body data, handled by a producer component (route.ts)

Message Publishing: The producer publishes a persistent message to the 'notifications' exchange with routing key 'email'

Message Routing: The exchange routes the message to the durable 'email_notifications' queue

Message Processing: A consumer component (consumer.cjs) consumes messages from the queue with a prefetch of 5, processes them, and writes successful results to storage (data/processed.json)

Result Retrieval: The UI polls /api/results endpoint, which reads from the same data store and returns processing results

This implements a reliable asynchronous messaging pattern where the web application communicates with a background worker through RabbitMQ.

## Components

- Producer: Next.js API `src/app/api/notify/route.ts` publishes messages.
- Exchange: Direct exchange `notifications` (routes by exact routing key).
- Queue: `email_notifications` (durable) stores messages until processed.
- Binding: `notifications` → `email_notifications` with routing key `email`.
- Consumer: Node worker `scripts/consumer.cjs` (prefetch 5, ack on success, nack on failure).
- Results API: `src/app/api/results/route.ts` serves processed results.
- UI: `src/app/page.tsx` submits messages and displays processed entries.
- Data store: `data/processed.json` used for demo visibility.
- Management UI: http://localhost:15672 to inspect exchanges/queues/messages.

## Message Flow

1. User submits the form in the UI → `POST /api/notify` with `{ to, subject, body }`.
2. Producer asserts exchange/queue/binding (idempotent) and publishes with routing key `email` and `persistent: true`.
3. Exchange `notifications` routes the message to queue `email_notifications` via binding key `email`.
4. Consumer receives the message, simulates email send, appends to `data/processed.json`, then `ack`s.
   - On processing error, the worker `nack`s with requeue to retry.
   - `prefetch(5)` limits concurrent unacked messages for back-pressure.
5. UI polls `GET /api/results` to render the processed results list.
