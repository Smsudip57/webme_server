const express = require("express");
const router = express.Router();
const {
  getAllParentServices,
  getSingleParentService,
} = require("../controllers/parentServices");

// GET all parent services
router.get("/parentservice/get", getAllParentServices);

// GET single parent service by ID or SLUG with ALL related data
router.get("/parentservice/get/:idOrSlug", getSingleParentService);

module.exports = router;
