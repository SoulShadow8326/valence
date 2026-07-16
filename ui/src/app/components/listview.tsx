import "../globals.css";
import "../style.css";
import ChatDiv from "./chatlistdiv";

export default function Listview() {
  return (
    <div className="chatlist">
        <ChatDiv name="Rick" latest_message="Netflix and chill?" timestamp="16:44"></ChatDiv>
        <ChatDiv name="Rick" latest_message="Netflix and chill?" timestamp="16:44"></ChatDiv>
        
    </div>
  );
}
