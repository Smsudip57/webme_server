const express = require("express");
const router = express.Router();
const {
  getAllIndustries,
  getSingleIndustry,
} = require("../controllers/industries");

// GET all industries
router.get("/industry/get", getAllIndustries);

// GET single industry by ID or SLUG with ALL related data
router.get("/industry/get/:idOrSlug", getSingleIndustry);

module.exports = router;
