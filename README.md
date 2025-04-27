# Vayyar Care - Nurse Assistant App

This React Native application serves as an on-site assistant for nurses working in senior living facilities, powered by AI.

## Key Features

-   **AI-Powered Assistance:** Utilizes OpenAI to provide intelligent responses and summaries.
-   **Shift Summaries:** Generates clearly formatted summaries of nursing shifts.
-   **Fall Documentation:** Provides a structured way to document patient fall events.
-   **Patient Data Insights:**
    -   Query patient information (future: database integration).
    -   Current: Analyze uploaded documents (e.g., bathroom visit logs).
    -   Display monthly patient breakdowns via text or graphs.
-   **Patient-Specific Q&A:** Answer questions about individual patients, such as:
    -   Fall history (e.g., "How many times did patient X fall last month?")
    -   Fall risk assessment.
    -   Answers presented as text or graphs.
-   **Real-time Fall Alerts:** Receives notifications from a server when a patient fall is detected and alerts the nurse.

## Technology Stack

-   React Native (Expo)
-   TypeScript
-   OpenAI API

## Setup & Installation

1.  **Clone the repository (if applicable):**
    ```bash
    git clone <repository-url>
    cd vayyar-care-app
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Set up environment variables:**
    -   Create a `.env` file in the project root.
    -   Add your OpenAI API key:
        ```
        OPENAI_API_KEY="YOUR_API_KEY_HERE"
        ```
    -   **Important:** Add `.env` to your `.gitignore` file to avoid committing your key.

## Running the App

1.  **Start the Metro bundler and run on a simulator/device:**

    -   For iOS: `npm run ios`
    -   For Android: `npm run android`
    -   For Web (if configured): `npm run web`

2.  Follow the prompts in the terminal to open the app on your chosen platform.
