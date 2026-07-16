export type Envelope = {
  v: 1;
  id: string;
  text: string;
  replyTo?: string;
};

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export function encode(id: string, text: string, replyTo?: string): string {
  const envelope: Envelope = replyTo ? { v: 1, id, text, replyTo } : { v: 1, id, text };
  return JSON.stringify(envelope);
}

export function decode(body: string): { id: string; text: string; replyTo?: string } {
  try {
    const parsed = JSON.parse(body) as Partial<Envelope>;
    if (parsed && parsed.v === 1 && typeof parsed.text === "string" && parsed.id) {
      return { id: parsed.id, text: parsed.text, replyTo: parsed.replyTo };
    }
  } catch {}
  return { id: newId(), text: body };
}
