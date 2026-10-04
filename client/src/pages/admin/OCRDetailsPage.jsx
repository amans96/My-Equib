import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  FileImage,
  Hash,
  Loader2,
  ScanSearch,
  UserRound,
  Wallet,
  AlertCircle,
} from "lucide-react";

import api from "../../services/api";

const formatDate = (date) => {
  if (!date) return "—";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "—";
  }

  return parsedDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatDateTime = (date) => {
  if (!date) return "—";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "—";
  }

  return parsedDate.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatAmount = (amount, currency = "ETB") => {
  if (amount === null || amount === undefined || amount === "") {
    return "—";
  }

  const number = Number(amount);

  if (Number.isNaN(number)) {
    return "—";
  }

  return `${number.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
};

const getReceiptUrl = (imageUrl) => {
  if (!imageUrl) return null;

  if (
    imageUrl.startsWith("http://") ||
    imageUrl.startsWith("https://")
  ) {
    return imageUrl;
  }

  const apiUrl = import.meta.env.VITE_API_URL || "";

  const serverUrl = apiUrl.replace(/\/api\/?$/, "");

  return `${serverUrl}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
};

const DetailCard = ({ icon: Icon, title, children }) => {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
          <Icon className="h-5 w-5 text-gray-700" />
        </div>

        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>

      <div className="p-5">{children}</div>
    </div>
  );
};

const DetailRow = ({ label, value, copyable = false }) => {
  const handleCopy = async () => {
    if (!value || value === "—") return;

    try {
      await navigator.clipboard.writeText(String(value));
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  return (
    <div className="flex flex-col gap-1 border-b border-gray-100 py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <span className="text-sm text-gray-500">{label}</span>

      <div className="flex items-center gap-2 sm:max-w-[65%]">
        <span className="break-words text-sm font-medium text-gray-900 sm:text-right">
          {value || "—"}
        </span>

        {copyable && value && value !== "—" && (
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-md p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            title="Copy"
          >
            <Copy className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const normalizedStatus = status?.toUpperCase();

  const styles = {
    PROCESSED:
      "bg-green-50 text-green-700 border-green-200",
    VERIFIED:
      "bg-green-50 text-green-700 border-green-200",
    PROCESSING:
      "bg-blue-50 text-blue-700 border-blue-200",
    UPLOADED:
      "bg-yellow-50 text-yellow-700 border-yellow-200",
    REJECTED:
      "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
        styles[normalizedStatus] ||
        "border-gray-200 bg-gray-50 text-gray-700"
      }`}
    >
      {normalizedStatus || "UNKNOWN"}
    </span>
  );
};

const ConfidenceBadge = ({ confidence }) => {
  if (confidence === null || confidence === undefined) {
    return (
      <span className="text-sm font-medium text-gray-500">
        Not available
      </span>
    );
  }

  const value = Number(confidence);

  if (Number.isNaN(value)) {
    return (
      <span className="text-sm font-medium text-gray-500">
        Not available
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
      <ScanSearch className="h-4 w-4" />
      {value.toFixed(1)}%
    </span>
  );
};

const OCRDetailsPage = () => {
  const navigate = useNavigate();

  const { equbId, periodId, receiptId } = useParams();

  const [data, setData] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [member, setMember] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOCRDetails = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        `/payment-periods/${periodId}`
      );

      const responseData = response.data;

      setData(responseData);

      const foundMember = responseData.members?.find(
        (item) => item.receipt?.id === receiptId
      );

      if (!foundMember) {
        setError("Receipt could not be found for this payment period.");
        return;
      }

      setMember(foundMember);
      setReceipt(foundMember.receipt);
    } catch (err) {
      console.error("Failed to load OCR details:", err);

      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to load OCR details."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOCRDetails();
  }, [periodId, receiptId]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-gray-700" />

          <p className="text-sm text-gray-500">
            Loading OCR details...
          </p>
        </div>
      </div>
    );
  }

  if (error || !receipt || !member) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-4xl">
          <Link
            to={`/admin/equbs/${equbId}/periods/${periodId}`}
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Payment Period
          </Link>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />

              <div>
                <h2 className="font-semibold text-red-900">
                  Unable to load OCR details
                </h2>

                <p className="mt-1 text-sm text-red-700">
                  {error || "Receipt not found."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const ocrData = receipt.ocrData;

  const currency = data?.equb?.currency || "ETB";

  const receiptUrl = getReceiptUrl(receipt.imageUrl);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            to={`/admin/equbs/${equbId}/periods/${periodId}`}
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Payment Period
          </Link>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-900">
                  <ScanSearch className="h-6 w-6 text-white" />
                </div>

                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    OCR Details
                  </h1>

                  <p className="mt-1 text-sm text-gray-500">
                    Extracted information from the uploaded payment receipt
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <StatusBadge status={receipt.status} />
            </div>
          </div>
        </div>

        {/* Success / OCR status */}
        <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />

            <div>
              <h2 className="font-semibold text-green-900">
                Receipt OCR processed successfully
              </h2>

              <p className="mt-1 text-sm text-green-700">
                The receipt was processed and the extracted information is
                shown below.
              </p>
            </div>
          </div>
        </div>

        {/* Top information */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
              <Building2 className="h-5 w-5 text-gray-700" />
            </div>

            <p className="text-sm text-gray-500">Equb</p>

            <p className="mt-1 font-semibold text-gray-900">
              {data?.equb?.name || "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
              <UserRound className="h-5 w-5 text-gray-700" />
            </div>

            <p className="text-sm text-gray-500">Member</p>

            <p className="mt-1 font-semibold text-gray-900">
              {member.user?.firstName} {member.user?.lastName}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
              <CalendarDays className="h-5 w-5 text-gray-700" />
            </div>

            <p className="text-sm text-gray-500">Payment Period</p>

            <p className="mt-1 font-semibold text-gray-900">
              Period {data?.period?.periodNumber || "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
              <Clock3 className="h-5 w-5 text-gray-700" />
            </div>

            <p className="text-sm text-gray-500">Processed At</p>

            <p className="mt-1 text-sm font-semibold text-gray-900">
              {formatDateTime(ocrData?.processedAt)}
            </p>
          </div>
        </div>

        {/* Main content */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Receipt image */}
          <DetailCard icon={FileImage} title="Receipt">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
              {receiptUrl ? (
                <img
                  src={receiptUrl}
                  alt={receipt.originalFileName || "Payment receipt"}
                  className="max-h-[650px] w-full object-contain"
                />
              ) : (
                <div className="flex min-h-[300px] items-center justify-center text-sm text-gray-500">
                  Receipt image is not available.
                </div>
              )}
            </div>

            <div className="mt-4">
              <DetailRow
                label="File Name"
                value={receipt.originalFileName}
              />

              <DetailRow
                label="Uploaded"
                value={formatDateTime(receipt.uploadedAt)}
              />

              <DetailRow
                label="OCR Status"
                value={<StatusBadge status={receipt.status} />}
              />
            </div>
          </DetailCard>

          {/* OCR result */}
          <div className="space-y-6">
            <DetailCard icon={ScanSearch} title="OCR Result">
              {!ocrData ? (
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-5">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 text-yellow-600" />

                    <div>
                      <h3 className="font-semibold text-yellow-900">
                        No OCR data available
                      </h3>

                      <p className="mt-1 text-sm text-yellow-700">
                        The receipt was processed, but no extracted OCR
                        information was returned.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-blue-900">
                          OCR Confidence
                        </p>

                        <p className="mt-1 text-xs text-blue-700">
                          Confidence reported by the OCR service
                        </p>
                      </div>

                      <ConfidenceBadge
                        confidence={ocrData.confidence}
                      />
                    </div>
                  </div>

                  <div>
                    <DetailRow
                      label="Bank"
                      value={ocrData.bankName}
                    />

                    <DetailRow
                      label="Amount"
                      value={formatAmount(
                        ocrData.amount,
                        currency
                      )}
                    />

                    <DetailRow
                      label="Transaction Reference"
                      value={ocrData.transactionReference}
                      copyable
                    />

                    <DetailRow
                      label="Transaction Date"
                      value={formatDateTime(
                        ocrData.transactionDate
                      )}
                    />

                    <DetailRow
                      label="Sender Name"
                      value={ocrData.senderName}
                    />

                    <DetailRow
                      label="Sender Account"
                      value={ocrData.senderAccount}
                      copyable
                    />

                    <DetailRow
                      label="Receiver Name"
                      value={ocrData.receiverName}
                    />

                    <DetailRow
                      label="Receiver Account"
                      value={ocrData.receiverAccount}
                      copyable
                    />
                  </div>
                </>
              )}
            </DetailCard>

            {/* Payment information */}
            <DetailCard icon={Wallet} title="Payment Information">
              <DetailRow
                label="Expected Amount"
                value={formatAmount(
                  member.payment?.expectedAmount ??
                    member.expectedAmount,
                  currency
                )}
              />

              <DetailRow
                label="Paid Amount"
                value={formatAmount(
                  member.payment?.paidAmount,
                  currency
                )}
              />

              <DetailRow
                label="Payment Status"
                value={member.payment?.status || "—"}
              />

              <DetailRow
                label="Payment Date"
                value={formatDateTime(
                  member.payment?.paymentDate
                )}
              />

              <DetailRow
                label="Payment Reference"
                value={member.payment?.referenceNumber}
                copyable
              />
            </DetailCard>
          </div>
        </div>

        {/* Raw OCR text */}
        {ocrData?.rawText && (
          <div className="mt-6">
            <DetailCard icon={Hash} title="Raw OCR Text">
              <div className="max-h-[400px] overflow-y-auto rounded-xl bg-gray-50 p-4">
                <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-6 text-gray-700">
                  {ocrData.rawText}
                </pre>
              </div>
            </DetailCard>
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={() =>
              navigate(
                `/admin/equbs/${equbId}/periods/${periodId}`
              )
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Payment Period
          </button>

          <button
            type="button"
            onClick={loadOCRDetails}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            <ScanSearch className="h-4 w-4" />
            Refresh OCR Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default OCRDetailsPage;