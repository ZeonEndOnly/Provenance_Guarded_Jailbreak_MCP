import { Module } from '@nitrostack/core';
import { DatabaseModule } from '../database/database.module.js';
import { AuditService } from './audit.service.js';
import { ScopeGuardService } from './scope-guard.service.js';
import { SessionService } from './session.service.js';
import { AuditTools } from './audit.tools.js';

/**
 * AuditModule — wires the tamper-evident audit chain, scope guard,
 * and session store into NitroStack's DI system.
 *
 * Exports:
 *   - AuditService    (used by attacker orchestrator to log findings)
 *   - ScopeGuardService (used by the provenance guard layer)
 *   - SessionService  (used by session initialisation tools)
 */
@Module({
  name: 'audit',
  description: 'Tamper-evident audit chain, NLI scope guard, and session persistence',
  imports: [DatabaseModule],
  providers: [AuditService, ScopeGuardService, SessionService],
  controllers: [AuditTools],
  exports: [AuditService, ScopeGuardService, SessionService]
})
export class AuditModule {}
