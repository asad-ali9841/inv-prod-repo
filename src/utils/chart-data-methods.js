const { roundToTwoDecimals } = require(".");
const InventoryLog = require("../database/models/InventoryLog");
const {
  ChartAggregation,
  ChartType,
  ComparedTo,
  barChartStyles,
  DifferenceStatus,
  randomColors,
  pieChartStyles,
} = require("./constants");

const fetchTotalInventoryValueData = async (
  rangeStart,
  rangeEnd,
  warehouseId,
  dateFormat
) => {
  const data = await InventoryLog.aggregate([
    {
      $match: {
        warehouseId,
        createdAt: {
          $gte: rangeStart.getTime(),
          $lte: rangeEnd.getTime(),
        },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: dateFormat,
            date: { $toDate: "$createdAt" },
          },
        },
        totalInventoryValue: { $sum: "$inventoryValue" },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);
  return data;
};

// Helper to run aggregate for given date range
const getAggregatedValue = async (start, end, warehouseId, aggregation) => {
  let aggregationOperator;

  switch (aggregation) {
    case ChartAggregation.Sum:
      aggregationOperator = { $sum: "$inventoryValue" };
      break;
    case ChartAggregation.Average:
      aggregationOperator = { $avg: "$inventoryValue" };
      break;
    case ChartAggregation.Min:
      aggregationOperator = { $min: "$inventoryValue" };
      break;
    case ChartAggregation.Max:
      aggregationOperator = { $max: "$inventoryValue" };
      break;
    default:
      aggregationOperator = { $sum: "$inventoryValue" };
  }

  const result = await InventoryLog.aggregate([
    {
      $match: {
        warehouseId,
        createdAt: { $gte: start.getTime(), $lte: end.getTime() },
      },
    },
    {
      $group: {
        _id: null,
        value: aggregationOperator,
      },
    },
  ]);
  return result[0]?.value ?? 0;
};

const getTotalInventoryValueChartData = async ({
  chartType,
  comparedTo,
  warehouseId,
  startDateStr,
  endDateStr,
  aggregation,
  dataSource,
}) => {
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  const rangeInMs = endDate - startDate;
  const rangeInDays = rangeInMs / (1000 * 60 * 60 * 24);

  if ([ChartType.BarChart, ChartType.LineChart].includes(chartType)) {
    let dateFormat, labelPrefix;
    if (rangeInDays <= 14) {
      dateFormat = "%Y-%m-%d"; // Daily
      labelPrefix = "Day ";
    } else if (rangeInDays <= 45) {
      dateFormat = "%Y-%U"; // Weekly
      labelPrefix = "Week ";
    } else if (rangeInDays <= 150) {
      dateFormat = "%Y-%m"; // Monthly
      labelPrefix = "Month ";
    } else {
      dateFormat = "%Y"; // Yearly
      labelPrefix = "Year ";
    }

    const currentData = await fetchTotalInventoryValueData(
      startDate,
      endDate,
      warehouseId,
      dateFormat
    );

    if (comparedTo === ComparedTo.NoComparison) {
      return {
        labels: currentData.map((entry, index) => `${labelPrefix}${index + 1}`),
        datasets: [
          {
            label: dataSource,
            data: currentData.map((entry) => entry.totalInventoryValue),
            borderColor: "#1F69FF",
            backgroundColor: "#7AA7FF",
            ...(chartType === ChartType.BarChart ? barChartStyles : {}),
          },
        ],
      };
    }

    if (
      [ComparedTo.PreviousPeriod, ComparedTo.PreviousYear].includes(comparedTo)
    ) {
      let prevStartDate, prevEndDate;

      if (comparedTo === ComparedTo.PreviousPeriod) {
        prevEndDate = new Date(startDate.getTime() - 1);
        prevStartDate = new Date(prevEndDate.getTime() - rangeInMs);
      } else if (comparedTo === ComparedTo.PreviousYear) {
        prevStartDate = new Date(
          startDate.getFullYear() - 1,
          startDate.getMonth(),
          startDate.getDate()
        );
        prevEndDate = new Date(
          endDate.getFullYear() - 1,
          endDate.getMonth(),
          endDate.getDate()
        );
      }

      const previousData = await fetchTotalInventoryValueData(
        prevStartDate,
        prevEndDate,
        warehouseId,
        dateFormat
      );

      // Use the longer label list for consistency
      const labels =
        currentData.length >= previousData.length
          ? currentData.map((_, i) => `${labelPrefix}${i + 1}`)
          : previousData.map((_, i) => `${labelPrefix}${i + 1}`);

      return {
        labels,
        datasets: [
          {
            label: "Previous",
            data: previousData.map((entry) => entry.totalInventoryValue),
            borderColor: "#FF8A00",
            backgroundColor: "#FFC87B",
            ...(chartType === ChartType.BarChart ? barChartStyles : {}),
          },
          {
            label: "Current",
            data: currentData.map((entry) => entry.totalInventoryValue),
            borderColor: "#1F69FF",
            backgroundColor: "#7AA7FF",
            ...(chartType === ChartType.BarChart ? barChartStyles : {}),
          },
        ],
      };
    }

    return []; // fallback
  } else if ([ChartType.Number].includes(chartType)) {
    // If start and end are on the same date (ignoring time), return snapshot
    const isSameDay = startDate.toDateString() === endDate.toDateString();

    if (isSameDay) {
      const snapshot = await InventoryLog.aggregate([
        {
          $match: {
            warehouseId,
            createdAt: {
              $lte: endDate.getTime(),
            },
          },
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $group: {
            _id: "$variantId",
            latestEntry: { $first: "$$ROOT" },
          },
        },
        {
          $group: {
            _id: null,
            totalInventoryValue: {
              $sum: "$latestEntry.inventoryValue",
            },
          },
        },
      ]);

      const currentValue = snapshot.length
        ? snapshot[0].totalInventoryValue
        : 0;
      const currentRoundedValue = roundToTwoDecimals(currentValue);

      return {
        current: `$${currentRoundedValue}`,
        currentValue: currentRoundedValue,
      };
    }

    // No comparison needed
    if (comparedTo === ComparedTo.NoComparison) {
      const currentValue = await getAggregatedValue(
        startDate,
        endDate,
        warehouseId,
        aggregation
      );
      const currentRoundedValue = roundToTwoDecimals(currentValue);

      return {
        current: `$${currentRoundedValue}`,
        currentValue: currentRoundedValue,
      };
    }

    // Comparison needed
    let prevStartDate, prevEndDate;

    const rangeInMs = endDate.getTime() - startDate.getTime();
    if (comparedTo === ComparedTo.PreviousPeriod) {
      prevEndDate = new Date(startDate.getTime() - 1);
      prevStartDate = new Date(prevEndDate.getTime() - rangeInMs);
    } else if (comparedTo === ComparedTo.PreviousYear) {
      prevStartDate = new Date(
        startDate.getFullYear() - 1,
        startDate.getMonth(),
        startDate.getDate()
      );
      prevEndDate = new Date(
        endDate.getFullYear() - 1,
        endDate.getMonth(),
        endDate.getDate()
      );
    }

    const [currentValue, previousValue] = await Promise.all([
      getAggregatedValue(startDate, endDate, warehouseId, aggregation),
      getAggregatedValue(prevStartDate, prevEndDate, warehouseId, aggregation),
    ]);

    let differenceStatus = DifferenceStatus.NoChange;
    let percentageChange = 0;

    if (previousValue === 0) {
      percentageChange = 100;
      differenceStatus =
        currentValue === 0
          ? DifferenceStatus.NoChange
          : DifferenceStatus.Increase;
    } else if (currentValue > previousValue) {
      percentageChange = ((currentValue - previousValue) / previousValue) * 100;
      differenceStatus = DifferenceStatus.Increase;
    } else if (currentValue < previousValue) {
      percentageChange = ((previousValue - currentValue) / previousValue) * 100;
      differenceStatus = DifferenceStatus.Decrease;
    }

    const currentRoundedValue = roundToTwoDecimals(currentValue);
    const previousRoundedValue = roundToTwoDecimals(previousValue);

    return {
      current: `$${currentRoundedValue}`,
      previous: `$${previousRoundedValue}`,
      currentValue: currentRoundedValue,
      previousValue: previousRoundedValue,
      differential: roundToTwoDecimals(percentageChange),
      differenceStatus,
    };
  }
};

const fetchTotalInventoryValuePerCategoryData = async (
  startDate,
  endDate,
  warehouseId,
  dateFormat
) => {
  const result = await InventoryLog.aggregate([
    {
      $match: {
        warehouseId,
        createdAt: {
          $gte: startDate.getTime(),
          $lte: endDate.getTime(),
        },
      },
    },
    {
      $lookup: {
        from: "items", // Collection for Items
        localField: "variantId",
        foreignField: "_id",
        as: "variant",
      },
    },
    { $unwind: "$variant" },
    {
      $lookup: {
        from: "itemshareds", // Collection for product-level info
        localField: "variant.sharedAttributes",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
    {
      $group: {
        _id: {
          category: "$product.category",
          bucket: {
            $dateToString: {
              format: dateFormat, // '%Y-%U', '%Y-%m', etc.
              date: { $toDate: "$createdAt" },
            },
          },
        },
        totalInventoryValue: { $sum: "$inventoryValue" },
      },
    },
    {
      $group: {
        _id: "$_id.bucket",
        categories: {
          $push: {
            category: "$_id.category",
            totalInventoryValue: "$totalInventoryValue",
          },
        },
      },
    },
    {
      $sort: { _id: 1 }, // Sort by time bucket
    },
  ]);

  return result;
};

const getTotalInventoryValuePerCategoryChartData = async ({
  chartType,
  comparedTo,
  warehouseId,
  startDateStr,
  endDateStr,
  dataSource,
}) => {
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  const rangeInMs = endDate - startDate;
  const rangeInDays = rangeInMs / (1000 * 60 * 60 * 24);

  if ([ChartType.BarChart, ChartType.LineChart].includes(chartType)) {
    let dateFormat, labelPrefix;
    if (rangeInDays <= 14) {
      dateFormat = "%Y-%m-%d"; // Daily
      labelPrefix = "Day ";
    } else if (rangeInDays <= 45) {
      dateFormat = "%Y-%U"; // Weekly
      labelPrefix = "Week ";
    } else if (rangeInDays <= 150) {
      dateFormat = "%Y-%m"; // Monthly
      labelPrefix = "Month ";
    } else {
      dateFormat = "%Y"; // Yearly
      labelPrefix = "Year ";
    }

    const currentData = await fetchTotalInventoryValuePerCategoryData(
      startDate,
      endDate,
      warehouseId,
      dateFormat
    );

    // Map to collect all categories per bucket (date-based)
    const categoryMap = new Map();

    currentData.forEach((entry) => {
      const dateKey = entry._id;
      if (!categoryMap.has(dateKey)) {
        categoryMap.set(dateKey, new Map());
      }

      const bucketMap = categoryMap.get(dateKey);

      entry.categories.forEach((catEntry) => {
        let categories = catEntry.category || ["Uncategorized"];

        // Ensure it's an array
        if (!Array.isArray(categories)) {
          categories = [categories];
        }

        // Distribute the inventoryValue equally among the categories
        const valuePerCategory =
          catEntry.totalInventoryValue / categories.length;

        categories.forEach((category) => {
          const currentTotal = bucketMap.get(category) || 0;
          bucketMap.set(
            category,
            roundToTwoDecimals(currentTotal + valuePerCategory)
          );
        });
      });
    });

    // Get sorted date labels
    const labels = Array.from(categoryMap.keys()).sort();
    const allCategories = new Set();

    // Collect all categories
    categoryMap.forEach((bucketMap) => {
      bucketMap.forEach((_val, category) => {
        allCategories.add(category);
      });
    });

    const sortedCategories = Array.from(allCategories);

    // Create datasets per category
    const datasets = sortedCategories.map((category, index) => {
      const color = randomColors[index % randomColors.length];
      const data = labels.map((label) => {
        const bucket = categoryMap.get(label);
        return bucket?.get(category) || 0;
      });

      return {
        label: category,
        data,
        borderColor: color,
        backgroundColor: color,
        ...(chartType === ChartType.PieChart ? pieChartStyles : {}),
      };
    });

    return {
      labels: labels.map((_, idx) => `${labelPrefix}${idx + 1}`),
      datasets,
    };
  }

  if ([ChartType.PieChart, ChartType.DonutChart].includes(chartType)) {
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await InventoryLog.aggregate([
      {
        $match: {
          warehouseId,
          createdAt: { $lte: endOfDay.getTime() },
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: "$variantId",
          latestLog: { $first: "$$ROOT" },
        },
      },
      {
        $lookup: {
          from: "items",
          localField: "_id",
          foreignField: "_id",
          as: "variant",
        },
      },
      {
        $unwind: "$variant",
      },
      {
        $lookup: {
          from: "itemshareds",
          localField: "variant.sharedAttributes",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $unwind: {
          path: "$product",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          inventoryValue: "$latestLog.inventoryValue",
          categories: {
            $cond: [
              { $gt: [{ $size: { $ifNull: ["$product.category", []] } }, 0] },
              "$product.category",
              ["Uncategorized"],
            ],
          },
        },
      },
    ]);

    const categoryTotals = new Map();

    result.forEach((entry) => {
      const categories = Array.isArray(entry.categories)
        ? entry.categories
        : [entry.categories || "Uncategorized"];

      const valuePerCategory = entry.inventoryValue / categories.length;

      categories.forEach((category) => {
        const prev = categoryTotals.get(category) || 0;
        categoryTotals.set(
          category,
          roundToTwoDecimals(prev + valuePerCategory)
        );
      });
    });

    const labels = Array.from(categoryTotals.keys());
    const data = labels.map((label) => categoryTotals.get(label));
    const colors = labels.map(
      (_, index) => randomColors[index % randomColors.length]
    );

    if (chartType === ChartType.PieChart) {
      return {
        labels,
        datasets: [
          {
            label: dataSource,
            data,
            backgroundColor: colors,
          },
        ],
      };
    } else {
      const centerContent = `Total\n $${roundToTwoDecimals(
        data.reduce((sum, val) => sum + (val || 0), 0)
      )}`;
      return {
        centerContent,
        chartData: {
          labels,
          datasets: [
            {
              label: dataSource,
              data,
              backgroundColor: colors,
            },
          ],
        },
      };
    }
  }
};

module.exports = {
  getTotalInventoryValueChartData,
  getTotalInventoryValuePerCategoryChartData,
};
