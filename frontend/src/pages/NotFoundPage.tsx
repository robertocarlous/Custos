import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="container section" style={{ textAlign: "center" }}>
      <h1 style={{ fontSize: "2.2rem", marginBottom: 12 }}>404</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        That page doesn't exist.
      </p>
      <Link to="/" className="button button--primary">
        Back home
      </Link>
    </div>
  );
}
