
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Clock3,
  CreditCard,
  FileText,
  History,
  RefreshCw,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react-native";

import {
  getEqubs,
  getMyMemberships,
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
  totalPaid?: string | number;
  missedPayments?: number;
  equb: {
    id: string;
    name: string;
    contributionAmount: string | number;
    frequency: string;
  };
};

export default function EqubHomeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [equb, setEqub] = useState<Equb | null>(null);
  const [membership, setMembership] =
    useState<Membership | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadEqubDetails = useCallback(async () => {
    try {
      setErrorMessage("");

      if (!id) {
        throw new Error("Equb ID is missing.");
      }

      const [
        equbResponse,
        membershipResponse,
      ] = await Promise.all([
        getEqubs(),
        getMyMemberships(),
      ]);

      const foundEqub = (
        equbResponse.equbs || []
      ).find(
        (item: Equb) => item.id === id
      );

      const foundMembership = (
        membershipResponse.memberships || []
      ).find(
        (item: Membership) =>
          item.equb.id === id
      );

      if (!foundEqub) {
        throw new Error("Equb not found.");
      }

      if (!foundMembership) {
        throw new Error(
          "You are not a member of this Equb."
        );
      }

      if (foundMembership.status !== "ACTIVE") {
        throw new Error(
          "Your membership is not active yet."
        );
      }

      setEqub(foundEqub);
      setMembership(foundMembership);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to load Equb details."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadEqubDetails();
  }, [loadEqubDetails]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadEqubDetails();
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator
          size="large"
          color="#0f172a"
        />

        <Text className="mt-4 text-sm text-slate-500">
          Loading your Equb...
        </Text>
      </View>
    );
  }

  if (errorMessage || !equb || !membership) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 px-6">
        <ShieldCheck
          size={42}
          color="#64748b"
        />

        <Text className="mt-4 text-xl font-bold text-slate-900">
          Unable to open Equb
        </Text>

        <Text className="mt-2 text-center text-sm leading-6 text-slate-500">
          {errorMessage ||
            "Something went wrong."}
        </Text>

        <Pressable
          onPress={loadEqubDetails}
          className="mt-6 rounded-xl bg-slate-900 px-8 py-4"
        >
          <Text className="font-bold text-white">
            Try Again
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          className="mt-5"
        >
          <Text className="font-semibold text-slate-600">
            Go Back
          </Text>
        </Pressable>
      </View>
    );
  }

  const contribution = Number(
    equb.contributionAmount
  );

  const shares = Number(
    membership.shares
  );

  const memberContribution =
    contribution * shares;

  const totalPeriods = Math.max(
    equb.totalPeriods,
    1
  );

  const currentPeriod = Math.min(
    Math.max(equb.currentPeriod, 0),
    totalPeriods
  );

  const progress =
    (currentPeriod / totalPeriods) * 100;

  const formatMoney = (amount: number) =>
    `${equb.currency} ${amount.toLocaleString(
      "en-US",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;

  /*
   * Each card now has its own Expo Router route.
   *
   * These files should exist:
   *
   * src/app/equb/[id]/payments.tsx
   * src/app/equb/[id]/lottery.tsx
   * src/app/equb/[id]/receipts.tsx
   * src/app/equb/[id]/history.tsx
   */
  const quickLinks = [
    {
      title: "Payments",
      description:
        "Contributions and payment status",
      icon: CreditCard,
      route: `/equb/${id}/payments`,
    },
    {
      title: "Lottery",
      description:
        "Draws and previous winners",
      icon: Trophy,
      route: `/equb/${id}/lottery`,
    },
    {
      title: "Receipts",
      description:
        "Your uploaded payment receipts",
      icon: FileText,
      route: `/equb/${id}/receipts`,
    },
    {
      title: "History",
      description:
        "Your Equb activity and records",
      icon: History,
      route: `/equb/${id}/history`,
    },
  ];

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
        contentContainerStyle={{
          paddingBottom: 40,
        }}
      >
        {/* Header */}
        <View className="px-5 pb-5 pt-14">
          <Pressable
            onPress={() => router.back()}
            className="mb-6 h-10 w-10 items-center justify-center rounded-full bg-white"
          >
            <ArrowLeft
              size={22}
              color="#0f172a"
            />
          </Pressable>

          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-sm font-medium text-slate-500">
                Welcome to your Equb
              </Text>

              <Text className="mt-1 text-3xl font-bold text-slate-900">
                {equb.name}
              </Text>
            </View>

            <Pressable
              onPress={handleRefresh}
              className="h-11 w-11 items-center justify-center rounded-full bg-white"
            >
              <RefreshCw
                size={19}
                color="#334155"
              />
            </Pressable>
          </View>

          {equb.description ? (
            <Text className="mt-2 text-sm leading-6 text-slate-500">
              {equb.description}
            </Text>
          ) : null}
        </View>

        {/* Main Equb Card */}
        <View className="mx-5 rounded-3xl bg-slate-900 p-6">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-medium text-slate-300">
              Your contribution
            </Text>

            <View className="rounded-full bg-white/10 px-3 py-1">
              <Text className="text-xs font-bold text-white">
                {equb.status}
              </Text>
            </View>
          </View>

          <Text className="mt-3 text-3xl font-bold text-white">
            {formatMoney(memberContribution)}
          </Text>

          <Text className="mt-2 text-sm text-slate-300">
            {equb.frequency.toLowerCase()} contribution
          </Text>

          <View className="my-6 h-px bg-white/15" />

          <View className="flex-row justify-between">
            <View>
              <Text className="text-xs text-slate-400">
                My shares
              </Text>

              <Text className="mt-2 text-xl font-bold text-white">
                {shares.toFixed(2)}
              </Text>
            </View>

            <View>
              <Text className="text-xs text-slate-400">
                Total periods
              </Text>

              <Text className="mt-2 text-xl font-bold text-white">
                {equb.totalPeriods}
              </Text>
            </View>

            <View>
              <Text className="text-xs text-slate-400">
                Members
              </Text>

              <Text className="mt-2 text-xl font-bold text-white">
                {equb._count?.memberships ?? "—"}
              </Text>
            </View>
          </View>
        </View>

        {/* Equb Progress */}
        <View className="mx-5 mt-6 rounded-3xl bg-white p-5">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-lg font-bold text-slate-900">
                Equb Progress
              </Text>

              <Text className="mt-1 text-sm text-slate-500">
                Your Equb journey
              </Text>
            </View>

            <View className="rounded-xl bg-slate-100 p-3">
              <CalendarDays
                size={22}
                color="#334155"
              />
            </View>
          </View>

          <View className="mt-6 flex-row items-center justify-between">
            <Text className="text-sm text-slate-500">
              Current period
            </Text>

            <Text className="font-bold text-slate-900">
              {currentPeriod} /{" "}
              {equb.totalPeriods}
            </Text>
          </View>

          <View className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
            <View
              className="h-full rounded-full bg-slate-900"
              style={{
                width: `${progress}%`,
              }}
            />
          </View>

          <Text className="mt-3 text-xs text-slate-500">
            {Math.round(progress)}% of the
            Equb periods completed
          </Text>
        </View>

        {/* Quick Access */}
        <View className="mt-8 px-5">
          <View className="mb-4">
            <Text className="text-xl font-bold text-slate-900">
              Manage Your Equb
            </Text>

            <Text className="mt-1 text-sm text-slate-500">
              Everything you need in one place.
            </Text>
          </View>

          <View className="flex-row flex-wrap justify-between">
            {quickLinks.map((item) => {
              const Icon = item.icon;

              return (
                <Pressable
                  key={item.title}
                  onPress={() =>
                    router.push(
                      item.route as any
                    )
                  }
                  className="mb-4 w-[48%] rounded-3xl bg-white p-5 active:opacity-70"
                >
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                    <Icon
                      size={23}
                      color="#0f172a"
                    />
                  </View>

                  <Text className="mt-4 text-base font-bold text-slate-900">
                    {item.title}
                  </Text>

                  <Text className="mt-2 min-h-10 text-xs leading-5 text-slate-500">
                    {item.description}
                  </Text>

                  <View className="mt-3 flex-row items-center">
                    <Text className="text-xs font-bold text-slate-700">
                      Explore
                    </Text>

                    <ChevronRight
                      size={15}
                      color="#334155"
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Membership Information */}
        <View className="mx-5 mt-2 rounded-3xl bg-white p-5">
          <View className="flex-row items-center">
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-slate-100">
              <Users
                size={21}
                color="#334155"
              />
            </View>

            <View className="ml-3 flex-1">
              <Text className="font-bold text-slate-900">
                Membership Information
              </Text>

              <Text className="mt-1 text-xs text-slate-500">
                Your membership is active
              </Text>
            </View>

            <View className="rounded-full bg-emerald-50 px-3 py-1">
              <Text className="text-xs font-bold text-emerald-700">
                ACTIVE
              </Text>
            </View>
          </View>

          <View className="mt-5 flex-row justify-between border-t border-slate-100 pt-4">
            <Text className="text-sm text-slate-500">
              Membership shares
            </Text>

            <Text className="text-sm font-bold text-slate-900">
              {shares.toFixed(2)}
            </Text>
          </View>

          {membership.totalPaid !==
          undefined ? (
            <View className="mt-4 flex-row justify-between">
              <Text className="text-sm text-slate-500">
                Total paid
              </Text>

              <Text className="text-sm font-bold text-slate-900">
                {formatMoney(
                  Number(
                    membership.totalPaid
                  )
                )}
              </Text>
            </View>
          ) : null}

          {membership.missedPayments !==
          undefined ? (
            <View className="mt-4 flex-row justify-between">
              <Text className="text-sm text-slate-500">
                Missed payments
              </Text>

              <Text className="text-sm font-bold text-slate-900">
                {membership.missedPayments}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Footer */}
        <View className="mt-6 items-center px-5">
          <Clock3
            size={18}
            color="#94a3b8"
          />

          <Text className="mt-2 text-center text-xs text-slate-400">
            Your Equb information is updated from
            your account.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

