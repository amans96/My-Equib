import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { ArrowRight, Users, Wallet, Clock, CheckCircle2 } from "lucide-react-native";

import {
  getEqubs,
  getMyMemberships,
  requestToJoinEqub,
} from "../../services/equb.service";

type Equb = {
  id: string;
  name: string;
  description: string | null;
  contributionAmount: string | number;
  frequency: string;
  totalPeriods: number;
  currentPeriod: number;
  status: string;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  _count?: {
    memberships: number;
  };
};

type Membership = {
  id: string;
  shares: string | number;
  status: string;
  equb: {
    id: string;
    name: string;
    contributionAmount: string | number;
    frequency: string;
  };
};

export default function EqubsScreen() {
  const [equbs, setEqubs] = useState<Equb[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState("");

  const loadEqubs = useCallback(async () => {
    try {
      setErrorMessage("");

      const [equbResponse, membershipResponse] = await Promise.all([
        getEqubs(),
        getMyMemberships(),
      ]);

      setEqubs(equbResponse.equbs || []);
      setMemberships(membershipResponse.memberships || []);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Secure connection failed. Could not load Equbs.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadEqubs();
  }, [loadEqubs]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadEqubs();
  };

  const getMembershipForEqub = (equbId: string) => {
    return memberships.find(
      (membership) => membership.equb.id === equbId
    );
  };

  const handleJoin = async (equbId: string) => {
    try {
      setJoiningId(equbId);
      setErrorMessage("");

      await requestToJoinEqub(equbId, 1);
      await loadEqubs();
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to process your request.");
      }
    } finally {
      setJoiningId(null);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#18181b" />
        <Text className="mt-4 text-sm font-medium text-gray-500">
          Syncing your Equbs...
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: 24,
          paddingTop: 60, // Adjust based on your safe area needs
          paddingBottom: 40,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#18181b"
          />
        }
      >
        {/* Header */}
        <View className="mb-8">
          <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl bg-white border border-gray-100 shadow-sm">
            <Wallet size={24} color="#18181b" strokeWidth={2.5} />
          </View>
          <Text className="text-3xl font-bold tracking-tight text-zinc-900">
            Available Equbs
          </Text>
          <Text className="mt-2 text-base leading-6 text-gray-500">
            Find the right saving circle and request to become a member.
          </Text>
        </View>

        {/* Error Banner */}
        {errorMessage ? (
          <View className="mb-6 rounded-2xl bg-red-50 p-4 border border-red-100">
            <Text className="text-sm font-medium text-red-600">
              {errorMessage}
            </Text>
          </View>
        ) : null}

        {/* Empty state */}
        {equbs.length === 0 ? (
          <View className="items-center rounded-3xl bg-white p-8 border border-gray-100 shadow-sm">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-gray-50 mb-4">
              <Users size={32} color="#9ca3af" />
            </View>
            <Text className="text-lg font-bold text-zinc-900">
              No Equbs available
            </Text>
            <Text className="mt-2 text-center text-sm leading-5 text-gray-500">
              There are currently no active Equbs available to join. Check back later.
            </Text>
          </View>
        ) : (
          equbs.map((equb) => {
            const membership = getMembershipForEqub(equb.id);
            const isPending = membership?.status === "PENDING";
            const isActive = membership?.status === "ACTIVE";
            const isJoining = joiningId === equb.id;

            return (
              <View
                key={equb.id}
                className="mb-6 rounded-3xl bg-white p-5 border border-gray-100 shadow-sm"
              >
                {/* Equb title & Icon */}
                <View className="flex-row items-start justify-between mb-5">
                  <View className="flex-1 pr-4">
                    <Text className="text-xl font-bold tracking-tight text-zinc-900">
                      {equb.name}
                    </Text>
                    {equb.description ? (
                      <Text className="mt-1.5 text-sm leading-5 text-gray-500">
                        {equb.description}
                      </Text>
                    ) : null}
                  </View>
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 border border-gray-100">
                    <Users size={20} color="#18181b" />
                  </View>
                </View>

                {/* Financial Details (Receipt Style) */}
                <View className="rounded-2xl bg-gray-50 p-4 border border-gray-100 mb-5">
                  <View className="flex-row justify-between items-center mb-3 pb-3 border-b border-gray-200/60">
                    <Text className="text-sm font-medium text-gray-500">
                      Contribution
                    </Text>
                    <Text className="text-base font-bold text-zinc-900">
                      {equb.currency} {Number(equb.contributionAmount).toLocaleString()}
                    </Text>
                  </View>

                  <View className="flex-row justify-between items-center mb-3 pb-3 border-b border-gray-200/60">
                    <Text className="text-sm font-medium text-gray-500">
                      Frequency
                    </Text>
                    <Text className="text-sm font-semibold text-zinc-800 capitalize">
                      {equb.frequency.toLowerCase()}
                    </Text>
                  </View>

                  <View className="flex-row justify-between items-center mb-3 pb-3 border-b border-gray-200/60">
                    <Text className="text-sm font-medium text-gray-500">
                      Duration
                    </Text>
                    <Text className="text-sm font-semibold text-zinc-800">
                      {equb.totalPeriods} periods
                    </Text>
                  </View>

                  {equb._count && (
                    <View className="flex-row justify-between items-center">
                      <Text className="text-sm font-medium text-gray-500">
                        Active Members
                      </Text>
                      <Text className="text-sm font-semibold text-zinc-800">
                        {equb._count.memberships}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Actions */}
                <View>
                  {isPending ? (
                    <View className="flex-row items-center justify-center rounded-2xl bg-amber-50 border border-amber-100 py-4">
                      <Clock size={18} color="#b45309" className="mr-2" />
                      <Text className="font-bold text-amber-700">
                        Request Pending
                      </Text>
                    </View>
                  ) : isActive ? (
                    <Pressable
                      onPress={() => router.push(`/equb/${equb.id}`)}
                      className="flex-row items-center justify-center rounded-2xl bg-zinc-900 active:bg-zinc-800 py-4"
                    >
                      <Text className="mr-2 text-base font-bold text-white">
                        Open Equb
                      </Text>
                      <ArrowRight size={20} color="#ffffff" />
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => handleJoin(equb.id)}
                      disabled={isJoining}
                      className={`flex-row items-center justify-center rounded-2xl bg-zinc-900 py-4 ${
                        isJoining ? "opacity-70" : "active:bg-zinc-800"
                      }`}
                    >
                      {isJoining ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text className="text-base font-bold text-white">
                          Request to Join
                        </Text>
                      )}
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}