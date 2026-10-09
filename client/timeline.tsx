import type { PluginTheme } from "@getpaseo/plugin";
import { Icon } from "@getpaseo/plugin/client/react-native";
import type { AgentTimelineItem, ToolCallTimelineItem } from "@getpaseo/protocol/agent-types";
import type { FetchAgentTimelineResponseMessage } from "@getpaseo/protocol/messages";
import { memo, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { codeFont, Markdown } from "./markdown";
import { WorkingIndicator } from "./working-indicator";

type Entry = FetchAgentTimelineResponseMessage["payload"]["entries"][number];

function toolSummary(item: ToolCallTimelineItem) {
  const detail = item.detail;
  switch (detail.type) {
    case "shell": return { icon: "Terminal", title: "Run command", subtitle: detail.command, output: detail.output };
    case "read": return { icon: "FileText", title: "Read file", subtitle: detail.filePath, output: detail.content };
    case "edit": return { icon: "FilePenLine", title: "Edit file", subtitle: detail.filePath, output: detail.unifiedDiff ?? detail.newString };
    case "write": return { icon: "FilePlus2", title: "Write file", subtitle: detail.filePath, output: detail.content };
    case "search": return { icon: "Search", title: "Search", subtitle: detail.query, output: detail.content ?? detail.filePaths?.join("\n") };
    case "fetch": return { icon: "Globe", title: "Fetch page", subtitle: detail.url, output: detail.result };
    case "sub_agent": return { icon: "Bot", title: "Delegate task", subtitle: detail.description ?? item.name, output: detail.log };
    case "worktree_setup": return { icon: "GitBranch", title: "Set up worktree", subtitle: detail.branchName, output: detail.log };
    case "plan": return { icon: "ListChecks", title: "Plan", subtitle: detail.text.split("\n")[0], output: detail.text };
    case "plain_text": return { icon: "Wrench", title: detail.label ?? item.name.replaceAll("_", " "), subtitle: detail.text?.split("\n")[0] ?? "", output: detail.text };
    case "unknown": {
      const input = detail.input && typeof detail.input === "object" ? detail.input as Record<string, unknown> : {};
      const title = typeof input.i === "string" ? input.i : item.name.replaceAll("_", " ");
      const subtitle = [input.command, input.path, input.query, input.name].find((value) => typeof value === "string");
      return { icon: "Wrench", title, subtitle: typeof subtitle === "string" ? subtitle : "", output: typeof detail.output === "string" ? detail.output : undefined };
    }
  }
}

const ActivityRow = memo(function ActivityRow({ entry, theme }: { entry: Entry; theme: PluginTheme }) {
  const [expanded, setExpanded] = useState(false);
  const [raw, setRaw] = useState(false);
  const item = entry.item;
  const colors = theme.colors;
  let title = "Activity";
  let subtitle = "";
  let content: string | undefined;
  let icon = "Info";
  let status = "";
  let statusColor = colors.foregroundMuted;
  switch (item.type) {
    case "tool_call": {
      const summary = toolSummary(item);
      title = summary.title;
      subtitle = summary.subtitle;
      content = summary.output;
      icon = summary.icon;
      status = { running: "Running", completed: "Done", failed: "Failed", canceled: "Canceled" }[item.status];
      statusColor = item.status === "failed" ? colors.statusDanger : item.status === "running" ? colors.accent : colors.foregroundMuted;
      if (item.status === "failed" && item.error) content = `${content ?? ""}\n${typeof item.error === "string" ? item.error : JSON.stringify(item.error, null, 2)}`.trim();
      break;
    }
    case "reasoning": title = "Thinking"; icon = "Brain"; content = item.text; break;
    case "compaction": title = item.status === "loading" ? "Making room in context…" : "Context compacted"; icon = "Archive"; break;
    case "notification": title = item.level === "error" ? "Agent error" : item.level === "warning" ? "Notice" : "Update"; subtitle = item.message; content = item.message; statusColor = item.level === "error" ? colors.statusDanger : colors.foregroundMuted; break;
    case "plugin": title = item.kind.replaceAll("-", " "); subtitle = item.pluginId; icon = "Puzzle"; break;
    default: break;
  }
  return <View style={{ gap: 8 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${expanded ? "Collapse" : "Expand"} ${title}`} accessibilityState={{ expanded }}
      onPress={() => setExpanded((value) => !value)} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 8 }}>
      <Icon name={icon} size={14} color={statusColor} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text numberOfLines={2} style={{ color: statusColor, fontSize: 12, fontWeight: "500" }}>{title}</Text>
        {!!subtitle && <Text numberOfLines={expanded ? undefined : 1} style={{ color: colors.foregroundMuted, fontSize: 11, lineHeight: 17 }}>{subtitle}</Text>}
      </View>
      {!!status && <Text style={{ color: statusColor, fontSize: 10 }}>{status}</Text>}
      <Icon name={expanded ? "ChevronDown" : "ChevronRight"} size={12} color={colors.foregroundMuted} />
    </Pressable>
    {expanded && <View style={{ gap: 8, paddingLeft: 22 }}>
      {content && (item.type === "reasoning" ? <Markdown text={content} theme={theme} /> :
        <ScrollView horizontal style={{ maxHeight: 260 }} contentContainerStyle={{ padding: 8, backgroundColor: colors.surface2, borderRadius: 6 }}>
          <Text selectable style={{ color: colors.foreground, fontFamily: codeFont, fontSize: 11, lineHeight: 17 }}>{content}</Text>
        </ScrollView>)}
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: raw }} onPress={() => setRaw((value) => !value)}>
        <Text style={{ color: colors.foregroundMuted, fontSize: 11 }}>{raw ? "Hide raw data" : "View raw data"}</Text>
      </Pressable>
      {raw && <ScrollView horizontal style={{ maxHeight: 300 }}><Text selectable style={{ color: colors.foregroundMuted, fontFamily: codeFont, fontSize: 11, lineHeight: 17 }}>{JSON.stringify(item, null, 2)}</Text></ScrollView>}
    </View>}
  </View>;
});

function ActivityGroup({ entries, theme }: { entries: Entry[]; theme: PluginTheme }) {
  const [expanded, setExpanded] = useState(false);
  const colors = theme.colors;
  const tools = entries.filter((entry) => entry.item.type === "tool_call");
  const running = tools.some((entry) => entry.item.type === "tool_call" && entry.item.status === "running");
  const thinking = entries.some((entry) => entry.item.type === "reasoning");
  const label = tools.length ? `${tools.length} ${tools.length === 1 ? "action" : "actions"}${running ? " · working" : " completed"}` : thinking ? "Thinking" : `${entries.length} ${entries.length === 1 ? "update" : "updates"}`;
  return <View>
    <Pressable accessibilityRole="button" accessibilityLabel={`${expanded ? "Hide" : "Show"} activity details`} accessibilityState={{ expanded }}
      onPress={() => setExpanded((value) => !value)} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 }}>
      {running ? <WorkingIndicator color={colors.foregroundMuted} /> : <Icon name="Wrench" size={14} color={colors.foregroundMuted} />}
      <Text style={{ flex: 1, color: colors.foregroundMuted, fontSize: 14 }}>{label}</Text>
      <Icon name={expanded ? "ChevronDown" : "ChevronRight"} size={14} color={colors.foregroundMuted} />
    </Pressable>
    {expanded && <View style={{ paddingBottom: 8 }}>{entries.map((entry) =>
      <ActivityRow key={entry.item.type === "tool_call" ? entry.item.callId : `${entry.seqStart}-${entry.item.type}`} entry={entry} theme={theme} />)}</View>}
  </View>;
}

function Tasks({ item, theme }: { item: Extract<AgentTimelineItem, { type: "todo" }>; theme: PluginTheme }) {
  const [expanded, setExpanded] = useState(false);
  const completed = item.items.filter((task) => task.completed || task.status === "completed").length;
  return <View style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, padding: 10, gap: 8 }}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded((value) => !value)} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
      <Icon name="ListChecks" size={14} color={theme.colors.foregroundMuted} />
      <Text style={{ flex: 1, color: theme.colors.foregroundMuted, fontSize: 12 }}>Tasks · {completed}/{item.items.length} complete</Text>
      <Icon name={expanded ? "ChevronDown" : "ChevronRight"} size={14} color={theme.colors.foregroundMuted} />
    </Pressable>
    {expanded && item.items.map((task, index) => <View key={task.id ?? index} style={{ flexDirection: "row", gap: 8 }}>
      <Icon name={task.completed || task.status === "completed" ? "CircleCheck" : task.status === "in_progress" ? "CircleDot" : "Circle"} size={14} color={task.completed ? theme.colors.statusSuccess : theme.colors.foregroundMuted} />
      <Text style={{ flex: 1, color: theme.colors.foreground, fontSize: 12, lineHeight: 18 }}>{task.text}</Text>
    </View>)}
  </View>;
}

export function Timeline({ entries, theme, showActivity }: { entries: Entry[]; theme: PluginTheme; showActivity: boolean }) {
  const groups = useMemo(() => {
    const result: { key: string; entries: Entry[]; activity: boolean }[] = [];
    for (const entry of entries) {
      const activity = !["user_message", "assistant_message", "error", "todo"].includes(entry.item.type);
      const last = result[result.length - 1];
      if (activity && last?.activity) last.entries.push(entry);
      else result.push({ key: `${entry.seqStart}-${entry.item.type}`, entries: [entry], activity });
    }
    return result;
  }, [entries]);
  return <>{groups.map((group) => {
    if (group.activity) {
      const failure = group.entries.some(({ item }) => item.type === "tool_call" && item.status === "failed" || item.type === "notification" && item.level === "error");
      return showActivity || failure ? <ActivityGroup key={group.key} entries={group.entries} theme={theme} /> : null;
    }
    const { item } = group.entries[0];
    if (item.type === "todo") return <Tasks key={group.key} item={item} theme={theme} />;
    if (item.type === "error") return <View key={group.key} style={{ gap: 6, borderLeftWidth: 2, borderLeftColor: theme.colors.statusDanger, padding: 10 }}>
      <Text style={{ color: theme.colors.statusDanger, fontSize: 12, fontWeight: "600" }}>Something went wrong</Text>
      <Text selectable style={{ color: theme.colors.foreground, fontSize: 13, lineHeight: 20 }}>{item.message}</Text>
    </View>;
    if (item.type !== "user_message" && item.type !== "assistant_message") return null;
    const user = item.type === "user_message";
    return <View key={group.key} style={{ paddingVertical: user ? 10 : 0, paddingHorizontal: user ? 14 : 0, borderRadius: user ? 18 : 0, borderTopRightRadius: user ? 3 : 0, backgroundColor: user ? theme.colors.surface2 : theme.colors.surface0, alignSelf: user ? "flex-end" : "stretch", maxWidth: user ? "90%" : "100%", marginVertical: user ? 12 : 4 }}>
      {user ? <Text selectable style={{ color: theme.colors.foreground, fontSize: 14, lineHeight: 22 }}>{item.text}</Text> : <Markdown text={item.text} theme={theme} />}
    </View>;
  })}</>;
}
