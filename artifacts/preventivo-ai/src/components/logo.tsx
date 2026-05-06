import React from "react";

export function Logo({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <img
      src="/prevai-logo.png"
      alt="prevai"
      className={className}
      style={{ height: 36, width: "auto", objectFit: "contain", ...style }}
    />
  );
}
