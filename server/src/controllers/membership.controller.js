
import prisma from "../config/database.js";

/*
  USER REQUESTS TO JOIN AN EQUB
  POST /api/equbs/:equbId/join

  Body:
  {
    "shares": 2
  }
*/
export const requestToJoinEqub = async (req, res) => {
  try {
    const { equbId } = req.params;
    const userId = req.user.userId;
    const { shares } = req.body;

    // Validate shares
    if (shares === undefined || shares === null) {
      return res.status(400).json({
        success: false,
        message: "Shares are required",
      });
    }

    const sharesNumber = Number(shares);

    if (!Number.isFinite(sharesNumber) || sharesNumber <= 0) {
      return res.status(400).json({
        success: false,
        message: "Shares must be a number greater than 0",
      });
    }

    // Check that the Equb exists
    const equb = await prisma.equb.findUnique({
      where: {
        id: equbId,
      },
    });

    if (!equb) {
      return res.status(404).json({
        success: false,
        message: "Equb not found",
      });
    }

    // Don't allow joining closed/cancelled Equbs
    if (
      equb.status === "COMPLETED" ||
      equb.status === "CANCELLED"
    ) {
      return res.status(400).json({
        success: false,
        message: "This Equb is no longer accepting members",
      });
    }

    // Check whether the user already has a membership
    const existingMembership = await prisma.equbMembership.findUnique({
      where: {
        userId_equbId: {
          userId,
          equbId,
        },
      },
    });

    if (existingMembership) {
      return res.status(409).json({
        success: false,
        message: "You already have a membership request for this Equb",
        status: existingMembership.status,
      });
    }

    // Calculate contribution for each period
    const contributionAmount =
      Number(equb.contributionAmount) * sharesNumber;

    // Create pending membership
    const membership = await prisma.equbMembership.create({
      data: {
        userId,
        equbId,
        shares: sharesNumber,
        status: "PENDING",
      },
      include: {
        equb: {
          select: {
            id: true,
            name: true,
            contributionAmount: true,
            frequency: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: "Your request to join the Equb has been submitted",
      membership,
      contributionAmount,
    });
  } catch (error) {
    console.error("Request To Join Equb Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit membership request",
    });
  }
};


/*
  ADMIN GETS PENDING MEMBERSHIP REQUESTS
  GET /api/equbs/:equbId/members/pending
*/
export const getPendingMemberships = async (req, res) => {
  try {
    const { equbId } = req.params;

    const memberships = await prisma.equbMembership.findMany({
      where: {
        equbId,
        status: "PENDING",
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            profileImage: true,
            createdAt: true,
          },
        },
        equb: {
          select: {
            id: true,
            name: true,
            contributionAmount: true,
            frequency: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const formattedMemberships = memberships.map((membership) => {
      const contributionAmount =
        Number(membership.equb.contributionAmount) *
        Number(membership.shares);

      return {
        ...membership,
        contributionAmount,
      };
    });

    return res.status(200).json({
      success: true,
      count: formattedMemberships.length,
      memberships: formattedMemberships,
    });
  } catch (error) {
    console.error("Get Pending Memberships Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch pending membership requests",
    });
  }
};


/*
  ADMIN APPROVES MEMBERSHIP
  PATCH /api/memberships/:membershipId/approve
*/

/*
  ADMIN APPROVES OR RE-APPROVES MEMBERSHIP
  PATCH /api/memberships/:membershipId/approve
*/
export const approveMembership = async (req, res) => {
  try {
    const { membershipId } = req.params;

    const membership = await prisma.equbMembership.findUnique({
      where: {
        id: membershipId,
      },
      include: {
        equb: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: "Membership request not found",
      });
    }

    // Already active: no update needed
    if (membership.status === "ACTIVE") {
      return res.status(200).json({
        success: true,
        message: "Membership is already active",
        membership,
      });
    }

    // Allow PENDING or REJECTED to become ACTIVE
    const updatedMembership = await prisma.equbMembership.update({
      where: {
        id: membershipId,
      },
      data: {
        status: "ACTIVE",
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
        equb: {
          select: {
            id: true,
            name: true,
            contributionAmount: true,
            frequency: true,
          },
        },
      },
    });

    const contributionAmount =
      Number(updatedMembership.equb.contributionAmount) *
      Number(updatedMembership.shares);

    return res.status(200).json({
      success: true,
      message: "Membership approved successfully",
      membership: updatedMembership,
      contributionAmount,
    });
  } catch (error) {
    console.error("Approve Membership Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to approve membership",
    });
  }
};


/*
  ADMIN REJECTS MEMBERSHIP
  PATCH /api/memberships/:membershipId/reject
*/

/*
  ADMIN REJECTS OR RE-REJECTS MEMBERSHIP
  PATCH /api/memberships/:membershipId/reject
*/
export const rejectMembership = async (req, res) => {
  try {
    const { membershipId } = req.params;

    const membership = await prisma.equbMembership.findUnique({
      where: {
        id: membershipId,
      },
      include: {
        equb: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: "Membership request not found",
      });
    }

    // Already rejected: no update needed
    if (membership.status === "REJECTED") {
      return res.status(200).json({
        success: true,
        message: "Membership is already rejected",
        membership,
      });
    }

    // Allow PENDING or ACTIVE to become REJECTED
    const updatedMembership = await prisma.equbMembership.update({
      where: {
        id: membershipId,
      },
      data: {
        status: "REJECTED",
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
        equb: {
          select: {
            id: true,
            name: true,
            contributionAmount: true,
            frequency: true,
          },
        },
      },
    });

    const contributionAmount =
      Number(updatedMembership.equb.contributionAmount) *
      Number(updatedMembership.shares);

    return res.status(200).json({
      success: true,
      message: "Membership rejected successfully",
      membership: updatedMembership,
      contributionAmount,
    });
  } catch (error) {
    console.error("Reject Membership Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to reject membership",
    });
  }
};

/*
  MEMBER GETS THEIR OWN EQUB MEMBERSHIPS
  GET /api/memberships/my
*/
export const getMyMemberships = async (req, res) => {
  try {
    const userId = req.user.userId;

    const memberships = await prisma.equbMembership.findMany({
      where: {
        userId,
      },
      include: {
        equb: {
          select: {
            id: true,
            name: true,
            description: true,
            contributionAmount: true,
            frequency: true,
            totalPeriods: true,
            currentPeriod: true,
            status: true,
            currency: true,
            startDate: true,
            endDate: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedMemberships = memberships.map((membership) => {
      const contributionAmount =
        Number(membership.equb.contributionAmount) *
        Number(membership.shares);

      return {
        id: membership.id,
        status: membership.status,
        shares: Number(membership.shares),
        totalPaid: Number(membership.totalPaid),
        missedPayments: membership.missedPayments,
        contributionAmount,

        equb: {
          ...membership.equb,
          contributionAmount: Number(
            membership.equb.contributionAmount
          ),
        },
      };
    });

    return res.status(200).json({
      success: true,
      count: formattedMemberships.length,
      memberships: formattedMemberships,
    });
  } catch (error) {
    console.error("Get My Memberships Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch your Equb memberships",
    });
  }
};
export const getEqubMembers = async (req, res) => {
try {
const { equbId } = req.params;


const memberships = await prisma.equbMembership.findMany({
  where: {
    equbId,
  },
  include: {
    user: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        profileImage: true,
        createdAt: true,
      },
    },
    equb: {
      select: {
        id: true,
        name: true,
        contributionAmount: true,
        frequency: true,
      },
    },
  },
  orderBy: {
    createdAt: "desc",
  },
});

const formattedMemberships = memberships.map((membership) => ({
  ...membership,
  contributionAmount:
    Number(membership.equb.contributionAmount) *
    Number(membership.shares),
  totalPaid: Number(membership.totalPaid),
  missedPayments: Number(membership.missedPayments),
  shares: Number(membership.shares),
}));

return res.status(200).json({
  success: true,
  count: formattedMemberships.length,
  memberships: formattedMemberships,
});


} catch (error) {
console.error("Get Equb members error:", error);

return res.status(500).json({
  success: false,
  message: "Failed to fetch Equb members",
});


}
};
