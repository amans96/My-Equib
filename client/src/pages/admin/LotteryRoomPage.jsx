import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Crown,
  Dices,
  Loader2,
  Sparkles,
  Trophy,
  Users,
  Ticket,
  Zap,
} from "lucide-react";

import {
  getLottery,
  startLottery,
  drawLottery,
} from "../../services/lotteryApi";

const getFullName = (user) => {
  if (!user) return "Unknown Member";

  return `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown Member";
};

const getInitials = (user) => {
  const name = getFullName(user);

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
};

const formatDate = (date) => {
  if (!date) return "—";

  try {
    return new Date(date).toLocaleString();
  } catch {
    return "—";
  }
};

const getStatusStyle = (status) => {
  switch (status) {
    case "PENDING":
      return "bg-gray-100 text-gray-700 border-gray-200";

    case "READY":
      return "bg-blue-50 text-blue-700 border-blue-200";

    case "RUNNING":
      return "bg-amber-50 text-amber-700 border-amber-200";

    case "COMPLETED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "CANCELLED":
      return "bg-red-50 text-red-700 border-red-200";

    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
};

const getTicketNumber = (entry) => {
  return String(entry?.ticketNumber || "").toUpperCase();
};

export default function LotteryRoomPage() {
  const { equbId, periodId } = useParams();
  const navigate = useNavigate();

  const [lottery, setLottery] = useState(null);
  const [period, setPeriod] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [starting, setStarting] = useState(false);
  const [drawing, setDrawing] = useState(false);

  /*
   * This is the winner returned by the backend.
   *
   * IMPORTANT:
   * The animation never decides the winner.
   * The backend already selected it using crypto.randomInt().
   */
  const [drawResult, setDrawResult] = useState(null);

  /*
   * The ticket currently displayed by the animation.
   */
  const [displayedTicket, setDisplayedTicket] = useState(null);

  /*
   * Controls the visual phases of the draw.
   */
  const [drawPhase, setDrawPhase] = useState("idle");

  const animationTimerRef = useRef(null);
  const animationTimeoutRef = useRef(null);

  const loadLottery = useCallback(
    async (silent = false) => {
      try {
        if (!silent) {
          setLoading(true);
        }

        setError("");

        const response = await getLottery(periodId);

        const payload =
          response?.data?.data ||
          response?.data ||
          response;

        const lotteryData =
          payload?.lottery ||
          payload?.data?.lottery ||
          null;

        const periodData =
          payload?.period ||
          payload?.data?.period ||
          null;

        setLottery(lotteryData);
        setPeriod(periodData);
      } catch (err) {
        console.error("Load lottery error:", err);

        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to load lottery."
        );
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [periodId]
  );

  useEffect(() => {
    loadLottery();

    return () => {
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }

      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [loadLottery]);

  /*
   * Only currently eligible tickets belong in the visual pool.
   */
  const entries = useMemo(() => {
    return (lottery?.entries || [])
      .filter((entry) => entry?.eligible === true)
      .sort((a, b) =>
        String(a.ticketNumber).localeCompare(
          String(b.ticketNumber),
          undefined,
          {
            numeric: true,
          }
        )
      );
  }, [lottery]);

  const participantCount = useMemo(() => {
    return new Set(
      entries
        .map((entry) => entry.membershipId)
        .filter(Boolean)
    ).size;
  }, [entries]);

  const totalTickets = entries.length;

  const winnerMembership = lottery?.winnerMembership || null;

  const winnerName = winnerMembership
    ? getFullName(winnerMembership.user)
    : drawResult?.winner
      ? `${drawResult.winner.firstName || ""} ${
          drawResult.winner.lastName || ""
        }`.trim()
      : "Winner";

  /*
   * Start the lottery.
   */
  const handleStartLottery = async () => {
    if (!lottery) return;

    if (lottery.status !== "READY") {
      return;
    }

    if (totalTickets === 0) {
      setError("There are no eligible tickets in the lottery.");
      return;
    }

    const confirmed = window.confirm(
      `Start the lottery with ${participantCount} participants and ${totalTickets} tickets?\n\nOnce started, the ticket pool will be frozen.`
    );

    if (!confirmed) return;

    try {
      setStarting(true);
      setError("");
      setSuccessMessage("");

      await startLottery(periodId);

      await loadLottery(true);

      setSuccessMessage(
        "Lottery started. The ticket pool is now frozen."
      );
    } catch (err) {
      console.error("Start lottery error:", err);

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to start lottery."
      );
    } finally {
      setStarting(false);
    }
  };

  /*
   * Random ticket used ONLY for the visual animation.
   *
   * This does NOT determine the winner.
   */
  const getRandomVisualTicket = useCallback(() => {
    if (!entries.length) return null;

    const index = Math.floor(Math.random() * entries.length);

    return entries[index];
  }, [entries]);

  /*
   * Run the visual spinning animation.
   *
   * The backend winner has already been selected before this starts.
   */
  const runWinnerAnimation = useCallback(
    (result) => {
      if (!result?.winningTicket || !entries.length) {
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        setDrawPhase("countdown");

        /*
         * Give the UI a short countdown before the actual spin.
         */
        let countdown = 3;

        const runCountdown = () => {
          if (countdown > 0) {
            setDisplayedTicket({
              ticketNumber: String(countdown),
              isCountdown: true,
            });

            countdown -= 1;

            animationTimerRef.current = setTimeout(
              runCountdown,
              700
            );

            return;
          }

          /*
           * Start the actual ticket animation.
           */
          setDrawPhase("spinning");

          const winningTicket = String(
            result.winningTicket
          ).toUpperCase();

          /*
           * Find the actual winning entry.
           */
          const winningEntry = entries.find(
            (entry) =>
              getTicketNumber(entry) === winningTicket
          );

          /*
           * Safety check.
           */
          if (!winningEntry) {
            console.error(
              "Winning ticket returned by backend was not found in the current pool:",
              winningTicket
            );

            setDisplayedTicket({
              ticketNumber: winningTicket,
              isWinningTicket: true,
            });

            setDrawPhase("winner");

            resolve();
            return;
          }

          /*
           * Number of visual changes.
           *
           * More tickets = longer/more exciting animation.
           */
          const minimumSpins = 35;
          const additionalSpins = Math.min(
            entries.length * 2,
            45
          );

          const totalSteps =
            minimumSpins + additionalSpins;

          let currentStep = 0;

          /*
           * The first part is fast.
           * The later part becomes slower.
           */
          const spin = () => {
            currentStep += 1;

            const progress =
              currentStep / totalSteps;

            /*
             * Ease-out timing.
             *
             * Starts fast and gradually slows down.
             */
            const easedProgress =
              1 -
              Math.pow(1 - progress, 3);

            /*
             * During the animation we can show random
             * tickets. On the final step we force the
             * actual backend-selected winner.
             */
            if (currentStep >= totalSteps) {
              setDisplayedTicket({
                ...winningEntry,
                isWinningTicket: true,
              });

              setDrawPhase("winner");

              resolve();

              return;
            }

            /*
             * Make it increasingly likely to move toward
             * the winner near the end.
             *
             * This is purely visual.
             */
            let nextTicket;

            if (
              progress > 0.82 &&
              Math.random() < easedProgress
            ) {
              nextTicket = winningEntry;
            } else {
              nextTicket = getRandomVisualTicket();
            }

            setDisplayedTicket(nextTicket);

            /*
             * Fast at the beginning.
             * Slow near the end.
             */
            const minDelay = 45;
            const maxDelay = 480;

            const delay =
              minDelay +
              (maxDelay - minDelay) *
                Math.pow(progress, 2.8);

            animationTimerRef.current = setTimeout(
              spin,
              delay
            );
          };

          spin();
        };

        runCountdown();
      });
    },
    [entries, getRandomVisualTicket]
  );

  /*
   * Draw the winner.
   */
  const handleDrawWinner = async () => {
    if (!lottery) return;

    if (lottery.status !== "RUNNING") {
      return;
    }

    if (drawing) {
      return;
    }

    if (totalTickets === 0) {
      setError("There are no eligible tickets.");
      return;
    }

    const confirmed = window.confirm(
      "Start the winner draw?\n\nThe lottery backend will securely select the winner and the room will animate to the winning ticket."
    );

    if (!confirmed) return;

    try {
      setDrawing(true);
      setError("");
      setSuccessMessage("");
      setDrawResult(null);
      setDisplayedTicket(null);
      setDrawPhase("preparing");

      /*
       * IMPORTANT:
       * The backend chooses the real winner here.
       */
      const response = await drawLottery(periodId);

      const payload =
        response?.data?.data ||
        response?.data ||
        response;

      const result = payload;

      if (!result?.winningTicket) {
        throw new Error(
          "The server did not return a winning ticket."
        );
      }

      /*
       * Store the authoritative result.
       *
       * Do NOT reload the lottery yet.
       * The animation must play first.
       */
      setDrawResult(result);

      /*
       * Animate toward the actual winner.
       */
      await runWinnerAnimation(result);

      /*
       * Give the winner reveal a little time.
       */
      await new Promise((resolve) => {
        animationTimeoutRef.current = setTimeout(
          resolve,
          1200
        );
      });

      setSuccessMessage(
        `Winner selected: ${result.winningTicket}`
      );

      /*
       * Now refresh the server state.
       *
       * At this point the animation and reveal are complete.
       */
      await loadLottery(true);
    } catch (err) {
      console.error("Draw winner error:", err);

      /*
       * If an animation timer is running, stop it.
       */
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }

      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }

      setDrawPhase("idle");

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to draw lottery winner."
      );
    } finally {
      setDrawing(false);
    }
  };

  const isReady = lottery?.status === "READY";
  const isRunning = lottery?.status === "RUNNING";
  const isCompleted = lottery?.status === "COMPLETED";

  /*
   * Current ticket shown in the machine.
   */
  const machineTicket = displayedTicket?.ticketNumber || "T000";

  /*
   * User shown during the winner reveal.
   */
  const revealedWinner =
    drawResult?.winner ||
    (displayedTicket?.isWinningTicket
      ? winnerMembership?.user
      : null);

  const revealedWinnerName = revealedWinner
    ? `${revealedWinner.firstName || ""} ${
        revealedWinner.lastName || ""
      }`.trim()
    : winnerName;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />

          <p className="text-slate-300">
            Loading lottery room...
          </p>
        </div>
      </div>
    );
  }

  if (error && !lottery) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        <div className="max-w-4xl mx-auto">
          <Link
            to={`/admin/equbs/${equbId}/lottery`}
            className="inline-flex items-center gap-2 text-slate-300 hover:text-white mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Lottery
          </Link>

          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
            <h2 className="text-xl font-semibold mb-2">
              Failed to load lottery
            </h2>

            <p className="text-red-200">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-indigo-600/10 blur-[140px] rounded-full" />

        <div className="absolute bottom-0 left-0 w-[500px] h-[400px] bg-purple-600/10 blur-[130px] rounded-full" />

        <div className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-cyan-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div>
            <Link
              to={`/admin/equbs/${equbId}/lottery`}
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Lottery
            </Link>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-400/20 flex items-center justify-center">
                <Dices className="w-6 h-6 text-indigo-400" />
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">
                  Lottery Room
                </h1>

                <p className="text-slate-400 text-sm mt-1">
                  {lottery?.drawNumber
                    ? `Draw #${lottery.drawNumber}`
                    : `Payment Period ${
                        period?.periodNumber || "—"
                      }`}
                </p>
              </div>
            </div>
          </div>

          <div
            className={`inline-flex items-center gap-2 self-start lg:self-auto px-4 py-2 rounded-full border text-sm font-medium ${getStatusStyle(
              lottery?.status
            )}`}
          >
            {lottery?.status === "RUNNING" && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}

            {lottery?.status}

          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            {successMessage}
          </div>
        )}

        {/* Main lottery machine */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl overflow-hidden">
            {/* Machine header */}
            <div className="border-b border-white/10 px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-indigo-300 text-sm font-semibold uppercase tracking-wider">
                  <Sparkles className="w-4 h-4" />
                  Live Draw
                </div>

                <h2 className="text-xl sm:text-2xl font-bold mt-1">
                  Choose the winning ticket
                </h2>

                <p className="text-slate-400 text-sm mt-1">
                  Every ticket has one chance. More shares means more tickets.
                </p>
              </div>

              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Clock3 className="w-4 h-4" />

                {lottery?.startedAt
                  ? `Started ${formatDate(lottery.startedAt)}`
                  : "Not started"}
              </div>
            </div>

            {/* Machine */}
            <div className="p-5 sm:p-8">
              <div className="relative mx-auto max-w-2xl">
                {/* Glow */}
                {(drawing || drawPhase === "winner") && (
                  <div className="absolute inset-0 bg-indigo-500/20 blur-[80px] rounded-full pointer-events-none" />
                )}

                {/* Machine frame */}
                <div
                  className={`
                    relative rounded-[2rem]
                    border
                    ${
                      drawing
                        ? "border-indigo-400/50 shadow-[0_0_80px_rgba(99,102,241,0.25)]"
                        : drawPhase === "winner"
                          ? "border-emerald-400/50 shadow-[0_0_80px_rgba(16,185,129,0.20)]"
                          : "border-white/10"
                    }
                    bg-slate-900/90
                    overflow-hidden
                    transition-all duration-500
                  `}
                >
                  {/* Top decoration */}
                  <div className="px-6 pt-6">
                    <div className="flex justify-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-400" />
                      <span className="w-2 h-2 rounded-full bg-yellow-400" />
                      <span className="w-2 h-2 rounded-full bg-green-400" />
                    </div>
                  </div>

                  {/* Machine screen */}
                  <div className="p-6 sm:p-10">
                    <div
                      className={`
                        relative
                        h-52 sm:h-64
                        rounded-3xl
                        border
                        flex
                        items-center
                        justify-center
                        overflow-hidden
                        bg-slate-950
                        ${
                          drawing
                            ? "border-indigo-400/40"
                            : drawPhase === "winner"
                              ? "border-emerald-400/40"
                              : "border-white/10"
                        }
                      `}
                    >
                      {/* Scan lines */}
                      {drawing && (
                        <div className="absolute inset-0 pointer-events-none opacity-20">
                          <div className="absolute inset-x-0 top-0 h-px bg-white animate-[scan_1.2s_linear_infinite]" />
                        </div>
                      )}

                      {/* Side glow */}
                      <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-indigo-500/10 to-transparent pointer-events-none" />

                      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />

                      {/* Ticket */}
                      <div
                        className={`
                          relative z-10
                          flex flex-col items-center
                          transition-all duration-300
                          ${
                            drawing
                              ? "scale-110"
                              : drawPhase === "winner"
                                ? "scale-125"
                                : "scale-100"
                          }
                        `}
                      >
                        {drawPhase === "countdown" ? (
                          <>
                            <div className="text-7xl sm:text-8xl font-black text-white tabular-nums">
                              {machineTicket}
                            </div>

                            <div className="text-sm text-indigo-300 uppercase tracking-[0.3em] mt-3">
                              Get Ready
                            </div>
                          </>
                        ) : (
                          <>
                            <div
                              className={`
                                text-6xl sm:text-8xl
                                font-black
                                tracking-tight
                                tabular-nums
                                ${
                                  drawPhase === "winner"
                                    ? "text-emerald-300"
                                    : "text-white"
                                }
                              `}
                            >
                              {machineTicket}
                            </div>

                            <div className="flex items-center gap-2 mt-4 text-slate-400">
                              <Ticket className="w-4 h-4" />

                              {drawPhase === "winner"
                                ? "WINNING TICKET"
                                : drawing
                                  ? "SELECTING..."
                                  : "LOTTERY TICKET"}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Machine bottom */}
                  <div className="border-t border-white/10 px-6 py-5">
                    <div className="flex items-center justify-center gap-2">
                      {drawing ? (
                        <>
                          <Zap className="w-5 h-5 text-amber-400 animate-pulse" />

                          <span className="text-amber-300 font-semibold">
                            Selecting winner...
                          </span>
                        </>
                      ) : drawPhase === "winner" ? (
                        <>
                          <Trophy className="w-5 h-5 text-emerald-400" />

                          <span className="text-emerald-300 font-semibold">
                            Winner selected!
                          </span>
                        </>
                      ) : (
                        <>
                          <Dices className="w-5 h-5 text-slate-400" />

                          <span className="text-slate-400">
                            {isReady
                              ? "Ready to draw"
                              : isRunning
                                ? "Ready to select winner"
                                : isCompleted
                                  ? "Draw completed"
                                  : "Lottery room"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Countdown / status text */}
              <div className="text-center mt-6">
                {drawPhase === "countdown" && (
                  <div>
                    <p className="text-2xl font-bold text-white">
                      Get ready...
                    </p>

                    <p className="text-slate-400 text-sm mt-1">
                      The winning ticket has already been securely selected.
                    </p>
                  </div>
                )}

                {drawPhase === "spinning" && (
                  <div>
                    <p className="text-2xl font-bold text-white">
                      🎰 Drawing...
                    </p>

                    <p className="text-slate-400 text-sm mt-1">
                      The tickets are spinning. Hold on...
                    </p>
                  </div>
                )}

                {drawPhase === "winner" && (
                  <div>
                    <p className="text-2xl font-bold text-emerald-300">
                      🎉 We have a winner!
                    </p>

                    <p className="text-slate-400 text-sm mt-1">
                      Winning ticket:{" "}
                      <span className="text-white font-bold">
                        {drawResult?.winningTicket ||
                          displayedTicket?.ticketNumber}
                      </span>
                    </p>
                  </div>
                )}

                {drawPhase === "idle" && isReady && (
                  <p className="text-slate-400">
                    Start the lottery to freeze the participant pool.
                  </p>
                )}

                {drawPhase === "idle" && isRunning && (
                  <p className="text-slate-400">
                    Everything is ready. Draw the winner.
                  </p>
                )}

                {isCompleted && (
                  <p className="text-slate-400">
                    This lottery has already been completed.
                  </p>
                )}
              </div>

              {/* Controls */}
              <div className="flex justify-center mt-8">
                {isReady && (
                  <button
                    type="button"
                    onClick={handleStartLottery}
                    disabled={starting}
                    className="
                      inline-flex items-center justify-center gap-3
                      px-7 py-3.5
                      rounded-xl
                      bg-indigo-600
                      hover:bg-indigo-500
                      disabled:opacity-50
                      disabled:cursor-not-allowed
                      text-white
                      font-semibold
                      shadow-lg shadow-indigo-900/30
                      transition
                    "
                  >
                    {starting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        Start Lottery
                      </>
                    )}
                  </button>
                )}

                {isRunning && (
                  <button
                    type="button"
                    onClick={handleDrawWinner}
                    disabled={drawing}
                    className="
                      relative
                      inline-flex items-center justify-center gap-3
                      px-8 py-4
                      rounded-xl
                      bg-gradient-to-r
                      from-purple-600
                      to-indigo-600
                      hover:from-purple-500
                      hover:to-indigo-500
                      disabled:opacity-50
                      disabled:cursor-not-allowed
                      text-white
                      font-bold
                      text-lg
                      shadow-xl
                      shadow-indigo-900/40
                      transition
                      overflow-hidden
                    "
                  >
                    {drawing && (
                      <span className="absolute inset-0 bg-white/10 animate-pulse" />
                    )}

                    <span className="relative flex items-center gap-3">
                      {drawing ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin" />
                          Drawing...
                        </>
                      ) : (
                        <>
                          <Dices className="w-6 h-6" />
                          Draw Winner
                        </>
                      )}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div className="space-y-6">
            {/* Stats */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-5">
              <h3 className="font-semibold text-white mb-5">
                Lottery Statistics
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-white/[0.04] border border-white/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-indigo-400" />

                    <span className="text-slate-400">
                      Participants
                    </span>
                  </div>

                  <span className="font-bold text-white">
                    {participantCount}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-white/[0.04] border border-white/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Ticket className="w-5 h-5 text-purple-400" />

                    <span className="text-slate-400">
                      Tickets
                    </span>
                  </div>

                  <span className="font-bold text-white">
                    {totalTickets}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-white/[0.04] border border-white/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-amber-400" />

                    <span className="text-slate-400">
                      Status
                    </span>
                  </div>

                  <span className="font-bold text-white">
                    {lottery?.status || "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Winner card */}
            {(isCompleted || drawPhase === "winner") && (
              <div className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-5">
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full" />

                <div className="relative">
                  <div className="flex items-center gap-2 text-emerald-300 text-sm font-semibold uppercase tracking-wider mb-4">
                    <Crown className="w-4 h-4" />
                    Winner
                  </div>

                  <div className="flex items-center gap-4">
                    {revealedWinner?.profileImage ? (
                      <img
                        src={revealedWinner.profileImage}
                        alt={revealedWinnerName}
                        className="w-14 h-14 rounded-full object-cover border-2 border-emerald-400/30"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-400/20 flex items-center justify-center text-emerald-300 font-bold">
                        {getInitials(revealedWinner)}
                      </div>
                    )}

                    <div>
                      <p className="font-bold text-white text-lg">
                        {revealedWinnerName}
                      </p>

                      <p className="text-emerald-300 text-sm font-semibold mt-0.5">
                        Ticket{" "}
                        {drawResult?.winningTicket ||
                          (lottery?.winnerMembership
                            ? "Winner"
                            : "—")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Pool summary */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">
                  Ticket Pool
                </h3>

                <span className="text-xs text-slate-500">
                  {entries.length} tickets
                </span>
              </div>

              <div className="max-h-80 overflow-y-auto pr-1">
                <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-3 gap-2">
                  {entries.map((entry) => {
                    const ticket = getTicketNumber(entry);

                    const isCurrent =
                      ticket ===
                      String(displayedTicket?.ticketNumber || "").toUpperCase();

                    const isWinner =
                      ticket ===
                      String(
                        drawResult?.winningTicket || ""
                      ).toUpperCase();

                    return (
                      <div
                        key={entry.id}
                        className={`
                          rounded-lg
                          px-2 py-2
                          text-center
                          text-xs
                          font-semibold
                          border
                          transition-all
                          ${
                            isWinner &&
                            drawPhase === "winner"
                              ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300"
                              : isCurrent && drawing
                                ? "border-indigo-400/50 bg-indigo-500/15 text-indigo-300 scale-105"
                                : "border-white/5 bg-white/[0.03] text-slate-400"
                          }
                        `}
                      >
                        {ticket}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Ticket details */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <h3 className="font-semibold text-white">
              Eligible Tickets
            </h3>

            <p className="text-sm text-slate-400 mt-1">
              Each ticket represents one chance in the draw.
            </p>
          </div>

          {entries.length === 0 ? (
            <div className="p-10 text-center">
              <Ticket className="w-10 h-10 text-slate-600 mx-auto mb-3" />

              <p className="text-slate-300 font-medium">
                No eligible tickets
              </p>

              <p className="text-slate-500 text-sm mt-1">
                Prepare the lottery and add eligible members before starting.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-white/5">
                    <th className="px-5 py-4">
                      Ticket
                    </th>

                    <th className="px-5 py-4">
                      Member
                    </th>

                    <th className="px-5 py-4">
                      Shares
                    </th>

                    <th className="px-5 py-4">
                      Entry Type
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]"
                    >
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-2">
                          <Ticket className="w-4 h-4 text-indigo-400" />

                          <span className="font-bold text-white">
                            {getTicketNumber(entry)}
                          </span>
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {entry.user?.profileImage ? (
                            <img
                              src={entry.user.profileImage}
                              alt={getFullName(entry.user)}
                              className="w-9 h-9 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-slate-300">
                              {getInitials(entry.user)}
                            </div>
                          )}

                          <div>
                            <p className="text-white font-medium">
                              {getFullName(entry.user)}
                            </p>

                            <p className="text-xs text-slate-500">
                              {entry.membership?.memberNumber ||
                                "No member number"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-slate-300">
                        {entry.membership?.shares
                          ? Number(
                              entry.membership.shares
                            )
                          : "—"}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`
                            inline-flex px-2.5 py-1 rounded-full
                            text-xs font-semibold
                            ${
                              entry.entryType ===
                              "AUTOMATIC"
                                ? "bg-blue-500/10 text-blue-300 border border-blue-400/10"
                                : "bg-purple-500/10 text-purple-300 border border-purple-400/10"
                            }
                          `}
                        >
                          {entry.entryType ||
                            "UNKNOWN"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0% {
            transform: translateY(0);
            opacity: 0;
          }

          20% {
            opacity: 1;
          }

          100% {
            transform: translateY(250px);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}