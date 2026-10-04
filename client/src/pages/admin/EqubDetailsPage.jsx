import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
ArrowLeft,
CalendarDays,
CheckCircle2,
Clock3,
FileCheck2,
Landmark,
Loader2,
Users,
} from "lucide-react";

import { getEqubById } from "../../services/equbApi";

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
case "ACTIVE":
return "bg-green-50 text-green-700 ring-green-200";


case "PENDING":
  return "bg-yellow-50 text-yellow-700 ring-yellow-200";

case "PAUSED":
  return "bg-orange-50 text-orange-700 ring-orange-200";

case "COMPLETED":
  return "bg-blue-50 text-blue-700 ring-blue-200";

case "CANCELLED":
  return "bg-red-50 text-red-700 ring-red-200";

default:
  return "bg-gray-100 text-gray-700 ring-gray-200";


}
};

const ManagementCard = ({
to,
icon: Icon,
title,
description,
}) => {
return ( <Link
   to={to}
   className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md"
 > <div className="flex items-start gap-4"> <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 transition group-hover:bg-gray-900"> <Icon
         size={21}
         className="text-gray-700 transition group-hover:text-white"
       /> </div>


    <div className="min-w-0">
      <h3 className="font-semibold text-gray-900">
        {title}
      </h3>

      <p className="mt-1 text-sm leading-5 text-gray-500">
        {description}
      </p>
    </div>
  </div>
</Link>


);
};

const EqubDetailsPage = () => {
const { equbId } = useParams();

const [equb, setEqub] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");

useEffect(() => {
const loadEqub = async () => {
try {
setLoading(true);
setError("");


    const response = await getEqubById(equbId);

    setEqub(response.equb || response);
  } catch (err) {
    console.error("Failed to load Equb:", err);

    setError(
      err.response?.data?.message ||
        "Failed to load Equb details"
    );
  } finally {
    setLoading(false);
  }
};

if (equbId) {
  loadEqub();
}


}, [equbId]);

if (loading) {
return ( <div className="flex min-h-[60vh] items-center justify-center"> <div className="flex items-center gap-3 text-sm text-gray-500"> <Loader2
         size={20}
         className="animate-spin"
       />
Loading Equb details... </div> </div>
);
}

if (error) {
return ( <div className="mx-auto max-w-3xl py-10"> <div className="rounded-2xl border border-red-200 bg-red-50 p-6"> <h2 className="text-lg font-semibold text-red-800">
Unable to load Equb </h2>


      <p className="mt-2 text-sm text-red-700">
        {error}
      </p>

      <Link
        to="/admin/equbs"
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
      >
        <ArrowLeft size={16} />
        Back to Equbs
      </Link>
    </div>
  </div>
);


}

if (!equb) {
return null;
}

const progress =
equb.totalPeriods > 0
? Math.min(
(Number(equb.currentPeriod || 0) /
Number(equb.totalPeriods)) *
100,
100
)
: 0;

return ( <div className="mx-auto max-w-7xl space-y-6">
{/* Header */} <div> <Link
       to="/admin/equbs"
       className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900"
     > <ArrowLeft size={16} />
Back to Equbs </Link>


    <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            {equb.name}
          </h1>

          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getStatusClasses(
              equb.status
            )}`}
          >
            {equb.status}
          </span>
        </div>

        {equb.description && (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
            {equb.description}
          </p>
        )}
      </div>
    </div>
  </div>

  {/* Overview */}
  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Contribution
        </p>

        <p className="mt-2 text-lg font-bold text-gray-900">
          {formatAmount(
            equb.contributionAmount,
            equb.currency
          )}
        </p>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Frequency
        </p>

        <p className="mt-2 text-lg font-bold text-gray-900">
          {equb.frequency}
        </p>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Start Date
        </p>

        <p className="mt-2 text-lg font-bold text-gray-900">
          {formatDate(equb.startDate)}
        </p>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          End Date
        </p>

        <p className="mt-2 text-lg font-bold text-gray-900">
          {formatDate(equb.endDate)}
        </p>
      </div>
    </div>
  </div>

  {/* Progress */}
  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-semibold text-gray-900">
          Equb Progress
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Period {equb.currentPeriod || 0} of{" "}
          {equb.totalPeriods || 0}
        </p>
      </div>

      <p className="text-sm font-bold text-gray-900">
        {Math.round(progress)}%
      </p>
    </div>

    <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-100">
      <div
        className="h-full rounded-full bg-gray-900 transition-all"
        style={{
          width: `${progress}%`,
        }}
      />
    </div>
  </div>

  {/* Management */}
  <div>
    <div className="mb-4">
      <h2 className="text-lg font-bold text-gray-900">
        Manage Equb
      </h2>

      <p className="mt-1 text-sm text-gray-500">
        Manage members, payment periods, payments,
        receipts, and lottery activity.
      </p>
    </div>

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <ManagementCard
        to={`/admin/equbs/${equb.id}/members`}
        icon={Users}
        title="Members"
        description="View, approve, and manage Equb members."
      />

      <ManagementCard
        to={`/admin/equbs/${equb.id}/periods`}
        icon={CalendarDays}
        title="Payment Periods"
        description="View all periods, payment progress, and collection status."
      />

      <ManagementCard
        to={`/admin/equbs/${equb.id}/payments`}
        icon={CheckCircle2}
        title="Payments"
        description="Review member payments and verification status."
      />

      <ManagementCard
        to={`/admin/equbs/${equb.id}/receipts`}
        icon={FileCheck2}
        title="Receipts"
        description="Review uploaded receipts and OCR results."
      />

      <ManagementCard
        to={`/admin/equbs/${equb.id}/lottery`}
        icon={Landmark}
        title="Lottery"
        description="Manage draws, winners, and payout information."
      />
    </div>
  </div>

  {/* Period summary */}
  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-semibold text-gray-900">
          Payment Periods
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          This Equb has {equb.totalPeriods || 0} generated
          payment periods.
        </p>
      </div>

      <Link
        to={`/admin/equbs/${equb.id}/periods`}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
      >
        <CalendarDays size={17} />
        View Payment Periods
      </Link>
    </div>

    <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-xl bg-gray-50 p-4">
        <div className="flex items-center gap-2">
          <CalendarDays
            size={18}
            className="text-gray-600"
          />

          <p className="text-sm font-medium text-gray-500">
            Total Periods
          </p>
        </div>

        <p className="mt-2 text-xl font-bold text-gray-900">
          {equb.totalPeriods || 0}
        </p>
      </div>

      <div className="rounded-xl bg-gray-50 p-4">
        <div className="flex items-center gap-2">
          <Clock3
            size={18}
            className="text-gray-600"
          />

          <p className="text-sm font-medium text-gray-500">
            Current Period
          </p>
        </div>

        <p className="mt-2 text-xl font-bold text-gray-900">
          {equb.currentPeriod || 0}
        </p>
      </div>

      <div className="rounded-xl bg-gray-50 p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2
            size={18}
            className="text-gray-600"
          />

          <p className="text-sm font-medium text-gray-500">
            Frequency
          </p>
        </div>

        <p className="mt-2 text-xl font-bold text-gray-900">
          {equb.frequency}
        </p>
      </div>
    </div>
  </div>
</div>


);
};

export default EqubDetailsPage;
