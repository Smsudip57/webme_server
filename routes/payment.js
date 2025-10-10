const express = require("express");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const User = require("../models/user");
const Service = require("../models/service");
const ParentService = require("../models/Parentservice");
const ChildService = require("../models/childService");
const Project = require("../models/project");
const Testimonial = require("../models/testimonial");
const Industry = require("../models/industry");
const Transaction = require("../models/transactions");
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const blog = require("../models/blog");
const Blog = require("../models/blog");
const KnowledgeBase = require("../models/knowledgebase");
const Faq = require("../models/faq");
const ServiceDetails = require("../models/servicedetails");
const { auth } = require("./user");

const verifyZiinaSignature = (rawBody, signature, secret) => {
  if (!signature || !secret) {
    return false;
  }

  try {
    // Compute HMAC-SHA256 of the raw request body
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody, "utf8")
      .digest("hex");

    // Compare signatures using secure comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  } catch (error) {
    return false;
  }
};

const ZiinaPay = async (data) => {
  try {
    // Create payment intent with Ziina API
    const paymentData = {
      amount: data.amount * 100,
      currency_code: "AED",
      message: `Order payment for ${data.name}`,
      success_url: `${process.env.Client_Url}/payment/success`,
      cancel_url: `${process.env.Client_Url}/payment/cancel`,
      failure_url: `${process.env.Client_Url}/payment/failure`,
      test: process.env.NODE_ENV !== "production",
      expiry: (Date.now() + 24 * 60 * 60 * 1000).toString(),
      allow_tips: false,
    };

    const options = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ZIINA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paymentData),
    };

    // Call Ziina API
    const response = await fetch(
      "https://api-v2.ziina.com/api/payment_intent",
      options
    );
    const paymentIntent = await response.json();

    if (!response.ok) {
      throw new Error(
        `Ziina API error: ${
          paymentIntent.message || "Payment intent creation failed"
        }`
      );
    }

    // Create pending transaction in database
    const transaction = new Transaction({
      name: data.name,
      phoneNumber: data.phoneNumber,
      address: data.address,
      pincode: data.pincode,
      amount: data.amount,
      paymentId: paymentIntent.id, // Use Ziina payment intent ID
      email: data.email,
      userid: data.userid,
      products: data.products,
      status: "pending",
      quatation_log: data.quatation_log || {},
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expire in 24 hours
    });

    const savedTransaction = await transaction.save();

    // Return payment URL and transaction info
    const result = {
      success: true,
      paymentUrl: paymentIntent.redirect_url, // Ziina uses redirect_url, not payment_url
      orderId: savedTransaction._id,
      paymentIntentId: paymentIntent.id,
      message: "Payment intent created successfully",
    };

    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: "Something went wrong",
    };
  }
};

const ZiinaHook = async (req, res) => {
  try {
    const clientIP =
      req.headers["x-real-ip"] ||
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim();

    // Ziina authorized IP addresses
    const allowedIPs = ["3.29.184.186", "3.29.190.95", "20.233.47.127"];

    // Validate IP address
    if (!clientIP || !allowedIPs.includes(clientIP)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Invalid IP address",
      });
    }

    const event = req.body;
    const signature = req.headers["x-hmac-signature"];
    const rawBody = req.rawBody || JSON.stringify(req.body);

    // Verify webhook signature if secret key is configured
    if (ZIINA_SECRET_KEY) {
      if (!signature) {
        return res.status(401).json({
          success: false,
          message: "Missing signature header",
        });
      }

      const isValidSignature = verifyZiinaSignature(
        rawBody,
        signature,
        ZIINA_SECRET_KEY
      );

      if (!isValidSignature) {
        return res.status(401).json({
          success: false,
          message: "Invalid signature",
        });
      }
    }

    if (
      event.event === "payment_intent.status.updated" &&
      event.data &&
      event.data.id &&
      event.data.status
    ) {
      const paymentData = event.data;

      // Find the transaction by payment ID
      const transaction = await Transaction.findOne({
        paymentId: paymentData.id,
      });

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: "Transaction not found",
        });
      }

      let newStatus;
      let shouldRemoveExpiry = false;

      switch (paymentData.status) {
        case "completed":
        case "succeeded":
          newStatus = "confirmed";
          shouldRemoveExpiry = true;
          break;

        case "failed":
          newStatus = "failed";
          shouldRemoveExpiry = true;
          break;

        case "cancelled":
          newStatus = "cancelled";
          shouldRemoveExpiry = true;
          break;

        default:
          return res.status(200).json({
            success: true,
            message: "Status not handled",
          });
      }

      // Update transaction status
      const updateData = { status: newStatus };

      // Remove expiry for completed payments (success, failed, cancelled)
      if (shouldRemoveExpiry) {
        updateData.$unset = { expiresAt: 1 };
      }

      const updatedTransaction = await Transaction.findByIdAndUpdate(
        transaction._id,
        updateData,
        { new: true }
      );

      if (newStatus === "confirmed") {
        try {
          await fetch(`http://erp.webmedigital.com/hook/transaction`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "erp-secret-key": process.env.ERP_COMMUNICATION_SECRET_KEY,
            },
            body: JSON.stringify({
              email: updatedTransaction.email,
              odoo_id: updatedTransaction.oddo_id,
              status: newStatus,
            }),
          });
        } catch (erpError) {
          console.error("Failed to update ERP quotation:", erpError);
        }
      }
      return res.status(200).json({
        success: true,
        message: "Transaction updated successfully",
        orderId: updatedTransaction._id,
        status: updatedTransaction.status,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook payload",
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      message: "Webhook processing failed",
    });
  }
};

router.post("/create", auth, async (req, res) => {
  try {
    const { _id, email, profile } = req.user;
    const { odoo_id } = req.body;
    if (!odoo_id) {
      return res.status(400).json({
        success: false,
        message: "Odoo ID is required",
      });
    }
    try {
      const erpRes = await fetch(
        `http://erp.webmedigital.com/get/quotation?email=${encodeURIComponent(
          email
        )}`,
        {
          method: "GET",
          headers: {
            "erp-secret-key": process.env.ERP_COMMUNICATION_SECRET_KEY,
          },
        }
      );
      if (erpRes.ok) {
        const erpData = await erpRes.json();
        if (erpData?.quotation && Array.isArray(erpData?.quotation)) {
          const targetData = erpData.quotation?.find(
            (item) => item.odoo_id === odoo_id
          );
          if (!targetData) {
            return res.status(400).json({
              success: false,
              message: "something went wrong",
            });
          }
          const data = {
            name: targetData.name,
            phoneNumber: profile.phoneNumber,
            address: profile.address,
            pincode: profile?.pincode,
            amount: targetData.amount_total,
            email: email,
            userid: _id,
            products: targetData?.order_line,
            quatation_log: targetData,
          };
          const result = await ZiinaPay(data);
          if (result.success) {
            res.status(201).json({
              success: true,
              paymentUrl: result.paymentUrl,
              orderId: result.orderId,
              paymentIntentId: result.paymentIntentId,
              message: result.message,
            });
          } else {
            res.status(400).json({
              success: false,
              error: result.error,
              message: result.message,
            });
          }
        } else {
          return res.status(400).json({
            success: false,
            message: "something went wrong",
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: "something went wrong",
        });
      }
    } catch (erpError) {
      console.error("Failed to fetch notifications from ERP system:", erpError);
      // Do not block notifications if ERP call fails
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Internal server error",
    });
  }
});

router.post("/webhook/ziina", (req, res) => {
  try {
    ZiinaHook(req, res);
  } catch (error) {
    console.error("Failed to process webhook:", error);
    res.status(400).json({
      success: false,
      message: "Webhook processing failed",
    });
  }
});

module.exports = router;
