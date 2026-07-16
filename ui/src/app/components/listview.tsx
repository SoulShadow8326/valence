import "../globals.css";
import "../style.css";
import ChatDiv from "./chatlistdiv";

export type ChatPreview = {
  id: string;
  name: string;
  latest_message: string;
  timestamp: string;
};

type ListviewProps = {
  chats: ChatPreview[];
  onSelectChat: (chat: ChatPreview) => void;
};

export default function Listview({ chats, onSelectChat }: ListviewProps) {
  return (
    <div className="chatlist">
      {chats.map((chat) => (
        <ChatDiv
          key={chat.id}
          name={chat.name}
          latest_message={chat.latest_message}
          timestamp={chat.timestamp}
          onClick={() => onSelectChat(chat)}
        />
      ))}
    </div>
  );
}
