import "../globals.css";
import "../style.css";

type ChatDivProps = {
  name: string;
  latest_message?: string;
  timestamp?: string;
};

export default function ChatDiv({ name, latest_message, timestamp }: ChatDivProps) {
  return (
    <div className="chatlistdiv">
        <div className="top">
            <h1>{name}</h1>
            {timestamp && <span className="timestamp">{timestamp}</span>}
        </div>
        {latest_message && <p className="latest">{latest_message}</p>}
        <hr style={{ border: 0, borderTop: '1px solid #8a8a8a', margin: '10px 0 0 0' }} />
    </div>
    
  );
}
