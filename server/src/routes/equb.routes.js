import express from "express";

import {
createEqub,
getEqubs,
getEqubById,
getEqubPeriods,
updateEqub,
deleteEqub,
} from "../controllers/equb.controller.js";

import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

/*

* Create a new Equb
*
* ADMIN only inside the controller
  */
  router.post(
  "/",
  protect,
  createEqub
  );

/*

* Get Equbs
*
* ADMIN       -> their own Equbs
* MEMBER      -> ACTIVE Equbs
* SUPER_ADMIN -> all Equbs
  */
  router.get(
  "/",
  protect,
  getEqubs
  );

/*

* Get Payment Periods for an Equb
*
* ADMIN       -> only their own Equb
* SUPER_ADMIN -> any Equb
  */
  router.get(
  "/:id/periods",
  protect,
  getEqubPeriods
  );

/*

* Get one Equb
  */
  router.get(
  "/:id",
  protect,
  getEqubById
  );

/*

* Update an Equb
*
* ADMIN       -> only Equbs they created
* SUPER_ADMIN -> any Equb
  */
  router.patch(
  "/:id",
  protect,
  updateEqub
  );

/*

* Delete an Equb
*
* ADMIN       -> only Equbs they created
* SUPER_ADMIN -> any Equb
  */
  router.delete(
  "/:id",
  protect,
  deleteEqub
  );

export default router;
