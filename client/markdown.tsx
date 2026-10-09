import type { PluginTheme } from "@getpaseo/plugin";
import { openExternalUrl } from "@getpaseo/plugin/client";
import { copyText, useToast } from "@getpaseo/plugin/client/react-native";
import { Lexer, type MarkedToken, type Token } from "marked";
import { memo, useMemo } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";

export const codeFont = Platform.OS === "ios" ? "Menlo" : Platform.OS === "android" ? "monospace" : "monospace";

export const Markdown = memo(function Markdown({ text, theme }: { text: string; theme: PluginTheme }) {
  const tokens = useMemo(() => Lexer.lex(text, { gfm: true }), [text]);
  const toast = useToast();
  const colors = theme.colors;
  const body = { color: colors.foreground, fontSize: 14, lineHeight: 22 };

  function inline(values: Token[]) {
    return values.map((value, index) => {
      const token = value as MarkedToken;
      switch (token.type) {
        case "strong": return <Text key={index} style={{ fontWeight: "700" }}>{inline(token.tokens)}</Text>;
        case "em": return <Text key={index} style={{ fontStyle: "italic" }}>{inline(token.tokens)}</Text>;
        case "del": return <Text key={index} style={{ textDecorationLine: "line-through" }}>{inline(token.tokens)}</Text>;
        case "codespan": return <Text key={index} style={{ fontFamily: codeFont, fontSize: 12, backgroundColor: colors.surface2 }}>{token.text}</Text>;
        case "link": return <Text key={index} accessibilityRole="link" style={{ color: colors.accent, textDecorationLine: "underline" }}
          onPress={() => { if (/^https?:\/\//i.test(token.href)) void openExternalUrl(token.href).catch(() => toast.error("Couldn't open this link.")); }}>{inline(token.tokens)}</Text>;
        case "image": return <Text key={index} style={{ color: colors.foregroundMuted }}>[Image: {token.text || token.href}]</Text>;
        case "br": return "\n";
        case "text": return token.tokens ? <Text key={index}>{inline(token.tokens)}</Text> : token.text;
        case "escape": return token.text;
        default: return token.raw;
      }
    });
  }

  function blocks(values: Token[]) {
    return values.map((value, index) => {
      const token = value as MarkedToken;
      switch (token.type) {
        case "space": case "def": return null;
        case "heading": return <Text key={index} selectable style={{ ...body, fontSize: token.depth <= 2 ? 18 : 15, fontWeight: "700", marginTop: 6 }}>{inline(token.tokens)}</Text>;
        case "paragraph": case "text": return <Text key={index} selectable style={body}>{token.tokens ? inline(token.tokens) : token.text}</Text>;
        case "code": return <View key={index} style={{ backgroundColor: colors.surface2, borderRadius: 8, overflow: "hidden" }}>
          <View style={{ padding: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: colors.foregroundMuted, fontSize: 11 }}>{token.lang || "Code"}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Copy code" onPress={() => void copyText(token.text).then(() => toast.show("Code copied")).catch(() => toast.error("Couldn't copy code."))}>
              <Text style={{ color: colors.foregroundMuted, fontSize: 11 }}>Copy</Text>
            </Pressable>
          </View>
          <ScrollView horizontal contentContainerStyle={{ padding: 10, paddingTop: 0 }}><Text selectable style={{ ...body, fontFamily: codeFont, fontSize: 12, lineHeight: 19 }}>{token.text}</Text></ScrollView>
        </View>;
        case "list": return <View key={index} style={{ gap: 6 }}>{token.items.map((item, position) => <View key={position} style={{ flexDirection: "row", gap: 8 }}>
          <Text style={{ ...body, color: item.checked ? colors.statusSuccess : colors.foregroundMuted, minWidth: 16 }}>{item.task ? item.checked ? "✓" : "○" : token.ordered ? `${Number(token.start) + position}.` : "•"}</Text>
          <View style={{ flex: 1, minWidth: 0, gap: 6 }}>{blocks(item.tokens)}</View>
        </View>)}</View>;
        case "blockquote": return <View key={index} style={{ paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.border, gap: 8 }}>{blocks(token.tokens)}</View>;
        case "hr": return <View key={index} style={{ height: 1, backgroundColor: colors.border }} />;
        case "table": return <ScrollView key={index} horizontal><View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 6 }}>
          {[token.header, ...token.rows].map((row, rowIndex) => <View key={rowIndex} style={{ flexDirection: "row", backgroundColor: rowIndex === 0 ? colors.surface2 : colors.surface0 }}>
            {row.map((cell, column) => <Text key={column} selectable style={{ ...body, width: 160, padding: 8, fontSize: 12, fontWeight: rowIndex === 0 ? "600" : "400", textAlign: token.align[column] ?? "left" }}>{inline(cell.tokens)}</Text>)}
          </View>)}
        </View></ScrollView>;
        default: return <Text key={index} selectable style={body}>{token.raw}</Text>;
      }
    });
  }

  return <View style={{ gap: 10 }}>{blocks(tokens)}</View>;
});
