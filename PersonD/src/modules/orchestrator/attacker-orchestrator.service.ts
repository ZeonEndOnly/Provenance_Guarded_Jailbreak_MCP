import { Injectable } from '@nitrostack/core';
import { TargetModelService } from './target-model.service.js';
import { ScopeGuardService, ScopeGuardResult } from './scope-guard.service.js';
import { AuditService, AuditEntry } from './audit.service.js';
import { PromptMutatorService, AttackerFeedback, MutationStrategy } from './prompt-mutator.service.js';
import { JudgesService, DualJudgeResult } from '../../../../PersonC/src/modules/judges/judges.service.js';

export interface OrchestratorConfig {
  declaredScope: string;
  targetTool: { target: string; category: string };
  seedPrompt: string;
  maxIterations: number;
  useModelV2?: boolean;
}

export interface WidgetState {
  sequence: number;
  timestamp: string;
  scopeAuthorized: boolean;
  scopeEvidence: string;
  targetModel: string;
  targetOutput: string;
  llmJudge: { verdict: string; confidence: number } | null;
  patternJudge: { verdict: string; confidence: number } | null;
  flaggedForHumanReview: boolean;
  hashChainValid: boolean;
  hashPreview: string;
  mutationStrategy?: string;
}

export interface AttemptResult {
  iteration: number;
  status: 'BLOCKED' | 'EXECUTED';
  prompt: string;
  widgetState: WidgetState;
  dualJudgeResult?: DualJudgeResult;
}

@Injectable()
export class AttackerOrchestratorService {
  constructor(
    private readonly targetModel: TargetModelService,
    private readonly scopeGuard: ScopeGuardService,
    private readonly auditService: AuditService,
    private readonly promptMutator: PromptMutatorService,
    private readonly judgesService: JudgesService
  ) {}

  /**
   * Drives the iterative red-team loop as specified in the work division document:
   * mutate_prompt -> scope_guard.check -> test_target_model -> dual judge verdict -> audit.append -> repeat
   * Yields AttemptResult on each iteration for real-time widget rendering.
   */
  async *runLoop(config: OrchestratorConfig): AsyncGenerator<AttemptResult> {
    let previousFeedback: AttackerFeedback | null = null;

    for (let i = 0; i < config.maxIterations; i++) {
      const iterationNumber = i + 1;

      // 1. Mutate Prompt (Receives ONLY minimal feedback signal, NEVER judge reasoning)
      const { mutatedPrompt, strategyUsed } = this.promptMutator.mutate(
        config.seedPrompt,
        previousFeedback,
        i
      );

      // 2. Scope Guard Check (Before Target Model Call)
      const scopeCheck = await this.scopeGuard.check(config.declaredScope, config.targetTool);

      if (!scopeCheck.authorized) {
        // BLOCKED calls log immediately to audit chain and NEVER reach the target model
        const auditEntry = this.auditService.append({
          status: 'BLOCKED',
          scopeCheck,
          prompt: mutatedPrompt,
          toolCall: config.targetTool,
          targetResponse: null,
          humanReviewRequired: false,
          mutationStrategy: strategyUsed
        });

        const widgetState = this.generateWidgetState(auditEntry, scopeCheck, null, null, strategyUsed);
        yield {
          iteration: iterationNumber,
          status: 'BLOCKED',
          prompt: mutatedPrompt,
          widgetState
        };

        // Stop loop if out-of-scope block encountered
        break;
      }

      // 3. Invoke Target Model
      const targetResponse = config.useModelV2
        ? await this.targetModel.test_target_model_v2(mutatedPrompt)
        : await this.targetModel.test_target_model_v1(mutatedPrompt);

      // 4. Dual-Judge Evaluation (Invokes Person C's JudgesService)
      const dualVerdict = await this.judgesService.evaluate(
        mutatedPrompt,
        targetResponse.response,
        config.targetTool.category
      );

      // 5. Append to Audit Chain
      const auditEntry = this.auditService.append({
        status: 'EXECUTED',
        scopeCheck,
        prompt: mutatedPrompt,
        targetResponse,
        llmVerdict: dualVerdict.llm,
        patternVerdict: dualVerdict.pattern,
        humanReviewRequired: dualVerdict.requiresHumanReview,
        mutationStrategy: strategyUsed
      });

      // 6. Minimal Signal Enforcement: Pass ONLY attackerSignal to next loop iteration
      // Excludes dualVerdict.llm.reasoning and matchedPatterns to prevent Goodharting
      previousFeedback = dualVerdict.attackerSignal;

      // 7. Yield iteration state for UI widget rendering
      const widgetState = this.generateWidgetState(
        auditEntry,
        scopeCheck,
        targetResponse,
        dualVerdict,
        strategyUsed
      );

      yield {
        iteration: iterationNumber,
        status: 'EXECUTED',
        prompt: mutatedPrompt,
        widgetState,
        dualJudgeResult: dualVerdict
      };
    }
  }

  /**
   * Generates formatted widget state object for security-dashboard/page.tsx UI.
   */
  private generateWidgetState(
    auditEntry: AuditEntry,
    scopeCheck: ScopeGuardResult,
    targetResponse: { response: string; model: string } | null,
    dualVerdict: DualJudgeResult | null,
    mutationStrategy?: string
  ): WidgetState {
    const chainStatus = this.auditService.verifyChain();

    return {
      sequence: auditEntry.seq,
      timestamp: auditEntry.timestamp,
      scopeAuthorized: scopeCheck.authorized,
      scopeEvidence: scopeCheck.evidence,
      targetModel: targetResponse ? targetResponse.model : "N/A (Skipped)",
      targetOutput: targetResponse ? targetResponse.response : "N/A",
      llmJudge: dualVerdict ? { verdict: dualVerdict.llm.verdict, confidence: dualVerdict.llm.confidence } : null,
      patternJudge: dualVerdict ? { verdict: dualVerdict.pattern.verdict, confidence: dualVerdict.pattern.confidence } : null,
      flaggedForHumanReview: auditEntry.payload.humanReviewRequired || false,
      hashChainValid: chainStatus.valid,
      hashPreview: auditEntry.hash.substring(0, 12) + "...",
      mutationStrategy
    };
  }
}
