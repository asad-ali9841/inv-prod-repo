const mongoose = require('mongoose');

const ABCClassSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    description: {
        type: String, // Not required in any case.
    },
    warehouse: {
        _id: {
            type: String,
            required: function () {
                return this.status !== "draft";
            },
        },
        name: {
            type: String,
            required: function () {
                return this.status !== "draft";
            },
        },
    },
    isDualDimension: {
        type: Boolean,
        required: function () {
            return this.status !== "draft";
        },
    },
    dimension1: {
        type: String,
        required: function () {
            return this.status !== "draft"
        },
    },
    dimension2: {
        type: String,
        required: function () {
            return this.status !== "draft" && this.isDualDimension;
        },
    },
    priority: {
        type: String, // Not required in any case.
    },
    zone: {
        type: String, // Not required in any case.
    },
    category: {
        type: String, // Not required in any case.
    },
    categories: {
        type: [String], // Not required in any case.
    },
    classes: {
        type: String,
        required: function () {
            return this.status !== "draft";
        },
    },
    proportions: {
        type: [Number],
        validate: {
            validator: function (value) {
                if (this.status === "draft") return true; // Skip validation for "draft".
                return value && value.length > 0;
            },
            message: 'Proportions cannot be empty',
        },
        required: function () {
            return this.status !== "draft";
        },
    },
    rrule: {
        type: String,
        required: function () {
            return this.status !== "draft";
        },
    },
    status: {
        type: String,
        enum: ["active", "deactivated", "draft", "deleted"],
        default: "draft",
    },
    createdAt: {
        type: Number,
        default: () => Date.now(),
    },
    updatedAt: {
        type: Number,
        default: () => Date.now(),
    },
    activity: {
        type: Array,
        default: [],
    },
});

ABCClassSchema.pre("findOneAndUpdate", async function (next) {
    const docToUpdate = await this.model.findOne(this.getQuery());
    
    // Merge the update data with the current document data
    const updatedData = docToUpdate.toObject();
    let newStatus = updatedData.status;
    if(this.getUpdate().$set.status) newStatus = this.getUpdate().$set.status
    if(newStatus && newStatus === 'active'){
        updatedData.status = newStatus;
        const tempDoc = new this.model(updatedData);
        await tempDoc.validate();
    }
    this.set({ updatedAt: Date.now() });
    next();
});

module.exports = mongoose.model('ABCClassificatonModel', ABCClassSchema);
