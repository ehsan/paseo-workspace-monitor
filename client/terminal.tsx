import type { PaseoTerminal } from "@getpaseo/client";
import { type PluginWorkspacePanelProps, usePaseo } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { errorText } from "./directory";
import { codeFont } from "./markdown";

type TerminalProps = Pick<PluginWorkspacePanelProps, "theme" | "navigation"> & { terminal: PaseoTerminal };

export function TerminalMonitor({ terminal, theme, navigation }: TerminalProps) {
  const paseo = usePaseo();
  const [paused, setPaused] = useState(false);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const atBottom = useRef(true);
  const scroll = useRef<ScrollView>(null);
  const capture = useQuery({
    queryKey: ["workspace-drawer", "terminal", terminal.id],
    queryFn: () => paseo.terminals.ref(terminal).capture({ start: -500, stripAnsi: true }),
    refetchInterval: paused ? false : 1000,
    retry: false,
  });
  const colors = theme.colors;
  const label = { color: colors.foregroundMuted, fontSize: 11 };
  const button = { padding: 8, borderRadius: 7, backgroundColor: colors.surface1 };
  return <View style={{ flex: 1, minHeight: 0, gap: 8 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <Text style={{ ...label, flex: 1 }}>Read-only · {paused ? "Paused" : "Live · refreshes every second"}</Text>
      <Pressable accessibilityRole="button" style={button} onPress={() => setPaused((value) => !value)}>
        <Text style={label}>{paused ? "Resume" : "Pause"}</Text>
      </Pressable>
      {navigation && <Pressable accessibilityRole="button" style={button} onPress={() => navigation.openWorkspace({ workspaceId: terminal.workspaceId })}>
        <Text style={label}>Open workspace</Text>
      </Pressable>}
    </View>
    <Text numberOfLines={1} style={label}>{terminal.cwd}</Text>
    {capture.isError && <View style={{ gap: 6 }}>
      <Text style={{ color: colors.statusDanger, fontSize: 12 }}>{errorText(capture.error)}</Text>
      <Pressable accessibilityRole="button" onPress={() => void capture.refetch()} style={button}><Text style={label}>Retry output</Text></Pressable>
    </View>}
    <ScrollView ref={scroll} style={{ flex: 1, borderRadius: 8, backgroundColor: colors.surface1 }}
      contentContainerStyle={{ padding: 10 }} scrollEventThrottle={100}
      onScroll={({ nativeEvent: { contentOffset, contentSize, layoutMeasurement } }) => {
        atBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 60;
        setAwayFromBottom(!atBottom.current);
      }}
      onContentSizeChange={() => { if (atBottom.current) scroll.current?.scrollToEnd({ animated: false }); }}>
      <ScrollView horizontal contentContainerStyle={{ minWidth: "100%" }}>
        <Text selectable style={{ color: colors.foreground, fontFamily: codeFont, fontSize: 12, lineHeight: 18 }}>{capture.data?.lines.join("\n") || (capture.isPending ? "Loading terminal output…" : "No terminal output yet.")}</Text>
      </ScrollView>
    </ScrollView>
    {awayFromBottom && <Pressable accessibilityRole="button" onPress={() => { atBottom.current = true; setAwayFromBottom(false); scroll.current?.scrollToEnd({ animated: true }); }}
      style={{ ...button, alignSelf: "center", flexDirection: "row", gap: 6 }}>
      <Icon name="ArrowDown" size={12} color={colors.foregroundMuted} /><Text style={label}>Jump to latest</Text>
    </Pressable>}
    <Text style={label}>Latest 500 lines. Commands and terminal input stay in the main workspace.</Text>
  </View>;
}
