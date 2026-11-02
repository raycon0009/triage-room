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
  ]
}
