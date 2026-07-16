import Image from "next/image";
import "./style.css";
import Topbar from "./components/topbar";
import Listview from "./components/listview";
export default function Home() {
  return (
    <div>
    <Topbar></Topbar>
    <Listview></Listview>
    </div>
  );
}
