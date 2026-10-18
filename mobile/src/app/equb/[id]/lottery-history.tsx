import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { apiRequest } from "../../../services/api";

type LotteryHistoryItem = {
    periodId: string;
    periodNumber: number;
    startDate: string;
    dueDate: string;
    periodStatus: string;

    lotteryId: string | null;
    lotteryStatus: "PENDING" | "READY" | "RUNNING" | "COMPLETED" | "CANCELLED" | null;
    historyStatus: "NOT_DRAWN" | "DRAW_IN_PROGRESS" | "COMPLETED";
    startedAt: string | null;
    executedAt: string | null;

    winner: {
        id: string;
        firstName: string;
        lastName: string;
        profileImage: string | null;
    } | null;
};

const formatDate = (value?: string | null) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString();
};

export default function LotteryHistoryScreen() {
    const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
    const equbId = Array.isArray(rawId) ? rawId[0] : rawId;

    const [history, setHistory] = useState<LotteryHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    const loadHistory = useCallback(async (isRefresh = false) => {
        if (!equbId) {
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
            const result = await apiRequest<
                LotteryHistoryItem[] | { success?: boolean; data?: LotteryHistoryItem[] }
            >(`/equbs/${equbId}/lottery/history`);

            const items = Array.isArray(result)
                ? result
                : Array.isArray(result?.data)
                    ? result.data
                    : [];

            setHistory(items);
        } catch (err: any) {
            console.error("Load lottery history error:", err);

            setError(
                err?.response?.data?.message ||
                err?.message ||
                "Failed to load lottery history."
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [equbId]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    const renderStatus = (item: LotteryHistoryItem) => {
        if (
            item.historyStatus === "DRAW_IN_PROGRESS" ||
            item.lotteryStatus === "RUNNING"
        ) {
            return (
                <View className="self-start rounded-full bg-amber-100 px-3 py-1">
                    <Text className="text-xs font-bold text-amber-800">
                        DRAW IN PROGRESS
                    </Text>
                </View>
            );
        }

        if (
            item.historyStatus === "COMPLETED" &&
            item.winner
        ) {
            return (
                <View className="self-start rounded-full bg-green-100 px-3 py-1">
                    <Text className="text-xs font-bold text-green-800">
                        DRAW COMPLETED
                    </Text>
                </View>
            );
        }

        if (item.lotteryStatus === "CANCELLED") {
            return (
                <View className="self-start rounded-full bg-gray-200 px-3 py-1">
                    <Text className="text-xs font-bold text-gray-700">
                        CANCELLED
                    </Text>
                </View>
            );
        }

        return (
            <View className="self-start rounded-full bg-gray-100 px-3 py-1">
                <Text className="text-xs font-bold text-gray-600">
                    NOT DRAWN
                </Text>
            </View>
        );
    };

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50">
                <ActivityIndicator size="large" color="#2563eb" />
                <Text className="mt-3 text-sm text-gray-500">
                    Loading lottery history...
                </Text>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-gray-50">
            <View className="flex-row items-center border-b border-gray-200 bg-white px-4 py-4">
                <Pressable
                    onPress={() => router.back()}
                    className="mr-3 rounded-lg bg-gray-100 px-3 py-2"
                >
                    <Text className="font-semibold text-gray-800">Back</Text>
                </Pressable>

                <View className="flex-1">
                    <Text className="text-xl font-bold text-gray-900">
                        Lottery History
                    </Text>
                    <Text className="mt-1 text-sm text-gray-500">
                        Winners and draw status for every period
                    </Text>
                </View>
            </View>

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
            >
                <Pressable
                    onPress={() => loadHistory(true)}
                    disabled={refreshing}
                    className="mb-4 self-end rounded-lg border border-gray-300 bg-white px-4 py-2"
                >
                    <Text className="font-semibold text-gray-700">
                        {refreshing ? "Refreshing..." : "Refresh"}
                    </Text>
                </Pressable>

                {error ? (
                    <View className="rounded-xl border border-red-200 bg-red-50 p-4">
                        <Text className="font-semibold text-red-700">
                            Could not load lottery history
                        </Text>

                        <Text className="mt-2 text-sm text-red-600">
                            {error}
                        </Text>

                        <Pressable
                            onPress={() => loadHistory()}
                            className="mt-4 self-start rounded-lg bg-red-600 px-4 py-2"
                        >
                            <Text className="font-semibold text-white">
                                Try again
                            </Text>
                        </Pressable>
                    </View>
                ) : history.length === 0 ? (
                    <View className="rounded-xl border border-gray-200 bg-white p-6">
                        <Text className="text-center text-base font-semibold text-gray-800">
                            No payment periods found
                        </Text>

                        <Text className="mt-2 text-center text-sm text-gray-500">
                            There are no payment periods available for this Equb yet.
                        </Text>
                    </View>
                ) : (
                    history.map((item) => (
                        <View
                            key={item.periodId}
                            className="mb-4 rounded-xl border border-gray-200 bg-white p-4"
                        >
                            <View className="flex-row items-start justify-between">
                                <View className="mr-3 flex-1">
                                    <Text className="text-lg font-bold text-gray-900">
                                        Period {item.periodNumber}
                                    </Text>

                                    <Text className="mt-1 text-sm text-gray-500">
                                        Due date: {formatDate(item.dueDate)}
                                    </Text>
                                </View>

                                {renderStatus(item)}
                            </View>

                            <View className="my-4 border-t border-gray-100" />

                            {item.historyStatus === "COMPLETED" && item.winner ? (
                                <View>
                                    <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Lottery Winner
                                    </Text>

                                    <Text className="mt-1 text-lg font-bold text-green-700">
                                        {`${item.winner.firstName} ${item.winner.lastName}`.trim()}
                                    </Text>

                                    <Text className="mt-2 text-sm text-gray-500">
                                        Draw date: {formatDate(item.executedAt)}
                                    </Text>
                                </View>
                            ) : item.historyStatus === "DRAW_IN_PROGRESS" ||
                                item.lotteryStatus === "RUNNING" ? (
                                <Text className="text-sm text-amber-800">
                                    The lottery draw is currently in progress. The winner has
                                    not been confirmed yet.
                                </Text>
                            ) : item.lotteryStatus === "CANCELLED" ? (
                                <Text className="text-sm text-gray-500">
                                    The lottery for this period was cancelled.
                                </Text>
                            ) : (
                                <Text className="text-sm text-gray-500">
                                    NOT DRAWN — No completed lottery winner is available for
                                    this period.
                                </Text>
                            )}
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
    );
}