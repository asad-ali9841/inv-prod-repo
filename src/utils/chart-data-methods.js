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

// Helper function to get ISO week number
function getISOWeek(date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function generateEndDatesFromFormat(startDate, endDate, dateFormat) {
  const endDates = [];
  let currentDate = new Date(startDate);

  if (dateFormat === "%Y-%m-%d") {
    while (currentDate <= endDate) {
      endDates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
  } else if (dateFormat === "%Y-%U") {
    let currentWeek = getISOWeek(startDate);
    while (currentDate <= endDate) {
      if (getISOWeek(currentDate) > currentWeek) {
        const previousEndDate = new Date(currentDate);
        previousEndDate.setDate(previousEndDate.getDate() - 1);
        endDates.push(previousEndDate);
        currentWeek = getISOWeek(currentDate);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    // Add the final week
    endDates.push(new Date(endDate));
  } else if (dateFormat === "%Y-%m") {
    let currentMonth = currentDate.getMonth();
    while (currentDate <= endDate) {
      if (currentDate.getMonth() > currentMonth) {
        const previousEndDate = new Date(currentDate);
        previousEndDate.setDate(previousEndDate.getDate() - 1);
        endDates.push(previousEndDate);
        currentMonth = currentDate.getMonth();
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    // Add the final month
    endDates.push(new Date(endDate));
  } else {
    let currentYear = currentDate.getFullYear();
    while (currentDate <= endDate) {
      if (currentDate.getFullYear() > currentYear) {
        const previousEndDate = new Date(currentDate);
        previousEndDate.setDate(previousEndDate.getDate() - 1);
        endDates.push(previousEndDate);
        currentYear = currentDate.getFullYear();
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    // Add the final year
    endDates.push(new Date(endDate));
  }

  return endDates;
}

function generateDateLabelsAndEndDates(startDate, endDate) {
  const rangeInMs = endDate - startDate;
  const rangeInDays = rangeInMs / (1000 * 60 * 60 * 24);

  let labelPrefix;
  const endDates = [];
  const labels = [];
  let currentDate = new Date(startDate);

  if (rangeInDays <= 14) {
    labelPrefix = "Day ";
    let dayNumber = 1;
    while (currentDate <= endDate) {
      labels.push(`${labelPrefix} ${dayNumber}`);
      endDates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
      ++dayNumber;
    }
  } else if (rangeInDays <= 45) {
    labelPrefix = "Week ";
    let currentWeek = getISOWeek(startDate);
    let weekNumber = 1;
    while (currentDate <= endDate) {
      if (getISOWeek(currentDate) > currentWeek) {
        const previousEndDate = new Date(currentDate);
        previousEndDate.setDate(previousEndDate.getDate() - 1);
        endDates.push(previousEndDate);
        labels.push(`${labelPrefix} ${weekNumber}`);
        currentWeek = getISOWeek(currentDate);
        ++weekNumber;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    // Add the final week
    endDates.push(new Date(endDate));
    labels.push(`${labelPrefix} ${weekNumber}`);
  } else if (rangeInDays <= 150) {
    labelPrefix = "Month ";
    let currentMonth = currentDate.getMonth();
    let monthNumber = 1;
    while (currentDate <= endDate) {
      if (currentDate.getMonth() > currentMonth) {
        const previousEndDate = new Date(currentDate);
        previousEndDate.setDate(previousEndDate.getDate() - 1);
        endDates.push(previousEndDate);
        labels.push(`${labelPrefix} ${monthNumber}`);
        currentMonth = currentDate.getMonth();
        ++monthNumber;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    // Add the final month
    endDates.push(new Date(endDate));
    labels.push(`${labelPrefix} ${monthNumber}`);
  } else {
    labelPrefix = "Year ";
    let currentYear = currentDate.getFullYear();
    let yearNumber = 1;
    while (currentDate <= endDate) {
      if (currentDate.getFullYear() > currentYear) {
        const previousEndDate = new Date(currentDate);
        previousEndDate.setDate(previousEndDate.getDate() - 1);
        endDates.push(previousEndDate);
        currentYear = currentDate.getFullYear();
        labels.push(`${labelPrefix} ${yearNumber}`);
        ++yearNumber;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    // Add the final year
    endDates.push(new Date(endDate));
    labels.push(`${labelPrefix} ${yearNumber}`);
  }

  return { labels, endDates };
}

const fetchInventoryValueAsOfDate = async (endDate, warehouseId) => {
  const data = await InventoryLog.aggregate([
    {
      $match: {
        warehouseId,
        createdAt: { $lte: endDate.getTime() },
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $group: {
        _id: "$variantId",
        latestLog: { $first: "$$ROOT" },
      },
    },
    {
      $group: {
        _id: null,
        totalInventoryValue: { $sum: "$latestLog.inventoryValue" },
      },
    },
    {
      $project: {
        _id: 0,
        totalInventoryValue: 1,
      },
    },
  ]);

  return data[0]?.totalInventoryValue ?? 0;
};

const fetchTotalInventoryValueData = async (
  rangeStart,
  rangeEnd,
  warehouseId,
  format
) => {
  if (format) {
    const endDates = generateEndDatesFromFormat(rangeStart, rangeEnd, format);
    const totalInventoryValues = await Promise.all(
      endDates.map(async (endDate) => {
        return await fetchInventoryValueAsOfDate(endDate, warehouseId);
      })
    );

    return {
      totalInventoryValues,
    };
  }

  const { labels, endDates } = generateDateLabelsAndEndDates(
    rangeStart,
    rangeEnd
  );

  const totalInventoryValues = await Promise.all(
    endDates.map(async (endDate) => {
      return await fetchInventoryValueAsOfDate(endDate, warehouseId);
    })
  );

  return { labels, totalInventoryValues };
};

// Helper to run aggregate for given date range
const getAggregatedValue = async (start, end, warehouseId, aggregation) => {
  const { totalInventoryValues } = await fetchTotalInventoryValueData(
    start,
    end,
    warehouseId,
    // Determine dateFormat based on the range for reasonable granularity
    (end - start) / (1000 * 60 * 60 * 24) <= 31 ? "%Y-%m-%d" : "%Y-%U"
  );

  if (!totalInventoryValues || totalInventoryValues.length === 0) {
    return 0; // Or handle the case of no data appropriately
  }

  switch (aggregation) {
    case ChartAggregation.Average: {
      const sum = totalInventoryValues.reduce((acc, value) => acc + value, 0);
      return sum / totalInventoryValues.length;
    }
    case ChartAggregation.Min:
      return Math.min(...totalInventoryValues);
    case ChartAggregation.Max:
      return Math.max(...totalInventoryValues);
    default: {
      console.warn("Unsupported aggregation type, returning average");
      const sumValue = totalInventoryValues.reduce(
        (acc, value) => acc + value,
        0
      );
      return sumValue / totalInventoryValues.length;
    }
  }
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

  if ([ChartType.BarChart, ChartType.LineChart].includes(chartType)) {
    const { labels, totalInventoryValues } = await fetchTotalInventoryValueData(
      startDate,
      endDate,
      warehouseId
    );

    if (comparedTo === ComparedTo.NoComparison) {
      return {
        labels,
        datasets: [
          {
            label: dataSource,
            data: totalInventoryValues,
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

      const {
        labels: previousLabels,
        totalInventoryValues: previousTotalInventoryValues,
      } = await fetchTotalInventoryValueData(
        prevStartDate,
        prevEndDate,
        warehouseId
      );

      return {
        labels: labels.length > previousLabels.length ? labels : previousLabels,
        datasets: [
          {
            label: "Previous",
            data: previousTotalInventoryValues,
            borderColor: "#FF8A00",
            backgroundColor: "#FFC87B",
            ...(chartType === ChartType.BarChart ? barChartStyles : {}),
          },
          {
            label: "Current",
            data: totalInventoryValues,
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
      const currentValue = await fetchInventoryValueAsOfDate(
        endDate,
        warehouseId
      );

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

const fetchTotalInventoryValuePerCategoryAsOfDate = async (
  endDate,
  warehouseId
) => {
  // Now aggregate again to divide value by number of categories per item
  // But instead of doing it manually in JS, we'll do it right in aggregation:
  // Go back and calculate category count, then divide properly:

  const finalData = await InventoryLog.aggregate([
    {
      $match: {
        warehouseId,
        createdAt: { $lte: endDate.getTime() },
      },
    },
    { $sort: { createdAt: -1 } },
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
    { $unwind: "$variant" },
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
      $addFields: {
        categories: {
          $cond: [
            { $gt: [{ $size: { $ifNull: ["$product.category", []] } }, 0] },
            "$product.category",
            ["Uncategorized"],
          ],
        },
        categoryCount: {
          $cond: [
            { $gt: [{ $size: { $ifNull: ["$product.category", []] } }, 0] },
            { $size: "$product.category" },
            1,
          ],
        },
      },
    },
    {
      $project: {
        categories: 1,
        inventoryValuePerCategory: {
          $divide: ["$latestLog.inventoryValue", "$categoryCount"],
        },
      },
    },
    { $unwind: "$categories" },
    {
      $group: {
        _id: "$categories",
        totalInventoryValue: { $sum: "$inventoryValuePerCategory" },
      },
    },
    {
      $project: {
        _id: 0,
        category: "$_id",
        totalInventoryValue: 1,
      },
    },
  ]);

  // Convert to object format: { categoryName: totalInventoryValue }
  const result = {};
  for (const entry of finalData) {
    result[entry.category] = entry.totalInventoryValue;
  }

  return result;
};

const fetchTotalInventoryValuePerCategoryData = async (
  startDate,
  endDate,
  warehouseId,
  addBGColor = false
) => {
  const { labels, endDates } = generateDateLabelsAndEndDates(
    startDate,
    endDate
  );
  const categoriesMap = new Map();

  // Fetch inventory data for each end date
  for (const endDate of endDates) {
    const inventoryData = await fetchTotalInventoryValuePerCategoryAsOfDate(
      endDate,
      warehouseId
    );
    const color = randomColors[categoriesMap.size % randomColors.length];

    // Update category-wise data
    for (const category in inventoryData) {
      if (!categoriesMap.has(category)) {
        categoriesMap.set(category, {
          label: category,
          data: [],
          borderColor: color, // Cycle through colors
          backgroundColor: addBGColor ? color : "#FFF", // Or any other default
          tension: 0.4,
        });
      }
      categoriesMap.get(category).data.push(inventoryData[category] || 0); // push 0 if category doesnt exist
    }
  }

  // Convert the map to the datasets array
  const datasets = Array.from(categoriesMap.values());
  const chartData = {
    labels,
    datasets,
  };
  return chartData;
};

const getTotalInventoryValuePerCategoryChartData = async ({
  chartType,
  warehouseId,
  startDateStr,
  endDateStr,
}) => {
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  if ([ChartType.BarChart, ChartType.LineChart].includes(chartType)) {
    const currentData = await fetchTotalInventoryValuePerCategoryData(
      startDate,
      endDate,
      warehouseId
    );

    return currentData;
  }

  if ([ChartType.PieChart, ChartType.DonutChart].includes(chartType)) {
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);

    const currentData = await fetchTotalInventoryValuePerCategoryAsOfDate(
      endOfDay,
      warehouseId
    );

    const sampleData = Object.entries(currentData).map(([label, value]) => ({
      label,
      value,
    }));

    const backgroundColors = sampleData.map(
      (_, index) => randomColors[index % randomColors.length]
    );
    const borderColors = backgroundColors.map((color) => color);
    const chartData = {
      labels: sampleData.map((item) => item.label),
      datasets: [
        {
          data: sampleData.map((item) => item.value),
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1,
        },
      ],
    };

    if (chartType === ChartType.PieChart) {
      return chartData;
    } else {
      const totalInventoryValue = await fetchInventoryValueAsOfDate(
        endOfDay,
        warehouseId
      );
      const centerContent = `Total\n $${roundToTwoDecimals(
        totalInventoryValue
      )}`;
      return {
        centerContent,
        chartData,
      };
    }
  }
};

module.exports = {
  getTotalInventoryValueChartData,
  getTotalInventoryValuePerCategoryChartData,
};
