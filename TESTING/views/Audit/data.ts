
import { AuditIssue, AuditCategory } from '../../types';

// Extended interface for local UI needs
export interface ExtendedAuditCategory extends AuditCategory {
  desc: string;
  locked?: boolean;
}

export const LOADING_MSGS = [
  "Admiring the magnificent colors...",
  "Reading the beautiful story...",
  "Observing class naming...",
  "Gathering stardust...",
  "Whispering to the pixels..."
];

export const CATEGORIES: ExtendedAuditCategory[] = [
  { 
    id: 'adoption', 
    label: 'Adoption Rate', 
    desc: 'DS Components vs. Detached Layers', 
    score: 92, 
    icon: '❖', 
    color: 'bg-[#ff90e8]', 
    issuesCount: 3 
  },
  { 
    id: 'coverage', 
    label: 'Token Coverage', 
    desc: 'Linked Variables vs. Hardcoded Values', 
    score: 85, 
    icon: '🎨', 
    color: 'bg-blue-300', 
    issuesCount: 4 
  },
  { 
    id: 'a11y', 
    label: 'Accessibility Pass', 
    desc: 'WCAG Contrast & Touch Targets', 
    score: 100, 
    icon: '♿', 
    color: 'bg-green-300', 
    issuesCount: 0 
  },
  { 
    id: 'naming', 
    label: 'Naming Accuracy', 
    desc: 'Layer Naming Conventions', 
    score: 60, 
    icon: '✎', 
    color: 'bg-yellow-300', 
    issuesCount: 5 
  },
  { 
    id: 'copy', 
    label: 'Copywriting', 
    desc: 'Tone, Localization & Microcopy', 
    score: -1, // Insufficient Data for Demo
    icon: '¶', 
    color: 'bg-orange-300', 
    issuesCount: 0 
  },
];

export const MOCK_PAGES = ["Home V2", "Design System", "Archive 2023", "Playground", "Checkout Flow", "Auth Screens"];

export const DS_ISSUES: AuditIssue[] = [
  { id: '1', categoryId: 'coverage', msg: 'Hardcoded Hex', severity: 'HIGH', layerId: 'n1', fix: 'Use var(--primary)', tokenPath: 'sys.color.primary.500', pageName: 'Home V2' },
  { id: '2', categoryId: 'naming', msg: 'Layer "Frame 432"', severity: 'LOW', layerId: 'n2', fix: 'Rename to "Card_Header"', pageName: 'Home V2' },
  { id: '3', categoryId: 'adoption', msg: 'Detached Instance', severity: 'MED', layerId: 'n3', fix: 'Reattach to master', pageName: 'Design System' },
  { id: '4', categoryId: 'naming', msg: 'Misaligned 2px', severity: 'LOW', layerId: 'n4', fix: 'Snap to 8px grid', pageName: 'Archive 2023' },
  { id: '5', categoryId: 'coverage', msg: 'Unknown Font', severity: 'HIGH', layerId: 'n5', fix: 'Use Space Grotesk', pageName: 'Home V2' },
  { 
    id: '6', 
    categoryId: 'adoption', 
    msg: 'Component Deviation', 
    severity: 'HIGH', 
    layerId: 'cta-primary', 
    layerIds: ['cta-1', 'cta-2', 'cta-3', 'cta-4', 'cta-5', 'cta-6', 'cta-7', 'cta-8', 'cta-9', 'cta-10'], 
    fix: 'Font is 12px (Master is 26px). Suggestion: Create "Small" variant & apply to all.', 
    pageName: 'Home V2' 
  },
  { id: 'c1', categoryId: 'copy', msg: 'Localization Risk', severity: 'MED', layerId: 'txt-checkout', fix: 'Text container width is fixed. Expand for German translation overflow.', pageName: 'Checkout Flow' },
  { id: 'c2', categoryId: 'copy', msg: 'Inconsistent Tone', severity: 'LOW', layerId: 'txt-error', fix: 'Error message is too robotic ("Invalid Input"). Suggestion: "Please check your email".', pageName: 'Auth Screens' },
];

export const A11Y_ISSUES: AuditIssue[] = [
  { id: 'a1', categoryId: 'contrast', msg: 'Contrast Fail 3.2:1', severity: 'HIGH', layerId: 'btn-txt', fix: 'Darken text to #4A4A4A', pageName: 'Home V2' },
  { id: 'a2', categoryId: 'touch', msg: 'Touch Target 32px', severity: 'MED', layerId: 'icon-btn', fix: 'Increase padding to 44px', pageName: 'Home V2' },
  { id: 'a3', categoryId: 'focus', msg: 'Missing :focus state', severity: 'MED', layerId: 'input-field', fix: 'Add Focus Variant', pageName: 'Design System' },
];

export const UX_ISSUES: AuditIssue[] = [
  { id: 'u1', categoryId: 'flow', msg: 'Dead End Interaction', severity: 'HIGH', layerId: 'submit-btn', fix: 'Add Success/Error State', pageName: 'Home V2' },
  { id: 'u2', categoryId: 'semantics', msg: 'Input missing Label', severity: 'MED', layerId: 'email-input', fix: 'Wrap in <label> component', pageName: 'Home V2' },
  { id: 'u3', categoryId: 'feedback', msg: 'No Loading State', severity: 'LOW', layerId: 'card-list', fix: 'Add Skeleton Loader', pageName: 'Home V2' },
];

export const PROTO_ISSUES: AuditIssue[] = [
  { id: 'p1', categoryId: 'logic', msg: 'Broken Link', severity: 'HIGH', layerId: 'nav-home', fix: 'Link to Frame: Home_V2', pageName: 'Home V2' },
  { id: 'p2', categoryId: 'visual', msg: 'Missing Confirmation Wireframe', severity: 'HIGH', layerId: 'flow-end', fix: 'Create Success State', pageName: 'Home V2' },
];
