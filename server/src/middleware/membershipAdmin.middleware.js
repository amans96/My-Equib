
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const requireMembershipAdmin = async (req, res, next) => {
  try {
    // Make sure user is authenticated
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { membershipId } = req.params;

    if (!membershipId) {
      return res.status(400).json({
        success: false,
        message: "Membership ID is required",
      });
    }

    // Get the logged-in user
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

    // Check account status
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive",
      });
    }

    // Only ADMIN and SUPER_ADMIN can manage memberships
    if (
      user.role !== "ADMIN" &&
      user.role !== "SUPER_ADMIN"
    ) {
      return res.status(403).json({
        success: false,
        message: "Only administrators can manage memberships",
      });
    }

    // Find the membership and its Equb creator
    const membership = await prisma.equbMembership.findUnique({
      where: {
        id: membershipId,
      },
      include: {
        equb: {
          select: {
            id: true,
            createdById: true,
            name: true,
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

    /*
     * SUPER_ADMIN can manage memberships
     * for any Equb.
     */
    if (user.role === "SUPER_ADMIN") {
      req.membership = membership;
      return next();
    }

    /*
     * ADMIN can only manage memberships
     * for Equbs they created.
     */
    if (membership.equb.createdById !== user.id) {
      return res.status(403).json({
        success: false,
        message:
          "You can only manage memberships for Equbs you created",
      });
    }

    // Attach membership so the controller doesn't
    // need to query it again.
    req.membership = membership;

    next();
  } catch (error) {
    console.error("Require Membership Admin Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to verify membership administrator",
    });
  }
};

