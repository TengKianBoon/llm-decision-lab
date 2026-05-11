function drawXY(active) {
      const canvas = $("xyCanvas");
      const shell = canvas.parentElement;
      const rect = shell.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(520, Math.round(rect.width));
      const height = Math.max(300, Math.round(rect.height));
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const pad = { left: 64, right: 28, top: 28, bottom: 58 };
      const plotW = width - pad.left - pad.right;
      const plotH = height - pad.top - pad.bottom;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "#d8dee8";
      ctx.lineWidth = 1;

      for (let i = 0; i <= 10; i += 1) {
        const x = pad.left + (plotW * i) / 10;
        const y = pad.top + (plotH * i) / 10;
        ctx.beginPath();
        ctx.moveTo(x, pad.top);
        ctx.lineTo(x, pad.top + plotH);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(pad.left + plotW, y);
        ctx.stroke();
      }

      ctx.strokeStyle = "#172033";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(pad.left, pad.top, plotW, plotH);

      ctx.strokeStyle = "#9eaabd";
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(pad.left + plotW * 0.65, pad.top);
      ctx.lineTo(pad.left + plotW * 0.65, pad.top + plotH);
      ctx.moveTo(pad.left, pad.top + plotH * 0.35);
      ctx.lineTo(pad.left + plotW, pad.top + plotH * 0.35);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#3a455c";
      ctx.font = "700 12px Inter, system-ui, sans-serif";
      ctx.fillText("First principles", pad.left + plotW / 2 - 48, height - 20);
      ctx.save();
      ctx.translate(20, pad.top + plotH / 2 + 48);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText("Execution clarity", 0, 0);
      ctx.restore();

      ctx.font = "700 11px Inter, system-ui, sans-serif";
      ctx.fillStyle = "#647086";
      ctx.fillText("0", pad.left - 16, pad.top + plotH + 4);
      ctx.fillText("100", pad.left + plotW - 22, pad.top + plotH + 20);
      ctx.fillText("100", pad.left - 34, pad.top + 4);

      active.forEach((item, index) => {
        const x = pad.left + (item.x / 100) * plotW;
        const y = pad.top + plotH - (item.y / 100) * plotH;
        ctx.fillStyle = COLORS[item.index % COLORS.length];
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#172033";
        ctx.font = "800 12px Inter, system-ui, sans-serif";
        const fullLabel = itemLabel(item);
        const label = fullLabel.length > 18 ? fullLabel.slice(0, 16) + ".." : fullLabel;
        const offsetX = index % 2 === 0 ? 12 : -84;
        ctx.fillText(label, clamp(x + offsetX, pad.left + 4, pad.left + plotW - 96), clamp(y - 12, pad.top + 14, pad.top + plotH - 4));
      });
    }

    function parseBulk(text) {
      const clean = String(text || "").trim();
      if (!clean) return [];

      const marker = /(?:^|\n)\s*(?:#{1,6}\s*)?(?:LLM|Model|Answer|Response)\s*([A-D]|[1-4])\s*[:.)-]?\s*/gi;
      const matches = Array.from(clean.matchAll(marker));
      if (matches.length >= 2) {
        return matches.slice(0, 4).map((match, index) => {
          const start = match.index + match[0].length;
          const end = matches[index + 1] ? matches[index + 1].index : clean.length;
          return clean.slice(start, end).trim();
        });
      }

      const byRule = clean.split(/\n\s*-{3,}\s*\n/g).map((part) => part.trim()).filter(Boolean);
      if (byRule.length >= 2) return byRule.slice(0, 4);

      const byLargeBreak = clean.split(/\n\s*\n\s*\n+/g).map((part) => part.trim()).filter(Boolean);
      return byLargeBreak.slice(0, 4);
    }

    async function copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const temp = document.createElement("textarea");
        temp.value = text;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        temp.remove();
      }
    }

    function loadSample() {
      $("projectContextInput").value = "# PROJECT_INSTRUCTIONS.md\nPrefer decisions that are explicit about assumptions, risks, and verification. Borrow good ideas from alternatives instead of forcing a shallow majority vote.\n\n# ACTIVE_STATE.md\nCurrent priority: create practical tools that compare LLM outputs, ask for human judgment when confidence is low, and preserve reusable project instructions.";
      $("questionInput").value = "Can I create an HTML app where I paste four LLM answers, compare them, score them, ask for human clarification when needed, and generate a consolidated final answer?";
      $("constraintsInput").value = "Must work as a local file first. Must show a 4-answer comparison, score table, delta analysis, XY map, human questions, and judge prompt. Avoid pretending local heuristics are the same as a real LLM.";
      $("answer0").value = "Yes. Build a single-page HTML app with four text boxes, a scoring rubric, and a final synthesis area. The simplest version should use local heuristics for relevance, completeness, reasoning, practicality, specificity, and risk. The output should include a score table and a consolidated answer.";
      $("answer1").value = "It is possible, but the app cannot truly think unless connected to a model. The clean design is to make the browser app collect the four answers, generate a judge prompt, and optionally call a backend or local model. Without that, any score is a proxy, not a real evaluation.";
      $("answer2").value = "Use a first-principles rubric. Define the objective, constraints, scoring criteria, and failure modes. Compare each answer on two axes: reasoning quality and execution clarity. If the scores are close or assumptions are missing, ask the human before deciding.";
      $("answer3").value = "The best workflow is proposal, critique, revision, vote, and synthesis. The app can support this by storing each LLM response, extracting strengths and gaps, detecting ties, creating a delta analysis, and producing a final decision package for human review.";
      ["blindLabelsInput", "claimExtractionInput", "twoPassInput", "adversarialInput"].forEach((id) => $(id).checked = true);
      state.projectFiles = [];
      renderProjectSources();
    }

    $("loadProjectFilesBtn").addEventListener("click", () => $("projectFilesInput").click());

    $("loadProjectFolderBtn").addEventListener("click", () => $("projectFolderInput").click());

    $("projectFilesInput").addEventListener("change", (event) => {
      loadProjectFiles(event.target.files, false).catch((error) => {
        $("projectSourceList").innerHTML = `<p class="small-note">Could not load files: ${escapeHtml(error.message || String(error))}</p>`;
      });
    });

    $("projectFolderInput").addEventListener("change", (event) => {
      loadProjectFiles(event.target.files, true).catch((error) => {
        $("projectSourceList").innerHTML = `<p class="small-note">Could not load folder: ${escapeHtml(error.message || String(error))}</p>`;
      });
    });

    $("clearProjectContextBtn").addEventListener("click", () => {
      $("projectContextInput").value = "";
      $("projectFilesInput").value = "";
      $("projectFolderInput").value = "";
      state.projectFiles = [];
      renderProjectSources();
    });

    $("projectWeightInput").addEventListener("input", () => {
      const projectPercent = Math.round(getProjectWeight() * 100);
      $("projectWeightLabel").textContent = `${projectPercent}/${100 - projectPercent}`;
    });

    $("analyzeBtn").addEventListener("click", analyze);

    $("promptBtn").addEventListener("click", () => {
      const prompt = buildJudgePrompt(getInputs(), state.analyses);
      state.lastPrompt = prompt;
      $("judgePrompt").value = prompt;
      $("results").hidden = false;
      $("results").scrollIntoView({ behavior: "smooth", block: "end" });
    });

    $("sampleBtn").addEventListener("click", () => {
      loadSample();
      analyze();
    });

    $("clearBtn").addEventListener("click", () => {
      ["projectContextInput", "questionInput", "constraintsInput", "bulkInput", "judgePrompt"].forEach((id) => $(id).value = "");
      $("projectWeightInput").value = "60";
      $("projectWeightLabel").textContent = "60/40";
      ["blindLabelsInput", "claimExtractionInput", "twoPassInput", "adversarialInput"].forEach((id) => $(id).checked = true);
      state.projectFiles = [];
      renderProjectSources();
      [0, 1, 2, 3].forEach((i) => {
        $(`answer${i}`).value = "";
        $(`name${i}`).value = `LLM ${String.fromCharCode(65 + i)}`;
      });
      state.analyses = [];
      updateAnswerCards([0, 1, 2, 3].map((i) => ({
        index: i,
        answer: "",
        total: 0,
        x: 0,
        y: 0,
        metrics: { risk: 0, projectFit: 0 }
      })));
      $("results").hidden = true;
    });

    $("splitBtn").addEventListener("click", () => {
      const parts = parseBulk($("bulkInput").value);
      parts.forEach((part, index) => {
        if (index < 4) $(`answer${index}`).value = part;
      });
    });

    $("combineBtn").addEventListener("click", () => {
      const input = getInputs();
      $("bulkInput").value = input.answers
        .map((answer, index) => `${input.names[index]}:\n${answer}`)
        .join("\n\n---\n\n");
    });

    $("copyPromptBtn").addEventListener("click", () => {
      copyText($("judgePrompt").value || buildJudgePrompt());
    });

    document.querySelectorAll("[data-clear-answer]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = button.getAttribute("data-clear-answer");
        $(`answer${index}`).value = "";
      });
    });

    document.querySelectorAll("[data-copy-answer]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = button.getAttribute("data-copy-answer");
        copyText($(`answer${index}`).value);
      });
    });

    renderProjectSources();

    window.addEventListener("resize", () => {
      if (!$("results").hidden && state.analyses.length) {
        drawXY(state.analyses.filter((item) => item.answer));
      }
    });
