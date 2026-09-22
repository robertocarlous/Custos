import { DOCS_NAV, DOCS_SECTION_IDS } from "../../pages/docs/docsNav";
import { useActiveSection } from "../../hooks/useActiveSection";

export function DocsSidebar() {
  const activeId = useActiveSection(DOCS_SECTION_IDS);

  return (
    <nav className="docs-sidebar" aria-label="Documentation sections">
      {DOCS_NAV.map((group) => (
        <div className="docs-sidebar__group" key={group.title}>
          <div className="docs-sidebar__group-title">{group.title}</div>
          {group.items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`docs-sidebar__link${activeId === item.id ? " active" : ""}`}
            >
              {item.label}
            </a>
          ))}
        </div>
      ))}
    </nav>
  );
}
