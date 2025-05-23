import React, { useState } from "react";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    Button,
    FlatList,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Image,
    StatusBar as RNStatusBar,
    TouchableOpacity,
} from "react-native";
import { OPENAI_API_KEY } from "@env";
import OpenAI from "openai";
import mockDb from "./mock_db.json"; // Import the mock database
import TimelineGraph from "./src/components/TimelineGraph"; // Import graph component
import {
    getWeeklyFallsForResident,
    getWeeklyBathroomVisitsForResident,
    getShiftSummaryData, // Import shift summary function
    ShiftSummaryData, // Import type for state
} from "./src/utils/dataProcessor"; // Import data processing functions
import ShiftSummary from "./src/components/ShiftSummary"; // Import ShiftSummary
import moment from "moment"; // Import moment
import { Ionicons } from "@expo/vector-icons"; // Import Ionicons

// Color Constant
const VAYYAR_BLUE = "#06aeef";

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
    dangerouslyAllowBrowser: true,
});

// System prompt describing the AI's role and data context
const SYSTEM_PROMPT_BASE = `You are Vayyar Care, a specialized AI assistant for nurses in a senior living facility. Maintain a positive, professional, and pleasant tone.
Your primary goal is to provide clear and concise information based on the provided data context and conversation history.

You have access to information about residents, staff, rooms, incidents (like falls), medications, shifts, and activities.
Key resident fields: id, name, dob, roomNumber, conditions, allergies, fallRisk, notes.
Key incident fields: id, residentId, type, timestamp, location, description, witnessedBy.
Key activity fields: id, residentId, type, timestamp, staffId, outcome.

Keep your answers brief and to the point. Avoid unnecessary elaboration.

**IMPORTANT:** If the user asks for a graph/chart/weekly summary and the following messages provide aggregated weekly data, acknowledge that the graph is being displayed visually in the app. Then, provide a brief textual summary based *only* on the aggregated weekly data provided in the prompt. Do not mention your inability to graph directly in this case. Focus on summarizing the trends shown in the data (e.g., 'Okay, I'm showing the graph now. We see one fall occurred in the week of Apr 21-27.').`;

// Combine base prompt with the actual database content (FOR TEMPORARY USE - INEFFICIENT)
const FULL_SYSTEM_PROMPT = `${SYSTEM_PROMPT_BASE}\n\nHere is the current facility data:\n\`\`\`json\n${JSON.stringify(
    mockDb,
    null,
    2
)}\n\`\`\``;

interface Message {
    id: string;
    text: string;
    sender: "user" | "assistant";
}

// Define type for chart data state
interface ChartState {
    data: { weekLabel: string; count: number }[];
    title: string;
    dataTypeLabel: string;
}

export default function App() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showChart, setShowChart] = useState(false); // State for chart visibility
    const [chartState, setChartState] = useState<ChartState | null>(null); // State for chart data/config
    const [showShiftSummary, setShowShiftSummary] = useState(false); // State for summary visibility
    const [shiftSummaryData, setShiftSummaryData] =
        useState<ShiftSummaryData | null>(null); // State for summary data

    // Format current date
    const currentDateFormatted = moment().format("MMMM D, YYYY");

    // --- Helper: Basic keyword detection for resident ID ---
    // (Very basic - needs improvement for real use)
    const extractResidentId = (text: string): string | null => {
        const lowerText = text.toLowerCase();
        const residentMatch = lowerText.match(/res_[0-9]+/);
        if (residentMatch) return residentMatch[0];

        if (lowerText.includes("eleanor vance")) return "res_001";
        if (lowerText.includes("arthur pendelton")) return "res_002";
        if (lowerText.includes("beatrice miller")) return "res_003";

        return null; // Or prompt user for ID
    };

    const handleSend = async () => {
        if (inputText.trim().length === 0 || isLoading) return;

        const userMessageText = inputText.trim();
        const lowerText = userMessageText.toLowerCase();
        setInputText("");
        // Reset UI elements on new message
        setShowChart(false);
        setChartState(null);
        setShowShiftSummary(false);
        setShiftSummaryData(null);

        const newUserMessage: Message = {
            id: Date.now().toString(),
            text: userMessageText,
            sender: "user",
        };

        const updatedMessages = [...messages, newUserMessage];
        setMessages(updatedMessages);

        // --- Component Trigger Logic ---
        let shouldGenerateChart = false;
        let shouldGenerateSummary = false;
        let residentId: string | null = null;
        let newChartState: ChartState | null = null;
        let newSummaryData: ShiftSummaryData | null = null;
        let apiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];

        // Check for Shift Summary Request FIRST
        if (
            lowerText.includes("shift summary") ||
            lowerText.includes("handover")
        ) {
            shouldGenerateSummary = true;
            // Simple logic: Assume Day shift wants previous Night summary, Night wants previous Day
            const currentHour = moment().hour();
            const targetShiftType: "Day" | "Night" =
                currentHour >= 7 && currentHour < 19 ? "Day" : "Night"; // Determine current shift
            newSummaryData = getShiftSummaryData(targetShiftType, moment());
            console.log(
                "Shift summary requested. Processed data:",
                newSummaryData
            );

            // ** Prepare tailored prompt for summary **
            apiMessages = [
                { role: "system", content: SYSTEM_PROMPT_BASE },
                { role: "user", content: userMessageText },
                {
                    // Add context about the summary being shown
                    role: "assistant",
                    content: `Okay, generating the shift summary. Key points:\n- Previous Handover: ${
                        newSummaryData.previousShiftNotes ? "Provided" : "None"
                    }\n- Recent Incidents: ${
                        newSummaryData.recentIncidents.length
                    }\n- Residents to Watch: ${
                        newSummaryData.residentsToWatch.length
                    }`,
                },
            ];
            console.log("Sending tailored prompt for shift summary.");
        } // Check for Chart Request SECOND (else if)
        else if (
            lowerText.includes("graph") ||
            lowerText.includes("chart") ||
            lowerText.includes("weekly") ||
            lowerText.includes("monthly")
        ) {
            residentId = extractResidentId(lowerText);

            if (residentId) {
                if (lowerText.includes("falls")) {
                    const chartData = getWeeklyFallsForResident(residentId, 30); // Default to last 30 days
                    newChartState = {
                        data: chartData,
                        title: `Weekly Falls - Last 30 Days (${residentId})`,
                        dataTypeLabel: "Falls",
                    };
                    shouldGenerateChart = true;
                } else if (
                    lowerText.includes("bathroom") ||
                    lowerText.includes("visits")
                ) {
                    const chartData = getWeeklyBathroomVisitsForResident(
                        residentId,
                        30
                    );
                    newChartState = {
                        data: chartData,
                        title: `Weekly Bathroom Visits - Last 30 Days (${residentId})`,
                        dataTypeLabel: "Visits",
                    };
                    shouldGenerateChart = true;
                }
            }
            // Add more conditions for other chart types if needed
        }

        if (shouldGenerateSummary && newSummaryData) {
            setShiftSummaryData(newSummaryData);
            setShowShiftSummary(true);
        }
        if (shouldGenerateChart && newChartState) {
            setChartState(newChartState);
            setShowChart(true);

            // ** Prepare tailored prompt for graph **
            apiMessages = [
                { role: "system", content: SYSTEM_PROMPT_BASE },
                { role: "user", content: userMessageText },
                {
                    // Add context about the graph being shown and the summary data
                    role: "assistant",
                    content: `Okay, displaying a graph of ${
                        newChartState.dataTypeLabel
                    } for ${residentId}. Here is the weekly summary data:\n${JSON.stringify(
                        newChartState.data
                    )}`,
                },
            ];
            console.log("Sending tailored prompt for graph summary.");
        } else {
            // ** Send standard prompt with full DB **
            apiMessages = [
                { role: "system", content: FULL_SYSTEM_PROMPT },
                ...updatedMessages.map((msg) => ({
                    role: msg.sender,
                    content: msg.text,
                })),
            ];
            console.log(
                `Sending ${apiMessages.length} messages including full DB in system prompt.`
            );
        }
        // --- End Component Trigger Logic ---

        setIsLoading(true);
        console.log("Attempting API call...");

        try {
            // Call the OpenAI API (apiMessages is now in scope)
            const completion = await openai.chat.completions.create({
                messages: apiMessages,
                model: "gpt-3.5-turbo",
            });
            console.log(
                "API call successful. Completion object:",
                JSON.stringify(completion, null, 2)
            );

            const assistantReply = completion.choices[0]?.message?.content;
            console.log("Extracted assistant reply:", assistantReply);

            if (assistantReply) {
                const newAssistantMessage: Message = {
                    id: completion.id,
                    text: assistantReply.trim(),
                    sender: "assistant",
                };
                setMessages((prevMessages) => [
                    ...prevMessages,
                    newAssistantMessage,
                ]);
                console.log("Adding assistant message to state.");
            } else {
                console.warn("No reply content found in completion object.");
            }
        } catch (error) {
            console.error("Error in API call catch block:", error);
            const errorMessage: Message = {
                id: Date.now().toString() + "-error",
                text: `Error: ${
                    error instanceof Error
                        ? error.message
                        : "Failed to get response"
                }`,
                sender: "assistant",
            };
            setMessages((prevMessages) => [...prevMessages, errorMessage]);
        } finally {
            console.log("API call process finished. Setting isLoading=false.");
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header Section */}
            <View style={styles.header}>
                {/* Vayyar Logo */}
                <Image
                    source={require("./assets/vayyar-logo.png")} // Use local logo asset
                    style={styles.logo}
                />
                {/* Use local nurse avatar */}
                <Image
                    source={require("./assets/nurse.jpg")} // Use local asset
                    style={styles.avatar}
                />
            </View>

            {/* Main Content Area - FlatList takes remaining space */}
            <FlatList
                data={messages}
                renderItem={({ item }) => (
                    <View
                        style={[
                            styles.messageBubble,
                            item.sender === "user"
                                ? styles.userMessage
                                : styles.assistantMessage,
                        ]}
                    >
                        <Text style={styles.messageText}>{item.text}</Text>
                    </View>
                )}
                keyExtractor={(item) => item.id}
                style={styles.messageList} // Ensure FlatList has flex: 1
                contentContainerStyle={styles.messageListContent}
                ListEmptyComponent={
                    !isLoading ? (
                        <Text style={styles.emptyText}>No messages yet.</Text>
                    ) : null
                }
            />

            {/* Separator Line - Moved above KAV */}
            <View style={styles.separator} />

            {/* Conditionally render Summary - Moved outside KAV */}
            {showShiftSummary && (
                <View style={styles.summaryContainer}>
                    <ShiftSummary data={shiftSummaryData} />
                </View>
            )}

            {/* Conditionally render Graph - Moved outside KAV */}
            {showChart && chartState && (
                <View style={styles.graphContainer}>
                    <TimelineGraph
                        title={chartState.title}
                        data={chartState.data}
                        dataTypeLabel={chartState.dataTypeLabel}
                    />
                </View>
            )}

            {/* Keyboard Avoiding View wrapping only the input area */}
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardAvoidingViewWrapper} // Use a dedicated style for the wrapper
                keyboardVerticalOffset={0} // Often 0 when just wrapping input
            >
                {isLoading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color={VAYYAR_BLUE} />
                        <Text style={styles.loadingText}>Thinking...</Text>
                    </View>
                )}
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Ask Vayyar something..."
                        placeholderTextColor="#999"
                        editable={!isLoading}
                    />
                    {/* Loading Indicator or Send Button */}
                    {isLoading ? (
                        <ActivityIndicator
                            size="small"
                            color={VAYYAR_BLUE}
                            style={styles.sendButtonContainer}
                        />
                    ) : (
                        <TouchableOpacity
                            style={styles.sendButtonContainer}
                            onPress={handleSend}
                            disabled={isLoading}
                        >
                            <Image
                                source={require("./assets/vayyar-logo-white.png")}
                                style={styles.sendButtonIcon}
                            />
                        </TouchableOpacity>
                    )}
                </View>
            </KeyboardAvoidingView>
            {/* Use ExpoStatusBar for general style */}
            <ExpoStatusBar style="auto" />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f7f9fc", // Light background for the whole app
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 15,
        paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight : 10,
        paddingBottom: 10,
        backgroundColor: "#ffffff", // White background for header
        borderBottomWidth: 1,
        borderBottomColor: "#e0e0e0", // Subtle border
    },
    logo: {
        width: 100, // Adjust width as needed
        height: 25, // Adjust height as needed
        resizeMode: "contain", // Ensure logo scales correctly
    },
    dateText: {
        fontSize: 16,
        color: "#555",
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20, // Make it circular
    },
    keyboardAvoidingViewWrapper: {
        width: "100%",
        // No flex: 1 needed here
    },
    messageList: {
        flex: 1, // Make FlatList take available space
        paddingHorizontal: 10,
    },
    messageListContent: {
        paddingBottom: 10,
        paddingTop: 15, // Add top padding
    },
    inputContainer: {
        flexDirection: "row",
        padding: 15,
        borderTopWidth: 1,
        borderTopColor: "#e0e0e0", // Match header border
        backgroundColor: "#ffffff", // White background for input area
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: "#dcdcdc",
        borderRadius: 20, // Rounded corners
        paddingHorizontal: 15,
        paddingVertical: 10,
        marginRight: 10,
        backgroundColor: "#fff",
    },
    messageBubble: {
        padding: 10,
        borderRadius: 15,
        marginBottom: 10,
        maxWidth: "80%",
    },
    userMessage: {
        backgroundColor: "#007bff",
        alignSelf: "flex-end",
    },
    assistantMessage: {
        backgroundColor: "#e0e0e0",
        alignSelf: "flex-start",
    },
    messageText: {
        color: "#000",
    },
    emptyText: {
        textAlign: "center",
        marginTop: 20,
        color: "#999",
    },
    sendButtonContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: VAYYAR_BLUE,
        justifyContent: "center",
        alignItems: "center",
        marginLeft: 10,
    },
    loadingContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 5,
    },
    loadingText: {
        marginLeft: 5,
        color: "#999",
    },
    graphContainer: {
        paddingHorizontal: 10,
    },
    summaryContainer: {
        // paddingHorizontal: 10, // Example
    },
    separator: {
        height: 1,
        backgroundColor: "#e0e0e0",
        marginHorizontal: 0, // Make it full width if needed, or adjust
    },
    loadingIndicator: {
        marginLeft: 10,
        alignSelf: "center",
    },
    sendButtonIcon: {
        width: 24,
        height: 24,
        resizeMode: "contain",
    },
});
