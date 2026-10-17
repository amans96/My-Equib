import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import { getEqubs } from "../../services/equbApi";

const formatMoney = (amount, currency = "ETB") => {
  const value = Number(amount);
  if (!Number.isFinite(value)) return String(amount ?? "0.00");

  try {
    return new Intl.NumberFormat("en-ET", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return value.toFixed(2);
  }
};

const formatDate = (date) => {
  if (!date) return "—";
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString();
};

const getErrorMessage = (error) =>
  error.response?.data?.message ||
  error.response?.data?.error ||
  error.message ||
  "Something went wrong.";

const matchingStyles = {
  UNMATCHED: "bg-amber-100 text-amber-800 border-amber-200",
  MATCHED: "bg-green-100 text-green-800 border-green-200",
  DUPLICATE: "bg-gray-100 text-gray-700 border-gray-200",
  SUSPICIOUS: "bg-red-100 text-red-800 border-red-200",
  REVERSED: "bg-purple-100 text-purple-800 border-purple-200",
};

const reviewStyles = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  APPROVED: "bg-green-100 text-green-800 border-green-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
};

const methodStyles = {
  "pdf-table": "bg-blue-100 text-blue-800 border-blue-200",
  "ocr": "bg-purple-100 text-purple-800 border-purple-200",
  "pdf-heuristic": "bg-amber-100 text-amber-800 border-amber-200",
  "excel-table": "bg-emerald-100 text-emerald-800 border-emerald-200",
};

function Badge({ value, styles = {}, label }) {
  const status = value || "UNKNOWN";
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        styles[status] || "border-gray-200 bg-gray-100 text-gray-700"
      }`}
    >
      {label || status.replaceAll("_", " ")}
    </span>
  );
}

function SectionTitle({ children, description }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900">{children}</h2>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
    </div>
  );
}

export default function BankStatements() {
  const { equbId } = useParams();
  const navigate = useNavigate();

  const [equbs, setEqubs] = useState([]);
  const [selectedEqubId, setSelectedEqubId] = useState(equbId || "");

  const [imports, setImports] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // Upload Form
  const [bankName, setBankName] = useState("");
  const [statementFile, setStatementFile] = useState(null);

  // Filters for Saved Transactions
  const [matchingFilter, setMatchingFilter] = useState("ALL");
  const [reviewFilter, setReviewFilter] = useState("ALL");
  const [selectedSavedIds, setSelectedSavedIds] = useState([]);

  // In-flight Review / Staging Preview State
  const [activePreview, setActivePreview] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [selectedPreviewIds, setSelectedPreviewIds] = useState([]);

  // Loading & Feedback
  const [loadingEqubs, setLoadingEqubs] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);

  // Load Equbs
  useEffect(() => {
    let active = true;

    async function loadEqubs() {
      setLoadingEqubs(true);
      try {
        const response = await getEqubs();
        const list = Array.isArray(response)
          ? response
          : response?.equbs || response?.data?.equbs || response?.data || [];

        if (!active) return;
        const safeList = Array.isArray(list) ? list : [];
        setEqubs(safeList);

        if (equbId && safeList.some((item) => item.id === equbId)) {
          setSelectedEqubId(equbId);
        } else if (!equbId && safeList.length > 0) {
          setSelectedEqubId(safeList[0].id);
        }
      } catch (err) {
        if (active) setError(`Could not load Equbs. ${getErrorMessage(err)}`);
      } finally {
        if (active) setLoadingEqubs(false);
      }
    }

    loadEqubs();
    return () => {
      active = false;
    };
  }, [equbId]);

  // Load both import history and saved transactions
  const loadBankStatementData = useCallback(async () => {
    if (!selectedEqubId) {
      setImports([]);
      setTransactions([]);
      setSelectedSavedIds([]);
      return;
    }

    setLoadingData(true);
    setError("");

    try {
      const [importsResponse, transactionsResponse] = await Promise.all([
        api.get(`/equbs/${selectedEqubId}/bank-statements`),
        api.get(`/equbs/${selectedEqubId}/bank-transactions`),
      ]);

      const loadedImports = importsResponse.data?.imports || [];
      const loadedTransactions = transactionsResponse.data?.transactions || [];

      setImports(loadedImports);
      setTransactions(loadedTransactions);
      setSelectedSavedIds([]);

      // If an import is currently in UPLOADED status and we don't have an active preview,
      // load its preview automatically so the admin can resume reviewing
      const pendingImport = loadedImports.find(
        (imp) => imp.status === "UPLOADED" && imp.previewData?.transactions?.length > 0
      );

      if (pendingImport && !activePreview) {
        setActivePreview({
          importId: pendingImport.id,
          originalFileName: pendingImport.originalFileName,
          extractionMethod: pendingImport.previewData.extractionMethod || "pdf-table",
          currency: pendingImport.previewData.currency || "ETB",
          bankName: pendingImport.previewData.bankName || "",
          rowsFound: pendingImport.transactionCount,
        });
        setPreviewRows(pendingImport.previewData.transactions || []);
        setSelectedPreviewIds(
          (pendingImport.previewData.transactions || [])
            .filter((t) => t.decision === "APPROVE")
            .map((t) => t.tempId)
        );
      }
    } catch (err) {
      setError(`Could not load statement data. ${getErrorMessage(err)}`);
    } finally {
      setLoadingData(false);
    }
  }, [selectedEqubId, activePreview]);

  useEffect(() => {
    loadBankStatementData();
  }, [loadBankStatementData]);

  // Filter saved transactions in memory
  const visibleTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const matchingStatus = transaction.status || "UNMATCHED";
      const reviewStatus = transaction.reviewStatus || "PENDING";

      const matchingMatches =
        matchingFilter === "ALL" || matchingStatus === matchingFilter;
      const reviewMatches =
        reviewFilter === "ALL" || reviewStatus === reviewFilter;

      return matchingMatches && reviewMatches;
    });
  }, [transactions, matchingFilter, reviewFilter]);

  const pendingCount = transactions.filter(
    (item) => (item.reviewStatus || "PENDING") === "PENDING"
  ).length;

  const approvedCount = transactions.filter(
    (item) => item.reviewStatus === "APPROVED"
  ).length;

  const rejectedCount = transactions.filter(
    (item) => item.reviewStatus === "REJECTED"
  ).length;

  function handleEqubChange(event) {
    const nextId = event.target.value;
    setSelectedEqubId(nextId);
    setSelectedSavedIds([]);
    setActivePreview(null);
    setPreviewRows([]);
    setSuccess("");
    setError("");
    setConfirmationResult(null);

    if (nextId) {
      navigate(`/admin/equbs/${nextId}/bank-statements`);
    }
  }

  // ============================================================
  // UPLOAD AND PREVIEW HANDLER (STEP 1 & 2)
  // ============================================================
  async function handleUpload(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setConfirmationResult(null);

    if (!selectedEqubId) {
      setError("Please select an Equb first.");
      return;
    }

    if (!bankName.trim()) {
      setError("Please specify the bank name.");
      return;
    }

    if (!statementFile) {
      setError("Please choose a bank statement file (PDF, XLS, or XLSX).");
      return;
    }

    if (!/\.(pdf|xls|xlsx|csv)$/i.test(statementFile.name)) {
      setError("Only PDF, XLS, XLSX, and CSV statement files are supported.");
      return;
    }

    const formData = new FormData();
    formData.append("bankName", bankName.trim());
    formData.append("statement", statementFile);

    setUploading(true);

    try {
      const response = await api.post(
        `/equbs/${selectedEqubId}/bank-statements`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      const result = response.data;
      const extractedRows = result.transactions || [];

      if (extractedRows.length === 0) {
        setError(
          "Extraction completed, but no valid transactions were found in the statement. Please verify the document format."
        );
        return;
      }

      setActivePreview({
        importId: result.importId,
        originalFileName: statementFile.name,
        extractionMethod: result.extractionMethod,
        currency: result.currency || "ETB",
        bankName: bankName.trim(),
        rowsFound: result.rowsFound || extractedRows.length,
        summary: result.summary,
      });

      setPreviewRows(extractedRows);
      // Select all approved rows by default
      setSelectedPreviewIds(
        extractedRows.filter((r) => r.decision === "APPROVE").map((r) => r.tempId)
      );

      setSuccess(
        `Statement extracted using ${result.extractionMethod.toUpperCase()} (${extractedRows.length} transactions). Review and correct editable fields below, then approve.`
      );

      setStatementFile(null);
      const input = document.getElementById("bank-statement-file");
      if (input) input.value = "";

      await loadBankStatementData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  // ============================================================
  // PREVIEW ROW EDITING & APPROVAL TOGGLES (STEP 3 & 4)
  // ============================================================
  function updatePreviewField(tempId, field, value) {
    setPreviewRows((current) =>
      current.map((row) => {
        if (row.tempId !== tempId) return row;
        const updated = { ...row, [field]: value };

        // If amount was edited, recalculate debit/credit if appropriate
        if (field === "amount") {
          const num = parseFloat(value) || 0;
          if (row.credit > 0 || (!row.debit && !row.credit)) {
            updated.credit = num;
            updated.debit = 0;
          } else {
            updated.debit = num;
            updated.credit = 0;
          }
        }
        return updated;
      })
    );
  }

  function togglePreviewDecision(tempId) {
    setPreviewRows((current) =>
      current.map((row) => {
        if (row.tempId !== tempId) return row;
        const nextDecision = row.decision === "APPROVE" ? "REJECT" : "APPROVE";
        return { ...row, decision: nextDecision };
      })
    );

    setSelectedPreviewIds((current) =>
      current.includes(tempId)
        ? current.filter((id) => id !== tempId)
        : [...current, tempId]
    );
  }

  function setAllPreviewDecisions(decision) {
    setPreviewRows((current) =>
      current.map((row) => ({ ...row, decision }))
    );

    if (decision === "APPROVE") {
      setSelectedPreviewIds(previewRows.map((r) => r.tempId));
    } else {
      setSelectedPreviewIds([]);
    }
  }

  function discardPreview() {
    if (
      window.confirm(
        "Are you sure you want to discard this preview? Unsaved transactions will not be imported."
      )
    ) {
      setActivePreview(null);
      setPreviewRows([]);
      setSelectedPreviewIds([]);
      setSuccess("Statement preview discarded.");
    }
  }

  // Resume review of an existing import from history
  async function resumeReview(importItem) {
    setError("");
    setSuccess("");
    setConfirmationResult(null);

    try {
      const response = await api.get(
        `/bank-statement-imports/${importItem.id}/preview`
      );
      const data = response.data;
      const rows = data.transactions || [];

      if (rows.length === 0) {
        setError("This import has no pending preview transactions.");
        return;
      }

      setActivePreview({
        importId: importItem.id,
        originalFileName: importItem.originalFileName,
        extractionMethod: data.extractionMethod || "pdf-table",
        currency: data.currency || "ETB",
        bankName: importItem.previewData?.bankName || "",
        rowsFound: data.summary?.rowsFound || rows.length,
      });

      setPreviewRows(rows);
      setSelectedPreviewIds(
        rows.filter((r) => r.decision === "APPROVE").map((r) => r.tempId)
      );

      // Scroll to review section
      window.scrollTo({ top: 400, behavior: "smooth" });
    } catch (err) {
      setError(`Could not load preview. ${getErrorMessage(err)}`);
    }
  }

  // ============================================================
  // CONFIRM AND SAVE APPROVED TRANSACTIONS (STEP 5, 6, 7)
  // ============================================================
  async function confirmApproval() {
    if (!activePreview || previewRows.length === 0 || confirming) return;

    const approvedRows = previewRows.filter((r) => r.decision === "APPROVE");
    const rejectedRows = previewRows.filter((r) => r.decision === "REJECT");

    if (approvedRows.length === 0) {
      if (
        !window.confirm(
          "All transactions in this statement are marked as REJECTED. Do you want to finalize the import without saving any transactions?"
        )
      ) {
        return;
      }
    }

    setConfirming(true);
    setError("");
    setSuccess("");
    setConfirmationResult(null);

    try {
      const response = await api.post(
        `/bank-statement-imports/${activePreview.importId}/confirm`,
        {
          transactions: previewRows,
          bankName: activePreview.bankName,
        }
      );

      const result = response.data;
      setConfirmationResult(result.results);
      setSuccess(
        result.message ||
          `Saved ${result.results?.saved || 0} approved bank transactions.`
      );

      // Clear preview state
      setActivePreview(null);
      setPreviewRows([]);
      setSelectedPreviewIds([]);

      // Reload updated transactions and import history
      await loadBankStatementData();
    } catch (err) {
      setError(`Confirmation failed: ${getErrorMessage(err)}`);
    } finally {
      setConfirming(false);
    }
  }

  // ============================================================
  // EXISTING SAVED TRANSACTIONS ACTIONS
  // ============================================================
  async function reviewOneSaved(transaction, action) {
    if (reviewing) return;
    let reason = "";

    if (action === "reject") {
      reason = window.prompt("Why are you rejecting this transaction?");
      if (reason === null) return;
      reason = reason.trim();
      if (!reason) {
        setError("A rejection reason is required.");
        return;
      }
    }

    setReviewing(true);
    setError("");
    setSuccess("");

    try {
      const endpoint = action === "approve" ? "approve" : "reject";
      await api.post(
        `/bank-transactions/${transaction.id}/${endpoint}`,
        action === "reject"
          ? { reason }
          : { reason: "Approved by administrator" }
      );

      setSuccess(
        action === "approve"
          ? "Transaction approved for matching."
          : "Transaction rejected."
      );
      await loadBankStatementData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setReviewing(false);
    }
  }

  async function bulkReviewSaved(action) {
    if (reviewing || selectedSavedIds.length === 0) return;
    let reason = "";

    if (action === "REJECT") {
      reason = window.prompt(
        `Why are you rejecting these ${selectedSavedIds.length} transactions?`
      );
      if (reason === null) return;
      reason = reason.trim();
      if (!reason) {
        setError("A rejection reason is required.");
        return;
      }
    }

    setReviewing(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.post("/bank-transactions/bulk-review", {
        transactionIds: selectedSavedIds,
        action,
        ...(action === "REJECT"
          ? { reason }
          : { reason: "Bulk approved by administrator" }),
      });

      setSuccess(
        response.data?.message || `${selectedSavedIds.length} transactions reviewed.`
      );
      setSelectedSavedIds([]);
      await loadBankStatementData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setReviewing(false);
    }
  }

  const approvedPreviewCount = previewRows.filter((r) => r.decision === "APPROVE").length;
  const rejectedPreviewCount = previewRows.filter((r) => r.decision === "REJECT").length;
  const warningPreviewCount = previewRows.filter(
    (r) => r.warnings?.length > 0 || r.needsReview
  ).length;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Header */}
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
                ADMIN WORKFLOW
              </span>
              <span className="text-xs text-gray-500">•</span>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                Payment Verification
              </p>
            </div>
            <h1 className="mt-1 text-2xl font-extrabold text-gray-900 sm:text-3xl">
              Bank Statement Import & Review
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Upload bank statements (PDF, XLS, CSV). Extract text via table parser or OCR,
              review and approve extracted records, and save valid transactions to the Equb ledger.
            </p>
          </div>

          <button
            type="button"
            onClick={loadBankStatementData}
            disabled={!selectedEqubId || loadingData}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
          >
            <svg
              className={`h-4 w-4 ${loadingData ? "animate-spin text-indigo-600" : "text-gray-500"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {loadingData ? "Refreshing..." : "Refresh Ledger"}
          </button>
        </header>

        {/* Global Error Banner */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm"
          >
            <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1 whitespace-pre-wrap font-medium">{error}</div>
            <button type="button" onClick={() => setError("")} className="text-red-600 hover:text-red-800">
              ×
            </button>
          </div>
        )}

        {/* Global Success Banner */}
        {success && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 shadow-sm"
          >
            <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1 font-medium">{success}</div>
            <button type="button" onClick={() => setSuccess("")} className="text-green-600 hover:text-green-800">
              ×
            </button>
          </div>
        )}

        {/* Post-Approval Summary Card */}
        {confirmationResult && (
          <section className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-5 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-900">
              Import & Approval Results
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-lg bg-white p-3 border border-indigo-100">
                <p className="text-xs text-gray-500 font-medium">Approved</p>
                <p className="text-2xl font-extrabold text-green-600">
                  {confirmationResult.approved ?? 0}
                </p>
              </div>
              <div className="rounded-lg bg-white p-3 border border-indigo-100">
                <p className="text-xs text-gray-500 font-medium">Saved to DB</p>
                <p className="text-2xl font-extrabold text-indigo-600">
                  {confirmationResult.saved ?? 0}
                </p>
              </div>
              <div className="rounded-lg bg-white p-3 border border-indigo-100">
                <p className="text-xs text-gray-500 font-medium">Rejected</p>
                <p className="text-2xl font-extrabold text-red-600">
                  {confirmationResult.rejected ?? 0}
                </p>
              </div>
              <div className="rounded-lg bg-white p-3 border border-indigo-100">
                <p className="text-xs text-gray-500 font-medium">Skipped Duplicates</p>
                <p className="text-2xl font-extrabold text-amber-600">
                  {confirmationResult.duplicates ?? 0}
                </p>
              </div>
              <div className="rounded-lg bg-white p-3 border border-indigo-100">
                <p className="text-xs text-gray-500 font-medium">Final Status</p>
                <p className="text-sm font-bold mt-1.5 text-gray-800">
                  {confirmationResult.importStatus || "COMPLETED"}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Equb Selection Card */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <label htmlFor="equb-select" className="mb-2 block text-sm font-semibold text-gray-800">
            Select Active Equb
          </label>
          {loadingEqubs ? (
            <p className="text-sm text-gray-500 animate-pulse">Loading Equbs...</p>
          ) : equbs.length === 0 ? (
            <p className="text-sm text-gray-600">
              No Equbs found under your administration.
            </p>
          ) : (
            <select
              id="equb-select"
              value={selectedEqubId}
              onChange={handleEqubChange}
              className="w-full max-w-xl rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">Choose an Equb</option>
              {equbs.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name || item.title || item.id}
                </option>
              ))}
            </select>
          )}
        </section>

        {/* Step 1: Upload Bank Statement */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <SectionTitle description="Upload an official statement from CBE, Awash, Dashen, Abyssinia, Telebirr, or international banks. Supported formats: PDF (text or scanned), XLS, XLSX, CSV.">
            Step 1: Upload Bank Statement
          </SectionTitle>

          <form onSubmit={handleUpload} className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="bank-name" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Issuing Bank Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="bank-name"
                  value={bankName}
                  onChange={(event) => setBankName(event.target.value)}
                  placeholder="e.g. Commercial Bank of Ethiopia, Awash Bank, Apex Bank"
                  required
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label htmlFor="bank-statement-file" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Statement Document <span className="text-red-500">*</span>
                </label>
                <input
                  id="bank-statement-file"
                  type="file"
                  accept=".pdf,.xls,.xlsx,.csv,application/pdf"
                  onChange={(event) => setStatementFile(event.target.files?.[0] || null)}
                  required
                  className="block w-full rounded-lg border border-gray-300 bg-white text-sm shadow-sm file:mr-4 file:border-0 file:bg-indigo-50 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
                />
                {statementFile && (
                  <p className="mt-1.5 text-xs text-gray-500">
                    Selected: <strong>{statementFile.name}</strong> (
                    {(statementFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={uploading || !selectedEqubId}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Extracting & Running OCR Fallback...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload and Preview Transactions
                  </>
                )}
              </button>

              <span className="text-xs text-gray-500">
                OCR fallback will automatically engage if the document is scanned.
              </span>
            </div>
          </form>
        </section>

        {/* Step 2 & 3: Admin Review & Approval Screen */}
        {activePreview && (
          <section className="rounded-xl border-2 border-indigo-500 bg-white p-5 shadow-lg sm:p-6">
            <div className="flex flex-col justify-between gap-4 border-b border-gray-200 pb-5 lg:flex-row lg:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
                    Step 2: Admin Review
                  </span>
                  <Badge
                    value={activePreview.extractionMethod}
                    styles={methodStyles}
                    label={
                      activePreview.extractionMethod === "ocr"
                        ? "OCR Fallback Used"
                        : activePreview.extractionMethod === "pdf-table"
                        ? "PDF Structured Table"
                        : activePreview.extractionMethod
                    }
                  />
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                    Currency: {activePreview.currency}
                  </span>
                </div>

                <h2 className="mt-2 text-xl font-extrabold text-gray-900">
                  Review Extracted Transactions ({previewRows.length} rows)
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  File: <strong className="text-gray-800">{activePreview.originalFileName}</strong> • Bank:{" "}
                  <strong className="text-gray-800">{activePreview.bankName}</strong>. You can correct editable fields,
                  approve or reject individual transactions, or approve all valid records.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setAllPreviewDecisions("APPROVE")}
                  className="rounded-lg border border-green-300 bg-green-50 px-3.5 py-2 text-xs font-bold text-green-800 hover:bg-green-100"
                >
                  Approve All ({previewRows.length})
                </button>

                <button
                  type="button"
                  onClick={() => setAllPreviewDecisions("REJECT")}
                  className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-800 hover:bg-red-100"
                >
                  Reject All
                </button>

                <button
                  type="button"
                  onClick={discardPreview}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Discard Preview
                </button>

                <button
                  type="button"
                  disabled={confirming}
                  onClick={confirmApproval}
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-green-700 disabled:opacity-50"
                >
                  {confirming ? (
                    <>
                      <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Validating & Saving...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      Save {approvedPreviewCount} Approved Transactions
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Preview Summary Pills */}
            <div className="mt-4 flex flex-wrap gap-3 text-xs">
              <span className="rounded-lg bg-green-50 border border-green-200 px-3 py-1.5 font-semibold text-green-800">
                ✓ {approvedPreviewCount} Approved to be saved
              </span>
              <span className="rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 font-semibold text-red-800">
                ✕ {rejectedPreviewCount} Rejected (excluded from ledger)
              </span>
              {warningPreviewCount > 0 && (
                <span className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 font-semibold text-amber-800">
                  ⚠ {warningPreviewCount} Transactions require review
                </span>
              )}
            </div>

            {/* Editable Preview Table */}
            <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-[1500px] divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-gray-100 text-xs uppercase font-semibold text-gray-600">
                  <tr>
                    <th className="px-3 py-3 text-center">Decision</th>
                    <th className="px-3 py-3">Date (YYYY-MM-DD)</th>
                    <th className="px-3 py-3">Reference</th>
                    <th className="px-3 py-3">Description</th>
                    <th className="px-3 py-3 text-right">Debit</th>
                    <th className="px-3 py-3 text-right">Credit</th>
                    <th className="px-3 py-3 text-right">Amount ({activePreview.currency})</th>
                    <th className="px-3 py-3 text-right">Balance</th>
                    <th className="px-3 py-3">Confidence & Warnings</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 bg-white">
                  {previewRows.map((row) => {
                    const isApproved = row.decision === "APPROVE";
                    const hasWarnings = row.warnings?.length > 0;

                    return (
                      <tr
                        key={row.tempId}
                        className={`align-top transition ${
                          isApproved
                            ? hasWarnings
                              ? "bg-amber-50/40 hover:bg-amber-50"
                              : "hover:bg-gray-50"
                            : "bg-red-50/30 opacity-70 hover:opacity-100"
                        }`}
                      >
                        {/* Decision Toggle */}
                        <td className="px-3 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => togglePreviewDecision(row.tempId)}
                            className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                              isApproved
                                ? "bg-green-600 text-white shadow-sm hover:bg-green-700"
                                : "bg-red-600 text-white shadow-sm hover:bg-red-700"
                            }`}
                          >
                            {isApproved ? "✓ APPROVE" : "✕ REJECT"}
                          </button>
                        </td>

                        {/* Editable Date */}
                        <td className="px-3 py-3">
                          <input
                            type="text"
                            value={row.transactionDate || ""}
                            onChange={(e) =>
                              updatePreviewField(row.tempId, "transactionDate", e.target.value)
                            }
                            className={`w-32 rounded border px-2 py-1 text-xs font-medium ${
                              row.warnings?.some((w) => w.includes("Day") || w.includes("date"))
                                ? "border-amber-400 bg-amber-50 font-bold text-amber-900"
                                : "border-gray-300"
                            }`}
                          />
                        </td>

                        {/* Editable Reference */}
                        <td className="px-3 py-3">
                          <input
                            type="text"
                            value={row.reference || ""}
                            onChange={(e) =>
                              updatePreviewField(row.tempId, "reference", e.target.value)
                            }
                            placeholder="NOREF (auto)"
                            className={`w-36 rounded border px-2 py-1 text-xs font-mono font-medium ${
                              row.isDuplicate
                                ? "border-red-400 bg-red-50 text-red-900 font-bold"
                                : "border-gray-300"
                            }`}
                          />
                        </td>

                        {/* Editable Description */}
                        <td className="px-3 py-3">
                          <textarea
                            rows="2"
                            value={row.description || ""}
                            onChange={(e) =>
                              updatePreviewField(row.tempId, "description", e.target.value)
                            }
                            className="w-72 rounded border border-gray-300 px-2 py-1 text-xs"
                          />
                        </td>

                        {/* Debit */}
                        <td className="px-3 py-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={row.debit || 0}
                            onChange={(e) =>
                              updatePreviewField(row.tempId, "debit", parseFloat(e.target.value) || 0)
                            }
                            className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-xs"
                          />
                        </td>

                        {/* Credit */}
                        <td className="px-3 py-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={row.credit || 0}
                            onChange={(e) =>
                              updatePreviewField(row.tempId, "credit", parseFloat(e.target.value) || 0)
                            }
                            className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-xs"
                          />
                        </td>

                        {/* Amount */}
                        <td className="px-3 py-3 text-right font-bold text-gray-900">
                          <input
                            type="number"
                            step="0.01"
                            value={row.amount || 0}
                            onChange={(e) =>
                              updatePreviewField(row.tempId, "amount", parseFloat(e.target.value) || 0)
                            }
                            className="w-28 rounded border border-gray-300 px-2 py-1 text-right text-xs font-bold"
                          />
                        </td>

                        {/* Balance */}
                        <td className="px-3 py-3 text-right text-xs text-gray-700">
                          {row.balance !== null ? formatMoney(row.balance, row.currency) : "—"}
                        </td>

                        {/* Confidence & Warnings */}
                        <td className="px-3 py-3">
                          <div className="space-y-1">
                            <span
                              className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${
                                (row.confidence || 0) >= 0.9
                                  ? "bg-green-100 text-green-800"
                                  : (row.confidence || 0) >= 0.8
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              Score: {Math.round((row.confidence || 0) * 100)}%
                            </span>

                            {row.warnings && row.warnings.length > 0 && (
                              <ul className="text-xs text-amber-800">
                                {row.warnings.map((w, wIdx) => (
                                  <li key={wIdx} className="list-disc ml-3">
                                    {w}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions */}
            <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <span className="text-xs text-gray-500">
                Step 3 of 3: Clicking confirm will validate and commit approved rows to the Equb bank ledger.
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={discardPreview}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Discard
                </button>
                <button
                  type="button"
                  disabled={confirming}
                  onClick={confirmApproval}
                  className="rounded-lg bg-green-600 px-5 py-2 text-xs font-bold text-white shadow hover:bg-green-700 disabled:opacity-50"
                >
                  {confirming ? "Saving..." : `Confirm & Save (${approvedPreviewCount} records)`}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Saved Transactions Overview Cards */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <SectionTitle description="Saved transactions currently stored in the Equb bank transactions ledger.">
            Approved Bank Transactions Summary
          </SectionTitle>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-800">Pending Review / Unmatched</p>
              <p className="mt-1 text-2xl font-bold text-amber-900">{pendingCount}</p>
            </div>

            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-medium text-green-800">Approved for Matching</p>
              <p className="mt-1 text-2xl font-bold text-green-900">{approvedCount}</p>
            </div>

            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800">Rejected</p>
              <p className="mt-1 text-2xl font-bold text-red-900">{rejectedCount}</p>
            </div>
          </div>
        </section>

        {/* Saved Transactions Table */}
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-gray-200 p-5 lg:flex-row lg:items-center">
            <SectionTitle description={`${visibleTransactions.length} transactions displayed`}>
              Saved Bank Transactions
            </SectionTitle>

            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Filter by review status"
                value={reviewFilter}
                onChange={(event) => {
                  setReviewFilter(event.target.value);
                  setSelectedSavedIds([]);
                }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="ALL">All review statuses</option>
                <option value="APPROVED">Approved</option>
                <option value="PENDING">Pending review</option>
                <option value="REJECTED">Rejected</option>
              </select>

              <select
                aria-label="Filter by matching status"
                value={matchingFilter}
                onChange={(event) => {
                  setMatchingFilter(event.target.value);
                  setSelectedSavedIds([]);
                }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="ALL">All matching statuses</option>
                <option value="UNMATCHED">Unmatched</option>
                <option value="MATCHED">Matched</option>
                <option value="SUSPICIOUS">Suspicious</option>
                <option value="DUPLICATE">Duplicate</option>
                <option value="REVERSED">Reversed</option>
              </select>
            </div>
          </div>

          {selectedSavedIds.length > 0 && (
            <div className="flex flex-col justify-between gap-3 border-b border-indigo-100 bg-indigo-50 p-4 sm:flex-row sm:items-center">
              <p className="text-sm font-semibold text-indigo-950">
                {selectedSavedIds.length} saved transaction(s) selected
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={reviewing}
                  onClick={() => bulkReviewSaved("APPROVE")}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Approve selected
                </button>

                <button
                  type="button"
                  disabled={reviewing}
                  onClick={() => bulkReviewSaved("REJECT")}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Reject selected
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedSavedIds([])}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
                >
                  Clear selection
                </button>
              </div>
            </div>
          )}

          {loadingData ? (
            <div className="p-10 text-center text-sm text-gray-500">
              Loading saved bank transactions...
            </div>
          ) : visibleTransactions.length === 0 ? (
            <div className="p-10 text-center">
              <p className="font-semibold text-gray-800">No bank transactions found in ledger</p>
              <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">
                Upload a statement using the form above. Once extracted, you will be able to review,
                edit, and approve transactions before they are committed to this ledger.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1500px] divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Select</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Sender / Account</th>
                    <th className="px-4 py-3">Receiver / Account</th>
                    <th className="px-4 py-3 text-right">Amount (ETB)</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Review</th>
                    <th className="px-4 py-3">Matching</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 bg-white">
                  {visibleTransactions.map((tx) => {
                    const reviewStatus = tx.reviewStatus || "PENDING";
                    const locked = tx.status === "MATCHED" || Boolean(tx.matchedPaymentId);

                    return (
                      <tr key={tx.id} className="align-top hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selectedSavedIds.includes(tx.id)}
                            onChange={() =>
                              setSelectedSavedIds((current) =>
                                current.includes(tx.id)
                                  ? current.filter((id) => id !== tx.id)
                                  : [...current, tx.id]
                              )
                            }
                            disabled={locked || reviewing}
                          />
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-gray-700">
                          {formatDate(tx.transactionDate)}
                        </td>

                        <td className="max-w-48 break-all px-4 py-4 font-mono font-medium text-gray-900">
                          {tx.transactionReference}
                        </td>

                        <td className="max-w-52 whitespace-pre-wrap px-4 py-4 text-xs text-gray-700">
                          <div className="font-semibold text-gray-800">{tx.senderName || "—"}</div>
                          <div className="font-mono text-gray-500">{tx.senderAccount || ""}</div>
                        </td>

                        <td className="max-w-52 whitespace-pre-wrap px-4 py-4 text-xs text-gray-700">
                          <div className="font-semibold text-gray-800">{tx.receiverName || "—"}</div>
                          <div className="font-mono text-gray-500">{tx.receiverAccount || ""}</div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-right font-bold text-gray-900">
                          {formatMoney(tx.amount)}
                        </td>

                        <td className="max-w-sm whitespace-pre-wrap px-4 py-4 text-xs text-gray-600">
                          {tx.description || "—"}
                          {tx.reviewReason && (
                            <p className="mt-1 font-medium text-gray-500">Note: {tx.reviewReason}</p>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <Badge value={reviewStatus} styles={reviewStyles} />
                        </td>

                        <td className="px-4 py-4">
                          <Badge value={tx.status} styles={matchingStyles} />
                        </td>

                        <td className="px-4 py-4">
                          {locked ? (
                            <span className="text-xs font-medium text-gray-500">Matched to Payment</span>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              {reviewStatus !== "APPROVED" && (
                                <button
                                  type="button"
                                  disabled={reviewing}
                                  onClick={() => reviewOneSaved(tx, "approve")}
                                  className="rounded bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700"
                                >
                                  Approve
                                </button>
                              )}
                              {reviewStatus !== "REJECTED" && (
                                <button
                                  type="button"
                                  disabled={reviewing}
                                  onClick={() => reviewOneSaved(tx, "reject")}
                                  className="rounded bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700"
                                >
                                  Reject
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Import History Table */}
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 p-5">
            <SectionTitle description="Audit log of uploaded statements, extraction methods, and outcomes.">
              Statement Import History
            </SectionTitle>
          </div>

          {loadingData ? (
            <p className="p-6 text-sm text-gray-500">Loading import history...</p>
          ) : imports.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">No statement imports recorded for this Equb.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500">
                  <tr>
                    <th className="px-4 py-3">File Name</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-center">Rows Found</th>
                    <th className="px-4 py-3 text-center">Saved to DB</th>
                    <th className="px-4 py-3 text-center">Skipped / Failed</th>
                    <th className="px-4 py-3">Uploaded</th>
                    <th className="px-4 py-3">Diagnostics & Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 bg-white">
                  {imports.map((item) => (
                    <tr key={item.id} className="align-top hover:bg-gray-50">
                      <td className="max-w-xs break-all px-4 py-4 font-medium text-gray-900">
                        {item.originalFileName}
                      </td>

                      <td className="px-4 py-4">
                        <Badge
                          value={item.status}
                          styles={{
                            COMPLETED: "bg-green-100 text-green-800 border-green-200",
                            COMPLETED_WITH_ERRORS: "bg-amber-100 text-amber-800 border-amber-200",
                            UPLOADED: "bg-blue-100 text-blue-800 border-blue-200",
                            PROCESSING: "bg-indigo-100 text-indigo-800 border-indigo-200",
                            FAILED: "bg-red-100 text-red-800 border-red-200",
                          }}
                          label={item.status === "UPLOADED" ? "In Review" : undefined}
                        />
                      </td>

                      <td className="px-4 py-4 text-center font-bold text-gray-800">
                        {item.transactionCount ?? "—"}
                      </td>

                      <td className="px-4 py-4 text-center font-bold text-green-700">
                        {item.importedCount ?? 0}
                      </td>

                      <td className="px-4 py-4 text-center font-bold text-red-700">
                        {item.failedCount ?? 0}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-xs text-gray-600">
                        {formatDate(item.createdAt)}
                      </td>

                      <td className="max-w-md whitespace-pre-wrap px-4 py-4 text-xs">
                        {item.status === "UPLOADED" && item.previewData?.transactions && (
                          <button
                            type="button"
                            onClick={() => resumeReview(item)}
                            className="inline-flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1 font-semibold text-white hover:bg-indigo-700"
                          >
                            Resume Review →
                          </button>
                        )}
                        {item.errorMessage && (
                          <p className="text-red-700 font-medium">{item.errorMessage}</p>
                        )}
                        {!item.errorMessage && item.status !== "UPLOADED" && (
                          <span className="text-gray-400">All checks passed.</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
