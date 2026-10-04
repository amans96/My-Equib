
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Upload,
} from "lucide-react-native";

import {
  getEqubs,
  getMyMemberships,
} from "../../../services/equb.service";

import { apiRequest } from "../../../services/api";

type Equb = {
  id: string;
  name: string;
  contributionAmount: string | number;
  frequency: string;
  currency: string;
  totalPeriods: number;
  currentPeriod: number;
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

type PaymentPeriod = {
  id: string;
  periodNumber: number;
  startDate: string;
  dueDate: string;
  closedAt?: string | null;
  status: string;
  expectedAmount: string | number;
};

type ReceiptState = {
  uri: string;
  name: string;
  type: string;
};

export default function PaymentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [equb, setEqub] = useState<Equb | null>(null);
  const [membership, setMembership] =
    useState<Membership | null>(null);

  const [periods, setPeriods] =
    useState<PaymentPeriod[]>([]);

  const [selectedReceipt, setSelectedReceipt] =
    useState<ReceiptState | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const loadPaymentData = useCallback(async () => {
    try {
      setErrorMessage("");

      if (!id) {
        throw new Error("Equb ID is missing.");
      }

      const [
        equbResponse,
        membershipResponse,
        periodsResponse,
      ] = await Promise.all([
        getEqubs(),
        getMyMemberships(),
        apiRequest<{ periods: PaymentPeriod[] }>(
          `/equbs/${id}/periods`
        ),
      ]);

      const foundEqub = (equbResponse.equbs || []).find(
        (item: Equb) => item.id === id
      );

      const foundMembership = (
        membershipResponse.memberships || []
      ).find(
        (item: Membership) => item.equb.id === id
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
          "Your membership is not active."
        );
      }

      setEqub(foundEqub);
      setMembership(foundMembership);

      setPeriods(periodsResponse.periods || []);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(
          "Failed to load payment information."
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadPaymentData();
  }, [loadPaymentData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadPaymentData();
  };

  const pickReceipt = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission required",
          "Please allow photo library access to upload your receipt."
        );
        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 0.8,
        });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];

      setSelectedReceipt({
        uri: asset.uri,
        name:
          asset.fileName ||
          `receipt-${Date.now()}.jpg`,
        type: asset.mimeType || "image/jpeg",
      });
    } catch {
      Alert.alert(
        "Error",
        "Could not select the receipt image."
      );
    }
  };

  const takeReceiptPhoto = async () => {
    try {
      const permission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission required",
          "Please allow camera access to take a receipt photo."
        );
        return;
      }

      const result =
        await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          quality: 0.8,
        });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];

      setSelectedReceipt({
        uri: asset.uri,
        name:
          asset.fileName ||
          `receipt-${Date.now()}.jpg`,
        type: asset.mimeType || "image/jpeg",
      });
    } catch {
      Alert.alert(
        "Error",
        "Could not take the receipt photo."
      );
    }
  };

  const uploadReceipt = async (periodId: string) => {
    if (!selectedReceipt) {
      Alert.alert(
        "Receipt required",
        "Please select or take a photo of your payment receipt."
      );
      return;
    }

    try {
      setUploading(true);
      setErrorMessage("");

      const formData = new FormData();

      formData.append(
        "receipt",
        {
          uri: selectedReceipt.uri,
          name: selectedReceipt.name,
          type: selectedReceipt.type,
        } as any
      );

      await apiRequest(
        `/payment-periods/${periodId}/receipts`,
        {
          method: "POST",
          body: formData,
        }
      );

      setSelectedReceipt(null);

      Alert.alert(
        "Receipt submitted",
        "Your payment receipt has been uploaded successfully. It will now be processed and verified."
      );

      await loadPaymentData();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to upload receipt.";

      setErrorMessage(message);

      Alert.alert(
        "Upload failed",
        message
      );
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator
          size="large"
          color="#0f172a"
        />

        <Text className="mt-4 text-sm text-slate-500">
          Loading payments...
        </Text>
      </View>
    );
  }

  if (!equb || !membership) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 px-6">
        <Text className="text-xl font-bold text-slate-900">
          Unable to load payments
        </Text>

        <Text className="mt-2 text-center text-sm text-slate-500">
          {errorMessage || "Something went wrong."}
        </Text>

        <Pressable
          onPress={loadPaymentData}
          className="mt-6 rounded-xl bg-slate-900 px-8 py-4"
        >
          <Text className="font-bold text-white">
            Try Again
          </Text>
        </Pressable>
      </View>
    );
  }

  const openPeriods = periods.filter(
    (period) => period.status === "OPEN"
  );

  const currentPeriod =
    openPeriods.find(
      (period) =>
        period.periodNumber === equb.currentPeriod
    ) ||
    openPeriods[0] ||
    null;

  const amount =
    currentPeriod?.expectedAmount ??
    Number(equb.contributionAmount) *
      Number(membership.shares);

  const formatMoney = (
    value: string | number
  ) =>
    `${equb.currency} ${Number(value).toLocaleString(
      "en-US",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

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
          paddingBottom: 50,
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

          <Text className="text-sm font-medium text-slate-500">
            {equb.name}
          </Text>

          <Text className="mt-1 text-3xl font-bold text-slate-900">
            Payments
          </Text>

          <Text className="mt-2 text-sm leading-6 text-slate-500">
            Make your contribution by uploading your
            payment receipt.
          </Text>
        </View>

        {/* Error */}
        {errorMessage ? (
          <View className="mx-5 mb-5 rounded-2xl border border-red-200 bg-red-50 p-4">
            <Text className="text-sm font-medium leading-5 text-red-600">
              {errorMessage}
            </Text>
          </View>
        ) : null}

        {/* Current Payment */}
        {currentPeriod ? (
          <View className="mx-5 rounded-3xl bg-slate-900 p-6">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-medium text-slate-300">
                Current payment
              </Text>

              <View className="rounded-full bg-emerald-400/15 px-3 py-1">
                <Text className="text-xs font-bold text-emerald-300">
                  OPEN
                </Text>
              </View>
            </View>

            <Text className="mt-4 text-sm text-slate-400">
              Period {currentPeriod.periodNumber}
            </Text>

            <Text className="mt-1 text-3xl font-bold text-white">
              {formatMoney(amount)}
            </Text>

            <View className="mt-6 flex-row">
              <View className="flex-1">
                <Text className="text-xs text-slate-400">
                  Period starts
                </Text>

                <Text className="mt-2 font-semibold text-white">
                  {formatDate(
                    currentPeriod.startDate
                  )}
                </Text>
              </View>

              <View className="flex-1">
                <Text className="text-xs text-slate-400">
                  Due date
                </Text>

                <Text className="mt-2 font-semibold text-white">
                  {formatDate(
                    currentPeriod.dueDate
                  )}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View className="mx-5 rounded-3xl bg-white p-6">
            <Clock3
              size={30}
              color="#64748b"
            />

            <Text className="mt-4 text-xl font-bold text-slate-900">
              No open payment
            </Text>

            <Text className="mt-2 text-sm leading-6 text-slate-500">
              There is currently no payment period open
              for this Equb.
            </Text>
          </View>
        )}

        {/* Receipt Upload */}
        {currentPeriod ? (
          <View className="mx-5 mt-6 rounded-3xl bg-white p-5">
            <View className="flex-row items-center">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-slate-100">
                <Upload
                  size={21}
                  color="#334155"
                />
              </View>

              <View className="ml-3 flex-1">
                <Text className="font-bold text-slate-900">
                  Payment Receipt
                </Text>

                <Text className="mt-1 text-xs text-slate-500">
                  Upload proof of your payment
                </Text>
              </View>
            </View>

            {selectedReceipt ? (
              <View className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                <Image
                  source={{
                    uri: selectedReceipt.uri,
                  }}
                  className="h-64 w-full"
                  resizeMode="cover"
                />

                <View className="p-4">
                  <Text
                    numberOfLines={1}
                    className="font-semibold text-slate-900"
                  >
                    {selectedReceipt.name}
                  </Text>

                  <Pressable
                    onPress={() =>
                      setSelectedReceipt(null)
                    }
                    className="mt-3"
                  >
                    <Text className="text-sm font-semibold text-red-600">
                      Remove image
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <View className="mt-5 flex-row">
              <Pressable
                onPress={pickReceipt}
                disabled={uploading}
                className="mr-2 flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 py-4"
              >
                <Text className="font-bold text-slate-800">
                  Choose Photo
                </Text>
              </Pressable>

              <Pressable
                onPress={takeReceiptPhoto}
                disabled={uploading}
                className="ml-2 flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 py-4"
              >
                <Text className="font-bold text-slate-800">
                  Take Photo
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() =>
                uploadReceipt(currentPeriod.id)
              }
              disabled={
                uploading || !selectedReceipt
              }
              className={`mt-4 items-center justify-center rounded-2xl bg-slate-900 py-4 ${
                uploading || !selectedReceipt
                  ? "opacity-40"
                  : ""
              }`}
            >
              {uploading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="font-bold text-white">
                  Submit Payment Receipt
                </Text>
              )}
            </Pressable>

            <View className="mt-4 rounded-2xl bg-amber-50 p-4">
              <Text className="text-xs leading-5 text-amber-700">
                Make sure the receipt clearly shows the
                transaction amount, date, sender and
                transaction reference. The system will
                process the receipt automatically.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Payment Periods */}
        <View className="mt-8 px-5">
          <Text className="text-xl font-bold text-slate-900">
            Payment Periods
          </Text>

          <Text className="mt-1 text-sm text-slate-500">
            Your Equb payment schedule.
          </Text>

          <View className="mt-4">
            {periods.length === 0 ? (
              <View className="rounded-2xl bg-white p-5">
                <Text className="text-sm text-slate-500">
                  No payment periods found.
                </Text>
              </View>
            ) : (
              periods.map((period) => {
                const isOpen =
                  period.status === "OPEN";

                const isCurrent =
                  period.id === currentPeriod?.id;

                return (
                  <View
                    key={period.id}
                    className="mb-3 rounded-2xl bg-white p-5"
                  >
                    <View className="flex-row items-center">
                      <View className="h-11 w-11 items-center justify-center rounded-xl bg-slate-100">
                        <CalendarDays
                          size={20}
                          color="#334155"
                        />
                      </View>

                      <View className="ml-3 flex-1">
                        <Text className="font-bold text-slate-900">
                          Period {period.periodNumber}
                        </Text>

                        <Text className="mt-1 text-xs text-slate-500">
                          {formatDate(
                            period.startDate
                          )}{" "}
                          -{" "}
                          {formatDate(
                            period.dueDate
                          )}
                        </Text>
                      </View>

                      <View
                        className={`rounded-full px-3 py-1 ${
                          isOpen
                            ? "bg-emerald-50"
                            : "bg-slate-100"
                        }`}
                      >
                        <Text
                          className={`text-xs font-bold ${
                            isOpen
                              ? "text-emerald-700"
                              : "text-slate-500"
                          }`}
                        >
                          {period.status}
                        </Text>
                      </View>
                    </View>

                    <View className="mt-4 flex-row items-center justify-between border-t border-slate-100 pt-4">
                      <Text className="text-sm text-slate-500">
                        Expected
                      </Text>

                      <Text className="font-bold text-slate-900">
                        {formatMoney(
                          period.expectedAmount
                        )}
                      </Text>
                    </View>

                    {isCurrent ? (
                      <View className="mt-3 flex-row items-center">
                        <CheckCircle2
                          size={15}
                          color="#16a34a"
                        />

                        <Text className="ml-2 text-xs font-semibold text-green-600">
                          Current payment period
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

