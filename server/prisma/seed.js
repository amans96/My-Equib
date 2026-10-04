
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const prisma = new PrismaClient();

const EQUb_ID = "2c1ba2fc-1e55-4685-aa08-ac6d22da98ec";
const PERIOD_ID = "02375f46-1ccf-47bb-9af5-3a478e0d8299";

// ============================================================
// FILE PATHS
// ============================================================

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

const seededReceiptPath = path.join(
  uploadsDirectory,
  "seed-receipt.jpg"
);

async function main() {
  console.log("🌱 Starting database seed...");

  // ============================================================
  // 1. CHECK REAL RECEIPT IMAGE
  // ============================================================

  if (!fs.existsSync(sourceReceiptPath)) {
    throw new Error(
      `Receipt image was not found at:\n${sourceReceiptPath}`
    );
  }

  console.log("✅ Test receipt image found");
  console.log(`   Source: ${sourceReceiptPath}`);

  // Create uploads directory if it does not exist
  fs.mkdirSync(uploadsDirectory, {
    recursive: true,
  });

  // Copy the real receipt image
  fs.copyFileSync(
    sourceReceiptPath,
    seededReceiptPath
  );

  console.log("✅ Test receipt copied");
  console.log(`   Destination: ${seededReceiptPath}`);

  // ============================================================
  // 2. CREATE / UPDATE ADMIN
  // ============================================================

  const adminPassword = "Admin12345";

  const adminPasswordHash = await bcrypt.hash(
    adminPassword,
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

  console.log("✅ ADMIN created/updated");
  console.log(`   ID: ${admin.id}`);
  console.log(`   Phone: ${admin.phone}`);
  console.log(`   Email: ${admin.email}`);
  console.log(`   Role: ${admin.role}`);

  // ============================================================
  // 3. FIND EXISTING EQUB
  // ============================================================

  const equb = await prisma.equb.findUnique({
    where: {
      id: EQUb_ID,
    },
  });

  if (!equb) {
    throw new Error(
      `Equb ${EQUb_ID} was not found.`
    );
  }

  console.log("✅ Existing Equb found");
  console.log(`   ID: ${equb.id}`);
  console.log(`   Name: ${equb.name}`);
  console.log(
    `   Contribution: ${equb.contributionAmount}`
  );
  console.log(`   Frequency: ${equb.frequency}`);

  // ============================================================
  // 4. FIND EXISTING PAYMENT PERIOD
  // ============================================================

  const period = await prisma.paymentPeriod.findUnique({
    where: {
      id: PERIOD_ID,
    },
  });

  if (!period) {
    throw new Error(
      `Payment period ${PERIOD_ID} was not found.`
    );
  }

  if (period.equbId !== equb.id) {
    throw new Error(
      `Payment period ${PERIOD_ID} does not belong to Equb ${EQUb_ID}.`
    );
  }

  console.log("✅ Existing Payment Period found");
  console.log(`   ID: ${period.id}`);
  console.log(`   Number: ${period.periodNumber}`);
  console.log(`   Status: ${period.status}`);

  // ============================================================
  // 5. CREATE / UPDATE MEMBER
  // ============================================================

  const memberPassword = "Member12345";

  const memberPasswordHash = await bcrypt.hash(
    memberPassword,
    12
  );

  const member = await prisma.user.upsert({
    where: {
      phone: "0911111111",
    },

    update: {
      firstName: "Abebe",
      lastName: "Kebede",
      email: "abebe@equb.local",
      passwordHash: memberPasswordHash,
      role: "MEMBER",
      isActive: true,
    },

    create: {
      firstName: "Abebe",
      lastName: "Kebede",
      email: "abebe@equb.local",
      phone: "0911111111",
      passwordHash: memberPasswordHash,
      role: "MEMBER",
      isActive: true,
    },
  });

  console.log("✅ MEMBER created/updated");
  console.log(`   ID: ${member.id}`);
  console.log(
    `   Name: ${member.firstName} ${member.lastName}`
  );
  console.log(`   Phone: ${member.phone}`);
  console.log(`   Email: ${member.email}`);

  // ============================================================
  // 6. CREATE / UPDATE MEMBERSHIP
  // ============================================================

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
      memberNumber: "EQB-001",
      missedPayments: 0,
    },

    create: {
      userId: member.id,
      equbId: equb.id,
      shares: 1,
      status: "ACTIVE",
      memberNumber: "EQB-001",
      totalPaid: 0,
      missedPayments: 0,
    },
  });

  console.log("✅ Membership created/updated");
  console.log(`   ID: ${membership.id}`);
  console.log(`   Status: ${membership.status}`);
  console.log(`   Shares: ${membership.shares}`);

  // ============================================================
  // 7. CALCULATE EXPECTED AMOUNT
  // ============================================================

  const expectedAmount =
    Number(equb.contributionAmount) *
    Number(membership.shares);

  console.log(
    `💰 Expected payment: ${expectedAmount} ${equb.currency}`
  );

  // ============================================================
  // 8. CREATE / UPDATE PAYMENT
  // ============================================================

  const payment = await prisma.payment.upsert({
    where: {
      membershipId_periodId: {
        membershipId: membership.id,
        periodId: period.id,
      },
    },

    update: {
      userId: member.id,
      expectedAmount,
      paidAmount: expectedAmount,
      status: "VERIFIED",
      paymentDate: new Date(),
      referenceNumber: "TXN-SEED-20261001-001",
      notes: "Seeded test payment using real receipt image.",
    },

    create: {
      membershipId: membership.id,
      periodId: period.id,
      userId: member.id,

      expectedAmount,
      paidAmount: expectedAmount,

      status: "VERIFIED",

      paymentDate: new Date(),
      referenceNumber: "TXN-SEED-20261001-001",

      notes:
        "Seeded test payment using real receipt image.",
    },
  });

  console.log("✅ Payment created/updated");
  console.log(`   ID: ${payment.id}`);
  console.log(`   Expected: ${payment.expectedAmount}`);
  console.log(`   Paid: ${payment.paidAmount}`);
  console.log(`   Status: ${payment.status}`);

  // ============================================================
  // 9. GET REAL IMAGE INFORMATION
  // ============================================================

  const imageStats = fs.statSync(seededReceiptPath);

  console.log("📷 Receipt image information");
  console.log(`   Size: ${imageStats.size} bytes`);

  // ============================================================
  // 10. CREATE / UPDATE RECEIPT
  // ============================================================

  let receipt = await prisma.receipt.findFirst({
    where: {
      paymentId: payment.id,
    },
  });

  if (receipt) {
    receipt = await prisma.receipt.update({
      where: {
        id: receipt.id,
      },

      data: {
        uploadedById: member.id,

        imageUrl:
          "/uploads/receipts/seed-receipt.jpg",

        storageKey:
          "receipts/seed-receipt.jpg",

        originalFileName:
          "test-receipt.jpg",

        mimeType: "image/jpeg",

        fileSize: imageStats.size,

        status: "UPLOADED",

        ocrProcessed: false,
      },
    });
  } else {
    receipt = await prisma.receipt.create({
      data: {
        paymentId: payment.id,
        uploadedById: member.id,

        imageUrl:
          "/uploads/receipts/seed-receipt.jpg",

        storageKey:
          "receipts/seed-receipt.jpg",

        originalFileName:
          "test-receipt.jpg",

        mimeType: "image/jpeg",

        fileSize: imageStats.size,

        status: "UPLOADED",

        ocrProcessed: false,
      },
    });
  }

  console.log("✅ REAL receipt record created/updated");
  console.log(`   Receipt ID: ${receipt.id}`);
  console.log(`   File: ${receipt.originalFileName}`);
  console.log(`   Size: ${receipt.fileSize} bytes`);
  console.log(`   Status: ${receipt.status}`);
  console.log(`   OCR processed: ${receipt.ocrProcessed}`);

  // ============================================================
  // 11. REMOVE OLD SEEDED OCR DATA
  //
  // We intentionally DO NOT create OCRData here.
  //
  // This is important:
  //
  // REAL IMAGE
  //      ↓
  // OCR SERVICE
  //      ↓
  // OCRData
  //
  // That way we can actually test whether the OCR works.
  // ============================================================

  await prisma.oCRData.deleteMany({
    where: {
      receiptId: receipt.id,
    },
  });

  console.log("🧹 Existing OCR data removed");

  // ============================================================
  // 12. RESET PAYMENT VERIFICATION FOR OCR TEST
  // ============================================================

  await prisma.paymentVerification.deleteMany({
    where: {
      paymentId: payment.id,
    },
  });

await prisma.payment.update({
  where: {
    id: payment.id,
  },

  data: {
    status: "PENDING",
    paidAmount: null,
    paymentDate: null,
    referenceNumber: null,
    notes: "Seeded receipt awaiting OCR processing.",
  },
});

  console.log("🔄 Payment reset to PENDING for OCR test");

  // ============================================================
  // 13. UPDATE MEMBERSHIP TOTAL PAID
  // ============================================================

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
    (total, item) => {
      return total + Number(item.paidAmount || 0);
    },
    0
  );

  await prisma.equbMembership.update({
    where: {
      id: membership.id,
    },

    data: {
      totalPaid,
    },
  });

  console.log(
    `✅ Membership totalPaid updated: ${totalPaid}`
  );

  // ============================================================
  // FINAL SUMMARY
  // ============================================================

  console.log("");
  console.log("==============================================");
  console.log("🎉 DATABASE SEED COMPLETED");
  console.log("==============================================");

  console.log("");
  console.log("ADMIN");
  console.log("  Phone:    0900000000");
  console.log(`  Password: ${adminPassword}`);

  console.log("");
  console.log("MEMBER");
  console.log("  Phone:    0911111111");
  console.log("  Email:    abebe@equb.local");
  console.log(`  Password: ${memberPassword}`);

  console.log("");
  console.log("EQUB");
  console.log(`  ID:   ${equb.id}`);
  console.log(`  Name: ${equb.name}`);

  console.log("");
  console.log("PAYMENT PERIOD");
  console.log(`  ID:     ${period.id}`);
  console.log(`  Number: ${period.periodNumber}`);

  console.log("");
  console.log("PAYMENT");
  console.log(`  ID:     ${payment.id}`);
  console.log(`  Status: ${payment.status}`);

  console.log("");
  console.log("REAL RECEIPT");
  console.log(`  ID:       ${receipt.id}`);
  console.log(`  File:     ${receipt.originalFileName}`);
  console.log(`  Size:     ${receipt.fileSize} bytes`);
  console.log(`  Location: ${seededReceiptPath}`);

  console.log("");
  console.log("OCR");
  console.log("  Status: NOT PROCESSED YET");
  console.log("  Next step: Send the real image to the OCR service");

  console.log("");
  console.log("==============================================");
}

main()
  .catch((error) => {
    console.error("❌ Database seed failed:");
    console.error(error);

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

