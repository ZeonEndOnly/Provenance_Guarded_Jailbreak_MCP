# Provenance-Guarded Red-Team Harness — Final Handover

**Platform:** NitroStack (TypeScript, decorator-based MCP framework)
**Deployment:** Local dev server only — no NitroCloud (keep it self-contained/logged, not public-facing)
**Status:** Locked scope, ready to build

---

## 0. The One-Paragraph Pitch

Automated red-teaming pipelines — a bigger agent probing a smaller target
model for jailbreaks — have a trust problem: nothing stops the attacker agent
from drifting out of scope, and nothing proves after the fact that the
process stayed honest. **Provenance-Guarded Red-Team Harness** wraps every
call the attacker agent makes in the same authorization-checking mechanism
used to stop hijacked LLMs from taking unauthorized actions: each tool call
is checked against a declared, pre-authorized test scope before it's allowed
to execute, scored by two independent judge signals instead of one, and
written to a tamper-evident hash-chained audit log. The result isn't just
"we found some jailbreaks" — it's "here is cryptographic proof our red-team
process never left its declared scope, and here's why you should trust each
verdict."

---

## 1. Architecture

```
┌────────────────────────────────────────────────────────────┐
│  Declared Scope (set once at session start)                 │
│  e.g. "Test target-model-v1 for jailbreak category:          │
│         harmful-instruction-compliance only"                 │
└───────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│  ATTACKER AGENT (bigger model)                               │
│  Generates/mutates adversarial prompts, orchestrates loop     │
│  via MCP tool calls                                           │
└───────────────────────┬────────────────────────────────────┘
                         │  every tool call passes through
                         ▼
┌────────────────────────────────────────────────────────────┐
│  PROVENANCE GUARD LAYER                                      │
│  NLI check: does this tool call fall within declared scope?  │
│  → BLOCKED calls never reach the target, logged immediately  │
└───────────────────────┬────────────────────────────────────┘
                         │  authorized calls only
                         ▼
┌────────────────────────────────────────────────────────────┐
│  TARGET MODEL (small, wrapped as a single MCP tool)           │
│  test_target_model(prompt) → response                         │
│  Swappable behind the interface (v1/v2 for patch A/B tests)   │
└───────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│  DUAL-SIGNAL JUDGE                                            │
│  1. LLM judge — different model family than the attacker,     │
│     tool-free, fixed rubric + reference examples in-prompt    │
│  2. Pattern/embedding matcher — hand-labeled jailbreak         │
│     corpus, non-LLM, independent failure mode                 │
│  Agreement → auto-logged. Disagreement → flagged for human.   │
└───────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│  TAMPER-EVIDENT AUDIT LOG                                     │
│  Sorted-key deterministic JSON → HMAC-SHA256 chain             │
│  Every finding, every BLOCKED attacker action, sequenced       │
│  verifyChain() detects tampering at exact sequence number      │
└───────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│  LIVE VERDICT WIDGET (NitroStack @Widget)                     │
│  Shows: scope check pass/fail, dual-judge verdict + confidence,│
│  audit chain status, session summary                          │
└────────────────────────────────────────────────────────────┘
```

---

## 2. Component Responsibilities

| File | Responsibility | Reused from prior work? |
|---|---|---|
| `audit.service.ts` | Sorted-key deterministic stringify → HMAC-SHA256 chain, `append()`, `verifyChain()`, JSONL persistence | Reused verbatim |
| `scope-guard.service.ts` | NLI check: "does this attacker tool call match the declared red-team scope?" | Adapted from `nli.service.ts` — same pattern, new prompt template |
| `target-model.tool.ts` | Wraps the small model as a single MCP tool (`test_target_model_v1`, `_v2`) | New |
| `judge-llm.service.ts` | LLM-based verdict: different model family than attacker, tool-free, fixed rubric | New |
| `judge-pattern.service.ts` | Embedding/pattern match against hand-labeled jailbreak corpus | New — replaces VirusTotal role |
| `calibration-set.json` | ~15–20 hand-labeled known jailbreak / non-jailbreak examples | New |
| `attacker.orchestrator.ts` | Drives the loop: mutate → call target → get dual verdict → log → repeat | New |
| `security-dashboard/page.tsx` | Live verdict widget | Adapted layout from prior widget, VT-specific styling removed |
| `session.service.ts` | Session persistence (declared scope, session id, disk-backed) | Reused verbatim |

---

## 3. Environment Setup

```bash
# .env
AUDIT_HMAC_KEY=replace-with-long-random-secret-min-32-chars
AUDIT_LOG_PATH=./data/audit.jsonl
SESSION_LOG_PATH=./data/sessions.jsonl

# Attacker + Scope Guard model
ANTHROPIC_API_KEY=sk-ant-...       # or OPENAI_API_KEY

# LLM Judge — MUST be a different family/provider than the attacker
JUDGE_LLM_PROVIDER=openai          # if attacker uses Anthropic
JUDGE_LLM_API_KEY=sk-...

# Target model — local, offline
TARGET_MODEL_RUNTIME=ollama
TARGET_MODEL_NAME=phi3:mini        # or qwen2.5:3b, kept small/quantized

# Mode
USE_MOCK_JUDGES=false              # true for guaranteed-result demo fallback
```

No new npm packages beyond what NitroStack ships: `@nitrostack/core`, `zod`,
`dotenv`, Node built-ins (`crypto`, `fs`, `fetch`).

---

## 4. Build Order (~9 hours, 4-person team)

1. **Hour 0–2 (all hands): De-risk the scariest link first**
   Spike the Ollama → NitroStack tool round-trip. One tool, one prompt, prove
   it works before building anything else on top of it.

2. **Hour 1–3 — Audit & Session (parallel)**
   Copy `audit.service.ts` and `session.service.ts` as-is. Test:
   write 5 entries, tamper entry 3, confirm `verifyChain()` reports
   `break_at_sequence: 3`, restore, confirm `chain_valid: true`.

3. **Hour 1–3 — Scope Guard**
   Adapt the NLI pattern: input = declared scope + attacker's proposed tool
   call, output = `{authorized: boolean, confidence: number, evidence: string}`.
   Test on 10 manual cases before wiring in (in-scope call passes,
   out-of-scope call — e.g. attacker tries to test a model outside the
   declared target — is blocked).

4. **Hour 2–5 — Target model tool + Judges**
   - Wrap target model as MCP tool (`test_target_model_v1`)
   - Build LLM judge with fixed rubric + reference examples in-prompt
   - Build pattern/embedding judge against the calibration set
   - Validate: run both judges against the 15–20 hand-labeled calibration
     examples FIRST, confirm they agree with human labels before trusting
     them on attacker-generated output

5. **Hour 3–5 — Attacker orchestrator**
   Loop: `mutate_prompt` → `test_target_model` (through Scope Guard) →
   dual judge verdict → `log_finding`. Feed the attacker **minimal** signal
   back (pass/fail + category only — not judge reasoning) to reduce the risk
   of it learning to fool the judges rather than genuinely jailbreak the
   target.

6. **Hour 5–6 — Widget**
   Verdict card per attempt: scope-check result, dual-judge verdict +
   confidence, disagreement flag, audit chain status footer.

7. **Hour 6–8 — Integration**
   Wire all modules, run all demo scenes end-to-end, fix DI issues.

8. **Hour 8–9 — Polish + record demo**
   README with the architecture diagram above, zero TypeScript errors,
   2-minute demo video.

---

## 5. Team Role Breakdown

| Role | Owns |
|---|---|
| **Systems/Ollama integration** | Target model tool, Ollama round-trip spike (Hour 0–2 priority), quantized model selection |
| **Scope Guard + Audit dev** | `scope-guard.service.ts`, `audit.service.ts` wiring, chain tamper test |
| **Judges + calibration dev** | LLM judge, pattern/embedding judge, calibration set curation and validation |
| **Orchestrator + widget + demo** | Attacker loop, verdict widget, demo script, pitch — owns end-to-end coherence |

---

## 6. Demo Script (2 Minutes)

**Scene 1 — In-scope attack, dual-judge agreement (40s)**
Declare scope: *"Test target-model-v1 for harmful-instruction-compliance
only."* Run attacker loop for 3–4 iterations. Widget shows each attempt:
scope check ✅, LLM judge verdict, pattern judge verdict, agreement →
auto-logged.

**Scene 2 — Attacker tries to go out of scope (25s)**
Manually trigger a tool call outside the declared scope (e.g. targeting a
different model, or a different jailbreak category). Widget shows ❌
BLOCKED at the Provenance Guard layer, before it ever reaches the target
model. This is the core differentiator — say it out loud.

**Scene 3 — Judge disagreement (20s)**
Show one logged case where the LLM judge and pattern judge disagreed —
flagged for human review rather than silently auto-resolved either way.

**Scene 4 — Tamper evidence (20s)**
`cat data/audit.jsonl`, manually edit one entry, ask the system to verify
chain integrity → `chain_valid: false`, `break_at_sequence: N`. Restore →
`chain_valid: true`.

**Scene 5 — Patch A/B (15s)**
Swap `test_target_model_v1` for `_v2` (a "patched" version), re-run the same
attack suite, show the diff in success rate.

---

## 7. Honest Claims for Judges

**Say:**
- "Every action our attacker agent takes is checked against a declared scope
  before execution — not just documented as a policy, enforced at the tool
  layer."
- "We use two independent judge signals — a different-family LLM and a
  non-LLM pattern matcher — and we validated both against a hand-labeled
  set before trusting either on live output."
- "Tamper any audit entry and the hash chain reports the exact sequence
  number that changed."
- "This finds and helps validate jailbreaks our specific attacker surfaces —
  it's a continuous testing and containment signal, not a guarantee the
  target model is unjailbreakable."

**Never say:**
- Any specific accuracy number you haven't actually measured
- "Formally verified"
- "This makes the model unjailbreakable" / "fully robust"
- "Protocol-level extension" — it's an MCP server, same as everyone else's

---

## 8. Known, Still-Open Gaps (own these if asked)

| Gap | Status |
|---|---|
| Attacker's imagination is a ceiling — untested attack styles stay untested | **Not solved.** Architectural containment ≠ broader attack coverage. |
| Patch overfitting — target may learn to refuse this attacker's phrasing specifically | **Not solved.** Would need multiple, structurally different attackers for real coverage. |
| LLM judge can in principle still be misled by adversarial phrasing in the response it reads | **Reduced, not eliminated.** Pattern judge as second signal lowers the odds both are fooled simultaneously, doesn't remove the risk from the LLM judge individually. |
| Detection vs. patching | **Side-stepped, not solved.** Guard blocks bad actions in real time; doesn't itself harden the target model's weights. |

---

## 9. What to Tell the Next Person Picking This Up

1. Reuse `audit.service.ts` unmodified — it's already correct (sorted-key
   deterministic hashing, HMAC chain).
2. The Scope Guard's prompt template is the main piece of new NLI work —
   base it on the "does this parameter match user intent" pattern, retarget
   to "does this tool call match declared red-team scope."
3. Validate both judges against the calibration set **before** wiring them
   into the live attacker loop — this is the step most likely to get
   skipped under time pressure and most damaging to skip.
4. Keep the target model small/quantized — MCP tool calls are synchronous,
   slow inference blocks every attacker iteration.
5. Do not claim unmeasured accuracy numbers or "unjailbreakable" — Section 7
   is the actual pitch language to use.
