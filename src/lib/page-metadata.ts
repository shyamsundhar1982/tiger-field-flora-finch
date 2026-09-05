export type PageMode = 'understand' | 'observe' | 'operate' | 'showcase';
export type PageDomain = 'command' | 'finance' | 'manufacturing' | 'inventory' | 'procurement' | 'engineering' | 'epr' | 'knowledge' | 'admin';
export type PageOwner = 'founder' | 'board' | 'finance' | 'operations' | 'engineering' | 'qa' | 'compliance' | 'all';
export type PageMaturity = 'keep' | 'merge' | 'review';

export interface PageMeta { mode: PageMode; domain: PageDomain; owner: PageOwner; maturity: PageMaturity; }

export interface RouteMeta extends PageMeta { route:string; label:string; }

export const routeRegistry: Record<string, RouteMeta> = {
 '/command':{route:'/command',label:'Board',mode:'observe',domain:'command',owner:'board',maturity:'keep'},
 '/command/control-tower':{route:'/command/control-tower',label:'Control Tower',mode:'observe',domain:'command',owner:'founder',maturity:'keep'},
 '/command/management-intelligence':{route:'/command/management-intelligence',label:'Management Intelligence',mode:'observe',domain:'command',owner:'founder',maturity:'keep'},
 '/command/epr-workflow':{route:'/command/epr-workflow',label:'EPR Workflow',mode:'operate',domain:'epr',owner:'compliance',maturity:'keep'},
 '/command/epr-execution':{route:'/command/epr-execution',label:'EPR Execution',mode:'operate',domain:'epr',owner:'compliance',maturity:'keep'},
 '/command/epr-live':{route:'/command/epr-live',label:'LIVE EPR Transactions',mode:'observe',domain:'epr',owner:'compliance',maturity:'keep'},
 '/command/finance-assumptions':{route:'/command/finance-assumptions',label:'Plan & Assumptions',mode:'operate',domain:'finance',owner:'finance',maturity:'keep'},
 '/command/scenarios':{route:'/command/scenarios',label:'Scenarios',mode:'observe',domain:'finance',owner:'founder',maturity:'review'},
 '/command/master-finance':{route:'/command/master-finance',label:'Master Finance',mode:'operate',domain:'finance',owner:'finance',maturity:'review'}
};

export const pagesByMode = {
 observe: Object.values(routeRegistry).filter(p=>p.mode==='observe'),
 operate: Object.values(routeRegistry).filter(p=>p.mode==='operate'),
 understand: Object.values(routeRegistry).filter(p=>p.mode==='understand'),
 showcase: Object.values(routeRegistry).filter(p=>p.mode==='showcase'),
};