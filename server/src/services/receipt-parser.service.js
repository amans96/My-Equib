const normalizeText = (text) => {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
};

const cleanValue = (value) => {
  if (!value) return null;

  return value
    .replace(/\s+/g, " ")
    .replace(/[,:;|]+$/, "")
    .replace(/^[,:;|]+/, "")
    .trim();
};

const findFirstMatch = (text, patterns) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return cleanValue(match[1]);
    }
  }

  return null;
};

/* =========================================================
   BANK
   ========================================================= */

const extractBankName = (text) => {
  const patterns = [
    /\b([A-Z][A-Z\s&.-]{2,60}\s+BANK(?:\s+[A-Z][A-Z\s&.-]{2,40})?)\b/i,

    /\b(BANK\s+[A-Z][A-Z\s&.-]{2,60})\b/i,

    /\b([A-Z][A-Z\s&.-]{2,50}\s+BANK)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      const value = cleanValue(match[1]);

      if (value) {
        return value.toUpperCase();
      }
    }
  }

  return null;
};

/* =========================================================
   TRANSACTION REFERENCE
   ========================================================= */

const extractTransactionReference = (text) => {
  const patterns = [
    /\btransaction\s+(?:reference|ref|id|number|no)\s*[:\-]?\s*([A-Z0-9-]{6,40})\b/i,

    /\breference\s+(?:number|no|id)?\s*[:\-]?\s*([A-Z0-9-]{6,40})\b/i,

    /\b(?:txn|trx)\s*(?:number|no|id)?\s*[:\-]?\s*([A-Z0-9-]{6,40})\b/i,
  ];

  const labelledReference = findFirstMatch(
    text,
    patterns
  );

  if (labelledReference) {
    return labelledReference.toUpperCase();
  }

  /*
   * Fallback for OCR text where the receipt contains
   * something resembling a transaction reference but
   * the label itself was not recognized.
   *
   * We require a mixture of letters and numbers and
   * avoid ordinary numeric values.
   */

  const candidates = text.match(
    /\b[A-Z0-9]{8,30}\b/gi
  );

  if (!candidates) {
    return null;
  }

  for (const candidate of candidates) {
    const value = candidate.toUpperCase();

    const hasLetter = /[A-Z]/.test(value);
    const hasNumber = /\d/.test(value);

    if (
      hasLetter &&
      hasNumber &&
      value.length >= 8
    ) {
      /*
       * Don't treat common words as references.
       */
      const ignoredWords = [
        "ETHIOPIA",
        "BISHOFTU",
        "INTERNATIONAL",
        "AUTHORIZED",
        "SIGNATORIES",
        "SAMRAWITHA",
      ];

      if (!ignoredWords.includes(value)) {
        return value;
      }
    }
  }

  return null;
};

/* =========================================================
   AMOUNT
   ========================================================= */

const extractAmount = (text) => {
  /*
   * First try explicit amount labels.
   */

  const labelledPatterns = [
    /transaction\s+amount\s*[:\-]?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,

    /amount\s*[:\-]?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,

    /total\s*[:\-]?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,

    /(?:ETB|BIRR)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,

    /([0-9][0-9,]*(?:\.[0-9]{2}))\s*(?:ETB|BIRR)/i,
  ];

  const labelledAmount = findFirstMatch(
    text,
    labelledPatterns
  );

  if (labelledAmount) {
    const amount = Number(
      labelledAmount.replace(/,/g, "")
    );

    if (!Number.isNaN(amount)) {
      return amount;
    }
  }

  /*
   * Fallback:
   *
   * Your actual OCR text contains:
   *
   * 12,600.00
   *
   * Find decimal monetary values.
   */

  const decimalAmounts = text.match(
    /\b\d{1,3}(?:,\d{3})+\.\d{2}\b|\b\d+\.\d{2}\b/g
  );

  if (!decimalAmounts) {
    return null;
  }

  /*
   * Pick the largest plausible monetary value.
   *
   * This is still only OCR extraction.
   * It does NOT mean the payment is verified.
   */

  const amounts = decimalAmounts
    .map((value) =>
      Number(value.replace(/,/g, ""))
    )
    .filter(
      (value) =>
        !Number.isNaN(value) &&
        value > 0 &&
        value < 100000000
    );

  if (!amounts.length) {
    return null;
  }

  return Math.max(...amounts);
};

/* =========================================================
   DATE
   ========================================================= */

const extractTransactionDate = (text) => {
  const patterns = [
    /transaction\s+date\s*[:\-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i,

    /date\s*[:\-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i,

    /\b(\d{1,2}[/-]\d{1,2}[/-]\d{4})\b/,

    /\b(\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (!match?.[1]) {
      continue;
    }

    const value = match[1];

    let year;
    let month;
    let day;

    if (/^\d{4}[/-]/.test(value)) {
      const parts = value.split(/[/-]/);

      year = Number(parts[0]);
      month = Number(parts[1]);
      day = Number(parts[2]);
    } else {
      const parts = value.split(/[/-]/);

      day = Number(parts[0]);
      month = Number(parts[1]);
      year = Number(parts[2]);
    }

    const date = new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

    if (
      !Number.isNaN(date.getTime()) &&
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return date;
    }
  }

  return null;
};

/* =========================================================
   ACCOUNT NUMBERS
   ========================================================= */

const extractAccountNumbers = (text) => {
  /*
   * First look for explicit labels.
   */

  const senderAccount =
    findFirstMatch(text, [
      /account\s+debit(?:ed)?\s*[:\-]?\s*[\s\S]{0,100}?\b(\d{10,20})\b/i,

      /sender\s+account\s*[:\-]?\s*(\d{10,20})\b/i,

      /from\s+account\s*[:\-]?\s*(\d{10,20})\b/i,
    ]);

  const receiverAccount =
    findFirstMatch(text, [
      /account\s+credit(?:ed)?\s*[:\-]?\s*[\s\S]{0,100}?\b(\d{10,20})\b/i,

      /receiver\s+account\s*[:\-]?\s*(\d{10,20})\b/i,

      /to\s+account\s*[:\-]?\s*(\d{10,20})\b/i,
    ]);

  /*
   * If the labels weren't recognized, find long numeric
   * sequences in the receipt.
   */

  const numbers = text.match(
    /\b\d{10,20}\b/g
  ) || [];

  const uniqueNumbers = [
    ...new Set(numbers),
  ];

  let finalSenderAccount =
    senderAccount || null;

  let finalReceiverAccount =
    receiverAccount || null;

  if (
    !finalSenderAccount &&
    uniqueNumbers.length >= 1
  ) {
    finalSenderAccount = uniqueNumbers[0];
  }

  if (
    !finalReceiverAccount &&
    uniqueNumbers.length >= 2
  ) {
    finalReceiverAccount = uniqueNumbers[1];
  }

  return {
    senderAccount: finalSenderAccount,
    receiverAccount: finalReceiverAccount,
  };
};

/* =========================================================
   SENDER NAME
   ========================================================= */

const extractSenderName = (text) => {
  const labelledPatterns = [
    /from\s*[:\-]?\s*([A-Z][A-Z\s.'-]{3,80}?)(?=\s+to\b)/i,

    /sender\s*(?:name)?\s*[:\-]?\s*([A-Z][A-Z\s.'-]{3,80})/i,

    /from\s*[:\-]?\s*([A-Z][A-Z\s.'-]{3,80})/i,
  ];

  const value = findFirstMatch(
    text,
    labelledPatterns
  );

  if (value) {
    return cleanName(value);
  }

  /*
   * Your actual receipt has:
   *
   * FROM AMANUEL SISAY BERED?
   *
   * So use the text following FROM when possible.
   */

  const fromMatch = text.match(
    /\bFROM\s+([A-Z][A-Z\s.'?-]{3,80})/i
  );

  if (fromMatch?.[1]) {
    let name = fromMatch[1];

    /*
     * Stop at common receipt sections.
     */

    name = name.split(
      /\b(?:TO|ACCOUNT|DATE|AMOUNT|REFERENCE|BANK)\b/i
    )[0];

    name = cleanValue(name);

    if (name && name.length >= 3) {
      return name;
    }
  }

  return null;
};

/* =========================================================
   RECEIVER NAME
   ========================================================= */

const extractReceiverName = (text) => {
  const patterns = [
    /to\s*[:\-]?\s*([A-Z][A-Z\s.'-]{3,80}?)(?=\s+(?:maker|checker|account|date|amount|reference)\b|$)/i,

    /receiver\s*(?:name)?\s*[:\-]?\s*([A-Z][A-Z\s.'-]{3,80})/i,

    /beneficiary\s*(?:name)?\s*[:\-]?\s*([A-Z][A-Z\s.'-]{3,80})/i,
  ];

  const value = findFirstMatch(
    text,
    patterns
  );

  if (value) {
    return cleanName(value);
  }

  /*
   * Conservative fallback.
   */

  const toMatch = text.match(
    /\bTO\s+([A-Z][A-Z\s.'?-]{3,80})/i
  );

  if (toMatch?.[1]) {
    let name = toMatch[1];

    name = name.split(
      /\b(?:MAKER|CHECKER|ACCOUNT|DATE|AMOUNT|REFERENCE|BANK)\b/i
    )[0];

    name = cleanValue(name);

    if (name && name.length >= 3) {
      return name;
    }
  }

  return null;
};

const cleanName = (value) => {
  if (!value) return null;

  return value
    .replace(/\s+/g, " ")
    .replace(/[,:;|]+$/, "")
    .trim();
};

/* =========================================================
   MAIN PARSER
   ========================================================= */

export const parseReceiptText = (rawText) => {
  const text = normalizeText(rawText);

  console.log(
    "\n========== RECEIPT PARSER =========="
  );

  console.log(
    "RAW OCR TEXT:\n",
    text
  );

  const bankName =
    extractBankName(text);

  const transactionReference =
    extractTransactionReference(text);

  const amount =
    extractAmount(text);

  const transactionDate =
    extractTransactionDate(text);

  const {
    senderAccount,
    receiverAccount,
  } = extractAccountNumbers(text);

  const senderName =
    extractSenderName(text);

  const receiverName =
    extractReceiverName(text);

  /*
   * Parser confidence is separate from
   * Tesseract confidence.
   */

  let parserConfidence = 0;

  if (bankName) parserConfidence += 15;

  if (transactionReference)
    parserConfidence += 25;

  if (amount !== null)
    parserConfidence += 20;

  if (transactionDate)
    parserConfidence += 15;

  if (senderAccount)
    parserConfidence += 10;

  if (receiverAccount)
    parserConfidence += 10;

  if (senderName)
    parserConfidence += 2.5;

  if (receiverName)
    parserConfidence += 2.5;

  parserConfidence = Math.round(
    parserConfidence
  );

  const result = {
    transactionReference,
    senderName,
    senderAccount,
    receiverName,
    receiverAccount,
    amount,
    transactionDate,
    bankName,
    rawText: text,

    /*
     * IMPORTANT:
     * The controller/service should use this
     * property name.
     */
    parserConfidence,
  };

  console.log(
    "PARSED RECEIPT:",
    result
  );

  console.log(
    "====================================\n"
  );

  return result;
};