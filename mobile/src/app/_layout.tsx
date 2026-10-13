import "../global.css";

import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";

import { initI18n } from "../i18n";

export default function RootLayout() {
  const [isI18nInitialized, setIsI18nInitialized] = useState(false);

  useEffect(() => {
    let isMounted = true;

    initI18n()
      .catch((error) => {
        console.error("i18n initialization failed in RootLayout:", error);
      })
      .finally(() => {
        if (isMounted) {
          setIsI18nInitialized(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!isI18nInitialized) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#18181b" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}