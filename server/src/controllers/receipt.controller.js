
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

    // --------------------------------------------------
    // 1. Make sure a file was uploaded
    // --------------------------------------------------

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Receipt image is required",
      });
    }

    // --------------------------------------------------
    // 2. Find the payment period
    // --------------------------------------------------

    const period = await prisma.paymentPeriod.findUnique({
      where: {
        id: periodId,
      },
      include: {
        equb: true,
      },
    });

    if (!period) {
      return res.status(404).json({
        success: false,
        message: "Payment period not found",
      });
    }

    // --------------------------------------------------
    // 3. Find the user's membership in this Equb
    // --------------------------------------------------

    const membership = await prisma.equbMembership.findUnique({
      where: {
        userId_equbId: {
          userId,
          equbId: period.equbId,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this Equb",
      });
    }

    // --------------------------------------------------
    // 4. Membership must be ACTIVE
    // --------------------------------------------------

    if (membership.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Your Equb membership is not active",
      });
    }

    // --------------------------------------------------
    // 5. Check whether this period already has a payment
    //
    // Payment no longer contains periodId.
    // We find the payment through PaymentAllocation.
    // --------------------------------------------------

    const existingPayment = await prisma.payment.findFirst({
      where: {
        membershipId: membership.id,

        allocations: {
          some: {
            periodId: period.id,
          },
        },
      },

      include: {
        receipts: true,

        allocations: {
          include: {
            period: true,
          },
        },
      },
    });

    if (existingPayment) {
      return res.status(409).json({
        success: false,
        message: "A payment already exists for this period",
        payment: existingPayment,
      });
    }

    // --------------------------------------------------
    // 6. Calculate expected amount
    //
    // contributionAmount × shares
    // --------------------------------------------------

    const expectedAmount =
      Number(period.equb.contributionAmount) *
      Number(membership.shares);

    // --------------------------------------------------
    // 7. Create Payment + PaymentAllocation + Receipt
    // --------------------------------------------------

    const payment = await prisma.payment.create({
      data: {
        membershipId: membership.id,
        userId,

        expectedAmount,

        status: "PENDING",

        // The payment belongs to this period through
        // PaymentAllocation.
        allocations: {
          create: {
            periodId: period.id,
            amount: expectedAmount,
          },
        },

        receipts: {
          create: {
            uploadedById: userId,

            imageUrl: `/uploads/receipts/${req.file.filename}`,
            storageKey: `receipts/${req.file.filename}`,

            originalFileName: req.file.originalname,
            mimeType: req.file.mimetype,
            fileSize: req.file.size,

            status: "UPLOADED",
          },
        },
      },

      include: {
        receipts: true,

        allocations: {
          include: {
            period: true,
          },
        },

        membership: true,
      },
    });

    // --------------------------------------------------
    // 8. Return response
    // --------------------------------------------------

    return res.status(201).json({
      success: true,
      message: "Receipt uploaded successfully",
      payment,
    });
  } catch (error) {
    console.error("Upload receipt error:", error);

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

    // --------------------------------------------------
    // 1. Find the payment period
    // --------------------------------------------------

    const period = await prisma.paymentPeriod.findUnique({
      where: {
        id: periodId,
      },

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

    // --------------------------------------------------
    // 2. Check admin authorization
    // --------------------------------------------------

    if (
      userRole !== "SUPER_ADMIN" &&
      period.equb.createdById !== userId
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this payment period",
      });
    }

    // --------------------------------------------------
    // 3. Get all active members of the Equb
    //
    // Payments are now found through PaymentAllocation.
    // --------------------------------------------------

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
            allocations: {
              some: {
                periodId,
              },
            },
          },

          include: {
            allocations: {
              where: {
                periodId,
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

    // --------------------------------------------------
    // 4. Format members and payment information
    // --------------------------------------------------

    const members = memberships.map((membership) => {
      const payment = membership.payments[0] || null;

      const allocation = payment?.allocations?.[0] || null;

      const receipt = payment?.receipts?.[0] || null;

      const verification =
        payment?.verifications?.[0] || null;

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

              expectedAmount: Number(
                payment.expectedAmount
              ),

              // Amount allocated specifically to this period.
              allocatedAmount: allocation
                ? Number(allocation.amount)
                : null,

              // Total amount of the bank transaction.
              paidAmount:
                payment.paidAmount !== null
                  ? Number(payment.paidAmount)
                  : null,

              status: payment.status,

              paymentDate: payment.paymentDate,

              referenceNumber:
                payment.referenceNumber,

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

              originalFileName:
                receipt.originalFileName,

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

                    senderName:
                      receipt.ocrData.senderName,

                    senderAccount:
                      receipt.ocrData.senderAccount,

                    receiverName:
                      receipt.ocrData.receiverName,

                    receiverAccount:
                      receipt.ocrData.receiverAccount,

                    amount:
                      receipt.ocrData.amount !== null
                        ? Number(
                            receipt.ocrData.amount
                          )
                        : null,

                    transactionDate:
                      receipt.ocrData.transactionDate,

                    bankName:
                      receipt.ocrData.bankName,

                    rawText:
                      receipt.ocrData.rawText,

                    confidence:
                      receipt.ocrData.confidence !== null
                        ? Number(
                            receipt.ocrData.confidence
                          )
                        : null,

                    processedAt:
                      receipt.ocrData.processedAt,
                  }
                : null,
            }
          : null,

        verification: verification
          ? {
              id: verification.id,

              decision:
                verification.decision,

              reason:
                verification.reason,

              verifiedAmount:
                verification.verifiedAmount !== null
                  ? Number(
                      verification.verifiedAmount
                    )
                  : null,

              verifiedAt:
                verification.verifiedAt,

              reviewer:
                verification.reviewer,
            }
          : null,
      };
    });

    // --------------------------------------------------
    // 5. Calculate summary
    // --------------------------------------------------

    const totalMembers = members.length;

    const paidMembers = members.filter(
      (member) => member.payment !== null
    ).length;

    const verifiedMembers = members.filter(
      (member) =>
        member.payment?.status === "VERIFIED"
    ).length;

    const pendingMembers = members.filter(
      (member) =>
        member.payment &&
        [
          "PENDING",
          "SUBMITTED",
          "UNDER_REVIEW",
          "NEEDS_REVIEW",
        ].includes(member.payment.status)
    ).length;

    const rejectedMembers = members.filter(
      (member) =>
        member.payment?.status === "REJECTED"
    ).length;

    const missingMembers = members.filter(
      (member) => member.payment === null
    ).length;

    const totalExpected = members.reduce(
      (total, member) =>
        total + member.expectedAmount,
      0
    );

    const totalPaid = members.reduce(
      (total, member) =>
        total +
        Number(member.payment?.paidAmount || 0),
      0
    );

    // --------------------------------------------------
    // 6. Return response
    // --------------------------------------------------

    return res.status(200).json({
      success: true,

      period: {
        id: period.id,

        periodNumber:
          period.periodNumber,

        startDate:
          period.startDate,

        dueDate:
          period.dueDate,

        closedAt:
          period.closedAt,

        status:
          period.status,

        expectedAmount:
          Number(period.expectedAmount),
      },

      equb: {
        id: period.equb.id,

        name:
          period.equb.name,

        contributionAmount:
          Number(
            period.equb.contributionAmount
          ),

        frequency:
          period.equb.frequency,

        currency:
          period.equb.currency,

        status:
          period.equb.status,
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
    console.error(
      "Get Payment Period Details Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch payment period details",
      error: error.message,
    });
  }
};

// ============================================================
// PROCESS OCR
// POST /api/receipts/:receiptId/ocr
// ============================================================

export const processOCR = async (req, res) => {
  try {
    const { receiptId } = req.params;

    const userId = req.user.userId;
    const userRole = req.user.role;

    // --------------------------------------------------
    // 1. Find receipt + payment + allocations
    // --------------------------------------------------

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

    // --------------------------------------------------
    // 2. Only ADMIN / SUPER_ADMIN can process OCR
    // --------------------------------------------------

    if (
      userRole !== "ADMIN" &&
      userRole !== "SUPER_ADMIN"
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to process OCR",
      });
    }

    // --------------------------------------------------
    // 3. Make sure payment has an allocation
    // --------------------------------------------------

    const allocation =
      receipt.payment.allocations[0];

    if (!allocation) {
      return res.status(400).json({
        success: false,
        message:
          "Payment is not associated with a payment period",
      });
    }

    // --------------------------------------------------
    // 4. ADMIN can only manage their own Equb
    // --------------------------------------------------

    if (
      userRole === "ADMIN" &&
      allocation.period.equb.createdById !== userId
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to process this receipt",
      });
    }

    // --------------------------------------------------
    // 5. Make sure receipt has not already been processed
    // --------------------------------------------------

    if (
      receipt.ocrProcessed &&
      receipt.ocrData
    ) {
      return res.status(409).json({
        success: false,
        message:
          "OCR has already been processed for this receipt",
        ocrData: receipt.ocrData,
      });
    }

    // --------------------------------------------------
    // 6. Build local image path
    // --------------------------------------------------

    const fileName =
      path.basename(receipt.storageKey);

    const imagePath = path.join(
      process.cwd(),
      "uploads",
      "receipts",
      fileName
    );

    console.log(
      "OCR storageKey:",
      receipt.storageKey
    );

    console.log(
      "OCR fileName:",
      fileName
    );

    console.log(
      "OCR imagePath:",
      imagePath
    );

    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({
        success: false,
        message:
          "Receipt image file does not exist",
        imagePath,
        storageKey:
          receipt.storageKey,
      });
    }

    // --------------------------------------------------
    // 7. Mark receipt as PROCESSING
    // --------------------------------------------------

    await prisma.receipt.update({
      where: {
        id: receipt.id,
      },

      data: {
        status: "PROCESSING",
      },
    });

    // --------------------------------------------------
    // 8. Run OCR
    // --------------------------------------------------

    const ocrResult =
      await processReceiptOCR(imagePath);

    // --------------------------------------------------
    // 9. Save OCR result
    // --------------------------------------------------

    const ocrData =
      await prisma.oCRData.upsert({
        where: {
          receiptId: receipt.id,
        },

        update: {
          transactionReference:
            ocrResult.transactionReference,

          senderName:
            ocrResult.senderName,

          senderAccount:
            ocrResult.senderAccount,

          receiverName:
            ocrResult.receiverName,

          receiverAccount:
            ocrResult.receiverAccount,

          amount:
            ocrResult.amount,

          transactionDate:
            ocrResult.transactionDate
              ? new Date(
                  ocrResult.transactionDate
                )
              : null,

          bankName:
            ocrResult.bankName,

          rawText:
            ocrResult.rawText,

          confidence:
            ocrResult.confidence,

          processedAt:
            new Date(),
        },

        create: {
          receiptId:
            receipt.id,

          transactionReference:
            ocrResult.transactionReference,

          senderName:
            ocrResult.senderName,

          senderAccount:
            ocrResult.senderAccount,

          receiverName:
            ocrResult.receiverName,

          receiverAccount:
            ocrResult.receiverAccount,

          amount:
            ocrResult.amount,

          transactionDate:
            ocrResult.transactionDate
              ? new Date(
                  ocrResult.transactionDate
                )
              : null,

          bankName:
            ocrResult.bankName,

          rawText:
            ocrResult.rawText,

          confidence:
            ocrResult.confidence,

          processedAt:
            new Date(),
        },
      });

    // --------------------------------------------------
    // 10. Update receipt
    // --------------------------------------------------

    const updatedReceipt =
      await prisma.receipt.update({
        where: {
          id: receipt.id,
        },

        data: {
          status: "PROCESSED",
          ocrProcessed: true,
        },

        include: {
          ocrData: true,
        },
      });

    // --------------------------------------------------
    // 11. Return OCR result
    // --------------------------------------------------

    return res.status(200).json({
      success: true,

      message:
        "Receipt OCR processed successfully",

      receipt:
        updatedReceipt,

      ocrData,
    });
  } catch (error) {
    console.error(
      "Process OCR Error:",
      error
    );

    // Try to reset receipt status
    // if OCR processing failed.

    try {
      if (req.params.receiptId) {
        await prisma.receipt.update({
          where: {
            id: req.params.receiptId,
          },

          data: {
            status: "UPLOADED",
          },
        });
      }
    } catch (updateError) {
      console.error(
        "Failed to reset receipt status:",
        updateError
      );
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to process receipt OCR",
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

    // --------------------------------------------------
    // 1. Only admins can approve
    // --------------------------------------------------

    if (
      userRole !== "ADMIN" &&
      userRole !== "SUPER_ADMIN"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to approve payments",
      });
    }

    // --------------------------------------------------
    // 2. Find receipt + payment + allocations
    // --------------------------------------------------

    const receipt =
      await prisma.receipt.findUnique({
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
        message:
          "Payment associated with receipt was not found",
      });
    }

    const payment =
      receipt.payment;

    // --------------------------------------------------
    // 3. Make sure payment has an allocation
    // --------------------------------------------------

    const allocation =
      payment.allocations[0];

    if (!allocation) {
      return res.status(400).json({
        success: false,
        message:
          "Payment is not associated with a payment period",
      });
    }

    // --------------------------------------------------
    // 4. ADMIN can only approve their own Equb
    // --------------------------------------------------

    if (
      userRole === "ADMIN" &&
      allocation.period.equb.createdById !== userId
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to approve this payment",
      });
    }

    // --------------------------------------------------
    // 5. Prevent approving rejected/already verified payment
    // --------------------------------------------------

    if (payment.status === "VERIFIED") {
      return res.status(409).json({
        success: false,
        message:
          "Payment is already verified",
      });
    }

    if (payment.status === "REJECTED") {
      return res.status(409).json({
        success: false,
        message:
          "Payment has already been rejected",
      });
    }

    // --------------------------------------------------
    // 6. Determine verified amount
    //
    // OCR amount is preferred.
    // If OCR did not find an amount,
    // use the allocated amount.
    // --------------------------------------------------

    const verifiedAmount =
      receipt.ocrData?.amount !== null &&
      receipt.ocrData?.amount !== undefined
        ? receipt.ocrData.amount
        : allocation.amount;

    // --------------------------------------------------
    // 7. Update payment + verification + receipt
    // --------------------------------------------------

    const result =
      await prisma.$transaction(
        async (tx) => {
          const updatedPayment =
            await tx.payment.update({
              where: {
                id: payment.id,
              },

              data: {
                status: "VERIFIED",

                paidAmount:
                  verifiedAmount,

                paymentDate:
                  receipt.ocrData
                    ?.transactionDate ||
                  payment.paymentDate,

                referenceNumber:
                  receipt.ocrData
                    ?.transactionReference ||
                  payment.referenceNumber,
              },
            });

          const verification =
            await tx.paymentVerification.create({
              data: {
                paymentId:
                  payment.id,

                reviewerId:
                  userId,

                decision:
                  "VERIFIED",

                reason:
                  req.body?.reason ||
                  "Payment verified by administrator",

                verifiedAmount,
              },
            });

          await tx.receipt.update({
            where: {
              id: receipt.id,
            },

            data: {
              status: "VERIFIED",
            },
          });

          return {
            payment:
              updatedPayment,

            verification,
          };
        }
      );

    // --------------------------------------------------
    // 8. Return response
    // --------------------------------------------------

    return res.status(200).json({
      success: true,

      message:
        "Payment approved successfully",

      payment:
        result.payment,

      verification:
        result.verification,
    });
  } catch (error) {
    console.error(
      "Approve payment error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to approve payment",
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

    // --------------------------------------------------
    // 1. Rejection reason required
    // --------------------------------------------------

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message:
          "Rejection reason is required",
      });
    }

    // --------------------------------------------------
    // 2. Only admins can reject
    // --------------------------------------------------

    if (
      userRole !== "ADMIN" &&
      userRole !== "SUPER_ADMIN"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to reject payments",
      });
    }

    // --------------------------------------------------
    // 3. Find receipt + payment + allocations
    // --------------------------------------------------

    const receipt =
      await prisma.receipt.findUnique({
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
        message:
          "Payment associated with receipt was not found",
      });
    }

    const payment =
      receipt.payment;

    // --------------------------------------------------
    // 4. Make sure payment has an allocation
    // --------------------------------------------------

    const allocation =
      payment.allocations[0];

    if (!allocation) {
      return res.status(400).json({
        success: false,
        message:
          "Payment is not associated with a payment period",
      });
    }

    // --------------------------------------------------
    // 5. ADMIN can only reject their own Equb
    // --------------------------------------------------

    if (
      userRole === "ADMIN" &&
      allocation.period.equb.createdById !== userId
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to reject this payment",
      });
    }

    // --------------------------------------------------
    // 6. Prevent duplicate rejection
    // --------------------------------------------------

    if (payment.status === "REJECTED") {
      return res.status(409).json({
        success: false,
        message:
          "Payment is already rejected",
      });
    }

    if (payment.status === "VERIFIED") {
      return res.status(409).json({
        success: false,
        message:
          "Verified payment cannot be rejected",
      });
    }

    // --------------------------------------------------
    // 7. Update payment + verification + receipt
    // --------------------------------------------------

    const result =
      await prisma.$transaction(
        async (tx) => {
          const updatedPayment =
            await tx.payment.update({
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
                paymentId:
                  payment.id,

                reviewerId:
                  userId,

                decision:
                  "REJECTED",

                reason:
                  reason.trim(),

                verifiedAmount:
                  null,
              },
            });

          const updatedReceipt =
            await tx.receipt.update({
              where: {
                id: receipt.id,
              },

              data: {
                status: "REJECTED",
              },
            });

          return {
            payment:
              updatedPayment,

            verification,

            receipt:
              updatedReceipt,
          };
        }
      );

    // --------------------------------------------------
    // 8. Return response
    // --------------------------------------------------

    return res.status(200).json({
      success: true,

      message:
        "Payment rejected successfully",

      payment:
        result.payment,

      verification:
        result.verification,

      receipt:
        result.receipt,
    });
  } catch (error) {
    console.error(
      "Reject payment error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to reject payment",
      error: error.message,
    });
  }
};
