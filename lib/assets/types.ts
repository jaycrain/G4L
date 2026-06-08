// Asset content model. Assets are VERSIONED CONTENT delivered by one generic engine —
// never bespoke screens (CLAUDE.md principle 1). A definition is data the engine renders;
// swapping/editing an asset is a content change, not an engineering change.

export type AssetVariant = 'a' | 'b';

export type StepInput = {
  kind: 'text' | 'textarea' | 'list' | 'choice';
  key: string;
  label: string;
  required?: boolean;
  count?: number; // for 'list'
  options?: string[]; // for 'choice'
};

export type Step =
  | { type: 'prose'; body: string }
  | { type: 'prompt'; input: StepInput }
  | { type: 'reflection'; key: string; label: string };

export type ScienceCheck = { title: string; body: string; attribution: string };

export type AssetDefinition = {
  code: string;
  version: string;
  variant?: AssetVariant;
  title: string;
  intro: string;
  steps: Step[];
  scienceCheckRef?: string; // e.g. 'greg.science_check.R-4' (Greg's Layer-2 sub-corpus)
  scienceCheck?: ScienceCheck; // member-facing, signed by the scientist
};
