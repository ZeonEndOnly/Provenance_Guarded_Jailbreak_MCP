import { McpApp, Module, ConfigModule } from '@nitrostack/core';
import { TargetModelModule } from './modules/target-model/target-model.module.js';

/**
 * Root Application Module
 * 
 * Provenance-Guarded Red-Team Harness
 * Person A: Target Model Infrastructure
 */
@McpApp({
    module: AppModule,
    server: {
        name: 'duelists-redteam',
        version: '1.0.0'
    },
    logging: {
        level: 'info'
    }
})
@Module({
    name: 'duelists',
    description: 'Provenance-guarded red-teaming harness with target model infrastructure',
    imports: [
        ConfigModule.forRoot(),
        TargetModelModule,
    ],
})
export class AppModule { }
