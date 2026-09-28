// APP-7 — the sections this company's plan shows in the sidebar, for pages
// that need to offer them as choices (the phone tabs in "Personalizza la home").
import { createContext, useContext } from "react";

export type DashboardNavEntry = { href: string; label: string };

export const DashboardNavContext = createContext<DashboardNavEntry[]>([]);

export function useDashboardNav(): DashboardNavEntry[] {
  return useContext(DashboardNavContext);
}
