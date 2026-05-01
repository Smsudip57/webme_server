const express = require("express");
const router = express.Router();
const {
    getAllServices,
    getSingleService,
    createService,
    editService,
    deleteService,
} = require("../controllers/services");

// GET all services
router.get("/service/get", getAllServices);

// GET single service by ID or SLUG with ALL related data
router.get("/service/get/:idOrSlug", getSingleService);

// CREATE a new service
router.post("/service/create", express.json(), createService);

// EDIT an existing service
router.post("/service/edit", express.json(), editService);

// DELETE a service
router.post("/service/delete", express.json(), deleteService);

module.exports = router;
