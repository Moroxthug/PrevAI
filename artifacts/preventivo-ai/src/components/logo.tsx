import React from "react";

export function Logo({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <img
      src="/prevai-logo.png"
      alt="PrevAI"
      width={144}
      height={72}
      className={className}
      style={{ height: 72, width: "auto", objectFit: "contain", ...style }}
    />
  );
}
