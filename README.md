# LLM Decision Lab

LLM Decision Lab is a static HTML decision-harness app for comparing four LLM answers to the same question, borrowing the best parts from each, and producing a more grounded consolidated answer.

It is designed for workflows where the project background matters. The app can load or paste project instructions, then score answers using a default first-principles mix of 60% project context and 40% current question.

## Showcase Framing

This project demonstrates a practical `Outcomes -> Rubrics -> Graders` workflow for agentic and multi-agent decision work:

- Outcome: define what "done" means for the current question.
- Rubric: turn the outcome into scoring axes such as project fit, relevance, reasoning, completeness, practicality, specificity, and risk.
- Grader: use the local heuristic grader for structure, then use the copyable judge prompt with a real LLM for deeper reasoning.
- Review loop: compare four parallel answers, extract claims, run two-pass judging, and stress-test the likely winner.
- Human gate: ask for human judgment when there is a tie, missing fact, preference tradeoff, or high-risk assumption.

In plain English, the app is a small example of harness engineering: the model outputs are not trusted raw. They are wrapped in context, criteria, grading, adversarial review, traceable deltas, and human approval.

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
- `assets/` contains the app CSS and JavaScript.

## Best-Practice Ideas Reflected

- Parallel perspectives: four answers create diversity before synthesis.
- Evaluator-optimizer loop: scoring and feedback improve the final answer.
- Traceable grading: score movement, claim extraction, and deltas show why the decision changed.
- Governance habit: human approval remains explicit when the app cannot decide safely.
- Privacy by design: the app runs as a static browser page and only reads files the user selects.

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

## Reference Concepts

- OpenAI evals and graders
- OpenAI trace grading for agent workflows
- Anthropic agent workflow patterns, especially parallelization and evaluator-optimizer loops
- NIST AI RMF ideas on measurement, independent review, and documented risk controls
