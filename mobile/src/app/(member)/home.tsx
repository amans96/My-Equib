
import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import {
  Bell,
  ChevronRight,
  Clock3,
  CreditCard,
  FileText,
  Gift,
  Trophy,
  Users,
} from "lucide-react-native";
import { router } from "expo-router";

const HomeScreen = () => {
  const equbs = [
    {
      id: "2c1ba2fc-1e55-4685-aa08-ac6d22da98ec",
      name: "Burger Equb",
      contribution: "ETB 6,000",
      frequency: "Weekly",
      period: "4 / 13",
      paymentStatus: "Paid",
    },
    {
      id: "family-monthly",
      name: "Family Monthly Equb",
      contribution: "ETB 5,000",
      frequency: "Monthly",
      period: "2 / 12",
      paymentStatus: "Pending",
    },
  ];

  const quickActions = [
    {
      title: "Payments",
      subtitle: "Manage your payments",
      icon: CreditCard,
      route: "/payments",
    },
    {
      title: "Lottery",
      subtitle: "View draws & winners",
      icon: Trophy,
      route: "/lottery",
    },
    {
      title: "Receipts",
      subtitle: "View your receipts",
      icon: FileText,
      route: "/receipts",
    },
    {
      title: "History",
      subtitle: "See your activity",
      icon: Clock3,
      route: "/history",
    },
  ];

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Header */}
        <View className="px-5 pt-14 pb-5">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-sm font-medium text-slate-500">
                Welcome back
              </Text>

              <Text className="mt-1 text-2xl font-bold text-slate-900">
                Good morning 👋
              </Text>
            </View>

    <TouchableOpacity
  className="h-11 w-11 items-center justify-center rounded-full bg-white"
>

              <Bell size={21} color="#0f172a" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary */}
        <View className="px-5">
          <View className="rounded-3xl bg-slate-900 p-5">
            <View className="flex-row items-center">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                <Users size={21} color="#ffffff" />
              </View>

              <View className="ml-3">
                <Text className="text-sm text-slate-300">
                  Active Equbs
                </Text>

                <Text className="mt-1 text-2xl font-bold text-white">
                  {equbs.length}
                </Text>
              </View>
            </View>

            <View className="mt-5 flex-row">
              <View className="flex-1">
                <Text className="text-xs text-slate-400">
                  Next payment
                </Text>

                <Text className="mt-1 text-lg font-bold text-white">
                  ETB 6,000
                </Text>
              </View>

              <View className="flex-1">
                <Text className="text-xs text-slate-400">
                  Next lottery
                </Text>

                <Text className="mt-1 text-lg font-bold text-white">
                  Period 5
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* My Equbs */}
        <View className="mt-7 px-5">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-xl font-bold text-slate-900">
              My Equbs
            </Text>

            <TouchableOpacity onPress={() => router.push("/equbs")}>
              <Text className="font-semibold text-slate-700">
                View all
              </Text>
            </TouchableOpacity>
          </View>

          {equbs.map((equb) => (
            <TouchableOpacity
              key={equb.id}
              activeOpacity={0.8}
              onPress={() => router.push(`/equb/${equb.id}`)}
              className="mb-4 rounded-3xl bg-white p-5"
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <Text className="text-lg font-bold text-slate-900">
                    {equb.name}
                  </Text>

                  <Text className="mt-1 text-sm text-slate-500">
                    {equb.contribution} · {equb.frequency}
                  </Text>
                </View>

                <ChevronRight size={21} color="#64748b" />
              </View>

              <View className="mt-5">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-slate-500">
                    Current period
                  </Text>

                  <Text className="text-sm font-bold text-slate-900">
                    {equb.period}
                  </Text>
                </View>

                <View className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <View
                    className="h-full rounded-full bg-slate-900"
                    style={{
                      width: `${(Number(equb.period.split("/")[0]) /
                        Number(equb.period.split("/")[1])) *
                        100}%`,
                    }}
                  />
                </View>
              </View>

              <View className="mt-5 flex-row items-center justify-between border-t border-slate-100 pt-4">
                <Text className="text-sm text-slate-500">
                  Payment status
                </Text>

                <View
                  className={`rounded-full px-3 py-1 ${
                    equb.paymentStatus === "Paid"
                      ? "bg-slate-100"
                      : "bg-amber-50"
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      equb.paymentStatus === "Paid"
                        ? "text-slate-700"
                        : "text-amber-700"
                    }`}
                  >
                    {equb.paymentStatus}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Actions */}
        <View className="mt-3 px-5">
          <Text className="mb-4 text-xl font-bold text-slate-900">
            Quick Access
          </Text>

          <View className="flex-row flex-wrap justify-between">
            {quickActions.map((action) => {
              const Icon = action.icon;

              return (
                <TouchableOpacity
                  key={action.title}
                  activeOpacity={0.8}
                  onPress={() => router.push(action.route as any)}
                  className="mb-4 w-[48%] rounded-3xl bg-white p-5"
                >
                  <View className="h-11 w-11 items-center justify-center rounded-2xl bg-slate-100">
                    <Icon size={21} color="#0f172a" />
                  </View>

                  <Text className="mt-4 text-base font-bold text-slate-900">
                    {action.title}
                  </Text>

                  <Text className="mt-1 text-xs leading-5 text-slate-500">
                    {action.subtitle}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Upcoming */}
        <View className="mt-2 px-5">
          <View className="rounded-3xl bg-white p-5">
            <View className="flex-row items-center">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-slate-100">
                <Gift size={21} color="#0f172a" />
              </View>

              <View className="ml-3 flex-1">
                <Text className="text-base font-bold text-slate-900">
                  Upcoming payment
                </Text>

                <Text className="mt-1 text-sm text-slate-500">
                  Burger Equb · Due Oct 8
                </Text>
              </View>

              <Text className="text-base font-bold text-slate-900">
                ETB 6,000
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default HomeScreen;

