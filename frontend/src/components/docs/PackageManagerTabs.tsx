import { useState } from "react";
import { CodeBlock } from "./CodeBlock";

const MANAGERS = [
  { id: "npm", label: "npm", cmd: (pkg: string) => `npm install ${pkg}` },
  { id: "pnpm", label: "pnpm", cmd: (pkg: string) => `pnpm add ${pkg}` },
  { id: "yarn", label: "yarn", cmd: (pkg: string) => `yarn add ${pkg}` },
  { id: "bun", label: "bun", cmd: (pkg: string) => `bun add ${pkg}` },
] as const;

export function PackageManagerTabs({ pkg }: { pkg: string }) {
  const [active, setActive] = useState<(typeof MANAGERS)[number]["id"]>("npm");
  const current = MANAGERS.find((m) => m.id === active)!;

  return (
    <div className="pm-tabs-wrap">
      <div className="pm-tabs" role="tablist">
        {MANAGERS.map((m) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={m.id === active}
            className={m.id === active ? "active" : ""}
            onClick={() => setActive(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <CodeBlock code={current.cmd(pkg)} />
    </div>
  );
}
