import type { ReactNode } from "react";
import { CodeBlock } from "./CodeBlock";

interface Param {
  name: string;
  type: string;
  description: string;
}

interface ApiMethodProps {
  id: string;
  signature: string;
  async?: boolean;
  description: ReactNode;
  params?: Param[];
  returns: string;
  example: string;
}

export function ApiMethod({ id, signature, async = true, description, params, returns, example }: ApiMethodProps) {
  return (
    <div className="api-method" id={id}>
      <div className="api-method__sig">
        {async && "async "}
        {signature}
      </div>
      <p>{description}</p>

      {params && params.length > 0 && (
        <table className="api-table">
          <thead>
            <tr>
              <th>Param</th>
              <th>Type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {params.map((p) => (
              <tr key={p.name}>
                <td>
                  <code className="mono">{p.name}</code>
                </td>
                <td>
                  <code className="mono">{p.type}</code>
                </td>
                <td>{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="docs-returns">
        <strong>Returns</strong> <code className="mono">{returns}</code>
      </p>

      <CodeBlock code={example} />
    </div>
  );
}
