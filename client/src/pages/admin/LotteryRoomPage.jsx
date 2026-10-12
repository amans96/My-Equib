import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Crown,
  Dices,
  LayoutGrid,
  ListFilter,
  Loader2,
  PartyPopper,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";

import {
  getLottery,
  startLottery,
  drawLottery,
} from "../../services/lotteryApi";

/* ==========================================================================
   Casino-Grade Web Audio Synthesizer (Zero External Audio Files Needed)
   ========================================================================== */
class LotterySoundSynthesizer {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => { });
    }
  }

  playCountdownTick() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // High-energy digital click with resonant tone
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(640, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    } catch { }
  }

  playSpinClick() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // Mechanical casino tumbler click
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.035);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    } catch { }
  }

  playSuspense() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // Rising tension suspense drone
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = "sawtooth";
      osc1.frequency.setValueAtTime(160, now);
      osc1.frequency.exponentialRampToValueAtTime(480, now + 0.75);

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(164, now);
      osc2.frequency.exponentialRampToValueAtTime(484, now + 0.75);

      gain.gain.setValueAtTime(0.02, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.55);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.8);
      osc2.stop(now + 0.8);
    } catch { }
  }

  playFanfare() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // Rich celebratory fanfare: C5, E5, G5, B5, C6 + harmonic chime
      const notes = [
        { f: 523.25, d: 0.0 },
        { f: 659.25, d: 0.1 },
        { f: 783.99, d: 0.2 },
        { f: 987.77, d: 0.3 },
        { f: 1046.5, d: 0.42 },
        { f: 1318.51, d: 0.45 },
      ];

      notes.forEach(({ f, d }) => {
        const start = now + d;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(f, start);

        gain.gain.setValueAtTime(0.2, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.85);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.9);
      });
    } catch { }
  }

  destroy() {
    if (this.ctx) {
      this.ctx.close().catch(() => { });
      this.ctx = null;
    }
  }
}

/* ==========================================================================
   Helper Functions
   ========================================================================== */
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

const getStatusBadge = (status) => {
  switch (status) {
    case "PENDING":
      return {
        label: "PENDING",
        classes: "bg-slate-900/90 text-slate-300 border-slate-700/80",
        dot: "bg-slate-400",
      };
    case "READY":
      return {
        label: "READY TO START",
        classes:
          "bg-gradient-to-r from-sky-500/20 to-blue-500/20 text-sky-200 border-sky-400/40 shadow-[0_0_20px_rgba(56,189,248,0.25)]",
        dot: "bg-sky-400 animate-pulse",
      };
    case "RUNNING":
      return {
        label: "LOCKED & DRAW READY",
        classes:
          "bg-gradient-to-r from-amber-500/25 to-yellow-500/25 text-amber-200 border-amber-400/50 shadow-[0_0_25px_rgba(245,158,11,0.35)]",
        dot: "bg-amber-400 animate-ping",
      };
    case "COMPLETED":
      return {
        label: "DRAW COMPLETED",
        classes:
          "bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-200 border-emerald-400/40 shadow-[0_0_25px_rgba(16,185,129,0.3)]",
        dot: "bg-emerald-400",
      };
    case "CANCELLED":
      return {
        label: "CANCELLED",
        classes: "bg-rose-500/20 text-rose-300 border-rose-400/30",
        dot: "bg-rose-400",
      };
    default:
      return {
        label: status || "UNKNOWN",
        classes: "bg-slate-900/90 text-slate-300 border-slate-700/80",
        dot: "bg-slate-400",
      };
  }
};

const getTicketNumber = (entry) => {
  return String(entry?.ticketNumber || "").toUpperCase();
};

/* ==========================================================================
   Casino Gold & Multi-Color Foil Confetti Overlay
   ========================================================================== */
function ConfettiOverlay({ active, onDismiss }) {
  if (!active) return null;

  const confettiPieces = Array.from({ length: 48 }).map((_, i) => {
    const left = `${(i * 2.12 + 1) % 100}%`;
    const delay = `${((i * 61) % 1500) / 1000}s`;
    const duration = `${2.4 + ((i * 43) % 20) / 10}s`;
    const colors = [
      "bg-amber-300",
      "bg-yellow-400",
      "bg-amber-500",
      "bg-emerald-400",
      "bg-purple-400",
      "bg-cyan-300",
      "bg-pink-400",
      "bg-white",
    ];
    const color = colors[i % colors.length];
    const size =
      i % 4 === 0
        ? "w-3.5 h-6 rounded-sm rotate-12"
        : i % 3 === 0
          ? "w-2.5 h-2.5 rounded-full"
          : "w-2 h-4 rounded-sm";

    return (
      <div
        key={i}
        className={`absolute top-0 pointer-events-none ${size} ${color} shadow-[0_0_8px_rgba(255,255,255,0.4)] animate-confetti-fall`}
        style={{
          left,
          animationDelay: delay,
          animationDuration: duration,
        }}
      />
    );
  });

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {confettiPieces}
      <div className="absolute top-6 right-6 pointer-events-auto">
        <button
          onClick={onDismiss}
          className="px-3.5 py-1.5 rounded-full bg-slate-950/85 border border-amber-400/30 text-xs font-semibold text-amber-200 hover:text-white backdrop-blur-md shadow-xl hover:bg-slate-900 transition flex items-center gap-1.5"
        >
          <X className="w-3.5 h-3.5" />
          Dismiss Confetti
        </button>
      </div>
    </div>
  );
}

/* ==========================================================================
   Casino-Grade Confirmation Modal
   ========================================================================== */
function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText,
  variant = "primary",
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
    >
      <div className="relative w-full max-w-md rounded-3xl border border-amber-500/30 bg-gradient-to-b from-slate-900 via-slate-950 to-black p-6 sm:p-7 shadow-2xl shadow-amber-950/60 overflow-hidden">
        {/* Top Gold Shimmer Border */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-lg ${variant === "warning"
                ? "bg-amber-500/20 border-amber-400/40 text-amber-300 shadow-amber-900/40"
                : "bg-purple-500/20 border-purple-400/40 text-purple-300 shadow-purple-900/40"
                }`}
            >
              {variant === "warning" ? (
                <AlertCircle className="w-6 h-6" />
              ) : (
                <Dices className="w-6 h-6 animate-pulse" />
              )}
            </div>
            <h3 className="text-xl font-extrabold text-white tracking-tight">
              {title}
            </h3>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close modal"
            className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-slate-300 text-sm whitespace-pre-line leading-relaxed mb-6 font-medium">
          {message}
        </p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4.5 py-2.5 rounded-xl border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 text-sm font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-xl text-white text-sm font-bold shadow-xl transition transform active:scale-95 ${variant === "warning"
              ? "bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 shadow-amber-900/50"
              : "bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:via-indigo-500 hover:to-blue-500 shadow-purple-900/50"
              }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   Main Component: LotteryRoomPage
   ========================================================================== */
export default function LotteryRoomPage() {
  const { equbId, periodId } = useParams();

  const [lottery, setLottery] = useState(null);
  const [period, setPeriod] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [starting, setStarting] = useState(false);
  const [drawing, setDrawing] = useState(false);

  /* Sound State & Synthesizer */
  const [soundEnabled, setSoundEnabled] = useState(false);
  const soundSynthRef = useRef(null);
  const soundEnabledRef = useRef(false);

  /* Confirmation Modal State */
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "",
    variant: "primary",
    onConfirm: () => { },
  });

  /* Search & View Mode for Ticket Pool */
  const [ticketSearch, setTicketSearch] = useState("");
  const [poolViewMode, setPoolViewMode] = useState("grid"); // 'grid' | 'table'

  /* Confetti display */
  const [showConfetti, setShowConfetti] = useState(false);

  /* Authoritative backend draw result */
  const [drawResult, setDrawResult] = useState(null);

  /* Ticket currently rendered on the digital reels */
  const [displayedTicket, setDisplayedTicket] = useState(null);

  /* Visual draw phases: 'idle' | 'countdown' | 'spinning' | 'suspense' | 'winner' */
  const [drawPhase, setDrawPhase] = useState("idle");

  const animationTimerRef = useRef(null);
  const animationTimeoutRef = useRef(null);

  // Keep ref synchronized with soundEnabled state for use inside callbacks
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Audio synthesizer lifecycle
  useEffect(() => {
    soundSynthRef.current = new LotterySoundSynthesizer();
    return () => {
      if (soundSynthRef.current) {
        soundSynthRef.current.destroy();
      }
    };
  }, []);

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      if (next && soundSynthRef.current) {
        soundSynthRef.current.init();
      }
      return next;
    });
  };

  /*
   * Fetch lottery data from backend
   */
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

        // If page is already completed upon initial loading, trigger celebration banner
        if (lotteryData?.status === "COMPLETED") {
          setDrawPhase("winner");
        }
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
   * Only currently eligible tickets belong in the pool
   */
  const entries = useMemo(() => {
    return (lottery?.entries || [])
      .filter((entry) => entry?.eligible === true)
      .sort((a, b) =>
        String(a.ticketNumber).localeCompare(
          String(b.ticketNumber),
          undefined,
          { numeric: true }
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

  /*
   * Winner determination (preserves existing backend single source of truth)
   */
  const winnerMembership = lottery?.winnerMembership || null;

  const resolvedWinnerUser = useMemo(() => {
    return (
      drawResult?.winner ||
      winnerMembership?.user ||
      lottery?.winner ||
      (displayedTicket?.isWinningTicket && displayedTicket?.user
        ? displayedTicket.user
        : null) ||
      null
    );
  }, [drawResult, winnerMembership, lottery, displayedTicket]);

  const winnerName = useMemo(() => {
    if (resolvedWinnerUser) {
      return getFullName(resolvedWinnerUser);
    }
    if (winnerMembership?.user) {
      return getFullName(winnerMembership.user);
    }
    return "Grand Winner";
  }, [resolvedWinnerUser, winnerMembership]);

  const resolvedWinningTicket = useMemo(() => {
    if (drawResult?.winningTicket) {
      return String(drawResult.winningTicket).toUpperCase();
    }
    if (lottery?.winningTicket) {
      return String(lottery.winningTicket).toUpperCase();
    }
    if (lottery?.winnerTicket) {
      return String(lottery.winnerTicket).toUpperCase();
    }
    if (lottery?.winningEntry?.ticketNumber) {
      return String(lottery.winningEntry.ticketNumber).toUpperCase();
    }
    if (winnerMembership?.id) {
      const entry = entries.find(
        (e) => e.membershipId === winnerMembership.id
      );
      if (entry?.ticketNumber) {
        return String(entry.ticketNumber).toUpperCase();
      }
    }
    return null;
  }, [drawResult, lottery, winnerMembership, entries]);

  /*
   * Filtered tickets for searching in pool
   */
  const filteredEntries = useMemo(() => {
    if (!ticketSearch.trim()) return entries;
    const q = ticketSearch.trim().toLowerCase();
    return entries.filter((e) => {
      const ticketNum = getTicketNumber(e).toLowerCase();
      const userName = getFullName(e.user).toLowerCase();
      const memberNum = String(
        e.membership?.memberNumber || ""
      ).toLowerCase();
      return (
        ticketNum.includes(q) ||
        userName.includes(q) ||
        memberNum.includes(q)
      );
    });
  }, [entries, ticketSearch]);

  /*
   * Start Lottery Handler
   */
  const executeStartLottery = async () => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
    try {
      setStarting(true);
      setError("");
      setSuccessMessage("");

      await startLottery(periodId);
      await loadLottery(true);

      setSuccessMessage(
        "Lottery started successfully! The ticket pool is now frozen and ready to draw."
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

  const handleStartLottery = () => {
    if (!lottery || lottery.status !== "READY") return;

    if (totalTickets === 0) {
      setError("There are no eligible tickets in the lottery pool.");
      return;
    }

    setModalState({
      isOpen: true,
      title: "Start Lottery Session",
      message: `Lock in ${participantCount} participant(s) and ${totalTickets} ticket(s) for the official draw?\n\nOnce started, the ticket pool will be strictly frozen for fairness.`,
      confirmText: "Start & Freeze Pool",
      variant: "warning",
      onConfirm: executeStartLottery,
    });
  };

  /*
   * Random ticket for VISUAL animation only
   */
  const getRandomVisualTicket = useCallback(() => {
    if (!entries.length) return null;
    const index = Math.floor(Math.random() * entries.length);
    return entries[index];
  }, [entries]);

  /*
   * Winner visual animation
   * The backend winner was ALREADY selected and received prior to this function running.
   */
  const runWinnerAnimation = useCallback(
    (result) => {
      if (!result?.winningTicket || !entries.length) {
        return Promise.resolve();
      }

      const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      return new Promise((resolve) => {
        const winningTicket = String(result.winningTicket).toUpperCase();
        const winningEntry = entries.find(
          (entry) => getTicketNumber(entry) === winningTicket
        );

        // Immediate transition if user prefers reduced motion
        if (prefersReducedMotion) {
          setDrawPhase("winner");
          setDisplayedTicket(
            winningEntry || {
              ticketNumber: winningTicket,
              isWinningTicket: true,
            }
          );
          if (soundEnabledRef.current && soundSynthRef.current) {
            soundSynthRef.current.playFanfare();
          }
          setShowConfetti(true);
          resolve();
          return;
        }

        /* 1. Dramatic 3-2-1 Countdown */
        setDrawPhase("countdown");
        let countdown = 3;

        const runCountdown = () => {
          if (countdown > 0) {
            setDisplayedTicket({
              ticketNumber: String(countdown),
              isCountdown: true,
            });

            if (soundEnabledRef.current && soundSynthRef.current) {
              soundSynthRef.current.playCountdownTick();
            }

            countdown -= 1;
            animationTimerRef.current = setTimeout(runCountdown, 750);
            return;
          }

          /* 2. Rapid Reel Spinning Phase */
          setDrawPhase("spinning");

          if (!winningEntry) {
            console.error(
              "Winning ticket returned by backend was not found in current pool:",
              winningTicket
            );
            setDisplayedTicket({
              ticketNumber: winningTicket,
              isWinningTicket: true,
            });
            setDrawPhase("winner");
            if (soundEnabledRef.current && soundSynthRef.current) {
              soundSynthRef.current.playFanfare();
            }
            setShowConfetti(true);
            resolve();
            return;
          }

          const minimumSpins = 38;
          const additionalSpins = Math.min(entries.length * 2, 45);
          const totalSteps = minimumSpins + additionalSpins;
          let currentStep = 0;

          const spin = () => {
            currentStep += 1;
            const progress = currentStep / totalSteps;
            const easedProgress = 1 - Math.pow(1 - progress, 3);

            if (
              soundEnabledRef.current &&
              soundSynthRef.current &&
              currentStep % (progress > 0.75 ? 1 : 2) === 0
            ) {
              soundSynthRef.current.playSpinClick();
            }

            // Final step: trigger suspense moment before golden reveal!
            if (currentStep >= totalSteps) {
              setDrawPhase("suspense");
              setDisplayedTicket({
                ticketNumber: "•••",
                isSuspense: true,
              });

              if (soundEnabledRef.current && soundSynthRef.current) {
                soundSynthRef.current.playSuspense();
              }

              // Suspense pause (950ms)
              animationTimerRef.current = setTimeout(() => {
                setDisplayedTicket({
                  ...winningEntry,
                  isWinningTicket: true,
                });
                setDrawPhase("winner");

                if (soundEnabledRef.current && soundSynthRef.current) {
                  soundSynthRef.current.playFanfare();
                }

                setShowConfetti(true);
                resolve();
              }, 950);

              return;
            }

            let nextTicket;
            if (progress > 0.85 && Math.random() < easedProgress) {
              nextTicket = winningEntry;
            } else {
              nextTicket = getRandomVisualTicket();
            }

            setDisplayedTicket(nextTicket);

            const minDelay = 38;
            const maxDelay = 480;
            const delay =
              minDelay +
              (maxDelay - minDelay) * Math.pow(progress, 2.8);

            animationTimerRef.current = setTimeout(spin, delay);
          };

          spin();
        };

        runCountdown();
      });
    },
    [entries, getRandomVisualTicket]
  );

  /*
   * Execute Draw Winner after confirmation
   */
  const executeDrawWinner = async () => {
    setModalState((prev) => ({ ...prev, isOpen: false }));

    if (!lottery || lottery.status !== "RUNNING" || drawing) return;

    if (totalTickets === 0) {
      setError("There are no eligible tickets in this draw.");
      return;
    }

    try {
      setDrawing(true);
      setError("");
      setSuccessMessage("");
      setDrawResult(null);
      setDisplayedTicket(null);
      setShowConfetti(false);
      setDrawPhase("preparing");

      /*
       * AUTHORITATIVE: Backend determines winner securely with crypto.randomInt()
       */
      const response = await drawLottery(periodId);
      const payload =
        response?.data?.data ||
        response?.data ||
        response;

      const result = payload;

      if (!result?.winningTicket) {
        throw new Error(
          "The server did not return a valid winning ticket."
        );
      }

      setDrawResult(result);

      /*
       * Run frontend entertainment animation toward the authoritative winner
       */
      await runWinnerAnimation(result);

      /*
       * Settling buffer
       */
      await new Promise((resolve) => {
        animationTimeoutRef.current = setTimeout(resolve, 1100);
      });

      setSuccessMessage(
        `Official winner verified: Ticket ${result.winningTicket}!`
      );

      /*
       * Refresh official database state
       */
      await loadLottery(true);
    } catch (err) {
      console.error("Draw winner error:", err);
      if (animationTimerRef.current)
        clearTimeout(animationTimerRef.current);
      if (animationTimeoutRef.current)
        clearTimeout(animationTimeoutRef.current);
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

  const handleDrawWinner = () => {
    if (!lottery || lottery.status !== "RUNNING" || drawing) return;

    setModalState({
      isOpen: true,
      title: "Launch Grand Prize Draw",
      message:
        "Ready to spin the reels and reveal the official winner?\n\nThe server will cryptographically select the winning ticket, followed by the live game show draw animation.",
      confirmText: "Spin & Draw Winner",
      variant: "primary",
      onConfirm: executeDrawWinner,
    });
  };

  /* Lottery status convenience booleans */
  const isReady = lottery?.status === "READY";
  const isRunning = lottery?.status === "RUNNING";
  const isCompleted = lottery?.status === "COMPLETED";

  /* Machine digital display content */
  const machineTicket = useMemo(() => {
    if (displayedTicket?.ticketNumber) {
      return displayedTicket.ticketNumber;
    }
    if (isCompleted && resolvedWinningTicket) {
      return resolvedWinningTicket;
    }
    if (isReady) return "READY";
    if (isRunning) return "PRESS DRAW";
    return "T-000";
  }, [
    displayedTicket,
    isCompleted,
    resolvedWinningTicket,
    isReady,
    isRunning,
  ]);

  const currentDisplayIsCountdown = displayedTicket?.isCountdown;
  const currentDisplayIsSuspense = displayedTicket?.isSuspense;
  const isWinnerPhase =
    drawPhase === "winner" ||
    (isCompleted &&
      drawPhase !== "spinning" &&
      drawPhase !== "countdown");

  const statusBadge = getStatusBadge(lottery?.status);

  /* Loading State */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#070512] text-white flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="relative">
            <div className="w-18 h-18 rounded-3xl bg-gradient-to-br from-amber-500/20 via-purple-600/30 to-indigo-600/20 border border-amber-400/40 flex items-center justify-center shadow-2xl shadow-purple-950/80">
              <Loader2 className="w-9 h-9 animate-spin text-amber-300" />
            </div>
            <div className="absolute -inset-3 bg-amber-500/20 blur-2xl rounded-full pointer-events-none" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            Opening Equb Grand Arena
          </h2>
          <p className="text-slate-400 text-sm max-w-sm">
            Verifying verified payment shares and preparing the cryptographic draw terminal...
          </p>
        </div>
      </div>
    );
  }

  /* Error on initial load */
  if (error && !lottery) {
    return (
      <div className="min-h-screen bg-[#070512] text-white p-6 flex items-center justify-center">
        <div className="max-w-md w-full rounded-3xl border border-rose-500/40 bg-rose-950/30 p-8 backdrop-blur-xl text-center shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Unable to Load Arena</h2>
          <p className="text-rose-200/80 text-sm mb-6">{error}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to={`/admin/equbs/${equbId}/lottery`}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Lottery
            </Link>
            <button
              onClick={() => loadLottery()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-lg shadow-amber-900/40 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070512] text-slate-100 relative overflow-x-hidden selection:bg-amber-500 selection:text-black">
      {/* Confetti Celebration */}
      <ConfettiOverlay
        active={
          showConfetti ||
          (isWinnerPhase && !drawing && isCompleted && !loading)
        }
        onDismiss={() => setShowConfetti(false)}
      />

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        confirmText={modalState.confirmText}
        variant={modalState.variant}
        onConfirm={modalState.onConfirm}
        onCancel={() =>
          setModalState((prev) => ({ ...prev, isOpen: false }))
        }
      />

      {/* Casino Stage Ambient Lighting & Spotlights */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Overhead Spotlights */}
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1100px] h-[650px] bg-gradient-to-b from-purple-600/25 via-amber-500/15 to-transparent blur-[160px] rounded-full" />
        <div className="absolute top-1/4 -left-48 w-[700px] h-[700px] bg-indigo-600/15 blur-[180px] rounded-full" />
        <div className="absolute top-1/3 -right-48 w-[700px] h-[700px] bg-amber-500/15 blur-[180px] rounded-full" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-gradient-to-t from-purple-950/20 to-transparent pointer-events-none" />

        {/* Casino Shimmer Grid */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:28px_28px] opacity-35" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ====================================================================
            Top Navigation Bar & Header
           ==================================================================== */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-7">
          <div>
            <Link
              to={`/admin/equbs/${equbId}/lottery`}
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400/80 hover:text-amber-300 transition group mb-2.5"
            >
              <div className="p-1 rounded-lg bg-white/5 border border-amber-400/20 group-hover:bg-amber-400/10 transition">
                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition" />
              </div>
              Back to Lottery Management
            </Link>

            <div className="flex items-center gap-3.5">
              <div className="relative">
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-amber-400/20 via-purple-500/20 to-indigo-500/20 border border-amber-400/40 flex items-center justify-center p-3 shadow-xl shadow-amber-950/40">
                  <Trophy className="w-7 h-7 text-amber-300 animate-pulse" />
                </div>
                {isRunning && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 border-2 border-slate-950" />
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                    Grand Equb Lottery
                    <span className="text-amber-400">Arena</span>
                  </h1>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase bg-amber-400/10 text-amber-300 border border-amber-400/30 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    Certified Fair
                  </span>
                </div>
                <p className="text-slate-400 text-xs sm:text-sm mt-0.5 font-medium">
                  {lottery?.drawNumber
                    ? `Official Draw #${lottery.drawNumber} • Payment Period ${period?.periodNumber || "—"}`
                    : `Payment Period ${period?.periodNumber || "—"}`}
                </p>
              </div>
            </div>
          </div>

          {/* Action Bar: Sound Toggle, Refresh & Status Badge */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Audio Toggle */}
            <button
              type="button"
              onClick={toggleSound}
              title={
                soundEnabled
                  ? "Sound effects enabled (Click to mute)"
                  : "Sound effects muted (Click to enable)"
              }
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-xs font-bold tracking-wide transition shadow-md ${soundEnabled
                ? "bg-amber-400/20 border-amber-400/50 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                : "bg-white/[0.04] border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/[0.08]"
                }`}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-amber-300 animate-pulse" />
                  <span>CASINO SOUNDS ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-slate-400" />
                  <span>SOUNDS MUTED</span>
                </>
              )}
            </button>

            {/* Sync / Refresh Button */}
            <button
              type="button"
              onClick={() => loadLottery(true)}
              title="Refresh Room State"
              className="p-2.5 rounded-2xl bg-white/[0.04] border border-white/10 text-slate-300 hover:text-white hover:bg-white/[0.08] hover:border-amber-400/30 transition shadow-md"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Status Pill */}
            <div
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-xs font-black tracking-wider ${statusBadge.classes}`}
            >
              <span className={`w-2 h-2 rounded-full ${statusBadge.dot}`} />
              {statusBadge.label}
            </div>
          </div>
        </header>

        {/* ====================================================================
            Alerts & Notifications
           ==================================================================== */}
        {error && (
          <div className="mb-6 rounded-2xl border border-rose-500/40 bg-rose-500/15 px-5 py-4 text-rose-200 flex items-center justify-between gap-3 backdrop-blur-md shadow-lg shadow-rose-950/40">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
              <p className="text-sm font-semibold">{error}</p>
            </div>
            <button
              onClick={() => setError("")}
              className="text-rose-300 hover:text-white p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 rounded-2xl border border-emerald-500/40 bg-emerald-500/15 px-5 py-4 text-emerald-200 flex items-center justify-between gap-3 backdrop-blur-md shadow-lg shadow-emerald-950/40">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <p className="text-sm font-semibold">{successMessage}</p>
            </div>
            <button
              onClick={() => setSuccessMessage("")}
              className="text-emerald-300 hover:text-white p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ====================================================================
            Centerpiece: The Casino Digital Lottery Machine
           ==================================================================== */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_370px] gap-6 mb-8">
          {/* Main Column: Casino Lottery Machine */}
          <div className="relative rounded-3xl border-2 border-amber-500/40 bg-gradient-to-b from-[#160e2e] via-[#0c081e] to-[#060410] backdrop-blur-2xl shadow-2xl shadow-black/90 overflow-hidden flex flex-col justify-between">
            {/* Top Glowing Marquee Chaser Bulbs */}
            <div className="h-2 w-full bg-slate-950/90 border-b border-amber-500/20 flex items-center justify-between px-3 overflow-hidden">
              {Array.from({ length: 24 }).map((_, i) => (
                <span
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full ${drawing
                    ? i % 2 === 0
                      ? "bg-amber-400 shadow-[0_0_6px_#f59e0b] animate-ping"
                      : "bg-purple-400 shadow-[0_0_6px_#a855f7]"
                    : isWinnerPhase
                      ? "bg-emerald-400 shadow-[0_0_6px_#10b981]"
                      : "bg-amber-400/80"
                    }`}
                  style={{ animationDelay: `${(i * 70) % 800}ms` }}
                />
              ))}
            </div>

            {/* Machine Top Crown Bezel */}
            <div className="border-b border-amber-500/20 px-6 py-4 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-300">
                  <Crown className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-black uppercase tracking-widest text-amber-300">
                    GRAND PRIZE TERMINAL
                  </span>
                  <p className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                    {drawing
                      ? "LIVE DRUM REEL ROTATING"
                      : isWinnerPhase
                        ? "OFFICIAL RESULT LOCKED"
                        : "READY FOR DRAWING"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/[0.04] border border-white/10">
                  <Clock3 className="w-3.5 h-3.5 text-amber-400" />
                  {lottery?.startedAt
                    ? formatDate(lottery.startedAt)
                    : "Pool Pending"}
                </span>
              </div>
            </div>

            {/* Center Drum / Slot Chamber */}
            <div className="p-6 sm:p-10 flex-1 flex flex-col items-center justify-center">
              <div className="relative w-full max-w-2xl">
                {/* Radiant Ambient Glow behind Chamber */}
                <div
                  className={`absolute -inset-6 rounded-3xl blur-3xl transition-all duration-700 pointer-events-none ${isWinnerPhase
                    ? "bg-gradient-to-r from-emerald-500/30 via-amber-400/30 to-teal-500/30"
                    : drawing
                      ? "bg-gradient-to-r from-purple-600/35 via-amber-500/30 to-indigo-600/35"
                      : "bg-gradient-to-r from-indigo-600/15 to-purple-600/15"
                    }`}
                />

                {/* Outer Metallic Bezel & Slot Casing */}
                <div
                  className={`relative rounded-3xl border-2 transition-all duration-500 overflow-hidden ${isWinnerPhase
                    ? "border-amber-400/80 shadow-[0_0_90px_rgba(245,158,11,0.45)] bg-slate-950/95"
                    : drawing
                      ? "border-purple-400/70 shadow-[0_0_90px_rgba(168,85,247,0.4)] bg-slate-950/95"
                      : "border-white/15 bg-slate-950/90 shadow-2xl"
                    }`}
                >
                  {/* Top LED Indicator Line */}
                  <div className="px-6 py-2.5 bg-slate-900/90 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${drawing
                          ? "bg-amber-400 animate-pulse"
                          : isWinnerPhase
                            ? "bg-emerald-400"
                            : "bg-indigo-400"
                          }`}
                      />
                      <span className="text-[11px] uppercase font-mono tracking-widest text-slate-300 font-bold">
                        PHASE: {drawPhase.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-mono text-amber-300 uppercase">
                      <Radio className="w-3.5 h-3.5 animate-pulse text-amber-400" />
                      <span>LIVE TERMINAL</span>
                    </div>
                  </div>

                  {/* 3D Curved Tumbler Drum Interior */}
                  <div className="relative h-64 sm:h-80 p-6 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#0e0a20] via-[#05030e] to-[#0e0a20]">
                    {/* Top and Bottom 3D Cylinder Shadows (creates drum tumbler depth) */}
                    <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/85 via-black/40 to-transparent pointer-events-none z-20" />
                    <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none z-20" />

                    {/* Left and Right Reel Bumpers */}
                    <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-amber-500/20 to-transparent border-r border-amber-400/20 pointer-events-none z-20 flex items-center justify-center">
                      <span className="text-amber-400 text-xs font-black">
                        ▶
                      </span>
                    </div>
                    <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-amber-500/20 to-transparent border-l border-amber-400/20 pointer-events-none z-20 flex items-center justify-center">
                      <span className="text-amber-400 text-xs font-black">
                        ◀
                      </span>
                    </div>

                    {/* Payline Laser / Scanline */}
                    <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent pointer-events-none z-10" />

                    {/* Moving Laser Scan beam during spinning */}
                    {drawing && (
                      <div className="absolute inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-amber-300 to-transparent blur-[1px] animate-scan pointer-events-none z-20" />
                    )}

                    {/* Shimmer Glass Reflection */}
                    <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.4)_50%,transparent_70%)]" />

                    {/* Dynamic Screen Content */}
                    <div className="relative z-10 flex flex-col items-center justify-center text-center">
                      {currentDisplayIsCountdown ? (
                        /* COUNTDOWN SEQUENCE (3-2-1) */
                        <div className="flex flex-col items-center animate-scale-pulse">
                          <div className="relative">
                            <span className="text-8xl sm:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-yellow-400 to-amber-600 tabular-nums drop-shadow-[0_0_40px_rgba(245,158,11,0.8)]">
                              {machineTicket}
                            </span>
                            <span className="absolute -inset-4 rounded-full border-2 border-amber-400/40 animate-ping pointer-events-none" />
                          </div>
                          <span className="mt-4 text-xs sm:text-sm font-black uppercase tracking-[0.4em] text-amber-300 bg-amber-500/10 px-4 py-1.5 rounded-full border border-amber-400/30">
                            INITIALIZING REELS
                          </span>
                        </div>
                      ) : currentDisplayIsSuspense ? (
                        /* SUSPENSE MOMENT */
                        <div className="flex flex-col items-center animate-pulse">
                          <div className="flex items-center gap-3">
                            <span className="text-6xl sm:text-8xl font-black tracking-widest text-amber-300 drop-shadow-[0_0_35px_rgba(245,158,11,0.7)]">
                              ★ ★ ★
                            </span>
                          </div>
                          <span className="mt-4 text-xs sm:text-sm font-extrabold uppercase tracking-[0.35em] text-amber-200 bg-amber-500/20 px-5 py-2 rounded-full border border-amber-400/40 shadow-lg">
                            LOCKING IN WINNER...
                          </span>
                        </div>
                      ) : (
                        /* TICKET REEL OR OFFICAL WINNER */
                        <div
                          className={`flex flex-col items-center transition-all duration-300 ${isWinnerPhase
                            ? "scale-105"
                            : drawing
                              ? "scale-100"
                              : "scale-95"
                            }`}
                        >
                          {isWinnerPhase && (
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/25 via-emerald-500/25 to-amber-500/25 border-2 border-amber-400/60 text-amber-200 text-xs sm:text-sm font-black tracking-widest uppercase mb-4 shadow-[0_0_20px_rgba(245,158,11,0.4)] animate-bounce">
                              <Crown className="w-4 h-4 text-yellow-300" />
                              GRAND LOTTERY WINNER
                            </div>
                          )}

                          {/* Large Ticket Display with Gold Shimmer */}
                          <div
                            className={`font-black tracking-tight tabular-nums transition-all ${isWinnerPhase
                              ? "text-6xl sm:text-8xl text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 via-amber-300 to-yellow-600 drop-shadow-[0_0_45px_rgba(245,158,11,0.75)] animate-gold-glow"
                              : drawing
                                ? "text-6xl sm:text-8xl text-white drop-shadow-[0_0_30px_rgba(168,85,247,0.5)] animate-ticket-shake"
                                : "text-5xl sm:text-7xl text-slate-200"
                              }`}
                          >
                            {machineTicket}
                          </div>

                          {/* Subtitle / Context */}
                          <div className="flex items-center gap-2 mt-4 text-xs sm:text-sm font-semibold text-slate-300">
                            <Ticket className="w-4 h-4 text-amber-400" />
                            {isWinnerPhase
                              ? `CONGRATULATIONS TO ${winnerName.toUpperCase()}!`
                              : drawing
                                ? "ROTATING THROUGH ELIGIBLE TICKETS..."
                                : isReady
                                  ? "ALL TICKETS VERIFIED & READY TO START"
                                  : isRunning
                                    ? "READY FOR GRAND PRIZE DRAW"
                                    : "LOTTERY CLOSED"}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Machine Lower Bezel Status */}
                  <div className="px-6 py-3.5 bg-slate-900/95 border-t border-white/10 flex items-center justify-between text-xs font-mono text-slate-300">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span className="font-semibold text-emerald-300">
                        OFFICIAL CRYPTOGRAPHIC AUDIT VERIFIED
                      </span>
                    </div>
                    <span className="text-amber-300 font-bold">
                      POOL SIZE: {totalTickets} TICKETS
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Commentary Text */}
              <div className="text-center mt-7">
                {drawPhase === "countdown" && (
                  <p className="text-sm font-bold text-amber-300 animate-pulse">
                    The draw begins in a moment... Hold on to your tickets!
                  </p>
                )}

                {drawPhase === "spinning" && (
                  <p className="text-sm font-bold text-slate-200">
                    🎰 Cycling through eligible tickets... Decelerating toward the verified winner.
                  </p>
                )}

                {drawPhase === "suspense" && (
                  <p className="text-sm font-bold text-amber-300">
                    ✨ Locking in the winning entry...
                  </p>
                )}

                {isWinnerPhase && (
                  <div className="space-y-1.5">
                    <p className="text-lg sm:text-xl font-black text-amber-300 drop-shadow">
                      🎉 A Winner Has Been Selected!
                    </p>
                    <p className="text-slate-300 text-xs sm:text-sm font-medium">
                      Winning Ticket:{" "}
                      <span className="text-white font-black text-base px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-400/30">
                        {resolvedWinningTicket || machineTicket}
                      </span>{" "}
                      held by{" "}
                      <span className="text-amber-300 font-bold">
                        {winnerName}
                      </span>
                    </p>
                  </div>
                )}

                {drawPhase === "idle" && isReady && (
                  <p className="text-slate-400 text-xs sm:text-sm">
                    Click{" "}
                    <span className="text-white font-bold">
                      Start Lottery & Freeze Pool
                    </span>{" "}
                    below to lock in eligible participants.
                  </p>
                )}

                {drawPhase === "idle" && isRunning && (
                  <p className="text-slate-400 text-xs sm:text-sm">
                    The ticket pool is locked. Press{" "}
                    <span className="text-amber-300 font-bold">
                      Spin & Draw Winner
                    </span>{" "}
                    to trigger the official draw.
                  </p>
                )}
              </div>

              {/* ====================================================================
                  Interactive Action Buttons
                 ==================================================================== */}
              <div className="flex flex-wrap items-center justify-center gap-4 mt-7">
                {isReady && (
                  <button
                    type="button"
                    onClick={handleStartLottery}
                    disabled={starting}
                    className="relative group inline-flex items-center justify-center gap-3 px-9 py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-base shadow-xl shadow-purple-950/60 hover:shadow-purple-600/40 disabled:opacity-50 disabled:cursor-not-allowed transition transform hover:-translate-y-0.5 active:translate-y-0"
                  >
                    {starting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Locking Ticket Pool...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5 text-amber-300 group-hover:scale-110 transition" />
                        <span>Start Lottery & Freeze Pool</span>
                      </>
                    )}
                  </button>
                )}

                {isRunning && (
                  <button
                    type="button"
                    onClick={handleDrawWinner}
                    disabled={drawing}
                    className="relative group inline-flex items-center justify-center gap-3 px-12 py-4.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:via-yellow-400 hover:to-amber-500 text-slate-950 font-black text-lg shadow-2xl shadow-amber-950/70 hover:shadow-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition transform hover:-translate-y-1 active:translate-y-0 overflow-hidden"
                  >
                    {drawing ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin text-slate-950" />
                        <span className="tracking-wide">
                          Spinning & Drawing Winner...
                        </span>
                      </>
                    ) : (
                      <>
                        <Dices className="w-6 h-6 group-hover:rotate-90 transition transform duration-500 text-slate-950" />
                        <span className="tracking-wide">
                          SPIN & DRAW WINNER
                        </span>
                        <Sparkles className="w-5 h-5 text-slate-950 animate-bounce" />
                      </>
                    )}
                  </button>
                )}

                {isCompleted && (
                  <button
                    type="button"
                    onClick={() => setShowConfetti(true)}
                    className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500/20 to-emerald-500/20 border-2 border-amber-400/40 text-amber-200 hover:text-white hover:bg-amber-500/30 font-bold text-sm shadow-xl transition transform hover:-translate-y-0.5"
                  >
                    <PartyPopper className="w-5 h-5 text-amber-300" />
                    Replay Winner Celebration
                  </button>
                )}
              </div>
            </div>

            {/* Bottom Machine Security Notice */}
            <div className="px-6 py-3.5 border-t border-amber-500/20 bg-slate-950/80 flex items-center justify-center gap-2 text-center text-xs text-slate-400 font-medium">
              <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                Backend-driven fairness: Winning ticket is selected cryptographically by the backend before animation commences.
              </span>
            </div>
          </div>

          {/* Right Column: Winner Spotlight & Live Statistics */}
          <div className="space-y-6">
            {/* Winner Spotlight Card */}
            {isWinnerPhase && (
              <div className="relative overflow-hidden rounded-3xl border-2 border-amber-400/50 bg-gradient-to-b from-amber-500/15 via-[#140f2b] to-[#080516] p-6 shadow-2xl shadow-amber-950/60">
                <div className="absolute -top-12 -right-12 w-40 h-40 bg-amber-500/25 blur-3xl rounded-full pointer-events-none" />

                <div className="relative">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="inline-flex items-center gap-1.5 text-amber-300 text-xs font-black uppercase tracking-wider">
                      <Trophy className="w-4 h-4 text-yellow-400" />
                      Grand Winner
                    </span>
                    <span className="px-3 py-1 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-md">
                      CONFIRMED
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    {resolvedWinnerUser?.profileImage ? (
                      <img
                        src={resolvedWinnerUser.profileImage}
                        alt={winnerName}
                        className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-400/60 shadow-lg shadow-amber-900/60"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400/20 to-purple-600/30 border-2 border-amber-400/50 flex items-center justify-center text-amber-300 font-black text-xl shadow-lg">
                        {getInitials(
                          resolvedWinnerUser || winnerMembership?.user
                        )}
                      </div>
                    )}

                    <div className="min-w-0">
                      <h4 className="font-extrabold text-white text-lg truncate">
                        {winnerName}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5 font-medium">
                        Member #{winnerMembership?.memberNumber || "—"}
                      </p>
                      <div className="inline-flex items-center gap-1.5 mt-1 text-amber-300 text-xs font-extrabold">
                        <Ticket className="w-3.5 h-3.5" />
                        Ticket {resolvedWinningTicket || machineTicket}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3.5 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">
                      Total Equb Shares:
                    </span>
                    <span className="font-black text-amber-300 text-sm">
                      {winnerMembership?.shares
                        ? Number(winnerMembership.shares)
                        : "1"}{" "}
                      Share(s)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Stats Grid */}
            <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] backdrop-blur-xl p-6 shadow-xl">
              <h3 className="font-extrabold text-white text-sm tracking-wide mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Draw Arena Statistics
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl bg-white/[0.03] border border-white/5 p-4 hover:border-amber-400/20 transition">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-medium">
                        Participants
                      </p>
                      <p className="font-black text-white text-lg leading-tight mt-0.5">
                        {participantCount}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    Members
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-white/[0.03] border border-white/5 p-4 hover:border-amber-400/20 transition">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300">
                      <Ticket className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-medium">
                        Total Tickets
                      </p>
                      <p className="font-black text-white text-lg leading-tight mt-0.5">
                        {totalTickets}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    In Pool
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-white/[0.03] border border-white/5 p-4 hover:border-amber-400/20 transition">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-300">
                      <Clock3 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-medium">
                        Payment Period
                      </p>
                      <p className="font-black text-white text-lg leading-tight mt-0.5">
                        Period #{period?.periodNumber || "—"}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    Cycle
                  </span>
                </div>
              </div>
            </div>

            {/* Procedural Transparency Card */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 text-xs text-slate-400 leading-relaxed">
              <h4 className="font-bold text-slate-200 mb-2 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Fairness Rules
              </h4>
              <p>
                Each share assigned to a member generates a unique lottery ticket. Every ticket has an equal probability of winning. Once started, no further entries can be injected into the pool.
              </p>
            </div>
          </div>
        </div>

        {/* ====================================================================
            Interactive Ticket Arena: Casino Raffle Stubs Grid / Table
           ==================================================================== */}
        <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.02] backdrop-blur-xl overflow-hidden shadow-2xl">
          {/* Header & Filter Controls */}
          <div className="p-5 sm:p-6 border-b border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <Ticket className="w-5 h-5 text-amber-400" />
                <h3 className="font-black text-white text-xl">
                  Ticket Pool Arena
                </h3>
                <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-400/10 border border-amber-400/30 text-amber-300">
                  {entries.length} Eligible Tickets
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                Every ticket displayed below is participating in this draw session.
              </p>
            </div>

            <div className="flex items-center flex-wrap gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search ticket or member..."
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-900/90 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400/60 transition shadow-inner"
                />
                {ticketSearch && (
                  <button
                    onClick={() => setTicketSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* View Switcher: Grid vs Table */}
              <div className="flex items-center p-1 rounded-2xl bg-slate-900/90 border border-white/10">
                <button
                  type="button"
                  onClick={() => setPoolViewMode("grid")}
                  title="Casino Ticket Grid View"
                  className={`p-2 rounded-xl transition ${poolViewMode === "grid"
                    ? "bg-amber-500 text-slate-950 font-bold shadow-md"
                    : "text-slate-400 hover:text-white"
                    }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPoolViewMode("table")}
                  title="Detailed Audit Table View"
                  className={`p-2 rounded-xl transition ${poolViewMode === "table"
                    ? "bg-amber-500 text-slate-950 font-bold shadow-md"
                    : "text-slate-400 hover:text-white"
                    }`}
                >
                  <ListFilter className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Body Content */}
          {filteredEntries.length === 0 ? (
            <div className="py-20 text-center">
              <Ticket className="w-14 h-14 text-slate-600 mx-auto mb-3 animate-pulse" />
              <p className="text-slate-200 font-bold text-lg">
                {ticketSearch
                  ? "No matching tickets found"
                  : "No eligible tickets in pool"}
              </p>
              <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto font-medium">
                {ticketSearch
                  ? "Try searching with a different ticket number or member name."
                  : "Prepare the lottery and ensure members are marked eligible before starting."}
              </p>
            </div>
          ) : poolViewMode === "grid" ? (
            /* CASINO RAFFLE TICKETS GRID */
            <div className="p-5 sm:p-6 max-h-[520px] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
                {filteredEntries.map((entry) => {
                  const ticketNum = getTicketNumber(entry);
                  const isCurrent =
                    ticketNum ===
                    String(displayedTicket?.ticketNumber || "").toUpperCase();
                  const isWinner =
                    ticketNum ===
                    String(
                      resolvedWinningTicket ||
                      drawResult?.winningTicket ||
                      ""
                    ).toUpperCase();

                  return (
                    <div
                      key={entry.id}
                      className={`relative rounded-2xl p-3.5 border transition-all duration-300 flex flex-col justify-between overflow-hidden group ${isWinner && isWinnerPhase
                        ? "border-amber-400 bg-gradient-to-b from-amber-500/30 via-slate-900 to-black text-amber-200 shadow-[0_0_30px_rgba(245,158,11,0.5)] scale-105 z-10"
                        : isCurrent && drawing
                          ? "border-purple-400 bg-purple-500/30 text-purple-200 shadow-[0_0_25px_rgba(168,85,247,0.4)] scale-105 z-10"
                          : "border-white/10 bg-slate-900/70 hover:bg-slate-900 hover:border-amber-400/40 text-slate-300 hover:shadow-lg"
                        }`}
                    >
                      {/* Perforation Notches on Sides */}
                      <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#080512] border-r border-white/10" />
                      <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#080512] border-l border-white/10" />

                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span className="text-[10px] font-mono tracking-wider text-slate-400 uppercase font-bold">
                          ENTRY
                        </span>
                        {isWinner && isWinnerPhase && (
                          <Crown className="w-4 h-4 text-yellow-300 animate-bounce" />
                        )}
                      </div>

                      <div className="text-center py-1.5">
                        <span
                          className={`font-black text-base sm:text-lg tracking-tight font-mono ${isWinner && isWinnerPhase
                            ? "text-amber-300 drop-shadow"
                            : "text-white"
                            }`}
                        >
                          {ticketNum}
                        </span>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                        <span
                          className="truncate max-w-[90px] font-medium"
                          title={getFullName(entry.user)}
                        >
                          {getFullName(entry.user)}
                        </span>
                        <span className="font-mono text-slate-400 font-bold">
                          #{entry.membership?.memberNumber || "—"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* DETAILED TABULAR VIEW */
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-slate-900/70 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                    <th className="px-6 py-4">Ticket ID</th>
                    <th className="px-6 py-4">Member Name</th>
                    <th className="px-6 py-4">Member Number</th>
                    <th className="px-6 py-4">Equb Shares</th>
                    <th className="px-6 py-4">Entry Mode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredEntries.map((entry) => {
                    const ticketNum = getTicketNumber(entry);
                    const isWinner =
                      ticketNum ===
                      String(
                        resolvedWinningTicket ||
                        drawResult?.winningTicket ||
                        ""
                      ).toUpperCase();

                    return (
                      <tr
                        key={entry.id}
                        className={`transition ${isWinner && isWinnerPhase
                          ? "bg-amber-500/15 text-amber-200"
                          : "hover:bg-white/[0.02]"
                          }`}
                      >
                        <td className="px-6 py-4 font-mono font-bold text-white flex items-center gap-2">
                          <Ticket className="w-4 h-4 text-amber-400" />
                          {ticketNum}
                          {isWinner && isWinnerPhase && (
                            <span className="ml-2 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-black">
                              WINNER
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {entry.user?.profileImage ? (
                              <img
                                src={entry.user.profileImage}
                                alt={getFullName(entry.user)}
                                className="w-8 h-8 rounded-full object-cover border border-amber-400/30"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-xs border border-purple-400/30">
                                {getInitials(entry.user)}
                              </div>
                            )}
                            <span className="font-semibold text-slate-200">
                              {getFullName(entry.user)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-400 font-mono text-xs">
                          {entry.membership?.memberNumber || "—"}
                        </td>
                        <td className="px-6 py-4 text-slate-300 font-semibold">
                          {entry.membership?.shares
                            ? Number(entry.membership.shares)
                            : "—"}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${entry.entryType === "AUTOMATIC"
                              ? "bg-blue-500/10 text-blue-300 border border-blue-400/20"
                              : "bg-purple-500/10 text-purple-300 border border-purple-400/20"
                              }`}
                          >
                            {entry.entryType || "STANDARD"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ====================================================================
          Keyframe Animations & Specialized Visual Styling
         ==================================================================== */}
      <style>{`
        @keyframes scan {
          0% {
            top: 0%;
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            top: 100%;
            opacity: 0;
          }
        }
        @keyframes confettiFall {
          0% {
            transform: translateY(-20px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(105vh) rotate(720deg);
            opacity: 0;
          }
        }
        @keyframes scalePulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
        }
        @keyframes ticketShake {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes goldGlow {
          0%, 100% {
            filter: drop-shadow(0 0 25px rgba(245, 158, 11, 0.6));
          }
          50% {
            filter: drop-shadow(0 0 45px rgba(245, 158, 11, 0.95));
          }
        }
        .animate-scan {
          animation: scan 1.3s ease-in-out infinite;
        }
        .animate-confetti-fall {
          animation: confettiFall ease-in-out forwards;
        }
        .animate-scale-pulse {
          animation: scalePulse 0.7s ease-in-out infinite;
        }
        .animate-ticket-shake {
          animation: ticketShake 0.12s ease-in-out infinite;
        }
        .animate-gold-glow {
          animation: goldGlow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}