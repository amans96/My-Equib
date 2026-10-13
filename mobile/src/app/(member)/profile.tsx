import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Check,
  Globe,
  LogOut,
  Mail,
  Phone,
  Shield,
  User as UserIcon,
} from "lucide-react-native";

import { changeAppLanguage, SUPPORTED_LANGUAGES } from "../../i18n";
import { getMe, User } from "../../services/auth.service";
import { getToken, removeToken } from "../../services/storage";

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [updatingLang, setUpdatingLang] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchUserData = async () => {
      try {
        setLoadingUser(true);
        const token = await getToken();
        if (token) {
          const res = await getMe(token);
          if (isMounted && res && res.data) {
            setUser(res.data);
          }
        }
      } catch (err) {
        // Soft fail - screen remains usable even without user details
        console.warn("Could not fetch user profile:", err);
      } finally {
        if (isMounted) {
          setLoadingUser(false);
        }
      }
    };

    fetchUserData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLanguageSelect = async (code: string) => {
    if (i18n.language === code) return;

    try {
      setUpdatingLang(true);
      await changeAppLanguage(code);
    } catch (error) {
      console.error("Language switch error:", error);
    } finally {
      setUpdatingLang(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      t("common.logout"),
      t("auth.logoutConfirm"),
      [
        {
          text: t("common.cancel"),
          style: "cancel",
        },
        {
          text: t("common.logout"),
          style: "destructive",
          onPress: async () => {
            await removeToken();
            router.replace("/login");
          },
        },
      ]
    );
  };

  const currentLanguageCode = i18n.language?.split("-")[0] || "en";

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: 24,
          paddingTop: 60,
          paddingBottom: 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Bar */}
        <View className="mb-6 flex-row items-center justify-between">
          <Pressable
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/equbs");
              }
            }}
            className="h-11 w-11 items-center justify-center rounded-2xl bg-white border border-gray-100 shadow-sm active:bg-gray-100"
          >
            <ArrowLeft size={20} color="#18181b" />
          </Pressable>

          <Text className="text-xl font-bold tracking-tight text-zinc-900">
            {t("profile.title")}
          </Text>

          {/* Spacer to keep title centered */}
          <View className="h-11 w-11" />
        </View>

        {/* User Card */}
        <View className="mb-6 items-center rounded-3xl bg-white p-6 border border-gray-100 shadow-sm">
          <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-zinc-900 shadow-sm">
            <UserIcon size={36} color="#ffffff" />
          </View>

          {loadingUser ? (
            <ActivityIndicator size="small" color="#18181b" className="my-2" />
          ) : (
            <>
              <Text className="text-xl font-bold text-zinc-900">
                {user ? `${user.firstName} ${user.lastName}` : "Equb Member"}
              </Text>

              {user?.phone ? (
                <View className="mt-1 flex-row items-center">
                  <Phone size={14} color="#64748b" />
                  <Text className="ml-1.5 text-sm text-slate-500 font-medium">
                    {user.phone}
                  </Text>
                </View>
              ) : null}

              {user?.email ? (
                <View className="mt-1 flex-row items-center">
                  <Mail size={14} color="#64748b" />
                  <Text className="ml-1.5 text-sm text-slate-500">
                    {user.email}
                  </Text>
                </View>
              ) : null}

              <View className="mt-3 rounded-full bg-zinc-100 px-3 py-1">
                <Text className="text-xs font-semibold text-zinc-700 capitalize">
                  {user?.role ? user.role.toLowerCase() : "Active Member"}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Language Selector Section */}
        <View className="mb-6 rounded-3xl bg-white p-5 border border-gray-100 shadow-sm">
          <View className="mb-4 flex-row items-center">
            <View className="mr-3 h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100">
              <Globe size={20} color="#18181b" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-zinc-900">
                {t("profile.language")}
              </Text>
              <Text className="text-xs text-gray-500">
                {t("profile.chooseLanguage")}
              </Text>
            </View>
          </View>

          {/* Language Options List */}
          <View className="gap-2.5">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = currentLanguageCode === lang.code;

              return (
                <Pressable
                  key={lang.code}
                  onPress={() => handleLanguageSelect(lang.code)}
                  disabled={updatingLang}
                  className={`flex-row items-center justify-between rounded-2xl p-4 border transition-all ${
                    isSelected
                      ? "border-zinc-900 bg-zinc-900"
                      : "border-gray-100 bg-gray-50 active:bg-gray-100"
                  }`}
                >
                  <View className="flex-row items-center">
                    <Text
                      className={`text-base font-bold ${
                        isSelected ? "text-white" : "text-zinc-900"
                      }`}
                    >
                      {lang.nativeName}
                    </Text>
                    {lang.code !== "en" && (
                      <Text
                        className={`ml-2 text-xs font-medium ${
                          isSelected ? "text-zinc-300" : "text-gray-400"
                        }`}
                      >
                        ({lang.label})
                      </Text>
                    )}
                  </View>

                  {isSelected && (
                    <View className="h-6 w-6 items-center justify-center rounded-full bg-white">
                      <Check size={14} color="#18181b" strokeWidth={3} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* App Info / Security */}
        <View className="mb-6 rounded-3xl bg-white p-5 border border-gray-100 shadow-sm">
          <View className="flex-row items-center justify-between py-2 border-b border-gray-100">
            <View className="flex-row items-center">
              <Shield size={18} color="#64748b" className="mr-3" />
              <Text className="text-sm font-semibold text-zinc-800">
                {t("profile.security")}
              </Text>
            </View>
            <Text className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              {t("payment.verified")}
            </Text>
          </View>

          <View className="flex-row items-center justify-between pt-3">
            <Text className="text-xs text-gray-400">
              {t("profile.version")}
            </Text>
            <Text className="text-xs font-medium text-gray-500">
              v1.0.0 (Expo SDK 57)
            </Text>
          </View>
        </View>

        {/* Log Out Button */}
        <Pressable
          onPress={handleLogout}
          className="flex-row items-center justify-center rounded-2xl border border-red-200 bg-red-50 py-4 active:bg-red-100"
        >
          <LogOut size={18} color="#dc2626" className="mr-2" />
          <Text className="text-base font-bold text-red-600">
            {t("common.logout")}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
