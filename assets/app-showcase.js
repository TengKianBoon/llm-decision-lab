(function () {
  const previousBuildJudgePrompt = window.buildJudgePrompt;

  if (typeof previousBuildJudgePrompt !== "function") return;

  window.buildJudgePrompt = function enhancedShowcaseJudgePrompt(input, analyses) {
    const basePrompt = previousBuildJudgePrompt(input, analyses);

    const enhancedGoal = `Goal:
Use an evaluation-harness mindset: define the outcome, translate the outcome into a rubric, act as the grader, compare and contrast the four answers, borrow the best parts from each, reason from first principles and best practices, ask the human if the facts are insufficient, and produce the best consolidated final answer.`;

    const enhancedRules = `Rules:
1. Do not simply average the answers.
2. Restate the desired outcome in one sentence: what "done" means for this question.
3. Convert that outcome into a compact rubric before scoring.
4. State the first-principles criteria you used, using the project context as the configured first-principles source mix.
5. Identify what each answer gets right and wrong.
6. If two directions are tied 2 vs 2, present both options and ask the human to choose.
7. If you can decide, produce one final consolidated answer and explain why it is best.
8. Include an XY table where X = first-principles strength and Y = execution clarity.
9. Preserve useful details from weaker answers when they improve the final.
10. Use blind labels during judging if the answers are labeled Answer A-D; do not infer model quality from model names.
11. Run two passes: first judge each answer independently, then re-rank after comparing deltas, consensus, unique contributions, and gaps.
12. Before finalizing, run an adversarial review against the winning answer and state what would make it fail.
13. Keep the final recommendation traceable: show which ideas were selected, rejected, borrowed, or escalated to the human.`;

    const enhancedOutput = `Required output:
1. Outcome statement.
2. Rubric used by the grader.
3. Claim extraction table for all four answers.
4. Pass 1 independent score and short justification for each answer.
5. Pass 2 adjusted score after delta analysis.
6. XY comparison table for all four answers.
7. Delta analysis: unique strengths, missing pieces, contradictions, and what to borrow.
8. Adversarial review of the proposed winner.
9. Human questions, only if needed.
10. Final consolidated answer.
11. Explanation of why this final answer is the best available decision.`;

    return basePrompt
      .replace(/Goal:\nCompare and contrast[\s\S]*?final answer\./, enhancedGoal)
      .replace(/Rules:\n1\. Do not simply average[\s\S]*?state what would make it fail\./, enhancedRules)
      .replace(/Required output:\n1\. Claim extraction[\s\S]*?best available decision\./, enhancedOutput);
  };
})();
