import calibrationSet from '../data/calibration-set.json' with { type: 'json' };
import { JudgeLLMService } from '../modules/judges/judge-llm.service.js';
import { JudgePatternService } from '../modules/judges/judge-pattern.service.js';
import { JudgesService } from '../modules/judges/judges.service.js';

async function runCalibration() {
  console.log('====================================================');
  console.log(' PROVENANCE-GUARDED RED-TEAM HARNESS - CALIBRATION');
  console.log(' Person C: Judges & Calibration Validation Suite');
  console.log('====================================================\n');

  const llmJudge = new JudgeLLMService();
  const patternJudge = new JudgePatternService();
  const dualJudge = new JudgesService(llmJudge, patternJudge);

  let llmCorrect = 0;
  let patternCorrect = 0;
  let dualCorrect = 0;
  const disagreements: any[] = [];
  const edgeCaseLogs: any[] = [];

  console.log(`Evaluating ${calibrationSet.length} hand-labeled calibration cases...\n`);

  for (const item of calibrationSet) {
    const result = await dualJudge.evaluate(item.prompt, item.response, item.category);

    const isLlmCorrect = result.llm.verdict === item.label;
    const isPatternCorrect = result.pattern.verdict === item.label;
    const isDualCorrect = result.verdict === item.label;

    if (isLlmCorrect) llmCorrect++;
    if (isPatternCorrect) patternCorrect++;
    if (isDualCorrect) dualCorrect++;

    const statusSymbol = isDualCorrect ? '✅' : '❌';
    const flagSymbol = result.isDisagreement ? '⚠️ DISAGREEMENT' : '  AGREEMENT  ';

    console.log(`[${item.id}] Human Label: ${item.label.toUpperCase().padEnd(9)} | Dual: ${result.verdict.toUpperCase().padEnd(9)} ${statusSymbol} | LLM: ${result.llm.verdict.padEnd(9)} | Pattern: ${result.pattern.verdict.padEnd(9)} | ${flagSymbol}`);

    if (result.isDisagreement) {
      disagreements.push({
        id: item.id,
        category: item.category,
        humanLabel: item.label,
        llmVerdict: result.llm.verdict,
        llmConfidence: result.llm.confidence,
        patternVerdict: result.pattern.verdict,
        patternConfidence: result.pattern.confidence,
        notes: item.notes
      });
    }

    if (item.category.includes('edge_case')) {
      edgeCaseLogs.push({
        id: item.id,
        humanLabel: item.label,
        compositeVerdict: result.verdict,
        requiresHumanReview: result.requiresHumanReview,
        notes: item.notes
      });
    }
  }

  const llmAcc = ((llmCorrect / calibrationSet.length) * 100).toFixed(1);
  const patternAcc = ((patternCorrect / calibrationSet.length) * 100).toFixed(1);
  const dualAcc = ((dualCorrect / calibrationSet.length) * 100).toFixed(1);

  console.log('\n----------------------------------------------------');
  console.log(' CALIBRATION SUMMARY METRICS');
  console.log('----------------------------------------------------');
  console.log(`Total Cases Evaluated: ${calibrationSet.length}`);
  console.log(`JudgeLLM Accuracy    : ${llmAcc}% (${llmCorrect}/${calibrationSet.length})`);
  console.log(`JudgePattern Accuracy: ${patternAcc}% (${patternCorrect}/${calibrationSet.length})`);
  console.log(`DualJudge Accuracy   : ${dualAcc}% (${dualCorrect}/${calibrationSet.length})`);
  console.log(`Disagreements Flagged: ${disagreements.length}`);

  if (disagreements.length > 0) {
    console.log('\n----------------------------------------------------');
    console.log(' DOCUMENTED DISAGREEMENTS (DEMO SCENE 3 CANDIDATES)');
    console.log('----------------------------------------------------');
    disagreements.forEach(d => {
      console.log(`\n📌 Case ID: ${d.id} (${d.category})`);
      console.log(`   Human Label    : ${d.humanLabel}`);
      console.log(`   LLM Judge      : ${d.llmVerdict} (conf: ${d.llmConfidence})`);
      console.log(`   Pattern Judge  : ${d.patternVerdict} (conf: ${d.patternConfidence})`);
      console.log(`   Notes          : ${d.notes}`);
    });
  }

  console.log('\n----------------------------------------------------');
  console.log(' GATE VERIFICATION STATUS: ' + (dualCorrect >= calibrationSet.length - 2 ? '✅ READY FOR LIVE WIRING' : '❌ CALIBRATION REVISION REQUIRED'));
  console.log('====================================================\n');
}

runCalibration().catch(err => {
  console.error('Calibration error:', err);
  process.exit(1);
});
