function getInputs() {
      return {
        projectContext: $("projectContextInput").value.trim(),
        projectWeight: getProjectWeight(),
        blindLabels: $("blindLabelsInput").checked,
        claimExtraction: $("claimExtractionInput").checked,
        twoPass: $("twoPassInput").checked,
        adversarialReview: $("adversarialInput").checked,
        question: $("questionInput").value.trim(),
        constraints: $("constraintsInput").value.trim(),
        names: [0, 1, 2, 3].map((i) => $(`name${i}`).value.trim() || `LLM ${String.fromCharCode(65 + i)}`),
        answers: [0, 1, 2, 3].map((i) => $(`answer${i}`).value.trim())
      };
    }

    function analyze() {
      const input = getInputs();
      const analyses = input.answers.map((answer, index) => {
        const base = scoreAnswer(answer, input.question, input.constraints, input.projectContext, input.projectWeight);
        const details = strengthsAndGaps(base);
        const claims = extractClaims(answer);
        const recommendation = extractRecommendation(answer);
        return {
          index,
          name: input.names[index],
          displayName: input.blindLabels ? blindLabel(index) : input.names[index],
          answer,
          claims,
          recommendation,
          ...base,
          ...details,
          topTerms: topTerms(answer, 10)
        };
      });

      state.analyses = applyTwoPassJudging(analyses, input);
      updateAnswerCards(state.analyses);
      renderResults(input, state.analyses);
      $("results").hidden = false;
      $("results").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function updateAnswerCards(analyses) {
      analyses.forEach((analysis, index) => {
        const score = Number.isFinite(analysis.total) ? analysis.total : 0;
        $(`score${index}`).textContent = analysis.answer ? score : "--";
        $(`score${index}`).style.background = analysis.answer ? badgeColor(score) : "#7a8496";
        $(`x${index}`).textContent = analysis.answer ? analysis.x : "--";
        $(`y${index}`).textContent = analysis.answer ? analysis.y : "--";
        $(`risk${index}`).textContent = analysis.answer ? analysis.metrics.risk : "--";
      });
    }

    function renderResults(input, analyses) {
      analyses.forEach((item) => {
        item.displayName = input.blindLabels ? blindLabel(item.index) : item.name;
      });
      const active = analyses.filter((item) => item.answer);
      const ranked = [...active].sort((a, b) => b.total - a.total);
      const winner = ranked[0];
      const second = ranked[1];
      const margin = winner && second ? winner.total - second.total : 0;
      const prompt = buildJudgePrompt(input, analyses);
      state.lastPrompt = prompt;
      $("judgePrompt").value = prompt;

      $("snapshot").innerHTML = renderSnapshot(winner, second, margin, active);
      $("statusPills").innerHTML = renderStatusPills(input, ranked, margin);
      $("scoreTable").innerHTML = renderScoreRows(active);
      $("twoPassJudging").innerHTML = renderTwoPassJudging(input, active);
      $("claimExtraction").innerHTML = renderClaimExtraction(input, active);
      $("xyTable").innerHTML = renderXYRows(active);
      $("principleSources").innerHTML = renderPrincipleSources(input, active);
      $("deltaAnalysis").innerHTML = renderDelta(input, active);
      $("humanQuestions").innerHTML = renderHumanQuestions(input, ranked, margin, active);
      $("adversarialReview").innerHTML = renderAdversarialReview(input, ranked, active);
      $("finalDraft").textContent = buildFinalDraft(input, ranked, active);
      drawXY(active);
    }

    function renderSnapshot(winner, second, margin, active) {
      if (!active.length) {
        return `<p class="small-note">Paste at least one answer, then analyze.</p>`;
      }

      const secondLine = second
        ? `<p class="small-note">Runner-up: <strong>${escapeHtml(itemLabel(second))}</strong> at ${second.total}. Margin: ${margin} point${margin === 1 ? "" : "s"}.</p>`
        : "";

      return `
        <p><strong>Best current backbone:</strong> ${escapeHtml(itemLabel(winner))} with ${winner.total}/100.</p>
        <div class="meter" aria-label="Winning score"><span style="width:${winner.total}%; background:${badgeColor(winner.total)}"></span></div>
        ${secondLine}
        <p class="small-note">${escapeHtml(primaryReason(winner))}</p>
      `;
    }

    function renderStatusPills(input, ranked, margin) {
      const pills = [];
      if (!input.question.trim()) pills.push(`<span class="pill red">Question missing</span>`);
      if (!input.constraints.trim()) pills.push(`<span class="pill amber">No constraints</span>`);
      if (ranked.length < 4) pills.push(`<span class="pill amber">${ranked.length}/4 answers filled</span>`);
      if (ranked.length >= 2 && margin <= 3) pills.push(`<span class="pill red">Near tie</span>`);
      if (ranked.length >= 2 && margin > 10) pills.push(`<span class="pill green">Clear lead</span>`);
      if (ranked.some((item) => item.metrics.risk < 45)) pills.push(`<span class="pill amber">Risk gaps</span>`);
      if (input.blindLabels) pills.push(`<span class="pill green">Blind labels</span>`);
      if (input.twoPass) pills.push(`<span class="pill green">Two-pass</span>`);
      if (input.adversarialReview) pills.push(`<span class="pill amber">Adversarial review</span>`);
      if (!pills.length) pills.push(`<span class="pill green">Ready for judge review</span>`);
      return pills.join("");
    }

    function renderScoreRows(active) {
      if (!active.length) {
        return `<tr><td colspan="9">No answers yet.</td></tr>`;
      }

      return [...active]
        .sort((a, b) => b.total - a.total)
        .map((item) => `
          <tr>
            <td><strong>${escapeHtml(itemLabel(item))}</strong></td>
            <td><strong>${item.total}</strong></td>
            <td>${item.metrics.relevance}</td>
            <td>${typeof item.metrics.projectFit === "number" ? item.metrics.projectFit : "--"}</td>
            <td>${item.metrics.reasoning}</td>
            <td>${item.metrics.completeness}</td>
            <td>${item.metrics.practicality}</td>
            <td>${item.metrics.specificity}</td>
            <td>${item.metrics.risk}</td>
          </tr>
        `)
        .join("");
    }

    function renderTwoPassJudging(input, active) {
      if (!active.length) return `<p class="small-note">No answers yet.</p>`;
      if (!input.twoPass) return `<p class="small-note">Two-pass judging is off. Turn it on in Judging Upgrades.</p>`;

      const rows = [...active]
        .sort((a, b) => b.total - a.total)
        .map((item) => `
          <tr>
            <td><strong>${escapeHtml(itemLabel(item))}</strong></td>
            <td>${item.pass1Score}</td>
            <td><strong>${item.pass2Score}</strong></td>
            <td>${item.adjustment >= 0 ? "+" : ""}${item.adjustment}</td>
            <td>${escapeHtml(item.twoPassNotes.join(" "))}</td>
          </tr>
        `)
        .join("");

      return `
        <p class="small-note">Pass 1 scores each answer independently. Pass 2 adjusts after seeing consensus, unique contributions, claim completeness, gaps, and direct conflict flags.</p>
        <table>
          <thead>
            <tr>
              <th>Answer</th>
              <th>Pass 1</th>
              <th>Pass 2</th>
              <th>Delta</th>
              <th>Why It Moved</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }

    function renderClaimExtraction(input, active) {
      if (!active.length) return `<p class="small-note">No answers yet.</p>`;
      if (!input.claimExtraction) return `<p class="small-note">Claim extraction is off. Turn it on in Judging Upgrades.</p>`;

      const rows = [...active]
        .sort((a, b) => b.total - a.total)
        .map((item) => `
          <tr>
            <td><strong>${escapeHtml(itemLabel(item))}</strong></td>
            <td>${escapeHtml(shorten(item.claims.recommendation, 180))}</td>
            <td>${escapeHtml(shorten(item.claims.assumptions.join(" | "), 180))}</td>
            <td>${escapeHtml(shorten(item.claims.evidence.join(" | "), 180))}</td>
            <td>${escapeHtml(shorten(item.claims.actions.join(" | "), 180))}</td>
            <td>${escapeHtml(shorten(item.claims.risks.join(" | "), 180))}</td>
          </tr>
        `)
        .join("");

      return `
        <p class="small-note">This pass normalizes each response into comparable claims before the app tries to synthesize them.</p>
        <table>
          <thead>
            <tr>
              <th>Answer</th>
              <th>Core Claim</th>
              <th>Assumptions</th>
              <th>Evidence</th>
              <th>Actions</th>
              <th>Risks</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }

    function renderPrincipleSources(input, active) {
      const weight = typeof input.projectWeight === "number" ? input.projectWeight : 0.6;
      const contextPercent = Math.round(weight * 100);
      const questionPercent = 100 - contextPercent;
      const sourceNames = state.projectFiles.length
        ? state.projectFiles.map((item) => item.name).slice(0, 6)
        : [];
      const projectTerms = topTerms(input.projectContext, 12);
      const questionTerms = topTerms(`${input.question}\n${input.constraints}`, 10);
      const bestProjectFit = active.length ? Math.max(...active.map((item) => item.metrics.projectFit || 0)) : 0;
      const blindMap = input.blindLabels && active.length
        ? active.map((item) => `${itemLabel(item)} = ${item.name}`).join(", ")
        : "";

      const sourceLine = sourceNames.length
        ? sourceNames.map((name) => escapeHtml(name)).join(", ")
        : (input.projectContext ? "No file loaded; using pasted project context." : "No project context loaded.");

      return `
        <p><strong>First-principles source mix:</strong> ${contextPercent}% project context / ${questionPercent}% current question.</p>
        <ul class="analysis-list">
          <li>Loaded source files: ${sourceLine}</li>
          <li>Project signal terms: ${escapeHtml(projectTerms.join(", ") || "none yet")}.</li>
          <li>Question signal terms: ${escapeHtml(questionTerms.join(", ") || "none yet")}.</li>
          <li>Best project-fit score among the four answers: ${bestProjectFit || "--"}.</li>
          ${blindMap ? `<li>Blind label map for you: ${escapeHtml(blindMap)}.</li>` : ""}
        </ul>
      `;
    }

    function renderXYRows(active) {
      if (!active.length) {
        return `<tr><td colspan="4">No answers yet.</td></tr>`;
      }

      return [...active]
        .sort((a, b) => b.total - a.total)
        .map((item) => `
          <tr>
            <td><strong>${escapeHtml(itemLabel(item))}</strong></td>
            <td>${item.x}</td>
            <td>${item.y}</td>
            <td>${escapeHtml(quadrant(item.x, item.y))}</td>
          </tr>
        `)
        .join("");
    }

    function primaryReason(item) {
      const topMetrics = Object.entries(item.metrics)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([name]) => name);
      return `${itemLabel(item)} leads because its strongest dimensions are ${topMetrics.join(" and ")}. Use this as a candidate, not a blind verdict.`;
    }

    function renderDelta(input, active) {
      if (!active.length) return `<p class="small-note">No delta yet.</p>`;

      const consensus = consensusTerms(active);
      const rows = active.map((item) => {
        const uniqueTerms = uniqueTermsFor(item, active);
        return `
          <li><strong>${escapeHtml(itemLabel(item))}:</strong> keep ${escapeHtml(item.strengths.slice(0, 2).join("; "))}; fix ${escapeHtml(item.gaps.slice(0, 2).join("; "))}. Distinct terms: ${escapeHtml(uniqueTerms.join(", ") || "none detected")}.</li>
        `;
      }).join("");

      const checklist = firstPrinciplesChecklist(input, active)
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join("");

      return `
        <p><strong>Consensus:</strong> ${escapeHtml(consensus.join(", ") || "not enough shared signal yet")}.</p>
        <ul class="analysis-list">${rows}</ul>
        <h3 class="section-title" style="margin-top:16px;">First-Principles Check</h3>
        <ul class="analysis-list">${checklist}</ul>
      `;
    }

    function renderHumanQuestions(input, ranked, margin, active) {
      const questions = humanQuestions(input, ranked, margin, active);
      if (!questions.length) {
        return `<p class="small-note">No blocking question detected. A human review is still useful before high-stakes decisions.</p>`;
      }
      return `<ul class="analysis-list">${questions.map((q) => `<li>${escapeHtml(q)}</li>`).join("")}</ul>`;
    }

    function renderAdversarialReview(input, ranked, active) {
      if (!active.length) return `<p class="small-note">No answers yet.</p>`;
      if (!input.adversarialReview) return `<p class="small-note">Adversarial review is off. Turn it on in Judging Upgrades.</p>`;

      const winner = ranked[0];
      const winnerFindings = adversarialFindingsFor(winner, ranked, active, input);
      const allRows = ranked.map((item) => {
        const findings = adversarialFindingsFor(item, ranked, active, input).slice(0, 3);
        return `<li><strong>${escapeHtml(itemLabel(item))}:</strong> ${escapeHtml(findings.join(" "))}</li>`;
      }).join("");

      return `
        <p><strong>Stress-test target:</strong> ${escapeHtml(itemLabel(winner))}.</p>
        <ul class="analysis-list">${winnerFindings.map((finding) => `<li>${escapeHtml(finding)}</li>`).join("")}</ul>
        <h3 class="section-title" style="margin-top:16px;">Per-Answer Attack Notes</h3>
        <ul class="analysis-list">${allRows}</ul>
      `;
    }

    function consensusTerms(active) {
      const counts = new Map();
      active.forEach((item) => unique(item.topTerms).forEach((term) => counts.set(term, (counts.get(term) || 0) + 1)));
      return Array.from(counts.entries())
        .filter(([, count]) => count >= Math.max(2, Math.ceil(active.length * 0.6)))
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 10)
        .map(([term]) => term);
    }

    function uniqueTermsFor(item, active) {
      const others = new Set();
      active
        .filter((candidate) => candidate.index !== item.index)
        .forEach((candidate) => candidate.topTerms.forEach((term) => others.add(term)));
      return item.topTerms.filter((term) => !others.has(term)).slice(0, 6);
    }

    function firstPrinciplesChecklist(input, active) {
      const allAnswers = active.map((item) => item.answer).join("\n").toLowerCase();
      const lines = [];
      const weight = typeof input.projectWeight === "number" ? input.projectWeight : 0.6;
      const contextPercent = Math.round(weight * 100);
      lines.push(input.projectContext ? `Project context is loaded and weighted at ${contextPercent}% of first-principles fit.` : "Project context is missing; first-principles fit comes only from the current question.");
      lines.push(input.question ? "Objective is present in the original question." : "Objective is missing; add the real question before trusting scores.");
      lines.push(input.constraints ? "Constraints are supplied for the judge." : "Constraints are not supplied; scoring may reward the wrong answer.");
      lines.push(hasAny(allAnswers, ["first principle", "root cause", "because", "therefore", "assumption"]) ? "Reasoning chain is discussed somewhere." : "Reasoning chain is weak; ask for assumptions and causal logic.");
      lines.push(hasAny(allAnswers, ["risk", "failure", "edge case", "limitation", "caveat"]) ? "Risks and failure modes appear in at least one answer." : "Risks are mostly absent; require a risk pass.");
      lines.push(hasAny(allAnswers, ["step", "workflow", "table", "checklist", "implementation", "process"]) ? "At least one answer turns the idea into an executable format." : "Execution format is missing; request a process, table, or checklist.");
      return lines;
    }

    function humanQuestions(input, ranked, margin, active) {
      const questions = [];
      if (!input.projectContext.trim()) {
        questions.push("Is there project background or standing instruction context that should constrain the final answer?");
      }

      if (!input.question.trim()) {
        questions.push("What is the exact original question these four answers are trying to solve?");
      } else if (input.question.trim().length < 60) {
        questions.push("What outcome matters most: correctness, speed, cost, safety, explainability, or user experience?");
      }

      if (!input.constraints.trim()) {
        questions.push("What constraints are fixed, and which tradeoffs are acceptable?");
      }

      if (ranked.length >= 2 && margin <= 3) {
        questions.push(`The top two are close: should the final favor ${itemLabel(ranked[0])}'s strengths or ${itemLabel(ranked[1])}'s strengths?`);
      }

      if (active.length === 4) {
        const scores = active.map((item) => item.total);
        if (Math.max(...scores) - Math.min(...scores) < 8) {
          questions.push("All four answers are tightly clustered; should the judge prioritize novelty or consensus?");
        }
      }

      if (active.every((item) => item.metrics.risk < 55)) {
        questions.push("What failure mode would be most costly if the final answer is wrong?");
      }

      if (active.some((item) => item.metrics.relevance < 45)) {
        questions.push("Should low-relevance answers be discarded or mined for isolated useful ideas?");
      }

      return questions.slice(0, 5);
    }

    function extractRecommendation(answer) {
      const sentences = sentenceList(answer);
      const scored = sentences
        .map((sentence) => {
          const lower = sentence.toLowerCase();
          let score = 0;
          if (/\b(recommend|should|choose|decision|therefore|best|final|use|build|implement)\b/.test(lower)) score += 4;
          score += termPresence(sentence, REASONING_TERMS);
          score += termPresence(sentence, PRACTICAL_TERMS);
          if (sentence.length > 280) score -= 2;
          return { sentence, score };
        })
        .sort((a, b) => b.score - a.score);
      return scored[0]?.sentence || sentences[0] || "";
    }

    function buildFinalDraft(input, ranked, active) {
      if (!active.length) return "Paste answers and run Analyze.";
      const winner = ranked[0];
      const second = ranked[1];
      const consensus = consensusTerms(active);
      const borrowLines = active
        .filter((item) => item.index !== winner.index)
        .map((item) => `- From ${itemLabel(item)}: borrow ${item.strengths.slice(0, 2).join("; ")}.`)
        .join("\n");
      const adversarialFindings = input.adversarialReview
        ? adversarialFindingsFor(winner, ranked, active, input).slice(0, 3)
        : [];
      const humanQs = humanQuestions(input, ranked, second ? winner.total - second.total : 0, active);
      const caveat = humanQs.length
        ? `\n\nOpen questions before locking the final:\n${humanQs.map((q) => `- ${q}`).join("\n")}`
        : "";

      return [
        `Recommended backbone: ${itemLabel(winner)} (${winner.total}/100).`,
        "",
        "Why this looks strongest:",
        `- ${primaryReason(winner)}`,
        input.twoPass ? `- Two-pass score moved from ${winner.pass1Score} to ${winner.pass2Score} (${winner.adjustment >= 0 ? "+" : ""}${winner.adjustment}).` : "- Two-pass judging is off.",
        input.projectContext ? `- Its project-fit score is ${winner.metrics.projectFit}/100 under the ${Math.round(input.projectWeight * 100)}/${Math.round((1 - input.projectWeight) * 100)} first-principles source mix.` : "- No project context was loaded, so this draft is grounded only in the current question and constraints.",
        `- It sits in the "${quadrant(winner.x, winner.y)}" quadrant on the XY map.`,
        consensus.length ? `- Shared useful themes across models: ${consensus.join(", ")}.` : "- There is not enough consensus yet, so the judge should lean on explicit criteria.",
        adversarialFindings.length ? `- Adversarial check: ${adversarialFindings.join(" ")}` : "- Adversarial review is off.",
        "",
        "Consolidated answer draft:",
        winner.recommendation || "Use the highest-scoring answer as the backbone, then add the missing pieces identified below.",
        "",
        "Improve it by borrowing:",
        borrowLines || "- No other filled answers to borrow from yet.",
        "",
        "Why not blindly choose it:",
        `- Its main gaps are: ${winner.gaps.slice(0, 3).join("; ")}.`,
        "- Local scores are heuristic. For true reasoning, send the judge prompt below to a real LLM and paste the returned final decision here.",
        caveat
      ].join("\n");
    }

    function buildJudgePrompt(input = getInputs(), analyses = state.analyses) {
      const names = input.names || [0, 1, 2, 3].map((i) => $(`name${i}`).value.trim() || `LLM ${String.fromCharCode(65 + i)}`);
      const answers = input.answers || [0, 1, 2, 3].map((i) => $(`answer${i}`).value.trim());
      const answerLabels = [0, 1, 2, 3].map((i) => input.blindLabels ? blindLabel(i) : names[i]);
      const projectWeight = Math.round((typeof input.projectWeight === "number" ? input.projectWeight : getProjectWeight()) * 100);
      const questionWeight = 100 - projectWeight;
      const loadedSources = state.projectFiles.length
        ? state.projectFiles.map((item) => `- ${item.name} (${item.label}, ${fileSizeLabel(item.size)})`).join("\n")
        : "- No files loaded; use pasted project context if present.";
      const scoreLines = analyses && analyses.length
        ? analyses.map((item) => `${input.blindLabels ? blindLabel(item.index) : item.name}: pass 1 ${item.pass1Score ?? item.total}, final ${item.total}, X ${item.x}, Y ${item.y}, project fit ${item.metrics.projectFit || 0}, strengths: ${item.strengths.join("; ")}, gaps: ${item.gaps.join("; ")}`).join("\n")
        : "No local score table yet.";
      const claimLines = analyses && analyses.length
        ? analyses.map((item) => {
          const label = input.blindLabels ? blindLabel(item.index) : item.name;
          const claims = item.claims || extractClaims(item.answer || "");
          return `${label}: core claim=${shorten(claims.recommendation, 220)} | assumptions=${shorten(claims.assumptions.join(" | "), 220)} | actions=${shorten(claims.actions.join(" | "), 220)} | risks=${shorten(claims.risks.join(" | "), 220)}`;
        }).join("\n")
        : "No extracted claims yet.";

      return `You are a neutral decision judge comparing four LLM answers.

Goal:
Compare and contrast the four answers, borrow the best parts from each, reason from first principles and best practices, ask the human if the facts are insufficient, and produce the best consolidated final answer.

Rules:
1. Do not simply average the answers.
2. State the first-principles criteria you used, using the project context as ${projectWeight}% of the first-principles source and the current question/constraints as ${questionWeight}%.
3. Identify what each answer gets right and wrong.
4. If two directions are tied 2 vs 2, present both options and ask the human to choose.
5. If you can decide, produce one final consolidated answer and explain why it is best.
6. Include an XY table where X = first-principles strength and Y = execution clarity.
7. Preserve useful details from weaker answers when they improve the final.
8. Use blind labels during judging if the answers are labeled Answer A-D; do not infer model quality from model names.
9. Run two passes: first judge each answer independently, then re-rank after comparing deltas, consensus, unique contributions, and gaps.
10. Before finalizing, run an adversarial review against the winning answer and state what would make it fail.

Original question:
${input.question || "[missing]"}

Constraints and success criteria:
${input.constraints || "[not supplied]"}

Project context files:
${loadedSources}

Project or agent background context:
${input.projectContext || "[not supplied]"}

Local heuristic score notes:
${scoreLines}

Extracted claim notes:
${claimLines}

${answerLabels[0]}:
${answers[0] || "[empty]"}

${answerLabels[1]}:
${answers[1] || "[empty]"}

${answerLabels[2]}:
${answers[2] || "[empty]"}

${answerLabels[3]}:
${answers[3] || "[empty]"}

Required output:
1. Claim extraction table for all four answers.
2. Pass 1 independent score and short justification for each answer.
3. Pass 2 adjusted score after delta analysis.
4. XY comparison table for all four answers.
5. Delta analysis: unique strengths, missing pieces, contradictions, and what to borrow.
6. Adversarial review of the proposed winner.
7. Human questions, only if needed.
8. Final consolidated answer.
9. Explanation of why this final answer is the best available decision.`;
    }
