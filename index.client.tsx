import type { PluginClientContext } from "@getpaseo/plugin/client";
import { WorkspaceDrawer } from "./client/workspace-drawer";

export default function contribute(client: PluginClientContext) {
  const removePanel = client.addWorkspacePanel({
    id: "chat",
    title: "Workspace Monitor",
    icon: "PanelsLeftBottom",
    context: "workspace",
    locations: ["explorer"],
    Component: WorkspaceDrawer,
  });
  const removeCommand = client.addCommandCenterItem({
    id: "open-chat",
    title: "Open Workspace Monitor in right drawer",
    icon: "PanelsLeftBottom",
    keywords: ["workspace", "monitor", "chat", "drawer", "changes"],
    context: "workspace",
    onSelect({ openPanel }) {
      openPanel("chat", { location: "explorer" });
    },
  });
  return () => {
    removeCommand();
    removePanel();
  };
}
