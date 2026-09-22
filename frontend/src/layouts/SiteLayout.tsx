import { Outlet } from "react-router-dom";
import { SiteNav } from "../components/SiteNav";
import { SiteFooter } from "../components/SiteFooter";

export function SiteLayout() {
  return (
    <div className="site">
      <SiteNav />
      <Outlet />
      <SiteFooter />
    </div>
  );
}
