import React from "react";
import { View, Text, Dimensions, StyleSheet } from "react-native";
import { BarChart } from "react-native-chart-kit";

interface TimelineGraphProps {
    title: string;
    dataTypeLabel: string; // e.g., "Falls", "Visits"
    data: { weekLabel: string; count: number }[];
}

const screenWidth = Dimensions.get("window").width;

const TimelineGraph: React.FC<TimelineGraphProps> = ({
    title,
    data,
    dataTypeLabel,
}) => {
    if (!data || data.length === 0) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.noDataText}>
                    No data available for this period.
                </Text>
            </View>
        );
    }

    const chartData = {
        labels: data.map((item) => item.weekLabel), // Week labels: "Apr 1-7", "Apr 8-14", ...
        datasets: [
            {
                data: data.map((item) => item.count), // Corresponding counts
            },
        ],
    };

    const chartConfig = {
        backgroundGradientFrom: "#ffffff",
        backgroundGradientTo: "#ffffff",
        decimalPlaces: 0, // No decimal places for counts
        color: (opacity = 1) => `rgba(0, 123, 255, ${opacity})`, // Blue bars
        labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`, // Black labels
        style: {
            borderRadius: 16,
        },
        propsForDots: {
            r: "6",
            strokeWidth: "2",
            stroke: "#007bff",
        },
        propsForLabels: {
            fontSize: 9, // Smaller font size for week labels
        },
        barPercentage: 0.6, // Adjust bar width
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{title}</Text>
            <BarChart
                style={styles.graphStyle}
                data={chartData}
                width={screenWidth - 30} // Adjust padding as needed
                height={220}
                yAxisLabel=""
                yAxisSuffix={` ${dataTypeLabel.substring(0, 1)}`} // e.g., "F" for Falls
                chartConfig={chartConfig}
                verticalLabelRotation={0} // Keep labels horizontal
                fromZero={true} // Start y-axis at zero
                showValuesOnTopOfBars={true}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: "#ffffff",
        borderRadius: 16,
        padding: 15,
        marginVertical: 10,
        alignItems: "center", // Center chart
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
        elevation: 2,
    },
    title: {
        fontSize: 16,
        fontWeight: "bold",
        marginBottom: 10,
    },
    graphStyle: {
        marginVertical: 8,
        borderRadius: 16,
    },
    noDataText: {
        color: "#666",
        fontStyle: "italic",
    },
});

export default TimelineGraph;
