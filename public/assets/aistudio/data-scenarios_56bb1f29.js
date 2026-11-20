/**
 * SAIL - Scenario & Intelligence for Liners
 * Data & Baseline Scenarios Definition
 * 
 * Defines standard synthetic maritime planning baselines,
 * 4 predefined strategic scenarios with the 8 core planning sliders:
 * 1. Demand growth (marketDemandGrowth)
 * 2. Freight rate level (freightRateLevel)
 * 3. Fuel / bunker price (bunkerPrice)
 * 4. Charter rate (charterRate)
 * 5. Disruption severity (disruptionSeverity)
 * 6. Competitor capacity (competitorCapacityGrowth)
 * 7. Growth ambition (businessAmbitionGrowth)
 * 8. Budget ceiling (budgetCeiling)
 */

const PREDEFINED_SCENARIOS = [
  {
    id: "scenario-a",
    name: "Scenario A: Grow Ahead of the Market",
    badge: "Aggressive Growth",
    category: "predefined",
    situation: {
      demandGrowthDesc: "Demand growth is high (+14.0% p.a.) with strong freight rates (112% of base)",
      ambitionDesc: "Growth ambition is aggressive (+18.0% p.a.) backed by a $65M budget ceiling",
      competitorDesc: "Competitors are slow to add capacity (+2.0% p.a.) with low disruption (10%)",
      marketCondition: "Strong cargo momentum, supportive freight yields, and constrained rival supply."
    },
    strategicMove: {
      summary: "Lock in next year's capacity early, build ahead of expected market demand, and prioritise early vessel acquisition or deployment within the $65M budget ceiling.",
      keyActions: [
        "Commit firmly to low-case capacity using long-term charter / purchase arrangements.",
        "Pre-empt competitor reaction by securing scarce shipyard slots or tier-1 charter tonnage.",
        "Deploy vessels aggressively on primary trade routes to capture high-yield freight demand."
      ]
    },
    inputs: {
      marketDemandGrowth: 14.0,       // 1. Demand growth (% p.a.)
      freightRateLevel: 112,          // 2. Freight rate level (% of base)
      bunkerPrice: 580,               // 3. Fuel / bunker price ($ / tonne)
      charterRate: 18500,             // 4. Charter rate ($ / vessel / day)
      disruptionSeverity: 10,         // 5. Disruption severity (%)
      competitorCapacityGrowth: 2.0,  // 6. Competitor capacity (% p.a.)
      businessAmbitionGrowth: 18.0,   // 7. Growth ambition (% p.a.)
      budgetCeiling: 65000000,        // 8. Budget ceiling ($ USD)
      // Baseline Fleet & Operational Constants
      currentFleetCapacity: 160000,   // TEU annual capacity
      existingFleetUtilisation: 92.0, // % current fleet utilisation
      planningHorizon: 3,             // Years
      targetCapacityBuffer: 10.0,     // % operational safety buffer
      averageVesselProductivity: 32000, // TEU carried per vessel / year (before disruption adjustment)
      annualVesselOpCost: 8500000,    // $ / vessel / year reference base
      selectedVesselClass: "panamax"
    }
  },
  {
    id: "scenario-b",
    name: "Scenario B: Defend Market Position",
    badge: "Defensive Growth",
    category: "predefined",
    situation: {
      demandGrowthDesc: "Demand growth is moderate (+5.0% p.a.) with softened freight rates (94% of base)",
      ambitionDesc: "Growth ambition is active (+8.0% p.a.) under a $40M budget ceiling",
      competitorDesc: "Competitors are adding capacity aggressively (+12.0% p.a.)",
      marketCondition: "Competitive rivalry intensifying; aggressive fleet expansion by rivals threatens market share."
    },
    strategicMove: {
      summary: "Protect existing market share, maintain sufficient committed capacity, and use flexible charters to respond to competitive pressure without breaching budget limits.",
      keyActions: [
        "Defend slot share and port calling frequency on core corridors.",
        "Avoid over-committing long-term capital while competitors inflate fleet supply.",
        "Rely on medium- and short-term flexible charters to match competitor tariff and service pressure."
      ]
    },
    inputs: {
      marketDemandGrowth: 5.0,
      freightRateLevel: 94,
      bunkerPrice: 620,
      charterRate: 19500,
      disruptionSeverity: 15,
      competitorCapacityGrowth: 12.0,
      businessAmbitionGrowth: 8.0,
      budgetCeiling: 40000000,
      currentFleetCapacity: 160000,
      existingFleetUtilisation: 84.0,
      planningHorizon: 3,
      targetCapacityBuffer: 12.0,
      averageVesselProductivity: 32000,
      annualVesselOpCost: 8500000,
      selectedVesselClass: "panamax"
    }
  },
  {
    id: "scenario-c",
    name: "Scenario C: Preserve Flexibility",
    badge: "Flexible Expansion",
    category: "predefined",
    situation: {
      demandGrowthDesc: "Demand growth is uncertain (+2.5% p.a.) amid elevated disruption severity (40%)",
      ambitionDesc: "Growth ambition is measured (+4.0% p.a.) with a $28M budget ceiling",
      competitorDesc: "Competitors are cautious (+3.5% p.a.) while bunker ($690/t) & charter rates ($21k/d) stay firm",
      marketCondition: "Port congestion, route disruptions, and macro volatility require agile tonnage buffers."
    },
    strategicMove: {
      summary: "Avoid excessive long-term commitments, prioritise flexible vessel arrangements to absorb disruption delays, and delay irreversible investment decisions until demand clarifies.",
      keyActions: [
        "Limit locked commitments to rock-bottom baseline volumes within the budget ceiling.",
        "Leverage index-linked and option-laden charter agreements to buffer schedule delays.",
        "Set strict quarterly review trigger gates before exercising Watch Zone capacity options."
      ]
    },
    inputs: {
      marketDemandGrowth: 2.5,
      freightRateLevel: 98,
      bunkerPrice: 690,
      charterRate: 21000,
      disruptionSeverity: 40,
      competitorCapacityGrowth: 3.5,
      businessAmbitionGrowth: 4.0,
      budgetCeiling: 28000000,
      currentFleetCapacity: 160000,
      existingFleetUtilisation: 80.0,
      planningHorizon: 3,
      targetCapacityBuffer: 8.0,
      averageVesselProductivity: 32000,
      annualVesselOpCost: 8500000,
      selectedVesselClass: "panamax"
    }
  },
  {
    id: "scenario-d",
    name: "Scenario D: Protect Cash and Capacity",
    badge: "Capacity Preservation",
    category: "predefined",
    situation: {
      demandGrowthDesc: "Demand growth is negative (-2.0% p.a.) and freight rates are depressed (78% of base)",
      ambitionDesc: "Growth ambition is conservative (0.0% p.a.) under a tight $10M budget ceiling",
      competitorDesc: "Excess market capacity exists (+7.5% p.a. industry overhang) with $650/t bunker fuel",
      marketCondition: "Depressed freight rates, high fuel costs, sluggish trade, and severe tonnage oversupply."
    },
    strategicMove: {
      summary: "Minimise new fleet commitments, optimise existing fleet utilisation, slow-steam to reduce bunker burn, and defer new capacity investment.",
      keyActions: [
        "Freeze discretionary vessel acquisitions and long-term lease renewals.",
        "Rationalize sailing rotations and slow-steam to mitigate $650/t bunker fuel expenses.",
        "Return chartered vessels upon expiration and offload surplus slot allocations."
      ]
    },
    inputs: {
      marketDemandGrowth: -2.0,
      freightRateLevel: 78,
      bunkerPrice: 650,
      charterRate: 16500,
      disruptionSeverity: 20,
      competitorCapacityGrowth: 7.5,
      businessAmbitionGrowth: 0.0,
      budgetCeiling: 10000000,
      currentFleetCapacity: 160000,
      existingFleetUtilisation: 72.0,
      planningHorizon: 3,
      targetCapacityBuffer: 5.0,
      averageVesselProductivity: 32000,
      annualVesselOpCost: 8500000,
      selectedVesselClass: "panamax"
    }
  }
];

// Standard Container Vessel Classes for Fleet Specification
const VESSEL_CLASSES = [
  {
    id: "feedermax",
    name: "Feedermax Container",
    nominalTEU: 2200,
    effectiveTEU: 1980,
    annualProductivityTEU: 22000,
    annualOpCostUSD: 5200000,
    deploymentSuitability: "Intra-Asia, feeder loops, shallow-draft river/island ports",
    speedKnots: 18.0,
    fuelConsumptionTonsDay: 16.0
  },
  {
    id: "panamax",
    name: "Sub-Panamax / Classic Panamax",
    nominalTEU: 4500,
    effectiveTEU: 4050,
    annualProductivityTEU: 32000,
    annualOpCostUSD: 8500000,
    deploymentSuitability: "Regional corridors, North-South trade lanes, Panama Canal transit",
    speedKnots: 19.5,
    fuelConsumptionTonsDay: 26.0
  },
  {
    id: "post-panamax",
    name: "Post-Panamax Wide-Beam",
    nominalTEU: 8500,
    effectiveTEU: 7650,
    annualProductivityTEU: 54000,
    annualOpCostUSD: 13800000,
    deploymentSuitability: "Intermediate trunk lines, Transpacific secondary, Europe-Med loops",
    speedKnots: 21.0,
    fuelConsumptionTonsDay: 42.0
  },
  {
    id: "neo-panamax",
    name: "Neo-Panamax (New Locks)",
    nominalTEU: 14500,
    effectiveTEU: 13200,
    annualProductivityTEU: 88000,
    annualOpCostUSD: 19200000,
    deploymentSuitability: "Mainline Asia-Europe, Transpacific hub-to-hub trunk corridors",
    speedKnots: 21.5,
    fuelConsumptionTonsDay: 60.0
  }
];

if (typeof globalThis !== "undefined") {
  globalThis.PREDEFINED_SCENARIOS = PREDEFINED_SCENARIOS;
  globalThis.VESSEL_CLASSES = VESSEL_CLASSES;
}
if (typeof window !== "undefined") {
  window.PREDEFINED_SCENARIOS = PREDEFINED_SCENARIOS;
  window.VESSEL_CLASSES = VESSEL_CLASSES;
}
