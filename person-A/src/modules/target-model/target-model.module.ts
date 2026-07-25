import { Module } from '@nitrostack/core';
import { TargetModelService } from './target-model.service.js';
import { TargetModelTools } from './target-model.tools.js';
import { AttackerOrchestrator } from './attacker.orchestrator.js';

@Module({
  name: 'target-model',
  description: 'Target model infrastructure: wraps Ollama as MCP tools for red-teaming',
  controllers: [TargetModelTools],
  providers: [TargetModelService, AttackerOrchestrator],
  exports: [TargetModelService, AttackerOrchestrator],
})
export class TargetModelModule {}
