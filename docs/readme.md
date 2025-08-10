Below is an iterative, test-as-you-go learning project that integrates RabbitMQ into your existing Next.js app. Each step has short explanations, code samples, and a clear test checkpoint before moving on.

High-level architecture

Producer: Next.js API route publishes messages to RabbitMQ.
Broker: RabbitMQ with a direct exchange named notifications.
Queue: email_notifications bound with routing key email.
Consumer: A small Node.js script that listens, “processes” messages (simulated email), and appends results to a local JSON file.
UI: A simple form to trigger messages and a results list that reads processed results.
Step 0: Prereqs and goals

Have Docker installed and running.
Node 18+ recommended.
Goal: Learn exchanges, queues, bindings, routing keys, delivery acks, persistence, and a basic request→queue→worker flow.
Step 1: Start RabbitMQ locally with Docker

Start RabbitMQ with the management UI: docker run -it --rm -p 5672:5672 -p 15672:15672 --name rabbitmq rabbitmq:3-management
Broker: amqp on 5672
UI: http://localhost:15672 (user: guest, pass: guest)
Create an env file in your project root .env.local:
RABBITMQ_URL=amqp://guest:guest@localhost:5672 Test checkpoint:
Visit http://localhost:15672 and log in with guest/guest.
Step 2: Install dependencies and prepare shared RabbitMQ helper

Install amqplib: npm install amqplib
For TypeScript types (used in the helper): npm install -D @types/amqplib
Add a simple RabbitMQ helper to manage a single connection/channel.
Create file: src/lib/rabbit.ts Explanation: Lazily creates and caches a connection/channel so app routes can publish quickly.

Code: import amqplib, { Channel, Connection } from 'amqplib';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';

let connection: Connection | null = null; let channel: Channel | null = null;

export async function getChannel(): Promise<Channel> { if (channel) return channel;

connection = await amqplib.connect(RABBITMQ_URL); channel = await connection.createChannel();

// Optional: handle connection close connection.on('close', () => { channel = null; connection = null; });

return channel; }

Step 3: Create the producer (Next.js API) to publish messages

We’ll publish to exchange notifications (type: direct), routing key email, and ensure the queue exists/bound on first publish.
Message is marked persistent so it survives broker restarts if queue/exchange are durable.
Create file: src/app/api/notify/route.ts Explanation: Accepts POST with { to, subject, body }, publishes to RabbitMQ.

Code: import { NextResponse } from 'next/server'; import { getChannel } from '@/src/lib/rabbit'; import { randomUUID } from 'crypto';

const EXCHANGE = 'notifications'; const QUEUE = 'email_notifications'; const ROUTING_KEY = 'email';

export async function POST(request: Request) { try { const payload = await request.json(); const { to, subject, body } = payload || {};

} catch (err: any) { return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 }); } }

Concepts introduced here:

Exchange (direct): routes by exact routing key match. We use notifications with key email.
Queue: email_notifications holds messages until a consumer processes them.
Binding: binds queue to exchange with routing key email.
Message persistence: persistent: true requests disk persistence when combined with durable queues.
Test checkpoint:

Start Next dev: npm run dev
POST to /api/notify (e.g., via curl or HTTP client) with JSON { "to": "user@example.com", "subject": "Hi", "body": "Hello from RabbitMQ" }.
In RabbitMQ UI, you should see exchange and queue created, and the queue length increase by 1.
Step 4: Create a consumer (worker) that listens and processes messages

Run as a separate Node process, not inside Next.js, so it can be long-lived.
Simulate processing and append results to a JSON file for the UI to read.
Create file: scripts/consumer.cjs Explanation: Listens on the queue, simulates sending email, writes results to data/processed.json, and acknowledges messages.

Code: const amqplib = require('amqplib'); const fs = require('fs'); const path = require('path');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'; const EXCHANGE = 'notifications'; const QUEUE = 'email_notifications'; const ROUTING_KEY = 'email';

const dataDir = path.join(\_\_dirname, '..', 'data'); const dataFile = path.join(dataDir, 'processed.json');

function ensureDataFile() { if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true }); if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, '[]', 'utf8'); }

function appendResult(entry) { ensureDataFile(); const raw = fs.readFileSync(dataFile, 'utf8'); const arr = JSON.parse(raw); arr.push(entry); fs.writeFileSync(dataFile, JSON.stringify(arr, null, 2)); }

(async () => { const conn = await amqplib.connect(RABBITMQ_URL); const ch = await conn.createChannel();

await ch.assertExchange(EXCHANGE, 'direct', { durable: true }); await ch.assertQueue(QUEUE, { durable: true }); await ch.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);

// Control unacked messages inflight ch.prefetch(5);

console.log('Consumer started. Waiting for messages...'); ch.consume( QUEUE, async (msg) => { if (!msg) return;

);

process.on('SIGINT', async () => { console.log('\nShutting down consumer...'); await ch.close(); await conn.close(); process.exit(0); }); })();

Acknowledgments explained:

ack: confirms success; message is removed from the queue.
nack(requeue=true): return message to queue for a retry.
prefetch: limits concurrent unacked messages to avoid overwhelming the worker.
Add an npm script in package.json:

"consumer": "node scripts/consumer.cjs" Test checkpoint:
Start the consumer in a separate terminal: npm run consumer
Publish a message as in Step 3; you should see logs in the consumer and a new entry in data/processed.json.
Step 5: Add a read-only API to view processed results Create file: src/app/api/results/route.ts Explanation: Returns processed results so the UI can display them.

Code: import { NextResponse } from 'next/server'; import fs from 'fs'; import path from 'path';

export async function GET() { try { const filePath = path.join(process.cwd(), 'data', 'processed.json'); if (!fs.existsSync(filePath)) { return NextResponse.json([]); } const raw = fs.readFileSync(filePath, 'utf8'); const data = JSON.parse(raw); return NextResponse.json(data); } catch (e: any) { return NextResponse.json({ error: e?.message || 'Failed to read results' }, { status: 500 }); } }

Test checkpoint:

GET /api/results should return [] initially, then grow as messages are processed.
Step 6: Build a simple UI page to send messages and view results

Replace your page.tsx with a small client component to post messages and list results. Keep it minimal and clear.
Suggested page.tsx: 'use client';

import { useEffect, useState } from 'react';

type Result = { id: string; to: string; subject: string; processedAt: string; status: string; };

export default function Home() { const [to, setTo] = useState(''); const [subject, setSubject] = useState(''); const [body, setBody] = useState(''); const [sending, setSending] = useState(false); const [results, setResults] = useState<Result[]>([]); const [error, setError] = useState<string | null>(null);

async function fetchResults() { const res = await fetch('/api/results', { cache: 'no-store' }); if (res.ok) setResults(await res.json()); }

async function sendMessage(e: React.FormEvent) { e.preventDefault(); setSending(true); setError(null); try { const res = await fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to, subject, body }), }); if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Failed to enqueue'); } setTo(''); setSubject(''); setBody(''); } catch (e: any) { setError(e?.message || 'Unknown error'); } finally { setSending(false); // Give the consumer a moment, then refresh results setTimeout(fetchResults, 1200); } }

useEffect(() => { fetchResults(); const id = setInterval(fetchResults, 5000); return () => clearInterval(id); }, []);

return ( <main style={{ maxWidth: 720, margin: '2rem auto', padding: '0 1rem' }}> <h1>RabbitMQ Email Notification Demo</h1>

); }

Test checkpoint:

Run Next (npm run dev) and the consumer (npm run consumer).
Open the app at http://localhost:3000, send a message, then see it appear in “Processed Results”.
Step 7: Learn the core RabbitMQ concepts in this project

Exchanges: We used a direct exchange notifications. Producers publish to exchanges. Exchanges route to queues.
Queues: email_notifications stores messages for consumers. Durable queues survive broker restarts.
Bindings: Tie a queue to an exchange with a routing key. Our queue is bound with key email.
Routing keys: With direct exchange, the key must match exactly to route. Try adding a second queue with ROUTING_KEY = 'sms' to see separation.
Acknowledgments: Consumers must ack to remove a message. If processing fails, nack with requeue to retry.
Prefetch: Controls how many unacked messages a consumer can have at once (back-pressure).
Optional enhancements (real-world touches)

Use Nodemailer in the consumer to actually send emails (and put SMTP creds in env).
Add retry with dead-letter exchange (DLX) by creating a separate retry queue and TTL.
Add a topic exchange to route by patterns, e.g., notifications.email.critical vs notifications.email.low.
Store processed results in SQLite or Postgres instead of a JSON file for multi-process safety.
Use a confirm channel to ensure publishes are confirmed by the broker when needed.
How to iterate safely

After each step, test with one message and inspect:
RabbitMQ UI (Exchanges/Queues) for message flow and queue depth.
Consumer logs for processing and ack behavior.
UI results for end-to-end confirmation.
