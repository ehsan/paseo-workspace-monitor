import { type PluginWorkspacePanelProps, usePaseo } from "@getpaseo/plugin/client";
import type { PaseoAgentTimelineRefetchOptions } from "@getpaseo/client";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { type Agent, errorText } from "./directory";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { Timeline } from "./timeline";

type ChatProps = Pick<PluginWorkspacePanelProps, "theme" | "layout" | "navigation"> & { agent: Agent };

export function Chat({ agent, theme, layout, navigation }: ChatProps) {
  const paseo = usePaseo();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [streamError, setStreamError] = useState<string | null>(null);
  const [subscriptionRevision, setSubscriptionRevision] = useState(0);
  const [showActivity, setShowActivity] = useState(true);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const atBottom = useRef(true);
  const queryKey = ["workspace-drawer", "timeline", agent.id];
  const timeline = useInfiniteQuery({
    queryKey,
    initialPageParam: null as NonNullable<PaseoAgentTimelineRefetchOptions["cursor"]> | null,
    queryFn: async ({ pageParam }) => {
      const page = await paseo.agents.ref(agent.id).timeline.refetch({
        direction: pageParam ? "before" : "tail",
        ...(pageParam ? { cursor: pageParam } : {}),
        limit: 100,
        projection: "projected",
      });
      if (page.error) throw new Error(page.error);
      return page;
    },
    getNextPageParam: (page) => page.hasOlder ? page.startCursor : undefined,
    retry: false,
  });
  const send = useMutation({
    mutationFn: (text: string) => paseo.agents.ref(agent.id).send(text),
    onSuccess: (_value, text) => {
      setDraft((current) => current.trim() === text ? "" : current);
      atBottom.current = true;
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  useEffect(() => {
    let disposed = false;
    let timer = 0;
    setStreamError(null);
    const refresh = () => {
      if (disposed || timer !== 0) return;
      timer = setTimeout(() => {
        timer = 0;
        if (!disposed) void queryClient.invalidateQueries({ queryKey: ["workspace-drawer", "timeline", agent.id] });
      }, 250);
    };
    const unsubscribe = paseo.agents.ref(agent.id).timeline.subscribe(({ event }) => {
      if (disposed) return;
      if (event.type === "error") setStreamError(event.error);
      else {
        if (event.type === "replacement") void queryClient.resetQueries({ queryKey: ["workspace-drawer", "timeline", agent.id] });
        refresh();
      }
    });
    void unsubscribe.ready.then(refresh).catch((error: unknown) => { if (!disposed) setStreamError(errorText(error)); });
    return () => {
      disposed = true;
      clearTimeout(timer);
      unsubscribe();
    };
  }, [agent.id, paseo, queryClient, subscriptionRevision]);

  const color = theme.colors;
  const body = { color: color.foreground, fontSize: 14, lineHeight: 22 };
  const muted = { color: color.foregroundMuted, fontSize: 12 };
  const button = { padding: 8, borderRadius: 8, backgroundColor: color.surface1 };
  const pages = timeline.data?.pages;
  const entries = pages ? [...pages].reverse().flatMap((page) => page.entries) : [];
  const canSend = !!draft.trim() && !send.isPending && !streamError && !timeline.isError && agent.status !== "closed";
  const statusLabel = agent.pendingPermissions.length ? "Needs approval" : { initializing: "Starting…", idle: "Ready", running: "Working…", error: "Needs attention", closed: "Closed" }[agent.status];
  const statusColor = agent.pendingPermissions.length ? color.statusWarning : agent.status === "error" ? color.statusDanger : agent.status === "running" ? color.accent : color.statusSuccess;

  return (
    <View style={{ flex: 1, minHeight: 0, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor }} />
          <Text style={{ ...muted, color: statusColor }}>{statusLabel}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={showActivity ? "Hide agent activity" : "Show agent activity"} onPress={() => setShowActivity((value) => !value)} style={button}>
          <Text style={muted}>{showActivity ? "Activity on" : "Activity off"}</Text>
        </Pressable>
        {navigation && <Pressable accessibilityRole="button" onPress={() => navigation.openAgent({ agentId: agent.id })} style={button}>
          <Text style={muted}>Open in main</Text>
        </Pressable>}
      </View>
      {!!agent.pendingPermissions.length && <Text style={{ ...muted, color: color.statusWarning }}>Permission needed. Open in main to review and approve.</Text>}
      {streamError && <View style={{ gap: 6 }}>
        <Text style={{ ...body, color: color.statusDanger }}>{streamError}</Text>
        <Pressable accessibilityRole="button" style={button} onPress={() => setSubscriptionRevision((value) => value + 1)}><Text style={body}>Reconnect chat</Text></Pressable>
      </View>}
      {timeline.isError && <View style={{ gap: 6 }}>
        <Text style={{ ...body, color: color.statusDanger }}>{errorText(timeline.error)}</Text>
        <Pressable accessibilityRole="button" style={button} onPress={() => void timeline.refetch()}><Text style={body}>Retry history</Text></Pressable>
      </View>}
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ gap: 14, paddingVertical: 12 }}
        scrollEventThrottle={100}
        onScroll={({ nativeEvent: { contentOffset, contentSize, layoutMeasurement } }) => {
          atBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 80;
          setAwayFromBottom(!atBottom.current);
        }}
        onContentSizeChange={() => { if (atBottom.current) scroll.current?.scrollToEnd({ animated: false }); }}>
        {timeline.hasNextPage && <Pressable accessibilityRole="button" disabled={timeline.isFetchingNextPage} style={button}
          onPress={() => { atBottom.current = false; void timeline.fetchNextPage(); }}>
          <Text style={body}>{timeline.isFetchingNextPage ? "Loading…" : "Load earlier messages"}</Text>
        </Pressable>}
        {timeline.isPending && <Text style={muted}>Loading conversation…</Text>}
        {!timeline.isPending && !timeline.isError && entries.length === 0 && <Text style={muted}>No messages yet. Send a message below.</Text>}
        <Timeline entries={entries} theme={theme} showActivity={showActivity} />
      </ScrollView>
      {awayFromBottom && <Pressable accessibilityRole="button" onPress={() => { atBottom.current = true; setAwayFromBottom(false); scroll.current?.scrollToEnd({ animated: true }); }} style={{ ...button, alignSelf: "center", flexDirection: "row", gap: 6 }}>
        <Icon name="ArrowDown" size={12} color={color.foregroundMuted} />
        <Text style={muted}>Jump to latest</Text>
      </Pressable>}
      {send.isError && <Text style={{ ...body, color: color.statusDanger }}>{errorText(send.error)}</Text>}
      <View style={{ borderWidth: 1, borderColor: color.border, borderRadius: 10, backgroundColor: color.surface1, padding: 8, gap: 6 }}>
        <TextInput accessibilityLabel={`Message ${agent.title ?? "agent"}`} placeholder="Write a message…" placeholderTextColor={color.foregroundMuted}
          value={draft} onChangeText={setDraft} multiline
          style={{ ...body, minHeight: layout.compact ? 48 : 64, maxHeight: 160, padding: 4, textAlignVertical: "top" }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text numberOfLines={1} style={{ ...muted, flex: 1, fontSize: 10 }}>To {agent.title ?? "this agent"}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Send message to selected agent" disabled={!canSend}
            onPress={() => send.mutate(draft.trim())}
            style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: 7, backgroundColor: color.accent, opacity: canSend ? 1 : 0.45, flexDirection: "row", gap: 6, alignItems: "center" }}>
            <Text style={{ color: color.accentForeground, fontSize: 12, fontWeight: "600" }}>{send.isPending ? "Sending…" : "Send"}</Text>
            <Icon name="ArrowUp" size={12} color={color.accentForeground} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
