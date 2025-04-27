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

// Added interfaces for Shift Summary
interface Shift {
    id: string;
    date: string; // YYYY-MM-DD
    type: "Day" | "Night";
    staffOnDuty: string[];
    startTime: string; // ISO 8601 format
    endTime: string; // ISO 8601 format
    handoverNotes: string | null;
}

interface Resident {
    id: string;
    name: string;
    fallRisk: string;
    notes?: string;
    [key: string]: any;
}

// Matches structure expected by ShiftSummary component
export interface IncidentSummary {
    id: string;
    residentId: string;
    residentName?: string;
    type: string;
    timestamp: string;
    description: string;
}

export interface ResidentToWatch {
    id: string;
    name: string;
    reason: string;
}

export interface ShiftSummaryData {
    previousShiftNotes: string | null;
    recentIncidents: IncidentSummary[];
    residentsToWatch: ResidentToWatch[];
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

// Helper to get resident name (can be optimized)
const getResidentNameById = (residentId: string): string | undefined => {
    return mockDb.residents.find((r) => r.id === residentId)?.name;
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

/**
 * Gathers data for a shift summary based on the end of the previous shift.
 * @param targetShiftType The shift type the summary is FOR (e.g., 'Day' means summarize previous 'Night').
 * @param referenceDate The current date/time to base the summary on.
 * @param lookbackHours How many hours back from the reference date to check for recent incidents.
 */
export const getShiftSummaryData = (
    targetShiftType: "Day" | "Night",
    referenceDate: moment.Moment,
    lookbackHours: number = 12 // Default to last 12 hours for incidents
): ShiftSummaryData => {
    const previousShiftType = targetShiftType === "Day" ? "Night" : "Day";
    const summaryStartTime = referenceDate
        .clone()
        .subtract(lookbackHours, "hours");

    // Find the most recent completed shift of the previous type
    const previousShift = mockDb.shifts
        .filter(
            (shift) =>
                shift.type === previousShiftType &&
                moment(shift.endTime).isBefore(referenceDate)
        )
        .sort((a, b) => moment(b.endTime).diff(moment(a.endTime)))[0]; // Get the latest one

    const previousShiftNotes = previousShift?.handoverNotes || null;

    // Find recent incidents within the lookback window
    const recentIncidentsRaw = mockDb.incidents.filter((incident) =>
        moment(incident.timestamp).isBetween(
            summaryStartTime,
            referenceDate,
            undefined,
            "[]"
        )
    );

    // Format incidents
    const recentIncidents: IncidentSummary[] = recentIncidentsRaw
        .map((inc) => ({
            id: inc.id,
            residentId: inc.residentId,
            residentName: getResidentNameById(inc.residentId),
            type: inc.type,
            timestamp: inc.timestamp,
            description: inc.description,
        }))
        .sort((a, b) => moment(b.timestamp).diff(moment(a.timestamp))); // Sort newest first

    // Find residents to watch (High Fall Risk or had a recent incident)
    const residentsToWatchSet = new Set<string>();
    const residentsToWatch: ResidentToWatch[] = [];

    // Add based on high fall risk
    mockDb.residents.forEach((res) => {
        if (res.fallRisk === "High" && !residentsToWatchSet.has(res.id)) {
            residentsToWatch.push({
                id: res.id,
                name: res.name,
                reason: "High Fall Risk",
            });
            residentsToWatchSet.add(res.id);
        }
    });

    // Add based on recent incidents
    recentIncidentsRaw.forEach((inc) => {
        if (!residentsToWatchSet.has(inc.residentId)) {
            const residentName =
                getResidentNameById(inc.residentId) || inc.residentId;
            residentsToWatch.push({
                id: inc.residentId,
                name: residentName,
                reason: `Recent Incident (${inc.type})`,
            });
            residentsToWatchSet.add(inc.residentId);
        }
    });

    return {
        previousShiftNotes,
        recentIncidents,
        residentsToWatch: residentsToWatch.sort((a, b) =>
            a.name.localeCompare(b.name)
        ), // Sort by name
    };
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
