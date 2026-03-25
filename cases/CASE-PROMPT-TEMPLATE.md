# Audio XX — Case Extraction Prompt Template

Use this prompt when converting a real conversation into a structured Audio XX case.

---

## Task
Convert this conversation into a structured Audio XX case and generate system-aware rules.

[Describe the conversation type in one line, e.g.:]
This case involves a shopping query without a clearly stated problem.

## Objective
Do NOT treat this as a product ranking task.

Your goal is to:
1. Identify whether the user has a real problem or just curiosity
2. Prevent premature product recommendations
3. Model correct advisory behavior for this situation

## Audio XX Axes
- smooth_to_crisp
- relaxed_to_dynamic
- dense_to_open
- forgiving_to_resolving

## Core Principles
- Do not assume the user needs an upgrade
- A ranked list of products is NOT a valid default response
- If no dissatisfaction is stated, the correct first move is to clarify intent
- "Do nothing" is a valid outcome
- System interaction matters more than product ranking

## Output

### 1. Case Summary
### 2. YAML Case
### 3. YAML Rules

## Conversation
[attached or pasted]
