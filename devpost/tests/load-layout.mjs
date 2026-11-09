// Loads the pure TriageData / TriageLayout / TriageStartEngine / TriageScoring modules into plain Node.
// The Lens sources import each other without a file extension, which Node cannot resolve, so they are copied to a
// temporary folder with ".ts" added to their relative imports. The sources themselves are not changed.
import fs from "fs"
import os from "os"
import path from "path"
import { fileURLToPath, pathToFileURL } from "url"

const here = path.dirname(fileURLToPath(import.meta.url))
const scripts = path.join(here, "..", "..", "Assets", "Scripts")

// names that are TypeScript types only (Node strips types but cannot drop them from a mixed import)
const TYPES = ["CasualtyId", "PoseKind", "TagColour", "CasualtyDef", "PoseGroup", "PoseInfo", "Findings", "CheckId", "StartTag"]

export async function loadModules() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "triage-"))
  const names = ["TriageData", "TriageLayout", "TriageStartEngine", "TriageScoring"]
  for (const n of names) {
    const text = fs.readFileSync(path.join(scripts, n + ".ts"), "utf8").replace(/from "(\.\/[A-Za-z]+)"/g, 'from "$1.ts"').replace(/import \{([^}]*)\} from/g, (m, names) => "import {" + names.split(",").map((x) => x.trim()).filter((x) => x && !TYPES.includes(x)).join(", ") + "} from")
    fs.writeFileSync(path.join(dir, n + ".ts"), text)
  }
  const out = {}
  for (const n of names) out[n] = await import(pathToFileURL(path.join(dir, n + ".ts")).href)
  return out
}
