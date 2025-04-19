const mongoose = require('mongoose');

const pointsSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Point title is required'],
        trim: true,
    },
    detail: {
        type: String,
        required: [true, 'Point detail is required'],
        trim: true,
    },
});

const sectionsSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Section title is required'],
        trim: true,
    },
    image: {
        type: String,
        required: [true, 'Section image is required'],
        trim: true,
        validate: {
            validator: function (v) {
                // Basic URL validation for image path
                return /^(http|https):\/\/|^\/|^[^\/]/.test(v);
            },
            message: props => `${props.value} is not a valid image path or URL`
        }
    },
    points: {
        type: [pointsSchema],
        validate: {
            validator: function (v) {
                return v.length > 0;
            },
            message: 'At least one point is required in a section',
        },
    },
});

const servicedetailsSchema = new mongoose.Schema(
    {
        relatedServices: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Service',
            required: [true, 'Related service is required'],
        },
        description: {
            type: String,
            required: [true, 'Description is required'],
            trim: true,
        },
        sections: {
            type: [sectionsSchema],
            validate: {
                validator: function (v) {
                    return v.length > 0;
                },
                message: 'At least one section is required',
            },
        },
    },
    {
        timestamps: true,
    }
);

const ServiceDetails = mongoose.models.ServiceDetails || mongoose.model('ServiceDetails', servicedetailsSchema);

module.exports = ServiceDetails;