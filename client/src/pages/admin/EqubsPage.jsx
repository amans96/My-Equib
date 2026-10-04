import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getEqubs, updateEqub, deleteEqub } from "../../services/equbApi";

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

const EqubsPage = () => {
  const [equbs, setEqubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Edit state
  const [editingEqub, setEditingEqub] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    contributionAmount: "",
    frequency: "WEEKLY",
    totalPeriods: "",
    startDate: "",
    endDate: "",
    currency: "ETB",
    status: "PENDING",
  });

  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const [actionError, setActionError] = useState("");

  useEffect(() => {
    const fetchEqubs = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await getEqubs();

        if (!response.success) {
          throw new Error(response.message || "Failed to load Equbs.");
        }

        setEqubs(response.equbs || []);
      } catch (err) {
        console.error("Admin Equbs error:", err);

        setError(
          err.response?.data?.message ||
            err.message ||
            "Unable to load your Equbs."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchEqubs();
  }, []);

  const filteredEqubs = useMemo(() => {
    return equbs.filter((equb) => {
      const matchesSearch =
        equb.name?.toLowerCase().includes(search.toLowerCase()) ||
        equb.description?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" || equb.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [equbs, search, statusFilter]);

  const counts = useMemo(() => {
    return {
      all: equbs.length,
      active: equbs.filter((equb) => equb.status === "ACTIVE").length,
      pending: equbs.filter((equb) => equb.status === "PENDING").length,
      completed: equbs.filter((equb) => equb.status === "COMPLETED").length,
    };
  }, [equbs]);

  const openEditModal = (equb) => {
    setActionError("");

    setEditingEqub(equb);

    setEditForm({
      name: equb.name || "",
      description: equb.description || "",
      contributionAmount: equb.contributionAmount ?? "",
      frequency: equb.frequency || "WEEKLY",
      totalPeriods: equb.totalPeriods ?? "",
      startDate: equb.startDate
        ? new Date(equb.startDate).toISOString().slice(0, 10)
        : "",
      endDate: equb.endDate
        ? new Date(equb.endDate).toISOString().slice(0, 10)
        : "",
      currency: equb.currency || "ETB",
      status: equb.status || "PENDING",
    });
  };

  const closeEditModal = () => {
    if (saving) return;

    setEditingEqub(null);
    setActionError("");
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;

    setEditForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleUpdate = async (event) => {
    event.preventDefault();

    if (!editingEqub) return;

    try {
      setSaving(true);
      setActionError("");

      const payload = {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        contributionAmount: Number(editForm.contributionAmount),
        frequency: editForm.frequency,
        totalPeriods: Number(editForm.totalPeriods),
        startDate: editForm.startDate || null,
        endDate: editForm.endDate || null,
        currency: editForm.currency,
        status: editForm.status,
      };

      if (!payload.name) {
        throw new Error("Equb name is required.");
      }

      if (!payload.contributionAmount || payload.contributionAmount <= 0) {
        throw new Error("Contribution amount must be greater than 0.");
      }

      if (!payload.totalPeriods || payload.totalPeriods <= 0) {
        throw new Error("Total periods must be greater than 0.");
      }

      if (
        payload.startDate &&
        payload.endDate &&
        new Date(payload.endDate) < new Date(payload.startDate)
      ) {
        throw new Error("End date cannot be before the start date.");
      }

      const response = await updateEqub(editingEqub.id, payload);

      if (!response.success) {
        throw new Error(response.message || "Failed to update Equb.");
      }

      const updatedEqub = response.equb;

      setEqubs((current) =>
        current.map((equb) =>
          equb.id === editingEqub.id
            ? updatedEqub || { ...equb, ...payload }
            : equb
        )
      );

      setEditingEqub(null);
      setActionError("");
    } catch (err) {
      console.error("Update Equb error:", err);

      setActionError(
        err.response?.data?.message ||
          err.message ||
          "Unable to update this Equb."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeletingId(deleteTarget.id);
      setActionError("");

      await deleteEqub(deleteTarget.id);

      setEqubs((prev) =>
        prev.filter((equb) => equb.id !== deleteTarget.id)
      );

      setDeleteTarget(null);
    } catch (err) {
      console.error("Delete Equb error:", err);

      setActionError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to delete Equb."
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />

          <p className="mt-4 text-sm text-gray-500">
            Loading your Equbs...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h2 className="font-semibold text-red-800">
            Unable to load Equbs
          </h2>

          <p className="mt-2 text-sm text-red-700">{error}</p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-xl bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-gray-500">
            Administration
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            My Equbs
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Manage the Equbs you have created and monitor their progress.
          </p>
        </div>

        <Link
          to="/admin/equbs/create"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-700"
        >
          <span className="text-lg">+</span>
          Create Equb
        </Link>
      </section>

      {/* Action Error */}
      {actionError && !editingEqub && !deleteTarget && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">
            {actionError}
          </p>

          <button
            type="button"
            onClick={() => setActionError("")}
            className="mt-2 text-xs font-semibold text-red-700 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Summary */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => setStatusFilter("ALL")}
          className={`rounded-2xl border p-4 text-left transition ${
            statusFilter === "ALL"
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-gray-200 bg-white hover:border-gray-300"
          }`}
        >
          <p
            className={`text-xs font-medium ${
              statusFilter === "ALL" ? "text-gray-300" : "text-gray-500"
            }`}
          >
            All Equbs
          </p>

          <p className="mt-2 text-2xl font-bold">{counts.all}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("ACTIVE")}
          className={`rounded-2xl border p-4 text-left transition ${
            statusFilter === "ACTIVE"
              ? "border-green-600 bg-green-600 text-white"
              : "border-gray-200 bg-white hover:border-gray-300"
          }`}
        >
          <p
            className={`text-xs font-medium ${
              statusFilter === "ACTIVE"
                ? "text-green-100"
                : "text-gray-500"
            }`}
          >
            Active
          </p>

          <p className="mt-2 text-2xl font-bold">{counts.active}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("PENDING")}
          className={`rounded-2xl border p-4 text-left transition ${
            statusFilter === "PENDING"
              ? "border-yellow-500 bg-yellow-500 text-white"
              : "border-gray-200 bg-white hover:border-gray-300"
          }`}
        >
          <p
            className={`text-xs font-medium ${
              statusFilter === "PENDING"
                ? "text-yellow-100"
                : "text-gray-500"
            }`}
          >
            Pending
          </p>

          <p className="mt-2 text-2xl font-bold">{counts.pending}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("COMPLETED")}
          className={`rounded-2xl border p-4 text-left transition ${
            statusFilter === "COMPLETED"
              ? "border-blue-600 bg-blue-600 text-white"
              : "border-gray-200 bg-white hover:border-gray-300"
          }`}
        >
          <p
            className={`text-xs font-medium ${
              statusFilter === "COMPLETED"
                ? "text-blue-100"
                : "text-gray-500"
            }`}
          >
            Completed
          </p>

          <p className="mt-2 text-2xl font-bold">{counts.completed}</p>
        </button>
      </section>

      {/* Search */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label htmlFor="equb-search" className="sr-only">
              Search Equbs
            </label>

            <input
              id="equb-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by Equb name or description..."
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-gray-900"
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
            <option value="PAUSED">Paused</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </section>

      {/* Results */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-5 sm:px-6">
          <h2 className="text-lg font-bold text-gray-900">Equbs</h2>

          <p className="mt-1 text-sm text-gray-500">
            Showing {filteredEqubs.length} of {equbs.length} Equb
            {equbs.length === 1 ? "" : "s"}.
          </p>
        </div>

        {filteredEqubs.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-2xl">
              ◎
            </div>

            <h3 className="mt-4 font-semibold text-gray-900">
              No Equbs found
            </h3>

            <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">
              {equbs.length === 0
                ? "You haven't created any Equbs yet."
                : "Try changing your search or status filter."}
            </p>

            {equbs.length === 0 && (
              <Link
                to="/admin/equbs/create"
                className="mt-5 inline-flex rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
              >
                Create your first Equb
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Equb</th>
                    <th className="px-6 py-4 font-semibold">
                      Contribution
                    </th>
                    <th className="px-6 py-4 font-semibold">
                      Frequency
                    </th>
                    <th className="px-6 py-4 font-semibold">Periods</th>
                    <th className="px-6 py-4 font-semibold">Members</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredEqubs.map((equb) => (
                    <tr
                      key={equb.id}
                      className="transition hover:bg-gray-50"
                    >
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900">
                          {equb.name}
                        </p>

                        <p className="mt-1 max-w-56 truncate text-xs text-gray-500">
                          {equb.description || "No description"}
                        </p>

                        <p className="mt-1 text-xs text-gray-400">
                          Created {formatDate(equb.createdAt)}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-gray-900">
                        {formatCurrency(
                          equb.contributionAmount,
                          equb.currency || "ETB"
                        )}
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                        {equb.frequency}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600">
                        {equb.currentPeriod ?? 0} /{" "}
                        {equb.totalPeriods ?? 0}
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

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Link
                            to={`/admin/equbs/${equb.id}`}
                            className="text-sm font-semibold text-gray-900 hover:underline"
                          >
                            Manage
                          </Link>

                          <button
                            type="button"
                            onClick={() => openEditModal(equb)}
                            className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteTarget(equb)}
                            disabled={deletingId === equb.id}
                            className="text-sm font-semibold text-red-600 hover:text-red-800 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingId === equb.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="divide-y divide-gray-100 md:hidden">
              {filteredEqubs.map((equb) => (
                <div key={equb.id} className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-gray-900">
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

                  <div className="grid grid-cols-2 gap-4">
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
                        Frequency
                      </p>

                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {equb.frequency}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Period</p>

                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {equb.currentPeriod ?? 0} /{" "}
                        {equb.totalPeriods ?? 0}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Members</p>

                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {equb._count?.memberships ?? 0}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Link
                      to={`/admin/equbs/${equb.id}`}
                      className="rounded-xl border border-gray-200 px-3 py-3 text-center text-sm font-semibold text-gray-900 hover:bg-gray-50"
                    >
                      Manage
                    </Link>

                    <button
                      type="button"
                      onClick={() => openEditModal(equb)}
                      className="rounded-xl border border-blue-200 px-3 py-3 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(equb)}
                      disabled={deletingId === equb.id}
                      className="rounded-xl border border-red-200 px-3 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingId === equb.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Edit Modal */}
      {editingEqub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Edit Equb
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Update the details for {editingEqub.name}.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                disabled={saving}
                className="rounded-lg px-3 py-2 text-xl text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleUpdate} className="space-y-5 p-6">
              {actionError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm text-red-700">{actionError}</p>
                </div>
              )}

              <div>
                <label
                  htmlFor="edit-name"
                  className="mb-2 block text-sm font-semibold text-gray-700"
                >
                  Equb Name
                </label>

                <input
                  id="edit-name"
                  name="name"
                  type="text"
                  value={editForm.name}
                  onChange={handleEditChange}
                  required
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-description"
                  className="mb-2 block text-sm font-semibold text-gray-700"
                >
                  Description
                </label>

                <textarea
                  id="edit-description"
                  name="description"
                  value={editForm.description}
                  onChange={handleEditChange}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="edit-contribution"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Contribution Amount
                  </label>

                  <input
                    id="edit-contribution"
                    name="contributionAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.contributionAmount}
                    onChange={handleEditChange}
                    required
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-currency"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Currency
                  </label>

                  <input
                    id="edit-currency"
                    name="currency"
                    type="text"
                    value={editForm.currency}
                    onChange={handleEditChange}
                    required
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm uppercase outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="edit-frequency"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Frequency
                  </label>

                  <select
                    id="edit-frequency"
                    name="frequency"
                    value={editForm.frequency}
                    onChange={handleEditChange}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="BIWEEKLY">Biweekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="edit-total-periods"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Total Periods
                  </label>

                  <input
                    id="edit-total-periods"
                    name="totalPeriods"
                    type="number"
                    min="1"
                    value={editForm.totalPeriods}
                    onChange={handleEditChange}
                    required
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="edit-start-date"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Start Date
                  </label>

                  <input
                    id="edit-start-date"
                    name="startDate"
                    type="date"
                    value={editForm.startDate}
                    onChange={handleEditChange}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-end-date"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    End Date
                  </label>

                  <input
                    id="edit-end-date"
                    name="endDate"
                    type="date"
                    value={editForm.endDate}
                    onChange={handleEditChange}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="edit-status"
                  className="mb-2 block text-sm font-semibold text-gray-700"
                >
                  Status
                </label>

                <select
                  id="edit-status"
                  name="status"
                  value={editForm.status}
                  onChange={handleEditChange}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                >
                  <option value="PENDING">Pending</option>
                  <option value="ACTIVE">Active</option>
                  <option value="PAUSED">Paused</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={saving}
                  className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Delete Equb
              </h2>

              <p className="mt-2 text-sm text-gray-600">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-gray-900">
                  {deleteTarget.name}
                </span>
                ?
              </p>

              <p className="mt-2 text-sm text-red-600">
                This action cannot be undone.
              </p>
            </div>

            {actionError && (
              <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {actionError}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setActionError("");
                }}
                disabled={deletingId !== null}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={deletingId !== null}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingId !== null ? "Deleting..." : "Delete Equb"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EqubsPage;