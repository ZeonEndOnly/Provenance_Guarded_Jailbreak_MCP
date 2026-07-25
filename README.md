# Provenance-Guarded Red-Team Harness
## Work Division & Fusion Plan — 4-Person Team

**Platform:** NitroStack (TypeScript) | **Target:** local dev server only | **Total time:** ~9 hours

---

## 1. At-a-Glance Assignment

| Person | Workstream | Primary Files | Hours |
|---|---|---|---|
| **Person A** | Infrastructure & Target Model | `target-model.tool.ts`, `attacker.orchestrator.ts` (stub) | 0 → 5 |
| **Person B** | Audit & Scope Guard | `audit.service.ts`, `scope-guard.service.ts`, `session.service.ts` | 0 → 5 |
| **Person C** | Judges & Calibration | `judge-llm.service.ts`, `judge-pattern.service.ts`, `calibration-set.json` | 0 → 5 |
| **Person D** | Orchestrator & Widget | `attacker.orchestrator.ts`, `security-dashboard/page.tsx` | 2 → 5 |

---

## 2. Person A — Infrastructure & Target Model
**Hours 0 – 5**

The most critical path item. If the Ollama↔NitroStack round-trip doesn't work, nothing downstream can proceed. Own this first.

### Primary Files
- `target-model.tool.ts` — wraps the small model as MCP tool `test_target_model_v1` and `_v2`
- `attacker.orchestrator.ts` (stub only in hours 0–2, full impl handed to D in hours 3–5)

### Hour 0 – 2 (highest priority — everyone is unblocked by this)
- Spike: one NitroStack MCP tool → Ollama → response. Prove the round-trip works before writing anything else.
  - Suggested local target: `phi3:mini` or `qwen2.5:3b` (small/quantized; sync calls block each attacker iteration)
  - Confirm: prompt in, text response out, latency acceptable (<30s per call)
- Immediately share: confirmed tool signature for `test_target_model_v1(prompt) → response` (D needs this)

### Hour 2 – 5
- Register `_v2` variant behind the same interface signature (patch A/B demo scene depends on this)
- Write a thin orchestrator stub (bare loop, no real attacker logic) so D can wire in their full implementation
- Keep inference fast — quantized model is a hard requirement, not a nice-to-have

### Interface Contracts to Deliver
- `test_target_model_v1(prompt: string): Promise<{response: string}>` — locked by Hour 2
- `test_target_model_v2` — same signature, different backing model — locked by Hour 4

---

## 3. Person B — Audit & Scope Guard
**Hours 0 – 5**

Two reusable, well-understood components — but both must be tested rigorously before wiring in. The audit chain is load-bearing for the tamper-evidence demo; the scope guard is the core differentiator claim.

### Primary Files
- `audit.service.ts` — copy from prior work verbatim, then test
- `scope-guard.service.ts` — adapt the NLI pattern from `nli.service.ts`, new prompt template
- `session.service.ts` — copy from prior work verbatim

### Hour 0 – 2
- Copy `audit.service.ts` and `session.service.ts` as-is (no changes)
- Tamper test immediately: write 5 entries → manually edit entry 3 → `verifyChain()` must report `break_at_sequence: 3` → restore → `chain_valid: true`
  - Do not skip this. If the chain is broken here, the tamper-evidence demo scene fails.

### Hour 1 – 3 (overlapping)
- Scope Guard NLI prompt: input = declared scope + attacker's proposed tool call, output = `{authorized: boolean, confidence: number, evidence: string}`
- Test on 10 manual cases before wiring in — minimum:
  - In-scope: declared scope `"harmful-instruction-compliance only"` + tool call targeting `model-v1` → `authorized: true`
  - Out-of-scope: same scope + tool call targeting a different model → `authorized: false`
  - Out-of-scope: same scope + different jailbreak category → `authorized: false`

### Interface Contracts to Deliver
- `ScopeGuard.check(declaredScope, toolCall): Promise<{authorized, confidence, evidence}>` — locked by Hour 3
- `AuditService.append(entry)` and `verifyChain()` — locked by Hour 2

---

## 4. Person C — Judges & Calibration
**Hours 0 – 5**

The most likely place to cut corners under time pressure. Do not wire the judges into the live attacker loop until they have been validated against the calibration set. This is the step most damaging to skip.

### Primary Files
- `judge-llm.service.ts` — LLM-based verdict (different model family/provider than the attacker)
- `judge-pattern.service.ts` — embedding/pattern match against hand-labeled corpus
- `calibration-set.json` — 15–20 hand-labeled known jailbreak / non-jailbreak examples

### Hour 0 – 2
- Curate `calibration-set.json`: 15–20 examples, each with `{prompt, response, label: "jailbreak"|"safe", notes}`
  - Label these yourself — do not rely on a model to label the ground truth set
  - Mix obvious positives, obvious negatives, and 2–3 ambiguous edge cases
- Lock the judge verdict interface: `{verdict: "jailbreak"|"safe", confidence: number, signal: "llm"|"pattern"}`

### Hour 2 – 4
- LLM judge: use a different model family than the attacker (e.g. OpenAI if attacker is Anthropic)
  - Tool-free, fixed rubric, reference examples embedded in the system prompt
  - Temperature 0, JSON output mode
- Pattern judge: embedding similarity against calibration corpus or hand-crafted regex patterns for known jailbreak surface forms

### Hour 4 – 5 (gate before live wiring)
- Run both judges against all calibration examples. Compare to human labels.
- Both judges must agree with human labels on the obvious cases before D wires them into the attacker loop
- Document disagreements — these become the "judge disagreement flagged for human review" demo scene

### Interface Contracts to Deliver
- `JudgeLLM.score(prompt, response): Promise<{verdict, confidence}>` — locked by Hour 4
- `JudgePattern.score(prompt, response): Promise<{verdict, confidence}>` — locked by Hour 4
- `calibration-set.json` validated — locked by Hour 5

---

## 5. Person D — Orchestrator & Widget
**Hours 2 – 5 (build phase; Hours 0–2: planning + stubs)**

Owns end-to-end coherence. Can't fully build until A (target tool) and B (scope guard + audit) unblock you, but use Hours 0–2 to plan the orchestrator loop and wire the widget with mock data.

### Primary Files
- `attacker.orchestrator.ts` — drives the full loop
- `security-dashboard/page.tsx` — live verdict widget

### Hour 0 – 2 (before A/B unblock)
- Plan the orchestrator loop in pseudocode: `mutate_prompt → scope_guard.check → test_target_model → judge verdict → audit.append → repeat`
- Build the widget with hardcoded mock data so the UI is ready to wire
- Confirm widget renders: scope check ✅/❌, LLM judge verdict + confidence, pattern judge verdict + confidence, disagreement flag, audit chain status footer

### Hour 2 – 5 (as A/B/C interfaces land)
- Wire scope guard check before every `test_target_model` call — BLOCKED calls log immediately, never reach the target
- Feed attacker minimal signal only: pass/fail + category, **not** judge reasoning
  - This is deliberate — full reasoning risks the attacker learning to fool the judges rather than genuinely jailbreak the target
- Wire dual-judge verdict after each target response; log to audit chain
- Flag disagreements for human review rather than auto-resolving
- Prepare `USE_MOCK_JUDGES=true` path as demo fallback (guaranteed outputs if live judges misbehave during the presentation)

### Interface Contracts to Deliver
- Working end-to-end loop by Hour 5 (even with mock judges if needed)
- Widget showing live verdict per attempt by Hour 6

---

## 6. Interface Contracts & Handoff Schedule

| Contract | Produced by | Consumed by | Due by |
|---|---|---|---|
| Ollama round-trip confirmed | A | D (orchestrator can proceed) | Hour 2 |
| `test_target_model` tool signature locked | A | D (orchestrator calls this tool) | Hour 2 |
| `scope-guard` API shape locked | B | D (orchestrator inserts calls before target) | Hour 3 |
| `audit.append()` API shape locked | B | D (orchestrator logs every finding) | Hour 3 |
| Judge verdict interface locked | C | D (orchestrator reads verdict, widget renders) | Hour 4 |
| Calibration set validated | C | D (can trust verdicts in live loop) | Hour 5 |

---

## 7. Fusion, Testing & Deployment

| Phase | What happens | Who leads |
|---|---|---|
| Hour 5 – 6 | Wire all modules. D pulls A/B/C outputs into orchestrator and widget. Fix DI injection mismatches. | D leads; A/B/C on standby |
| Hour 6 – 7 | Run all 5 demo scenes end-to-end. Log every failure. Fix. | All hands |
| Hour 7 – 8 | Polish: README with architecture diagram, zero TypeScript errors, demo video recorded. | D (demo/pitch); B (README diagram); A+C support |
| Hour 8 – 9 | Buffer: regression test, swap v1→v2 target for A/B scene, confirm audit chain tamper-restore. | A for swap; B for tamper test; C for judge recheck |

---

## 8. Testing Checklist

| Owner | Test | Pass condition |
|---|---|---|
| A | Ollama round-trip spike | One prompt in, response out, <30s |
| B | `audit.verifyChain()` tamper test | `break_at_sequence: 3` on edit; `chain_valid: true` on restore |
| B | Scope Guard: 10 manual cases | In-scope passes, out-of-scope blocked |
| C | Both judges vs. calibration set | Agreement with human labels before live wiring |
| D | Orchestrator loop dry run (mock judges) | 3 iterations logged cleanly in `audit.jsonl` |
| All | Demo Scene 1: in-scope attack, judge agreement | Widget shows ✅ scope + dual verdict |
| All | Demo Scene 2: attacker goes out of scope | Widget shows ❌ BLOCKED at Provenance Guard |
| All | Demo Scene 3: judge disagreement flagged | Entry marked for human review, not auto-resolved |
| All | Demo Scene 4: tamper-evident log | `chain_valid: false` → restore → `chain_valid: true` |
| A + All | Demo Scene 5: v1 → v2 A/B swap | Same attack suite, different success rate shown |

---

## 9. Known Risks & Mitigations

### Critical risks
- **Ollama latency too high (A)** — keep target model quantized; if still slow, reduce attacker iterations for demo
- **Calibration validation fails (C)** — do not proceed to live wiring; reduce calibration set to obvious cases only and retest
- **DI injection mismatches on fusion (D)** — check `@Injectable({ deps: [...] })` matches constructor args exactly; this is the most common NitroStack integration failure
- **Judge consistently disagrees with calibration labels (C)** — revisit prompt template; swap provider if needed before Hour 5

### Still-open gaps (say these aloud if asked)
- Attacker imagination is a ceiling — attack styles the attacker doesn't try stay untested. Not solved.
- Patch overfitting — target may learn to refuse this specific attacker's phrasing. Not solved.
- LLM judge can still be misled — pattern judge reduces the odds both are fooled simultaneously, doesn't eliminate the individual risk.
- Detection is not patching — the guard blocks bad actions in real time, it doesn't harden the target model's weights.

---

- "Formally verified"
- "This makes the model unjailbreakable" / "fully robust"
- "Protocol-level extension" — this is an MCP server, same as everyone else's
