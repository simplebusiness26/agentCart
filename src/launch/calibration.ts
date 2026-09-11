import {scoreReport} from "../agentready/score";
import {extractSignals} from "../agentready/extract";
import type {AgentReadyReport,PageEvidence,PageType} from "../agentready/types";

// Score calibration (Phase 11.7). Hand-authored weights drift, so the benchmark asserts the
// relationships that must hold rather than exact numbers: a store an agent can genuinely use
// must outscore one it cannot, and specific failures must produce specific deductions.
//
// GOVERNANCE: scoring stays deterministic, every change is versioned, and historical scores are
// never rewritten. Adjust weights only with a benchmark case that justifies the change.

export interface BenchmarkCase {
  id:string;
  label:string;
  /** What a real agent could actually do here, independent of any score. */
  groundTruth:{discoverable:boolean;understandable:boolean;actionable:boolean};
  pages:Array<{url:string;type:PageType;html:string}>;
  robots?:string;
  sitemap:boolean;
  platform?:"shopify"|"woocommerce"|"wordpress"|"other";
}

export interface CalibrationFinding {
  caseId:string;
  score:number;
  grade:string;
  /** A high score where an agent would in fact fail, or the reverse. */
  discrepancy:"false_positive"|"false_negative"|null;
  detail:string;
}

export interface CalibrationReport {
  scoringVersion:string;
  cases:CalibrationFinding[];
  falsePositives:number;
  falseNegatives:number;
  /** Whether the score may honestly be described as calibrated. */
  validated:boolean;
  summary:string;
}

const toPages=(c:BenchmarkCase):PageEvidence[]=>c.pages.map(p=>{
  const signals=extractSignals(p.html);
  return {url:p.url,pageType:p.type,status:200,title:signals.title,signals};
});

export function runCase(c:BenchmarkCase):AgentReadyReport{
  return scoreReport({url:c.pages[0]?.url||"https://example.com/",pages:toPages(c),
    platform:{platform:c.platform||"other",confidence:c.platform&&c.platform!=="other"?0.9:0,signals:[]},
    robots:c.robots,sitemap:c.sitemap,now:"2026-01-01T00:00:00.000Z"});
}

// Thresholds are deliberately loose. The benchmark checks the ORDER and the presence of
// deductions, not exact values, so a legitimate weight change does not fail it spuriously.
const HIGH=70,LOW=55;

export function calibrate(cases:BenchmarkCase[]):CalibrationReport{
  const findings:CalibrationFinding[]=cases.map(c=>{
    const report=runCase(c);
    const usable=c.groundTruth.discoverable&&c.groundTruth.understandable&&c.groundTruth.actionable;
    let discrepancy:CalibrationFinding["discrepancy"]=null;
    let detail=`Score ${report.score} (${report.grade}).`;

    // False positive: the score looks good but an agent could not complete the journey.
    if(!usable&&report.score>=HIGH){
      discrepancy="false_positive";
      detail+=" An agent could not complete this journey, so this score is too high.";
    }
    // False negative: an ordinary browser journey works, yet the score is punishing.
    if(usable&&report.score<LOW){
      discrepancy="false_negative";
      detail+=" An agent could complete this journey, so this score is too low.";
    }
    return {caseId:c.id,score:report.score,grade:report.grade,discrepancy,detail};
  });

  const falsePositives=findings.filter(f=>f.discrepancy==="false_positive").length;
  const falseNegatives=findings.filter(f=>f.discrepancy==="false_negative").length;
  const validated=falsePositives===0&&falseNegatives===0&&cases.length>=6;

  return {scoringVersion:runCase(cases[0]).scoringVersion,cases:findings,falsePositives,falseNegatives,validated,
    summary:validated
      ? `The scoring model agrees with ground truth across all ${cases.length} benchmark cases.`
      : `The scoring model disagrees with ground truth on ${falsePositives+falseNegatives} of ${cases.length} cases. The score must not be described as validated.`};
}

/** The honest claim AgentCart may make about its score, given the benchmark result. */
export function scoreClaim(report:CalibrationReport){
  return report.validated
    ? "The Agent Ready score has been checked against a benchmark of representative sites and agrees with what an agent could actually do in each."
    : "The Agent Ready score is a deterministic assessment of published signals. It has not yet been validated against real agent journeys, so treat it as a guide rather than a guarantee.";
}
