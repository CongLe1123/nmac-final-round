// Simple in-memory event bus for Server-Sent Events (SSE)
// Usage: broadcast({ type: '...', payload: {...} }) and subscribe(cb)

const subscribers = new Set();

export function subscribe(send) {
  subscribers.add(send);
  return () => subscribers.delete(send);
}

export function broadcast(event) {
  for (const send of [...subscribers]) {
    try {
      send(event);
    } catch {
      subscribers.delete(send);
    }
  }
}

export function makeEvent(type, payload = {}) {
  return { type, payload, ts: Date.now() };
}
