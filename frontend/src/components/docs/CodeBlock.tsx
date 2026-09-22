import { useState } from "react";

export function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable (e.g. insecure context) -- fail silently, code is still selectable
    }
  };

  return (
    <div className="code-block-wrap">
      {label && <div className="code-block-label">{label}</div>}
      <pre className="code-block">{code}</pre>
      <button className={`copy-btn${copied ? " copied" : ""}`} onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
