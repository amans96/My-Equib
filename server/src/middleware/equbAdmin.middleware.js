
import prisma from "../config/database.js";

/*
  Checks whether the logged-in user can manage a specific Equb.

  Allowed:
  - SUPER_ADMIN
  - ADMIN
  - Equb OWNER
  - Equb MANAGER
*/

export const requireEqubAdmin = async (req, res, next) => {
  try {
    const { equbId } = req.params;
    const userId = req.user.userId;
    const globalRole = req.user.role;

    // Global admins can manage Equbs
    if (globalRole === "SUPER_ADMIN" || globalRole === "ADMIN") {
      return next();
    }

    // Check whether the user is an admin of this specific Equb
    const equbAdmin = await prisma.equbAdmin.findUnique({
      where: {
        equbId_userId: {
          equbId,
          userId,
        },
      },
    });

    if (!equbAdmin) {
      return res.status(403).json({
        success: false,
        message: "You are not an admin of this Equb",
      });
    }

    // Only OWNER and MANAGER can manage memberships
    if (!["OWNER", "MANAGER"].includes(equbAdmin.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to manage Equb memberships",
      });
    }

    req.equbAdmin = equbAdmin;

    next();
  } catch (error) {
    console.error("Equb Admin Authorization Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to verify Equb admin permissions",
    });
  }
};

