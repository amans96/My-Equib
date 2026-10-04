import {
  getOrCreateLottery,
  getLotteryMembers,
  prepareLottery,
  addMemberToLottery,
  removeMemberFromLottery,
  removePreviousWinners,
  startLottery,
  drawLotteryWinner,
  getLotteryHistory,
} from "../services/lottery.service.js";

/*
 * GET /api/payment-periods/:periodId/lottery
 *
 * Get the current lottery room.
 */
export const getLottery = async (req, res) => {
  try {
    const { periodId } = req.params;

    const result = await getOrCreateLottery(periodId);

    return res.status(200).json({
      success: true,
      message: "Lottery loaded successfully",
      data: result,
    });
  } catch (error) {
    console.error("Get lottery error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to load lottery",
    });
  }
};

/*
 * GET /api/payment-periods/:periodId/lottery/members
 *
 * Get all active Equb members and their lottery eligibility.
 */
export const getLotteryMembersController = async (req, res) => {
  try {
    const { periodId } = req.params;

    const result = await getLotteryMembers(periodId);

    return res.status(200).json({
      success: true,
      message: "Lottery members loaded successfully",
      data: result,
    });
  } catch (error) {
    console.error("Get lottery members error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to load lottery members",
    });
  }
};

/*
 * POST /api/payment-periods/:periodId/lottery/prepare
 *
 * Automatically add members whose payment is VERIFIED.
 */
export const prepareLotteryController = async (req, res) => {
  try {
    const { periodId } = req.params;

    const result = await prepareLottery(periodId);

    return res.status(200).json({
      success: true,
      message: "Lottery prepared successfully",
      data: result,
    });
  } catch (error) {
    console.error("Prepare lottery error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to prepare lottery",
    });
  }
};

/*
 * POST /api/payment-periods/:periodId/lottery/members/:membershipId
 *
 * Manually add a member to the lottery.
 */
export const addLotteryMemberController = async (req, res) => {
  try {
    const { periodId, membershipId } = req.params;

    const result = await addMemberToLottery({
      periodId,
      membershipId,
      entryType: "MANUAL",
    });

    return res.status(201).json({
      success: true,
      message: "Member added to lottery successfully",
      data: result,
    });
  } catch (error) {
    console.error("Add lottery member error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to add member to lottery",
    });
  }
};

/*
 * DELETE /api/payment-periods/:periodId/lottery/members/:membershipId
 *
 * Remove a member from the current lottery pool.
 *
 * Their entries are NOT deleted.
 * They are simply marked as ineligible.
 */
export const removeLotteryMemberController = async (req, res) => {
  try {
    const { periodId, membershipId } = req.params;

    const result = await removeMemberFromLottery({
      periodId,
      membershipId,
    });

    return res.status(200).json({
      success: true,
      message: "Member removed from lottery successfully",
      data: result,
    });
  } catch (error) {
    console.error("Remove lottery member error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to remove member from lottery",
    });
  }
};

/*
 * DELETE /api/payment-periods/:periodId/lottery/previous-winners
 *
 * Remove all previous winners of this Equb
 * from the current lottery pool.
 */
export const removePreviousWinnersController = async (req, res) => {
  try {
    const { periodId } = req.params;

    const result = await removePreviousWinners(periodId);

    return res.status(200).json({
      success: true,
      message: "Previous winners removed from lottery successfully",
      data: result,
    });
  } catch (error) {
    console.error("Remove previous winners error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to remove previous winners",
    });
  }
};

/*
 * POST /api/payment-periods/:periodId/lottery/start
 *
 * Freeze the lottery pool and start the draw.
 */
export const startLotteryController = async (req, res) => {
  try {
    const { periodId } = req.params;

    const result = await startLottery(periodId);

    return res.status(200).json({
      success: true,
      message: "Lottery started successfully",
      data: result,
    });
  } catch (error) {
    console.error("Start lottery error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to start lottery",
    });
  }
};

/*
 * POST /api/payment-periods/:periodId/lottery/draw
 *
 * Select the winner.
 *
 * The backend chooses the winner.
 * The frontend should only animate the result.
 */
export const drawLotteryWinnerController = async (req, res) => {
  try {
    const { periodId } = req.params;

    const result = await drawLotteryWinner(periodId);

    return res.status(200).json({
      success: true,
      message: "Lottery winner selected successfully",
      data: result,
    });
  } catch (error) {
    console.error("Draw lottery winner error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to draw lottery winner",
    });
  }
};

/*
 * GET /api/equbs/:equbId/lottery/history
 *
 * Get previous lottery draws for an Equb.
 */
export const getLotteryHistoryController = async (req, res) => {
  try {
    const { equbId } = req.params;

    const result = await getLotteryHistory(equbId);

    return res.status(200).json({
      success: true,
      message: "Lottery history loaded successfully",
      data: result,
    });
  } catch (error) {
    console.error("Get lottery history error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to load lottery history",
    });
  }
};