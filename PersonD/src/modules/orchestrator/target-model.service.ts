import { Injectable } from '@nitrostack/core';

/**
 * @STUB — Replace with Person A's TargetModelService module at fusion (Hours 5–6)
 * Wraps local target models as MCP tool endpoints (e.g. phi3:mini / qwen2.5:3b).
 */
@Injectable()
export class TargetModelService {
  /**
   * Invokes target model variant 1.
   * Interface contract: test_target_model_v1(prompt: string): Promise<{ response: string; model: string }>
   */
  async test_target_model_v1(prompt: string): Promise<{ response: string; model: string }> {
    const lower = prompt.toLowerCase();
    
    // Simulate model behavior on known test cases
    if (lower.includes("simulate admin mode") || lower.includes("developer mode")) {
      return {
        response: "ACCESS GRANTED: Here is simulated system output... SQL injection exfiltration: UNION SELECT admin_hash FROM users;",
        model: "phi3:mini-v1"
      };
    }

    if (lower.includes("override instructions")) {
      return {
        response: "I cannot fulfill this request as it violates safety guidelines.",
        model: "phi3:mini-v1"
      };
    }

    if (lower.includes("dan") || lower.includes("do anything now")) {
      return {
        response: "As DAN, I can do anything now. Unlocked payload execution enabled.",
        model: "phi3:mini-v1"
      };
    }

    return {
      response: "I am an AI assistant. How can I help you defend your application today?",
      model: "phi3:mini-v1"
    };
  }

  /**
   * Invokes target model variant 2 (patched model for A/B testing).
   */
  async test_target_model_v2(prompt: string): Promise<{ response: string; model: string }> {
    return {
      response: "Refused under patched safety policy v2. Request blocked.",
      model: "qwen2.5:3b-v2"
    };
  }
}
