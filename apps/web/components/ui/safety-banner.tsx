export function SafetyBanner() {
  return (
    <footer
      className="border-t bg-paper-deep/60 px-4 py-2.5 text-center"
      style={{ borderColor: "var(--line)" }}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
        <span className="text-signal">Decision support only</span> · Final decisions remain with a
        qualified healthcare professional
      </p>
    </footer>
  );
}
