
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const prisma = new PrismaClient();

const EQUb_ID = "2c1ba2fc-1e55-4685-aa08-ac6d22da98ec";
const PERIOD_ID = "02494677-99cd-4b4a-b5be-fd913974c3cc";

// ============================================================
// CONFIGURATION
// ============================================================

const MEMBER_COUNT = 100;

const MEMBER_PASSWORD = "Member12345";

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

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const padNumber = (number, length = 3) => {
  return String(number).padStart(length, "0");
};

const getMemberPhone = (index) => {
  // 0911111111
  // 0911111112
  // ...
  // 0911111210

  return `091111${String(110 + index).padStart(4, "0")}`;
};

const getMemberEmail = (index) => {
  return `member${padNumber(index)}@equb.local`;
};

const getMemberFirstName = (index) => {
  return `Member${padNumber(index)}`;
};

const getMemberLastName = (index) => {
  return `User${padNumber(index)}`;
};

const getMemberNumber = (index) => {
  return `EQB-${padNumber(index)}`;
};

const getReceiptFileName = (index) => {
  return `seed-receipt-${padNumber(index)}.jpg`;
};

const getTransactionReference = (index) => {
  return `TXN-SEED-20261004-${padNumber(index)}`;
};

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log("🌱 Starting 100-member Equb database seed...");
  console.log("");

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
  console.log("");

  // Create uploads directory if it does not exist
  fs.mkdirSync(uploadsDirectory, {
    recursive: true,
  });

  // Get source image information
  const sourceImageStats = fs.statSync(sourceReceiptPath);

  console.log("📷 Source receipt information");
  console.log(`   Size: ${sourceImageStats.size} bytes`);
  console.log("");

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
  console.log("");

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
  console.log(`   Currency: ${equb.currency}`);
  console.log("");

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
  console.log("");

  // ============================================================
  // 5. HASH MEMBER PASSWORD ONCE
  // ============================================================

  console.log("🔐 Hashing member password...");

  const memberPasswordHash = await bcrypt.hash(
    MEMBER_PASSWORD,
    12
  );

  console.log("✅ Member password hashed");
  console.log("");

  // ============================================================
  // 6. CREATE 100 MEMBERS
  // ============================================================

  console.log(
    `👥 Creating/updating ${MEMBER_COUNT} members...`
  );
  console.log("");

  const createdMembers = [];

  for (let index = 1; index <= MEMBER_COUNT; index++) {
    console.log(
      `──────────────────────────────────────────────`
    );

    console.log(
      `👤 Processing member ${index}/${MEMBER_COUNT}`
    );

    // ----------------------------------------------------------
    // MEMBER DATA
    // ----------------------------------------------------------

    const firstName = getMemberFirstName(index);
    const lastName = getMemberLastName(index);

    const phone = getMemberPhone(index);
    const email = getMemberEmail(index);

    const memberNumber = getMemberNumber(index);

    // ----------------------------------------------------------
    // CREATE / UPDATE USER
    // ----------------------------------------------------------

    const member = await prisma.user.upsert({
      where: {
        phone,
      },

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

    console.log(
      `   ✅ User: ${firstName} ${lastName}`
    );

    console.log(
      `   📱 Phone: ${phone}`
    );

    console.log(
      `   📧 Email: ${email}`
    );

    // ----------------------------------------------------------
    // CREATE / UPDATE MEMBERSHIP
    // ----------------------------------------------------------

    const membership =
      await prisma.equbMembership.upsert({
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

    console.log(
      `   ✅ Membership: ${membership.id}`
    );

    console.log(
      `   🎫 Member number: ${membership.memberNumber}`
    );

    // ----------------------------------------------------------
    // CALCULATE EXPECTED AMOUNT
    // ----------------------------------------------------------

    const expectedAmount =
      Number(equb.contributionAmount) *
      Number(membership.shares);

    console.log(
      `   💰 Expected amount: ${expectedAmount} ${equb.currency}`
    );

    // ----------------------------------------------------------
    // RECEIPT FILE
    // ----------------------------------------------------------

    const receiptFileName =
      getReceiptFileName(index);

    const seededReceiptPath =
      path.join(
        uploadsDirectory,
        receiptFileName
      );

    // Copy real receipt image for this member
    fs.copyFileSync(
      sourceReceiptPath,
      seededReceiptPath
    );

    const imageStats =
      fs.statSync(seededReceiptPath);

    console.log(
      `   📷 Receipt copied: ${receiptFileName}`
    );

    // ----------------------------------------------------------
    // TRANSACTION REFERENCE
    // ----------------------------------------------------------

    const transactionReference =
      getTransactionReference(index);

    // ----------------------------------------------------------
    // CREATE / UPDATE PAYMENT
    // ----------------------------------------------------------

    const payment =
      await prisma.payment.upsert({
        where: {
          membershipId_periodId: {
            membershipId: membership.id,
            periodId: period.id,
          },
        },

        update: {
          userId: member.id,

          expectedAmount,

          paidAmount: null,

          status: "PENDING",

          paymentDate: null,

          referenceNumber: null,

          notes:
            "Seeded receipt awaiting OCR processing.",
        },

        create: {
          membershipId: membership.id,
          periodId: period.id,
          userId: member.id,

          expectedAmount,

          paidAmount: null,

          status: "PENDING",

          paymentDate: null,

          referenceNumber: null,

          notes:
            "Seeded receipt awaiting OCR processing.",
        },
      });

    console.log(
      `   ✅ Payment: ${payment.id}`
    );

    console.log(
      `   📊 Payment status: ${payment.status}`
    );

    // ----------------------------------------------------------
    // CREATE / UPDATE RECEIPT
    // ----------------------------------------------------------

    let receipt =
      await prisma.receipt.findFirst({
        where: {
          paymentId: payment.id,
        },
      });

    const receiptData = {
      uploadedById: member.id,

      imageUrl:
        `/uploads/receipts/${receiptFileName}`,

      storageKey:
        `receipts/${receiptFileName}`,

      originalFileName:
        "test-receipt.jpg",

      mimeType: "image/jpeg",

      fileSize: imageStats.size,

      status: "UPLOADED",

      ocrProcessed: false,
    };

    if (receipt) {
      receipt =
        await prisma.receipt.update({
          where: {
            id: receipt.id,
          },

          data: receiptData,
        });
    } else {
      receipt =
        await prisma.receipt.create({
          data: {
            paymentId: payment.id,

            ...receiptData,
          },
        });
    }

    console.log(
      `   ✅ Receipt: ${receipt.id}`
    );

    console.log(
      `   📁 File: ${receiptFileName}`
    );

    console.log(
      `   📦 Size: ${receipt.fileSize} bytes`
    );

    // ----------------------------------------------------------
    // REMOVE OLD OCR DATA
    // ----------------------------------------------------------

    await prisma.oCRData.deleteMany({
      where: {
        receiptId: receipt.id,
      },
    });

    // ----------------------------------------------------------
    // REMOVE OLD VERIFICATION
    // ----------------------------------------------------------

    await prisma.paymentVerification.deleteMany({
      where: {
        paymentId: payment.id,
      },
    });

    // ----------------------------------------------------------
    // MAKE SURE PAYMENT IS PENDING
    // ----------------------------------------------------------

    await prisma.payment.update({
      where: {
        id: payment.id,
      },

      data: {
        status: "PENDING",

        paidAmount: null,

        paymentDate: null,

        referenceNumber: null,

        notes:
          "Seeded receipt awaiting OCR processing.",
      },
    });

    // ----------------------------------------------------------
    // UPDATE MEMBERSHIP TOTAL PAID
    // ----------------------------------------------------------

    const verifiedPayments =
      await prisma.payment.findMany({
        where: {
          membershipId: membership.id,

          status: "VERIFIED",
        },

        select: {
          paidAmount: true,
        },
      });

    const totalPaid =
      verifiedPayments.reduce(
        (total, item) => {
          return (
            total +
            Number(item.paidAmount || 0)
          );
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

    // ----------------------------------------------------------
    // SAVE MEMBER RESULT
    // ----------------------------------------------------------

    createdMembers.push({
      index,
      userId: member.id,
      membershipId: membership.id,
      paymentId: payment.id,
      receiptId: receipt.id,
      memberNumber,
      phone,
      email,
      expectedAmount,
    });

    console.log(
      `   ✅ Member ${index} completed`
    );
  }

  // ============================================================
  // 7. FINAL COUNTS
  // ============================================================

  const membershipCount =
    await prisma.equbMembership.count({
      where: {
        equbId: equb.id,
      },
    });

  const periodPaymentCount =
    await prisma.payment.count({
      where: {
        periodId: period.id,
      },
    });

  const receiptCount =
    await prisma.receipt.count({
      where: {
        payment: {
          periodId: period.id,
        },
      },
    });

  // ============================================================
  // 8. FINAL SUMMARY
  // ============================================================

  console.log("");
  console.log(
    "================================================"
  );
  console.log(
    "🎉 100-MEMBER DATABASE SEED COMPLETED"
  );
  console.log(
    "================================================"
  );

  console.log("");

  console.log("ADMIN");
  console.log("  Phone:    0900000000");
  console.log(
    `  Password: ${adminPassword}`
  );

  console.log("");

  console.log("EQUB");
  console.log(`  ID:       ${equb.id}`);
  console.log(`  Name:     ${equb.name}`);
  console.log(
    `  Members:  ${membershipCount}`
  );

  console.log("");

  console.log("PAYMENT PERIOD");
  console.log(`  ID:       ${period.id}`);
  console.log(
    `  Number:   ${period.periodNumber}`
  );
  console.log(
    `  Payments: ${periodPaymentCount}`
  );

  console.log("");

  console.log("RECEIPTS");
  console.log(
    `  Receipts: ${receiptCount}`
  );

  console.log("");

  console.log("MEMBER LOGIN");

  console.log(
    `  Password: ${MEMBER_PASSWORD}`
  );

  console.log(
    "  Phone range:"
  );

  console.log(
    `    ${getMemberPhone(1)}`
  );

  console.log(
    `    ${getMemberPhone(MEMBER_COUNT)}`
  );

  console.log("");

  console.log("MEMBER NUMBERS");

  console.log("  EQB-001");
  console.log("  EQB-002");
  console.log("  EQB-003");
  console.log("  ...");
  console.log("  EQB-100");

  console.log("");

  console.log("RECEIPT FILES");

  console.log(
    "  seed-receipt-001.jpg"
  );

  console.log(
    "  seed-receipt-002.jpg"
  );

  console.log(
    "  seed-receipt-003.jpg"
  );

  console.log("  ...");

  console.log(
    "  seed-receipt-100.jpg"
  );

  console.log("");

  console.log("OCR");

  console.log(
    "  Status: NOT PROCESSED YET"
  );

  console.log(
    "  All 100 receipts are waiting for OCR."
  );

  console.log("");

  console.log(
    "================================================"
  );
}

// ============================================================
// RUN
// ============================================================

main()
  .catch((error) => {
    console.error(
      "❌ Database seed failed:"
    );

    console.error(error);

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

