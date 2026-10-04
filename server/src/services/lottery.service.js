import crypto from "crypto";
import prisma from "../config/database.js";


/*
 * Convert membership shares into lottery tickets.
 *
 * Business rule:
 * 0.5 share = 1 ticket
 * 1.0 share = 2 tickets
 * 1.5 shares = 3 tickets
 * 2.0 shares = 4 tickets
 * 3.0 shares = 6 tickets
 */
const calculateTicketCount = (shares) => {
  const shareNumber = Number(shares);

  if (!Number.isFinite(shareNumber) || shareNumber <= 0) {
    throw new Error("Membership shares must be greater than 0");
  }

  const tickets = shareNumber * 2;

  if (!Number.isInteger(tickets)) {
    throw new Error(
      "Shares must be in increments of 0.5 for lottery participation"
    );
  }

  return tickets;
};

/*
 * Get or create the lottery draw for a payment period.
 */
export const getLottery = async (periodId) => {
  const period = await prisma.paymentPeriod.findUnique({
    where: {
      id: periodId,
    },
    include: {
      equb: true,
      lotteryDraw: {
        include: {
          entries: {
            where: {
              eligible: true,
            },
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  profileImage: true,
                },
              },
              membership: {
                select: {
                  id: true,
                  shares: true,
                  memberNumber: true,
                  status: true,
                },
              },
            },
            orderBy: {
              ticketNumber: "asc",
            },
          },
          winnerMembership: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  profileImage: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!period) {
    throw new Error("Payment period not found");
  }

  if (!period.equb) {
    throw new Error("Equb not found for this payment period");
  }

  let lottery = period.lotteryDraw;



  return {
    period,
    lottery,
  };
};

/*
 * Get all active members of the Equb and determine whether
 * they are automatically eligible for this period.
 */
/*
 * Get ALL active members of the Equb for the lottery room.
 *
 * IMPORTANT:
 * This does NOT return only lottery entries.
 *
 * Every active Equb member is returned so the admin can see:
 *
 * - who is a member
 * - their shares
 * - their payment status
 * - whether they are currently eligible
 * - how many tickets they have
 *
 * A member becomes eligible when:
 * - they were automatically added after a VERIFIED payment
 * - OR the admin manually adds them
 *
 * Removing a member marks their lottery entries as
 * eligible=false instead of deleting them.
 */
export const getLotteryMembers = async (periodId) => {
  const period = await prisma.paymentPeriod.findUnique({
    where: {
      id: periodId,
    },
    select: {
      id: true,
      equbId: true,
      periodNumber: true,
      status: true,
    },
  });

  if (!period) {
    throw new Error("Payment period not found");
  }

  const { lottery } = await getLottery(periodId);

  /*
   * Get every active member of this Equb.
   */
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
          profileImage: true,
        },
      },

      payments: {
        where: {
          periodId,
        },
        select: {
          id: true,
          status: true,
          paidAmount: true,
          expectedAmount: true,
          referenceNumber: true,
        },
      },
    },

    orderBy: {
      createdAt: "asc",
    },
  });

  /*
   * Map EVERY active member.
   */
  const members = memberships.map((membership) => {
    const payment = membership.payments[0] || null;

    /*
     * Find all entries belonging to this member.
     *
     * lottery.entries contains the currently eligible entries
     * because getOrCreateLottery() intentionally loads:
     *
     * eligible: true
     */
 const memberEntries = (lottery?.entries || []).filter(
  (entry) => entry.membershipId === membership.id
);

    const ticketCount = memberEntries.length;

    /*
     * A member is currently eligible if they have at least
     * one active lottery entry.
     */
    const lotteryEligible = ticketCount > 0;

    /*
     * Calculate how many tickets this member would receive
     * if made eligible.
     */
    const possibleTicketCount = calculateTicketCount(
      membership.shares
    );

    return {
      membershipId: membership.id,

      userId: membership.userId,

      memberNumber: membership.memberNumber,

      firstName: membership.user.firstName,

      lastName: membership.user.lastName,

      profileImage: membership.user.profileImage,

      shares: Number(membership.shares),

      /*
       * Number of tickets currently in the lottery pool.
       */
      ticketCount,

      /*
       * Number of tickets this member would have based
       * on their shares.
       */
      possibleTicketCount,

      /*
       * Current lottery state.
       */
      lotteryEligible,

      /*
       * Whether they qualify for automatic entry.
       */
      automaticallyEligible:
        payment?.status === "VERIFIED",

      /*
       * Payment information for the admin.
       */
      payment: payment
        ? {
            id: payment.id,
            status: payment.status,
            paidAmount: payment.paidAmount,
            expectedAmount: payment.expectedAmount,
            referenceNumber: payment.referenceNumber,
          }
        : null,

      /*
       * AUTOMATIC or MANUAL when currently eligible.
       */
      entryType:
        memberEntries[0]?.entryType || null,
    };
  });

  return {
    period,
    lottery,
    members,
  };
};

/*
 * Generate sequential ticket numbers.
 *
 * Example:
 * T001
 * T002
 * T003
 */
const generateTicketNumber = (number) => {
  return `T${String(number).padStart(3, "0")}`;
};

/*
 * Get the next ticket number for a lottery.
 */
const getNextTicketNumber = async (lotteryId) => {
  const count = await prisma.lotteryEntry.count({
    where: {
      lotteryId,
    },
  });

  return generateTicketNumber(count + 1);
};

/*
 * Add a member to the lottery.
 *
 * This is used for:
 * - automatically verified members
 * - manually added members
 */
export const addMemberToLottery = async ({
  periodId,
  membershipId,
  entryType = "MANUAL",
}) => {
const { lottery } = await getLottery(periodId);

if (!lottery) {
  throw new Error("Lottery has not been prepared yet");
}

if (lottery.status === "RUNNING") {
    throw new Error("Lottery is already running");
  }

  if (lottery.status === "COMPLETED") {
    throw new Error("Lottery has already been completed");
  }

  const membership = await prisma.equbMembership.findUnique({
    where: {
      id: membershipId,
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      equb: {
        select: {
          id: true,
        },
      },
      payments: {
        where: {
          periodId,
        },
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  if (!membership) {
    throw new Error("Membership not found");
  }

  if (membership.equb.id !== lottery.equbId) {
    throw new Error("Member does not belong to this Equb");
  }

  if (membership.status !== "ACTIVE") {
    throw new Error("Only active members can enter the lottery");
  }

  /*
   * If this is an automatic entry, payment must be verified.
   *
   * Manual entries can bypass this requirement because
   * the admin explicitly added the member.
   */
  if (entryType === "AUTOMATIC") {
    const payment = membership.payments[0];

    if (!payment || payment.status !== "VERIFIED") {
      throw new Error(
        "Member must have a verified payment to be added automatically"
      );
    }
  }

  const existingEntries = await prisma.lotteryEntry.findMany({
    where: {
      lotteryId: lottery.id,
      membershipId,
      eligible: true,
    },
    select: {
      id: true,
    },
  });

  /*
   * If the member is already in the pool, don't create
   * duplicate tickets.
   */
  if (existingEntries.length > 0) {
    throw new Error("Member is already in the lottery pool");
  }

  const ticketCount = calculateTicketCount(membership.shares);

  const entries = [];

  for (let i = 0; i < ticketCount; i++) {
    const ticketNumber = await getNextTicketNumber(lottery.id);

    const entry = await prisma.lotteryEntry.create({
      data: {
        lotteryId: lottery.id,
        userId: membership.userId,
        membershipId: membership.id,
        eligible: true,
        ticketNumber,
        entryType,
      },
    });

    entries.push(entry);
  }

  await prisma.lotteryDraw.update({
    where: {
      id: lottery.id,
    },
    data: {
      participantCount: await prisma.lotteryEntry.groupBy({
        by: ["membershipId"],
        where: {
          lotteryId: lottery.id,
          eligible: true,
        },
      }).then((groups) => groups.length),

      totalEntries: await prisma.lotteryEntry.count({
        where: {
          lotteryId: lottery.id,
          eligible: true,
        },
      }),
    },
  });

  return {
    membership,
    ticketCount,
    entries,
  };
};

/*
 * Remove a member from the current lottery pool.
 *
 * IMPORTANT:
 * We do NOT delete the entries.
 * We mark them as eligible=false so the history remains.
 */
export const removeMemberFromLottery = async ({
  periodId,
  membershipId,
}) => {
  const { lottery } = await getLottery(periodId);

  if (lottery.status === "RUNNING") {
    throw new Error("Lottery is already running");
  }

  if (lottery.status === "COMPLETED") {
    throw new Error("Lottery has already been completed");
  }

  const entries = await prisma.lotteryEntry.findMany({
    where: {
      lotteryId: lottery.id,
      membershipId,
      eligible: true,
    },
  });

  if (entries.length === 0) {
    throw new Error("Member is not currently in the lottery pool");
  }

  await prisma.lotteryEntry.updateMany({
    where: {
      lotteryId: lottery.id,
      membershipId,
      eligible: true,
    },
    data: {
      eligible: false,
    },
  });

  await updateLotteryCounts(lottery.id);

  return {
    membershipId,
    removedTickets: entries.length,
  };
};

/*
 * Remove all previous winners from the current lottery pool.
 *
 * Previous winner means a member who already won a lottery
 * in an earlier period of the same Equb.
 */
export const removePreviousWinners = async (periodId) => {
  const { lottery } = await getLottery(periodId);

  if (lottery.status === "RUNNING") {
    throw new Error("Lottery is already running");
  }

  if (lottery.status === "COMPLETED") {
    throw new Error("Lottery has already been completed");
  }

  const previousWinners = await prisma.lotteryDraw.findMany({
    where: {
      equbId: lottery.equbId,
      status: "COMPLETED",
      periodId: {
        not: periodId,
      },
      winnerMembershipId: {
        not: null,
      },
    },
    select: {
      winnerMembershipId: true,
    },
  });

  const winnerMembershipIds = previousWinners
    .map((draw) => draw.winnerMembershipId)
    .filter(Boolean);

  if (winnerMembershipIds.length === 0) {
    return {
      removedMembers: 0,
      removedTickets: 0,
    };
  }

  const result = await prisma.lotteryEntry.updateMany({
    where: {
      lotteryId: lottery.id,
      membershipId: {
        in: winnerMembershipIds,
      },
      eligible: true,
    },
    data: {
      eligible: false,
    },
  });

  await updateLotteryCounts(lottery.id);

  return {
    removedMembers: winnerMembershipIds.length,
    removedTickets: result.count,
  };
};

/*
 * Update cached lottery statistics.
 */
const updateLotteryCounts = async (lotteryId) => {
  const groups = await prisma.lotteryEntry.groupBy({
    by: ["membershipId"],
    where: {
      lotteryId,
      eligible: true,
    },
  });

  const totalEntries = await prisma.lotteryEntry.count({
    where: {
      lotteryId,
      eligible: true,
    },
  });

  return prisma.lotteryDraw.update({
    where: {
      id: lotteryId,
    },
    data: {
      participantCount: groups.length,
      totalEntries,
    },
  });
};

/*
 * Prepare the lottery for the actual draw.
 *
 * This automatically adds all members whose payment
 * for this period is VERIFIED.
 */
export const prepareLottery = async (periodId) => {
  // 1. Find the payment period.
  const period = await prisma.paymentPeriod.findUnique({
    where: { id: periodId },
    select: {
      id: true,
      equbId: true,
      periodNumber: true,
    },
  });

  if (!period) {
    throw new Error("Payment period not found");
  }

  // 2. Create the lottery if it doesn't exist.
  // If it already exists, reuse it.
  const lottery = await prisma.lotteryDraw.upsert({
    where: {
      periodId,
    },
    update: {},
    create: {
      periodId: period.id,
      equbId: period.equbId,
      drawNumber: period.periodNumber,
      status: "PENDING",
    },
  });

  // 3. Prevent modifications after the lottery starts.
  if (lottery.status === "RUNNING") {
    throw new Error("Lottery is already running");
  }

  if (lottery.status === "COMPLETED") {
    throw new Error("Lottery has already been completed");
  }

  // 4. Find active members who have verified payments.
  const memberships = await prisma.equbMembership.findMany({
    where: {
      equbId: period.equbId,
      status: "ACTIVE",
      payments: {
        some: {
          periodId,
          status: "VERIFIED",
        },
      },
    },
    select: {
      id: true,
    },
  });

  let addedMembers = 0;

  // 5. Add each eligible member without duplicating entries.
  for (const membership of memberships) {
    const existingEntry = await prisma.lotteryEntry.findFirst({
      where: {
        lotteryId: lottery.id,
        membershipId: membership.id,
        eligible: true,
      },
      select: {
        id: true,
      },
    });

    // This member has already been added.
    if (existingEntry) {
      continue;
    }

    // Add the member and generate tickets based on their shares.
    await addMemberToLottery({
      periodId,
      membershipId: membership.id,
      entryType: "AUTOMATIC",
    });

    addedMembers++;
  }

  // 6. Update participant and ticket counts.
  await updateLotteryCounts(lottery.id);

  // 7. Mark the lottery as ready.
  await prisma.lotteryDraw.update({
    where: {
      id: lottery.id,
    },
    data: {
      status: "READY",
    },
  });

  // 8. Return the updated lottery.
  const result = await getLottery(periodId);

  return {
    ...result,
    addedMembers,
  };
};

/*
 * Start the lottery.
 *
 * Once RUNNING:
 * - no adding members
 * - no removing members
 * - pool is frozen
 */
export const startLottery = async (periodId) => {
  const { lottery } = await getLottery(periodId);

  if (lottery.status === "RUNNING") {
    throw new Error("Lottery is already running");
  }

  if (lottery.status === "COMPLETED") {
    throw new Error("Lottery has already been completed");
  }

  const eligibleEntries = await prisma.lotteryEntry.count({
    where: {
      lotteryId: lottery.id,
      eligible: true,
    },
  });

  if (eligibleEntries === 0) {
    throw new Error("Cannot start lottery with no eligible entries");
  }

  const startedAt = new Date();

  const updatedLottery = await prisma.lotteryDraw.update({
    where: {
      id: lottery.id,
    },
    data: {
      status: "RUNNING",
      startedAt,
      participantCount: await prisma.lotteryEntry.groupBy({
        by: ["membershipId"],
        where: {
          lotteryId: lottery.id,
          eligible: true,
        },
      }).then((groups) => groups.length),
      totalEntries: eligibleEntries,
    },
  });

  return updatedLottery;
};

/*
 * Draw the winner using cryptographically secure randomness.
 *
 * Every eligible ticket has equal probability.
 * Therefore shares directly affect probability because
 * members with more tickets occupy more positions in the pool.
 */
export const drawLotteryWinner = async (periodId) => {
  const lotteryData = await getLottery(periodId);
  const lottery = lotteryData.lottery;

  if (lottery.status !== "RUNNING") {
    throw new Error("Lottery must be running before drawing a winner");
  }

  const eligibleEntries = await prisma.lotteryEntry.findMany({
    where: {
      lotteryId: lottery.id,
      eligible: true,
    },
    include: {
      membership: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profileImage: true,
            },
          },
        },
      },
    },
    orderBy: {
      ticketNumber: "asc",
    },
  });

  if (eligibleEntries.length === 0) {
    throw new Error("No eligible lottery entries");
  }

  /*
   * crypto.randomInt gives us a secure random integer
   * between 0 and eligibleEntries.length - 1.
   */
  const winningIndex = crypto.randomInt(0, eligibleEntries.length);

  const winningEntry = eligibleEntries[winningIndex];

  const executedAt = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const updatedLottery = await tx.lotteryDraw.update({
      where: {
        id: lottery.id,
      },
      data: {
        status: "COMPLETED",
        executedAt,
        winnerMembershipId: winningEntry.membershipId,
        participantCount: new Set(
          eligibleEntries.map((entry) => entry.membershipId)
        ).size,
        totalEntries: eligibleEntries.length,
      },
      include: {
        winnerMembership: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profileImage: true,
              },
            },
          },
        },
      },
    });

    /*
     * Once the winner has been selected, the payment period
     * is considered draw-completed.
     */
    await tx.paymentPeriod.update({
      where: {
        id: periodId,
      },
      data: {
        status: "DRAW_COMPLETED",
        closedAt: executedAt,
      },
    });

    return updatedLottery;
  });

  return {
    lottery: result,
    winningTicket: winningEntry.ticketNumber,
    winner: {
      membershipId: winningEntry.membershipId,
      userId: winningEntry.userId,
      firstName: winningEntry.membership.user.firstName,
      lastName: winningEntry.membership.user.lastName,
      profileImage: winningEntry.membership.user.profileImage,
    },
  };
};

/*
 * Get lottery history for an Equb.
 */
export const getLotteryHistory = async (equbId) => {
  return prisma.lotteryDraw.findMany({
    where: {
      equbId,
    },
    include: {
      period: {
        select: {
          id: true,
          periodNumber: true,
          startDate: true,
          dueDate: true,
          status: true,
        },
      },
      winnerMembership: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profileImage: true,
            },
          },
        },
      },
    },
    orderBy: {
      drawNumber: "desc",
    },
  });
};