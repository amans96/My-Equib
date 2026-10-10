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
    where: { id: periodId },
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

  // 1. Load all active members of this Equb.
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
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  // Return early if there are no active members.
  if (memberships.length === 0) {
    return {
      period,
      lottery,
      members: [],
    };
  }

  // 2. Find payment allocations belonging to THIS period
  // and these memberships. PaymentAllocation connects the
  // payment to its payment period.
  const membershipIds = memberships.map(
    (membership) => membership.id
  );

  const allocations = await prisma.paymentAllocation.findMany({
    where: {
      periodId,
      payment: {
        membershipId: {
          in: membershipIds,
        },
      },
    },
    select: {
      amount: true,
      createdAt: true,
      payment: {
        select: {
          id: true,
          membershipId: true,
          status: true,
          paidAmount: true,
          expectedAmount: true,
          referenceNumber: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // 3. Group allocations by membership.
  const allocationsByMembership = new Map();

  for (const allocation of allocations) {
    const membershipId = allocation.payment.membershipId;

    if (!allocationsByMembership.has(membershipId)) {
      allocationsByMembership.set(membershipId, []);
    }

    allocationsByMembership.get(membershipId).push(allocation);
  }

  // 4. Map every active member and their lottery status.
  const members = memberships.map((membership) => {
    const memberAllocations =
      allocationsByMembership.get(membership.id) || [];

    // Prefer a verified payment for this period.
    // Otherwise, use the most recently created allocation.
    const selectedAllocation =
      memberAllocations.find(
        (allocation) => allocation.payment.status === "VERIFIED"
      ) || memberAllocations[0] || null;

    const payment = selectedAllocation?.payment || null;

    // Find this member's existing lottery entries.
    const memberEntries = (lottery?.entries || []).filter(
      (entry) => entry.membershipId === membership.id
    );

    const ticketCount = memberEntries.length;

    const lotteryEligible = ticketCount > 0;

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

      ticketCount,
      possibleTicketCount,
      lotteryEligible,

      automaticallyEligible:
        payment?.status === "VERIFIED",

      payment: payment
        ? {
            id: payment.id,
            status: payment.status,
            paidAmount: payment.paidAmount,
            expectedAmount: payment.expectedAmount,
            referenceNumber: payment.referenceNumber,
            allocatedAmount: selectedAllocation.amount,
          }
        : null,

      entryType: memberEntries[0]?.entryType || null,
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
  const { period, lottery } = await getLottery(periodId);

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
    },
  });

  if (!membership) {
    throw new Error("Membership not found");
  }

  if (membership.equb.id !== period.equbId) {
    throw new Error("Member does not belong to this Equb");
  }

  if (membership.status !== "ACTIVE") {
    throw new Error("Only active members can enter the lottery");
  }

  // Automatic entries require a verified payment allocated
  // to this exact payment period.
  if (entryType === "AUTOMATIC") {
    const allocation = await prisma.paymentAllocation.findFirst({
      where: {
        periodId,
        payment: {
          membershipId,
          status: "VERIFIED",
        },
      },
      select: {
        payment: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!allocation || allocation.payment.status !== "VERIFIED") {
      throw new Error(
        "Member must have a verified payment for this period to be added automatically"
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

  await updateLotteryCounts(lottery.id);

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
    where: {
      id: periodId,
    },
    select: {
      id: true,
      equbId: true,
      periodNumber: true,
    },
  });

  if (!period) {
    throw new Error("Payment period not found");
  }

  // 2. Create the lottery if it does not exist.
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

  // 3. Prevent modifications after the draw starts or finishes.
  if (lottery.status === "RUNNING") {
    throw new Error("Lottery is already running");
  }

  if (lottery.status === "COMPLETED") {
    throw new Error("Lottery has already been completed");
  }

  // 4. Get all active memberships in this Equb.
  const memberships = await prisma.equbMembership.findMany({
    where: {
      equbId: period.equbId,
      status: "ACTIVE",
    },
    select: {
      id: true,
    },
  });

  const membershipIds = memberships.map(
    (membership) => membership.id
  );

  // 5. Find verified payments allocated to this exact period.
  // PaymentAllocation is the relationship between payments
  // and payment periods.
  const allocations =
    membershipIds.length > 0
      ? await prisma.paymentAllocation.findMany({
          where: {
            periodId,
            payment: {
              membershipId: {
                in: membershipIds,
              },
              status: "VERIFIED",
            },
          },
          select: {
            payment: {
              select: {
                membershipId: true,
              },
            },
          },
        })
      : [];

  // A member may have more than one allocation/payment,
  // so only process each membership once.
  const eligibleMembershipIds = [
    ...new Set(
      allocations.map(
        (allocation) => allocation.payment.membershipId
      )
    ),
  ];

  let addedMembers = 0;

  // 6. Add verified members who are not already in the pool.
  for (const eligibleMembershipId of eligibleMembershipIds) {
    const existingEntry = await prisma.lotteryEntry.findFirst({
      where: {
        lotteryId: lottery.id,
        membershipId: eligibleMembershipId,
        eligible: true,
      },
      select: {
        id: true,
      },
    });

    if (existingEntry) {
      continue;
    }

    await addMemberToLottery({
      periodId,
      membershipId: eligibleMembershipId,
      entryType: "AUTOMATIC",
    });

    addedMembers++;
  }

  // 7. Update lottery statistics.
  await updateLotteryCounts(lottery.id);

  // 8. Mark the lottery as ready.
  await prisma.lotteryDraw.update({
    where: {
      id: lottery.id,
    },
    data: {
      status: "READY",
    },
  });

  // 9. Return the latest lottery data.
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