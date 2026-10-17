
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Users,
  Send,
  Search,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  Megaphone,
  RefreshCw,
} from "lucide-react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const NOTIFICATION_TYPES = [
  { value: "GENERAL", label: "General announcement" },
  { value: "PAYMENT_REMINDER", label: "Payment reminder" },
  { value: "PAYMENT_SUBMITTED", label: "Payment submitted" },
  { value: "PAYMENT_VERIFIED", label: "Payment verified" },
  { value: "PAYMENT_REJECTED", label: "Payment rejected" },
  { value: "LOTTERY_RESULT", label: "Lottery result" },
  { value: "DRAW", label: "Lottery draw" },
  { value: "PAYOUT", label: "Payout" },
  { value: "SYSTEM", label: "System announcement" },
];

async function apiRequest(path, options = {}) {
  // Adjust this token lookup if your existing auth system uses another key.
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken");

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
}

export default function NotificationPage() {
  const [equbs, setEqubs] = useState([]);
  const [selectedEqubIds, setSelectedEqubIds] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);

  const [recipientMode, setRecipientMode] = useState("ALL");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("GENERAL");
  const [memberSearch, setMemberSearch] = useState("");

  const [loadingEqubs, setLoadingEqubs] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [sending, setSending] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadEqubs = useCallback(async () => {
    setLoadingEqubs(true);
    setError("");

    try {
      const data = await apiRequest("/notifications/admin/equbs");
      setEqubs(data.equbs || []);
    } catch (err) {
      setError(err.message || "Could not load Equbs.");
    } finally {
      setLoadingEqubs(false);
    }
  }, []);

  useEffect(() => {
    loadEqubs();
  }, [loadEqubs]);

  useEffect(() => {
    if (selectedEqubIds.length === 0) {
      setMembers([]);
      setSelectedUserIds([]);
      setLoadingMembers(false);
      return;
    }

    let cancelled = false;

    async function loadMembers() {
      setLoadingMembers(true);
      setError("");

      try {
        const query = new URLSearchParams({
          equbIds: selectedEqubIds.join(","),
        });

        const data = await apiRequest(
          `/notifications/admin/targets?${query.toString()}`
        );

        if (!cancelled) {
          setMembers(data.members || []);
          setSelectedUserIds([]);
        }
      } catch (err) {
        if (!cancelled) {
          setMembers([]);
          setSelectedUserIds([]);
          setError(err.message || "Could not load eligible members.");
        }
      } finally {
        if (!cancelled) {
          setLoadingMembers(false);
        }
      }
    }

    loadMembers();

    return () => {
      cancelled = true;
    };
  }, [selectedEqubIds]);

  const filteredMembers = useMemo(() => {
    const search = memberSearch.trim().toLowerCase();

    if (!search) return members;

    return members.filter((member) => {
      const fullName =
        `${member.firstName || ""} ${member.lastName || ""}`.toLowerCase();

      return (
        fullName.includes(search) ||
        (member.email || "").toLowerCase().includes(search)
      );
    });
  }, [members, memberSearch]);

  const toggleEqub = (equbId) => {
    setSelectedEqubIds((current) =>
      current.includes(equbId)
        ? current.filter((id) => id !== equbId)
        : [...current, equbId]
    );

    setSelectedUserIds([]);
    setSuccess("");
  };

  const toggleUser = (userId) => {
    setSelectedUserIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    );

    setSuccess("");
  };

  const selectAllVisibleMembers = () => {
    const visibleIds = filteredMembers.map((member) => member.id);

    setSelectedUserIds((current) => [
      ...new Set([...current, ...visibleIds]),
    ]);
  };

  const clearSelectedMembers = () => {
    setSelectedUserIds([]);
  };

  const handleRecipientModeChange = (mode) => {
    setRecipientMode(mode);
    setSelectedUserIds([]);
    setSuccess("");
  };

  const handleSend = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (selectedEqubIds.length === 0) {
      setError("Select at least one Equb.");
      return;
    }

    if (!title.trim() || !message.trim()) {
      setError("Enter both a notification title and message.");
      return;
    }

    if (recipientMode === "SPECIFIC" && selectedUserIds.length === 0) {
      setError("Select at least one member to receive the notification.");
      return;
    }

    const confirmed = window.confirm(
      recipientMode === "ALL"
        ? `Send this announcement to all ${members.length} eligible members?`
        : `Send this announcement to ${selectedUserIds.length} selected members?`
    );

    if (!confirmed) return;

    setSending(true);

    try {
      const data = await apiRequest("/notifications/admin/send", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          type,
          equbIds: selectedEqubIds,
          recipientMode,
          userIds:
            recipientMode === "SPECIFIC" ? selectedUserIds : [],
        }),
      });

      setSuccess(
        `Notification sent successfully to ${
          data.recipientCount ?? 0
        } member(s).`
      );

      setTitle("");
      setMessage("");
      setType("GENERAL");
      setMemberSearch("");
      setSelectedUserIds([]);
    } catch (err) {
      setError(err.message || "Failed to send notification.");
    } finally {
      setSending(false);
    }
  };

  const eligibleRecipientCount =
    recipientMode === "ALL" ? members.length : selectedUserIds.length;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-indigo-600">
              <Bell size={17} />
              Admin / Notifications
            </div>

            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Send a notification
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Send announcements to members of selected Equbs. Choose
              everyone or select individual members.
            </p>
          </div>

          <button
            type="button"
            onClick={loadEqubs}
            disabled={loadingEqubs}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={loadingEqubs ? "animate-spin" : ""}
            />
            Refresh Equbs
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
          >
            <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSend} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-3 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
                  <Megaphone size={21} />
                </div>

                <div>
                  <h2 className="font-semibold">Announcement details</h2>
                  <p className="text-sm text-slate-500">
                    Write the message members will receive.
                  </p>
                </div>
              </div>

              <div>
                <label
                  htmlFor="notification-title"
                  className="mb-2 block text-sm font-medium"
                >
                  Notification title
                </label>

                <input
                  id="notification-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={150}
                  placeholder="e.g. Payment deadline reminder"
                  required
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                />

                <p className="mt-1.5 text-right text-xs text-slate-400">
                  {title.length}/150
                </p>
              </div>

              <div>
                <label
                  htmlFor="notification-type"
                  className="mb-2 block text-sm font-medium"
                >
                  Notification type
                </label>

                <select
                  id="notification-type"
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                >
                  {NOTIFICATION_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="notification-message"
                  className="mb-2 block text-sm font-medium"
                >
                  Message
                </label>

                <textarea
                  id="notification-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={5000}
                  rows={7}
                  required
                  placeholder="Write your announcement here..."
                  className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                />

                <p className="mt-1.5 text-right text-xs text-slate-400">
                  {message.length}/5000
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-3 text-sm font-semibold">
                  Message preview
                </p>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                      <Bell size={19} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="break-words font-semibold">
                        {title.trim() || "Your notification title"}
                      </p>

                      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                        {message.trim() ||
                          "Your notification message will appear here."}
                      </p>

                      <p className="mt-3 text-xs text-slate-400">
                        {NOTIFICATION_TYPES.find(
                          (item) => item.value === type
                        )?.label}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-violet-50 p-2.5 text-violet-600">
                  <Users size={21} />
                </div>

                <div>
                  <h2 className="font-semibold">Recipients</h2>
                  <p className="text-sm text-slate-500">
                    Choose Equbs and members.
                  </p>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="text-sm font-medium">
                    Select Equbs
                  </label>

                  <span className="text-xs text-slate-500">
                    {selectedEqubIds.length} selected
                  </span>
                </div>

                <div className="max-h-60 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
                  {loadingEqubs ? (
                    <div className="flex items-center gap-2 p-4 text-sm text-slate-500">
                      <LoaderCircle size={17} className="animate-spin" />
                      Loading Equbs...
                    </div>
                  ) : equbs.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">
                      No Equbs found.
                    </p>
                  ) : (
                    equbs.map((equb) => (
                      <label
                        key={equb.id}
                        className="flex cursor-pointer items-start gap-3 rounded-lg p-3 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedEqubIds.includes(equb.id)}
                          onChange={() => toggleEqub(equb.id)}
                          className="mt-1 h-4 w-4 accent-indigo-600"
                        />

                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-sm font-medium">
                            {equb.name}
                          </span>

                          {equb.status && (
                            <span className="mt-1 block text-xs text-slate-500">
                              {equb.status}
                            </span>
                          )}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">
                  Who should receive it?
                </p>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => handleRecipientModeChange("ALL")}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      recipientMode === "ALL"
                        ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className="block text-sm font-semibold">
                      All active members
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      Everyone with an active account and membership in
                      a selected Equb.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRecipientModeChange("SPECIFIC")}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      recipientMode === "SPECIFIC"
                        ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className="block text-sm font-semibold">
                      Specific members
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      Choose individual people from the selected Equbs.
                    </span>
                  </button>
                </div>
              </div>

              {recipientMode === "SPECIFIC" && (
                <div>
                  <div className="relative mb-3">
                    <Search
                      size={17}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      value={memberSearch}
                      onChange={(event) =>
                        setMemberSearch(event.target.value)
                      }
                      placeholder="Search members..."
                      className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                    />
                  </div>

                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">
                      {selectedUserIds.length} selected
                    </span>

                    <button
                      type="button"
                      onClick={selectAllVisibleMembers}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      Select visible
                    </button>
                  </div>

                  <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
                    {loadingMembers ? (
                      <div className="flex items-center gap-2 p-4 text-sm text-slate-500">
                        <LoaderCircle
                          size={17}
                          className="animate-spin"
                        />
                        Loading members...
                      </div>
                    ) : selectedEqubIds.length === 0 ? (
                      <p className="p-4 text-sm text-slate-500">
                        Select an Equb first.
                      </p>
                    ) : filteredMembers.length === 0 ? (
                      <p className="p-4 text-sm text-slate-500">
                        No matching members found.
                      </p>
                    ) : (
                      filteredMembers.map((member) => (
                        <label
                          key={member.id}
                          className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(member.id)}
                            onChange={() => toggleUser(member.id)}
                            className="mt-1 h-4 w-4 accent-indigo-600"
                          />

                          <span className="min-w-0 flex-1">
                            <span className="block break-words text-sm font-medium">
                              {member.firstName} {member.lastName}
                            </span>

                            <span className="block break-all text-xs text-slate-500">
                              {member.email}
                            </span>
                          </span>
                        </label>
                      ))
                    )}
                  </div>

                  {selectedUserIds.length > 0 && (
                    <button
                      type="button"
                      onClick={clearSelectedMembers}
                      className="mt-2 text-xs font-medium text-slate-500 hover:text-red-600"
                    >
                      Clear selected members
                    </button>
                  )}
                </div>
              )}

              <div className="rounded-xl bg-slate-900 p-4 text-white">
                <p className="text-sm text-slate-300">
                  Estimated recipients
                </p>

                <p className="mt-1 text-3xl font-bold">
                  {selectedEqubIds.length === 0 || loadingMembers
                    ? "—"
                    : eligibleRecipientCount}
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {recipientMode === "ALL"
                    ? "Unique active members across the selected Equbs."
                    : "Selected members with active memberships in the selected Equbs."}
                </p>
              </div>

              <button
                type="submit"
                disabled={
                  sending ||
                  loadingEqubs ||
                  loadingMembers ||
                  selectedEqubIds.length === 0 ||
                  (recipientMode === "SPECIFIC" &&
                    selectedUserIds.length === 0)
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <LoaderCircle size={18} className="animate-spin" />
                    Sending notification...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Send notification
                  </>
                )}
              </button>

              <p className="text-center text-xs leading-5 text-slate-400">
                Verify your message and recipients before sending.
              </p>
            </section>
          </div>
        </form>
      </div>
    </div>
  );
}
