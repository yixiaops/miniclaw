---
name: weather
description: "Get weather information and forecasts. Triggers: weather, temperature, forecast"
---

# Weather Skill

This skill helps you get weather information for any location.

## When to Use

- "What's the weather in Beijing?"
- "Will it rain tomorrow?"
- "Get the forecast for this weekend"

## How to Use

1. Use the web_fetch tool to query wttr.in
2. Format the response for the user

## Example

```
Query: wttr.in/Beijing?format=3
Response: Beijing: ☀️ +15°C
```

## Constraints

- Always verify location name before querying
- Use simple format for quick responses