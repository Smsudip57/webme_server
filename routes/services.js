const express = require("express");
const router = express.Router();
const {
    getAllServices,
    getSingleService,
} = require("../controllers/services");

// GET all services
router.get("/service/get", getAllServices);

// GET single service by ID or SLUG with ALL related data
router.get("/service/get/:idOrSlug", getSingleService);

module.exports = router;
