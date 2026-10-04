
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/*
|--------------------------------------------------------------------------
| CREATE EQUb
|--------------------------------------------------------------------------
| Only ADMIN can create an Equb.
| The logged-in ADMIN becomes the creator through createdById.
*/
const generatePaymentPeriods = ({
  startDate,
  endDate,
  frequency,
  contributionAmount,
}) => {
  const periods = [];

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Invalid start date or end date.");
  }

  if (start >= end) {
    throw new Error("Start date must be before end date.");
  }

  let currentStart = new Date(start);
  let periodNumber = 1;

  while (currentStart < end) {
    const currentEnd = new Date(currentStart);

    switch (frequency) {
      case "DAILY":
        currentEnd.setDate(currentEnd.getDate() + 1);
        break;

      case "WEEKLY":
        currentEnd.setDate(currentEnd.getDate() + 7);
        break;

      case "BIWEEKLY":
        currentEnd.setDate(currentEnd.getDate() + 14);
        break;

      case "MONTHLY":
        currentEnd.setMonth(currentEnd.getMonth() + 1);
        break;

      default:
        throw new Error(`Unsupported frequency: ${frequency}`);
    }

    // Never allow a period to go beyond the Equb end date.
    const periodEnd =
      currentEnd < end ? new Date(currentEnd) : new Date(end);

    periods.push({
      periodNumber,
      startDate: new Date(currentStart),
      dueDate: periodEnd,
      status: "UPCOMING",
      expectedAmount: contributionAmount,
    });

    // The next period starts exactly where the previous one ended.
    currentStart = new Date(currentEnd);
    periodNumber++;
  }

  return periods;
};
export const createEqub = async (req, res) => {
  try {
    // 1. Check authentication
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

const userId = req.user.userId;

    // 2. Get actual user
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 3. Only ADMIN can create Equb
    if (user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only administrators can create an Equb",
      });
    }

    // 4. Check active account
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive",
      });
    }

    // 5. Get request data
    const {
      name,
      description,
      contributionAmount,
      frequency,
      startDate,
      endDate,
      currency,
    } = req.body;

    // 6. Required fields
    if (
      !name ||
      contributionAmount === undefined ||
      !frequency ||
      !startDate ||
      !endDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "name, contributionAmount, frequency, startDate and endDate are required",
      });
    }

    // 7. Validate contribution amount
    const amount = Number(contributionAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "contributionAmount must be a positive number",
      });
    }

    // 8. Validate frequency
    const validFrequencies = [
      "DAILY",
      "WEEKLY",
      "BIWEEKLY",
      "MONTHLY",
    ];

    if (!validFrequencies.includes(frequency)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contribution frequency",
        validValues: validFrequencies,
      });
    }

    // 9. Validate start date
    const parsedStartDate = new Date(startDate);

    if (Number.isNaN(parsedStartDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid startDate",
      });
    }

    // 10. Validate end date
    const parsedEndDate = new Date(endDate);

    if (Number.isNaN(parsedEndDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid endDate",
      });
    }

    if (parsedEndDate <= parsedStartDate) {
      return res.status(400).json({
        success: false,
        message: "endDate must be after startDate",
      });
    }

    // 11. Generate all payment periods
    const generatedPeriods = generatePaymentPeriods({
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      frequency,
      contributionAmount: amount,
    });

    if (generatedPeriods.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No payment periods could be generated",
      });
    }

    // 12. Create Equb + all periods in one transaction
    const equb = await prisma.$transaction(async (tx) => {
      const createdEqub = await tx.equb.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,

          contributionAmount: amount,
          frequency,

          // Automatically calculated
          totalPeriods: generatedPeriods.length,
          currentPeriod: 0,

          startDate: parsedStartDate,
          endDate: parsedEndDate,

          status: "PENDING",

          currency: currency?.trim() || "ETB",

          createdById: user.id,
        },
      });

      // Create all payment periods
      await tx.paymentPeriod.createMany({
        data: generatedPeriods.map((period) => ({
          equbId: createdEqub.id,
          periodNumber: period.periodNumber,
          startDate: period.startDate,
          dueDate: period.dueDate,
          status: period.status,
          expectedAmount: period.expectedAmount,
        })),
      });

      // Return Equb with generated periods
      return tx.equb.findUnique({
        where: {
          id: createdEqub.id,
        },

        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },

          periods: {
            orderBy: {
              periodNumber: "asc",
            },
          },
        },
      });
    });

    return res.status(201).json({
      success: true,
      message: "Equb created successfully with payment periods",
      equb,
      periodCount: generatedPeriods.length,
    });
  } catch (error) {
    console.error("Create Equb Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create Equb",
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET ALL EQUBS
|--------------------------------------------------------------------------
| Returns Equbs.
|
| ADMIN:
|   Gets only Equbs they created.
|
| SUPER_ADMIN:
|   Gets all Equbs.
|
| MEMBER:
|   Can see active Equbs.
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| GET SINGLE EQUB
|--------------------------------------------------------------------------
| ADMIN:
|   Can view only their own Equb.
|
| SUPER_ADMIN:
|   Can view any Equb.
|
| MEMBER:
|   Can view only ACTIVE Equbs.
|--------------------------------------------------------------------------
*/

export const getEqubs = async (req, res) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: req.user.userId,
      },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive",
      });
    }

    let where = {};

    // ADMIN sees only their own Equbs
    if (user.role === "ADMIN") {
      where = {
        createdById: user.id,
      };
    }

    // MEMBER sees only ACTIVE Equbs
    if (user.role === "MEMBER") {
      where = {
        status: "PENDING",
      };
    }

    // SUPER_ADMIN sees everything

    const equbs = await prisma.equb.findMany({
      where,

      orderBy: {
        createdAt: "desc",
      },

      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },

        _count: {
          select: {
            memberships: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      count: equbs.length,
      equbs,
    });
  } catch (error) {
    console.error("Get Equbs Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch Equbs",
    });
  }
};


/*
|--------------------------------------------------------------------------
| GET SINGLE EQUB
|--------------------------------------------------------------------------
| ADMIN:
|   Can view only their own Equb.
|
| SUPER_ADMIN:
|   Can view any Equb.
|
| MEMBER:
|   Can view only ACTIVE Equbs.
|--------------------------------------------------------------------------
*/

export const getEqubById = async (req, res) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: {
        id: req.user.userId,
      },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive",
      });
    }

    const equb = await prisma.equb.findUnique({
      where: {
        id,
      },

      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },

        _count: {
          select: {
            memberships: true,
            periods: true,
          },
        },
      },
    });

    if (!equb) {
      return res.status(404).json({
        success: false,
        message: "Equb not found",
      });
    }

    // ADMIN can only access their own Equbs
    if (
      user.role === "ADMIN" &&
      equb.createdById !== user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this Equb",
      });
    }

    // MEMBER can only see ACTIVE Equbs
    if (
      user.role === "MEMBER" &&
      equb.status !== "ACTIVE"
    ) {
      return res.status(403).json({
        success: false,
        message: "This Equb is not currently available",
      });
    }

    return res.status(200).json({
      success: true,
      equb,
    });
  } catch (error) {
    console.error("Get Equb Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch Equb",
    });
  }
};



/*
|--------------------------------------------------------------------------
| UPDATE EQUB
|--------------------------------------------------------------------------
| ADMIN:
|   Can update only Equbs they created.
|
| SUPER_ADMIN:
|   Can update any Equb.
|
| MEMBER:
|   Cannot update.
|--------------------------------------------------------------------------
*/
export const updateEqub = async (req, res) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id,
      },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive",
      });
    }

    // Only ADMIN and SUPER_ADMIN can update
    if (
      user.role !== "ADMIN" &&
      user.role !== "SUPER_ADMIN"
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to update an Equb",
      });
    }

    const existingEqub = await prisma.equb.findUnique({
      where: {
        id,
      },
    });

    if (!existingEqub) {
      return res.status(404).json({
        success: false,
        message: "Equb not found",
      });
    }

    // ADMIN can update only their own Equb
    if (
      user.role === "ADMIN" &&
      existingEqub.createdById !== user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only update Equbs you created",
      });
    }

    const {
      name,
      description,
      contributionAmount,
      frequency,
      totalPeriods,
      startDate,
      endDate,
      currency,
      status,
    } = req.body;

    const data = {};

    // Name
    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: "name cannot be empty",
        });
      }

      data.name = name.trim();
    }

    // Description
    if (description !== undefined) {
      data.description = description?.trim() || null;
    }

    // Contribution amount
    if (contributionAmount !== undefined) {
      const amount = Number(contributionAmount);

      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "contributionAmount must be a positive number",
        });
      }

      data.contributionAmount = amount;
    }

    // Frequency
    if (frequency !== undefined) {
      const validFrequencies = [
        "DAILY",
        "WEEKLY",
        "BIWEEKLY",
        "MONTHLY",
      ];

      if (!validFrequencies.includes(frequency)) {
        return res.status(400).json({
          success: false,
          message: "Invalid contribution frequency",
          validValues: validFrequencies,
        });
      }

      data.frequency = frequency;
    }

    // Total periods
    if (totalPeriods !== undefined) {
      const periods = Number(totalPeriods);

      if (!Number.isInteger(periods) || periods <= 0) {
        return res.status(400).json({
          success: false,
          message: "totalPeriods must be a positive integer",
        });
      }

      data.totalPeriods = periods;
    }

    // Start date
    if (startDate !== undefined) {
      const parsedStartDate = new Date(startDate);

      if (Number.isNaN(parsedStartDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid startDate",
        });
      }

      data.startDate = parsedStartDate;
    }

    // End date
    if (endDate !== undefined) {
      if (endDate === null || endDate === "") {
        data.endDate = null;
      } else {
        const parsedEndDate = new Date(endDate);

        if (Number.isNaN(parsedEndDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid endDate",
          });
        }

        data.endDate = parsedEndDate;
      }
    }

    // Currency
    if (currency !== undefined) {
      if (!currency.trim()) {
        return res.status(400).json({
          success: false,
          message: "currency cannot be empty",
        });
      }

      data.currency = currency.trim();
    }

    // Status
    if (status !== undefined) {
      const validStatuses = [
        "PENDING",
        "ACTIVE",
        "PAUSED",
        "COMPLETED",
        "CANCELLED",
      ];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid Equb status",
          validValues: validStatuses,
        });
      }

      data.status = status;
    }

    // Update
    const updatedEqub = await prisma.equb.update({
      where: {
        id,
      },

      data,

      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Equb updated successfully",
      equb: updatedEqub,
    });
  } catch (error) {
    console.error("Update Equb Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update Equb",
    });
  }
};

/*
|--------------------------------------------------------------------------
| DELETE EQUB
|--------------------------------------------------------------------------
| ADMIN:
|   Can delete only Equbs they created.
|
| SUPER_ADMIN:
|   Can delete any Equb.
|
| MEMBER:
|   Cannot delete.
|--------------------------------------------------------------------------
*/
export const deleteEqub = async (req, res) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const { id } = req.params;
    const userId = req.user.userId;

    // Only ADMIN can delete Equbs.
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only admins can delete Equbs.",
      });
    }

    const equb = await prisma.equb.findUnique({
      where: {
        id,
      },
      include: {
        memberships: true,
        periods: {
          include: {
            payments: true,
            lotteryDraw: true,
          },
        },
      },
    });

    if (!equb) {
      return res.status(404).json({
        success: false,
        message: "Equb not found.",
      });
    }

    // Admin can only delete Equbs they created.
    if (equb.createdById !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only delete Equbs you created.",
      });
    }

    // Do not allow deleting an active Equb.
    if (equb.status === "ACTIVE") {
      return res.status(400).json({
        success: false,
        message:
          "Active Equbs cannot be deleted. Cancel or complete the Equb instead.",
      });
    }

    // Never delete an Equb that already has members.
    if (equb.memberships.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "This Equb cannot be deleted because it already has members. Cancel the Equb instead.",
      });
    }

    // Check whether any payment exists in its periods.
    const hasPayments = equb.periods.some(
      (period) => period.payments && period.payments.length > 0
    );

    if (hasPayments) {
      return res.status(400).json({
        success: false,
        message:
          "This Equb cannot be deleted because it already has payment history. Cancel the Equb instead.",
      });
    }

    // Check whether a lottery draw exists.
    const hasLotteryDraw = equb.periods.some(
      (period) => period.lotteryDraw
    );

    if (hasLotteryDraw) {
      return res.status(400).json({
        success: false,
        message:
          "This Equb cannot be deleted because it already has lottery history. Cancel the Equb instead.",
      });
    }

    /*
     * At this point:
     * - No members
     * - No payments
     * - No lottery draws
     *
     * The Equb can safely be deleted.
     *
     * Payment periods must be removed first because they reference
     * the Equb.
     */
    await prisma.$transaction(async (tx) => {
      await tx.paymentPeriod.deleteMany({
        where: {
          equbId: id,
        },
      });

      await tx.equb.delete({
        where: {
          id,
        },
      });
    });

    return res.status(200).json({
      success: true,
      message: "Equb deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Equb error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete Equb.",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};
export const getEqubPeriods = async (req, res) => {
try {
const { id } = req.params;
const userId = req.user.userId;
const userRole = req.user.role;


// --------------------------------------------------
// 1. Find the Equb
// --------------------------------------------------

const equb = await prisma.equb.findUnique({
  where: {
    id,
  },
  select: {
    id: true,
    name: true,
    contributionAmount: true,
    frequency: true,
    totalPeriods: true,
    currentPeriod: true,
    status: true,
    currency: true,
    startDate: true,
    endDate: true,
    createdById: true,
  },
});

if (!equb) {
  return res.status(404).json({
    success: false,
    message: "Equb not found",
  });
}

// --------------------------------------------------
// 2. Authorization
//
// ADMIN       -> only their own Equb
// SUPER_ADMIN -> any Equb
// --------------------------------------------------

if (
  userRole !== "SUPER_ADMIN" &&
  equb.createdById !== userId
) {
  return res.status(403).json({
    success: false,
    message: "You are not authorized to view these periods",
  });
}

// --------------------------------------------------
// 3. Get payment periods
// --------------------------------------------------

const periods = await prisma.paymentPeriod.findMany({
  where: {
    equbId: id,
  },
  include: {
    payments: {
      select: {
        id: true,
        paidAmount: true,
        status: true,
      },
    },
    lotteryDraw: {
      select: {
        id: true,
        status: true,
        drawNumber: true,
        winnerMembershipId: true,
        scheduledAt: true,
        executedAt: true,
      },
    },
  },
  orderBy: {
    periodNumber: "asc",
  },
});

// --------------------------------------------------
// 4. Calculate statistics for each period
// --------------------------------------------------

const formattedPeriods = periods.map((period) => {
  const payments = period.payments;

  const paymentCount = payments.length;

  const verifiedPayments = payments.filter(
    (payment) => payment.status === "VERIFIED"
  );

  const pendingPayments = payments.filter((payment) =>
    [
      "PENDING",
      "SUBMITTED",
      "UNDER_REVIEW",
      "NEEDS_REVIEW",
    ].includes(payment.status)
  );

  const totalCollected = verifiedPayments.reduce(
    (total, payment) =>
      total + Number(payment.paidAmount || 0),
    0
  );

  const verifiedPaymentCount = verifiedPayments.length;

  const pendingPaymentCount = pendingPayments.length;

  const expectedAmount = Number(period.expectedAmount);

  const collectionPercentage =
    expectedAmount > 0
      ? Math.min(
          (totalCollected / expectedAmount) * 100,
          100
        )
      : 0;

  return {
    id: period.id,
    periodNumber: period.periodNumber,

    startDate: period.startDate,
    dueDate: period.dueDate,
    closedAt: period.closedAt,

    status: period.status,

    expectedAmount,

    paymentCount,
    verifiedPaymentCount,
    pendingPaymentCount,

    totalCollected,

    collectionPercentage: Number(
      collectionPercentage.toFixed(2)
    ),

    lotteryDraw: period.lotteryDraw,
  };
});

// --------------------------------------------------
// 5. Summary statistics
// --------------------------------------------------

const totalPeriods = formattedPeriods.length;

const openPeriods = formattedPeriods.filter(
  (period) => period.status === "OPEN"
).length;

const upcomingPeriods = formattedPeriods.filter(
  (period) => period.status === "UPCOMING"
).length;

const closedPeriods = formattedPeriods.filter(
  (period) =>
    period.status === "CLOSED" ||
    period.status === "DRAW_PENDING" ||
    period.status === "DRAW_COMPLETED"
).length;

const totalCollected = formattedPeriods.reduce(
  (total, period) => total + period.totalCollected,
  0
);

return res.status(200).json({
  success: true,

  equb: {
    id: equb.id,
    name: equb.name,
    contributionAmount: Number(equb.contributionAmount),
    frequency: equb.frequency,
    totalPeriods: equb.totalPeriods,
    currentPeriod: equb.currentPeriod,
    status: equb.status,
    currency: equb.currency,
    startDate: equb.startDate,
    endDate: equb.endDate,
  },

  summary: {
    totalPeriods,
    openPeriods,
    upcomingPeriods,
    closedPeriods,
    totalCollected,
  },

  count: formattedPeriods.length,
  periods: formattedPeriods,
});


} catch (error) {
console.error("Get Equb Periods Error:", error);

return res.status(500).json({
  success: false,
  message: "Failed to fetch Equb payment periods",
});


}
};

