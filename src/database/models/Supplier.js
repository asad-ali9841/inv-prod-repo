const mongoose = require("mongoose");
const {
  SUPPLIER_STATUSES,
  SUPPLIER_VALID_STATUS_TRANSITIONS,
} = require("../../utils/constants");

// Helper function to determine if the status is not 'draft'
const isNotDraft = function () {
  if (this.status) return this.status !== "draft";
  return this.getUpdate().$set.status !== "draft";
};

function validateAddress(v, status) {
  if (status === SUPPLIER_STATUSES.ACTIVE) {
    if (!v) return ["Address is required."];

    const errors = [];
    if (!v.addressLine1) errors.push("Address Line 1 is required.");
    if (!v.city) errors.push("City is required.");
    if (!v.state) errors.push("State is required.");
    if (!v.zipCode) errors.push("Zip Code is required.");
    if (!v.country) errors.push("Country is required.");

    return errors.length === 0 || errors; // Return true if no errors, otherwise return errors
  }

  return true; // Skip validation for other statuses
}

// Address Schema with Custom Validators
const addressSchema = new mongoose.Schema({
  addressLine1: {
    type: String,
    trim: true,
    default: "",
  },
  addressLine2: {
    type: String,
    trim: true,
    default: "",
  },
  city: {
    type: String,
    trim: true,
    default: "",
  },
  state: {
    type: String,
    trim: true,
    default: "",
  },
  zipCode: {
    type: String,
    trim: true,
    default: "",
  },
  country: {
    type: String,
    trim: true,
    default: "Australia",
    // Uncomment and adjust enum as needed
    // enum: ['USA', 'Canada', 'UK', 'Australia', 'Other'],
  },
  lat: {
    type: Number,
    default: 0,
  },
  lng: {
    type: Number,
    default: 0,
  },
});

// Supplier Schema with Custom Validators
const SupplierSchema = new mongoose.Schema({
  customId: {
    type: String,
    trim: true,
    // Custom validator to enforce requirement based on status
    validate: {
      validator: function (v) {
        if (isNotDraft.call(this)) {
          return v != null && v.trim().length > 0;
        }
        return true;
      },
      message: "Custom Id is required",
    },
  },
  name: {
    type: String,
    required: [true, "Name is required."],
    trim: true,
    unique: true,
  },
  website: {
    type: String,
    trim: true,
    default: "",
    validate: {
      validator: function (v) {
        if (!v) return true; // Pass validation if empty
        return /^https?:\/\/[^\s$.?#].[^\s]*$/.test(v); // URL validation
      },
      message: (props) => `${props.value} is not a valid URL!`,
    },
  },
  type: {
    type: String,
    enum: ["Company", "Individual", ""], // Limit to specific types
    // default: 'Other', // Uncomment if you want a default value
    validate: {
      validator: function (v) {
        if (isNotDraft.call(this)) {
          return (
            v != null &&
            v.trim().length > 0 &&
            ["Company", "Individual"].includes(v)
          );
        }
        return true;
      },
      message: "Supplier type is required",
    },
  },
  billingAddress: {
    type: addressSchema,
  },
  shippingAddress: {
    type: addressSchema,
  },
  contactInfo: [
    {
      firstName: {
        type: String,
        trim: true,
      },
      lastName: {
        type: String,
        trim: true,
      },
      jobTitle: {
        type: String,
        trim: true,
      },
      email: {
        type: String,
        trim: true,
        default: "",
        validate: {
          validator: function (v) {
            if (!v) return true; // Pass validation if empty
            // eslint-disable-next-line no-useless-escape
            return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v); // Email validation
          },
          message: (props) => `${props.value} is not a valid email!`,
        },
      },
      workPhoneNumber: {
        cc: {
          type: String,
          // Add validation if needed
          // Example:
          // validate: {
          //   validator: function (v) {
          //     return /^[+][0-9]{1,3}$/.test(v); // Country code format validation
          //   },
          //   message: props => `${props.value} is not a valid country code!`,
          // },
        },
        number: {
          type: String,
          // Add validation if needed
          // Example:
          // validate: {
          //   validator: function (v) {
          //     return /^[0-9]{10}$/.test(v); // 10-digit phone number
          //   },
          //   message: props => `${props.value} is not a valid phone number!`,
          // },
        },
      },
      mobilePhoneNumber: {
        cc: {
          type: String,
          // Add validation if needed
        },
        number: {
          type: String,
          // Add validation if needed
        },
      },
    },
  ],
  currency: {
    label: { type: String, required: [true, "Currency label is required."] },
    value: { type: String, required: [true, "Currency value is required."] },
  },
  paymentTerms: {
    type: String,
    trim: true,
    default: "",
    validate: {
      validator: function (v) {
        if (isNotDraft.call(this)) {
          return v != null && v.trim().length > 0;
        }
        return true;
      },
      message: "Payment terms is required",
    },
  },
  status: {
    type: String,
    enum: Object.values(SUPPLIER_STATUSES), // Limit status to valid values
    default: SUPPLIER_STATUSES.DRAFT,
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

SupplierSchema.pre("bulkWrite", async function (next) {
  const operations = this.getOperations();

  for (const op of operations) {
    if (op.updateOne || op.updateMany) {
      const update = op.updateOne?.update || op.updateMany?.update;
      const newStatus = update?.status || update?.$set?.status;

      if (newStatus) {
        const doc = await this.model.findOne(
          op.updateOne?.filter || op.updateMany?.filter
        );
        if (!doc) continue;

        const currentStatus = doc.status;
        if (
          currentStatus !== newStatus &&
          !SUPPLIER_VALID_STATUS_TRANSITIONS[currentStatus]?.includes(newStatus)
        ) {
          return next(
            new Error(`Cannot transition from ${currentStatus} to ${newStatus}`)
          );
        }
      }
    }
  }
  next();
});

SupplierSchema.pre(
  ["updateOne", "findOneAndUpdate", "findByIdAndUpdate", "updateMany"],
  async function (next) {
    try {
      const update = this.getUpdate();
      const newStatus = update?.status || update?.$set?.status;

      // Get current document
      const doc = await this.model.findOne(this.getQuery()).lean();

      if (!doc) return next();

      const currentStatus = doc.status;

      // Validate status transitions
      if (
        newStatus &&
        currentStatus !== newStatus &&
        !SUPPLIER_VALID_STATUS_TRANSITIONS[currentStatus]?.includes(newStatus)
      ) {
        return next(
          new Error(`Cannot transition from ${currentStatus} to ${newStatus}`)
        );
      }

      const status = newStatus || currentStatus;

      if (status === SUPPLIER_STATUSES.ACTIVE) {
        const errors = [];

        // Loop through address types
        const addressTypes = ["billingAddress", "shippingAddress"];
        for (const addressType of addressTypes) {
          // Combine current and updated values
          const updatedAddress = Object.assign(
            {},
            doc[addressType],
            update?.[addressType] || update?.$set?.[addressType]
          );

          // Validate address
          if (updatedAddress) {
            const validationErrors = validateAddress(updatedAddress, status);
            if (Array.isArray(validationErrors)) {
              errors.push(
                ...validationErrors.map(
                  (err) =>
                    `${
                      addressType === "shippingAddress"
                        ? "Shipping Address"
                        : "Billing Address"
                    }: ${err}`
                )
              );
            }
          }
        }

        if (errors.length > 0) return next(new Error(errors.join(" ")));
      }

      next();
    } catch (err) {
      next(err);
    }
  }
);

// Create a unique index for 'name'
SupplierSchema.index({ name: 1 }, { unique: true });

// Pre-save Hook for Uniqueness Checks and Timestamps
SupplierSchema.pre("save", async function (next) {
  try {
    if (this.status === SUPPLIER_STATUSES.ACTIVE) {
      // Validate addresses
      const errors = [];
      const addressTypes = ["billingAddress", "shippingAddress"];
      for (const addressType of addressTypes) {
        const address = this[addressType];
        if (address) {
          const validationErrors = validateAddress(address, this.status);
          if (Array.isArray(validationErrors)) {
            errors.push(
              ...validationErrors.map(
                (err) =>
                  `${
                    addressType === "shippingAddress"
                      ? "Shipping Address"
                      : "Billing Address"
                  }: ${err}`
              )
            );
          }
        }
      }
      if (errors.length > 0) return next(new Error(errors.join(" ")));
    }

    if (isNotDraft.call(this)) {
      // Check for existing documents with the same 'customId'
      if (this.customId) {
        const existingCustomId = await this.constructor.findOne({
          customId: this.customId,
          _id: { $ne: this._id },
        });
        if (existingCustomId) {
          return next(new Error("customId must be unique."));
        }
      }
    }

    // Update the 'updatedAt' timestamp
    this.updatedAt = Date.now();
    next();
  } catch (err) {
    next(err);
  }
});

// Pre-update Hook for Uniqueness Checks and Timestamps
SupplierSchema.pre("findOneAndUpdate", async function (next) {
  try {
    const update = this.getUpdate();
    const query = this.getQuery();

    // Determine the new status
    let newStatus = update.$set.status;
    if (!newStatus) {
      // If status is not being updated, fetch the current status
      const docToUpdate = await this.model.findOne(query).select("status");
      if (docToUpdate) {
        newStatus = docToUpdate.status;
      } else {
        return next(new Error("Document not found for update."));
      }
    }

    const isActive = newStatus !== "draft";

    if (isActive) {
      // If 'customId' is being set, ensure it's unique
      let newCustomId = update.$set.customId;
      if (update.$set && update.$set.customId && newCustomId !== "") {
        newCustomId = update.$set.customId;
      }

      if (newCustomId) {
        const existingCustomId = await this.model.findOne({
          customId: newCustomId,
          _id: { $ne: query._id },
        });
        if (existingCustomId) {
          return next(new Error("Custom Id must be unique."));
        }
      }
    }

    // Update the 'updatedAt' timestamp
    if (update.$set) {
      update.$set.updatedAt = Date.now();
    } else {
      update.updatedAt = Date.now();
    }

    next();
  } catch (err) {
    next(err);
  }
});

// Export the Supplier Model
const Supplier = mongoose.model("Supplier", SupplierSchema);
module.exports = Supplier;
