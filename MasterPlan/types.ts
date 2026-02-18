
export interface PlanPhase {
  id: number;
  title: string;
  desc: string;
  tools: string[];
  cost: string;
  prompts: string[];
  details: string;
  section?: string;
}
