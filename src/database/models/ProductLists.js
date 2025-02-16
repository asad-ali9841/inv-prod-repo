const mongoose = require('mongoose');
const DataItemSchema = new mongoose.Schema({
  label: { type: String, required: true },
  value: { type: String, required: true, unique: true }
}, { _id: false });

const ProductListsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  hasLabelValue: {type: Boolean, required: true},
  data: {
    type: [String],
    default: []
  },
  labelValue: {
    type: [DataItemSchema],
    default: []
  },
  status: {
    type: String,
    enum: ['show', 'hide'],
    required: true
  },
  activity: [],
  createdAt: { type: Number, required: true, default: Date.now },
  updatedAt: { type: Number, required: true, default: Date.now },
});

// Optional: Update `updatedAt` on every save
ProductListsSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

ProductListsSchema.index({ key: 1 });

const ProductListsModel = mongoose.model('ProductLists', ProductListsSchema);

module.exports = ProductListsModel;
