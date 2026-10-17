
import express from "express";

import { protect } from "../middleware/auth.middleware.js";

import {
  getNotificationEqubs,
  getNotificationTargets,
  sendNotification,
  getMyNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getNotificationHistory,
} from "../controllers/notificationController.js";

const router = express.Router();

router.use(protect);

const adminOnly = (req, res, next) => {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({
      message: "Admin access required.",
    });
  }

  next();
};

// Admin routes
router.get("/admin/equbs", adminOnly, getNotificationEqubs);
router.get("/admin/targets", adminOnly, getNotificationTargets);
router.get("/admin/history", adminOnly, getNotificationHistory);
router.post("/admin/send", adminOnly, sendNotification);

// Current user's notification routes
router.get("/unread-count", getUnreadNotificationCount);
router.get("/", getMyNotifications);
router.patch("/read-all", markAllNotificationsAsRead);
router.patch("/:recipientId/read", markNotificationAsRead);

export default router;
