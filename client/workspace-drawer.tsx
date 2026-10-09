import { type PluginWorkspacePanelProps, usePaseo } from "@getpaseo/plugin/client";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Chat } from "./chat";
import { useDirectory } from "./directory";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { useQuery } from "@tanstack/react-query";
import { type Agent, errorText } from "./directory";
import type { PaseoTerminal } from "@getpaseo/client";
import { TerminalMonitor } from "./terminal";
import { WorkspacePicker } from "./workspace-picker";
import { WorkingIndicator } from "./working-indicator";

type MonitorTab = { key: string; kind: "agent"; agent: Agent } | { key: string; kind: "terminal"; terminal: PaseoTerminal };
const selections = new Map<string, { workspaceId: string; tabKey: string | null }>();

export function WorkspaceDrawer(props: PluginWorkspacePanelProps) {
  const { theme, layout, host, workspaceId } = props;
  const paseo = usePaseo();
  const directory = useDirectory();
  const selectionKey = `${host.id}/${workspaceId}`;
  const [selection, setSelection] = useState(() => selections.get(selectionKey) ?? null);
  const [choosing, setChoosing] = useState(!selection);
  const [query, setQuery] = useState("");
  const colors = theme.colors;
  const body = { color: colors.foreground, fontSize: 13, lineHeight: 19 };
  const muted = { color: colors.foregroundMuted, fontSize: 11 };
  const button = { padding: 10, borderRadius: 8, backgroundColor: colors.surface1 };
  const selectedWorkspace = directory.workspaces.find((workspace) => workspace.id === selection?.workspaceId);
  const agentsById = new Map(directory.agents.map((agent) => [agent.id, agent]));
  const agents = directory.agents.filter((agent) => {
    if (agent.workspaceId !== selection?.workspaceId) return false;
    const parentId = agent.labels["paseo.parent-agent-id"]?.trim();
    return !parentId || agentsById.get(parentId)?.workspaceId !== agent.workspaceId;
  })
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const terminals = useQuery({
    queryKey: ["workspace-drawer", "terminals", selection?.workspaceId],
    enabled: !!selection?.workspaceId && !choosing,
    queryFn: () => paseo.terminals.list({ workspaceId: selection!.workspaceId }),
    refetchInterval: 2000,
    retry: false,
  });
  const tabs: MonitorTab[] = [
    ...agents.map((agent): MonitorTab => ({ key: `agent:${agent.id}`, kind: "agent", agent })),
    ...(terminals.data?.entries ?? []).map((terminal): MonitorTab => ({ key: `terminal:${terminal.id}`, kind: "terminal", terminal })),
  ];
  const selectedTab = tabs.find((tab) => tab.key === selection?.tabKey) ?? tabs[0];

  return (
    <View style={{ flex: 1, minHeight: 0, backgroundColor: colors.surface0, padding: layout.compact ? 10 : 12, gap: 10 }}>
      {directory.error && <View style={{ gap: 6 }}>
        <Text style={{ ...body, color: colors.statusDanger }}>{directory.error}</Text>
        <Pressable accessibilityRole="button" style={button} onPress={directory.retry}><Text style={body}>Retry workspaces</Text></Pressable>
      </View>}
      {choosing ? <>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Text style={{ ...body, flex: 1, fontWeight: "600" }}>Choose a workspace</Text>
          {selectedWorkspace && <Pressable accessibilityRole="button" style={button} onPress={() => setChoosing(false)}><Text style={muted}>Cancel</Text></Pressable>}
        </View>
        <Text style={{ ...muted, lineHeight: 17 }}>Follow another workspace here without leaving your current conversation.</Text>
        <TextInput accessibilityLabel="Search workspaces" value={query} onChangeText={setQuery} placeholder="Search workspaces…"
          placeholderTextColor={colors.foregroundMuted} style={{ ...body, ...button }} />
        <View style={{ flex: 1, minHeight: 0, marginHorizontal: layout.compact ? -10 : -12 }}>
        {directory.loading ? <Text style={muted}>Loading workspaces…</Text> : <WorkspacePicker
          workspaces={directory.workspaces}
          theme={theme}
          hostId={host.id}
          selectedId={selection?.workspaceId}
          currentId={workspaceId}
          query={query}
          onSelect={(id) => {
            const next = { workspaceId: id, tabKey: null };
            selections.set(selectionKey, next);
            setSelection(next);
            setChoosing(false);
            setQuery("");
          }}
        />}
        </View>
      </> : <>
        <Pressable accessibilityRole="button" accessibilityLabel="Change drawer workspace" style={{ ...button, flexDirection: "row", gap: 10, alignItems: "center", borderWidth: 1, borderColor: colors.border }} onPress={() => setChoosing(true)}>
          <Icon name="PanelsTopLeft" size={16} color={colors.foregroundMuted} />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text numberOfLines={2} style={{ ...body, fontWeight: "600" }}>{selectedWorkspace?.name ?? (directory.loading ? "Loading workspace…" : "Workspace unavailable")}</Text>
            <Text style={muted}>{selectedWorkspace?.projectDisplayName ?? host.label} · Switch workspace</Text>
          </View>
          <Icon name="ChevronsUpDown" size={14} color={colors.foregroundMuted} />
        </Pressable>
        {!directory.loading && !selectedWorkspace ? <Text style={muted}>This workspace is no longer available. Choose another workspace above.</Text> :
          <>
            {terminals.isError && <View style={{ gap: 6 }}>
              <Text style={{ ...muted, color: colors.statusDanger }}>Couldn't load terminals: {errorText(terminals.error)}</Text>
              <Pressable accessibilityRole="button" style={button} onPress={() => void terminals.refetch()}><Text style={muted}>Retry terminals</Text></Pressable>
            </View>}
            {tabs.length === 0 ? <Text style={muted}>{directory.loading || terminals.isPending ? "Loading agents and terminals…" : "No top-level agents or terminals in this workspace."}</Text> : <>
              <ScrollView horizontal style={{ flexGrow: 0, maxHeight: 60 }} contentContainerStyle={{ gap: 6 }}>
                {tabs.map((tab) => <Pressable key={tab.key} accessibilityRole="button" accessibilityLabel={`Monitor ${tab.kind} ${tab.kind === "agent" ? tab.agent.title ?? "Untitled agent" : tab.terminal.name}`}
                  accessibilityState={{ selected: tab.key === selectedTab?.key }}
                  style={{ ...button, paddingVertical: 7, maxWidth: 230, borderWidth: 1, borderColor: tab.key === selectedTab?.key ? colors.accent : colors.border, flexDirection: "row", alignItems: "center", gap: 6 }}
                  onPress={() => {
                    const next = { workspaceId: selection!.workspaceId, tabKey: tab.key };
                    selections.set(selectionKey, next);
                    setSelection(next);
                  }}>
                  {tab.kind === "agent" && tab.agent.status === "running" ? <WorkingIndicator color={colors.foregroundMuted} /> : <Icon name={tab.kind === "terminal" ? "Terminal" : "Bot"} size={12} color={tab.key === selectedTab?.key ? colors.accent : colors.foregroundMuted} />}
                  <Text numberOfLines={1} style={{ ...body, flexShrink: 1, fontSize: 12 }}>{tab.kind === "agent" ? tab.agent.title ?? "Untitled agent" : tab.terminal.name}</Text>
                </Pressable>)}
              </ScrollView>
              {selectedTab?.kind === "agent" ? <Chat key={selectedTab.key} {...props} agent={selectedTab.agent} /> :
                selectedTab?.kind === "terminal" ? <TerminalMonitor key={selectedTab.key} {...props} terminal={selectedTab.terminal} /> : null}
            </>}
          </>}
      </>}
    </View>
  );
}
