/** SVG flags — emoji flags don't render on Windows. */
export function Flag({ code, className = "h-[0.9em] w-[1.35em]" }: { code: string; className?: string }) {
  const common = { viewBox: "0 0 30 20", className: `inline-block shrink-0 rounded-[3px] align-[-0.1em] shadow-sm ${className}`, "aria-hidden": true } as const;
  if (code === "ja")
    return (
      <svg {...common}>
        <rect width="30" height="20" fill="#fff" />
        <circle cx="15" cy="10" r="6" fill="#bc002d" />
      </svg>
    );
  if (code === "fr")
    return (
      <svg {...common}>
        <rect width="10" height="20" fill="#0055a4" />
        <rect x="10" width="10" height="20" fill="#fff" />
        <rect x="20" width="10" height="20" fill="#ef4135" />
      </svg>
    );
  if (code === "es")
    return (
      <svg {...common}>
        <rect width="30" height="20" fill="#aa151b" />
        <rect y="5" width="30" height="10" fill="#f1bf00" />
      </svg>
    );
  return null;
}
