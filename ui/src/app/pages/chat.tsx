"use client";

import "../globals.css";
import "../style.css";

import { ArrowLeft, Send } from "lucide-react";
import { FormEvent, useMemo, useRef, useState } from "react";
import type { ChatPreview } from "../components/listview";

type Message = {
  id: number;
  text: string;
  sentByMe: boolean;
  time: string;
};

type ChatPageProps = {
  chat: ChatPreview | null;
  isOpen: boolean;
  onBack: () => void;
};

const starterMessages: Record<string, Message[]> = {
  rick: [
    { id: 1, text: "You up?", sentByMe: false, time: "16:40" },
    { id: 2, text: "depends what universe this is", sentByMe: true, time: "16:42" },
    { id: 3, text: "Netflix and chill?", sentByMe: false, time: "16:44" },
  ],
  morty: [
    { id: 1, text: "Are we still meeting later?", sentByMe: false, time: "12:10" },
    { id: 2, text: "yeah, give me 10", sentByMe: true, time: "12:12" },
  ],
  summer: [
    { id: 1, text: "Send the playlist", sentByMe: false, time: "09:18" },
    { id: 2, text: "done", sentByMe: true, time: "09:20" },
  ],
};

export default function ChatPage({ chat, isOpen, onBack }: ChatPageProps) {
  const [draft, setDraft] = useState("");
  const [messagesByChat, setMessagesByChat] = useState<Record<string, Message[]>>({});
  const nextId = useRef(10);

  const messages = useMemo(() => {
    if (!chat) return [];
    return messagesByChat[chat.id] ?? starterMessages[chat.id] ?? [];
  }, [chat, messagesByChat]);

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chat || !draft.trim()) return;

    const now = new Date();
    const message: Message = {
      id: nextId.current,
      text: draft.trim(),
      sentByMe: true,
      time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    nextId.current += 1;
    setMessagesByChat((current) => ({
      ...current,
      [chat.id]: [...(current[chat.id] ?? starterMessages[chat.id] ?? []), message],
    }));
    setDraft("");
  }

  return (
    <section className={`chatpage ${isOpen ? "open" : ""}`} aria-hidden={!isOpen}>
      {chat && (
        <>
          <header className="chatheader">
            <button className="iconbutton" type="button" onClick={onBack} aria-label="Back to chats">
              <ArrowLeft size={22} />
            </button>
            <div>
              <h1>{chat.name}</h1>
              <p>online</p>
            </div>
          </header>

          <main className="messages">
            {messages.map((message) => (
              <div className={`message ${message.sentByMe ? "mine" : "theirs"}`} key={message.id}>
                <p>{message.text}</p>
                <span>{message.time}</span>
              </div>
            ))}
          </main>

          <form className="composer" onSubmit={sendMessage}>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Message"
              aria-label={`Message ${chat.name}`}
            />
            <button className="sendbutton" type="submit" aria-label="Send message" disabled={!draft.trim()}>
              <Send size={20} />
            </button>
          </form>
        </>
      )}
    </section>
  );
}
