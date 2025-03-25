const jwt = require("jsonwebtoken");
//const { getRedisClient } = require('../database/connection')
//npm run dev
//redisClient = getRedisClient();
const {
  APP_SECRET,
  EXCHANGE_NAME,
  CUSTOMER_SERVICE,
  MSG_QUEUE_URL,
  BUCKET_REGION,
  LOCAL_ACCESS_KEY,
  LOCAL_SECRET_KEY,
  BUCKET_NAME,
  CLOUDFRONT_BASE_URL,
} = require("../config");
const _ = require("lodash");
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
} = require("@aws-sdk/client-s3");
const bwipjs = require("@bwip-js/node");

const s3 = new S3Client({
  region: BUCKET_REGION,
  credentials: {
    accessKeyId: LOCAL_ACCESS_KEY,
    secretAccessKey: LOCAL_SECRET_KEY,
  },
});
/*
            All the helper functions are here to spport the business logics
*/
module.exports.ValidateSignature = async (req) => {
  try {
    const signature = req.get("Authorization");
    const payload = await jwt.verify(signature, APP_SECRET);
    req.user = payload;
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
};

module.exports.changeNameToKey = (name) => {
  return name.replace(/\s+/g, "-");
};

module.exports.createActivityLog = (userInfo, description, status, changes) => {
  return {
    key: userInfo.key,
    email: userInfo.email,
    role: userInfo.key.split("-")[1],
    date: Date.now(),
    description,
    status,
    changes,
  };
};

module.exports.createNewPayload = (original, updated) => {
  const result = { ...original }; // Start with a copy of the original object
  Object.keys(updated).forEach((key) => {
    let newValue = updated[key];
    // Check if the new value is a string that can be parsed into JSON
    if (typeof newValue === "string") {
      try {
        const parsed = JSON.parse(newValue);
        if (typeof parsed === "object" && parsed !== null) {
          newValue = parsed; // Use the parsed object if successful
        }
      } catch (error) {
        // If parsing fails, leave newValue as the original string
      }
    }
    // Update the value only if it has changed
    if (
      !original.hasOwnProperty(key) ||
      JSON.stringify(original[key]) !== JSON.stringify(newValue)
    ) {
      result[key] = newValue;
    }
  });

  return result;
};

module.exports.detectChangesInUpdate = (original, updated) => {
  const changes = [];
  Object.keys(updated).forEach((key) => {
    const hasChanged = original.hasOwnProperty(key)
      ? !_.isEqual(original[key], updated[key])
      : true;
    if (hasChanged) {
      changes.push({
        field: key,
        oldValue: original.hasOwnProperty(key) ? original[key] : undefined,
        newValue: updated[key],
      });
    }
  });

  return changes;
};

module.exports.createImagePaths = (filesArray) => {
  const result = filesArray.map((file) => ({
    path: `${file.destination}/${file.filename}`,
  }));
  return result;
};

module.exports.camelToNormal = (camelStr) => {
  // Regular expression to identify the split positions
  const regex = /(?<!^)(?=[A-Z])/g;

  // Split the string at the identified positions
  const splitWords = camelStr.split(regex);

  // Join the words with spaces and capitalize the first letter
  const normalStr =
    splitWords.join(" ").charAt(0).toUpperCase() +
    splitWords.join(" ").slice(1);

  return normalStr;
};

module.exports.getUniqueKeys = (data, excludeKeys = []) => {
  const keys = new Set();
  data.forEach((item) => {
    Object.keys(item).forEach((key) => {
      if (!excludeKeys.includes(key)) {
        keys.add(key);
      }
    });
  });
  return Array.from(keys);
};

module.exports.formatHeader = (key) => {
  // Replace underscores with spaces
  let header = key.replace(/_/g, " ");
  // Insert space before capital letters (for camelCase)
  header = header.replace(/([A-Z])/g, " $1");
  // Capitalize the first letter
  header = header.charAt(0).toUpperCase() + header.slice(1);
  return header;
};

module.exports.apiPayloadFormat = (status, type, responseMessage, data) => {
  return {
    status, // 1 for success, 0 for error
    type, // success/error/ info / error
    responseMessage, // some description of the response
    data, // data if it is there
  };
};

module.exports.generateNextProductId = (counter) => {
  // Generate the new productId with prefix and zero-padding
  const paddedNumber = counter.toString().padStart(7, "0");
  const productId = `3DL${paddedNumber}`;
  return productId;
};

module.exports.createBarcode = (barcodeType, barcodeValue) =>
  bwipjs.toSVG({
    bcid: barcodeType,
    text: barcodeValue,
    includetext: true,
    height: 11,
    textxalign: "center",
    textyoffset: 2,
    scale: 5,
    scaleX: 5,
    scaleY: 5,
  });

// wrapper function handle try-catch
module.exports.apiPayloadFormat = (status, type, responseMessage, data) => {
  return {
    status, // 1 for success, 0 for error
    type, // success/error/info/error
    responseMessage, // some description of the response
    data, // data if it is there
  };
};

module.exports.errorHandler = (fn) => {
  return async function (...args) {
    try {
      return await fn.apply(this, args);
    } catch (error) {
      console.log("Error:", error);
      let errorMessage = error.message || "Internal server error";

      // Call apiPayloadFormat here
      return module.exports.apiPayloadFormat(
        0,
        "error",
        ["An error occurred", errorMessage],
        {}
      );
    }
  };
};

module.exports.transformArrayToObject = (array, options = {}) => {
  const {
    dateFields = [],
    pluralize = true,
    pluralizeFunction = (key) => key + "s", // Default pluralization by appending 's'
    dateFormatOptions = { year: "numeric", month: "short", day: "2-digit" },
  } = options;

  // Initialize an empty object to collect concatenated values
  const result = {};

  array.forEach((item) => {
    Object.keys(item).forEach((key) => {
      // Determine the pluralized key name
      const pluralKey = pluralize ? pluralizeFunction(key) : key;

      // Initialize the key in the result object if not already present
      if (!result[pluralKey]) {
        result[pluralKey] = [];
      }

      // Retrieve the value
      let value = item[key];

      // Handle date conversion if the key is specified in dateFields
      if (dateFields.includes(key) && typeof value === "number") {
        // Assuming the timestamp is in milliseconds; adjust if in seconds
        const date = new Date(value);
        // Format the date as specified
        value = date.toLocaleDateString("en-US", dateFormatOptions);
      }

      // If the value is an array, flatten it; otherwise, add the single value
      if (Array.isArray(value)) {
        result[pluralKey].push(...value);
      } else {
        result[pluralKey].push(value);
      }
    });
  });

  // Convert arrays to comma-separated strings
  Object.keys(result).forEach((key) => {
    // Remove potential duplicates if necessary (optional)
    // result[key] = [...new Set(result[key])].join(', ');

    // Join the array into a string
    result[key] = result[key].join(", ");
  });

  return result;
};

module.exports.incrementVariantId = (variantId) => {
  // Use a regular expression to match the number at the end
  if (!variantId) return "";

  const match = variantId.match(/(\d+)$/);

  if (match) {
    // Extract the number and increment it
    const number = match[0];
    const incrementedNumber = (parseInt(number, 10) + 1).toString();

    // Preserve the original length of the number (e.g., leading zeros)
    const paddedNumber =
      number.length > incrementedNumber.length
        ? number.slice(0, -incrementedNumber.length) + incrementedNumber
        : incrementedNumber;

    // Replace the old number at the end with the incremented number
    return variantId.slice(0, match.index) + paddedNumber;
  }

  // If no number is found, append "1" to the string
  return variantId + "1";
};

/*  This is for finding the largest Id from an array of ids. The ids have the form
such that they begin with a string and end with a number like 3DL0034
 */
module.exports.findLargestNumberString = (arr) => {
  if (!arr || !arr.length) return null; // Handle empty arrays

  return arr.reduce((largest, current) => {
    // Extract the number at the end of the current string
    const currentNumber = parseInt(current.match(/\d+$/)[0], 10);

    // Extract the number at the end of the largest string
    const largestNumber = parseInt(largest.match(/\d+$/)[0], 10);

    // Compare and return the string with the larger number
    return currentNumber > largestNumber ? current : largest;
  });
};

module.exports.getWarehouseIdsFromStorageLocations = (storageLocations) => {
  if (!storageLocations) return [];

  if (storageLocations instanceof Map)
    return Array.from(storageLocations.keys());

  return Object.keys(storageLocations);
};

module.exports.deleteImagesFromS3 = async (imagesToRemove) => {
  if (!imagesToRemove || imagesToRemove.length === 0) return true;

  for (const imageURL of imagesToRemove) {
    try {
      const url = new URL(imageURL);
      const key = decodeURIComponent(url.pathname.substring(1));
      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });
      await s3.send(command);
    } catch (error) {
      console.error(`Error deleting image: ${imageURL}`, error);
      throw new Error(
        `Failed to delete image: ${imageURL}. Error: ${error.message}`
      );
    }
  }
  return true;
};

module.exports.getFileNameFromURL = (fileUrl) => {
  const url = new URL(fileUrl);
  const key = decodeURIComponent(url.pathname.substring(1));
  // eslint-disable-next-line no-unused-vars
  const [_, ...fileNameArray] = key.split("-");

  return fileNameArray.join("-");
};

module.exports.getSourceKeyFromURL = (fileUrl) => {
  const url = new URL(fileUrl);
  const key = decodeURIComponent(url.pathname.substring(1));

  return key;
};

module.exports.duplicateS3Images = async (imagesToDuplicate) => {
  if (!imagesToDuplicate || imagesToDuplicate.length === 0) return [];

  const duplicatedUrls = [];

  for (const imageKey of imagesToDuplicate) {
    try {
      // Generate a new unique key for the duplicated image
      const sourceKey = this.getSourceKeyFromURL(imageKey);
      const newFileName = `${Date.now()}-${this.getFileNameFromURL(imageKey)}`;

      // Copy the object within S3
      await s3.send(
        new CopyObjectCommand({
          Bucket: BUCKET_NAME,
          CopySource: `${BUCKET_NAME}/${sourceKey}`,
          Key: newFileName,
        })
      );

      // Construct new S3 URL
      const newImageUrl = `${CLOUDFRONT_BASE_URL}/${newFileName}`;
      duplicatedUrls.push(newImageUrl);

      console.log(`Duplicated: ${imageKey} -> ${newImageUrl}`);
    } catch (error) {
      await this.deleteImagesFromS3(duplicatedUrls);

      console.error(`Failed to duplicate ${imageKey}:`, error);
      throw new Error(`Failed to duplicate image: ${error.message}`);
    }
  }

  return duplicatedUrls;
};

module.exports.formatValue = (value) => {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    // If the number is large enough, assume it's a timestamp in ms.
    if (value > 1e12) {
      return new Date(value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (value && typeof value === "object") {
    // If the object has both label and value properties, return the label.
    if ("label" in value && "value" in value) {
      return value.label;
    }
    // Otherwise, for now we return a JSON string. You can handle other objects later.
    return JSON.stringify(value);
  }
  return value;
};
module.exports.camelCaseToNormalText = (camelCase) => {
  return camelCase
    .replace(/([A-Z])/g, " $1") // Insert a space before all uppercase letters
    .replace(/^./, (str) => str.toUpperCase()) // Capitalize the first letter
    .trim();
};
module.exports.formatStorageLocations = (storageLocations) => {
  let allLocations = [];
  if (storageLocations && typeof storageLocations === "object") {
    for (const key in storageLocations) {
      if (Array.isArray(storageLocations[key])) {
        allLocations = allLocations.concat(storageLocations[key]);
      }
    }
  }
  const locationNames = allLocations
    .map((loc) => loc.locationName)
    .filter(Boolean)
    .join(", ");
  const customNames = allLocations
    .map((loc) => loc.customNames)
    .filter(Boolean)
    .join(", ");
  const maxQtyAtLocs = allLocations
    .map((loc) => loc.maxQtyAtLoc)
    .filter((val) => val !== undefined && val !== null)
    .join(", ");
  return [locationNames, customNames, maxQtyAtLocs];
};

module.exports.formatRelatedItems = (relatedItems) => {
  if (!Array.isArray(relatedItems)) return ["", ""];
  const variantIds = relatedItems
    .map((item) => item.variantId)
    .filter(Boolean)
    .join(", ");
  const variantDescriptions = relatedItems
    .map((item) => item.variantDescription)
    .filter(Boolean)
    .join(", ");
  return [variantIds, variantDescriptions];
};
module.exports.formatBillOfMaterial = (billOfMaterial) => {
  if (!Array.isArray(billOfMaterial)) return ["", "", ""];
  const variant_ids = [];
  const variantIds = [];
  const variantDescriptions = [];
  const quantities = [];
  billOfMaterial.forEach((item) => {
    if (item.variant_id && typeof item.variant_id === "object") {
      variantIds.push(item.variant_id.variantId || "");
      variantDescriptions.push(item.variant_id.variantDescription || "");
    } else {
      variant_ids.push("");
      variantIds.push("");
      variantDescriptions.push("");
    }
    // Ensure quantity exists. If it's 0, it will be included.
    quantities.push(
      item.quantity !== undefined && item.quantity !== null ? item.quantity : ""
    );
  });
  return [
    variantIds.filter(Boolean).join(", "),
    variantDescriptions.filter(Boolean).join(", "),
    quantities.filter((val) => val !== "").join(", "),
  ];
};

module.exports.formatDateFromTimestamp = (
  timestamp,
  format,
  separator = "/"
) => {
  const date =
    typeof timestamp === "number"
      ? new Date(timestamp)
      : new Date(Number(timestamp));
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const monthNamesShort = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sept",
    "Oct",
    "Nov",
    "Dec",
  ];
  const monthShort = monthNamesShort[date.getMonth()];

  switch (format) {
    case "YYYY-MM-DD":
      return `${year}${separator}${month}${separator}${day}`;

    case "YYYY/MM/DD":
      return `${year}${separator}${month}${separator}${day}`;

    case "MMM DD YYYY":
      return `${monthShort}${separator}${day}${separator}${year}`;

    case "MMM. DD YYYY":
      return `${monthShort}.${separator}${day}${separator}${year}`;

    case "MMM. DD, YYYY":
      return `${monthShort}.${separator}${day},${separator}${year}`;

    case "DD-MM-YYYY":
      return `${day}${separator}${month}${separator}${year}`;

    case "DD-MMM-YYYY":
      return `${day}${separator}${monthShort}${separator}${year}`;

    case "MM/DD/YYYY":
      return `${month}${separator}${day}${separator}${year}`;

    default:
      throw new Error("Unsupported format");
  }
};

module.exports.mapArrayToObject = (array, key) =>
  array.reduce((acc, item) => {
    acc[item[key]] = item;
    return acc;
  }, {});
