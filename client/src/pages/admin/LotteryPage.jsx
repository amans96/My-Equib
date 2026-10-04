
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock3,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  XCircle,
  Zap,
} from "lucide-react";

import api from "../../services/api";

import {
  getLottery,
  getLotteryMembers,
  prepareLottery,
  addLotteryMember,
  removeLotteryMember,
  removePreviousWinners,
  startLottery,
  drawLottery,
} from "../../services/lotteryApi";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const getFullName = (user) => {
  if (!user) return "Unknown Member";

  return (
    `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
    "Unknown Member"
  );
};

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

const getPeriodStatusClasses = (status) => {
  switch (status) {
    case "OPEN":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";

    case "DRAW_PENDING":
      return "bg-amber-50 text-amber-700 ring-amber-200";

    case "DRAW_COMPLETED":
      return "bg-purple-50 text-purple-700 ring-purple-200";

    case "CLOSED":
      return "bg-gray-100 text-gray-700 ring-gray-200";

    default:
      return "bg-gray-100 text-gray-600 ring-gray-200";
  }
};

const getLotteryStatusClasses = (status) => {
  switch (status) {
    case "READY":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";

    case "RUNNING":
      return "bg-blue-50 text-blue-700 ring-blue-200";

    case "COMPLETED":
      return "bg-purple-50 text-purple-700 ring-purple-200";

    case "CANCELLED":
      return "bg-red-50 text-red-700 ring-red-200";

    default:
      return "bg-gray-100 text-gray-700 ring-gray-200";
  }
};

const getEntryStatusClasses = (member) => {
  if (!member?.lotteryEligible) {
    return "bg-gray-100 text-gray-500";
  }

  return member.entryType === "MANUAL"
    ? "bg-blue-50 text-blue-700"
    : "bg-emerald-50 text-emerald-700";
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

const LotteryPage = () => {
  const { equbId } = useParams();

  const [equb, setEqub] = useState(null);
  const [periods, setPeriods] = useState([]);

  const [selectedPeriodId, setSelectedPeriodId] =
    useState("");

  const [lottery, setLottery] = useState(null);
  const [members, setMembers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingLottery, setLoadingLottery] =
    useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [processingAction, setProcessingAction] =
    useState("");

  const [search, setSearch] = useState("");

  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const [showAddMember, setShowAddMember] =
    useState(false);

  const [allMembers, setAllMembers] = useState([]);
  const [loadingAllMembers, setLoadingAllMembers] =
    useState(false);

  /*
  |--------------------------------------------------------------------------
  | Load Equb + Periods
  |--------------------------------------------------------------------------
  */

  const loadPeriods = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setActionError("");

      const [equbResponse, periodsResponse] =
        await Promise.all([
          api.get(`/equbs/${equbId}`),
          api.get(`/equbs/${equbId}/periods`),
        ]);

      const equbData =
        equbResponse.data?.equb ||
        equbResponse.data?.data ||
        equbResponse.data;

      const periodsData =
        periodsResponse.data?.periods ||
        periodsResponse.data?.data ||
        periodsResponse.data ||
        [];

      setEqub(equbData);
      setPeriods(periodsData);

      /*
       * Preserve the current selection when refreshing.
       * Otherwise select the first period that looks
       * relevant for lottery management.
       */

      if (
        selectedPeriodId &&
        periodsData.some(
          (period) => period.id === selectedPeriodId
        )
      ) {
        return;
      }

      const preferredPeriod =
        periodsData.find(
          (period) =>
            period.status === "DRAW_PENDING"
        ) ||
        periodsData.find(
          (period) =>
            period.status === "OPEN"
        ) ||
        periodsData[0];

      if (preferredPeriod) {
        setSelectedPeriodId(preferredPeriod.id);
      }
    } catch (error) {
      console.error(
        "Failed to load lottery periods:",
        error
      );

      setActionError(
        error.response?.data?.message ||
          "Failed to load Equb payment periods."
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

  /*
  |--------------------------------------------------------------------------
  | Load Lottery
  |--------------------------------------------------------------------------
  */

  const loadLottery = async (isRefresh = false) => {
    if (!selectedPeriodId) {
      setLottery(null);
      setMembers([]);
      return;
    }

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoadingLottery(true);
      }

      setActionError("");

      const [lotteryResponse, membersResponse] =
        await Promise.all([
          getLottery(selectedPeriodId),
          getLotteryMembers(selectedPeriodId),
        ]);

    const lotteryData =
  lotteryResponse.data?.lottery ||
  lotteryResponse.lottery ||
  null;

const membersData =
  membersResponse.data?.members ||
  membersResponse.members ||
  [];

setLottery(lotteryData);

setMembers(
  Array.isArray(membersData) ? membersData : []
);
    } catch (error) {
      console.error(
        "Failed to load lottery:",
        error
      );

      setActionError(
        error.response?.data?.message ||
          "Failed to load lottery information."
      );
    } finally {
      setLoadingLottery(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (selectedPeriodId) {
      loadLottery();
    }
  }, [selectedPeriodId]);

  /*
  |--------------------------------------------------------------------------
  | Messages
  |--------------------------------------------------------------------------
  */

  const clearMessages = () => {
    setActionError("");
    setActionSuccess("");
  };

  /*
  |--------------------------------------------------------------------------
  | Selected Period
  |--------------------------------------------------------------------------
  */

  const selectedPeriod = useMemo(() => {
    return (
      periods.find(
        (period) => period.id === selectedPeriodId
      ) || null
    );
  }, [periods, selectedPeriodId]);

  /*
  |--------------------------------------------------------------------------
  | Search Lottery Members
  |--------------------------------------------------------------------------
  */

const filteredMembers = useMemo(() => {
  const value = search.trim().toLowerCase();

  if (!value) {
    return members;
  }

  return members.filter((member) => {
    const name = getFullName({
      firstName: member.firstName,
      lastName: member.lastName,
    });

    const memberNumber =
      member.memberNumber || "";

    return (
      name.toLowerCase().includes(value) ||
      String(memberNumber)
        .toLowerCase()
        .includes(value)
    );
  });
}, [members, search]);

  /*
  |--------------------------------------------------------------------------
  | Statistics
  |--------------------------------------------------------------------------
  */

const eligibleMembers = useMemo(() => {
  return members.filter(
    (member) => member.lotteryEligible === true
  );
}, [members]);

const participantCount = eligibleMembers.length;

const totalTickets = useMemo(() => {
  return eligibleMembers.reduce(
    (total, member) => total + Number(member.ticketCount || 0),
    0
  );
}, [eligibleMembers]);

  /*
  |--------------------------------------------------------------------------
  | Prepare Lottery
  |--------------------------------------------------------------------------
  */

  const handlePrepareLottery = async () => {
    if (!selectedPeriodId) return;

    clearMessages();

    try {
      setProcessingAction("prepare");

      const response =
        await prepareLottery(selectedPeriodId);

      setActionSuccess(
        response.message ||
          "Lottery prepared successfully."
      );

      await loadLottery(true);
    } catch (error) {
      console.error(
        "Prepare lottery failed:",
        error
      );

      setActionError(
        error.response?.data?.message ||
          error.message ||
          "Failed to prepare lottery."
      );
    } finally {
      setProcessingAction("");
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Remove Previous Winners
  |--------------------------------------------------------------------------
  */

  const handleRemovePreviousWinners = async () => {
    if (!selectedPeriodId) return;

    const confirmed = window.confirm(
      "Remove all previous winners from this lottery pool?"
    );

    if (!confirmed) {
      return;
    }

    clearMessages();

    try {
      setProcessingAction(
        "remove-previous-winners"
      );

      const response =
        await removePreviousWinners(
          selectedPeriodId
        );

      setActionSuccess(
        response.message ||
          "Previous winners removed from the lottery."
      );

      await loadLottery(true);
    } catch (error) {
      console.error(
        "Remove previous winners failed:",
        error
      );

      setActionError(
        error.response?.data?.message ||
          error.message ||
          "Failed to remove previous winners."
      );
    } finally {
      setProcessingAction("");
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Remove Member
  |--------------------------------------------------------------------------
  */

  const handleRemoveMember = async (entry) => {
    const membershipId =
      entry.membershipId ||
      entry.membership?.id;

    if (!membershipId || !selectedPeriodId) {
      return;
    }

    const memberName = getFullName(
      entry.user || entry.membership?.user
    );

    const confirmed = window.confirm(
      `Remove ${memberName} from this lottery pool?`
    );

    if (!confirmed) {
      return;
    }

    clearMessages();

    try {
      setProcessingAction(
        `remove-${membershipId}`
      );

      const response =
        await removeLotteryMember(
          selectedPeriodId,
          membershipId
        );

      setActionSuccess(
        response.message ||
          `${memberName} was removed from the lottery.`
      );

      await loadLottery(true);
    } catch (error) {
      console.error(
        "Remove lottery member failed:",
        error
      );

      setActionError(
        error.response?.data?.message ||
          error.message ||
          "Failed to remove lottery member."
      );
    } finally {
      setProcessingAction("");
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Load Members For Manual Addition
  |--------------------------------------------------------------------------
  */

  const loadAllMembers = async () => {
    try {
      setLoadingAllMembers(true);

      const response = await api.get(
        `/equbs/${equbId}/members`
      );

      const data =
        response.data?.members ||
        response.data?.data ||
        response.data ||
        [];

      setAllMembers(
        Array.isArray(data) ? data : []
      );
    } catch (error) {
      console.error(
        "Failed to load Equb members:",
        error
      );

      setActionError(
        error.response?.data?.message ||
          "Failed to load Equb members."
      );
    } finally {
      setLoadingAllMembers(false);
    }
  };

  const openAddMember = async () => {
    clearMessages();
    setShowAddMember(true);

    if (allMembers.length === 0) {
      await loadAllMembers();
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Add Member
  |--------------------------------------------------------------------------
  */
const handleAddMember = async (member) => {
  const membershipId =
    member.membershipId || member.id;

  if (!membershipId || !selectedPeriodId) {
    return;
  }

  const memberName = getFullName(
    member.user || {
      firstName: member.firstName,
      lastName: member.lastName,
    }
  );

  clearMessages();

  try {
    setProcessingAction(
      `add-${membershipId}`
    );

    const response =
      await addLotteryMember(
        selectedPeriodId,
        membershipId
      );

    setActionSuccess(
      response.message ||
        `${memberName} is now eligible for this lottery.`
    );

    await loadLottery(true);
  } catch (error) {
    console.error(
      "Add lottery member failed:",
      error
    );

    setActionError(
      error.response?.data?.message ||
        error.message ||
        "Failed to make member eligible."
    );
  } finally {
    setProcessingAction("");
  }
};

  /*
  |--------------------------------------------------------------------------
  | Start Lottery
  |--------------------------------------------------------------------------
  */

  const handleStartLottery = async () => {
    if (!selectedPeriodId) return;

    const confirmed = window.confirm(
      "Start this lottery? The participant pool will be frozen and the draw can then be executed."
    );

    if (!confirmed) {
      return;
    }

    clearMessages();

    try {
      setProcessingAction("start");

      const response =
        await startLottery(selectedPeriodId);

      setActionSuccess(
        response.message ||
          "Lottery started successfully."
      );

      await loadLottery(true);
    } catch (error) {
      console.error(
        "Start lottery failed:",
        error
      );

      setActionError(
        error.response?.data?.message ||
          error.message ||
          "Failed to start lottery."
      );
    } finally {
      setProcessingAction("");
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Draw Winner
  |--------------------------------------------------------------------------
  */

  const handleDrawWinner = async () => {
    if (!selectedPeriodId) return;

    const confirmed = window.confirm(
      "Execute the lottery draw now? This will permanently select the winner for this period."
    );

    if (!confirmed) {
      return;
    }

    clearMessages();

    try {
      setProcessingAction("draw");

      const response =
        await drawLottery(selectedPeriodId);

      setActionSuccess(
        response.message ||
          "Lottery winner selected successfully."
      );

      await loadLottery(true);
    } catch (error) {
      console.error(
        "Draw lottery failed:",
        error
      );

      setActionError(
        error.response?.data?.message ||
          error.message ||
          "Failed to draw lottery winner."
      );
    } finally {
      setProcessingAction("");
    }
  };

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
            size={20}
            className="animate-spin"
          />

          Loading lottery management...
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
    <div className="mx-auto max-w-7xl space-y-6">
      {/* HEADER */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            to={`/admin/equbs/${equbId}`}
            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900"
          >
            <ArrowLeft size={16} />

            Back to Equb
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-900">
              <Trophy
                size={21}
                className="text-white"
              />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                Lottery Management
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                {equb?.name || "Equb"} · Manage
                participants and draw winners.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            loadPeriods(true);
            if (selectedPeriodId) {
              loadLottery(true);
            }
          }}
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

      {/* ERROR */}

      {actionError && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <XCircle
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

      {/* SUCCESS */}

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

      {/* PERIOD SELECTOR */}

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Clock3
                size={18}
                className="text-gray-600"
              />

              <h2 className="font-semibold text-gray-900">
                Payment Period
              </h2>
            </div>

            <p className="mt-1 text-sm text-gray-500">
              Select the payment period whose lottery
              you want to manage.
            </p>

            <div className="mt-4">
              <select
                value={selectedPeriodId}
                onChange={(event) =>
                  setSelectedPeriodId(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white lg:max-w-xl"
              >
                <option value="">
                  Select payment period
                </option>

                {periods.map((period) => (
                  <option
                    key={period.id}
                    value={period.id}
                  >
                    Period {period.periodNumber} ·{" "}
                    {formatDate(period.startDate)} →{" "}
                    {formatDate(period.dueDate)} ·{" "}
                    {period.status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedPeriod && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-xs font-medium text-gray-500">
                Period Status
              </p>

              <span
                className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getPeriodStatusClasses(
                  selectedPeriod.status
                )}`}
              >
                {selectedPeriod.status}
              </span>
            </div>
          )}
        </div>
      </div>

      {!selectedPeriodId ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
          <Trophy
            size={42}
            className="mx-auto text-gray-300"
          />

          <h2 className="mt-4 text-lg font-semibold text-gray-900">
            Select a payment period
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Choose a payment period above to manage
            its lottery.
          </p>
        </div>
      ) : loadingLottery ? (
        <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <Loader2
              size={20}
              className="animate-spin"
            />

            Loading lottery...
          </div>
        </div>
      ) : (
        <>
          {/* LOTTERY STATUS */}

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Lottery Draw #
                    {lottery?.drawNumber || "—"}
                  </h2>

                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getLotteryStatusClasses(
                      lottery?.status
                    )}`}
                  >
                    {lottery?.status ||
                      "PENDING"}
                  </span>
                </div>

                <p className="mt-1 text-sm text-gray-500">
                  Period{" "}
                  {selectedPeriod?.periodNumber}
                  {" · "}
                  {formatDate(
                    selectedPeriod?.startDate
                  )}
                  {" → "}
                  {formatDate(
                    selectedPeriod?.dueDate
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to={`/admin/equbs/${equbId}/periods/${selectedPeriodId}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  View Period
                </Link>
              </div>
            </div>
          </div>

          {/* STATS */}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              icon={Users}
              label="Participants"
              value={
                lottery?.participantCount ??
                participantCount
              }
              description="Unique members"
            />

            <StatCard
              icon={Award}
              label="Tickets"
              value={totalTickets}
              description="Weighted lottery entries"
            />

            <StatCard
              icon={Trophy}
              label="Previous Winners"
              value={
                lottery?.previousWinnerCount ??
                0
              }
              description="Winners from earlier draws"
            />
          </div>

          {/* CONTROLS */}

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <div>
              <h2 className="font-semibold text-gray-900">
                Lottery Controls
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Prepare the participant pool, make
                manual adjustments, then start and
                execute the draw.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handlePrepareLottery}
                disabled={
                  processingAction !== "" ||
                  lottery?.status === "RUNNING" ||
                  lottery?.status === "COMPLETED"
                }
                className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {processingAction ===
                "prepare" ? (
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                ) : (
                  <Zap size={16} />
                )}

                Prepare Lottery
              </button>

              <button
                type="button"
                onClick={openAddMember}
                disabled={
                  processingAction !== "" ||
                  lottery?.status === "RUNNING" ||
                  lottery?.status === "COMPLETED"
                }
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UserPlus size={16} />

                Add Member
              </button>

              <button
                type="button"
                onClick={
                  handleRemovePreviousWinners
                }
                disabled={
                  processingAction !== "" ||
                  lottery?.status === "RUNNING" ||
                  lottery?.status === "COMPLETED"
                }
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {processingAction ===
                "remove-previous-winners" ? (
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                ) : (
                  <Trash2 size={16} />
                )}

                Remove Previous Winners
              </button>

              <div className="flex-1" />

              {lottery?.status === "READY" && (
                <button
                  type="button"
                  onClick={handleStartLottery}
              disabled={
  processingAction !== "" ||
  eligibleMembers.length === 0
}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processingAction ===
                  "start" ? (
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <Zap size={16} />
                  )}

                  Start Lottery
                </button>
              )}

              {lottery?.status === "RUNNING" && (
                <button
                  type="button"
                  onClick={handleDrawWinner}
                  disabled={
                    processingAction !== ""
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processingAction ===
                  "draw" ? (
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <Trophy size={16} />
                  )}

                  Draw Winner
                </button>
              )}
            </div>
          </div>

          {/* WINNER */}

          {lottery?.winnerMembership && (
            <div className="overflow-hidden rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-white p-6 shadow-sm">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-100">
                  <Trophy
                    size={30}
                    className="text-purple-700"
                  />
                </div>

                <p className="mt-4 text-sm font-semibold uppercase tracking-wider text-purple-600">
                  Lottery Winner
                </p>

                <h2 className="mt-2 text-2xl font-bold text-gray-900">
                  {getFullName(
                    lottery.winnerMembership
                      ?.user
                  )}
                </h2>

                {lottery
                  .winnerMembership
                  ?.memberNumber && (
                  <p className="mt-1 text-sm text-gray-500">
                    #
                    {
                      lottery
                        .winnerMembership
                        .memberNumber
                    }
                  </p>
                )}

                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-200">
                    Winner selected
                  </span>

                  <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-200">
                    Draw #
                    {lottery.drawNumber}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* PARTICIPANTS */}

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-gray-200 px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">
                    Lottery Participants
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Each ticket represents one chance
                    in the weighted draw.
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
                      setSearch(
                        event.target.value
                      )
                    }
                    placeholder="Search participants..."
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-gray-400 focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* DESKTOP */}

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[900px]">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Member
                    </th>

                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Shares
                    </th>

                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Tickets
                    </th>

                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Entry
                    </th>

                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Status
                    </th>

                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>

              <tbody>
  {filteredMembers.map((member) => {
    const name = getFullName({
      firstName: member.firstName,
      lastName: member.lastName,
    });

    const eligible = member.lotteryEligible === true;

    const processingRemove =
      processingAction ===
      `remove-${member.membershipId}`;

    const processingAdd =
      processingAction ===
      `add-${member.membershipId}`;

    const paymentStatus =
      member.payment?.status || "NO PAYMENT";

    return (
      <tr
        key={member.membershipId}
        className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
      >
        {/* MEMBER */}
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100">
              {member.profileImage ? (
                <img
                  src={member.profileImage}
                  alt={name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Users
                  size={17}
                  className="text-gray-600"
                />
              )}
            </div>

            <div>
              <p className="font-semibold text-gray-900">
                {name}
              </p>

              <p className="mt-1 text-xs text-gray-500">
                {member.memberNumber
                  ? `#${member.memberNumber}`
                  : "No member number"}
              </p>
            </div>
          </div>
        </td>

        {/* SHARES */}
        <td className="px-6 py-4 text-center">
          <span className="font-semibold text-gray-900">
            {member.shares}
          </span>
        </td>

        {/* TICKETS */}
        <td className="px-6 py-4 text-center">
          <span className="font-bold text-gray-900">
            {member.ticketCount}
          </span>

          {!eligible && (
            <p className="mt-1 text-[11px] text-gray-400">
              {member.possibleTicketCount} if eligible
            </p>
          )}
        </td>

        {/* ENTRY */}
        <td className="px-6 py-4 text-center">
          {eligible ? (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                member.entryType === "MANUAL"
                  ? "bg-blue-50 text-blue-700"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {member.entryType || "AUTOMATIC"}
            </span>
          ) : (
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
              —
            </span>
          )}
        </td>

        {/* STATUS */}
        <td className="px-6 py-4 text-center">
          <div className="flex flex-col items-center gap-1">
            {eligible ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 size={14} />
                Eligible
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                <XCircle size={14} />
                Not Eligible
              </span>
            )}

            <span
              className={`text-[11px] font-medium ${
                paymentStatus === "VERIFIED"
                  ? "text-emerald-600"
                  : "text-gray-400"
              }`}
            >
              Payment: {paymentStatus}
            </span>
          </div>
        </td>

        {/* ACTIONS */}
        <td className="px-6 py-4 text-right">
          {lottery?.status !== "RUNNING" &&
            lottery?.status !== "COMPLETED" && (
              <>
                {eligible ? (
                  <button
                    type="button"
                    onClick={() =>
                      handleRemoveMember(member)
                    }
                    disabled={
                      processingAction !== "" ||
                      processingRemove
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {processingRemove ? (
                      <Loader2
                        size={14}
                        className="animate-spin"
                      />
                    ) : (
                      <Trash2 size={14} />
                    )}

                    Make Ineligible
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      handleAddMember(member)
                    }
                    disabled={
                      processingAction !== "" ||
                      processingAdd
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {processingAdd ? (
                      <Loader2
                        size={14}
                        className="animate-spin"
                      />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}

                    Make Eligible
                  </button>
                )}
              </>
            )}
        </td>
      </tr>
    );
  })}

  {filteredMembers.length === 0 && (
    <tr>
      <td
        colSpan={6}
        className="px-6 py-14 text-center"
      >
        <Users
          size={34}
          className="mx-auto text-gray-300"
        />

        <p className="mt-3 text-sm font-medium text-gray-900">
          No active Equb members
        </p>

        <p className="mt-1 text-sm text-gray-500">
          There are currently no active members
          in this Equb.
        </p>
      </td>
    </tr>
  )}
</tbody>
              </table>
            </div>

            {/* MOBILE */}

        <div className="space-y-3 p-4 lg:hidden">
  {filteredMembers.map((member) => {
    const name = getFullName({
      firstName: member.firstName,
      lastName: member.lastName,
    });

    const eligible =
      member.lotteryEligible === true;

    const membershipId =
      member.membershipId;

    const processingRemove =
      processingAction ===
      `remove-${membershipId}`;

    const processingAdd =
      processingAction ===
      `add-${membershipId}`;

    return (
      <div
        key={membershipId}
        className="rounded-2xl border border-gray-200 p-4"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
            <Users
              size={17}
              className="text-gray-600"
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900">
              {name}
            </p>

            <p className="mt-1 text-xs text-gray-500">
              {member.memberNumber
                ? `#${member.memberNumber}`
                : "No member number"}
            </p>
          </div>

          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
              eligible
                ? "bg-emerald-50 text-emerald-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {eligible
              ? "Eligible"
              : "Not Eligible"}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-gray-500">
              Shares
            </p>

            <p className="mt-1 font-semibold text-gray-900">
              {member.shares}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500">
              Tickets
            </p>

            <p className="mt-1 font-semibold text-gray-900">
              {member.ticketCount}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500">
              Payment
            </p>

            <p
              className={`mt-1 text-xs font-semibold ${
                member.payment?.status ===
                "VERIFIED"
                  ? "text-emerald-600"
                  : "text-gray-500"
              }`}
            >
              {member.payment?.status ||
                "NO PAYMENT"}
            </p>
          </div>
        </div>

        {lottery?.status !== "RUNNING" &&
          lottery?.status !== "COMPLETED" && (
            <>
              {eligible ? (
                <button
                  type="button"
                  onClick={() =>
                    handleRemoveMember(member)
                  }
                  disabled={
                    processingAction !== "" ||
                    processingRemove
                  }
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processingRemove ? (
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <Trash2 size={16} />
                  )}

                  Make Ineligible
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    handleAddMember(member)
                  }
                  disabled={
                    processingAction !== "" ||
                    processingAdd
                  }
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processingAdd ? (
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}

                  Make Eligible
                </button>
              )}
            </>
          )}
      </div>
    );
  })}

  {filteredMembers.length === 0 && (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-6 py-12 text-center">
      <Users
        size={34}
        className="mx-auto text-gray-300"
      />

      <p className="mt-3 text-sm font-medium text-gray-900">
        No active Equb members
      </p>

      <p className="mt-1 text-sm text-gray-500">
        There are currently no active members
        in this Equb.
      </p>
    </div>
  )}
</div>
          </div>
        </>
      )}

      {/* ADD MEMBER MODAL */}

      {showAddMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-200 p-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Add Member to Lottery
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Manually add an active Equb member
                  to this period's lottery.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowAddMember(false)
                }
                className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-5">
              {loadingAllMembers ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />

                    Loading members...
                  </div>
                </div>
              ) : allMembers.length === 0 ? (
                <div className="py-12 text-center">
                  <Users
                    size={34}
                    className="mx-auto text-gray-300"
                  />

                  <p className="mt-3 text-sm font-medium text-gray-900">
                    No active members found
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allMembers.map(
                    (membership) => {
                      const membershipId =
                        membership.id ||
                        membership.membershipId;

                      const alreadyAdded =
                        members.some(
                          (entry) =>
                            entry.membershipId ===
                              membershipId ||
                            entry.membership?.id ===
                              membershipId
                        );

                      const name =
                        getFullName(
                          membership.user
                        );

                      const processing =
                        processingAction ===
                        `add-${membershipId}`;

                      return (
                        <div
                          key={membershipId}
                          className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 p-4"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
                              <Users
                                size={17}
                                className="text-gray-600"
                              />
                            </div>

                            <div className="min-w-0">
                              <p className="truncate font-semibold text-gray-900">
                                {name}
                              </p>

                              <p className="mt-1 text-xs text-gray-500">
                                {membership
                                  .memberNumber
                                  ? `#${membership.memberNumber}`
                                  : membership.user
                                      ?.phone ||
                                    membership.user
                                      ?.email ||
                                    "No contact"}
                              </p>
                            </div>
                          </div>

                          {alreadyAdded ? (
                            <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                              Already Added
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                handleAddMember(
                                  membership
                                )
                              }
                              disabled={
                                processingAction !==
                                  "" ||
                                processing
                              }
                              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {processing ? (
                                <Loader2
                                  size={14}
                                  className="animate-spin"
                                />
                              ) : (
                                <Plus
                                  size={14}
                                />
                              )}

                              Add
                            </button>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-gray-200 p-5">
              <button
                type="button"
                onClick={() =>
                  setShowAddMember(false)
                }
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LotteryPage;

