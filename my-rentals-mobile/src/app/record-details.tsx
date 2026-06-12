import { useEffect } from "react";
import { View } from "react-native";
import { router, Stack } from "expo-router";

export default function RecordDetailsScreen() {
  useEffect(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/" as never);
    }
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAF8" }}>
      <Stack.Screen options={{ title: "" }} />
    </View>
  );
}
