export type PeopleOfficeGroup = "people" | "office" | "statutory" | "outsourcing";

export type PeopleOfficeLedgerItem = {
  id: string;
  group: PeopleOfficeGroup;
  name: string;
  stage: string;
  quantity: number;
  monthlyUnitCostLakh: number;
  startMonth: number;
  endMonth: number;
  oneTimeCostLakh: number;
  oneTimeMonth: number;
  notes?: string;
};

export const PEOPLE_OFFICE_GROUP_META: Record<PeopleOfficeGroup, { label: string; description: string }> = {
  people: {
    label: "People & Manpower",
    description: "Payroll, retainers, contract manpower and people-related operating cost.",
  },
  office: {
    label: "Office & Facilities",
    description: "Rent, utilities, communications, facility services and recurring administration overhead.",
  },
  statutory: {
    label: "Statutory & Professional",
    description: "CA, GST filing, ROC/CS, legal, IP and other professional compliance services.",
  },
  outsourcing: {
    label: "Outsourcing",
    description: "External engineering, prototype, manufacturing support, creative, IT and other outsourced work.",
  },
};

const row = (
  id: string,
  group: PeopleOfficeGroup,
  name: string,
  stage: string,
): PeopleOfficeLedgerItem => ({
  id,
  group,
  name,
  stage,
  quantity: 1,
  monthlyUnitCostLakh: 0,
  startMonth: 1,
  endMonth: 36,
  oneTimeCostLakh: 0,
  oneTimeMonth: 1,
  notes: "",
});

export const DEFAULT_PEOPLE_OFFICE_LEDGER: PeopleOfficeLedgerItem[] = [
  row("people-founder-management", "people", "Founder / management payroll", "Foundation"),
  row("people-engineering-operations", "people", "Engineering / operations payroll", "Prototype"),
  row("people-finance-admin", "people", "Finance / administration payroll", "Foundation"),
  row("people-contract-manpower", "people", "Contract / temporary manpower", "Scale"),
  row("office-rent", "office", "Office / workshop rent", "Foundation"),
  row("office-utilities", "office", "Electricity / utilities", "Foundation"),
  row("office-connectivity", "office", "Internet / communications", "Foundation"),
  row("office-facility-services", "office", "Facility services / insurance", "Foundation"),
  row("statutory-ca-gst", "statutory", "CA / accounting / GST filing", "Foundation"),
  row("statutory-cs-roc", "statutory", "Company secretarial / ROC", "Foundation"),
  row("statutory-legal-ip", "statutory", "Legal / IP / compliance", "Validation"),
  row("outsourcing-engineering", "outsourcing", "Engineering / CAD / analysis outsourcing", "Prototype"),
  row("outsourcing-prototype", "outsourcing", "Prototype / manufacturing support", "Prototype"),
  row("outsourcing-marketing", "outsourcing", "Marketing / creative / agency", "Launch"),
  row("outsourcing-it", "outsourcing", "IT / SaaS / professional services", "Foundation"),
];

export function peopleOfficeExpenseForMonth(items: PeopleOfficeLedgerItem[], month: number) {
  return items.reduce((sum, item) => {
    const recurring = month >= item.startMonth && month <= item.endMonth
      ? Math.max(0, item.quantity) * Math.max(0, item.monthlyUnitCostLakh)
      : 0;
    const oneTime = item.oneTimeCostLakh > 0 && item.oneTimeMonth === month
      ? item.oneTimeCostLakh
      : 0;
    return sum + recurring + oneTime;
  }, 0);
}

export function peopleOfficeExpenseByGroup(items: PeopleOfficeLedgerItem[], group: PeopleOfficeGroup) {
  return Array.from({ length: 36 }, (_, index) => index + 1).reduce(
    (sum, month) => sum + peopleOfficeExpenseForMonth(items.filter((item) => item.group === group), month),
    0,
  );
}

export function peopleOfficeExpenseTotal(items: PeopleOfficeLedgerItem[]) {
  return Array.from({ length: 36 }, (_, index) => index + 1).reduce(
    (sum, month) => sum + peopleOfficeExpenseForMonth(items, month),
    0,
  );
}
