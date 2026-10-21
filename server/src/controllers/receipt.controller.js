import prisma from "../config/database.js";
import path from "path";
import fs from "fs";

import { processReceiptOCR } from "../services/ocr.service.js";

// ============================================================
// UPLOAD RECEIPT
// POST /api/payment-periods/:periodId/receipts
// ============================================================



export const uploadReceipt = async (req, res) => {
  try {
    const { periodId } = req.params;
    const userId = req.user.userId;

    // 1. Validate the uploaded file.
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a receipt image",
      });
    }

    // 2. Find the payment period and its Equb.
    const period = await prisma.paymentPeriod.findUnique({
      where: { id: periodId },
      include: {
        equb: {
          select: {
            id: true,
            name: true,
            contributionAmount: true,
            currency: true,
            status: true,
          },
        },
      },
    });

    if (!period) {
      return res.status(404).json({
        success: false,
        message: "Payment period not found",
      });
    }

    // 3. Verify that the member has an active membership.
    const membership = await prisma.equbMembership.findFirst({
      where: {
        userId,
        equbId: period.equbId,
        status: "ACTIVE",
      },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You are not an active member of this Equb",
      });
    }

    // 4. Find an existing payment either submitted for this
    // period or already allocated to this period.
    //
    // This is important because a newly uploaded payment might
    // not have any allocations until OCR/payment matching runs.
    const existingPayment = await prisma.payment.findFirst({
      where: {
        membershipId: membership.id,
        OR: [
          {
            submittedForPeriodId: period.id,
          },
          {
            allocations: {
              some: {
                periodId: period.id,
              },
            },
          },
        ],
      },
      include: {
        receipts: {
          orderBy: {
            uploadedAt: "desc",
          },
        },
        allocations: {
          include: {
            period: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    // 5. Handle an existing payment.
    if (existingPayment) {
      const canReplaceReceipt = [
        "REJECTED",
        "NEEDS_REVIEW",
      ].includes(existingPayment.status);

      if (!canReplaceReceipt) {
        return res.status(409).json({
          success: false,
          message:
            "A payment already exists for this period and cannot accept another receipt.",
          payment: existingPayment,
        });
      }

      // Attach the replacement receipt to the existing payment.
      const receipt = await prisma.receipt.create({
        data: {
          paymentId: existingPayment.id,
          uploadedById: userId,
          imageUrl: `/uploads/receipts/${req.file.filename}`,
          storageKey: `receipts/${req.file.filename}`,
          originalFileName: req.file.originalname,
          mimeType: req.file.mimetype,
          fileSize: req.file.size,
          status: "UPLOADED",
          ocrProcessed: false,
        },
      });

      // Reset the payment for a new OCR/review attempt.
      // Preserve its existing allocations and extra amount.
      const updatedPayment = await prisma.payment.update({
        where: {
          id: existingPayment.id,
        },
        data: {
          status: "PENDING",
          submittedForPeriodId:
            existingPayment.submittedForPeriodId ?? period.id,
        },
        include: {
          receipts: {
            orderBy: {
              uploadedAt: "desc",
            },
          },
          allocations: {
            include: {
              period: true,
            },
          },
          membership: true,
        },
      });

      return res.status(201).json({
        success: true,
        message: "Replacement receipt uploaded successfully",
        payment: updatedPayment,
        receipt,
      });
    }

    // 6. Calculate the expected contribution.
    // This is not the actual amount paid or OCR-confirmed amount.
    const expectedAmount =
      Number(period.equb.contributionAmount) *
      Number(membership.shares);

    // 7. Create the payment and receipt.
    //
    // submittedForPeriodId makes this payment discoverable by the
    // admin immediately, before allocations are created.
    const payment = await prisma.payment.create({
      data: {
        membershipId: membership.id,
        userId,
        submittedForPeriodId: period.id,
        expectedAmount,
        status: "PENDING",

        receipts: {
          create: {
            uploadedById: userId,
            imageUrl: `/uploads/receipts/${req.file.filename}`,
            storageKey: `receipts/${req.file.filename}`,
            originalFileName: req.file.originalname,
            mimeType: req.file.mimetype,
            fileSize: req.file.size,
            status: "UPLOADED",
            ocrProcessed: false,
          },
        },
      },
      include: {
        receipts: {
          include: {
            ocrData: true,
          },
          orderBy: {
            uploadedAt: "desc",
          },
        },
        allocations: {
          include: {
            period: true,
          },
        },
        membership: true,
      },
    });

    return res.status(201).json({
      success: true,
      message:
        "Receipt uploaded successfully. Payment amount will be determined by OCR.",
      payment,
      receipt: payment.receipts[0] ?? null,
    });
  } catch (error) {
    console.error("Upload Receipt Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to upload receipt",
      error: error.message,
    });
  }
};



// ============================================================
// GET PAYMENT PERIOD DETAILS
// GET /api/payment-periods/:periodId
// ============================================================



export const getPaymentPeriodDetails = async (req, res) => {
  try {
    const { periodId } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    // 1. Find the payment period and Equb.
    const period = await prisma.paymentPeriod.findUnique({
      where: { id: periodId },
      include: {
        equb: {
          select: {
            id: true,
            name: true,
            contributionAmount: true,
            frequency: true,
            currency: true,
            createdById: true,
            status: true,
          },
        },
      },
    });

    if (!period) {
      return res.status(404).json({
        success: false,
        message: "Payment period not found",
      });
    }

    // 2. Authorize the administrator.
    if (
      userRole !== "SUPER_ADMIN" &&
      (
        userRole !== "ADMIN" ||
        period.equb.createdById !== userId
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to view this payment period",
      });
    }

    // 3. Get active memberships and payments associated with
    // this period.
    //
    // A payment is associated with the period when either:
    // - it was originally submitted for this period, or
    // - it has a monetary allocation for this period.
    //
    // This ensures newly uploaded receipts appear before OCR
    // or payment matching creates their allocations.
    const memberships = await prisma.equbMembership.findMany({
      where: {
        equbId: period.equbId,
        status: "ACTIVE",
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            profileImage: true,
          },
        },
        payments: {
          where: {
            OR: [
              {
                submittedForPeriodId: period.id,
              },
              {
                allocations: {
                  some: {
                    periodId: period.id,
                  },
                },
              },
            ],
          },
          include: {
            allocations: {
              where: {
                periodId: period.id,
              },
            },
            receipts: {
              include: {
                ocrData: true,
              },
              orderBy: {
                uploadedAt: "desc",
              },
            },
            verifications: {
              include: {
                reviewer: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
              orderBy: {
                verifiedAt: "desc",
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // 4. Choose the most relevant payment for this period.
    const statusPriority = {
      VERIFIED: 1,
      UNDER_REVIEW: 2,
      SUBMITTED: 3,
      PENDING: 4,
      NEEDS_REVIEW: 5,
      UNDERPAID: 6,
      OVERPAID: 7,
      DUPLICATE: 8,
      REJECTED: 9,
    };

    const members = memberships.map((membership) => {
      const sortedPayments = [...membership.payments].sort(
        (a, b) => {
          const priorityA = statusPriority[a.status] ?? 99;
          const priorityB = statusPriority[b.status] ?? 99;

          if (priorityA !== priorityB) {
            return priorityA - priorityB;
          }

          return (
            new Date(b.updatedAt).getTime() -
            new Date(a.updatedAt).getTime()
          );
        }
      );

      const payment = sortedPayments[0] || null;

      const allocation = payment?.allocations?.[0] || null;
      const receipt = payment?.receipts?.[0] || null;
      const verification = payment?.verifications?.[0] || null;

      const expectedAmount =
        Number(period.equb.contributionAmount) *
        Number(membership.shares);

      return {
        membership: {
          id: membership.id,
          shares: Number(membership.shares),
          status: membership.status,
          memberNumber: membership.memberNumber,
        },

        user: membership.user,

        expectedAmount,

        payment: payment
          ? {
              id: payment.id,
              expectedAmount: Number(payment.expectedAmount),

              // Amount allocated to this period only.
              allocatedAmount: allocation
                ? Number(allocation.amount)
                : null,

              // Full transaction amount, if known.
              paidAmount:
                payment.paidAmount !== null
                  ? Number(payment.paidAmount)
                  : null,

              // Preserve the transaction's unallocated extra amount.
              extraAmount: Number(payment.extraAmount ?? 0),

              status: payment.status,
              paymentDate: payment.paymentDate,
              referenceNumber: payment.referenceNumber,
              notes: payment.notes,
              createdAt: payment.createdAt,
              updatedAt: payment.updatedAt,
            }
          : null,

        receipt: receipt
          ? {
              id: receipt.id,
              imageUrl: receipt.imageUrl,
              storageKey: receipt.storageKey,
              originalFileName: receipt.originalFileName,
              mimeType: receipt.mimeType,
              fileSize: receipt.fileSize,
              status: receipt.status,
              ocrProcessed: receipt.ocrProcessed,
              uploadedAt: receipt.uploadedAt,
              updatedAt: receipt.updatedAt,

              ocrData: receipt.ocrData
                ? {
                    id: receipt.ocrData.id,
                    transactionReference:
                      receipt.ocrData.transactionReference,
                    senderName: receipt.ocrData.senderName,
                    senderAccount: receipt.ocrData.senderAccount,
                    receiverName: receipt.ocrData.receiverName,
                    receiverAccount: receipt.ocrData.receiverAccount,

                    amount:
                      receipt.ocrData.amount !== null
                        ? Number(receipt.ocrData.amount)
                        : null,

                    transactionDate:
                      receipt.ocrData.transactionDate,

                    bankName: receipt.ocrData.bankName,
                    rawText: receipt.ocrData.rawText,

                    confidence:
                      receipt.ocrData.confidence !== null
                        ? Number(receipt.ocrData.confidence)
                        : null,

                    processedAt: receipt.ocrData.processedAt,
                  }
                : null,
            }
          : null,

        verification: verification
          ? {
              id: verification.id,
              decision: verification.decision,
              reason: verification.reason,

              verifiedAmount:
                verification.verifiedAmount !== null
                  ? Number(verification.verifiedAmount)
                  : null,

              verifiedAt: verification.verifiedAt,
              reviewer: verification.reviewer,
            }
          : null,
      };
    });

    // 5. Calculate summaries for this period.
    const totalMembers = members.length;

    const paidMembers = members.filter(
      (member) =>
        member.payment &&
        member.payment.status !== "REJECTED"
    ).length;

    const verifiedMembers = members.filter(
      (member) => member.payment?.status === "VERIFIED"
    ).length;

    const pendingMembers = members.filter(
      (member) =>
        member.payment &&
        [
          "PENDING",
          "SUBMITTED",
          "UNDER_REVIEW",
          "NEEDS_REVIEW",
          "UNDERPAID",
          "OVERPAID",
          "DUPLICATE",
        ].includes(member.payment.status)
    ).length;

    const rejectedMembers = members.filter(
      (member) => member.payment?.status === "REJECTED"
    ).length;

    const missingMembers = members.filter(
      (member) => member.payment === null
    ).length;

    const totalExpected = members.reduce(
      (total, member) => total + member.expectedAmount,
      0
    );

    // Only count verified allocations for this period.
    // Do not count the full amount of a multi-period transaction.
    const totalPaid = members.reduce(
      (total, member) =>
        total +
        (
          member.payment?.status === "VERIFIED"
            ? Number(member.payment.allocatedAmount || 0)
            : 0
        ),
      0
    );

    // 6. Return the period, Equb, summary, and member details.
    return res.status(200).json({
      success: true,

      period: {
        id: period.id,
        periodNumber: period.periodNumber,
        startDate: period.startDate,
        dueDate: period.dueDate,
        closedAt: period.closedAt,
        status: period.status,
        expectedAmount: Number(period.expectedAmount),
      },

      equb: {
        id: period.equb.id,
        name: period.equb.name,
        contributionAmount: Number(
          period.equb.contributionAmount
        ),
        frequency: period.equb.frequency,
        currency: period.equb.currency,
        status: period.equb.status,
      },

      summary: {
        totalMembers,
        paidMembers,
        verifiedMembers,
        pendingMembers,
        rejectedMembers,
        missingMembers,
        totalExpected,
        totalPaid,
      },

      count: members.length,
      members,
    });
  } catch (error) {
    console.error("Get Payment Period Details Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment period details",
      error: error.message,
      code: error.code ?? null,
    });
  }
};




// ============================================================
// PROCESS OCR
// POST /api/receipts/:receiptId/ocr
// ============================================================




export const processOCR = async (req, res) => {
  let receiptId;

  try {
    ({ receiptId } = req.params);

    const userId = req.user.userId;
    const userRole = req.user.role;

    if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to process OCR",
      });
    }

    // 1. Load receipt, payment, membership, period and OCR data.
    const receipt = await prisma.receipt.findUnique({
      where: { id: receiptId },
      include: {
        payment: {
          include: {
            membership: true,
            submittedForPeriod: {
              include: { equb: true },
            },
            allocations: {
              include: {
                period: {
                  include: { equb: true },
                },
              },
            },
          },
        },
        ocrData: true,
      },
    });

    if (!receipt?.payment) {
      return res.status(404).json({
        success: false,
        message: receipt
          ? "Payment associated with receipt was not found"
          : "Receipt not found",
      });
    }

    const payment = receipt.payment;

    // 2. Determine the starting period.
    const startingPeriod =
      payment.submittedForPeriod ??
      payment.allocations[0]?.period ??
      null;

    if (!startingPeriod) {
      return res.status(400).json({
        success: false,
        message:
          "Payment has no submission period. Associate it with a payment period first.",
      });
    }

    if (
      userRole === "ADMIN" &&
      startingPeriod.equb.createdById !== userId
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to process this receipt",
      });
    }

  

    
    // 3. Reuse existing OCR data when available.
    // Otherwise, extract and save the receipt data.
    let ocrData = receipt.ocrData;

    if (!receipt.ocrProcessed || !ocrData) {
      if (!receipt.storageKey) {
        return res.status(400).json({
          success: false,
          message: "Receipt storage key is missing",
        });
      }

      const fileName = path.basename(receipt.storageKey);

      const imagePath = path.join(
        process.cwd(),
        "uploads",
        "receipts",
        fileName
      );

      if (!fs.existsSync(imagePath)) {
        return res.status(404).json({
          success: false,
          message: "Receipt image file does not exist",
          imagePath,
        });
      }

      await prisma.receipt.update({
        where: { id: receipt.id },
        data: { status: "PROCESSING" },
      });

      const ocrResult = await processReceiptOCR(imagePath);

      ocrData = await prisma.oCRData.upsert({
        where: { receiptId: receipt.id },
        update: {
          transactionReference: ocrResult.transactionReference,
          senderName: ocrResult.senderName,
          senderAccount: ocrResult.senderAccount,
          receiverName: ocrResult.receiverName,
          receiverAccount: ocrResult.receiverAccount,
          amount: ocrResult.amount,
          transactionDate: ocrResult.transactionDate
            ? new Date(ocrResult.transactionDate)
            : null,
          bankName: ocrResult.bankName,
          rawText: ocrResult.rawText,
          confidence: ocrResult.confidence,
          processedAt: new Date(),
        },
        create: {
          receiptId: receipt.id,
          transactionReference: ocrResult.transactionReference,
          senderName: ocrResult.senderName,
          senderAccount: ocrResult.senderAccount,
          receiverName: ocrResult.receiverName,
          receiverAccount: ocrResult.receiverAccount,
          amount: ocrResult.amount,
          transactionDate: ocrResult.transactionDate
            ? new Date(ocrResult.transactionDate)
            : null,
          bankName: ocrResult.bankName,
          rawText: ocrResult.rawText,
          confidence: ocrResult.confidence,
          processedAt: new Date(),
        },
      });
    }

    // 4. Validate the OCR amount.
    const ocrAmount = Number(ocrData.amount);

    if (
      ocrData.amount === null ||
      ocrData.amount === undefined ||
      !Number.isFinite(ocrAmount) ||
      ocrAmount <= 0
    ) {
      await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: { status: "NEEDS_REVIEW" },
        }),
        prisma.receipt.update({
          where: { id: receipt.id },
          data: {
            status: "PROCESSED",
            ocrProcessed: true,
          },
        }),
      ]);

      return res.status(200).json({
        success: true,
        message:
          "OCR completed, but no valid amount was extracted. Manual review is required.",
        ocrData,
        matching: {
          matched: false,
          needsReview: true,
        },
      });
    }

    // 5. Calculate the expected contribution per period.
    const contributionAmount = Number(
      startingPeriod.equb.contributionAmount
    );

    const shares = Number(payment.membership.shares);

    const perPeriodAmount = contributionAmount * shares;
    const perPeriodCents = Math.round(perPeriodAmount * 100);
    const ocrCents = Math.round(ocrAmount * 100);

    if (
      !Number.isFinite(perPeriodCents) ||
      perPeriodCents <= 0
    ) {
      throw new Error(
        "Unable to calculate the expected contribution per period"
      );
    }

    // Allocate complete period contributions only.
    // Example: 18,900 received / 3,000 per period = 6 periods,
    // with 900 remaining as extraAmount.
    const targetPeriodCount = Math.floor(
      ocrCents / perPeriodCents
    );

    // 6. Match periods and create allocations transactionally.
    const matching = await prisma.$transaction(async (tx) => {
      const existingAllocations =
        await tx.paymentAllocation.findMany({
          where: { paymentId: payment.id },
        });

      const existingPeriodIds = new Set(
        existingAllocations.map((item) => item.periodId)
      );

      const existingAllocatedCents = existingAllocations.reduce(
        (total, item) =>
          total + Math.round(Number(item.amount) * 100),
        0
      );

      // Do not add new allocations if existing ones already exceed
      // the OCR amount or have inconsistent amounts.
      if (
        existingAllocatedCents > ocrCents ||
        existingAllocatedCents !==
          existingAllocations.length * perPeriodCents
      ) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "NEEDS_REVIEW" },
        });

        return {
          matched: false,
          needsReview: true,
          reason:
            "Existing allocations do not match the OCR amount or expected contribution.",
          allocationsCreated: 0,
          totalAllocations: existingAllocations.length,
          allocatedAmount: existingAllocatedCents / 100,
        };
      }

      if (
        targetPeriodCount === 0 ||
        targetPeriodCount < existingAllocations.length
      ) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "NEEDS_REVIEW" },
        });

        return {
          matched: false,
          needsReview: true,
          reason:
            "The OCR amount does not cover the existing allocations or a complete period contribution.",
          allocationsCreated: 0,
          totalAllocations: existingAllocations.length,
          allocatedAmount: existingAllocatedCents / 100,
        };
      }

      const neededCount =
        targetPeriodCount - existingAllocations.length;

      if (neededCount === 0) {
        return {
          matched: true,
          needsReview: false,
          allocationsCreated: 0,
          totalAllocations: existingAllocations.length,
          allocatedAmount: existingAllocatedCents / 100,
        };
      }

      // Get periods from the submitted period onward.
      const periods = await tx.paymentPeriod.findMany({
        where: {
          equbId: startingPeriod.equbId,
          periodNumber: {
            gte: startingPeriod.periodNumber,
          },
        },
        orderBy: {
          periodNumber: "asc",
        },
        include: {
          allocations: {
            include: {
              payment: {
                select: {
                  id: true,
                  membershipId: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      // A period is unavailable if this same membership already
      // has an allocation for it on another non-rejected payment.
      const availablePeriods = periods.filter((candidate) => {
        if (existingPeriodIds.has(candidate.id)) {
          return false;
        }

        const reservedByThisMembership =
          candidate.allocations.some(
            (allocation) =>
              allocation.payment.membershipId ===
                payment.membershipId &&
              allocation.payment.id !== payment.id &&
              allocation.payment.status !== "REJECTED"
          );

        return !reservedByThisMembership;
      });

      // Never create a partial allocation plan.
    // Never create a partial allocation plan.
if (availablePeriods.length < neededCount) {
  await tx.payment.update({
    where: { id: payment.id },
    data: { status: "NEEDS_REVIEW" },
  });

  return {
    matched: false,
    needsReview: true,
    reason:
      "Not enough available payment periods to cover the OCR amount.",
    diagnostics: {
      ocrAmount: ocrCents / 100,
      contributionPerShare: contributionAmount,
      membershipShares: shares,
      perPeriodAmount,
      targetPeriodCount,
      existingAllocationCount: existingAllocations.length,
      neededCount,
      availablePeriodCount: availablePeriods.length,
      startingPeriodNumber: startingPeriod.periodNumber,
      equbId: startingPeriod.equbId,
    },
    allocationsCreated: 0,
    totalAllocations: existingAllocations.length,
    allocatedAmount: existingAllocatedCents / 100,
  };
}

      const periodsToAllocate = availablePeriods.slice(
        0,
        neededCount
      );

      await tx.paymentAllocation.createMany({
        data: periodsToAllocate.map((candidate) => ({
          paymentId: payment.id,
          periodId: candidate.id,
          amount: perPeriodAmount,
        })),
      });

      const allocatedCents =
        existingAllocatedCents +
        neededCount * perPeriodCents;

      return {
        matched: true,
        needsReview: false,
        allocationsCreated: neededCount,
        totalAllocations: existingAllocations.length + neededCount,
        allocatedAmount: allocatedCents / 100,
        extraAmount: (ocrCents - allocatedCents) / 100,
      };
    });

    // 7. Mark OCR complete after matching has been attempted.
    const updatedReceipt = await prisma.receipt.update({
      where: { id: receipt.id },
      data: {
        status: "PROCESSED",
        ocrProcessed: true,
      },
      include: {
        ocrData: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: matching.needsReview
        ? "OCR completed, but payment matching requires manual review."
        : "OCR processed and payment allocations matched successfully.",
      receipt: updatedReceipt,
      ocrData,
      period: {
        id: startingPeriod.id,
        periodNumber: startingPeriod.periodNumber,
        equbId: startingPeriod.equbId,
      },
      matching: {
        ...matching,
        perPeriodAmount,
        targetPeriodCount,
      },
    });
  } catch (error) {
    console.error("Process OCR Error:", error);

    if (receiptId) {
      try {
        const currentReceipt = await prisma.receipt.findUnique({
          where: { id: receiptId },
          select: {
            status: true,
            ocrProcessed: true,
          },
        });

        if (
          currentReceipt &&
          currentReceipt.status === "PROCESSING" &&
          !currentReceipt.ocrProcessed
        ) {
          await prisma.receipt.update({
            where: { id: receiptId },
            data: { status: "UPLOADED" },
          });
        }
      } catch (updateError) {
        console.error(
          "Failed to reset receipt status:",
          updateError
        );
      }
    }

    return res.status(500).json({
      success: false,
      message: "Failed to process receipt OCR",
      error: error.message,
    });
  }
};




// ============================================================
// APPROVE PAYMENT
// POST /api/receipts/:receiptId/approve
// ============================================================



export const approvePayment = async (req, res) => {
  try {
    const { receiptId } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    // 1. Only admins can approve payments.
    if (
      userRole !== "ADMIN" &&
      userRole !== "SUPER_ADMIN"
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to approve payments",
      });
    }

    // 2. Find receipt, payment, allocations and OCR data.
    const receipt = await prisma.receipt.findUnique({
      where: { id: receiptId },
      include: {
        payment: {
          include: {
            membership: {
              include: {
                equb: true,
              },
            },
            allocations: {
              include: {
                period: {
                  include: {
                    equb: true,
                  },
                },
              },
            },
          },
        },
        ocrData: true,
      },
    });

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: "Receipt not found",
      });
    }

    if (!receipt.payment) {
      return res.status(404).json({
        success: false,
        message: "Payment associated with receipt was not found",
      });
    }

    const payment = receipt.payment;
    const allocations = payment.allocations;

    // 3. Payment must have period allocations.
if (!allocations.length) {
  const ocrCompleted =
    receipt.ocrProcessed &&
    receipt.status === "PROCESSED" &&
    Boolean(receipt.ocrData);

  return res.status(400).json({
    success: false,
    message: ocrCompleted
      ? "This payment has no period allocations. Retry OCR matching or resolve the matching issue before approval."
      : "Receipt OCR must be completed before approval.",
    code: ocrCompleted
      ? "ALLOCATION_MATCHING_FAILED"
      : "OCR_REQUIRED",
    canRetryMatching: ocrCompleted,
    receiptId: receipt.id,
    paymentId: payment.id,
    ocrAmount: receipt.ocrData?.amount ?? null,
    paymentStatus: payment.status,
  });
}

    // 4. ADMIN can only approve payments for their own Equb.
    const unauthorizedAllocation = allocations.some(
      (allocation) =>
        allocation.period.equb.createdById !== userId
    );

    if (
      userRole === "ADMIN" &&
      unauthorizedAllocation
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to approve this payment",
      });
    }

    // 5. Prevent duplicate approval or approval after rejection.
    if (payment.status === "VERIFIED") {
      return res.status(409).json({
        success: false,
        message: "Payment is already verified",
      });
    }

    if (payment.status === "REJECTED") {
      return res.status(409).json({
        success: false,
        message: "Payment has already been rejected",
      });
    }

    if (
      receipt.status !== "PROCESSED" ||
      !receipt.ocrProcessed ||
      !receipt.ocrData
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Receipt OCR must be completed before approval",
      });
    }

    // 6. OCR must provide a valid amount.
    const verifiedAmount = Number(receipt.ocrData.amount);

    if (
      receipt.ocrData.amount === null ||
      receipt.ocrData.amount === undefined ||
      !Number.isFinite(verifiedAmount) ||
      verifiedAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "OCR did not extract a valid amount. Manual review is required.",
      });
    }

    // 7. Calculate allocated amount and extra amount in cents.
    const allocatedCents = allocations.reduce(
      (total, allocation) =>
        total + Math.round(Number(allocation.amount) * 100),
      0
    );

    const ocrCents = Math.round(verifiedAmount * 100);
    const extraCents = ocrCents - allocatedCents;

    if (extraCents < 0) {
      return res.status(400).json({
        success: false,
        message:
          "Allocated amount exceeds the OCR receipt amount. Payment requires review.",
        ocrAmount: verifiedAmount,
        allocatedAmount: allocatedCents / 100,
      });
    }

    const allocatedAmount = allocatedCents / 100;
    const extraAmount = extraCents / 100;

    // 8. All allocations must belong to the same Equb.
    const equbIds = new Set(
      allocations.map(
        (allocation) => allocation.period.equbId
      )
    );

    if (equbIds.size !== 1) {
      return res.status(400).json({
        success: false,
        message:
          "Payment allocations span multiple Equbs and cannot be approved.",
      });
    }

    // 9. Update payment, verification and receipt atomically.
    const result = await prisma.$transaction(async (tx) => {
      const currentPayment = await tx.payment.findUnique({
        where: { id: payment.id },
      });

      if (
        !currentPayment ||
        currentPayment.status === "VERIFIED" ||
        currentPayment.status === "REJECTED"
      ) {
        throw new Error(
          "Payment status changed. Refresh and try again."
        );
      }

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "VERIFIED",
          paidAmount: verifiedAmount,
          extraAmount,
          paymentDate:
            receipt.ocrData.transactionDate ||
            payment.paymentDate,
          referenceNumber:
            receipt.ocrData.transactionReference ||
            payment.referenceNumber,
        },
      });

      const verification =
        await tx.paymentVerification.create({
          data: {
            paymentId: payment.id,
            reviewerId: userId,
            decision: "VERIFIED",
            reason:
              req.body?.reason ||
              "Payment verified by administrator",
            verifiedAmount,
          },
        });

      const updatedReceipt = await tx.receipt.update({
        where: { id: receipt.id },
        data: { status: "VERIFIED" },
      });

      return {
        payment: updatedPayment,
        verification,
        receipt: updatedReceipt,
      };
    });

    // 10. Return payment totals and the saved extra amount.
    return res.status(200).json({
      success: true,
      message: "Payment approved successfully",
      payment: result.payment,
      verification: result.verification,
      receipt: result.receipt,
      summary: {
        ocrAmount: verifiedAmount,
        allocatedAmount,
        extraAmount,
        periodsCovered: allocations.length,
      },
    });
  } catch (error) {
    console.error("Approve Payment Error:", error);

    if (
      error.message ===
      "Payment status changed. Refresh and try again."
    ) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to approve payment",
      error: error.message,
    });
  }
};



// ============================================================
// REJECT PAYMENT
// POST /api/receipts/:receiptId/reject
// ============================================================


export const rejectPayment = async (req, res) => {
  try {
    const { receiptId } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;
    const { reason } = req.body;

    // 1. Require a rejection reason
    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    // 2. Only admins can reject payments
    if (
      userRole !== "ADMIN" &&
      userRole !== "SUPER_ADMIN"
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to reject payments",
      });
    }

    // 3. Find receipt, payment and all allocations
    const receipt = await prisma.receipt.findUnique({
      where: {
        id: receiptId,
      },
      include: {
        payment: {
          include: {
            allocations: {
              include: {
                period: {
                  include: {
                    equb: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: "Receipt not found",
      });
    }

    if (!receipt.payment) {
      return res.status(404).json({
        success: false,
        message: "Payment associated with receipt was not found",
      });
    }

    const payment = receipt.payment;
    const allocations = payment.allocations;

    // 4. ADMIN must own every Equb involved
    if (userRole === "ADMIN") {
      const unauthorizedAllocation = allocations.some(
        (allocation) =>
          allocation.period.equb.createdById !== userId
      );

      if (unauthorizedAllocation) {
        return res.status(403).json({
          success: false,
          message:
            "You are not authorized to reject this payment",
        });
      }
    }

    // 5. Prevent duplicate rejection or rejecting verified payment
    if (payment.status === "REJECTED") {
      return res.status(409).json({
        success: false,
        message: "Payment is already rejected",
      });
    }

    if (payment.status === "VERIFIED") {
      return res.status(409).json({
        success: false,
        message: "Verified payment cannot be rejected",
      });
    }

    // 6. Update payment, verification and receipt atomically
    const result = await prisma.$transaction(async (tx) => {
      // Recheck status to avoid rejecting a payment
      // that was verified while this request was running.
      const currentPayment = await tx.payment.findUnique({
        where: {
          id: payment.id,
        },
      });

      if (!currentPayment) {
        throw new Error("Payment not found");
      }

      if (
        currentPayment.status === "REJECTED" ||
        currentPayment.status === "VERIFIED"
      ) {
        throw new Error(
          `Payment status changed to ${currentPayment.status}`
        );
      }

      const updatedPayment = await tx.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: "REJECTED",
        },
      });

      const verification =
        await tx.paymentVerification.create({
          data: {
            paymentId: payment.id,
            reviewerId: userId,
            decision: "REJECTED",
            reason: reason.trim(),
            verifiedAmount: null,
          },
        });

      const updatedReceipt = await tx.receipt.update({
        where: {
          id: receipt.id,
        },
        data: {
          status: "REJECTED",
        },
      });

      return {
        payment: updatedPayment,
        verification,
        receipt: updatedReceipt,
      };
    });

    // 7. Return response
    return res.status(200).json({
      success: true,
      message: "Payment rejected successfully",
      payment: result.payment,
      verification: result.verification,
      receipt: result.receipt,
    });
  } catch (error) {
    console.error("Reject Payment Error:", error);

    if (
      error.message === "Payment not found" ||
      error.message.startsWith("Payment status changed to")
    ) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to reject payment",
      error: error.message,
    });
  }
};

