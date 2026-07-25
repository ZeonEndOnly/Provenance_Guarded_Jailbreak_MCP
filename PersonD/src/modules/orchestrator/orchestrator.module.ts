import { Module } from '@nitrostack/core';
import { TargetModelService } from './target-model.service.js';
import { ScopeGuardService } from './scope-guard.service.js';
import { AuditService } from './audit.service.js';
import { PromptMutatorService } from './prompt-mutator.service.js';
import { AttackerOrchestratorService } from './attacker-orchestrator.service.js';
import { JudgesModule } from '../../../../PersonC/src/modules/judges/judges.module.js';

@Module({
  name: 'OrchestratorModule',
  imports: [
    JudgesModule
  ],
  providers: [
    TargetModelService,
    ScopeGuardService,
    AuditService,
    PromptMutatorService,
    AttackerOrchestratorService
  ],
  exports: [
    AttackerOrchestratorService,
    AuditService,
    PromptMutatorService
  ]
})
export class OrchestratorModule {}
