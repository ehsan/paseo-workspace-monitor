import { useEffect, useRef } from "react";
import { Animated, Easing, Platform, View } from "react-native";

export function WorkingIndicator({ color }: { color: string }) {
  const rotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.loop(Animated.timing(rotation, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: Platform.OS !== "web" }));
    animation.start();
    return () => animation.stop();
  }, [rotation]);
  return <View accessibilityLabel="Working" style={{ width: 14, height: 14, alignItems: "center", justifyContent: "center" }}>
    <View style={{ position: "absolute", width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: color, opacity: 0.3 }} />
    <Animated.View style={{ position: "absolute", width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: "transparent", borderTopColor: color, opacity: 0.9, transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }} />
    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
  </View>;
}
