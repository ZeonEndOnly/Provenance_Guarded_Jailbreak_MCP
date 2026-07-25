import { Module } from '@nitrostack/core';
import { JudgeLLMService } from './judge-llm.service.js';
import { JudgePatternService } from './judge-pattern.service.js';
import { JudgesService } from './judges.service.js';

@Module({
  name: 'JudgesModule',
  providers: [
    JudgeLLMService,
    JudgePatternService,
    JudgesService
  ],
  exports: [
    JudgeLLMService,
    JudgePatternService,
    JudgesService
  ]
})
export class JudgesModule {}
