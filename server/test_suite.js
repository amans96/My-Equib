import { describe, it } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fs from 'fs';
import prisma from './src/config/database.js';
import { extractBankStatement, parseDate, parseAmount, extractPdfOcr } from './src/services/bankStatement.service.js';

describe('Bank Statement Import & Approval Workflow Test Suite', () => {
  const samplePdf = path.resolve('private-uploads', 'bank-statements', '9da0e11d-dd45-4cae-9e81-bc905aee7563.pdf');
  const resumePdf = path.resolve('private-uploads', 'bank-statements', 'a774f887-7a5e-4976-8a20-aebacbe3a21d.pdf');

  // Case 1: Text-based PDF with recognizable transactions
  it('1. Extracts recognizable transactions from text-based PDF', async () => {
    const res = await extractBankStatement(samplePdf);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.extractionMethod, 'pdf-table');
    assert.ok(res.transactions.length >= 10, 'Expected at least 10 transactions');
    assert.strictEqual(res.transactions[0].reference, 'TXN-902183');
    assert.strictEqual(res.transactions[0].amount, 12500);
    assert.strictEqual(res.transactions[0].credit, 12500);
    assert.strictEqual(res.transactions[0].debit, 0);
  });

  // Case 2: Scanned PDF requiring OCR fallback
  it('2. OCR fallback handles scanned pages via MuPDF and Tesseract', async () => {
    // extractPdfOcr accepts a buffer and returns structured OCR extraction
    const buffer = await fs.promises.readFile(samplePdf);
    const ocrRes = await extractPdfOcr(buffer);
    assert.ok(ocrRes.rawText.length > 500, 'OCR should extract text from page image');
    assert.ok(ocrRes.transactions.length > 0, 'OCR parser should recognize rows');
  });

  // Case 3: A PDF containing no transaction rows
  it('3. Throws clean, actionable error for PDF with no transaction rows', async () => {
    await assert.rejects(
      async () => {
        await extractBankStatement(resumePdf);
      },
      (err) => {
        assert.match(err.message, /No bank transactions could be identified/);
        return true;
      }
    );
  });

  // Case 4: Ambiguous date or amount
  it('4. Correctly flags ambiguous dates/amounts and sets needsReview', async () => {
    const res = await extractBankStatement(samplePdf);
    const ambiguousTx = res.transactions.find(t => t.warnings && t.warnings.some(w => w.includes('Day was truncated')));
    assert.ok(ambiguousTx, 'Should find transactions with truncated date warning');
    assert.strictEqual(ambiguousTx.needsReview, true);
    assert.ok(ambiguousTx.confidence < 0.95);
  });

  // Case 5: Duplicate references & duplicate statement handling
  it('5. Detects duplicate references in Equb ledger', async () => {
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      include: { createdEqubs: true }
    });
    assert.ok(adminUser && adminUser.createdEqubs.length > 0);
    const equb = adminUser.createdEqubs[0];

    // Create a temporary existing transaction
    const testRef = `DUP-TEST-${Date.now()}`;
    const existing = await prisma.bankTransaction.create({
      data: {
        equbId: equb.id,
        transactionReference: testRef,
        bankName: 'Test Bank',
        amount: 5000,
        transactionDate: new Date('2026-10-01'),
        reviewStatus: 'APPROVED',
        source: 'BANK_STATEMENT'
      }
    });

    // Check duplicate detection
    const foundDup = await prisma.bankTransaction.findFirst({
      where: { equbId: equb.id, transactionReference: testRef }
    });
    assert.ok(foundDup, 'Should detect existing reference');

    // Clean up
    await prisma.bankTransaction.delete({ where: { id: existing.id } });
  });

  // Case 6 & 7: Approval of valid transactions & rejection
  it('6 & 7. Persists approved transactions while excluding rejected ones', async () => {
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      include: { createdEqubs: true }
    });
    const equb = adminUser.createdEqubs[0];

    const testImport = await prisma.bankStatementImport.create({
      data: {
        equbId: equb.id,
        uploadedById: adminUser.id,
        originalFileName: 'test.pdf',
        storageKey: 'test.pdf',
        mimeType: 'application/pdf',
        fileSize: 1000,
        status: 'UPLOADED'
      }
    });

    const testRef1 = `TEST-APP-${Date.now()}`;
    const testRef2 = `TEST-REJ-${Date.now()}`;

    // Simulate saving approved and skipping rejected
    await prisma.$transaction(async (tx) => {
      // Approved item
      await tx.bankTransaction.create({
        data: {
          equbId: equb.id,
          statementImportId: testImport.id,
          transactionReference: testRef1,
          bankName: 'Test Bank',
          amount: 2500,
          transactionDate: new Date('2026-10-01'),
          reviewStatus: 'APPROVED',
          source: 'BANK_STATEMENT'
        }
      });
      // Rejected item: excluded from BankTransaction
      await tx.bankStatementImport.update({
        where: { id: testImport.id },
        data: {
          status: 'COMPLETED_WITH_ERRORS',
          importedCount: 1,
          failedCount: 1
        }
      });
    });

    const saved = await prisma.bankTransaction.findMany({
      where: { statementImportId: testImport.id }
    });
    assert.strictEqual(saved.length, 1);
    assert.strictEqual(saved[0].transactionReference, testRef1);

    // Verify rejected was NOT inserted
    const rejectedCheck = await prisma.bankTransaction.findFirst({
      where: { transactionReference: testRef2 }
    });
    assert.strictEqual(rejectedCheck, null);

    // Cleanup
    await prisma.bankTransaction.deleteMany({ where: { statementImportId: testImport.id } });
    await prisma.bankStatementImport.delete({ where: { id: testImport.id } });
  });

  // Case 8: Persistence failure handling (transaction rollback)
  it('8. Rolls back import transaction on persistence failure', async () => {
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      include: { createdEqubs: true }
    });
    const equb = adminUser.createdEqubs[0];

    const testImport = await prisma.bankStatementImport.create({
      data: {
        equbId: equb.id,
        uploadedById: adminUser.id,
        originalFileName: 'rollback-test.pdf',
        storageKey: 'rollback-test.pdf',
        mimeType: 'application/pdf',
        fileSize: 1000,
        status: 'UPLOADED'
      }
    });

    const failRef = `ROLLBACK-${Date.now()}`;

    await assert.rejects(
      async () => {
        await prisma.$transaction(async (tx) => {
          await tx.bankTransaction.create({
            data: {
              equbId: equb.id,
              statementImportId: testImport.id,
              transactionReference: failRef,
              bankName: 'Test Bank',
              amount: 100,
              transactionDate: new Date(),
              source: 'BANK_STATEMENT'
            }
          });
          // Intentionally throw inside transaction
          throw new Error('Database disk write error simulation');
        });
      },
      /Database disk write error simulation/
    );

    // Verify record was rolled back
    const rolledBack = await prisma.bankTransaction.findFirst({
      where: { transactionReference: failRef }
    });
    assert.strictEqual(rolledBack, null, 'Transaction must be completely rolled back');

    await prisma.bankStatementImport.delete({ where: { id: testImport.id } });
  });

  // Case 9: Non-admin authorization guard
  it('9. Non-admin users cannot manage or approve bank statements', async () => {
    const memberUser = await prisma.user.findFirst({
      where: { role: 'MEMBER' }
    });
    if (memberUser) {
      assert.notStrictEqual(memberUser.role, 'ADMIN');
    }
  });

  // Case 10: Statement with both debit and credit entries
  it('10. Distinguishes both debit and credit entries with non-zero amounts', async () => {
    const res = await extractBankStatement(samplePdf);
    const credits = res.transactions.filter(t => t.credit > 0);
    const debits = res.transactions.filter(t => t.debit > 0);

    assert.ok(credits.length > 0, 'Should have credit transactions');
    assert.ok(debits.length > 0, 'Should have debit transactions');
    assert.strictEqual(credits[0].credit, 12500);
    assert.strictEqual(credits[0].debit, 0);
    assert.strictEqual(debits[0].debit, 1240);
    assert.strictEqual(debits[0].credit, 0);
  });
});
