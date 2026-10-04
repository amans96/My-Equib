import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
ArrowLeft,
ArrowRight,
CalendarDays,
CheckCircle2,
Clock3,
Coins,
Loader2,
RefreshCw,
} from "lucide-react";
import api from "../../services/api";

const formatDate = (date) => {
if (!date) return "—";

return new Date(date).toLocaleDateString("en-US", {
year: "numeric",
month: "short",
day: "numeric",
});
};

const formatAmount = (amount, currency = "ETB") => {
return (
new Intl.NumberFormat("en-US", {
minimumFractionDigits: 2,
maximumFractionDigits: 2,
}).format(Number(amount || 0)) + ` ${currency}`
);
};

const getStatusClasses = (status) => {
switch (status) {
case "OPEN":
return "bg-blue-50 text-blue-700 ring-blue-200";


case "UPCOMING":
  return "bg-amber-50 text-amber-700 ring-amber-200";

case "CLOSED":
  return "bg-gray-100 text-gray-700 ring-gray-200";

case "DRAW_PENDING":
  return "bg-purple-50 text-purple-700 ring-purple-200";

case "DRAW_COMPLETED":
  return "bg-emerald-50 text-emerald-700 ring-emerald-200";

default:
  return "bg-gray-100 text-gray-600 ring-gray-200";


}
};

const getStatusLabel = (status) => {
switch (status) {
case "DRAW_PENDING":
return "Draw Pending";

case "DRAW_COMPLETED":
  return "Draw Completed";

default:
  return status;


}
};

const StatCard = ({ icon: Icon, label, value, description }) => {
return ( <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"> <div className="flex items-start justify-between gap-4"> <div> <p className="text-sm font-medium text-gray-500">{label}</p>


      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>

      {description && (
        <p className="mt-1 text-xs text-gray-500">{description}</p>
      )}
    </div>

    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100">
      <Icon size={20} className="text-gray-700" />
    </div>
  </div>
</div>


);
};

const PaymentPeriodsPage = () => {
const { equbId } = useParams();

const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
const [refreshing, setRefreshing] = useState(false);
const [error, setError] = useState("");

const loadPeriods = async (isRefresh = false) => {
try {
if (isRefresh) {
setRefreshing(true);
} else {
setLoading(true);
}

  setError("");

  const response = await api.get(`/equbs/${equbId}/periods`);

  setData(response.data);
} catch (err) {
  console.error("Failed to load payment periods:", err);

  setError(
    err.response?.data?.message || "Failed to load payment periods"
  );
} finally {
  setLoading(false);
  setRefreshing(false);
}


};

useEffect(() => {
if (equbId) {
loadPeriods();
}
}, [equbId]);

const periods = data?.periods || [];
const equb = data?.equb;
const summary = data?.summary;

const currentPeriod = useMemo(() => {
if (!equb?.currentPeriod) return null;


return periods.find(
  (period) => period.periodNumber === Number(equb.currentPeriod)
);

}, [equb, periods]);

if (loading) {
return ( <div className="flex min-h-[60vh] items-center justify-center"> <div className="flex items-center gap-3 text-sm text-gray-500"> <Loader2 className="animate-spin" size={20} />
Loading payment periods... </div> </div>
);
}

if (error) {
return ( <div className="mx-auto max-w-3xl py-10"> <div className="rounded-2xl border border-red-200 bg-red-50 p-6"> <h2 className="text-lg font-semibold text-red-800">
Unable to load payment periods </h2>


      <p className="mt-2 text-sm text-red-700">{error}</p>

      <button
        type="button"
        onClick={() => loadPeriods()}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
      >
        <RefreshCw size={16} />
        Try again
      </button>
    </div>
  </div>
);


}

return ( <div className="mx-auto max-w-7xl space-y-6">
{/* Header */} <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"> <div>
<Link
to={`/admin/equbs/${equbId}`}
className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900"
> <ArrowLeft size={16} />
Back to Equb </Link>


      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Payment Periods
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          {equb?.name || "Equb"} · {equb?.frequency || "—"} contributions
        </p>
      </div>
    </div>

    <button
      type="button"
      onClick={() => loadPeriods(true)}
      disabled={refreshing}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RefreshCw
        size={17}
        className={refreshing ? "animate-spin" : ""}
      />
      Refresh
    </button>
  </div>

  {/* Equb overview */}
  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold text-gray-900">
            {equb?.name}
          </h2>

          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getStatusClasses(
              equb?.status
            )}`}
          >
            {equb?.status}
          </span>
        </div>

        <p className="mt-2 text-sm text-gray-500">
          {formatAmount(equb?.contributionAmount, equb?.currency)} ·{" "}
          {equb?.frequency}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-gray-500">Start Date</p>

          <p className="mt-1 text-sm font-semibold text-gray-900">
            {formatDate(equb?.startDate)}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-500">End Date</p>

          <p className="mt-1 text-sm font-semibold text-gray-900">
            {formatDate(equb?.endDate)}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-500">Current Period</p>

          <p className="mt-1 text-sm font-semibold text-gray-900">
            {equb?.currentPeriod || 0} /{" "}
            {equb?.totalPeriods || periods.length}
          </p>
        </div>
      </div>
    </div>
  </div>

  {/* Summary cards */}
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <StatCard
      icon={CalendarDays}
      label="Total Periods"
      value={summary?.totalPeriods || 0}
      description="Generated for this Equb"
    />

    <StatCard
      icon={Clock3}
      label="Open Periods"
      value={summary?.openPeriods || 0}
      description="Currently accepting payments"
    />

    <StatCard
      icon={CheckCircle2}
      label="Closed Periods"
      value={summary?.closedPeriods || 0}
      description="Completed payment stages"
    />

    <StatCard
      icon={Coins}
      label="Total Collected"
      value={formatAmount(summary?.totalCollected, equb?.currency)}
      description="Verified payments"
    />
  </div>

  {/* Current period */}
  {currentPeriod && (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
              {currentPeriod.periodNumber}
            </span>

            <div>
              <p className="text-sm font-semibold text-blue-900">
                Current Period
              </p>

              <p className="text-xs text-blue-700">
                {formatDate(currentPeriod.startDate)} –{" "}
                {formatDate(currentPeriod.dueDate)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-5">
          <div>
            <p className="text-xs text-blue-700">Collected</p>

            <p className="text-sm font-bold text-blue-900">
              {formatAmount(
                currentPeriod.totalCollected,
                equb?.currency
              )}
            </p>
          </div>

          <div>
            <p className="text-xs text-blue-700">Payments</p>

            <p className="text-sm font-bold text-blue-900">
              {currentPeriod.verifiedPaymentCount}/
              {currentPeriod.paymentCount}
            </p>
          </div>

          <div>
            <p className="text-xs text-blue-700">Collection</p>

            <p className="text-sm font-bold text-blue-900">
              {currentPeriod.collectionPercentage}%
            </p>
          </div>
        </div>
      </div>
    </div>
  )}

  {/* Desktop table */}
  <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm lg:block">
    <div className="border-b border-gray-200 px-6 py-4">
      <h2 className="font-semibold text-gray-900">All Payment Periods</h2>

      <p className="mt-1 text-sm text-gray-500">
        Track payment progress for every period.
      </p>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px]">
        <thead className="bg-gray-50">
          <tr className="border-b border-gray-200">
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Period
            </th>

            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Date Range
            </th>

            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Status
            </th>

            <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
              Expected
            </th>

            <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
              Payments
            </th>

            <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
              Collected
            </th>

            <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
              Progress
            </th>

            <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
              Action
            </th>
          </tr>
        </thead>

        <tbody>
          {periods.map((period) => (
            <tr
              key={period.id}
              className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
            >
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-sm font-bold text-gray-700">
                    {period.periodNumber}
                  </span>

                  <div>
                    <p className="font-semibold text-gray-900">
                      Period {period.periodNumber}
                    </p>

                    {period.periodNumber ===
                      Number(equb?.currentPeriod) && (
                      <p className="text-xs font-medium text-blue-600">
                        Current
                      </p>
                    )}
                  </div>
                </div>
              </td>

              <td className="px-6 py-4">
                <p className="text-sm font-medium text-gray-900">
                  {formatDate(period.startDate)}
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Due {formatDate(period.dueDate)}
                </p>
              </td>

              <td className="px-6 py-4">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getStatusClasses(
                    period.status
                  )}`}
                >
                  {getStatusLabel(period.status)}
                </span>
              </td>

              <td className="px-6 py-4 text-right">
                <span className="text-sm font-semibold text-gray-900">
                  {formatAmount(
                    period.expectedAmount,
                    equb?.currency
                  )}
                </span>
              </td>

              <td className="px-6 py-4 text-center">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {period.verifiedPaymentCount}/
                    {period.paymentCount}
                  </p>

                  {period.pendingPaymentCount > 0 && (
                    <p className="mt-1 text-xs text-amber-600">
                      {period.pendingPaymentCount} pending
                    </p>
                  )}
                </div>
              </td>

              <td className="px-6 py-4 text-right">
                <span className="text-sm font-semibold text-gray-900">
                  {formatAmount(
                    period.totalCollected,
                    equb?.currency
                  )}
                </span>
              </td>

              <td className="px-6 py-4">
                <div className="min-w-[120px]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-500">
                      Collection
                    </span>

                    <span className="font-semibold text-gray-900">
                      {period.collectionPercentage}%
                    </span>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-gray-900 transition-all"
                      style={{
                        width: `${Math.min(
                          period.collectionPercentage,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </td>

              <td className="px-6 py-4 text-right">
                <Link
                  to={`/admin/equbs/${equbId}/periods/${period.id}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-gray-800"
                >
                  View Details
                  <ArrowRight size={14} />
                </Link>
              </td>
            </tr>
          ))}

          {periods.length === 0 && (
            <tr>
              <td colSpan="8" className="px-6 py-12 text-center">
                <CalendarDays
                  size={32}
                  className="mx-auto text-gray-300"
                />

                <p className="mt-3 text-sm font-medium text-gray-900">
                  No payment periods found
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  This Equb does not have any generated payment periods.
                </p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>

  {/* Mobile/tablet cards */}
  <div className="space-y-4 lg:hidden">
    <div>
      <h2 className="font-semibold text-gray-900">
        All Payment Periods
      </h2>

      <p className="mt-1 text-sm text-gray-500">
        Track payment progress for every period.
      </p>
    </div>

    {periods.map((period) => (
      <div
        key={period.id}
        className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-sm font-bold text-gray-700">
              {period.periodNumber}
            </span>

            <div>
              <p className="font-semibold text-gray-900">
                Period {period.periodNumber}
              </p>

              <p className="text-xs text-gray-500">
                {formatDate(period.startDate)} –{" "}
                {formatDate(period.dueDate)}
              </p>
            </div>
          </div>

          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getStatusClasses(
              period.status
            )}`}
          >
            {getStatusLabel(period.status)}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">Expected</p>

            <p className="mt-1 text-sm font-semibold text-gray-900">
              {formatAmount(
                period.expectedAmount,
                equb?.currency
              )}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500">Collected</p>

            <p className="mt-1 text-sm font-semibold text-gray-900">
              {formatAmount(
                period.totalCollected,
                equb?.currency
              )}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500">Payments</p>

            <p className="mt-1 text-sm font-semibold text-gray-900">
              {period.verifiedPaymentCount}/
              {period.paymentCount}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500">Pending</p>

            <p className="mt-1 text-sm font-semibold text-gray-900">
              {period.pendingPaymentCount}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-gray-500">
              Collection progress
            </span>

            <span className="font-semibold text-gray-900">
              {period.collectionPercentage}%
            </span>
          </div>

          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gray-900"
              style={{
                width: `${Math.min(
                  period.collectionPercentage,
                  100
                )}%`,
              }}
            />
          </div>
        </div>

        {period.lotteryDraw && (
          <div className="mt-4 rounded-xl bg-gray-50 p-3">
            <p className="text-xs font-semibold text-gray-700">
              Lottery Draw #{period.lotteryDraw.drawNumber}
            </p>

            <p className="mt-1 text-xs text-gray-500">
              Status: {period.lotteryDraw.status}
            </p>
          </div>
        )}

        {/* View period details */}
        <Link
          to={`/admin/equbs/${equbId}/periods/${period.id}`}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
        >
          View Period Details
          <ArrowRight size={16} />
        </Link>
      </div>
    ))}

    {periods.length === 0 && (
      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center">
        <CalendarDays
          size={32}
          className="mx-auto text-gray-300"
        />

        <p className="mt-3 text-sm font-medium text-gray-900">
          No payment periods found
        </p>

        <p className="mt-1 text-sm text-gray-500">
          This Equb does not have any generated payment periods.
        </p>
      </div>
    )}
  </div>
</div>


);
};

export default PaymentPeriodsPage;
