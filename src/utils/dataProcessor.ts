import moment from "moment";
import mockDb from "../../mock_db.json";

// --- Interfaces (could be moved to a types file) ---
interface Incident {
    id: string;
    residentId: string;
    type: string; // e.g., "Fall", "Medication Error"
    timestamp: string; // ISO 8601 format e.g., "2025-04-26T14:30:00Z"
    [key: string]: any; // Allow other properties
}

interface Activity {
    id: string;
    residentId: string;
    type: string; // e.g., "Bathroom Visit", "Meal"
    timestamp: string; // ISO 8601 format
    [key: string]: any;
}

interface WeeklyAggregation {
    weekLabel: string; // e.g., "Apr 1-7"
    count: number;
    startDate: string; // ISO format date string
    endDate: string; // ISO format date string
}

// --- Helper Functions ---

/**
 * Generates week labels for a given date range.
 */
const getWeekLabels = (
    startDate: moment.Moment,
    endDate: moment.Moment
): string[] => {
    const labels: string[] = [];
    let current = startDate.clone().startOf("isoWeek");

    while (current.isSameOrBefore(endDate, "day")) {
        const weekStart = current.format("MMM D");
        const weekEnd = current.clone().endOf("isoWeek").format("D");
        labels.push(`${weekStart}-${weekEnd}`);
        current.add(1, "week");
    }
    return labels;
};

// --- Core Processing Functions ---

/**
 * Filters incidents by resident, type, and date range.
 */
export const getIncidentsByResident = (
    residentId: string,
    incidentType: string,
    startDate: moment.Moment,
    endDate: moment.Moment
): Incident[] => {
    return mockDb.incidents.filter(
        (incident) =>
            incident.residentId === residentId &&
            incident.type.toLowerCase() === incidentType.toLowerCase() &&
            moment(incident.timestamp).isBetween(
                startDate,
                endDate,
                "day",
                "[]"
            ) // '[]' includes start/end days
    );
};

/**
 * Filters activities by resident, type, and date range.
 */
export const getActivitiesByResident = (
    residentId: string,
    activityType: string,
    startDate: moment.Moment,
    endDate: moment.Moment
): Activity[] => {
    return mockDb.activities.filter(
        (activity) =>
            activity.residentId === residentId &&
            activity.type.toLowerCase() === activityType.toLowerCase() &&
            moment(activity.timestamp).isBetween(
                startDate,
                endDate,
                "day",
                "[]"
            )
    );
};

/**
 * Aggregates filtered data (incidents or activities) by week.
 */
export const aggregateDataByWeek = (
    data: (Incident | Activity)[],
    startDate: moment.Moment,
    endDate: moment.Moment
): WeeklyAggregation[] => {
    const weeklyCounts: { [key: string]: WeeklyAggregation } = {};
    let currentWeekStart = startDate.clone().startOf("isoWeek");

    // Initialize weeks within the range
    while (currentWeekStart.isSameOrBefore(endDate, "day")) {
        const weekStartFormat = currentWeekStart.format("YYYY-MM-DD");
        const weekEndFormat = currentWeekStart
            .clone()
            .endOf("isoWeek")
            .format("YYYY-MM-DD");
        const weekLabel = `${currentWeekStart.format(
            "MMM D"
        )}-${currentWeekStart.clone().endOf("isoWeek").format("D")}`;

        weeklyCounts[weekStartFormat] = {
            weekLabel: weekLabel,
            count: 0,
            startDate: weekStartFormat,
            endDate: weekEndFormat,
        };
        currentWeekStart.add(1, "week");
    }

    // Populate counts
    data.forEach((item) => {
        const itemDate = moment(item.timestamp);
        const weekStartKey = itemDate.startOf("isoWeek").format("YYYY-MM-DD");
        if (weeklyCounts[weekStartKey]) {
            weeklyCounts[weekStartKey].count++;
        }
    });

    // Return sorted array of weekly data, ensuring all weeks in range are present
    return Object.values(weeklyCounts).sort((a, b) =>
        moment(a.startDate).diff(moment(b.startDate))
    );
};

// --- Example Usage (for testing/integration) ---

/**
 * Gets falls per week for a resident in the last N days.
 */
export const getWeeklyFallsForResident = (
    residentId: string,
    daysAgo: number
): WeeklyAggregation[] => {
    const endDate = moment(); // Today
    const startDate = moment()
        .subtract(daysAgo - 1, "days")
        .startOf("day"); // Go back N days
    const falls = getIncidentsByResident(
        residentId,
        "Fall",
        startDate,
        endDate
    );
    return aggregateDataByWeek(falls, startDate, endDate);
};

/**
 * Gets bathroom visits per week for a resident in the last N days.
 */
export const getWeeklyBathroomVisitsForResident = (
    residentId: string,
    daysAgo: number
): WeeklyAggregation[] => {
    const endDate = moment(); // Today
    const startDate = moment()
        .subtract(daysAgo - 1, "days")
        .startOf("day");
    const visits = getActivitiesByResident(
        residentId,
        "Bathroom Visit",
        startDate,
        endDate
    );
    return aggregateDataByWeek(visits, startDate, endDate);
};
