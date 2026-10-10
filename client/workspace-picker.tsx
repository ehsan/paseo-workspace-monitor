import type { PluginTheme } from "@getpaseo/plugin";
import { usePaseo } from "@getpaseo/plugin/client";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { Workspace } from "./directory";
import { readSidebarAppearance, readSidebarOrder, type SidebarAppearance, type SidebarOrder } from "./web";
import { WorkingIndicator } from "./working-indicator";

// Match Paseo's applyStoredOrdering: unknown keys retain their default slots.
function applyOrder<T>(items: T[], order: string[], key: (item: T) => string) {
  const byKey = new Map(items.map((item) => [key(item), item]));
  const seen = new Set<string>();
  const visibleOrder = order.filter((value) => {
    if (!byKey.has(value) || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
  let index = 0;
  return items.map((item) => seen.has(key(item)) ? byKey.get(visibleOrder[index++])! : item);
}

type PickerProps = {
  workspaces: Workspace[];
  theme: PluginTheme;
  hostId: string;
  selectedId?: string;
  currentId: string;
  query: string;
  onSelect(workspaceId: string): void;
};


function CheckProgress({ quarters, color }: { quarters: number; color: string }) {
  return <View accessibilityLabel={`CI progress ${quarters * 25}%`} style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: color, alignItems: "center", justifyContent: "center" }}>
    <View style={{ width: 7, height: 7, borderRadius: 3.5, overflow: "hidden" }}>
      {quarters > 0 && <View style={{ position: "absolute", top: 0, right: 0, width: 3.5, height: 3.5, backgroundColor: color }} />}
      {quarters > 1 && <View style={{ position: "absolute", bottom: 0, right: 0, width: 3.5, height: 3.5, backgroundColor: color }} />}
      {quarters > 2 && <View style={{ position: "absolute", bottom: 0, left: 0, width: 3.5, height: 3.5, backgroundColor: color }} />}
      {quarters > 3 && <View style={{ position: "absolute", top: 0, left: 0, width: 3.5, height: 3.5, backgroundColor: color }} />}
    </View>
  </View>;
}

function WorkspaceRow({ workspace, theme, appearance, selected, current, pinned, onSelect }: {
  workspace: Workspace; theme: PluginTheme; appearance: SidebarAppearance; selected: boolean; current: boolean; pinned?: boolean; onSelect(workspaceId: string): void;
}) {
  const [hovered, setHovered] = useState(false);
  const colors = theme.colors;
  const projectIcon = Object.entries(appearance.projects).find(([key]) => key.endsWith(`:${workspace.id}`))?.[1];
  const pr = workspace.githubRuntime?.pullRequest;
  const prNumber = pr?.url.match(/\/(?:pull|pulls|merge_requests)\/(\d+)/)?.[1];
  const prState = pr?.isMerged || pr?.state === "merged" ? "Merged" : pr?.state === "open" ? "" : "Closed";
  const individualChecks = pr?.checks;
  const completed = individualChecks?.filter((check) => check.status !== "pending").length ?? 0;
  const checks = individualChecks?.length
    ? individualChecks.some((check) => check.status === "failure") ? "failed" : completed === individualChecks.length ? "passed" : "running"
    : pr?.checksStatus === "success" ? "passed" : pr?.checksStatus === "failure" ? "failed" : pr?.checksStatus === "pending" ? "running" : null;
  const quarters = individualChecks?.length ? Math.floor(completed / individualChecks.length * 4) : 0;
  const checkColor = checks === "passed" ? colors.statusSuccess : checks === "failed" ? colors.statusDanger : colors.statusWarning;
  return <Pressable accessibilityRole="button" accessibilityLabel={current ? `Current workspace ${workspace.name}` : `Load workspace ${workspace.name} into monitor`} accessibilityState={{ selected: selected || current, disabled: current }} disabled={current}
    onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)} onPress={() => { if (!current) onSelect(workspace.id); }}
    style={({ pressed }) => ({ minHeight: 36, marginBottom: 2, paddingVertical: 8, paddingLeft: 8, paddingRight: 12, borderRadius: 8, backgroundColor: selected || current || pressed ? colors.surface2 : hovered ? colors.surface1 : appearance.background ?? colors.surface0, flexDirection: "row", alignItems: "flex-start", gap: 8 })}>
    <View style={{ width: 16, height: 20, alignItems: "center", justifyContent: "center", position: "relative", alignSelf: "flex-start" }}>
      {pinned && <View style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: projectIcon?.backgroundColor ?? colors.surface2, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: projectIcon?.color ?? colors.foreground, fontSize: 9 }}>{projectIcon?.initial ?? workspace.projectDisplayName.charAt(0).toUpperCase()}</Text>
      </View>}
      {(!pinned || workspace.status !== "done") && <View style={pinned ? { position: "absolute", right: -5, bottom: -4, backgroundColor: appearance.background ?? colors.surface0, borderRadius: 8 } : undefined}>
      {workspace.status === "running" ? <WorkingIndicator color={appearance.running ?? colors.foregroundMuted} /> :
        workspace.status === "needs_input" ? <Icon name="CircleAlert" size={13} color={colors.statusWarning} /> :
        workspace.status === "failed" ? <Icon name="CircleAlert" size={13} color={colors.statusDanger} /> :
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: workspace.status === "attention" ? colors.statusSuccess : colors.foregroundMuted, opacity: workspace.status === "done" ? 0.3 : 1 }} />}
      </View>}
    </View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} style={{ color: colors.foreground, fontSize: 14, lineHeight: 20, fontWeight: "400", opacity: hovered ? 1 : 0.76 }}>{workspace.name}</Text>
      {(pr && prNumber || !!workspace.labels?.length) && <View style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 16, minWidth: 0 }}>
        {pr && prNumber && <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Icon name={prState === "Merged" ? "GitMerge" : prState === "Closed" ? "GitPullRequestClosed" : "GitPullRequest"} size={12} color={prState === "Closed" ? colors.statusDanger : colors.foregroundMuted} />
            <Text style={{ color: colors.foregroundMuted, fontSize: 12, lineHeight: 16 }}>{prNumber}{prState ? ` ${prState}` : ""}</Text>
          </View>
          {checks && <>
            <Text style={{ color: colors.foregroundMuted, fontSize: 12, lineHeight: 16 }}>·</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              {checks === "running" ? <CheckProgress quarters={quarters} color={checkColor} /> : <Icon name={checks === "passed" ? "CircleCheck" : "CircleX"} size={12} color={checkColor} />}
              <Text style={{ color: checkColor, fontSize: 12, lineHeight: 16 }}>{checks}</Text>
            </View>
          </>}
        </>}
        {!!workspace.labels?.length && <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginLeft: pr && prNumber ? 0 : -6, minWidth: 0, flexShrink: 1 }}>
          {workspace.labels.map((label) => <View key={label} style={{ backgroundColor: appearance.labels[label]?.backgroundColor ?? colors.surface2, borderRadius: 9999, paddingHorizontal: 6, minWidth: 0, flexShrink: 1 }}>
            <Text numberOfLines={1} style={{ color: appearance.labels[label]?.color ?? colors.foregroundMuted, fontSize: 12, lineHeight: 16 }}>{label}</Text>
          </View>)}
        </View>}
      </View>}
    </View>
  </Pressable>;
}

export function WorkspacePicker({ workspaces, theme, hostId, selectedId, currentId, query, onSelect }: PickerProps) {
  const paseo = usePaseo();
  const projectDirectory = useQuery({ queryKey: ["workspace-drawer", "projects"], queryFn: () => paseo.projects.list() });
  const [order, setOrder] = useState<SidebarOrder | null>(() => readSidebarOrder());
  const [appearance, setAppearance] = useState<SidebarAppearance>(() => readSidebarAppearance());
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [pinnedCollapsed, setPinnedCollapsed] = useState(false);
  const [hoveredProject, setHoveredProject] = useState<string | null>(null);
  const [pinnedHovered, setPinnedHovered] = useState(false);
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});
  const [hoveredToggle, setHoveredToggle] = useState<string | null>(null);
  useEffect(() => {
    const timer = setInterval(() => {
      const next = readSidebarOrder();
      setOrder((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
      const nextAppearance = readSidebarAppearance();
      setAppearance((previous) => JSON.stringify(previous) === JSON.stringify(nextAppearance) ? previous : nextAppearance);
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  const filter = query.trim().toLowerCase();
  const matches = (workspace: Workspace) => `${workspace.name} ${workspace.projectDisplayName} ${workspace.workspaceDirectory ?? workspace.projectRootPath}`.toLowerCase().includes(filter);
  const workspaceKey = (workspace: Workspace) => `${hostId}:${workspace.id}`;
  const projectKeys = new Map(projectDirectory.data?.projects.map((project) => [project.projectId, project.projectKey]));
  const pinned = applyOrder(workspaces.filter((workspace) => !!workspace.pinnedAt)
    .sort((left, right) => (right.pinnedAt ?? "").localeCompare(left.pinnedAt ?? "")), order?.pinnedWorkspaceOrder ?? [], workspaceKey).filter(matches);
  const byProject = new Map<string, { id: string; name: string; viewKey: string; workspaces: Workspace[] }>();
  for (const workspace of workspaces) {
    const project = byProject.get(workspace.projectId);
    if (project) { if (!workspace.pinnedAt) project.workspaces.push(workspace); }
    else byProject.set(workspace.projectId, {
      id: workspace.projectId,
      name: workspace.projectCustomName ?? workspace.projectDisplayName,
      viewKey: order?.workspaceOrderByProject[JSON.stringify([hostId, workspace.projectId])]
        ? JSON.stringify([hostId, workspace.projectId])
        : projectKeys.get(workspace.projectId) ?? JSON.stringify([hostId, workspace.projectId]),
      workspaces: workspace.pinnedAt ? [] : [workspace],
    });
  }
  const projects = applyOrder([...byProject.values()].sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" })), order?.projectOrder ?? [], (project) => project.viewKey)
    .map((project) => ({ ...project, workspaces: applyOrder(project.workspaces.sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" }) || left.id.localeCompare(right.id)), order?.workspaceOrderByProject[project.viewKey] ?? [], workspaceKey).filter(matches) }))
    .filter((project) => project.workspaces.length > 0);
  const colors = theme.colors;
  return <ScrollView style={{ flex: 1, backgroundColor: appearance.background ?? colors.surface0 }} contentContainerStyle={{ paddingTop: 2, paddingBottom: 16, paddingHorizontal: 8 }}>
    {!pinned.length && !projects.length && <Text style={{ color: colors.foregroundMuted, fontSize: 12, padding: 8 }}>No matching workspaces.</Text>}
    {pinned.length > 0 && <View style={{ marginBottom: 4 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={pinnedCollapsed ? "Expand Pinned" : "Collapse Pinned"} accessibilityState={{ expanded: !pinnedCollapsed }} onHoverIn={() => setPinnedHovered(true)} onHoverOut={() => setPinnedHovered(false)} onPress={() => setPinnedCollapsed((value) => !value)} style={{ minHeight: 36, alignSelf: "flex-start", flexDirection: "row", gap: 4, alignItems: "center", paddingHorizontal: 8, paddingVertical: 4 }}>
        <Text style={{ color: colors.foregroundMuted, fontSize: 12 }}>Pinned</Text>
        <View style={{ opacity: pinnedHovered ? 1 : 0 }}><Icon name={pinnedCollapsed ? "ChevronRight" : "ChevronDown"} size={12} color={colors.foregroundMuted} /></View>
      </Pressable>
      {(!pinnedCollapsed || !!filter) && pinned.map((workspace) => <WorkspaceRow key={workspace.id} workspace={workspace} theme={theme} appearance={appearance} selected={workspace.id === selectedId} current={workspace.id === currentId} pinned onSelect={onSelect} />)}
    </View>}
    {projects.length > 0 && <View style={{ height: 36, justifyContent: "center", paddingHorizontal: 8, paddingVertical: 4 }}><Text style={{ color: colors.foregroundMuted, fontSize: 12 }}>Workspaces</Text></View>}
    {projects.map((project) => {
      const expanded = !!filter || !collapsed[project.id];
      const visibleWorkspaces = filter || showAll[project.id] ? project.workspaces : project.workspaces.slice(0, 20);
      const projectIcon = Object.entries(appearance.projects).find(([key]) => workspaces.some((workspace) => workspace.projectId === project.id && key.endsWith(`:${workspace.id}`)))?.[1];
      return <View key={project.id} style={{ paddingBottom: expanded ? 12 : 0 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${expanded ? "Collapse" : "Expand"} project ${project.name}`} accessibilityState={{ expanded }}
          onPress={() => setCollapsed((previous) => ({ ...previous, [project.id]: !previous[project.id] }))}
          onHoverIn={() => setHoveredProject(project.id)} onHoverOut={() => setHoveredProject(null)}
          style={({ pressed }) => ({ flexDirection: "row", gap: 8, alignItems: "center", minHeight: 40, padding: 8, marginBottom: 4, borderRadius: 8, backgroundColor: pressed ? colors.surface2 : hoveredProject === project.id ? colors.surface1 : appearance.background ?? colors.surface0 })}>
          <View style={{ width: 16, height: 20, alignItems: "center", justifyContent: "center" }}>
            {hoveredProject === project.id ? <Icon name={expanded ? "ChevronDown" : "ChevronRight"} size={12} color={colors.foregroundMuted} /> : <View style={{ width: 16, height: 16, borderRadius: 4, alignItems: "center", justifyContent: "center", backgroundColor: projectIcon?.backgroundColor ?? colors.surface2 }}>
              <Text style={{ color: projectIcon?.color ?? colors.foreground, fontSize: 9 }}>{projectIcon?.initial ?? project.name.charAt(0).toUpperCase()}</Text>
            </View>}
          </View>
          <Text style={{ flex: 1, color: hoveredProject === project.id ? colors.foreground : colors.foregroundMuted, fontSize: 14, fontWeight: "400" }}>{project.name}</Text>
        </Pressable>
        {expanded && visibleWorkspaces.map((workspace) => <WorkspaceRow key={workspace.id} workspace={workspace} theme={theme} appearance={appearance} selected={workspace.id === selectedId} current={workspace.id === currentId} onSelect={onSelect} />)}
        {expanded && !filter && project.workspaces.length > 20 && <Pressable accessibilityRole="button" accessibilityLabel={`${showAll[project.id] ? "Show less" : "Show more"} workspaces in ${project.name}`} accessibilityState={{ expanded: !!showAll[project.id] }}
          onHoverIn={() => setHoveredToggle(project.id)} onHoverOut={() => setHoveredToggle(null)} onPress={() => setShowAll((previous) => ({ ...previous, [project.id]: !previous[project.id] }))}
          style={({ pressed }) => ({ minHeight: 36, marginBottom: 2, paddingVertical: 8, paddingLeft: 8, paddingRight: 12, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: pressed ? colors.surface2 : hoveredToggle === project.id ? colors.surface1 : appearance.background ?? colors.surface0 })}>
          <View style={{ width: 16, height: 16, alignItems: "center", justifyContent: "center" }}><Icon name={showAll[project.id] ? "ChevronUp" : "ChevronDown"} size={14} color={hoveredToggle === project.id ? colors.foreground : colors.foregroundMuted} /></View>
          <Text style={{ color: hoveredToggle === project.id ? colors.foreground : colors.foregroundMuted, fontSize: 14 }}>{showAll[project.id] ? "Show less" : "Show more"}</Text>
        </Pressable>}
      </View>;
    })}
  </ScrollView>;
}
