"use client";

import "./style.css";
import Topbar from "./components/topbar";
import Listview, { ChatPreview } from "./components/listview";
import ChatPage from "./pages/chat";
import Bottombar from "./components/bottomnav";
import { useState } from "react";

const chats: ChatPreview[] = [
  { id: "rick", name: "Rick", latest_message: "Netflix and chill?", timestamp: "16:44" },
  { id: "morty", name: "Morty", latest_message: "Are we still meeting later?", timestamp: "12:10" },
  { id: "summer", name: "Summer", latest_message: "Send the playlist", timestamp: "09:18" },
];

export default function Home() {
  const [selectedChat, setSelectedChat] = useState<ChatPreview | null>(null);

  return (
    <div className="appshell">
      <div className={`listpane ${selectedChat ? "dimmed" : ""}`}>
        <Topbar />
        <Listview chats={chats} onSelectChat={setSelectedChat} />
        <Bottombar />
      </div>
      <ChatPage chat={selectedChat} isOpen={Boolean(selectedChat)} onBack={() => setSelectedChat(null)} />
    </div>
  );
}
