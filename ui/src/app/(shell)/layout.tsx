import { StoreProvider } from "../lib/store";
import { ToastProvider } from "../components/toast";
import { Reveal } from "../components/reveal";
import { Nav } from "../components/nav";
import { Publish } from "../components/publish";
import { ObjectDetail } from "../components/object-detail";
import { AnswerWatcher } from "../components/answer-watcher";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <ToastProvider>
        <div
          className="h-full overflow-y-auto bg-bg pb-[calc(150px+env(safe-area-inset-bottom))]"
          data-scroll-hide
        >
          <Reveal>{children}</Reveal>
        </div>
        <Publish />
        <Nav />
        <ObjectDetail />
        <AnswerWatcher />
      </ToastProvider>
    </StoreProvider>
  );
}
