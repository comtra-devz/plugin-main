# Testing Environment

## Purpose
This folder contains the **Staging** version of the Comtra plugin. 
It is used for:
1. Testing new AI prompts.
2. Debugging layout changes.
3. Simulating Stripe flows without real payments.

## Differences from PROD
- **Visuals**: Has "TEST" badges in UI.
- **Controller**: Simulates successful API calls even if Figma fails.
- **AI**: Uses a lower-tier/mocked AI response for cost saving.

## Do Not Deploy
This folder must **NEVER** be pushed to the production branch of Antigravity.