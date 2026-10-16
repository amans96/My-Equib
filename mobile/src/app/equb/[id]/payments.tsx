
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
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
  Camera,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Image as ImageIcon,
  Upload,
  X,
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
  uploadedAt?: string;
  imageUrl?: string | null;
  originalFileName?: string | null;
};

type Payment = {
  id: string;
  expectedAmount?: string | number;
  allocatedAmount?: string | number | null;
  paidAmount?: string | number | null;
  status: string;
  paymentDate?: string | null;
  referenceNumber?: string | null;
  notes?: string | null;
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
  file?: any;
};

const NORMALIZED_PENDING_STATUSES = [
  "PENDING",
  "SUBMITTED",
  "UNDER_REVIEW",
  "NEEDS_REVIEW",
];
const canUploadToPeriod = (period: PaymentPeriod) => {
  if (period.status?.toUpperCase() === "CLOSED") {
    return false;
  }

  const paymentStatus = (
    period.paymentStatus || period.payment?.status || ""
  ).toUpperCase();

  // Never upload again after a verified payment or while waiting under review.
  if (
    paymentStatus === "VERIFIED" ||
    paymentStatus === "PENDING" ||
    paymentStatus === "SUBMITTED" ||
    paymentStatus === "UNDER_REVIEW"
  ) {
    return false;
  }

  // Existing submissions must be rejected or marked for review
  // before the member can submit another receipt.
  if (period.payment) {
    return ["REJECTED", "NEEDS_REVIEW"].includes(paymentStatus);
  }

  // If backend provided canUploadReceipt boolean, respect it
  if (typeof period.canUploadReceipt === "boolean") {
    return period.canUploadReceipt;
  }

  return true;
};

export default function PaymentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [equb, setEqub] = useState<Equb | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [periods, setPeriods] = useState<PaymentPeriod[]>([]);

  const [selectedReceipt, setSelectedReceipt] =
    useState<ReceiptState | null>(null);

  const [selectedPeriodId, setSelectedPeriodId] =
    useState<string | null>(null);

  const [pickerPeriodId, setPickerPeriodId] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingPeriodId, setUploadingPeriodId] =
    useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState("");

  // --------------------------------------------------
  // Load Equb, membership and every payment period
  // --------------------------------------------------

  const loadPaymentData = useCallback(async () => {
    try {
      setErrorMessage("");

      if (!id || typeof id !== "string") {
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
          `/equbs/${id}/my-periods`
        ),
      ]);

      const foundEqub = (equbResponse.equbs || []).find(
        (item: Equb) => item.id === id
      );

      const foundMembership = (
        membershipResponse.memberships || []
      ).find((item: Membership) => item.equb.id === id);

      if (!foundEqub) {
        throw new Error("Equb not found.");
      }

      if (!foundMembership) {
        throw new Error("You are not a member of this Equb.");
      }

      if (foundMembership.status !== "ACTIVE") {
        throw new Error("Your membership is not active.");
      }

      setEqub(foundEqub);
      setMembership(foundMembership);
      setPeriods(periodsResponse.periods || []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to load payment information."
      );
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

  // --------------------------------------------------
  // Receipt picker
  // --------------------------------------------------

  const openReceiptPicker = (periodId: string) => {
    const period = periods.find((item) => item.id === periodId);

    if (!period || !canUploadToPeriod(period)) {
      Alert.alert(
        "Upload unavailable",
        "You can upload a receipt only when this payment period is open and eligible for payment."
      );
      return;
    }

    setSelectedPeriodId(periodId);
    setPickerPeriodId(periodId);
  };

  const closeReceiptPicker = () => {
    if (!uploading) {
      setPickerPeriodId(null);
    }
  };

  const pickReceipt = async (periodId: string) => {
    try {
      const period = periods.find((item) => item.id === periodId);

      if (!period || !canUploadToPeriod(period)) {
        Alert.alert(
          "Upload unavailable",
          "This payment period is not open for receipt uploads."
        );
        setPickerPeriodId(null);
        return;
      }

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission required",
          "Please allow photo library access to upload your receipt."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      const uri = asset.uri;

      const extension = uri
        .split("?")[0]
        .split(".")
        .pop()
        ?.toLowerCase();

      const mimeType =
        asset.mimeType?.toLowerCase() ||
        (extension === "png"
          ? "image/png"
          : extension === "webp"
            ? "image/webp"
            : "image/jpeg");

      if (
        !["image/jpeg", "image/png", "image/webp"].includes(mimeType)
      ) {
        Alert.alert(
          "Unsupported image",
          "Please select a JPG, PNG, or WEBP receipt image."
        );
        return;
      }

      const fileExtension =
        mimeType === "image/png"
          ? "png"
          : mimeType === "image/webp"
            ? "webp"
            : "jpg";

      setSelectedReceipt({
        uri,
        name: asset.fileName || `receipt-${Date.now()}.${fileExtension}`,
        type: mimeType,
        file: (asset as any).file,
      });

      setSelectedPeriodId(periodId);
      setPickerPeriodId(null);
    } catch (error) {
      console.error("Select receipt error:", error);
      Alert.alert("Error", "Could not select the receipt image.");
    }
  };

  const takeReceiptPhoto = async (periodId: string) => {
    try {
      const period = periods.find((item) => item.id === periodId);

      if (!period || !canUploadToPeriod(period)) {
        Alert.alert(
          "Upload unavailable",
          "This payment period is not open for receipt uploads."
        );
        setPickerPeriodId(null);
        return;
      }

      const permission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission required",
          "Please allow camera access to take a receipt photo."
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];

      setSelectedReceipt({
        uri: asset.uri,
        name: asset.fileName || `receipt-${Date.now()}.jpg`,
        type: "image/jpeg",
        file: (asset as any).file,
      });

      setSelectedPeriodId(periodId);
      setPickerPeriodId(null);
    } catch (error) {
      console.error("Take receipt photo error:", error);
      Alert.alert("Error", "Could not take the receipt photo.");
    }
  };

  const removeSelectedReceipt = () => {
    if (uploading) {
      return;
    }

    setSelectedReceipt(null);
    setSelectedPeriodId(null);
  };

  // --------------------------------------------------
  // Upload receipt for the selected payment period
  // --------------------------------------------------

  const uploadReceipt = async (periodId: string) => {
    if (!selectedReceipt) {
      Alert.alert(
        "Receipt required",
        "Please select or take a photo of your payment receipt."
      );
      return;
    }

    if (selectedPeriodId !== periodId) {
      Alert.alert(
        "Period mismatch",
        "Please select a receipt for this payment period."
      );
      return;
    }

    const period = periods.find((item) => item.id === periodId);

    if (!period || !canUploadToPeriod(period)) {
      Alert.alert(
        "Upload unavailable",
        "This period is not open for receipt uploads. Refresh your payments and try again."
      );

      await loadPaymentData();
      return;
    }

    try {
      setUploading(true);
      setUploadingPeriodId(periodId);
      setErrorMessage("");

      const formData = new FormData();

      if (Platform.OS === "web") {
        let fileToUpload: any = selectedReceipt.file;

        if (!fileToUpload) {
          const response = await fetch(selectedReceipt.uri);
          const blob = await response.blob();
          const mimeType =
            selectedReceipt.type === "image/jpg"
              ? "image/jpeg"
              : selectedReceipt.type || blob.type || "image/jpeg";

          fileToUpload =
            typeof File !== "undefined"
              ? new File([blob], selectedReceipt.name, { type: mimeType })
              : blob;
        }

        formData.append("receipt", fileToUpload, selectedReceipt.name);
      } else {
        formData.append(
          "receipt",
          {
            uri: selectedReceipt.uri,
            name: selectedReceipt.name,
            type: selectedReceipt.type,
          } as any
        );
      }

      console.log("Receipt upload starting:", {
        platform: Platform.OS,
        periodId,
        fileName: selectedReceipt.name,
        mimeType: selectedReceipt.type,
        hasUri: Boolean(selectedReceipt.uri),
      });

      await apiRequest(
        `/payment-periods/${periodId}/receipts`,
        {
          method: "POST",
          body: formData,
        }
      );

      setSelectedReceipt(null);
      setSelectedPeriodId(null);
      setPickerPeriodId(null);

      Alert.alert(
        "Receipt submitted",
        `Your receipt for Period ${period.periodNumber} has been uploaded successfully and is waiting for verification.`
      );

      await loadPaymentData();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to upload receipt.";

      console.error("Receipt upload failed:", message);

      setErrorMessage(message);
      Alert.alert("Upload failed", message);
    } finally {
      setUploading(false);
      setUploadingPeriodId(null);
    }
  };

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------

  const formatMoney = (value: string | number) =>
    `${equb?.currency || ""} ${Number(value).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const formatDate = (date: string) => {
    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Date unavailable";
    }

    return parsedDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getPaymentStatusLabel = (period: PaymentPeriod) => {
    const status = period.paymentStatus?.toUpperCase();

    switch (status) {
      case "VERIFIED":
        return "PAID";

      case "REJECTED":
        return "REJECTED";

      case "PENDING":
      case "SUBMITTED":
      case "UNDER_REVIEW":
      case "NEEDS_REVIEW":
        return "PENDING";

      default:
        return "NOT PAID";
    }
  };

  const getPaymentStatusClasses = (period: PaymentPeriod) => {
    const status = period.paymentStatus?.toUpperCase();

    switch (status) {
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

  const selectedPeriod =
    periods.find((period) => period.id === selectedPeriodId) || null;

  const currentPeriod =
    (equb?.currentPeriod && equb.currentPeriod > 0
      ? periods.find((period) => period.periodNumber === equb.currentPeriod)
      : null) ||
    periods.find((period) => period.status?.toUpperCase() === "OPEN") ||
    periods.find((period) => canUploadToPeriod(period)) ||
    periods[0] ||
    null;

  const currentAmount = currentPeriod?.expectedAmount ??
    Number(equb?.contributionAmount || 0) *
    Number(membership?.shares || 1);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#0f172a" />

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
          onPress={() => {
            setLoading(true);
            loadPaymentData();
          }}
          className="mt-6 rounded-xl bg-slate-900 px-8 py-4"
        >
          <Text className="font-bold text-white">Try Again</Text>
        </Pressable>
      </View>
    );
  }

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
        contentContainerStyle={{ paddingBottom: 50 }}
      >
        {/* Header */}

        <View className="px-5 pb-5 pt-14">
          <Pressable
            onPress={handleBack}
            className="mb-6 h-10 w-10 items-center justify-center rounded-full bg-white"
          >
            <ArrowLeft size={22} color="#0f172a" />
          </Pressable>

          <Text className="text-sm font-medium text-slate-500">
            {equb.name}
          </Text>

          <Text className="mt-1 text-3xl font-bold text-slate-900">
            Payments
          </Text>

          <Text className="mt-2 text-sm leading-6 text-slate-500">
            Track your contributions and submit payment receipts for
            eligible periods.
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

              <View
                className={`rounded-full px-3 py-1 ${currentPeriod.paymentStatus === "VERIFIED"
                  ? "bg-emerald-400/15"
                  : currentPeriod.paymentStatus === "REJECTED"
                    ? "bg-red-400/15"
                    : "bg-amber-400/15"
                  }`}
              >
                <Text
                  className={`text-xs font-bold ${currentPeriod.paymentStatus === "VERIFIED"
                    ? "text-emerald-300"
                    : currentPeriod.paymentStatus === "REJECTED"
                      ? "text-red-300"
                      : "text-amber-300"
                    }`}
                >
                  {getPaymentStatusLabel(currentPeriod)}
                </Text>
              </View>
            </View>

            <Text className="mt-4 text-sm text-slate-400">
              Period {currentPeriod.periodNumber}
            </Text>

            <Text className="mt-1 text-3xl font-bold text-white">
              {formatMoney(currentAmount)}
            </Text>

            <View className="mt-6 flex-row">
              <View className="flex-1">
                <Text className="text-xs text-slate-400">
                  Period starts
                </Text>

                <Text className="mt-2 font-semibold text-white">
                  {formatDate(currentPeriod.startDate)}
                </Text>
              </View>

              <View className="flex-1">
                <Text className="text-xs text-slate-400">
                  Due date
                </Text>

                <Text className="mt-2 font-semibold text-white">
                  {formatDate(currentPeriod.dueDate)}
                </Text>
              </View>
            </View>

            <View className="mt-6 border-t border-slate-700 pt-5">
              {currentPeriod.paymentStatus === "VERIFIED" ? (
                <View className="flex-row items-center">
                  <CheckCircle2 size={18} color="#34d399" />

                  <Text className="ml-2 font-semibold text-emerald-300">
                    Payment verified
                  </Text>
                </View>
              ) : currentPeriod.paymentStatus === "REJECTED" ? (
                <View>
                  <View className="flex-row items-center">
                    <XCircle size={18} color="#f87171" />

                    <Text className="ml-2 font-semibold text-red-300">
                      Payment rejected
                    </Text>
                  </View>

                  {currentPeriod.payment?.rejectionReason ? (
                    <Text className="mt-2 text-xs leading-5 text-slate-400">
                      {currentPeriod.payment.rejectionReason}
                    </Text>
                  ) : null}
                </View>
              ) : currentPeriod.payment ? (
                <View className="flex-row items-center">
                  <Clock3 size={18} color="#fbbf24" />

                  <Text className="ml-2 font-semibold text-amber-300">
                    Payment pending verification
                  </Text>
                </View>
              ) : (
                <Text className="font-semibold text-slate-300">
                  Payment not submitted
                </Text>
              )}

              {selectedPeriodId === currentPeriod.id && selectedReceipt ? (
                <View className="mt-5 overflow-hidden rounded-2xl border border-slate-700 bg-slate-800">
                  <View className="relative">
                    <Image
                      source={{ uri: selectedReceipt.uri }}
                      className="h-48 w-full"
                      resizeMode="cover"
                    />

                    <Pressable
                      onPress={removeSelectedReceipt}
                      disabled={uploading}
                      className="absolute right-3 top-3 h-8 w-8 items-center justify-center rounded-full bg-black/70"
                    >
                      <X size={16} color="#ffffff" />
                    </Pressable>
                  </View>

                  <View className="p-4">
                    <Text
                      numberOfLines={1}
                      className="text-sm font-semibold text-white"
                    >
                      {selectedReceipt.name}
                    </Text>

                    <Text className="mt-0.5 text-xs text-slate-400">
                      Receipt selected for Period {currentPeriod.periodNumber}
                    </Text>

                    <View className="mt-4 flex-row items-center gap-3">
                      <Pressable
                        onPress={() => openReceiptPicker(currentPeriod.id)}
                        disabled={uploading}
                        className="flex-1 items-center justify-center rounded-xl bg-slate-700 py-3"
                      >
                        <Text className="text-xs font-semibold text-slate-200">
                          Change
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => uploadReceipt(currentPeriod.id)}
                        disabled={uploading}
                        className={`flex-1 items-center justify-center rounded-xl bg-white py-3 ${uploading ? "opacity-50" : ""
                          }`}
                      >
                        {uploading && uploadingPeriodId === currentPeriod.id ? (
                          <ActivityIndicator size="small" color="#0f172a" />
                        ) : (
                          <Text className="text-xs font-bold text-slate-900">
                            Submit Receipt
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                </View>
              ) : canUploadToPeriod(currentPeriod) ? (
                <Pressable
                  onPress={() => openReceiptPicker(currentPeriod.id)}
                  className="mt-5 flex-row items-center justify-center rounded-xl bg-white py-3.5"
                >
                  <Upload size={16} color="#0f172a" />

                  <Text className="ml-2 font-bold text-slate-900">
                    {currentPeriod.paymentStatus === "REJECTED" ||
                      currentPeriod.paymentStatus === "NEEDS_REVIEW"
                      ? "Resubmit receipt"
                      : "Upload receipt"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : (
          <View className="mx-5 rounded-3xl bg-white p-6">
            <Clock3 size={30} color="#64748b" />

            <Text className="mt-4 text-xl font-bold text-slate-900">
              No open payment
            </Text>

            <Text className="mt-2 text-sm leading-6 text-slate-500">
              There is currently no payment period open. You can still
              review your other payment periods below.
            </Text>
          </View>
        )}

        {/* All Payment Periods */}

        <View className="mt-8 px-5">
          <Text className="text-xl font-bold text-slate-900">
            Payment Periods
          </Text>

          <Text className="mt-1 text-sm text-slate-500">
            Select any eligible period to upload or resubmit a receipt.
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
                const isCurrent = period.id === currentPeriod?.id;

                // Eligibility is determined by the backend.
                // Do not require period.status === "OPEN" here.
                const canUpload = canUploadToPeriod(period);

                const statusClasses = getPaymentStatusClasses(period);
                const isSelected = selectedPeriodId === period.id;
                const isUploadingThisPeriod =
                  uploading && uploadingPeriodId === period.id;

                const paymentStatus =
                  period.paymentStatus?.toUpperCase();

                const canSubmitSelectedReceipt =
                  canUpload &&
                  isSelected &&
                  selectedReceipt !== null;

                return (
                  <View
                    key={period.id}
                    className={`mb-3 rounded-2xl bg-white p-5 ${isSelected && selectedReceipt
                      ? "border-2 border-slate-900"
                      : "border border-transparent"
                      }`}
                  >
                    {/* Period header */}

                    <Pressable
                      onPress={() => {
                        if (canUpload && !uploading) {
                          openReceiptPicker(period.id);
                        }
                      }}
                      disabled={!canUpload || uploading}
                      className="flex-row items-center"
                    >
                      <View className="h-11 w-11 items-center justify-center rounded-xl bg-slate-100">
                        <CalendarDays size={20} color="#334155" />
                      </View>

                      <View className="ml-3 flex-1">
                        <View className="flex-row items-center">
                          <Text className="font-bold text-slate-900">
                            Period {period.periodNumber}
                          </Text>

                          {isCurrent ? (
                            <View className="ml-2 rounded-full bg-slate-900 px-2 py-1">
                              <Text className="text-[10px] font-bold text-white">
                                CURRENT
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        <Text className="mt-1 text-xs text-slate-500">
                          {formatDate(period.startDate)} -{" "}
                          {formatDate(period.dueDate)}
                        </Text>
                      </View>

                      <View
                        className={`rounded-full px-3 py-1 ${statusClasses.container}`}
                      >
                        <Text
                          className={`text-xs font-bold ${statusClasses.text}`}
                        >
                          {getPaymentStatusLabel(period)}
                        </Text>
                      </View>
                    </Pressable>

                    {/* Amount */}

                    <View className="mt-4 flex-row items-center justify-between border-t border-slate-100 pt-4">
                      <Text className="text-sm text-slate-500">
                        Expected
                      </Text>

                      <Text className="font-bold text-slate-900">
                        {formatMoney(period.expectedAmount)}
                      </Text>
                    </View>

                    {/* Existing payment state */}

                    {paymentStatus === "VERIFIED" ? (
                      <View className="mt-4 flex-row items-center">
                        <CheckCircle2 size={16} color="#16a34a" />

                        <Text className="ml-2 text-xs font-semibold text-green-600">
                          Payment verified
                        </Text>
                      </View>
                    ) : paymentStatus === "REJECTED" ? (
                      <View className="mt-4">
                        <View className="flex-row items-center">
                          <XCircle size={16} color="#dc2626" />

                          <Text className="ml-2 text-xs font-semibold text-red-600">
                            Receipt rejected
                          </Text>
                        </View>

                        {period.payment?.rejectionReason ? (
                          <Text className="mt-2 text-xs leading-5 text-red-500">
                            {period.payment.rejectionReason}
                          </Text>
                        ) : null}
                      </View>
                    ) : period.payment ? (
                      <View className="mt-4 flex-row items-center">
                        <Clock3 size={16} color="#d97706" />

                        <Text className="ml-2 text-xs font-semibold text-amber-600">
                          Waiting for verification
                        </Text>
                      </View>
                    ) : null}

                    {/* Receipt preview */}

                    {isSelected && selectedReceipt ? (
                      <View className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                        <View className="relative">
                          <Image
                            source={{ uri: selectedReceipt.uri }}
                            className="h-56 w-full"
                            resizeMode="cover"
                          />

                          <Pressable
                            onPress={removeSelectedReceipt}
                            disabled={uploading}
                            className="absolute right-3 top-3 h-9 w-9 items-center justify-center rounded-full bg-black/70"
                          >
                            <X size={18} color="#ffffff" />
                          </Pressable>
                        </View>

                        <View className="p-4">
                          <Text
                            numberOfLines={1}
                            className="font-semibold text-slate-900"
                          >
                            {selectedReceipt.name}
                          </Text>

                          <Text className="mt-1 text-xs text-slate-500">
                            Receipt ready to submit for Period{" "}
                            {period.periodNumber}
                          </Text>

                          <View className="mt-4 flex-row items-center gap-3">
                            <Pressable
                              onPress={() => openReceiptPicker(period.id)}
                              disabled={uploading}
                              className="flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white py-3"
                            >
                              <Text className="text-xs font-semibold text-slate-700">
                                Change Photo
                              </Text>
                            </Pressable>

                            <Pressable
                              onPress={() => uploadReceipt(period.id)}
                              disabled={!canSubmitSelectedReceipt || uploading}
                              className={`flex-1 items-center justify-center rounded-xl bg-slate-900 py-3 ${uploading ? "opacity-50" : ""
                                }`}
                            >
                              {isUploadingThisPeriod ? (
                                <ActivityIndicator color="#ffffff" size="small" />
                              ) : (
                                <Text className="text-xs font-bold text-white">
                                  Submit Receipt
                                </Text>
                              )}
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    ) : null}

                    {/* Upload action */}

                    {canUpload && !isSelected ? (
                      <Pressable
                        onPress={() => openReceiptPicker(period.id)}
                        disabled={uploading}
                        className="mt-4 flex-row items-center justify-center rounded-xl bg-slate-900 py-3.5"
                      >
                        <Upload size={16} color="#ffffff" />

                        <Text className="ml-2 text-xs font-bold text-white">
                          {paymentStatus === "REJECTED" ||
                            paymentStatus === "NEEDS_REVIEW"
                            ? "Resubmit receipt"
                            : "Upload receipt"}
                        </Text>
                      </Pressable>
                    ) : null}

                    {!canUpload && paymentStatus !== "VERIFIED" &&
                      paymentStatus !== "REJECTED" &&
                      period.payment ? (
                      <View className="mt-4 rounded-xl bg-amber-50 px-3 py-3">
                        <Text className="text-xs leading-5 text-amber-800">
                          Your receipt has already been submitted. Please
                          wait for verification.
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

      {/* Choice Modal: Camera vs Gallery */}

      <Modal
        visible={Boolean(pickerPeriodId)}
        transparent
        animationType="slide"
        onRequestClose={closeReceiptPicker}
      >
        <View className="flex-1 justify-end bg-black/60">
          <Pressable
            onPress={closeReceiptPicker}
            className="absolute inset-0"
          />

          <View className="rounded-t-3xl bg-white px-6 pb-10 pt-4 shadow-2xl">
            {/* Grab Handle */}
            <View className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-300" />

            {/* Header */}
            <View className="mb-6 flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-xl font-bold text-slate-900">
                  Upload Receipt
                </Text>

                <Text className="mt-1 text-sm text-slate-500">
                  Period{" "}
                  {
                    periods.find(
                      (period) => period.id === pickerPeriodId
                    )?.periodNumber
                  }
                  {(() => {
                    const currentPickerPeriod = periods.find(
                      (period) => period.id === pickerPeriodId
                    );
                    return currentPickerPeriod
                      ? ` · ${formatMoney(currentPickerPeriod.expectedAmount)}`
                      : "";
                  })()}
                </Text>
              </View>

              <Pressable
                onPress={closeReceiptPicker}
                className="h-9 w-9 items-center justify-center rounded-full bg-slate-100 active:bg-slate-200"
              >
                <X size={18} color="#475569" />
              </Pressable>
            </View>

            {/* Options */}
            <View className="gap-3">
              {/* Option 1: Camera */}
              <Pressable
                onPress={() =>
                  pickerPeriodId && takeReceiptPhoto(pickerPeriodId)
                }
                disabled={uploading}
                className="flex-row items-center rounded-2xl border border-slate-200 bg-slate-50 p-4 active:bg-slate-100"
              >
                <View className="h-12 w-12 items-center justify-center rounded-xl bg-slate-900 shadow-sm">
                  <Camera size={22} color="#ffffff" />
                </View>

                <View className="ml-4 flex-1">
                  <Text className="text-base font-bold text-slate-900">
                    Take from Camera
                  </Text>
                  <Text className="mt-0.5 text-xs text-slate-500">
                    Capture a new photo of your payment receipt
                  </Text>
                </View>
              </Pressable>

              {/* Option 2: Choose from Gallery */}
              <Pressable
                onPress={() =>
                  pickerPeriodId && pickReceipt(pickerPeriodId)
                }
                disabled={uploading}
                className="flex-row items-center rounded-2xl border border-slate-200 bg-slate-50 p-4 active:bg-slate-100"
              >
                <View className="h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-sm">
                  <ImageIcon size={22} color="#ffffff" />
                </View>

                <View className="ml-4 flex-1">
                  <Text className="text-base font-bold text-slate-900">
                    Choose from Gallery
                  </Text>
                  <Text className="mt-0.5 text-xs text-slate-500">
                    Select an existing receipt image from your device
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* Cancel Button */}
            <Pressable
              onPress={closeReceiptPicker}
              disabled={uploading}
              className="mt-5 items-center rounded-xl py-3 active:bg-slate-100"
            >
              <Text className="text-sm font-semibold text-slate-500">
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
