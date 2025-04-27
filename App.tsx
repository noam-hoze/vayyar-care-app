import React, { useState } from "react";
import { StatusBar } from "expo-status-bar";
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
} from "react-native";
import { OPENAI_API_KEY } from "@env";
import OpenAI from "openai";
import mockDb from "./mock_db.json"; // Import the mock database
import TimelineGraph from "./src/components/TimelineGraph"; // Import graph component
import {
    getWeeklyFallsForResident,
    getWeeklyBathroomVisitsForResident,
} from "./src/utils/dataProcessor"; // Import data processing functions

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
        setInputText("");
        setShowChart(false); // Hide chart by default on new message
        setChartState(null);

        const newUserMessage: Message = {
            id: Date.now().toString(),
            text: userMessageText,
            sender: "user",
        };

        const updatedMessages = [...messages, newUserMessage];
        setMessages(updatedMessages);

        // --- Chart Trigger Logic ---
        let shouldGenerateChart = false;
        const lowerText = userMessageText.toLowerCase();
        let residentId: string | null = null;
        let chartData: { weekLabel: string; count: number }[] | null = null;
        let newChartState: ChartState | null = null;

        // Prepare API messages based on whether a chart is shown
        let apiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]; // Declare outside

        if (
            lowerText.includes("graph") ||
            lowerText.includes("chart") ||
            lowerText.includes("weekly") ||
            lowerText.includes("monthly")
        ) {
            residentId = extractResidentId(lowerText);

            if (residentId) {
                if (lowerText.includes("falls")) {
                    chartData = getWeeklyFallsForResident(residentId, 30); // Default to last 30 days
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
                    chartData = getWeeklyBathroomVisitsForResident(
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

        if (shouldGenerateChart && newChartState) {
            console.log("Graph requested. Processed data:", newChartState.data);
            setChartState(newChartState);
            setShowChart(true);

            // ** Send tailored prompt for graph **
            apiMessages = [
                { role: "system", content: SYSTEM_PROMPT_BASE },
                { role: "user", content: userMessageText },
                {
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
        // --- End Chart Trigger Logic / API Message Prep ---

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
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardAvoidingView}
                keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
            >
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
                    style={styles.messageList}
                    contentContainerStyle={styles.messageListContent}
                    ListEmptyComponent={
                        !isLoading ? (
                            <Text style={styles.emptyText}>
                                No messages yet.
                            </Text>
                        ) : null
                    }
                />

                {/* Conditionally render the graph */}
                {showChart && chartState && (
                    <View style={styles.graphContainer}>
                        <TimelineGraph
                            title={chartState.title}
                            data={chartState.data}
                            dataTypeLabel={chartState.dataTypeLabel}
                        />
                    </View>
                )}

                {isLoading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color="#007bff" />
                        <Text style={styles.loadingText}>Thinking...</Text>
                    </View>
                )}
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Type your message..."
                        placeholderTextColor="#999"
                        editable={!isLoading}
                    />
                    {isLoading ? (
                        <ActivityIndicator
                            size="small"
                            color="#007bff"
                            style={styles.sendButtonLoading}
                        />
                    ) : (
                        <Button
                            title="Send"
                            onPress={handleSend}
                            disabled={isLoading}
                        />
                    )}
                </View>
            </KeyboardAvoidingView>
            <StatusBar style="auto" />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f5f5f5",
    },
    keyboardAvoidingView: {
        flex: 1,
    },
    messageList: {
        flex: 1,
        paddingHorizontal: 10,
    },
    messageListContent: {
        paddingBottom: 10,
    },
    inputContainer: {
        flexDirection: "row",
        padding: 10,
        borderTopWidth: 1,
        borderTopColor: "#e0e0e0",
        backgroundColor: "#fff",
        alignItems: "center",
    },
    input: {
        flex: 1,
        height: 40,
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 20,
        paddingHorizontal: 15,
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
    sendButtonLoading: {
        marginHorizontal: 10,
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
});
