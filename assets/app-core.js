const STOP_WORDS = new Set([
      "the", "and", "for", "are", "but", "not", "you", "your", "with", "that", "this", "from", "have", "has",
      "had", "was", "were", "will", "would", "could", "should", "there", "their", "they", "them", "then",
      "than", "into", "about", "what", "when", "where", "which", "while", "also", "more", "most", "some",
      "any", "can", "cannot", "just", "only", "each", "such", "use", "using", "used", "make", "made", "get",
      "got", "its", "it's", "out", "our", "who", "why", "how", "all", "one", "two", "four", "llm", "llms",
      "answer", "answers", "response", "responses", "question", "final", "best", "good", "better", "because"
    ]);

    const REASONING_TERMS = [
      "first principle", "principle", "root cause", "assumption", "constraint", "objective", "tradeoff",
      "trade-off", "evidence", "causal", "because", "therefore", "if", "then", "why", "criteria", "premise",
      "mechanism", "invariant", "priority", "decision rule"
    ];

    const PRACTICAL_TERMS = [
      "step", "workflow", "implement", "build", "run", "test", "verify", "measure", "compare", "score",
      "output", "table", "checklist", "template", "process", "action", "next", "plan", "create", "use"
    ];

    const RISK_TERMS = [
      "risk", "failure", "edge case", "limitation", "caveat", "uncertain", "doubt", "assumption", "bias",
      "privacy", "security", "cost", "latency", "incorrect", "hallucination", "tie", "fallback", "verify"
    ];

    const COMPLETE_TERMS = [
      "decision", "criteria", "rubric", "score", "compare", "contrast", "delta", "synthesis", "final",
      "human", "tie", "first principle", "best practice", "explain", "why"
    ];

    const ACTION_VERBS = [
      "ask", "choose", "compare", "decide", "define", "evaluate", "explain", "generate", "identify",
      "include", "keep", "merge", "preserve", "produce", "rank", "review", "score", "select", "summarize",
      "test", "validate", "vote"
    ];

    const COLORS = ["#2868a9", "#28745b", "#9b6200", "#6253a3"];

    const IMPORTANT_PROJECT_FILE_RULES = [
      { pattern: /(^|[/\\])claude\.md$/i, label: "Claude instructions" },
      { pattern: /(^|[/\\])agents\.md$/i, label: "Agent instructions" },
      { pattern: /(^|[/\\])codex\.md$/i, label: "Codex instructions" },
      { pattern: /active[_-]?state.*\.md$/i, label: "Active state" },
      { pattern: /master[_-]?instructions.*\.md$/i, label: "Master instructions" },
      { pattern: /project[-_ ]?(background|instructions|brief)/i, label: "Project background" },
      { pattern: /(^|[/\\])instructions?\.(md|txt)$/i, label: "Instructions" },
      { pattern: /(^|[/\\])\.cursorrules$/i, label: "Cursor rules" },
      { pattern: /(^|[/\\])\.windsurfrules$/i, label: "Windsurf rules" },
      { pattern: /(^|[/\\])copilot-instructions\.md$/i, label: "Copilot instructions" },
      { pattern: /(^|[/\\])readme\.md$/i, label: "README" },
      { pattern: /(prd|spec|requirements|decision|architecture).*\.(md|txt)$/i, label: "Project spec" }
    ];

    const state = {
      analyses: [],
      lastPrompt: "",
      projectFiles: []
    };

    const $ = (id) => document.getElementById(id);

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function round(value) {
      return Math.round(clamp(value, 0, 100));
    }

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function tokenize(text) {
      const matches = String(text || "").toLowerCase().match(/[a-z0-9][a-z0-9'-]{2,}/g) || [];
      return matches
        .map((word) => word.replace(/^'+|'+$/g, ""))
        .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
    }

    function unique(values) {
      return Array.from(new Set(values));
    }

    function topTerms(text, limit = 12) {
      const counts = new Map();
      tokenize(text).forEach((token) => counts.set(token, (counts.get(token) || 0) + 1));
      return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, limit)
        .map(([word]) => word);
    }

    function overlapScore(referenceTerms, tokenSet, fallback = 45) {
      if (!referenceTerms.length) return fallback;
      const overlapCount = referenceTerms.filter((term) => tokenSet.has(term)).length;
      return round((overlapCount / Math.max(5, Math.min(referenceTerms.length, 14))) * 100);
    }

    function getProjectWeight() {
      return Number($("projectWeightInput")?.value || 60) / 100;
    }

    function fileSizeLabel(size) {
      if (size < 1024) return `${size} B`;
      if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }

    function classifyProjectFile(path) {
      const normalized = String(path || "").replaceAll("\\", "/").toLowerCase();
      const rule = IMPORTANT_PROJECT_FILE_RULES.find((item) => item.pattern.test(normalized));
      return rule ? rule.label : "";
    }

    function isReadableProjectFile(path) {
      return /\.(md|txt|json|ya?ml|toml)$/i.test(path || "");
    }

    function selectProjectFiles(files, folderMode = false) {
      const readable = Array.from(files || []).filter((file) => isReadableProjectFile(file.name || file.webkitRelativePath));
      const withMeta = readable.map((file) => {
        const path = file.webkitRelativePath || file.name;
        const label = classifyProjectFile(path);
        return {
          file,
          path,
          label,
          score: label ? 2 : (path.split(/[\\/]/).length <= 2 ? 1 : 0)
        };
      });

      if (!folderMode) return withMeta.slice(0, 16);

      const important = withMeta.filter((item) => item.score > 0);
      const candidates = important.length ? important : withMeta;
      return candidates
        .sort((a, b) => b.score - a.score || a.path.length - b.path.length || a.path.localeCompare(b.path))
        .slice(0, 16);
    }

    async function loadProjectFiles(files, folderMode = false) {
      const selected = selectProjectFiles(files, folderMode);
      if (!selected.length) {
        $("projectSourceList").innerHTML = `<p class="small-note">No readable instruction files found. Paste project context manually if needed.</p>`;
        return;
      }

      const loaded = [];
      for (const item of selected) {
        const text = await item.file.text();
        loaded.push({
          name: item.path,
          label: item.label || "Selected file",
          size: item.file.size,
          text
        });
      }

      state.projectFiles = loaded;
      $("projectContextInput").value = loaded
        .map((item) => `# ${item.name}\n${item.text}`)
        .join("\n\n---\n\n");
      renderProjectSources();
    }

    function renderProjectSources() {
      if (!state.projectFiles.length) {
        $("projectSourceList").innerHTML = `<p class="small-note">No project files loaded yet.</p>`;
        return;
      }

      $("projectSourceList").innerHTML = state.projectFiles
        .map((item) => `
          <div class="source-item">
            <strong title="${escapeHtml(item.name)}">${escapeHtml(item.label)}: ${escapeHtml(item.name)}</strong>
            <span>${fileSizeLabel(item.size)}</span>
          </div>
        `)
        .join("");
    }

    function sentenceList(text) {
      return String(text || "")
        .replace(/\s+/g, " ")
        .split(/(?<=[.!?])\s+|(?:\n\s*){2,}/)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length > 20);
    }

    function termPresence(text, terms) {
      const lower = String(text || "").toLowerCase();
      return terms.reduce((count, term) => count + (lower.includes(term) ? 1 : 0), 0);
    }

    function countRegex(text, regex) {
      return (String(text || "").match(regex) || []).length;
    }

    function hasAny(text, terms) {
      const lower = String(text || "").toLowerCase();
      return terms.some((term) => lower.includes(term));
    }

    function blindLabel(index) {
      return `Answer ${String.fromCharCode(65 + index)}`;
    }

    function itemLabel(item) {
      return item.displayName || item.name || blindLabel(item.index || 0);
    }

    function shorten(value, max = 160) {
      const text = String(value || "").replace(/\s+/g, " ").trim();
      if (!text) return "Not stated.";
      return text.length > max ? `${text.slice(0, max - 2)}..` : text;
    }

    function pickSentences(answer, patterns, limit = 2) {
      return sentenceList(answer)
        .filter((sentence) => patterns.some((pattern) => pattern.test(sentence)))
        .slice(0, limit);
    }

    function extractClaims(answer) {
      const recommendation = extractRecommendation(answer);
      const assumptions = pickSentences(answer, [
        /\bassum/i,
        /\bif\b/i,
        /\bdepends?\b/i,
        /\bgiven\b/i,
        /\bconstraint/i,
        /\bunless\b/i
      ]);
      const evidence = pickSentences(answer, [
        /\bbecause\b/i,
        /\btherefore\b/i,
        /\bfirst principle/i,
        /\bevidence\b/i,
        /\bwhy\b/i,
        /\btrade[- ]?off/i
      ]);
      const actions = pickSentences(answer, [
        /\b(step|workflow|build|create|use|run|test|verify|score|compare|ask|produce|include)\b/i
      ], 3);
      const risks = pickSentences(answer, [
        /\b(risk|failure|edge case|limitation|caveat|uncertain|tie|fallback|hallucination|privacy|security)\b/i
      ], 3);

      return {
        recommendation,
        assumptions,
        evidence,
        actions,
        risks
      };
    }

    function claimCompleteness(claims) {
      return round(
        (claims.recommendation ? 24 : 0) +
        Math.min(claims.assumptions.length, 2) * 13 +
        Math.min(claims.evidence.length, 2) * 13 +
        Math.min(claims.actions.length, 3) * 8 +
        Math.min(claims.risks.length, 2) * 13
      );
    }

    function disagreementSignals(item, active) {
      const text = item.answer.toLowerCase();
      const otherText = active.filter((candidate) => candidate.index !== item.index).map((candidate) => candidate.answer.toLowerCase()).join("\n");
      const signals = [];

      if (/\b(impossible|cannot|can't|not possible|won't work)\b/.test(text) && /\b(possible|can work|yes|works)\b/.test(otherText)) {
        signals.push("disagrees on feasibility");
      }
      if (/\b(api|backend|server|model endpoint|local model)\b/.test(text) && /\b(static|single html|local file|no server)\b/.test(otherText)) {
        signals.push("differs on whether a model/backend is required");
      }
      if (/\b(always|must|never|required)\b/.test(text) && /\b(optional|depends|if needed|can)\b/.test(otherText)) {
        signals.push("uses stronger necessity language than peers");
      }

      return signals;
    }

    function applyTwoPassJudging(analyses, input) {
      const active = analyses.filter((item) => item.answer);
      const consensus = consensusTerms(active);

      analyses.forEach((item) => {
        item.pass1Score = item.total;
        item.finalScore = item.total;
        item.pass2Score = item.total;
        item.adjustment = 0;
        item.twoPassNotes = item.answer ? ["Pass 1 scored independently."] : ["No answer supplied."];
      });

      if (!input.twoPass || active.length < 2) {
        return analyses;
      }

      active.forEach((item) => {
        const consensusHits = item.topTerms.filter((term) => consensus.includes(term)).length;
        const uniqueHits = uniqueTermsFor(item, active).length;
        const claimScore = input.claimExtraction ? claimCompleteness(item.claims) : 50;
        const disagreement = disagreementSignals(item, active);
        const gapPenalty = item.gaps.filter((gap) => !gap.includes("no major")).length;
        const boost = Math.min(8, consensusHits * 1.3) + Math.min(5, uniqueHits * 0.8) + (claimScore >= 72 ? 5 : claimScore >= 55 ? 2 : 0);
        const penalty = Math.min(10, gapPenalty * 1.7) + Math.min(7, disagreement.length * 3);
        const adjustment = Math.round(boost - penalty);

        item.adjustment = adjustment;
        item.pass2Score = round(item.pass1Score + adjustment);
        item.finalScore = item.pass2Score;
        item.total = item.finalScore;
        item.twoPassNotes = [
          `Consensus matches: ${consensusHits}.`,
          `Unique useful terms: ${uniqueHits}.`,
          `Claim completeness: ${claimScore}.`,
          disagreement.length ? `Conflict flags: ${disagreement.join("; ")}.` : "No direct conflict flag detected."
        ];
      });

      return analyses;
    }

    function adversarialFindingsFor(item, ranked, active, input) {
      const findings = [];
      const runnerUp = ranked.find((candidate) => candidate.index !== item.index);
      const margin = runnerUp ? item.total - runnerUp.total : 100;

      if (!input.adversarialReview) return findings;
      if (ranked[0]?.index === item.index && margin <= 5) findings.push(`Near-tie risk: ${itemLabel(item)} only leads ${runnerUp ? itemLabel(runnerUp) : "the next answer"} by ${margin} point${margin === 1 ? "" : "s"}.`);
      if (item.metrics.projectFit > 0 && item.metrics.projectFit < 60) findings.push("Project-fit risk: the answer may miss important standing instructions.");
      if (item.metrics.risk < 55) findings.push("Risk-pass gap: failure modes and uncertainty are underdeveloped.");
      if (item.metrics.practicality < 55) findings.push("Execution gap: the proposal may be hard to apply without more concrete steps.");
      if (!hasAny(item.answer, ["verify", "test", "check", "validate", "review"])) findings.push("Verification gap: it does not clearly say how to check that the final decision worked.");
      if (item.claims && !item.claims.assumptions.length) findings.push("Assumption gap: hidden assumptions are not clearly named.");
      disagreementSignals(item, active).forEach((signal) => findings.push(`Peer conflict: ${signal}.`));

      if (!findings.length) findings.push("No major adversarial issue detected by the local heuristic pass.");
      return findings;
    }

    function scoreAnswer(answer, question, constraints, projectContext, projectWeight) {
      const combinedQuestion = `${question}\n${constraints}`;
      const qTerms = unique(topTerms(combinedQuestion, 16));
      const projectTerms = unique(topTerms(projectContext, 24));
      const tokens = tokenize(answer);
      const tokenSet = new Set(tokens);
      const length = answer.trim().length;
      const sentenceCount = sentenceList(answer).length;

      const questionFitBase = overlapScore(qTerms, tokenSet, 45);
      const projectFitBase = overlapScore(projectTerms, tokenSet, projectContext ? 50 : 0);
      const relevance = round(questionFitBase + (length > 200 ? 8 : 0));
      const projectFit = projectContext ? round(projectFitBase + (length > 200 ? 6 : 0)) : 0;

      const reasoningHits = termPresence(answer, REASONING_TERMS);
      const causalLinks = countRegex(answer, /\b(because|therefore|so that|which means|as a result|depends on|trade[- ]?off)\b/gi);
      const reasoning = round((reasoningHits * 9) + (causalLinks * 8) + Math.min(sentenceCount, 8) * 3);

      const completenessHits = termPresence(answer, COMPLETE_TERMS);
      const hasList = /\n\s*(?:[-*]|\d+[.)])\s+/.test(answer);
      const hasSections = countRegex(answer, /\n\s*#{1,6}\s|\n[A-Z][A-Za-z ]{2,}:\s/g) > 0;
      const completeness = round((completenessHits * 7) + (hasList ? 18 : 0) + (hasSections ? 12 : 0) + Math.min(sentenceCount, 10) * 3);

      const practicalHits = termPresence(answer, PRACTICAL_TERMS);
      const actionHits = ACTION_VERBS.reduce((count, verb) => count + countRegex(answer, new RegExp(`\\b${verb}\\b`, "gi")), 0);
      const practicality = round((practicalHits * 7) + Math.min(actionHits, 12) * 4 + (hasList ? 12 : 0));

      const numberCount = countRegex(answer, /\b\d+(?:\.\d+)?%?\b/g);
      const codeishCount = countRegex(answer, /[`{}[\]|/\\]|\b[A-Z]{2,}\b/g);
      const vaguePenalty = termPresence(answer, ["maybe", "probably", "generally", "stuff", "things", "various"]) * 5;
      const lengthFit = length < 120 ? 18 : length < 350 ? 42 : length < 1800 ? 62 : 55;
      const specificity = round(lengthFit + Math.min(numberCount, 8) * 4 + Math.min(codeishCount, 12) * 2 - vaguePenalty);

      const riskHits = termPresence(answer, RISK_TERMS);
      const risk = round((riskHits * 11) + (hasAny(answer, ["ask human", "clarify", "in doubt", "tie"]) ? 15 : 0));
      const contextWeight = projectContext ? clamp(projectWeight, 0, 1) : 0;
      const principleSignal = round(projectFit * contextWeight + relevance * (1 - contextWeight));

      const total = round(
        relevance * 0.16 +
        (projectContext ? projectFit * 0.14 : relevance * 0.14) +
        reasoning * 0.22 +
        completeness * 0.18 +
        practicality * 0.15 +
        specificity * 0.1 +
        risk * 0.05
      );

      const x = round(principleSignal * 0.52 + reasoning * 0.32 + risk * 0.16);
      const y = round(practicality * 0.36 + completeness * 0.28 + specificity * 0.22 + relevance * 0.14);

      return {
        total,
        x,
        y,
        metrics: { relevance, projectFit, reasoning, completeness, practicality, specificity, risk },
        tokens,
        qTerms,
        projectTerms,
        principleSignal,
        sentences: sentenceList(answer),
        length
      };
    }

    function strengthsAndGaps(analysis) {
      const strengths = [];
      const gaps = [];
      const m = analysis.metrics;

      if (analysis.total >= 76) strengths.push("strong overall candidate");
      if (m.relevance >= 70) strengths.push("stays close to the question");
      if (m.projectFit >= 70) strengths.push("aligns with loaded project instructions");
      if (m.reasoning >= 70) strengths.push("good first-principles reasoning");
      if (m.completeness >= 70) strengths.push("covers the requested decision surface");
      if (m.practicality >= 70) strengths.push("actionable workflow");
      if (m.specificity >= 70) strengths.push("concrete details");
      if (m.risk >= 70) strengths.push("risk and uncertainty handling");

      if (m.relevance < 55) gaps.push("tighten relevance to the original question");
      if (m.projectFit > 0 && m.projectFit < 55) gaps.push("align better with project instructions and standing context");
      if (m.reasoning < 55) gaps.push("explain the reasoning from first principles");
      if (m.completeness < 55) gaps.push("cover scoring, comparison, synthesis, and human tie-breaks");
      if (m.practicality < 55) gaps.push("turn advice into a usable process");
      if (m.specificity < 55) gaps.push("add concrete formats, criteria, or examples");
      if (m.risk < 55) gaps.push("state risks, uncertainty, and when to ask the human");

      if (!strengths.length) strengths.push("has material that may still be useful after revision");
      if (!gaps.length) gaps.push("no major rubric gap detected");

      return { strengths, gaps };
    }

    function badgeColor(score) {
      if (score >= 76) return "#28745b";
      if (score >= 60) return "#2868a9";
      if (score >= 45) return "#9b6200";
      return "#ad2b24";
    }

    function quadrant(x, y) {
      if (x >= 65 && y >= 65) return "Sound and actionable";
      if (x >= 65) return "Strong reasoning, needs clearer execution";
      if (y >= 65) return "Practical, needs deeper justification";
      return "Needs revision before use";
    }
