import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
ArrowLeft,
Check,
Loader2,
Mail,
Phone,
UserRound,
Users,
X,
} from "lucide-react";
import api from "../../services/api";

const formatAmount = (amount, currency = "ETB") => {
return `${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
};

const formatDate = (date) => {
if (!date) return "—";

return new Date(date).toLocaleDateString(undefined, {
year: "numeric",
month: "short",
day: "numeric",
});
};

const getFullName = (user) => {
const name = `${user?.firstName || ""} ${user?.lastName || ""}`.trim();
return name || "Unknown member";
};

const statusStyles = {
ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
PENDING: "bg-amber-50 text-amber-700 ring-amber-600/20",
REJECTED: "bg-red-50 text-red-700 ring-red-600/20",
};

const MembersPage = () => {
const { equbId } = useParams();

const [memberships, setMemberships] = useState([]);
const [equb, setEqub] = useState(null);

const [activeFilter, setActiveFilter] = useState("ALL");

const [loading, setLoading] = useState(true);
const [actionLoading, setActionLoading] = useState(null);

const [error, setError] = useState("");
const [successMessage, setSuccessMessage] = useState("");

const loadMembers = async () => {
try {
setLoading(true);
setError("");


  const response = await api.get(`/equbs/${equbId}/members`);

  setMemberships(response.data?.memberships || []);

  const firstMembership = response.data?.memberships?.[0];

  if (firstMembership?.equb) {
    setEqub(firstMembership.equb);
  }
} catch (error) {
  console.error("Failed to load members:", error);

  setError(
    error.response?.data?.message ||
      "Failed to load Equb members."
  );
} finally {
  setLoading(false);
}


};

useEffect(() => {
if (equbId) {
loadMembers();
}
}, [equbId]);

const counts = useMemo(() => {
return {
ALL: memberships.length,
ACTIVE: memberships.filter(
(membership) => membership.status === "ACTIVE"
).length,
PENDING: memberships.filter(
(membership) => membership.status === "PENDING"
).length,
REJECTED: memberships.filter(
(membership) => membership.status === "REJECTED"
).length,
};
}, [memberships]);

const filteredMemberships = useMemo(() => {
if (activeFilter === "ALL") {
return memberships;
}


return memberships.filter(
  (membership) => membership.status === activeFilter
);


}, [memberships, activeFilter]);

const handleApprove = async (membershipId) => {
try {
setActionLoading(membershipId);
setError("");
setSuccessMessage("");


  await api.patch(
    `/memberships/${membershipId}/approve`
  );

  setSuccessMessage("Membership approved successfully.");

  await loadMembers();
} catch (error) {
  console.error("Approve membership error:", error);

  setError(
    error.response?.data?.message ||
      "Failed to approve membership."
  );
} finally {
  setActionLoading(null);
}


};

const handleReject = async (membershipId) => {
try {
setActionLoading(membershipId);
setError("");
setSuccessMessage("");


  await api.patch(
    `/memberships/${membershipId}/reject`
  );

  setSuccessMessage("Membership rejected successfully.");

  await loadMembers();
} catch (error) {
  console.error("Reject membership error:", error);

  setError(
    error.response?.data?.message ||
      "Failed to reject membership."
  );
} finally {
  setActionLoading(null);
}


};

if (loading) {
return ( <div className="flex min-h-[60vh] items-center justify-center"> <div className="flex items-center gap-3 text-sm text-gray-500"> <Loader2 className="h-5 w-5 animate-spin" />
Loading members... </div> </div>
);
}

return ( <div className="space-y-6">
{/* Header */} <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"> <div>
<Link
to={`/admin/equbs/${equbId}`}
className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900"
> <ArrowLeft className="h-4 w-4" />
Back to Equb </Link>


      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-900 text-white">
          <Users className="h-5 w-5" />
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Members
          </h1>

          <p className="text-sm text-gray-500">
            {equb?.name || "Equb members"}
          </p>
        </div>
      </div>
    </div>
  </div>

  {/* Messages */}
  {error && (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {error}
    </div>
  )}

  {successMessage && (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      {successMessage}
    </div>
  )}

  {/* Summary */}
  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
    {[
      {
        key: "ALL",
        label: "All Members",
      },
      {
        key: "ACTIVE",
        label: "Active",
      },
      {
        key: "PENDING",
        label: "Pending",
      },
      {
        key: "REJECTED",
        label: "Rejected",
      },
    ].map((item) => (
      <button
        key={item.key}
        onClick={() => setActiveFilter(item.key)}
        className={`rounded-2xl border p-4 text-left transition ${
          activeFilter === item.key
            ? "border-gray-900 bg-gray-900 text-white"
            : "border-gray-200 bg-white hover:border-gray-300"
        }`}
      >
        <p
          className={`text-sm ${
            activeFilter === item.key
              ? "text-gray-300"
              : "text-gray-500"
          }`}
        >
          {item.label}
        </p>

        <p className="mt-1 text-2xl font-bold">
          {counts[item.key]}
        </p>
      </button>
    ))}
  </div>

  {/* Empty state */}
  {filteredMemberships.length === 0 ? (
    <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
        <Users className="h-6 w-6 text-gray-400" />
      </div>

      <h2 className="mt-4 text-lg font-semibold text-gray-900">
        No members found
      </h2>

      <p className="mt-1 text-sm text-gray-500">
        There are no members in the selected category.
      </p>
    </div>
  ) : (
    <>
      {/* Desktop */}
      <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-6 py-4">Member</th>
                <th className="px-4 py-4">Shares</th>
                <th className="px-4 py-4">Contribution</th>
                <th className="px-4 py-4">Total Paid</th>
                <th className="px-4 py-4">Missed</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Requested</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {filteredMemberships.map((membership) => {
                const user = membership.user;
                const isPending =
                  membership.status === "PENDING";
                const isLoading =
                  actionLoading === membership.id;

                return (
                  <tr
                    key={membership.id}
                    className="hover:bg-gray-50/70"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {user?.profileImage ? (
                          <img
                            src={user.profileImage}
                            alt={getFullName(user)}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                            <UserRound className="h-5 w-5" />
                          </div>
                        )}

                        <div>
                          <p className="font-medium text-gray-900">
                            {getFullName(user)}
                          </p>

                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                            {user?.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3.5 w-3.5" />
                                {user.email}
                              </span>
                            )}

                            {user?.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3.5 w-3.5" />
                                {user.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-sm text-gray-700">
                      {Number(membership.shares || 0).toFixed(2)}
                    </td>

                    <td className="px-4 py-4 text-sm font-medium text-gray-900">
                      {formatAmount(
                        membership.contributionAmount,
                        membership.equb?.currency || "ETB"
                      )}
                    </td>

                    <td className="px-4 py-4 text-sm text-gray-700">
                      {formatAmount(
                        membership.totalPaid,
                        membership.equb?.currency || "ETB"
                      )}
                    </td>

                    <td className="px-4 py-4 text-sm text-gray-700">
                      {membership.missedPayments ?? 0}
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                          statusStyles[membership.status] ||
                          "bg-gray-100 text-gray-700 ring-gray-600/20"
                        }`}
                      >
                        {membership.status}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-sm text-gray-500">
                      {formatDate(membership.createdAt)}
                    </td>

                  
<td className="px-6 py-4">
  <div className="flex justify-end gap-2">
    <button
      onClick={() => handleApprove(membership.id)}
      disabled={isLoading || membership.status === "ACTIVE"}
      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Check className="h-4 w-4" />
      )}
      Approve
    </button>

    <button
      onClick={() => handleReject(membership.id)}
      disabled={isLoading || membership.status === "REJECTED"}
      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <X className="h-4 w-4" />
      Reject
    </button>
  </div>
</td>


                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile */}
      <div className="space-y-4 lg:hidden">
        {filteredMemberships.map((membership) => {
          const user = membership.user;
          const isPending =
            membership.status === "PENDING";
          const isLoading =
            actionLoading === membership.id;

          return (
            <div
              key={membership.id}
              className="rounded-2xl border border-gray-200 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  {user?.profileImage ? (
                    <img
                      src={user.profileImage}
                      alt={getFullName(user)}
                      className="h-11 w-11 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                      <UserRound className="h-5 w-5" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">
                      {getFullName(user)}
                    </p>

                    {user?.email && (
                      <p className="mt-1 truncate text-xs text-gray-500">
                        {user.email}
                      </p>
                    )}

                    {user?.phone && (
                      <p className="mt-1 text-xs text-gray-500">
                        {user.phone}
                      </p>
                    )}
                  </div>
                </div>

                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                    statusStyles[membership.status] ||
                    "bg-gray-100 text-gray-700 ring-gray-600/20"
                  }`}
                >
                  {membership.status}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">
                    Shares
                  </p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {Number(membership.shares || 0).toFixed(2)}
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">
                    Contribution
                  </p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {formatAmount(
                      membership.contributionAmount,
                      membership.equb?.currency || "ETB"
                    )}
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">
                    Total Paid
                  </p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {formatAmount(
                      membership.totalPaid,
                      membership.equb?.currency || "ETB"
                    )}
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">
                    Missed Payments
                  </p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {membership.missedPayments ?? 0}
                  </p>
                </div>
              </div>

              <div className="mt-4 text-xs text-gray-500">
                Requested: {formatDate(membership.createdAt)}
              </div>

              {isPending && (
                <div className="mt-5 flex gap-2">
                  <button
                    onClick={() =>
                      handleApprove(membership.id)
                    }
                    disabled={isLoading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Approve
                  </button>

                  <button
                    onClick={() =>
                      handleReject(membership.id)
                    }
                    disabled={isLoading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  )}
</div>


);
};

export default MembersPage;
