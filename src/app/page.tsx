"use client";

import { useEffect, useState } from "react";

type Result = {
  id: string;
  to: string;
  subject: string;
  processedAt: string;
  status: string;
};

export default function Home() {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function fetchResults() {
    const res = await fetch("/api/results", { cache: "no-store" });
    if (res.ok) setResults(await res.json());
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error || "Failed to enqueue"
        );
      }
      setTo("");
      setSubject("");
      setBody("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
    } finally {
      setSending(false);
      setTimeout(fetchResults, 1200);
    }
  }

  useEffect(() => {
    fetchResults();
    const id = setInterval(fetchResults, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>RabbitMQ Email Notification Demo</h1>

      <form
        onSubmit={sendMessage}
        style={{ display: "grid", gap: "0.75rem", margin: "1rem 0" }}
      >
        <input
          placeholder="Recipient email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          required
        />
        <input
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
        />
        <textarea
          placeholder="Body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          required
        />
        <button type="submit" disabled={sending}>
          {sending ? "Sending..." : "Enqueue Email"}
        </button>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
      </form>

      <h2>Processed Results</h2>
      {results.length === 0 ? (
        <p>No processed emails yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {results
            .slice()
            .reverse()
            .map((r) => (
              <li
                key={r.id}
                style={{
                  border: "1px solid #ddd",
                  padding: "0.75rem",
                  borderRadius: 8,
                  marginBottom: 8,
                }}
              >
                <div>
                  <strong>To:</strong> {r.to}
                </div>
                <div>
                  <strong>Subject:</strong> {r.subject}
                </div>
                <div>
                  <strong>Status:</strong> {r.status}
                </div>
                <div style={{ color: "#666" }}>
                  <small>{new Date(r.processedAt).toLocaleString()}</small>
                </div>
              </li>
            ))}
        </ul>
      )}
    </main>
  );
}
