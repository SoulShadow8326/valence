import "../globals.css";
import "../style.css";

type ChatDivProps = {
  name: string;
  latest_message?: string;
  timestamp?: string;
  onClick?: () => void;
};

export default function ChatDiv({ name, latest_message, timestamp, onClick }: ChatDivProps) {
  return (
    <div
      className="chatlistdiv"
      onClick={onClick}
      onKeyDown={(event) => {
        if (onClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick();
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
        <div className="top">
            <h1>{name}</h1>
            {timestamp && <span className="timestamp">{timestamp}</span>}
        </div>
        {latest_message && <p className="latest">{latest_message}</p>}
        <hr />
    </div>
    
  );
}
