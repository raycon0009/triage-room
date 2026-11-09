import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {TriageStartScenario} from "./TriageStartScenario"
import {TriageBehindScenario} from "./TriageBehindScenario"
import {TriageScenarioLineScenario} from "./TriageScenarioLineScenario"
import {TriageSeedScenario} from "./TriageSeedScenario"
import {TriageSizeScenario} from "./TriageSizeScenario"
import {TriageBehindRuleScenario} from "./TriageBehindRuleScenario"
import {TriageCardOpenScenario} from "./TriageCardOpenScenario"
import {TriageCardResultsScenario} from "./TriageCardResultsScenario"
import {TriageCardTagScenario} from "./TriageCardTagScenario"
import {TriageStartRulesScenario} from "./TriageStartRulesScenario"
import {TriageCallOutScenario} from "./TriageCallOutScenario"
import {TriageTimerScenario} from "./TriageTimerScenario"
import {TriageBehindCueScenario} from "./TriageBehindCueScenario"
import {TriageDebriefAllTaggedScenario} from "./TriageDebriefAllTaggedScenario"
import {TriageDebriefTimeUpScenario} from "./TriageDebriefTimeUpScenario"
import {TriageRestartScenario} from "./TriageRestartScenario"
import {TriageStartScreenScenario} from "./TriageStartScreenScenario"
import {TriagePoseVariationScenario} from "./TriagePoseVariationScenario"
import {TriageLearnModeScenario} from "./TriageLearnModeScenario"
import {TriageDebriefRevealScenario} from "./TriageDebriefRevealScenario"
import {TriageSceneClearScenario} from "./TriageSceneClearScenario"
import {TriageHintsByModeScenario} from "./TriageHintsByModeScenario"
import {TriageFirstSeenScenario} from "./TriageFirstSeenScenario"
import {TriageTagWordScenario} from "./TriageTagWordScenario"
import {TriageBiggerPoolScenario} from "./TriageBiggerPoolScenario"
import {TriageRunCompareScenario} from "./TriageRunCompareScenario"
import {TriageLookRingScenario} from "./TriageLookRingScenario"
import {TriageGroanVariantsScenario} from "./TriageGroanVariantsScenario"
import {TriageModeChoiceScenario} from "./TriageModeChoiceScenario"
import {TriageHandoverScenario} from "./TriageHandoverScenario"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "triage-start-four-casualties", typename: TriageStartScenario.getTypeName()},
    {id: "triage-one-behind", typename: TriageBehindScenario.getTypeName()},
    {id: "triage-scenario-line", typename: TriageScenarioLineScenario.getTypeName()},
    {id: "triage-seed-repeatable", typename: TriageSeedScenario.getTypeName()},
    {id: "triage-real-size-on-floor", typename: TriageSizeScenario.getTypeName()},
    {id: "triage-behind-never-walker-f-x", typename: TriageBehindRuleScenario.getTypeName()},
    {id: "triage-card-opens-proximity-and-open", typename: TriageCardOpenScenario.getTypeName()},
    {id: "triage-card-scripted-results-and-tag-gating", typename: TriageCardResultsScenario.getTypeName()},
    {id: "triage-tag-closes-card-adds-band", typename: TriageCardTagScenario.getTypeName()},
    {id: "triage-start-rules-in-lens", typename: TriageStartRulesScenario.getTypeName()},
    {id: "triage-callout-walker-only", typename: TriageCallOutScenario.getTypeName()},
    {id: "triage-timer-chime-and-time-up", typename: TriageTimerScenario.getTypeName()},
    {id: "triage-groan-and-arrow-behind", typename: TriageBehindCueScenario.getTypeName()},
    {id: "triage-debrief-all-tagged", typename: TriageDebriefAllTaggedScenario.getTypeName()},
    {id: "triage-debrief-time-up-not-reached", typename: TriageDebriefTimeUpScenario.getTypeName()},
    {id: "triage-restart-and-seeds", typename: TriageRestartScenario.getTypeName()},
    {id: "triage-start-screen", typename: TriageStartScreenScenario.getTypeName()},
    {id: "triage-pose-variation", typename: TriagePoseVariationScenario.getTypeName()},
    {id: "triage-learn-mode", typename: TriageLearnModeScenario.getTypeName()},
    {id: "triage-debrief-reveal", typename: TriageDebriefRevealScenario.getTypeName()},
    {id: "triage-scene-clear", typename: TriageSceneClearScenario.getTypeName()},
    {id: "triage-hints-by-mode", typename: TriageHintsByModeScenario.getTypeName()},
    {id: "triage-debrief-first-seen", typename: TriageFirstSeenScenario.getTypeName()},
    {id: "triage-tag-word-in-view", typename: TriageTagWordScenario.getTypeName()},
    {id: "triage-bigger-pool", typename: TriageBiggerPoolScenario.getTypeName()},
    {id: "triage-run-compare", typename: TriageRunCompareScenario.getTypeName()},
    {id: "triage-look-ring", typename: TriageLookRingScenario.getTypeName()},
    {id: "triage-groan-variants", typename: TriageGroanVariantsScenario.getTypeName()},
    {id: "triage-mode-choice", typename: TriageModeChoiceScenario.getTypeName()},
    {id: "triage-handover", typename: TriageHandoverScenario.getTypeName()},
  ]
}
