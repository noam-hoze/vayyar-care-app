import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

// Define the expected data structure (matches dataProcessor output)
// We might move these interfaces to a dedicated types file later
interface IncidentSummary {
    id: string;
    residentId: string;
    residentName?: string; // Optional: Add name for display
    type: string;
    timestamp: string;
    description: string;
}

interface ResidentToWatch {
    id: string;
    name: string;
    reason: string;
}

interface ShiftSummaryData {
    previousShiftNotes: string | null;
    recentIncidents: IncidentSummary[];
    residentsToWatch: ResidentToWatch[];
}

interface ShiftSummaryProps {
    data: ShiftSummaryData | null;
}

const ShiftSummary: React.FC<ShiftSummaryProps> = ({ data }) => {
    if (!data) {
        return null; // Or display a loading/error state
    }

    const { previousShiftNotes, recentIncidents, residentsToWatch } = data;

    // Helper to format timestamp
    const formatTimestamp = (isoString: string) => {
        try {
            return new Date(isoString).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
            });
        } catch (e) {
            return "Invalid Date";
        }
    };

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.mainTitle}>Shift Summary</Text>

            {/* Previous Shift Notes Section */}
            <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Previous Shift Handover</Text>
                <Text style={styles.notesText}>
                    {previousShiftNotes || "No handover notes available."}
                </Text>
            </View>

            {/* Recent Incidents Section */}
            <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Recent Incidents</Text>
                {recentIncidents.length > 0 ? (
                    recentIncidents.map((incident) => (
                        <View key={incident.id} style={styles.incidentItem}>
                            <Text style={styles.itemTitle}>
                                {incident.type} -{" "}
                                {incident.residentName || incident.residentId} (
                                {formatTimestamp(incident.timestamp)})
                            </Text>
                            <Text style={styles.itemDescription}>
                                {incident.description}
                            </Text>
                        </View>
                    ))
                ) : (
                    <Text style={styles.noDataText}>
                        No significant incidents noted recently.
                    </Text>
                )}
            </View>

            {/* Residents to Watch Section */}
            <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Residents to Watch</Text>
                {residentsToWatch.length > 0 ? (
                    residentsToWatch.map((resident) => (
                        <View key={resident.id} style={styles.watchItem}>
                            <Text style={styles.itemTitle}>
                                {resident.name} ({resident.id})
                            </Text>
                            <Text style={styles.itemDescription}>
                                Reason: {resident.reason}
                            </Text>
                        </View>
                    ))
                ) : (
                    <Text style={styles.noDataText}>
                        No specific residents flagged for close observation.
                    </Text>
                )}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: "#f9f9f9",
        borderRadius: 8,
        marginVertical: 10,
        marginHorizontal: 10,
        padding: 15,
        maxHeight: 350, // Limit height to prevent excessive scrolling
        borderWidth: 1,
        borderColor: "#eee",
    },
    mainTitle: {
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 15,
        textAlign: "center",
        color: "#333",
    },
    sectionContainer: {
        marginBottom: 20,
        backgroundColor: "#fff",
        padding: 10,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: "#ddd",
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 8,
        color: "#555",
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
        paddingBottom: 4,
    },
    notesText: {
        fontSize: 14,
        color: "#444",
        lineHeight: 20,
    },
    incidentItem: {
        marginBottom: 10,
        paddingBottom: 5,
        borderBottomWidth: 1,
        borderBottomColor: "#f0f0f0",
    },
    watchItem: {
        marginBottom: 8,
    },
    itemTitle: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#007bff", // Highlight title
        marginBottom: 3,
    },
    itemDescription: {
        fontSize: 13,
        color: "#666",
    },
    noDataText: {
        fontSize: 14,
        color: "#777",
        fontStyle: "italic",
    },
});

export default ShiftSummary;
