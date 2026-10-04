import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
ArrowLeft,
CalendarDays,
CheckCircle2,
CircleDollarSign,
FileText,
Loader2,
Users,
} from "lucide-react";
import api from "../../services/api";

const CreateEqubPage = () => {
const navigate = useNavigate();

const [form, setForm] = useState({
name: "",
description: "",
contributionAmount: "",
frequency: "WEEKLY",
startDate: "",
endDate: "",
currency: "ETB",
});

const [loading, setLoading] = useState(false);
const [error, setError] = useState("");

const handleChange = (event) => {
const { name, value } = event.target;


setForm((current) => ({
  ...current,
  [name]: value,
}));

};

const handleSubmit = async (event) => {
event.preventDefault();


setError("");

if (!form.name.trim()) {
  setError("Equb name is required.");
  return;
}

if (!form.contributionAmount || Number(form.contributionAmount) <= 0) {
  setError("Contribution amount must be greater than 0.");
  return;
}

if (!form.startDate) {
  setError("Start date is required.");
  return;
}

if (!form.endDate) {
  setError("End date is required.");
  return;
}

if (new Date(form.endDate) <= new Date(form.startDate)) {
  setError("End date must be after the start date.");
  return;
}

try {
  setLoading(true);

  const payload = {
    name: form.name.trim(),
    description: form.description.trim() || null,
    contributionAmount: Number(form.contributionAmount),
    frequency: form.frequency,
    startDate: form.startDate,
    endDate: form.endDate,
    currency: form.currency,
  };

  console.log("CREATE EQUB PAYLOAD:", payload);

  const response = await api.post("/equbs", payload);

  console.log("CREATE EQUB RESPONSE:", response.data);

  const createdEqub = response.data?.equb;

  if (!createdEqub?.id) {
    throw new Error("Equb was created but no Equb ID was returned.");
  }

  navigate(`/admin/equbs/${createdEqub.id}`, {
    replace: true,
    state: {
      message: "Equb created successfully with payment periods.",
    },
  });
} catch (err) {
  console.error("Create Equb Error:", err);

  setError(
    err.response?.data?.message ||
      err.message ||
      "Failed to create Equb."
  );
} finally {
  setLoading(false);
}


};

return ( <div className="mx-auto max-w-5xl">
{/* Header */} <div className="mb-8"> <Link
       to="/admin/equbs"
       className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900"
     > <ArrowLeft size={17} />
Back to Equbs </Link>


    <div>
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">
        Create New Equb
      </h1>

      <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
        Create an Equb and define its contribution schedule. Payment
        periods will be generated automatically by the system.
      </p>
    </div>
  </div>

  {/* Error */}
  {error && (
    <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
      <p className="font-semibold">Unable to create Equb</p>
      <p className="mt-1">{error}</p>
    </div>
  )}

  <form onSubmit={handleSubmit}>
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main form */}
      <div className="space-y-6 lg:col-span-2">
        {/* Basic information */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
              <FileText size={20} className="text-gray-700" />
            </div>

            <div>
              <h2 className="font-semibold text-gray-900">
                Basic Information
              </h2>
              <p className="text-sm text-gray-500">
                Give your Equb a name and description.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Equb Name
              </label>

              <input
                id="name"
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Family Weekly Equb"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                required
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Description
                <span className="ml-1 font-normal text-gray-400">
                  (optional)
                </span>
              </label>

              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Describe this Equb..."
                rows={4}
                className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
              />
            </div>
          </div>
        </section>

        {/* Contribution */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
              <CircleDollarSign size={20} className="text-gray-700" />
            </div>

            <div>
              <h2 className="font-semibold text-gray-900">
                Contribution
              </h2>
              <p className="text-sm text-gray-500">
                Define how much members contribute each period.
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="contributionAmount"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Contribution Amount
              </label>

              <div className="relative">
                <input
                  id="contributionAmount"
                  name="contributionAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.contributionAmount}
                  onChange={handleChange}
                  placeholder="3000"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 pr-16 text-sm outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                  required
                />

                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                  {form.currency}
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="frequency"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Contribution Frequency
              </label>

              <select
                id="frequency"
                name="frequency"
                value={form.frequency}
                onChange={handleChange}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
              >
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="BIWEEKLY">Every 2 Weeks</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="currency"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Currency
              </label>

              <select
                id="currency"
                name="currency"
                value={form.currency}
                onChange={handleChange}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
              >
                <option value="ETB">ETB — Ethiopian Birr</option>
                <option value="USD">USD — US Dollar</option>
              </select>
            </div>
          </div>
        </section>

        {/* Schedule */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
              <CalendarDays size={20} className="text-gray-700" />
            </div>

            <div>
              <h2 className="font-semibold text-gray-900">
                Equb Schedule
              </h2>
              <p className="text-sm text-gray-500">
                The system will generate payment periods between these
                dates.
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="startDate"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Start Date
              </label>

              <input
                id="startDate"
                name="startDate"
                type="date"
                value={form.startDate}
                onChange={handleChange}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                required
              />
            </div>

            <div>
              <label
                htmlFor="endDate"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                End Date
              </label>

              <input
                id="endDate"
                name="endDate"
                type="date"
                value={form.endDate}
                onChange={handleChange}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                required
              />
            </div>
          </div>
        </section>
      </div>

      {/* Side summary */}
      <div className="lg:col-span-1">
        <div className="sticky top-6 space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900">
              Equb Summary
            </h2>

            <div className="mt-5 space-y-4">
              <div className="flex items-start gap-3">
                <Users size={18} className="mt-0.5 text-gray-400" />

                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    Name
                  </p>
                  <p className="mt-1 break-words text-sm font-semibold text-gray-900">
                    {form.name || "Your Equb name"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CircleDollarSign
                  size={18}
                  className="mt-0.5 text-gray-400"
                />

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    Contribution
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {form.contributionAmount
                      ? `${Number(
                          form.contributionAmount
                        ).toLocaleString()} ${form.currency}`
                      : "—"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CalendarDays
                  size={18}
                  className="mt-0.5 text-gray-400"
                />

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    Frequency
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {form.frequency}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
            <div className="flex gap-3">
              <CheckCircle2
                size={19}
                className="mt-0.5 shrink-0 text-gray-700"
              />

              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Automatic payment periods
                </h3>

                <p className="mt-2 text-xs leading-5 text-gray-500">
                  Once created, the backend automatically generates the
                  payment periods based on the selected frequency and
                  date range.
                </p>
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-3">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  Creating Equb...
                </>
              ) : (
                <>
                  <CheckCircle2 size={17} />
                  Create Equb
                </>
              )}
            </button>

            <Link
              to="/admin/equbs"
              className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </div>
  </form>
</div>


);
};

export default CreateEqubPage;
