
import prisma from "../config/database.js";

const NOTIFICATION_TYPES = [
  "GENERAL",
  "PAYMENT_REMINDER",
  "PAYMENT_SUBMITTED",
  "PAYMENT_VERIFIED",
  "PAYMENT_REJECTED",
  "LOTTERY_RESULT",
  "DRAW",
  "PAYOUT",
  "SYSTEM",
];

// Admin: get Equbs that can be targeted.
export const getNotificationEqubs = async (req, res, next) => {
  try {
    const equbs = await prisma.equb.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });

    res.status(200).json({ equbs });
  } catch (error) {
    next(error);
  }
};

// Admin: get active members from one or more selected Equbs.
// A user belonging to multiple selected Equbs appears only once.
export const getNotificationTargets = async (req, res, next) => {
  try {
    const rawEqubIds = req.query.equbIds;

    const equbIds = [
      ...new Set(
        (Array.isArray(rawEqubIds) ? rawEqubIds : [rawEqubIds])
          .filter(Boolean)
          .flatMap((value) => String(value).split(","))
          .map((id) => id.trim())
          .filter(Boolean)
      ),
    ];

    if (equbIds.length === 0) {
      return res.status(400).json({
        message: "Select at least one Equb.",
      });
    }

    const memberships = await prisma.equbMembership.findMany({
      where: {
        equbId: { in: equbIds },
        status: "ACTIVE",
        user: { isActive: true },
      },
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        equb: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const targetMap = new Map();

    for (const membership of memberships) {
      if (!targetMap.has(membership.userId)) {
        targetMap.set(membership.userId, {
          ...membership.user,
          equbs: [],
        });
      }

      const target = targetMap.get(membership.userId);

      if (!target.equbs.some((equb) => equb.id === membership.equb.id)) {
        target.equbs.push(membership.equb);
      }
    }

    res.status(200).json({
      members: [...targetMap.values()],
    });
  } catch (error) {
    next(error);
  }
};

// Admin: send an in-app notification to all active members
// or a selected subset of active members in selected Equbs.
export const sendNotification = async (req, res, next) => {
  try {
    const {
      title,
      message,
      type = "GENERAL",
      equbIds,
      recipientMode,
      userIds = [],
    } = req.body;

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({
        message: "Title and message are required.",
      });
    }

    if (title.trim().length > 150) {
      return res.status(400).json({
        message: "Title cannot exceed 150 characters.",
      });
    }

    if (message.trim().length > 5000) {
      return res.status(400).json({
        message: "Message cannot exceed 5000 characters.",
      });
    }

    if (!NOTIFICATION_TYPES.includes(type)) {
      return res.status(400).json({
        message: "Invalid notification type.",
      });
    }

    const selectedEqubIds = [
      ...new Set(
        (Array.isArray(equbIds) ? equbIds : [])
          .filter((id) => typeof id === "string" && id.trim())
          .map((id) => id.trim())
      ),
    ];

    if (selectedEqubIds.length === 0) {
      return res.status(400).json({
        message: "Select at least one Equb.",
      });
    }

    if (!["ALL", "SPECIFIC"].includes(recipientMode)) {
      return res.status(400).json({
        message: 'recipientMode must be "ALL" or "SPECIFIC".',
      });
    }

    if (
      recipientMode === "SPECIFIC" &&
      (!Array.isArray(userIds) || userIds.length === 0)
    ) {
      return res.status(400).json({
        message: "Select at least one member.",
      });
    }

    // Check that every submitted Equb ID exists.
    const existingEqubs = await prisma.equb.findMany({
      where: { id: { in: selectedEqubIds } },
      select: { id: true },
    });

    if (existingEqubs.length !== selectedEqubIds.length) {
      return res.status(400).json({
        message: "One or more selected Equbs do not exist.",
      });
    }

    // Only active memberships and active user accounts qualify.
    const memberships = await prisma.equbMembership.findMany({
      where: {
        equbId: { in: selectedEqubIds },
        status: "ACTIVE",
        user: { isActive: true },
        ...(recipientMode === "SPECIFIC"
          ? { userId: { in: [...new Set(userIds)] } }
          : {}),
      },
      select: { userId: true },
    });

    // Deduplicate users across all selected Equbs.
    const recipientUserIds = [
      ...new Set(memberships.map((membership) => membership.userId)),
    ];

    if (recipientUserIds.length === 0) {
      return res.status(400).json({
        message:
          "No active members match your recipient selection.",
      });
    }

    // Save the announcement and all recipients together.
    const notification = await prisma.notification.create({
      data: {
        title: title.trim(),
        message: message.trim(),
        type,
        createdById: req.user.userId,

        equbs: {
          create: selectedEqubIds.map((equbId) => ({
            equbId,
          })),
        },

        recipients: {
          create: recipientUserIds.map((userId) => ({
            userId,
          })),
        },
      },
      select: {
        id: true,
        title: true,
        message: true,
        type: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      message: "Notification sent successfully.",
      notification,
      recipientCount: recipientUserIds.length,
    });
  } catch (error) {
    next(error);
  }
};

// User: get notification history.
export const getMyNotifications = async (req, res, next) => {
  try {
    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 20, 1),
      100
    );

    const cursor = req.query.cursor;

    const notifications = await prisma.notificationRecipient.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        isRead: true,
        readAt: true,
        createdAt: true,
        notification: {
          select: {
            id: true,
            title: true,
            message: true,
            type: true,
            createdAt: true,
          },
        },
      },
    });

    const hasMore = notifications.length > limit;
    const items = hasMore ? notifications.slice(0, limit) : notifications;

    res.status(200).json({
      notifications: items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    });
  } catch (error) {
    next(error);
  }
};

// User: get unread notification count.
export const getUnreadNotificationCount = async (req, res, next) => {
  try {
    const count = await prisma.notificationRecipient.count({
      where: {
        userId: req.user.userId,
        isRead: false,
      },
    });

    res.status(200).json({ count });
  } catch (error) {
    next(error);
  }
};

// User: mark one notification as read.
export const markNotificationAsRead = async (req, res, next) => {
  try {
    const { recipientId } = req.params;

    const result = await prisma.notificationRecipient.updateMany({
      where: {
        id: recipientId,
        userId: req.user.userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    if (result.count === 0) {
      const existing = await prisma.notificationRecipient.findFirst({
        where: {
          id: recipientId,
          userId: req.user.userId,
        },
        select: { id: true },
      });

      if (!existing) {
        return res.status(404).json({
          message: "Notification not found.",
        });
      }
    }

    res.status(200).json({
      message: "Notification marked as read.",
    });
  } catch (error) {
    next(error);
  }
};

// User: mark all notifications as read.
export const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    const result = await prisma.notificationRecipient.updateMany({
      where: {
        userId: req.user.userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    res.status(200).json({
      message: "Notifications marked as read.",
      updatedCount: result.count,
    });
  } catch (error) {
    next(error);
  }
};

// Admin: view previously sent announcements.
export const getNotificationHistory = async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        equbs: {
          select: {
            equb: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: { recipients: true },
        },
      },
    });

    res.status(200).json({ notifications });
  } catch (error) {
    next(error);
  }
};
