# LLM Decision Lab

LLM Decision Lab is a static HTML app for comparing four LLM answers to the same question, borrowing the best parts from each, and producing a more grounded consolidated answer.

It is designed for workflows where the project background matters. The app can load or paste project instructions, then score answers using a default first-principles mix of 60% project context and 40% current question.

## Features

- Four-answer comparison workspace
- Project context import from selected files or folders
- Adjustable 60/40 first-principles weighting
- Blind labels to reduce model-name bias
- Claim extraction for core claim, assumptions, evidence, actions, and risks
- Two-pass judging with score movement
- Adversarial review of the likely winner
- Delta analysis for what to borrow and what to fix
- Human clarification questions when the decision is uncertain
- XY map for first-principles strength vs execution clarity
- Copyable judge prompt for deeper review by a real LLM
- Process-flow guide infographic

## Files

- `index.html` opens the app for GitHub Pages.
- `llm-deliberation-app.html` is the main app.
- `llm-decision-flow.html` explains the process flow.

## How To Use

1. Open `index.html` or `llm-deliberation-app.html`.
2. Paste or load project instructions.
3. Paste the original question and constraints.
4. Paste the four LLM answers.
5. Click `Analyze`.
6. Review the scores, claims, two-pass results, adversarial review, and consolidated draft.
7. Copy the judge prompt into a stronger LLM when you want deeper reasoning.

## GitHub Pages

This repository is ready for GitHub Pages as a static site. After uploading:

1. Open the repository on GitHub.
2. Go to `Settings` -> `Pages`.
3. Set the source to the default branch and root folder.
4. Open the published Pages URL.

## Important Limitation

The app is pure static HTML. It can organize, score heuristically, and generate a strong judge prompt, but it does not silently read arbitrary local files and it does not perform true LLM reasoning unless connected to a model separately.
