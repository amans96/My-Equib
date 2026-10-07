
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
  XCircle,
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

type Receipt = {
  id: string;
  status: string;
  ocrProcessed: boolean;
  createdAt: string;
};

type Payment = {
  id: string;
  paidAmount: string | number;
  status: string;
  paidAt?: string | null;
  verifiedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  receipt?: Receipt | null;
};

type PaymentPeriod = {
  id: string;
  periodNumber: number;
  startDate: string;
  dueDate: string;
  closedAt?: string | null;
  status: string;
  expectedAmount: string | number;

  payment: Payment | null;
  paymentStatus: string;
  canUploadReceipt: boolean;
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

  const [selectedPeriodId, setSelectedPeriodId] =
    useState<string | null>(null);

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

        // IMPORTANT:
        // This is the member-specific endpoint.
        apiRequest<{
          periods: PaymentPeriod[];
        }>(`/equbs/${id}/my-periods`),
      ]);

      const foundEqub = (
        equbResponse.equbs || []
      ).find(
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
  
const handleBack = () => {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/(member)/equbs");
  }
};



  const pickReceipt = async (periodId: string) => {
    try {
      setSelectedPeriodId(periodId);

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
        setSelectedPeriodId(null);
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
      setSelectedPeriodId(null);

      Alert.alert(
        "Error",
        "Could not select the receipt image."
      );
    }
  };

  const takeReceiptPhoto = async (
    periodId: string
  ) => {
    try {
      setSelectedPeriodId(periodId);

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
        setSelectedPeriodId(null);
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
      setSelectedPeriodId(null);

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
      setSelectedPeriodId(null);

      Alert.alert(
        "Receipt submitted",
        "Your payment receipt has been uploaded successfully. It is now waiting for verification."
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

  /*
   * Find the current OPEN period.
   */
  const openPeriods = periods.filter(
    (period) => period.status === "OPEN"
  );

  const currentPeriod =
    openPeriods.find(
      (period) =>
        period.periodNumber ===
        equb.currentPeriod
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

  const getPaymentStatusLabel = (
    period: PaymentPeriod
  ) => {
    switch (period.paymentStatus) {
      case "VERIFIED":
        return "PAID";

      case "PENDING":
      case "SUBMITTED":
      case "UNDER_REVIEW":
      case "NEEDS_REVIEW":
        return "PENDING";

      case "REJECTED":
        return "REJECTED";

      default:
        return "NOT PAID";
    }
  };

  const getPaymentStatusClasses = (
    period: PaymentPeriod
  ) => {
    switch (period.paymentStatus) {
      case "VERIFIED":
        return {
          container: "bg-emerald-50",
          text: "text-emerald-700",
        };

      case "PENDING":
      case "SUBMITTED":
      case "UNDER_REVIEW":
      case "NEEDS_REVIEW":
        return {
          container: "bg-amber-50",
          text: "text-amber-700",
        };

      case "REJECTED":
        return {
          container: "bg-red-50",
          text: "text-red-700",
        };

      default:
        return {
          container: "bg-slate-100",
          text: "text-slate-500",
        };
    }
  };

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
  onPress={handleBack}
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
            Track your contributions and submit
            payment receipts.
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

            {/* Current payment status */}

            <View className="mt-6 border-t border-slate-700 pt-5">
              {currentPeriod.paymentStatus ===
              "VERIFIED" ? (
                <View className="flex-row items-center">
                  <CheckCircle2
                    size={18}
                    color="#34d399"
                  />

                  <Text className="ml-2 font-semibold text-emerald-300">
                    Payment verified
                  </Text>
                </View>
              ) : currentPeriod.paymentStatus ===
                "REJECTED" ? (
                <View>
                  <View className="flex-row items-center">
                    <XCircle
                      size={18}
                      color="#f87171"
                    />

                    <Text className="ml-2 font-semibold text-red-300">
                      Payment rejected
                    </Text>
                  </View>

                  {currentPeriod.payment
                    ?.rejectionReason ? (
                    <Text className="mt-2 text-xs leading-5 text-slate-400">
                      {
                        currentPeriod.payment
                          .rejectionReason
                      }
                    </Text>
                  ) : null}
                </View>
              ) : currentPeriod.payment ? (
                <View className="flex-row items-center">
                  <Clock3
                    size={18}
                    color="#fbbf24"
                  />

                  <Text className="ml-2 font-semibold text-amber-300">
                    Payment pending verification
                  </Text>
                </View>
              ) : (
                <Text className="font-semibold text-slate-300">
                  Payment not submitted
                </Text>
              )}
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
              There is currently no payment period
              open for this Equb.
            </Text>
          </View>
        )}

        {/* Receipt Upload */}

        {currentPeriod &&
        currentPeriod.canUploadReceipt ? (
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
                    onPress={() => {
                      setSelectedReceipt(null);
                      setSelectedPeriodId(null);
                    }}
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
                onPress={() =>
                  pickReceipt(currentPeriod.id)
                }
                disabled={uploading}
                className="mr-2 flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 py-4"
              >
                <Text className="font-bold text-slate-800">
                  Choose Photo
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  takeReceiptPhoto(
                    currentPeriod.id
                  )
                }
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
                uploading ||
                !selectedReceipt ||
                selectedPeriodId !==
                  currentPeriod.id
              }
              className={`mt-4 items-center justify-center rounded-2xl bg-slate-900 py-4 ${
                uploading ||
                !selectedReceipt ||
                selectedPeriodId !==
                  currentPeriod.id
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
                Make sure the receipt clearly shows
                the transaction amount, date, sender
                and transaction reference. The
                receipt will be reviewed before your
                payment is marked as verified.
              </Text>
            </View>
          </View>
        ) : currentPeriod?.paymentStatus ===
          "VERIFIED" ? (
          <View className="mx-5 mt-6 rounded-3xl bg-emerald-50 p-5">
            <View className="flex-row items-center">
              <CheckCircle2
                size={22}
                color="#16a34a"
              />

              <Text className="ml-3 font-bold text-emerald-800">
                Payment verified
              </Text>
            </View>

            <Text className="mt-2 text-sm leading-5 text-emerald-700">
              Your payment for this period has been
              approved by the Equb administrator.
            </Text>
          </View>
        ) : currentPeriod?.payment ? (
          <View className="mx-5 mt-6 rounded-3xl bg-amber-50 p-5">
            <View className="flex-row items-center">
              <Clock3
                size={22}
                color="#d97706"
              />

              <Text className="ml-3 font-bold text-amber-800">
                Payment under review
              </Text>
            </View>

            <Text className="mt-2 text-sm leading-5 text-amber-700">
              Your receipt has been submitted and is
              waiting for administrator verification.
            </Text>
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
                  period.id ===
                  currentPeriod?.id;

                const statusClasses =
                  getPaymentStatusClasses(
                    period
                  );

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
                          Period{" "}
                          {period.periodNumber}
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
                        className={`rounded-full px-3 py-1 ${statusClasses.container}`}
                      >
                        <Text
                          className={`text-xs font-bold ${statusClasses.text}`}
                        >
                          {getPaymentStatusLabel(
                            period
                          )}
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

                    {period.paymentStatus ===
                    "VERIFIED" ? (
                      <View className="mt-3 flex-row items-center">
                        <CheckCircle2
                          size={15}
                          color="#16a34a"
                        />

                        <Text className="ml-2 text-xs font-semibold text-green-600">
                          Payment verified
                        </Text>
                      </View>
                    ) : period.paymentStatus ===
                      "REJECTED" ? (
                      <View className="mt-3 flex-row items-center">
                        <XCircle
                          size={15}
                          color="#dc2626"
                        />

                        <Text className="ml-2 text-xs font-semibold text-red-600">
                          Receipt rejected — upload
                          a new receipt
                        </Text>
                      </View>
                    ) : period.payment ? (
                      <View className="mt-3 flex-row items-center">
                        <Clock3
                          size={15}
                          color="#d97706"
                        />

                        <Text className="ml-2 text-xs font-semibold text-amber-600">
                          Waiting for verification
                        </Text>
                      </View>
                    ) : period.canUploadReceipt ? (
                      <View className="mt-3">
                        <Text className="text-xs font-semibold text-slate-500">
                          Payment not submitted
                        </Text>
                      </View>
                    ) : null}

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

                    {isOpen &&
                    period.paymentStatus !==
                      "VERIFIED" &&
                    period.canUploadReceipt ? (
                      <Pressable
                        onPress={() => {
                          setSelectedPeriodId(
                            period.id
                          );

                          if (
                            selectedReceipt
                          ) {
                            Alert.alert(
                              "Receipt selected",
                              "Your selected receipt is ready to submit for this period."
                            );
                          } else {
                            Alert.alert(
                              "Upload receipt",
                              "Choose how you want to provide your payment receipt.",
                              [
                                {
                                  text: "Choose Photo",
                                  onPress: () =>
                                    pickReceipt(
                                      period.id
                                    ),
                                },
                                {
                                  text: "Take Photo",
                                  onPress: () =>
                                    takeReceiptPhoto(
                                      period.id
                                    ),
                                },
                                {
                                  text: "Cancel",
                                  style: "cancel",
                                },
                              ]
                            );
                          }
                        }}
                        className="mt-4 items-center justify-center rounded-2xl bg-slate-900 py-3"
                      >
                        <Text className="font-bold text-white">
                          {period.paymentStatus ===
                          "REJECTED"
                            ? "Upload New Receipt"
                            : "Upload Receipt"}
                        </Text>
                      </Pressable>
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

