import "../globals.css";
import "../style.css";
import { CircleDot, Phone, Users, MessageCircle, Locate, Settings } from "lucide-react";

export default function Bottombar() {
  const items = [
    [MessageCircle, "Chats"],
    [Locate, "Grid"],
    [Settings, "Settings"],
  ] as const;

  return (
    <div className="bottombar">
      {items.map(([Icon, label]) => (
        <button className={label === "Chats" ? "active" : ""} key={label}>
          <Icon size={25} />
          {label === "Chats" && <span>1</span>}
          <p>{label}</p>
        </button>
      ))}
    </div>
  );
}
