import express from "express";

import {
  getLottery,
  getLotteryMembersController,
  prepareLotteryController,
  addLotteryMemberController,
  removeLotteryMemberController,
  removePreviousWinnersController,
  startLotteryController,
  drawLotteryWinnerController,
  getLotteryHistoryController,
} from "../controllers/lottery.controller.js";

import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

/*
 * Get the current lottery room
 *
 * GET /api/payment-periods/:periodId/lottery
 */
router.get(
  "/payment-periods/:periodId/lottery",
  protect,
  getLottery
);

/*
 * Get all active members and their lottery eligibility
 *
 * GET /api/payment-periods/:periodId/lottery/members
 */
router.get(
  "/payment-periods/:periodId/lottery/members",
  protect,
  getLotteryMembersController
);

/*
 * Automatically add all members whose payment is VERIFIED
 *
 * POST /api/payment-periods/:periodId/lottery/prepare
 */
router.post(
  "/payment-periods/:periodId/lottery/prepare",
  protect,
  prepareLotteryController
);

/*
 * Manually add a member to the lottery
 *
 * POST /api/payment-periods/:periodId/lottery/members/:membershipId
 */
router.post(
  "/payment-periods/:periodId/lottery/members/:membershipId",
  protect,
  addLotteryMemberController
);

/*
 * Remove a member from the lottery pool
 *
 * DELETE /api/payment-periods/:periodId/lottery/members/:membershipId
 */
router.delete(
  "/payment-periods/:periodId/lottery/members/:membershipId",
  protect,
  removeLotteryMemberController
);

/*
 * Remove all previous winners from the current lottery pool
 *
 * DELETE /api/payment-periods/:periodId/lottery/previous-winners
 */
router.delete(
  "/payment-periods/:periodId/lottery/previous-winners",
  protect,
  removePreviousWinnersController
);

/*
 * Freeze the lottery pool and start the lottery
 *
 * POST /api/payment-periods/:periodId/lottery/start
 */
router.post(
  "/payment-periods/:periodId/lottery/start",
  protect,
  startLotteryController
);

/*
 * Select the winner
 *
 * POST /api/payment-periods/:periodId/lottery/draw
 */
router.post(
  "/payment-periods/:periodId/lottery/draw",
  protect,
  drawLotteryWinnerController
);

/*
 * Get lottery history for an Equb
 *
 * GET /api/equbs/:equbId/lottery/history
 */
router.get(
  "/equbs/:equbId/lottery/history",
  protect,
  getLotteryHistoryController
);

export default router;