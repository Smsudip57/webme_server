const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    oddo_id: { type: Number },
    name: { type: String, required: true },
    phoneNumber: { type: String },
    address: { type: String },
    pincode: { type: String },
    amount: { type: Number, required: true },
    paymentId: { type: String, required: true, unique: true }, // Ziina payment intent ID
    email: { type: String },
    userid: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    products: [
      {
        product_id: { type: Number, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        total_amount: { type: Number, required: true },
        website_product_id: { type: String, required: true },
      },
    ],
    status: {
      type: String,
      enum: ["pending", "confirmed", "failed", "cancelled"],
      default: "pending",
    },
    quatation_log: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    expiresAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Transaction", transactionSchema);
