
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const prisma = new PrismaClient();

const EQUB_ID = "30d2c20b-ee33-4aca-903e-765997fd4f7a";
const PERIOD_ID = "28924b0d-a8fc-4d0d-9820-b28d8ce9f03b";

const MEMBER_COUNT = 100;
const MEMBER_PASSWORD = "Member12345";
const ADMIN_PASSWORD = "Admin12345";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceReceiptPath = path.resolve(
  __dirname,
  "../test-receipt.jpg"
);

const uploadsDirectory = path.resolve(
  __dirname,
  "../uploads/receipts"
);

// ============================================================
// HELPERS
// ============================================================

const padNumber = (number, length = 3) =>
  String(number).padStart(length, "0");

const getMemberPhone = (index) =>
  `091111${String(110 + index).padStart(4, "0")}`;

const getMemberEmail = (index) =>
  `member${padNumber(index)}@equb.local`;

const getMemberFirstName = (index) =>
  `Member${padNumber(index)}`;

const getMemberLastName = (index) =>
  `User${padNumber(index)}`;

const getMemberNumber = (index) =>
  `EQB-${padNumber(index)}`;

const getReceiptFileName = (index) =>
  `seed-receipt-${padNumber(index)}.jpg`;

const getTransactionReference = (index) =>
  `TXN-SEED-20261004-${padNumber(index)}`;

// ============================================================
// MAIN SEED
// ============================================================

async function main() {
  console.log("Starting 100-member Equb seed...\n");

  // 1. Validate the source receipt image.
  if (!fs.existsSync(sourceReceiptPath)) {
    throw new Error(
      `Receipt image not found: ${sourceReceiptPath}`
    );
  }

  fs.mkdirSync(uploadsDirectory, { recursive: true });

  console.log("Source receipt image found.");

  // 2. Create or update the admin.
  const adminPasswordHash = await bcrypt.hash(
    ADMIN_PASSWORD,
    12
  );

  const admin = await prisma.user.upsert({
    where: {
      phone: "0900000000",
    },
    update: {
      role: "ADMIN",
      isActive: true,
      passwordHash: adminPasswordHash,
    },
    create: {
      firstName: "System",
      lastName: "Administrator",
      email: "admin@equb.local",
      phone: "0900000000",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log(`Admin ready: ${admin.phone}`);

  // 3. Find the existing Equb.
  const equb = await prisma.equb.findUnique({
    where: { id: EQUB_ID },
  });

  if (!equb) {
    throw new Error(`Equb ${EQUB_ID} was not found.`);
  }

  // 4. Find and validate the payment period.
  const period = await prisma.paymentPeriod.findUnique({
    where: { id: PERIOD_ID },
  });

  if (!period) {
    throw new Error(
      `Payment period ${PERIOD_ID} was not found.`
    );
  }

  if (period.equbId !== equb.id) {
    throw new Error(
      "The specified payment period does not belong to the specified Equb."
    );
  }

  console.log(`Equb: ${equb.name}`);
  console.log(`Payment period: ${period.periodNumber}`);

  // 5. Hash the member password once.
  const memberPasswordHash = await bcrypt.hash(
    MEMBER_PASSWORD,
    12
  );

  let processedMembers = 0;

  // ==========================================================
  // 6. CREATE MEMBERS, PAYMENTS, ALLOCATIONS AND RECEIPTS
  // ==========================================================

  for (let index = 1; index <= MEMBER_COUNT; index++) {
    const firstName = getMemberFirstName(index);
    const lastName = getMemberLastName(index);
    const phone = getMemberPhone(index);
    const email = getMemberEmail(index);
    const memberNumber = getMemberNumber(index);

    console.log(
      `\n[${index}/${MEMBER_COUNT}] Processing ${phone}...`
    );

    // --------------------------------------------------------
    // USER
    // --------------------------------------------------------

    const member = await prisma.user.upsert({
      where: { phone },
      update: {
        firstName,
        lastName,
        email,
        passwordHash: memberPasswordHash,
        role: "MEMBER",
        isActive: true,
      },
      create: {
        firstName,
        lastName,
        email,
        phone,
        passwordHash: memberPasswordHash,
        role: "MEMBER",
        isActive: true,
      },
    });

    // --------------------------------------------------------
    // MEMBERSHIP
    // --------------------------------------------------------

    const membership = await prisma.equbMembership.upsert({
      where: {
        userId_equbId: {
          userId: member.id,
          equbId: equb.id,
        },
      },
      update: {
        status: "ACTIVE",
        shares: 1,
        memberNumber,
        missedPayments: 0,
      },
      create: {
        userId: member.id,
        equbId: equb.id,
        shares: 1,
        status: "ACTIVE",
        memberNumber,
        totalPaid: 0,
        missedPayments: 0,
      },
    });

    const expectedAmount =
      Number(equb.contributionAmount) *
      Number(membership.shares);

    // --------------------------------------------------------
    // RECEIPT FILE
    // --------------------------------------------------------

    const receiptFileName = getReceiptFileName(index);

    const seededReceiptPath = path.join(
      uploadsDirectory,
      receiptFileName
    );

    fs.copyFileSync(sourceReceiptPath, seededReceiptPath);

    const imageStats = fs.statSync(seededReceiptPath);

    // --------------------------------------------------------
    // PAYMENT
    //
    // Payment has no periodId. Find an existing payment
    // already allocated to this period, or create a new one.
    // --------------------------------------------------------

    let payment = await prisma.payment.findFirst({
      where: {
        membershipId: membership.id,
        allocations: {
          some: {
            periodId: period.id,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const paymentData = {
      userId: member.id,
      expectedAmount,
      paidAmount: null,
      status: "PENDING",
      paymentDate: null,
      referenceNumber: null,
      notes: "Seeded receipt awaiting OCR processing.",
    };

    if (payment) {
      payment = await prisma.payment.update({
        where: { id: payment.id },
        data: paymentData,
      });
    } else {
      payment = await prisma.payment.create({
        data: {
          membershipId: membership.id,
          ...paymentData,
        },
      });
    }

    // --------------------------------------------------------
    // PAYMENT ALLOCATION
    //
    // This connects the payment to the selected period.
    // The unique key is paymentId_periodId.
    // --------------------------------------------------------

    await prisma.paymentAllocation.upsert({
      where: {
        paymentId_periodId: {
          paymentId: payment.id,
          periodId: period.id,
        },
      },
      update: {
        amount: expectedAmount,
      },
      create: {
        paymentId: payment.id,
        periodId: period.id,
        amount: expectedAmount,
      },
    });

    // --------------------------------------------------------
    // RECEIPT
    // --------------------------------------------------------

    const receiptData = {
      uploadedById: member.id,
      imageUrl: `/uploads/receipts/${receiptFileName}`,
      storageKey: `receipts/${receiptFileName}`,
      originalFileName: "test-receipt.jpg",
      mimeType: "image/jpeg",
      fileSize: imageStats.size,
      status: "UPLOADED",
      ocrProcessed: false,
    };

    let receipt = await prisma.receipt.findFirst({
      where: {
        paymentId: payment.id,
      },
    });

    if (receipt) {
      receipt = await prisma.receipt.update({
        where: { id: receipt.id },
        data: receiptData,
      });
    } else {
      receipt = await prisma.receipt.create({
        data: {
          paymentId: payment.id,
          ...receiptData,
        },
      });
    }

    // --------------------------------------------------------
    // RESET OLD OCR DATA AND VERIFICATIONS
    //
    // These records belong to this seeded receipt/payment.
    // --------------------------------------------------------

    await prisma.oCRData.deleteMany({
      where: {
        receiptId: receipt.id,
      },
    });

    await prisma.paymentVerification.deleteMany({
      where: {
        paymentId: payment.id,
      },
    });

    // Ensure the seeded payment remains pending.
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "PENDING",
        paidAmount: null,
        paymentDate: null,
        referenceNumber: null,
        notes: "Seeded receipt awaiting OCR processing.",
      },
    });

    // --------------------------------------------------------
    // MEMBERSHIP TOTAL PAID
    // --------------------------------------------------------

    const verifiedPayments = await prisma.payment.findMany({
      where: {
        membershipId: membership.id,
        status: "VERIFIED",
      },
      select: {
        paidAmount: true,
      },
    });

    const totalPaid = verifiedPayments.reduce(
      (total, item) =>
        total + Number(item.paidAmount || 0),
      0
    );

    await prisma.equbMembership.update({
      where: { id: membership.id },
      data: { totalPaid },
    });

    processedMembers++;

    console.log(
      `User: ${firstName} ${lastName} | ` +
      `Membership: ${memberNumber} | ` +
      `Payment: ${payment.status} | ` +
      `Receipt: ${receiptFileName}`
    );
  }

  // ==========================================================
  // 7. FINAL COUNTS
  // ==========================================================

  const membershipCount = await prisma.equbMembership.count({
    where: {
      equbId: equb.id,
    },
  });

  // Count payments allocated to this period.
  const periodPaymentCount = await prisma.payment.count({
    where: {
      allocations: {
        some: {
          periodId: period.id,
        },
      },
    },
  });

  // Count receipts whose payments are allocated to this period.
  const receiptCount = await prisma.receipt.count({
    where: {
      payment: {
        allocations: {
          some: {
            periodId: period.id,
          },
        },
      },
    },
  });

  // ==========================================================
  // 8. SUMMARY
  // ==========================================================

  console.log("\n============================================");
  console.log("100-MEMBER EQUb SEED COMPLETED");
  console.log("============================================");

  console.log("\nADMIN");
  console.log("Phone:    0900000000");
  console.log(`Password: ${ADMIN_PASSWORD}`);

  console.log("\nMEMBERS");
  console.log(`Processed: ${processedMembers}`);
  console.log(`Equb memberships: ${membershipCount}`);
  console.log(`Password: ${MEMBER_PASSWORD}`);
  console.log(`First phone: ${getMemberPhone(1)}`);
  console.log(`Last phone:  ${getMemberPhone(MEMBER_COUNT)}`);
  console.log("Member numbers: EQB-001 through EQB-100");

  console.log("\nPAYMENT PERIOD");
  console.log(`ID: ${period.id}`);
  console.log(`Period number: ${period.periodNumber}`);
  console.log(`Allocated payments: ${periodPaymentCount}`);

  console.log("\nRECEIPTS");
  console.log(`Receipts: ${receiptCount}`);
  console.log("OCR status: Not processed by this seed");

  console.log("\n============================================");
}

// ============================================================
// RUN
// ============================================================

main()
  .catch((error) => {
    console.error("\nDatabase seed failed:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
