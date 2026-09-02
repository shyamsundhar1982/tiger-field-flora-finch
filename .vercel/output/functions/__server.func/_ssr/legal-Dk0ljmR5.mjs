//#region node_modules/.nitro/vite/services/ssr/assets/legal-Dk0ljmR5.js
var IP_FILINGS = [
	{
		asset: "Frame geometry",
		type: "Provisional patent (IN)",
		when: "M3",
		cost: .8,
		note: "File at CAD lock, amend in FEA. Before any OEM disclosure."
	},
	{
		asset: "Layup / process claims",
		type: "Provisional patent (IN)",
		when: "M3–M4",
		cost: .6,
		note: "Claim-draft carefully — process patents are narrower."
	},
	{
		asset: "Frame + fork industrial design",
		type: "Design (IN)",
		when: "M3",
		cost: .25,
		note: "Fast. Do this even if patent is pending."
	},
	{
		asset: "VéLOXIS word + device",
		type: "TM Class 12, 35, 41",
		when: "M1–M2",
		cost: .35,
		note: "File before any public pitch deck circulation."
	},
	{
		asset: "Vāyú Shastr word",
		type: "TM Class 12, 35",
		when: "M1–M2",
		cost: .2,
		note: "House mark. Separate from product brand."
	},
	{
		asset: "Core / Pro / Apex",
		type: "TM Class 12",
		when: "M6",
		cost: .25,
		note: "After model names are frozen."
	},
	{
		asset: "PCT",
		type: "International",
		when: "After ₹1 Cr revenue",
		cost: 4.5,
		note: "Delay until commercial proof. India-first is enough now."
	}
];
var AGREEMENTS = [
	{
		order: 1,
		name: "Founder IP assignment",
		when: "At incorporation",
		status: "Critical"
	},
	{
		order: 2,
		name: "Co-director IP assignment",
		when: "At incorporation",
		status: "Critical"
	},
	{
		order: 3,
		name: "SHA — reserved matters, veto, drag/tag, anti-dilution",
		when: "Before any external capital",
		status: "Critical"
	},
	{
		order: 4,
		name: "ESOP scheme (10% pool)",
		when: "At incorporation — not at seed",
		status: "Critical"
	},
	{
		order: 5,
		name: "Mutual NDA (OEM / contractor)",
		when: "Before RFQ",
		status: "Critical"
	},
	{
		order: 6,
		name: "OEM manufacturing agreement",
		when: "Before PO",
		status: "Critical"
	},
	{
		order: 7,
		name: "Tooling ownership agreement",
		when: "With tooling PO",
		status: "Critical"
	},
	{
		order: 8,
		name: "Contractor / FEA / designer agreement",
		when: "M2",
		status: "High"
	},
	{
		order: 9,
		name: "Dealer / distributor agreement",
		when: "M11",
		status: "High"
	},
	{
		order: 10,
		name: "Customer terms + warranty + privacy + website",
		when: "M11",
		status: "High"
	}
];
var WARRANTY = {
	frame: "7 years to original owner (not lifetime). Structural defects only.",
	paint: "3 years against peeling / delamination of finish.",
	components: "Pass-through manufacturer warranty.",
	crash: "Optional crash replacement: 30% of then-MRP, within 24 months, one claim.",
	process: "Serial → photo pack → decision in 14 days. Keep a public protocol.",
	insurance: "Product liability bound before first customer delivery. Key-person on founder from M1 quotes."
};
var DILUTION = [
	{
		round: "Incorporation",
		capital: 1,
		pre: 0,
		post: 1,
		investor: 0,
		esop: 10,
		founder: 90,
		note: "ESOP created on day one."
	},
	{
		round: "Non-dilutive (grants / CGSS)",
		capital: 50,
		pre: 0,
		post: 0,
		investor: 0,
		esop: 10,
		founder: 90,
		note: "PRAYAS / TANSEED / CGSS. Ownership unchanged."
	},
	{
		round: "Standby CN (if drawn)",
		capital: 25,
		pre: 500,
		post: 525,
		investor: 4.8,
		esop: 9.5,
		founder: 85.7,
		note: "Cap ₹5 Cr, 20% discount. Converts at next priced round."
	},
	{
		round: "Pre-seed (post-ISO target)",
		capital: 40,
		pre: 500,
		post: 540,
		investor: 7.4,
		esop: 9.3,
		founder: 83.3,
		note: "Do not price at ₹3 Cr if ISO has passed — hold for ₹5 Cr."
	},
	{
		round: "Seed (launch-ready target)",
		capital: 150,
		pre: 1200,
		post: 1350,
		investor: 11.1,
		esop: 8.2,
		founder: 74,
		note: "Target ₹12–15 Cr if launch-ready, not ₹8 Cr."
	},
	{
		round: "Series A (illustrative)",
		capital: 500,
		pre: 2500,
		post: 3e3,
		investor: 16.7,
		esop: 7,
		founder: 62,
		note: "Hold ≥60% through Series A."
	}
];
//#endregion
export { WARRANTY as i, DILUTION as n, IP_FILINGS as r, AGREEMENTS as t };
