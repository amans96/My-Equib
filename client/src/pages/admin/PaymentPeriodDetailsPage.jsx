
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileImage,
  Loader2,
  RefreshCw,
  Search,
  UserRound,
  Wallet,
  XCircle,
  ScanSearch,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import api from "../../services/api";
import { useNavigate } from "react-router-dom";
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const SERVER_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "");

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

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
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatAmount = (amount, currency = "ETB") => {
  if (
    amount === null ||
    amount === undefined ||
    amount === ""
  ) {
    return `0.00 ${currency || "ETB"}`;
  }

  return (
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount || 0)) +
    ` ${currency || "ETB"}`
  );
};

/*
|--------------------------------------------------------------------------
| Receipt URL
|--------------------------------------------------------------------------
*/

const getReceiptUrl = (imageUrl) => {
  if (!imageUrl) {
    return null;
  }

  if (
    imageUrl.startsWith("http://") ||
    imageUrl.startsWith("https://")
  ) {
    return imageUrl;
  }

  if (imageUrl.startsWith("/")) {
    return `${SERVER_BASE_URL}${imageUrl}`;
  }

  return `${SERVER_BASE_URL}/${imageUrl}`;
};

/*
|--------------------------------------------------------------------------
| Status helpers
|--------------------------------------------------------------------------
*/

const getPaymentStatusClasses = (status) => {
  switch (status) {
    case "VERIFIED":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";

    case "SUBMITTED":
    case "UNDER_REVIEW":
    case "PENDING":
      return "bg-amber-50 text-amber-700 ring-amber-200";

    case "REJECTED":
      return "bg-red-50 text-red-700 ring-red-200";

    case "NEEDS_REVIEW":
      return "bg-purple-50 text-purple-700 ring-purple-200";

    case "UNDERPAID":
      return "bg-orange-50 text-orange-700 ring-orange-200";

    case "OVERPAID":
      return "bg-blue-50 text-blue-700 ring-blue-200";

    case "DUPLICATE":
      return "bg-gray-100 text-gray-700 ring-gray-200";

    default:
      return "bg-gray-100 text-gray-600 ring-gray-200";
  }
};

const getPaymentStatusLabel = (status) => {
  if (!status) return "No Payment";

  switch (status) {
    case "UNDER_REVIEW":
      return "Under Review";

    case "NEEDS_REVIEW":
      return "Needs Review";

    case "UNDERPAID":
      return "Underpaid";

    case "OVERPAID":
      return "Overpaid";

    case "VERIFIED":
      return "Verified";

    case "REJECTED":
      return "Rejected";

    case "PENDING":
      return "Pending";

    default:
      return status;
  }
};

const getReceiptStatusClasses = (status) => {
  switch (status) {
    case "VERIFIED":
    case "PROCESSED":
      return "bg-emerald-50 text-emerald-700";

    case "PROCESSING":
      return "bg-blue-50 text-blue-700";

    case "REJECTED":
      return "bg-red-50 text-red-700";

    case "UPLOADED":
      return "bg-amber-50 text-amber-700";

    default:
      return "bg-gray-100 text-gray-600";
  }
};

/*
|--------------------------------------------------------------------------
| Stat Card
|--------------------------------------------------------------------------
*/

const StatCard = ({
  icon: Icon,
  label,
  value,
  description,
}) => {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold text-gray-900">
            {value}
          </p>

          {description && (
            <p className="mt-1 text-xs text-gray-500">
              {description}
            </p>
          )}
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100">
          <Icon size={20} className="text-gray-700" />
        </div>
      </div>
    </div>
  );
};

/*
|--------------------------------------------------------------------------
| Main Page
|--------------------------------------------------------------------------
*/

const PaymentPeriodDetailsPage = () => {
  const { equbId, periodId } = useParams();
const navigate = useNavigate();
  const [data, setData] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  /*
  |--------------------------------------------------------------------------
  | Action states
  |--------------------------------------------------------------------------
  */

  const [processingOCR, setProcessingOCR] = useState(null);
  const [approving, setApproving] = useState(null);
  const [rejecting, setRejecting] = useState(null);

  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  /*
  |--------------------------------------------------------------------------
  | Reject modal
  |--------------------------------------------------------------------------
  */

  const [rejectModal, setRejectModal] = useState({
    open: false,
    receiptId: null,
    memberName: "",
  });

  const [rejectReason, setRejectReason] = useState("");

  /*
  |--------------------------------------------------------------------------
  | Load period details
  |--------------------------------------------------------------------------
  */

  const loadPeriodDetails = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await api.get(
        `/payment-periods/${periodId}`
      );

      console.log(
        "PAYMENT PERIOD DETAILS:",
        response.data
      );

      setData(response.data);
    } catch (err) {
      console.error(
        "Failed to load payment period details:",
        err
      );

      setError(
        err.response?.data?.message ||
          "Failed to load payment period details"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (periodId) {
      loadPeriodDetails();
    }
  }, [periodId]);

  /*
  |--------------------------------------------------------------------------
  | Clear action messages
  |--------------------------------------------------------------------------
  */

  const clearActionMessages = () => {
    setActionError("");
    setActionSuccess("");
  };

  /*
  |--------------------------------------------------------------------------
  | View Receipt
  |--------------------------------------------------------------------------
  */

  const handleViewReceipt = (imageUrl) => {
    clearActionMessages();

    const receiptUrl = getReceiptUrl(imageUrl);

    if (!receiptUrl) {
      setActionError("No receipt image is available.");
      return;
    }

    window.open(
      receiptUrl,
      "_blank",
      "noopener,noreferrer"
    );
  };

  /*
  |--------------------------------------------------------------------------
  | Process OCR
  |--------------------------------------------------------------------------
  |
  | IMPORTANT:
  |
  | Backend route:
  |
  | POST
  | /api/payment-periods/:periodId/receipts/:receiptId/process-ocr
  |
  */

const handleProcessOCR = async (receiptId) => {
  clearActionMessages();
  setProcessingOCR(receiptId);

  try {
    const response = await api.post(
      `/receipts/${receiptId}/ocr`
    );

    console.log("OCR RESPONSE:", response.data);

    setActionSuccess(
      "Receipt OCR processed successfully."
    );

    navigate(
      `/admin/equbs/${equbId}/periods/${periodId}/receipts/${receiptId}/ocr`
    );
  } catch (error) {
    console.error("OCR processing failed:", error);

    setActionError(
      error.response?.data?.message ||
        error.message ||
        "Failed to process receipt with OCR."
    );
  } finally {
    setProcessingOCR(null);
  }
};

  /*
  |--------------------------------------------------------------------------
  | Approve Payment
  |--------------------------------------------------------------------------
  */

  const handleApprove = async (
    receiptId,
    memberName
  ) => {
    if (!receiptId) return;

    const confirmed = window.confirm(
      `Are you sure you want to approve the payment for ${memberName}?`
    );

    if (!confirmed) {
      return;
    }

    clearActionMessages();

    try {
      setApproving(receiptId);

      const response = await api.post(
        `/payment-periods/${periodId}/receipts/${receiptId}/approve`,
        {
          reason:
            "Payment verified by administrator",
        }
      );

      setActionSuccess(
        response.data?.message ||
          "Payment approved successfully."
      );

      await loadPeriodDetails(true);
    } catch (err) {
      console.error(
        "Payment approval failed:",
        err
      );

      setActionError(
        err.response?.data?.message ||
          err.message ||
          "Failed to approve payment."
      );
    } finally {
      setApproving(null);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Open Reject Modal
  |--------------------------------------------------------------------------
  */

  const openRejectModal = (
    receiptId,
    memberName
  ) => {
    clearActionMessages();

    setRejectReason("");

    setRejectModal({
      open: true,
      receiptId,
      memberName,
    });
  };

  /*
  |--------------------------------------------------------------------------
  | Close Reject Modal
  |--------------------------------------------------------------------------
  */

  const closeRejectModal = () => {
    if (rejecting) {
      return;
    }

    setRejectModal({
      open: false,
      receiptId: null,
      memberName: "",
    });

    setRejectReason("");
  };

  /*
  |--------------------------------------------------------------------------
  | Reject Payment
  |--------------------------------------------------------------------------
  */

  const handleReject = async () => {
    const receiptId = rejectModal.receiptId;

    if (!receiptId) {
      return;
    }

    if (!rejectReason.trim()) {
      setActionError(
        "Please provide a reason for rejecting this payment."
      );

      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to reject the payment for ${rejectModal.memberName}?`
    );

    if (!confirmed) {
      return;
    }

    clearActionMessages();

    try {
      setRejecting(receiptId);

      const response = await api.post(
        `/payment-periods/${periodId}/receipts/${receiptId}/reject`,
        {
          reason: rejectReason.trim(),
        }
      );

      setActionSuccess(
        response.data?.message ||
          "Payment rejected successfully."
      );

      setRejectModal({
        open: false,
        receiptId: null,
        memberName: "",
      });

      setRejectReason("");

      await loadPeriodDetails(true);
    } catch (err) {
      console.error(
        "Payment rejection failed:",
        err
      );

      setActionError(
        err.response?.data?.message ||
          err.message ||
          "Failed to reject payment."
      );
    } finally {
      setRejecting(null);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Data
  |--------------------------------------------------------------------------
  */

  const period = data?.period;
  const equb = data?.equb;
  const summary = data?.summary;
  const members = data?.members || [];

  /*
  |--------------------------------------------------------------------------
  | Search
  |--------------------------------------------------------------------------
  */

  const filteredMembers = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    if (!searchValue) {
      return members;
    }

    return members.filter((member) => {
      const fullName =
        `${member.user?.firstName || ""} ${
          member.user?.lastName || ""
        }`.trim();

      const phone = member.user?.phone || "";
      const email = member.user?.email || "";
      const memberNumber =
        member.membership?.memberNumber || "";

      return (
        fullName
          .toLowerCase()
          .includes(searchValue) ||
        phone
          .toLowerCase()
          .includes(searchValue) ||
        email
          .toLowerCase()
          .includes(searchValue) ||
        memberNumber
          .toLowerCase()
          .includes(searchValue)
      );
    });
  }, [members, search]);

  /*
  |--------------------------------------------------------------------------
  | Loading
  |--------------------------------------------------------------------------
  */

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <Loader2
            className="animate-spin"
            size={20}
          />

          Loading payment period...
        </div>
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Error
  |--------------------------------------------------------------------------
  */

  if (error) {
    return (
      <div className="mx-auto max-w-3xl py-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-red-800">
            Unable to load payment period
          </h2>

          <p className="mt-2 text-sm text-red-700">
            {error}
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => loadPeriodDetails()}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              <RefreshCw size={16} />
              Try again
            </button>

            <Link
              to={`/admin/equbs/${equbId}/periods`}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
            >
              <ArrowLeft size={16} />
              Back to Periods
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <>
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              to={`/admin/equbs/${equbId}/periods`}
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900"
            >
              <ArrowLeft size={16} />
              Back to Payment Periods
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                Period {period?.periodNumber}
              </h1>

              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                {period?.status || "UNKNOWN"}
              </span>
            </div>

            <p className="mt-1 text-sm text-gray-500">
              {equb?.name || "Equb"} · Payment period
              details
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadPeriodDetails(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={17}
              className={
                refreshing ? "animate-spin" : ""
              }
            />

            Refresh
          </button>
        </div>

        {/* ACTION ERROR */}

        {actionError && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
            <AlertCircle
              size={19}
              className="mt-0.5 shrink-0 text-red-600"
            />

            <div>
              <p className="text-sm font-semibold text-red-800">
                Action failed
              </p>

              <p className="mt-1 text-sm text-red-700">
                {actionError}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActionError("")}
              className="ml-auto text-sm font-semibold text-red-700 hover:text-red-900"
            >
              ×
            </button>
          </div>
        )}

        {/* ACTION SUCCESS */}

        {actionSuccess && (
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <CheckCircle2
              size={19}
              className="mt-0.5 shrink-0 text-emerald-600"
            />

            <div>
              <p className="text-sm font-semibold text-emerald-800">
                Success
              </p>

              <p className="mt-1 text-sm text-emerald-700">
                {actionSuccess}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActionSuccess("")}
              className="ml-auto text-sm font-semibold text-emerald-700 hover:text-emerald-900"
            >
              ×
            </button>
          </div>
        )}

        {/* PERIOD INFORMATION */}

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">

            <div>
              <div className="flex items-center gap-2 text-gray-500">
                <CalendarDays size={17} />

                <p className="text-xs font-medium">
                  Start Date
                </p>
              </div>

              <p className="mt-2 text-sm font-semibold text-gray-900">
                {formatDate(period?.startDate)}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 text-gray-500">
                <Clock3 size={17} />

                <p className="text-xs font-medium">
                  Due Date
                </p>
              </div>

              <p className="mt-2 text-sm font-semibold text-gray-900">
                {formatDate(period?.dueDate)}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 text-gray-500">
                <Wallet size={17} />

                <p className="text-xs font-medium">
                  Expected Amount
                </p>
              </div>

              <p className="mt-2 text-sm font-semibold text-gray-900">
                {formatAmount(
                  period?.expectedAmount,
                  equb?.currency
                )}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 text-gray-500">
                <CheckCircle2 size={17} />

                <p className="text-xs font-medium">
                  Closed At
                </p>
              </div>

              <p className="mt-2 text-sm font-semibold text-gray-900">
                {formatDateTime(period?.closedAt)}
              </p>
            </div>

          </div>
        </div>

        {/* SUMMARY */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <StatCard
            icon={UserRound}
            label="Total Members"
            value={summary?.totalMembers || 0}
            description="Active members"
          />

          <StatCard
            icon={CheckCircle2}
            label="Verified"
            value={summary?.verifiedMembers || 0}
            description="Payments verified"
          />

          <StatCard
            icon={Clock3}
            label="Pending"
            value={summary?.pendingMembers || 0}
            description="Awaiting verification"
          />

          <StatCard
            icon={Wallet}
            label="Collected"
            value={formatAmount(
              summary?.totalPaid,
              equb?.currency
            )}
            description={`Expected ${formatAmount(
              summary?.totalExpected,
              equb?.currency
            )}`}
          />

        </div>

        {/* PAYMENT STATUS OVERVIEW */}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-medium text-emerald-700">
              Paid / Verified
            </p>

            <p className="mt-2 text-2xl font-bold text-emerald-900">
              {summary?.verifiedMembers || 0}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-medium text-amber-700">
              Pending
            </p>

            <p className="mt-2 text-2xl font-bold text-amber-900">
              {summary?.pendingMembers || 0}
            </p>
          </div>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-xs font-medium text-red-700">
              Rejected
            </p>

            <p className="mt-2 text-2xl font-bold text-red-900">
              {summary?.rejectedMembers || 0}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-medium text-gray-600">
              Missing
            </p>

            <p className="mt-2 text-2xl font-bold text-gray-900">
              {summary?.missingMembers || 0}
            </p>
          </div>

        </div>

        {/* MEMBER PAYMENTS */}

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">

          <div className="flex flex-col gap-4 border-b border-gray-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">

            <div>
              <h2 className="font-semibold text-gray-900">
                Member Payments
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Review payment, receipt, OCR, and
                verification status for every active
                member.
              </p>
            </div>

            <div className="relative w-full sm:w-72">

              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search members..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-gray-400 focus:bg-white"
              />

            </div>

          </div>

          {/* DESKTOP TABLE */}

          <div className="hidden overflow-x-auto lg:block">

            <table className="w-full min-w-[1750px]">

              <thead className="bg-gray-50">

                <tr className="border-b border-gray-200">

                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Member
                  </th>

                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Expected
                  </th>

                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Paid
                  </th>

                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Payment
                  </th>

                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Receipt
                  </th>

                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                    OCR
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    OCR Details
                  </th>

                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Verification
                  </th>

                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Date
                  </th>

                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Actions
                  </th>

                </tr>

              </thead>

              <tbody>

                {filteredMembers.map((member) => {

                  const fullName =
                    `${member.user?.firstName || ""} ${
                      member.user?.lastName || ""
                    }`.trim() ||
                    "Unknown Member";

                  const payment = member.payment;
                  const receipt = member.receipt;
                  const verification =
                    member.verification;

                  const canProcessOCR =
                    Boolean(receipt) &&
                    !receipt.ocrProcessed &&
                    receipt.status !== "PROCESSING" &&
                    payment?.status !== "VERIFIED" &&
                    payment?.status !== "REJECTED";

                  const canReview =
                    Boolean(receipt) &&
                    Boolean(payment) &&
                    payment.status !== "VERIFIED" &&
                    payment.status !== "REJECTED";

                  return (
                    <tr
                      key={member.membership?.id}
                      className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                    >

                      {/* MEMBER */}

                      <td className="px-6 py-4">

                        <div className="flex items-center gap-3">

                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
                            <UserRound
                              size={18}
                              className="text-gray-600"
                            />
                          </div>

                          <div>

                            <p className="font-semibold text-gray-900">
                              {fullName}
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
                              {member.user?.phone ||
                                member.user?.email ||
                                "No contact information"}
                            </p>

                            {member.membership
                              ?.memberNumber && (
                              <p className="mt-1 text-xs font-medium text-gray-400">
                                #
                                {
                                  member.membership
                                    .memberNumber
                                }
                              </p>
                            )}

                          </div>

                        </div>

                      </td>

                      {/* EXPECTED */}

                      <td className="px-6 py-4 text-right">

                        <p className="text-sm font-semibold text-gray-900">
                          {formatAmount(
                            member.expectedAmount,
                            equb?.currency
                          )}
                        </p>

                      </td>

                      {/* PAID */}

                      <td className="px-6 py-4 text-right">

                        <p className="text-sm font-semibold text-gray-900">
                          {formatAmount(
                            payment?.paidAmount,
                            equb?.currency
                          )}
                        </p>

                      </td>

                      {/* PAYMENT */}

                      <td className="px-6 py-4 text-center">

                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getPaymentStatusClasses(
                            payment?.status
                          )}`}
                        >
                          {getPaymentStatusLabel(
                            payment?.status
                          )}
                        </span>

                      </td>

                      {/* RECEIPT */}

                      <td className="px-6 py-4 text-center">

                        {receipt ? (

                          <div>

                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getReceiptStatusClasses(
                                receipt.status
                              )}`}
                            >
                              {receipt.status}
                            </span>

                            {receipt.originalFileName && (
                              <p
                                className="mt-1 max-w-[160px] truncate text-xs text-gray-500"
                                title={
                                  receipt.originalFileName
                                }
                              >
                                {receipt.originalFileName}
                              </p>
                            )}

                          </div>

                        ) : (

                          <span className="text-xs text-gray-400">
                            No receipt
                          </span>

                        )}

                      </td>

                      {/* OCR STATUS */}

                      <td className="px-6 py-4 text-center">

                        {!receipt ? (

                          <span className="text-xs text-gray-400">
                            —
                          </span>

                        ) : receipt.ocrProcessed ? (

                          <div>

                            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              Processed
                            </span>

                            {receipt.ocrData?.confidence !=
                              null && (
                              <p className="mt-1 text-xs text-gray-500">
                                {Number(
                                  receipt.ocrData
                                    .confidence
                                ).toFixed(1)}
                                %
                              </p>
                            )}

                          </div>

                        ) : receipt.status ===
                          "PROCESSING" ? (

                          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                            <Loader2
                              size={12}
                              className="animate-spin"
                            />
                            Processing
                          </span>

                        ) : (

                          <span className="text-xs text-gray-400">
                            Not processed
                          </span>

                        )}

                      </td>

                      {/* OCR DETAILS */}

                      <td className="px-6 py-4">

                        {receipt?.ocrData ? (

                          <div className="min-w-[280px] space-y-1.5 text-xs">

                            {receipt.ocrData.bankName && (
                              <div className="flex gap-2">
                                <span className="font-medium text-gray-500">
                                  Bank:
                                </span>

                                <span className="font-semibold text-gray-900">
                                  {
                                    receipt.ocrData
                                      .bankName
                                  }
                                </span>
                              </div>
                            )}

                            {receipt.ocrData.amount !=
                              null && (
                              <div className="flex gap-2">
                                <span className="font-medium text-gray-500">
                                  Amount:
                                </span>

                                <span className="font-semibold text-gray-900">
                                  {formatAmount(
                                    receipt.ocrData
                                      .amount,
                                    equb?.currency
                                  )}
                                </span>
                              </div>
                            )}

                            {receipt.ocrData
                              .transactionReference && (
                              <div className="flex gap-2">
                                <span className="font-medium text-gray-500">
                                  Reference:
                                </span>

                                <span
                                  className="max-w-[180px] truncate font-semibold text-gray-900"
                                  title={
                                    receipt.ocrData
                                      .transactionReference
                                  }
                                >
                                  {
                                    receipt.ocrData
                                      .transactionReference
                                  }
                                </span>
                              </div>
                            )}

                            {receipt.ocrData
                              .transactionDate && (
                              <div className="flex gap-2">
                                <span className="font-medium text-gray-500">
                                  Date:
                                </span>

                                <span className="font-semibold text-gray-900">
                                  {formatDate(
                                    receipt.ocrData
                                      .transactionDate
                                  )}
                                </span>
                              </div>
                            )}

                            {receipt.ocrData.senderName && (
                              <div className="flex gap-2">
                                <span className="font-medium text-gray-500">
                                  Sender:
                                </span>

                                <span
                                  className="max-w-[180px] truncate font-semibold text-gray-900"
                                  title={
                                    receipt.ocrData
                                      .senderName
                                  }
                                >
                                  {
                                    receipt.ocrData
                                      .senderName
                                  }
                                </span>
                              </div>
                            )}

                            {receipt.ocrData.receiverName && (
                              <div className="flex gap-2">
                                <span className="font-medium text-gray-500">
                                  Receiver:
                                </span>

                                <span
                                  className="max-w-[180px] truncate font-semibold text-gray-900"
                                  title={
                                    receipt.ocrData
                                      .receiverName
                                  }
                                >
                                  {
                                    receipt.ocrData
                                      .receiverName
                                  }
                                </span>
                              </div>
                            )}

                            {!receipt.ocrData.bankName &&
                              receipt.ocrData.amount ==
                                null &&
                              !receipt.ocrData
                                .transactionReference &&
                              !receipt.ocrData.senderName &&
                              !receipt.ocrData.receiverName && (
                                <span className="text-gray-400">
                                  OCR data available
                                </span>
                              )}

                          </div>

                        ) : (

                          <span className="text-xs text-gray-400">
                            No OCR data
                          </span>

                        )}

                      </td>

                      {/* VERIFICATION */}

                      <td className="px-6 py-4 text-center">

                        {verification ? (

                          <div>

                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getPaymentStatusClasses(
                                verification.decision
                              )}`}
                            >
                              {verification.decision}
                            </span>

                            {verification.reason && (
                              <p
                                className="mt-1 max-w-[180px] truncate text-xs text-gray-500"
                                title={
                                  verification.reason
                                }
                              >
                                {verification.reason}
                              </p>
                            )}

                          </div>

                        ) : (

                          <span className="text-xs text-gray-400">
                            Not reviewed
                          </span>

                        )}

                      </td>

                      {/* DATE */}

                      <td className="px-6 py-4 text-right">

                        <p className="text-xs text-gray-500">
                          {formatDateTime(
                            payment?.paymentDate ||
                              receipt?.uploadedAt
                          )}
                        </p>

                      </td>

                      {/* ACTIONS */}

                      <td className="px-6 py-4">

                        <div className="flex min-w-[190px] flex-col items-end gap-2">

                          {/* VIEW RECEIPT */}

                          {receipt && (
                            <button
                              type="button"
                              onClick={() =>
                                handleViewReceipt(
                                  receipt.imageUrl
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                            >
                              <FileImage size={14} />
                              View Receipt
                              <ExternalLink size={12} />
                            </button>
                          )}

                          {/* PROCESS OCR */}

                          {canProcessOCR && (
                            <button
                              type="button"
                              disabled={
                                processingOCR ===
                                receipt.id
                              }
                              onClick={() =>
                                handleProcessOCR(
                                  receipt.id
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {processingOCR ===
                              receipt.id ? (
                                <>
                                  <Loader2
                                    size={14}
                                    className="animate-spin"
                                  />
                                  Processing...
                                </>
                              ) : (
                                <>
                                  <ScanSearch
                                    size={14}
                                  />
                                  Process OCR
                                </>
                              )}
                            </button>
                          )}

                          {/* REVIEW ACTIONS */}

                          {canReview && (
                            <div className="flex gap-2">

                              {/* APPROVE */}

                              <button
                                type="button"
                                disabled={
                                  approving ===
                                    receipt.id ||
                                  rejecting ===
                                    receipt.id ||
                                  processingOCR ===
                                    receipt.id
                                }
                                onClick={() =>
                                  handleApprove(
                                    receipt.id,
                                    fullName
                                  )
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {approving ===
                                receipt.id ? (
                                  <>
                                    <Loader2
                                      size={14}
                                      className="animate-spin"
                                    />
                                    Approving...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2
                                      size={14}
                                    />
                                    Approve
                                  </>
                                )}
                              </button>

                              {/* REJECT */}

                              <button
                                type="button"
                                disabled={
                                  approving ===
                                    receipt.id ||
                                  rejecting ===
                                    receipt.id ||
                                  processingOCR ===
                                    receipt.id
                                }
                                onClick={() =>
                                  openRejectModal(
                                    receipt.id,
                                    fullName
                                  )
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <XCircle size={14} />
                                Reject
                              </button>

                            </div>
                          )}

                          {/* VERIFIED */}

                          {!receipt && (
                            <span className="text-xs text-gray-400">
                              No actions available
                            </span>
                          )}

                          {receipt &&
                            payment?.status ===
                              "VERIFIED" && (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                                <CheckCircle2
                                  size={14}
                                />
                                Payment verified
                              </span>
                            )}

                          {/* REJECTED */}

                          {receipt &&
                            payment?.status ===
                              "REJECTED" && (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
                                <XCircle size={14} />
                                Payment rejected
                              </span>
                            )}

                        </div>

                      </td>

                    </tr>
                  );
                })}

                {filteredMembers.length === 0 && (
                  <tr>

                    <td
                      colSpan={10}
                      className="px-6 py-12 text-center"
                    >
                      <UserRound
                        size={32}
                        className="mx-auto text-gray-300"
                      />

                      <p className="mt-3 text-sm font-medium text-gray-900">
                        No members found
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        {search
                          ? "Try a different search."
                          : "There are no active members in this period."}
                      </p>
                    </td>

                  </tr>
                )}

              </tbody>

            </table>

          </div>

          {/* MOBILE / TABLET */}

          <div className="space-y-4 p-4 lg:hidden">

            {filteredMembers.map((member) => {

              const fullName =
                `${member.user?.firstName || ""} ${
                  member.user?.lastName || ""
                }`.trim() ||
                "Unknown Member";

              const payment = member.payment;
              const receipt = member.receipt;
              const verification =
                member.verification;

              const canProcessOCR =
                Boolean(receipt) &&
                !receipt.ocrProcessed &&
                receipt.status !== "PROCESSING" &&
                payment?.status !== "VERIFIED" &&
                payment?.status !== "REJECTED";

              const canReview =
                Boolean(receipt) &&
                Boolean(payment) &&
                payment.status !== "VERIFIED" &&
                payment.status !== "REJECTED";

              return (
                <div
                  key={member.membership?.id}
                  className="rounded-2xl border border-gray-200 bg-white p-4"
                >

                  {/* MEMBER HEADER */}

                  <div className="flex items-start gap-3">

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
                      <UserRound
                        size={18}
                        className="text-gray-600"
                      />
                    </div>

                    <div className="min-w-0 flex-1">

                      <p className="font-semibold text-gray-900">
                        {fullName}
                      </p>

                      <p className="mt-1 truncate text-xs text-gray-500">
                        {member.user?.phone ||
                          member.user?.email ||
                          "No contact information"}
                      </p>

                      {member.membership
                        ?.memberNumber && (
                        <p className="mt-1 text-xs font-medium text-gray-400">
                          #
                          {
                            member.membership
                              .memberNumber
                          }
                        </p>
                      )}

                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getPaymentStatusClasses(
                        payment?.status
                      )}`}
                    >
                      {getPaymentStatusLabel(
                        payment?.status
                      )}
                    </span>

                  </div>

                  {/* AMOUNTS */}

                  <div className="mt-5 grid grid-cols-2 gap-4">

                    <div>
                      <p className="text-xs text-gray-500">
                        Expected
                      </p>

                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {formatAmount(
                          member.expectedAmount,
                          equb?.currency
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">
                        Paid
                      </p>

                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {formatAmount(
                          payment?.paidAmount,
                          equb?.currency
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">
                        Receipt
                      </p>

                      <div className="mt-1">

                        {receipt ? (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getReceiptStatusClasses(
                              receipt.status
                            )}`}
                          >
                            {receipt.status}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">
                            No receipt
                          </span>
                        )}

                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">
                        Verification
                      </p>

                      <div className="mt-1">

                        {verification ? (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getPaymentStatusClasses(
                              verification.decision
                            )}`}
                          >
                            {verification.decision}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">
                            Not reviewed
                          </span>
                        )}

                      </div>
                    </div>

                  </div>

                  {/* OCR INFORMATION */}

                  {receipt?.ocrData && (
                    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">

                      <div className="flex items-center gap-2">

                        <ScanSearch
                          size={16}
                          className="text-gray-600"
                        />

                        <p className="text-xs font-semibold text-gray-700">
                          OCR Information
                        </p>

                      </div>

                      <div className="mt-3 space-y-2 text-xs">

                        {receipt.ocrData
                          .transactionReference && (
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-500">
                              Reference
                            </span>

                            <span className="text-right font-medium text-gray-900">
                              {
                                receipt.ocrData
                                  .transactionReference
                              }
                            </span>
                          </div>
                        )}

                        {receipt.ocrData.bankName && (
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-500">
                              Bank
                            </span>

                            <span className="font-medium text-gray-900">
                              {
                                receipt.ocrData
                                  .bankName
                              }
                            </span>
                          </div>
                        )}

                        {receipt.ocrData.senderName && (
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-500">
                              Sender
                            </span>

                            <span className="text-right font-medium text-gray-900">
                              {
                                receipt.ocrData
                                  .senderName
                              }
                            </span>
                          </div>
                        )}

                        {receipt.ocrData.receiverName && (
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-500">
                              Receiver
                            </span>

                            <span className="text-right font-medium text-gray-900">
                              {
                                receipt.ocrData
                                  .receiverName
                              }
                            </span>
                          </div>
                        )}

                        {receipt.ocrData.amount !=
                          null && (
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-500">
                              OCR Amount
                            </span>

                            <span className="font-medium text-gray-900">
                              {formatAmount(
                                receipt.ocrData
                                  .amount,
                                equb?.currency
                              )}
                            </span>
                          </div>
                        )}

                        {receipt.ocrData
                          .transactionDate && (
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-500">
                              Transaction Date
                            </span>

                            <span className="text-right font-medium text-gray-900">
                              {formatDate(
                                receipt.ocrData
                                  .transactionDate
                              )}
                            </span>
                          </div>
                        )}

                        {receipt.ocrData
                          .confidence != null && (
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-500">
                              Confidence
                            </span>

                            <span className="font-medium text-gray-900">
                              {Number(
                                receipt.ocrData
                                  .confidence
                              ).toFixed(1)}
                              %
                            </span>
                          </div>
                        )}

                      </div>
                    </div>
                  )}

                  {/* VERIFICATION */}

                  {verification && (
                    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">

                      <p className="text-xs font-semibold text-gray-700">
                        Verification
                      </p>

                      <div className="mt-3 space-y-2 text-xs">

                        <div className="flex justify-between gap-4">

                          <span className="text-gray-500">
                            Decision
                          </span>

                          <span className="font-semibold text-gray-900">
                            {verification.decision}
                          </span>

                        </div>

                        {verification
                          .verifiedAmount != null && (
                          <div className="flex justify-between gap-4">

                            <span className="text-gray-500">
                              Verified Amount
                            </span>

                            <span className="font-semibold text-gray-900">
                              {formatAmount(
                                verification.verifiedAmount,
                                equb?.currency
                              )}
                            </span>

                          </div>
                        )}

                        {verification.reason && (
                          <div>

                            <p className="text-gray-500">
                              Reason
                            </p>

                            <p className="mt-1 text-gray-700">
                              {verification.reason}
                            </p>

                          </div>
                        )}

                        {verification.reviewer && (
                          <div className="flex justify-between gap-4">

                            <span className="text-gray-500">
                              Reviewed By
                            </span>

                            <span className="font-medium text-gray-900">
                              {
                                verification
                                  .reviewer
                                  .firstName
                              }{" "}
                              {
                                verification
                                  .reviewer
                                  .lastName
                              }
                            </span>

                          </div>
                        )}

                      </div>

                    </div>
                  )}

                  {/* ACTIONS */}

                  {receipt && (
                    <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">

                      {/* VIEW */}

                      <button
                        type="button"
                        onClick={() =>
                          handleViewReceipt(
                            receipt.imageUrl
                          )
                        }
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        <FileImage size={16} />
                        View Receipt
                        <ExternalLink size={13} />
                      </button>

                      {/* OCR */}

                      {canProcessOCR && (
                        <button
                          type="button"
                          disabled={
                            processingOCR ===
                            receipt.id
                          }
                          onClick={() =>
                            handleProcessOCR(
                              receipt.id
                            )
                          }
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {processingOCR ===
                          receipt.id ? (
                            <>
                              <Loader2
                                size={16}
                                className="animate-spin"
                              />
                              Processing OCR...
                            </>
                          ) : (
                            <>
                              <ScanSearch size={16} />
                              Process OCR
                            </>
                          )}
                        </button>
                      )}

                      {/* APPROVE / REJECT */}

                      {canReview && (
                        <div className="grid grid-cols-2 gap-2">

                          <button
                            type="button"
                            disabled={
                              approving ===
                                receipt.id ||
                              rejecting ===
                                receipt.id ||
                              processingOCR ===
                                receipt.id
                            }
                            onClick={() =>
                              handleApprove(
                                receipt.id,
                                fullName
                              )
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {approving ===
                            receipt.id ? (
                              <>
                                <Loader2
                                  size={16}
                                  className="animate-spin"
                                />
                                Approving...
                              </>
                            ) : (
                              <>
                                <CheckCircle2
                                  size={16}
                                />
                                Approve
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            disabled={
                              approving ===
                                receipt.id ||
                              rejecting ===
                                receipt.id ||
                              processingOCR ===
                                receipt.id
                            }
                            onClick={() =>
                              openRejectModal(
                                receipt.id,
                                fullName
                              )
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <XCircle size={16} />
                            Reject
                          </button>

                        </div>
                      )}

                      {/* VERIFIED MESSAGE */}

                      {payment?.status ===
                        "VERIFIED" && (
                        <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
                          <CheckCircle2
                            size={16}
                          />
                          Payment verified
                        </div>
                      )}

                      {/* REJECTED MESSAGE */}

                      {payment?.status ===
                        "REJECTED" && (
                        <div className="flex items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">
                          <XCircle size={16} />
                          Payment rejected
                        </div>
                      )}

                    </div>
                  )}

                  {/* DATE */}

                  <div className="mt-4 border-t border-gray-100 pt-3">

                    <p className="text-xs text-gray-400">
                      {formatDateTime(
                        payment?.paymentDate ||
                          receipt?.uploadedAt
                      )}
                    </p>

                  </div>

                </div>
              );
            })}

            {filteredMembers.length === 0 && (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-6 py-12 text-center">

                <UserRound
                  size={32}
                  className="mx-auto text-gray-300"
                />

                <p className="mt-3 text-sm font-medium text-gray-900">
                  No members found
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  {search
                    ? "Try a different search."
                    : "There are no active members in this period."}
                </p>

              </div>
            )}

          </div>

        </div>

        {/* LOTTERY */}

        {period?.lotteryDraw && (
          <div className="rounded-2xl border border-purple-200 bg-purple-50 p-5 sm:p-6">

            <div className="flex items-start gap-3">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100">
                <CheckCircle2
                  size={20}
                  className="text-purple-700"
                />
              </div>

              <div>

                <h2 className="font-semibold text-purple-900">
                  Lottery Draw #
                  {period.lotteryDraw.drawNumber}
                </h2>

                <p className="mt-1 text-sm text-purple-700">
                  Status:{" "}
                  {period.lotteryDraw.status}
                </p>

              </div>

            </div>

          </div>
        )}

      </div>

      {/* REJECT MODAL */}

      {rejectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">

            <div className="flex items-start gap-3">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
                <XCircle
                  size={21}
                  className="text-red-600"
                />
              </div>

              <div>

                <h2 className="text-lg font-semibold text-gray-900">
                  Reject Payment
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Reject the payment submitted by{" "}
                  <span className="font-semibold text-gray-700">
                    {rejectModal.memberName}
                  </span>
                  .
                </p>

              </div>

            </div>

            <div className="mt-5">

              <label
                htmlFor="rejectReason"
                className="text-sm font-semibold text-gray-700"
              >
                Rejection reason
              </label>

              <textarea
                id="rejectReason"
                value={rejectReason}
                onChange={(event) =>
                  setRejectReason(
                    event.target.value
                  )
                }
                rows={4}
                placeholder="Example: The receipt amount does not match the expected payment."
                className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-gray-400 focus:bg-white"
              />

              <p className="mt-1 text-xs text-gray-400">
                The reason will be stored with the
                payment verification record.
              </p>

            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

              <button
                type="button"
                onClick={closeRejectModal}
                disabled={Boolean(rejecting)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleReject}
                disabled={
                  Boolean(rejecting) ||
                  !rejectReason.trim()
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {rejecting ? (
                  <>
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle size={16} />
                    Reject Payment
                  </>
                )}
              </button>

            </div>

          </div>

        </div>
      )}
    </>
  );
};

export default PaymentPeriodDetailsPage;
