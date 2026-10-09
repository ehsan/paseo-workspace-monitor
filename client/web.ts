import { Platform } from "react-native";
import { z } from "zod";

const sidebarOrderSchema = z.object({
  state: z.object({
    projectOrder: z.array(z.string()).default([]),
    pinnedWorkspaceOrder: z.array(z.string()).default([]),
    workspaceOrderByProject: z.record(z.string(), z.array(z.string())).default({}),
  }),
});
export type SidebarOrder = z.infer<typeof sidebarOrderSchema>["state"];

interface SidebarElement {
  getAttribute(name: string): string | null;
  textContent: string | null;
  querySelectorAll(selector: string): Iterable<SidebarElement>;
}
declare const document: { querySelectorAll(selector: string): Iterable<SidebarElement> };
declare const window: {
  localStorage: { getItem(key: string): string | null };
  getComputedStyle(element: SidebarElement): { color: string; backgroundColor: string; borderTopColor: string; borderTopWidth: string };
};

export interface SidebarAppearance {
  running: string | null;
  labels: Record<string, { color: string; backgroundColor: string }>;
  projects: Record<string, { initial: string; color: string; backgroundColor: string }>;
  background: string | null;
}

// Borrow the native sidebar's rendered theme colors where the plugin palette omits them.
export function readSidebarAppearance(): SidebarAppearance {
  const appearance: SidebarAppearance = { running: null, labels: {}, projects: {}, background: null };
  if (Platform.OS !== "web") return appearance;
  const sidebar = [...document.querySelectorAll('[data-testid="sidebar"]')][0];
  if (sidebar) appearance.background = window.getComputedStyle(sidebar).backgroundColor;
  for (const element of document.querySelectorAll('[data-testid="workspace-status-indicator-running"] *')) {
    const style = window.getComputedStyle(element);
    if (parseFloat(style.borderTopWidth) > 0 && style.borderTopColor !== "transparent" && style.borderTopColor !== "rgba(0, 0, 0, 0)") {
      appearance.running = style.borderTopColor;
      break;
    }
  }
  for (const element of document.querySelectorAll('[data-testid^="workspace-label-chip-"]')) {
    const name = element.getAttribute("data-testid")?.slice("workspace-label-chip-".length);
    if (!name) continue;
    const text = [...element.querySelectorAll("*")].at(-1) ?? element;
    appearance.labels[name] = { color: window.getComputedStyle(text).color, backgroundColor: window.getComputedStyle(element).backgroundColor };
  }
  for (const element of document.querySelectorAll('[data-testid^="sidebar-row-project-icon-"]')) {
    const key = element.getAttribute("data-testid")?.slice("sidebar-row-project-icon-".length);
    if (!key) continue;
    for (const box of element.querySelectorAll("*")) {
      const style = window.getComputedStyle(box);
      if (style.backgroundColor === "transparent" || style.backgroundColor === "rgba(0, 0, 0, 0)") continue;
      const text = [...box.querySelectorAll("*")].find((child) => child.textContent?.trim().length === 1);
      if (!text) continue;
      appearance.projects[key] = { initial: text.textContent!.trim(), color: window.getComputedStyle(text).color, backgroundColor: style.backgroundColor };
      break;
    }
  }
  return appearance;
}

// Read only. Paseo owns this storage; never modify the native sidebar's preferences.
export function readSidebarOrder(): SidebarOrder | null {
  if (Platform.OS !== "web") return null;
  try {
    const text = window.localStorage.getItem("sidebar-project-workspace-order");
    if (!text) return null;
    const result = sidebarOrderSchema.safeParse(JSON.parse(text));
    return result.success ? result.data.state : null;
  } catch {
    return null;
  }
}
