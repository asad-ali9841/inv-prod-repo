const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define Counter Schema
const CounterSchema = new Schema({
  _id: { type: String, required: true }, // e.g., "productId"
  sequenceValue: { type: Number, default: 0 }, // Changed from sequence_value to sequenceValue
});

// Create Counter Model
const Counter = mongoose.model('Counter', CounterSchema);

module.exports = Counter;
