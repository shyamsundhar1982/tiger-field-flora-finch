export type PageMode = 'understand' | 'observe' | 'operate' | 'showcase';
export type PageDomain = 'command' | 'finance' | 'manufacturing' | 'inventory' | 'procurement' | 'engineering' | 'epr' | 'knowledge' | 'admin';
export type PageOwner = 'founder' | 'board' | 'finance' | 'operations' | 'engineering' | 'qa' | 'compliance' | 'all';
export type PageMaturity = 'keep' | 'merge' | 'review';

export interface PageMeta {
 mode: PageMode;
 domain: PageDomain;
 owner: PageOwner;
 maturity: PageMaturity;
}

export const pageRegistry: Record<string, PageMeta> = {
 board:{mode:'observe',domain:'command',owner:'board',maturity:'keep'},
 controlTower:{mode:'observe',domain:'command',owner:'founder',maturity:'keep'},
 managementIntelligence:{mode:'observe',domain:'command',owner:'founder',maturity:'keep'},
 eprWorkflow:{mode:'operate',domain:'epr',owner:'compliance',maturity:'keep'},
 eprExecution:{mode:'operate',domain:'epr',owner:'compliance',maturity:'keep'},
 liveEprTransactions:{mode:'observe',domain:'epr',owner:'compliance',maturity:'keep'},
 financialPlanning:{mode:'operate',domain:'finance',owner:'finance',maturity:'keep'},
 scenarios:{mode:'observe',domain:'finance',owner:'founder',maturity:'review'},
 masterFinance:{mode:'operate',domain:'finance',owner:'finance',maturity:'review'},
 aluminiumVertical:{mode:'observe',domain:'finance',owner:'founder',maturity:'review'},
 finance:{mode:'observe',domain:'finance',owner:'finance',maturity:'merge'},
 financeControl:{mode:'operate',domain:'finance',owner:'finance',maturity:'keep'},
 balanceSheet:{mode:'observe',domain:'finance',owner:'finance',maturity:'keep'},
 caAudit:{mode:'observe',domain:'finance',owner:'finance',maturity:'keep'},
 funding:{mode:'operate',domain:'finance',owner:'founder',maturity:'keep'},
 cash:{mode:'operate',domain:'finance',owner:'finance',maturity:'keep'},
 production:{mode:'operate',domain:'manufacturing',owner:'operations',maturity:'keep'},
 operations:{mode:'operate',domain:'procurement',owner:'operations',maturity:'keep'},
 manufacturing:{mode:'operate',domain:'manufacturing',owner:'operations',maturity:'keep'},
 inventory:{mode:'operate',domain:'inventory',owner:'operations',maturity:'keep'},
 componentControl:{mode:'operate',domain:'inventory',owner:'operations',maturity:'keep'},
 product:{mode:'operate',domain:'engineering',owner:'engineering',maturity:'keep'},
 bom:{mode:'operate',domain:'engineering',owner:'engineering',maturity:'keep'},
 engineering:{mode:'operate',domain:'engineering',owner:'engineering',maturity:'keep'},
 quality:{mode:'operate',domain:'manufacturing',owner:'qa',maturity:'keep'},
 technical:{mode:'understand',domain:'knowledge',owner:'engineering',maturity:'keep'},
 designPhilosophy:{mode:'understand',domain:'knowledge',owner:'founder',maturity:'keep'},
 aiKnowledge:{mode:'understand',domain:'knowledge',owner:'all',maturity:'merge'},
 qaVerification:{mode:'observe',domain:'manufacturing',owner:'qa',maturity:'review'}
};