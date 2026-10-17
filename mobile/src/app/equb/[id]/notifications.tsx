import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Bell,
  Check,
  CheckCheck,
  Clock,
  RefreshCw,
} from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";

// Adjust this import to match the API service used in your mobile app.
import { apiRequest } from "../../../services/api";

type NotificationItem = {
  id: string;
  recipientId?: string;
  title: string;
  message: string;
  type?: string;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  equbId?: string;
};

export default function EqubNotificationsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [markingId, setMarkingId] = useState<string | null>(null);

  const loadNotifications = useCallback(
    async (isRefresh = false) => {
      if (!id) {
        setError("Equb ID is missing.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const response = await api.get(
          `/notifications?equbId=${encodeURIComponent(id)}`
        );

        const data = response.data;
        const items: NotificationItem[] = Array.isArray(data)
          ? data
          : data.notifications ?? [];

        setNotifications(items);
      } catch (err: any) {
        setError(
          err?.response?.data?.message ??
            "Could not load notifications. Please try again."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  const markAsRead = async (item: NotificationItem) => {
    if (item.isRead) return;

    const recipientId = item.recipientId ?? item.id;
    setMarkingId(item.id);

    try {
      await api.patch(`/notifications/${recipientId}/read`);

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === item.id
            ? { ...notification, isRead: true, readAt: new Date().toISOString() }
            : notification
        )
      );
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          "Could not mark this notification as read."
      );
    } finally {
      setMarkingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) return "Date unavailable";

    return date.toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderNotification = ({ item }: { item: NotificationItem }) => (
    <Pressable
      onPress={() => markAsRead(item)}
      disabled={item.isRead || markingId === item.id}
      className={`mb-3 rounded-2xl border p-4 ${
        item.isRead
          ? "border-gray-200 bg-white"
          : "border-blue-200 bg-blue-50"
      }`}
    >
      <View className="flex-row items-start">
        <View
          className={`mr-3 h-11 w-11 items-center justify-center rounded-full ${
            item.isRead ? "bg-gray-100" : "bg-blue-100"
          }`}
        >
          <Bell
            size={21}
            color={item.isRead ? "#6B7280" : "#2563EB"}
          />
        </View>

        <View className="flex-1">
          <View className="mb-1 flex-row items-start justify-between">
            <Text className="mr-2 flex-1 text-base font-bold text-gray-900">
              {item.title}
            </Text>

            {!item.isRead && (
              <View className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-600" />
            )}
          </View>

          <Text className="text-sm leading-5 text-gray-600">
            {item.message}
          </Text>

          <View className="mt-3 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Clock size={13} color="#9CA3AF" />
              <Text className="ml-1 text-xs text-gray-400">
                {formatDate(item.createdAt)}
              </Text>
            </View>

            {markingId === item.id ? (
              <ActivityIndicator size="small" color="#2563EB" />
            ) : item.isRead ? (
              <View className="flex-row items-center">
                <CheckCheck size={14} color="#16A34A" />
                <Text className="ml-1 text-xs text-green-700">Read</Text>
              </View>
            ) : (
              <View className="flex-row items-center">
                <Check size={14} color="#2563EB" />
                <Text className="ml-1 text-xs font-medium text-blue-700">
                  Tap to mark read
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-row items-center border-b border-gray-200 bg-white px-4 py-4">
        <Pressable
          onPress={() => router.back()}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-gray-100"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={21} color="#111827" />
        </Pressable>

        <View className="flex-1">
          <Text className="text-xl font-bold text-gray-900">
            Notifications
          </Text>
          <Text className="mt-1 text-sm text-gray-500">
            Updates for this Equb
          </Text>
        </View>

        <Pressable
          onPress={() => loadNotifications(true)}
          disabled={refreshing}
          className="h-10 w-10 items-center justify-center rounded-full bg-gray-100"
          accessibilityLabel="Refresh notifications"
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#2563EB" />
          ) : (
            <RefreshCw size={18} color="#374151" />
          )}
        </Pressable>
      </View>

      <View className="flex-1 px-4 pt-4">
        {!loading && (
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-sm text-gray-500">
              {notifications.length}{" "}
              {notifications.length === 1
                ? "notification"
                : "notifications"}
            </Text>

            <Text className="text-sm text-gray-500">
              {notifications.filter((item) => !item.isRead).length} unread
            </Text>
          </View>
        )}

        {error !== "" && (
          <View className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3">
            <Text className="text-sm text-red-700">{error}</Text>
            <Pressable
              onPress={() => loadNotifications()}
              className="mt-2 self-start"
            >
              <Text className="font-semibold text-red-700">Try again</Text>
            </Pressable>
          </View>
        )}

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#2563EB" />
            <Text className="mt-3 text-sm text-gray-500">
              Loading notifications...
            </Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            renderItem={renderNotification}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadNotifications(true)}
                tintColor="#2563EB"
              />
            }
            contentContainerStyle={{
              flexGrow: 1,
              paddingBottom: 24,
            }}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center px-6 py-20">
                <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-blue-50">
                  <Bell size={34} color="#2563EB" />
                </View>

                <Text className="text-center text-lg font-bold text-gray-900">
                  No notifications yet
                </Text>

                <Text className="mt-2 text-center text-sm leading-5 text-gray-500">
                  Equb announcements and updates from your admin will appear
                  here.
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}