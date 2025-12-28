const express = require("express");
const router = express.Router();
const {
  getAllChildServices,
  getSingleChildService,
} = require("../controllers/childServices");

// GET all child services
router.get("/childservice/get", getAllChildServices);

// GET single child service by ID or SLUG with ALL related data
router.get("/childservice/get/:idOrSlug", getSingleChildService);

module.exports = router;
