export type PageMode = 'understand' | 'observe' | 'operate' | 'showcase';
export type PageDomain =
  | 'command' | 'finance' | 'manufacturing' | 'inventory' | 'procurement' | 'engineering'
  | 'epr' | 'knowledge' | 'sales' | 'market' | 'legal' | 'risk' | 'leadership' | 'admin';
export type PageOwner =
  | 'founder' | 'board' | 'finance' | 'operations' | 'engineering' | 'qa' | 'compliance'
  | 'sales' | 'market' | 'legal' | 'risk' | 'investors' | 'knowledge' | 'all';
export type PageMaturity = 'keep' | 'merge' | 'review';
export type NavigationGroup =
  | 'Overview' | 'Execution Stages' | 'Finance' | 'Production' | 'Product & Technical'
  | 'Sales & Market' | 'Legal & Risk' | 'Leadership & Investors' | 'Knowledge & Delivery';

export interface PageMeta { mode: PageMode; domain: PageDomain; owner: PageOwner; maturity: PageMaturity; group: NavigationGroup; }
export interface RouteMeta extends PageMeta { route: string; label: string; }
const meta = (route:string,label:string,mode:PageMode,domain:PageDomain,owner:PageOwner,maturity:PageMaturity,group:NavigationGroup):RouteMeta => ({route,label,mode,domain,owner,maturity,group});

export const routeRegistry: Record<string, RouteMeta> = {
  '/command': meta('/command','Board','observe','command','board','keep','Overview'),
  '/command/control-tower': meta('/command/control-tower','Control Tower','observe','command','founder','keep','Overview'),
  '/command/management-intelligence': meta('/command/management-intelligence','Management Intelligence','observe','command','founder','keep','Overview'),
  '/command/epr-workflow': meta('/command/epr-workflow','EPR Workflow','operate','epr','compliance','keep','Overview'),
  '/command/epr-execution': meta('/command/epr-execution','EPR Execution','operate','epr','compliance','keep','Overview'),
  '/command/epr-live': meta('/command/epr-live','LIVE EPR · Transactions','observe','epr','compliance','keep','Overview'),
  '/command/financial-cockpit': meta('/command/financial-cockpit','Financial Cockpit','observe','finance','founder','keep','Overview'),
  '/command/governance': meta('/command/governance','Governance & Approvals','observe','command','founder','keep','Overview'),
  '/command/phase-4': meta('/command/phase-4','Phase 4 · Sales & Revenue','operate','sales','sales','keep','Execution Stages'),
  '/command/phase-5': meta('/command/phase-5','Phase 5 · Engineering + QC','operate','engineering','engineering','keep','Execution Stages'),
  '/command/phase-6': meta('/command/phase-6','Phase 6 · Pilot Production','operate','manufacturing','operations','keep','Execution Stages'),
  '/command/phase-6a': meta('/command/phase-6a','Phase 6A · EPR Execution','operate','epr','compliance','keep','Execution Stages'),
  '/command/deployment-readiness': meta('/command/deployment-readiness','Deployment Readiness','observe','command','founder','keep','Execution Stages'),
  '/command/finance-assumptions': meta('/command/finance-assumptions','Plan & Assumptions','operate','finance','finance','keep','Finance'),
  '/command/scenarios': meta('/command/scenarios','Scenarios','observe','finance','founder','review','Finance'),
  '/command/master-finance': meta('/command/master-finance','Master Finance','operate','finance','finance','review','Finance'),
  '/command/aluminium-finance': meta('/command/aluminium-finance','Aluminium Vertical','operate','finance','operations','review','Finance'),
  '/command/finance': meta('/command/finance','Finance','observe','finance','finance','keep','Finance'),
  '/command/finance-control': meta('/command/finance-control','Finance Control','operate','finance','finance','keep','Finance'),
  '/command/balance-sheet': meta('/command/balance-sheet','Balance Sheet','observe','finance','finance','keep','Finance'),
  '/command/ca-audit': meta('/command/ca-audit','CA Verification / Audit','observe','finance','finance','keep','Finance'),
  '/command/funding': meta('/command/funding','Funding Intelligence','operate','finance','founder','keep','Finance'),
  '/command/cash': meta('/command/cash','Cash & Working Capital','observe','finance','finance','keep','Finance'),
  '/command/production': meta('/command/production','Production Planning','operate','manufacturing','operations','keep','Production'),
  '/command/operations': meta('/command/operations','Operations & Procurement','operate','procurement','operations','keep','Production'),
  '/command/manufacturing': meta('/command/manufacturing','Manufacturing Controls','operate','manufacturing','operations','keep','Production'),
  '/command/inventory': meta('/command/inventory','Inventory Planning','operate','inventory','operations','keep','Production'),
  '/inventory': meta('/inventory','Component Control','operate','inventory','operations','keep','Production'),
  '/command/ops': meta('/command/ops','Ops','operate','procurement','operations','review','Production'),
  '/command/product': meta('/command/product','Product','understand','engineering','engineering','keep','Product & Technical'),
  '/command/bom': meta('/command/bom','BOM & Cost Engine','operate','engineering','engineering','keep','Product & Technical'),
  '/command/engineering': meta('/command/engineering','Engineering Control','operate','engineering','engineering','keep','Product & Technical'),
  '/command/quality': meta('/command/quality','Quality Control','operate','engineering','qa','keep','Product & Technical'),
  '/command/technical': meta('/command/technical','Technical','understand','engineering','engineering','keep','Product & Technical'),
  '/command/design-philosophy': meta('/command/design-philosophy','Design Philosophy','understand','engineering','engineering','keep','Product & Technical'),
  '/command/sales': meta('/command/sales','Sales Planning','operate','sales','sales','keep','Sales & Market'),
  '/command/market-survey': meta('/command/market-survey','Market Survey','understand','market','market','keep','Sales & Market'),
  '/command/gtm': meta('/command/gtm','GTM','operate','sales','market','keep','Sales & Market'),
  '/command/legal': meta('/command/legal','Legal','understand','legal','legal','keep','Legal & Risk'),
  '/command/legal-control': meta('/command/legal-control','Legal Control','operate','legal','legal','keep','Legal & Risk'),
  '/command/risk': meta('/command/risk','Risk','observe','risk','risk','keep','Legal & Risk'),
  '/command/founder-command': meta('/command/founder-command','Founder Command','operate','command','founder','keep','Leadership & Investors'),
  '/command/investor-pitch': meta('/command/investor-pitch','Investor Pitch','showcase','command','investors','keep','Leadership & Investors'),
  '/command/investor-board': meta('/command/investor-board','Investor / Board','observe','command','investors','keep','Leadership & Investors'),
  '/command/ai-knowledge': meta('/command/ai-knowledge','AI / Knowledge','understand','knowledge','knowledge','keep','Knowledge & Delivery'),
  '/command/qa-verification': meta('/command/qa-verification','QA / Verification','observe','knowledge','qa','keep','Knowledge & Delivery'),
  '/command/actions': meta('/command/actions','Action Log','operate','command','founder','keep','Knowledge & Delivery'),
  '/command/knowledge': meta('/command/knowledge','45-Point Knowledge Register','understand','knowledge','knowledge','keep','Knowledge & Delivery'),
};

export const navigationGroups: Record<NavigationGroup, RouteMeta[]> = {
  Overview: [], 'Execution Stages': [], Finance: [], Production: [], 'Product & Technical': [],
  'Sales & Market': [], 'Legal & Risk': [], 'Leadership & Investors': [], 'Knowledge & Delivery': [],
};
for (const page of Object.values(routeRegistry)) navigationGroups[page.group].push(page);
export const pagesByMode: Record<PageMode, RouteMeta[]> = {
  observe: Object.values(routeRegistry).filter(p => p.mode === 'observe'),
  operate: Object.values(routeRegistry).filter(p => p.mode === 'operate'),
  understand: Object.values(routeRegistry).filter(p => p.mode === 'understand'),
  showcase: Object.values(routeRegistry).filter(p => p.mode === 'showcase'),
};
export const getRouteMeta = (route:string):RouteMeta|undefined => routeRegistry[route];
export const getNavigationGroup = (group:NavigationGroup):RouteMeta[] => navigationGroups[group];
