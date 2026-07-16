import { NextResponse } from "next/server";

const MODEL = "gemini-2.5-flash";

const SYSTEM = `You turn a line of human conversation into one structured coordination item for a decentralized crisis-response network.

Pick exactly one kind:
- NEED: someone needs a resource. Fill resource and quantity.
- CAPACITY: someone has or offers a resource. Fill resource and quantity.
- ROUTE: a way to get between two places. Fill from and to.
- OBSERVATION: a fact or status worth sharing. Fill subject and state.

Always write a short human title (max 6 words) and 2-4 lowercase single-word tags.
Tags are how a need and an offer find each other, so make the resource and place tags identical to what others would use (e.g. "water", "sector7"). No spaces in tags.
If quantity is unknown, leave it empty. Never invent facts that are not in the message.`;

const SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["NEED", "CAPACITY", "ROUTE", "OBSERVATION"] },
    title: { type: "string" },
    resource: { type: "string" },
    quantity: { type: "string" },
    from: { type: "string" },
    to: { type: "string" },
    subject: { type: "string" },
    state: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
  },
  required: ["kind", "title", "tags"],
};

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "extraction unavailable" }, { status: 503 });

  let text = "";
  try {
    ({ text } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
          temperature: 0.2,
        },
      }),
    },
  );

  if (!res.ok) return NextResponse.json({ error: `gemini ${res.status}` }, { status: 502 });

  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  try {
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "could not read reply" }, { status: 502 });
  }
}
