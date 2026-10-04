import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
ArrowRight,
CheckCircle2,
Clock3,
Plus,
Users,
WalletCards,
} from "lucide-react";

import useAuth from "../../hooks/useAuth";
import { getEqubs } from "../../services/equbApi";

const formatCurrency = (amount, currency = "ETB") => {
return new Intl.NumberFormat("en-US", {
style: "currency",
currency,
maximumFractionDigits: 2,
}).format(Number(amount || 0));
};

const formatDate = (date) => {
if (!date) return "Not specified";

return new Date(date).toLocaleDateString("en-US", {
month: "short",
day: "numeric",
year: "numeric",
});
};

const getStatusStyle = (status) => {
const styles = {
ACTIVE: "bg-green-50 text-green-700",
PENDING: "bg-yellow-50 text-yellow-700",
PAUSED: "bg-orange-50 text-orange-700",
COMPLETED: "bg-blue-50 text-blue-700",
CANCELLED: "bg-red-50 text-red-700",
};

return styles[status] || "bg-gray-100 text-gray-600";
};

const StatCard = ({ title, value, description, icon }) => {
return ( <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"> <div className="flex items-start justify-between"> <div> <p className="text-sm font-medium text-gray-500">{title}</p>

      <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
        {value}
      </h2>

      <p className="mt-2 text-xs text-gray-500">{description}</p>
    </div>

    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
      {icon}
    </div>
  </div>
</div>


);
};

const AdminDashboard = () => {
const { user } = useAuth();

const [equbs, setEqubs] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");

useEffect(() => {
const fetchDashboardData = async () => {
try {
setLoading(true);
setError("");


    const response = await getEqubs();

    if (!response.success) {
      throw new Error(
        response.message || "Failed to load Equbs."
      );
    }

    setEqubs(response.equbs || []);
  } catch (err) {
    console.error("Admin dashboard error:", err);

    setError(
      err.response?.data?.message ||
        err.message ||
        "Unable to load dashboard data."
    );
  } finally {
    setLoading(false);
  }
};

fetchDashboardData();


}, []);

// ============================================================
// STATISTICS
// ============================================================

const totalEqubs = equbs.length;

const activeEqubs = equbs.filter(
(equb) => equb.status === "ACTIVE"
).length;

const pendingEqubs = equbs.filter(
(equb) => equb.status === "PENDING"
).length;

const completedEqubs = equbs.filter(
(equb) => equb.status === "COMPLETED"
).length;

const totalMembers = equbs.reduce((total, equb) => {
return total + Number(equb._count?.memberships || 0);
}, 0);

const recentEqubs = [...equbs]
.sort(
(a, b) =>
new Date(b.createdAt || 0) -
new Date(a.createdAt || 0)
)
.slice(0, 5);

const otherEqubs = equbs.filter(
(equb) =>
!["ACTIVE", "PENDING", "COMPLETED"].includes(equb.status)
).length;

const firstName =
user?.firstName ||
user?.fullName?.split(" ")[0] ||
"Admin";

// ============================================================
// LOADING
// ============================================================

if (loading) {
return ( <div className="flex min-h-[60vh] items-center justify-center"> <div className="text-center"> <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />


      <p className="mt-4 text-sm text-gray-500">
        Loading your dashboard...
      </p>
    </div>
  </div>
);


}

// ============================================================
// ERROR
// ============================================================

if (error) {
return ( <div className="rounded-2xl border border-red-200 bg-red-50 p-6"> <h2 className="font-semibold text-red-800">
Unable to load dashboard </h2>


    <p className="mt-2 text-sm text-red-700">
      {error}
    </p>

    <button
      onClick={() => window.location.reload()}
      className="mt-4 rounded-xl bg-red-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-800"
    >
      Try again
    </button>
  </div>
);


}

// ============================================================
// DASHBOARD
// ============================================================

return ( <div className="mx-auto max-w-7xl space-y-8">


  {/* ========================================================
      PAGE HEADING
  ======================================================== */}
  <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
    <div>
      <p className="text-sm font-medium text-gray-500">
        Administration
      </p>

      <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
        Welcome back, {firstName}
      </h1>

      <p className="mt-2 text-sm text-gray-500">
        Here's an overview of the Equbs you manage.
      </p>
    </div>

    {/* CREATE EQUB BUTTON */}
    <Link
      to="/admin/equbs/create"
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-700"
    >
      <Plus size={18} strokeWidth={2.5} />
      Create Equb
    </Link>
  </section>

  {/* ========================================================
      STATISTICS
  ======================================================== */}
  <section>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

      <StatCard
        title="Total Equbs"
        value={totalEqubs}
        description="All Equbs you manage"
        icon={<WalletCards size={21} />}
      />

      <StatCard
        title="Active Equbs"
        value={activeEqubs}
        description="Currently running"
        icon={<CheckCircle2 size={21} />}
      />

      <StatCard
        title="Pending Equbs"
        value={pendingEqubs}
        description="Awaiting activation"
        icon={<Clock3 size={21} />}
      />

      <StatCard
        title="Total Members"
        value={totalMembers}
        description="Membership records across your Equbs"
        icon={<Users size={21} />}
      />

    </div>
  </section>

  {/* ========================================================
      RECENT EQUBS
  ======================================================== */}
  <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">

    {/* Section header */}
    <div className="flex flex-col justify-between gap-3 border-b border-gray-200 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">
          Your Equbs
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Recently created Equbs and their current status.
        </p>
      </div>

      <Link
        to="/admin/equbs"
        className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900 transition hover:text-gray-600"
      >
        View all Equbs
        <ArrowRight size={15} />
      </Link>
    </div>

    {/* ======================================================
        NO EQUBS
    ====================================================== */}
    {equbs.length === 0 ? (
      <div className="px-6 py-16 text-center">

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
          <WalletCards
            size={25}
            className="text-gray-500"
          />
        </div>

        <h3 className="mt-4 font-semibold text-gray-900">
          No Equbs yet
        </h3>

        <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">
          You haven't created any Equbs yet. Create your first
          Equb to start managing members and contributions.
        </p>

        <Link
          to="/admin/equbs/create"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-700"
        >
          <Plus size={17} />
          Create your first Equb
        </Link>
      </div>
    ) : (
      <>
        {/* ==================================================
            DESKTOP TABLE
        ================================================== */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left">

            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-6 py-4 font-semibold">
                  Equb name
                </th>

                <th className="px-6 py-4 font-semibold">
                  Contribution
                </th>

                <th className="px-6 py-4 font-semibold">
                  Frequency
                </th>

                <th className="px-6 py-4 font-semibold">
                  Members
                </th>

                <th className="px-6 py-4 font-semibold">
                  Status
                </th>

                <th className="px-6 py-4 font-semibold">
                  Created
                </th>

                <th className="px-6 py-4 font-semibold">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {recentEqubs.map((equb) => (
                <tr
                  key={equb.id}
                  className="transition hover:bg-gray-50"
                >
                  <td className="px-6 py-4">
                    <p className="font-semibold text-gray-900">
                      {equb.name}
                    </p>

                    <p className="mt-1 max-w-48 truncate text-xs text-gray-500">
                      {equb.description || "No description"}
                    </p>
                  </td>

                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {formatCurrency(
                      equb.contributionAmount,
                      equb.currency || "ETB"
                    )}
                  </td>

                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                    {equb.frequency}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-600">
                    {equb._count?.memberships ?? 0}
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(
                        equb.status
                      )}`}
                    >
                      {equb.status}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {formatDate(equb.createdAt)}
                  </td>

                  <td className="px-6 py-4">
                    <Link
                      to={`/admin/equbs/${equb.id}`}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900 hover:underline"
                    >
                      Details
                      <ArrowRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>

          </table>
        </div>

        {/* ==================================================
            MOBILE CARDS
        ================================================== */}
        <div className="divide-y divide-gray-100 md:hidden">
          {recentEqubs.map((equb) => (
            <div
              key={equb.id}
              className="space-y-3 p-5"
            >

              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {equb.name}
                  </h3>

                  <p className="mt-1 text-xs text-gray-500">
                    Created {formatDate(equb.createdAt)}
                  </p>
                </div>

                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(
                    equb.status
                  )}`}
                >
                  {equb.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">

                <div>
                  <p className="text-xs text-gray-500">
                    Contribution
                  </p>

                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {formatCurrency(
                      equb.contributionAmount,
                      equb.currency || "ETB"
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">
                    Members
                  </p>

                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {equb._count?.memberships ?? 0}
                  </p>
                </div>

              </div>

              <div className="flex items-center justify-between">

                <span className="text-xs text-gray-500">
                  {equb.frequency}
                </span>

                <Link
                  to={`/admin/equbs/${equb.id}`}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900"
                >
                  View details
                  <ArrowRight size={14} />
                </Link>

              </div>
            </div>
          ))}
        </div>
      </>
    )}
  </section>

  {/* ========================================================
      ADDITIONAL STATUS SUMMARY
  ======================================================== */}
  <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">

    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">
        Completed Equbs
      </p>

      <p className="mt-2 text-2xl font-bold text-gray-900">
        {completedEqubs}
      </p>

      <p className="mt-1 text-xs text-gray-500">
        Equbs that have completed their scheduled periods.
      </p>
    </div>

    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">
        Other Equbs
      </p>

      <p className="mt-2 text-2xl font-bold text-gray-900">
        {otherEqubs}
      </p>

      <p className="mt-1 text-xs text-gray-500">
        Paused, cancelled, or other statuses.
      </p>
    </div>

  </section>
</div>


);
};

export default AdminDashboard;
