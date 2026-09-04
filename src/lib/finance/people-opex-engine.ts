export type PeopleRole={id:string;role:string;department:string;startMonth:number;headcount:number;monthlyCostLakh:number;benefitsPct:number;hiringCostLakh:number};
export type CompanyOpex={id:string;category:string;startMonth:number;monthlyCostLakh:number;annualEscalationPct:number};
export type PeopleOpexAssumptions={people:PeopleRole[];companyOpex:CompanyOpex[];opexMultiplier:number};
export type PeopleOpexMonth={m:number;headcount:number;payroll:number;benefits:number;hiringCosts:number;peopleCost:number;companyOpex:number;totalOpex:number};
export const DEFAULT_PEOPLE_OPEX:PeopleOpexAssumptions={opexMultiplier:1,people:[
{id:"founder",role:"Founder / CEO",department:"Leadership",startMonth:1,headcount:1,monthlyCostLakh:0,benefitsPct:0,hiringCostLakh:0},
{id:"engineering",role:"Engineering",department:"Engineering",startMonth:3,headcount:1,monthlyCostLakh:0.8,benefitsPct:10,hiringCostLakh:0.5},
{id:"operations",role:"Operations / Production",department:"Operations",startMonth:6,headcount:2,monthlyCostLakh:0.55,benefitsPct:10,hiringCostLakh:0.3},
{id:"quality",role:"Quality",department:"Quality",startMonth:8,headcount:1,monthlyCostLakh:0.5,benefitsPct:10,hiringCostLakh:0.25},
{id:"sales",role:"Sales / Commercial",department:"Sales",startMonth:9,headcount:1,monthlyCostLakh:0.5,benefitsPct:10,hiringCostLakh:0.25},
],companyOpex:[
{id:"rent",category:"Facility / rent",startMonth:1,monthlyCostLakh:0.5,annualEscalationPct:5},
{id:"software",category:"Software / systems",startMonth:1,monthlyCostLakh:0.15,annualEscalationPct:5},
{id:"professional",category:"Professional / CA / legal",startMonth:1,monthlyCostLakh:0.2,annualEscalationPct:5},
{id:"travel",category:"Travel / administration",startMonth:1,monthlyCostLakh:0.15,annualEscalationPct:5},
{id:"insurance",category:"Insurance / compliance",startMonth:4,monthlyCostLakh:0.1,annualEscalationPct:5},
]};
export function buildPeopleOpexMonths(a:PeopleOpexAssumptions=DEFAULT_PEOPLE_OPEX):PeopleOpexMonth[]{return Array.from({length:36},(_,i)=>{const m=i+1;let headcount=0,payroll=0,benefits=0,hiringCosts=0;for(const p of a.people){if(m>=p.startMonth){headcount+=p.headcount;payroll+=p.headcount*p.monthlyCostLakh;benefits+=p.headcount*p.monthlyCostLakh*p.benefitsPct/100;if(m===p.startMonth)hiringCosts+=p.headcount*p.hiringCostLakh}}let companyOpex=0;for(const c of a.companyOpex){if(m>=c.startMonth){const years=Math.floor((m-c.startMonth)/12);companyOpex+=c.monthlyCostLakh*Math.pow(1+c.annualEscalationPct/100,years)}}const peopleCost=payroll+benefits+hiringCosts;return{m,headcount,payroll,benefits,hiringCosts,peopleCost,companyOpex,totalOpex:(peopleCost+companyOpex)*a.opexMultiplier}})}
export function peopleOpexTotals(rows:PeopleOpexMonth[]){return rows.reduce((a,r)=>({...a,peopleCost:a.peopleCost+r.peopleCost,companyOpex:a.companyOpex+r.companyOpex,totalOpex:a.totalOpex+r.totalOpex,hiringCosts:a.hiringCosts+r.hiringCosts}),{peopleCost:0,companyOpex:0,totalOpex:0,hiringCosts:0})}
