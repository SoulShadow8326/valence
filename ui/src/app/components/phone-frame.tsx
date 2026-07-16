export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#dcdce2] sm:p-8">
      <div
        id="phone-viewport"
        className="relative h-full w-full overflow-hidden bg-bg sm:h-[min(874px,100%)] sm:w-[402px] sm:rounded-[48px] sm:shadow-[0_30px_80px_rgba(0,0,0,0.35)] sm:ring-[10px] sm:ring-[#0d090e]"
      >
        {children}
      </div>
    </div>
  );
}
