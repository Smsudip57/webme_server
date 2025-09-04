const mongoose = require("mongoose");

const QASchema = new mongoose.Schema({
    question: { type: String, required: true },
    answer: { type: String, required: true }
});

const faqSchema = new mongoose.Schema({
    title: { type: String, required: true },
    questions: [QASchema],
    relatedServices: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service'
    }],
    relatedIndustries: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Industry'
    }],
    relatedProducts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Parentservice'
    }],
    relatedChikfdServices: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Childservices'
    }],
}, { timestamps: true });

const Faq = mongoose.models.Faq || mongoose.model("Faq", faqSchema);

module.exports = Faq;