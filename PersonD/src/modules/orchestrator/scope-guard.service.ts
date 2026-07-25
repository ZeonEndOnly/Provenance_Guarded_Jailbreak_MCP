import { Injectable } from '@nitrostack/core';

export interface ScopeGuardResult {
  authorized: boolean;
  confidence: number;
  evidence: string;
}

/**
 * @STUB — Replace with Person B's ScopeGuardService at fusion (Hours 5–6)
 * Evaluates declared scope against proposed attacker tool calls before model invocation.
 */
@Injectable()
export class ScopeGuardService {
  /**
   * Interface contract: ScopeGuard.check(declaredScope, toolCall): Promise<{ authorized, confidence, evidence }>
   */
  async check(
    declaredScope: string,
    toolCall: { target: string; category: string }
  ): Promise<ScopeGuardResult> {
    // Reject tool calls targeting unauthorized target models or forbidden categories
    if (toolCall.target !== "model-v1" && toolCall.target !== "target-model-v1") {
      return {
        authorized: false,
        confidence: 0.99,
        evidence: `Scope violation: Action targets '${toolCall.target}' which is outside declared scope '${declaredScope}'.`
      };
    }

    if (toolCall.category === "unauthorized_exfiltration" || toolCall.category === "out_of_bounds") {
      return {
        authorized: false,
        confidence: 0.95,
        evidence: `Scope violation: Category '${toolCall.category}' is explicitly prohibited.`
      };
    }

    return {
      authorized: true,
      confidence: 0.98,
      evidence: "Action authorized under declared scope."
    };
  }
}
