import express from "express";

import {
requestToJoinEqub,
getPendingMemberships,
approveMembership,
rejectMembership,
getMyMemberships,
getEqubMembers,
} from "../controllers/membership.controller.js";

import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post(
"/equbs/:equbId/join",
protect,
requestToJoinEqub
);

router.get(
"/equbs/:equbId/members/pending",
protect,
getPendingMemberships
);

router.get(
"/equbs/:equbId/members",
protect,
getEqubMembers
);

router.patch(
"/memberships/:membershipId/approve",
protect,
approveMembership
);

router.patch(
"/memberships/:membershipId/reject",
protect,
rejectMembership
);

router.get(
"/memberships/my",
protect,
getMyMemberships
);

export default router;
