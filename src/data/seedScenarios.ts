/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * seedScenarios.ts
 * Pre-seeded maritime fleet strategy scenarios, slider specifications,
 * and deterministic calculation engine for the SAIL Scenario Planning Workspace.
 */

import { ScenarioAssumption, ScenarioCalculationResult, ScenarioSliderSpec } from '../types.js';

export const SEED_SCENARIOS: ScenarioAssumption[] = [
  {
    scenario_id: 'SAIL-BASE-001',
    scenario_name: 'Base Case',
    trade_lane: 'Singapore-Klang-Jakarta',
    region: 'Southeast Asia',
    planning_horizon_years: '3',
    baseline_annual_demand_teu: '120000',
    current_available_capacity_teu_per_year: '132000',
    current_fleet_vessels: '6',
    average_vessel_capacity_teu: '1800',
    average_round_voyage_days: '14',
    operating_days_per_vessel_year: '330',
    target_demand_growth_pct: '5',
    freight_rate_index_pct_of_baseline: '100',
    bunker_price_usd_per_tonne: '600',
    charter_rate_usd_per_vessel_day: '18000',
    charter_availability_index_pct: '70',
    disruption_severity_pct: '10',
    competitor_capacity_change_pct: '3',
    growth_ambition_pct: '8',
    budget_ceiling_usd: '25000000',
    vessel_utilisation_target_pct: '85',
    reefer_share_pct: '12',
    average_speed_knots: '16',
    fuel_consumption_tonnes_per_day: '22',
    annual_fixed_cost_per_vessel_usd: '1200000',
    annual_variable_cost_per_vessel_usd: '950000',
    one_time_charter_setup_cost_usd: '150000',
    vessel_purchase_cost_usd: '28000000',
    annual_revenue_per_teu_usd: '950',
    planning_buffer_capacity_pct: '10',
    assumption_version: '1.0',
    data_status: 'Synthetic'
  },
  {
    scenario_id: 'SAIL-GROW-002',
    scenario_name: 'Grow Ahead of Market',
    trade_lane: 'Singapore-Klang-Jakarta',
    region: 'Southeast Asia',
    planning_horizon_years: '3',
    baseline_annual_demand_teu: '120000',
    current_available_capacity_teu_per_year: '132000',
    current_fleet_vessels: '6',
    average_vessel_capacity_teu: '1800',
    average_round_voyage_days: '14',
    operating_days_per_vessel_year: '330',
    target_demand_growth_pct: '12',
    freight_rate_index_pct_of_baseline: '108',
    bunker_price_usd_per_tonne: '570',
    charter_rate_usd_per_vessel_day: '17500',
    charter_availability_index_pct: '65',
    disruption_severity_pct: '5',
    competitor_capacity_change_pct: '1',
    growth_ambition_pct: '18',
    budget_ceiling_usd: '40000000',
    vessel_utilisation_target_pct: '88',
    reefer_share_pct: '15',
    average_speed_knots: '16',
    fuel_consumption_tonnes_per_day: '22',
    annual_fixed_cost_per_vessel_usd: '1200000',
    annual_variable_cost_per_vessel_usd: '950000',
    one_time_charter_setup_cost_usd: '150000',
    vessel_purchase_cost_usd: '28000000',
    annual_revenue_per_teu_usd: '1025',
    planning_buffer_capacity_pct: '10',
    assumption_version: '1.0',
    data_status: 'Synthetic'
  },
  {
    scenario_id: 'SAIL-DEFEND-003',
    scenario_name: 'Protect Margin in a Soft Market',
    trade_lane: 'Singapore-Klang-Jakarta',
    region: 'Southeast Asia',
    planning_horizon_years: '3',
    baseline_annual_demand_teu: '120000',
    current_available_capacity_teu_per_year: '132000',
    current_fleet_vessels: '6',
    average_vessel_capacity_teu: '1800',
    average_round_voyage_days: '14',
    operating_days_per_vessel_year: '330',
    target_demand_growth_pct: '-2',
    freight_rate_index_pct_of_baseline: '78',
    bunker_price_usd_per_tonne: '650',
    charter_rate_usd_per_vessel_day: '19000',
    charter_availability_index_pct: '85',
    disruption_severity_pct: '8',
    competitor_capacity_change_pct: '15',
    growth_ambition_pct: '0',
    budget_ceiling_usd: '12000000',
    vessel_utilisation_target_pct: '78',
    reefer_share_pct: '10',
    average_speed_knots: '15',
    fuel_consumption_tonnes_per_day: '24',
    annual_fixed_cost_per_vessel_usd: '1200000',
    annual_variable_cost_per_vessel_usd: '1050000',
    one_time_charter_setup_cost_usd: '150000',
    vessel_purchase_cost_usd: '28000000',
    annual_revenue_per_teu_usd: '740',
    planning_buffer_capacity_pct: '8',
    assumption_version: '1.0',
    data_status: 'Synthetic'
  },
  {
    scenario_id: 'SAIL-DISRUPT-004',
    scenario_name: 'Ride Out a Disruption',
    trade_lane: 'Singapore-Klang-Jakarta',
    region: 'Southeast Asia',
    planning_horizon_years: '3',
    baseline_annual_demand_teu: '120000',
    current_available_capacity_teu_per_year: '132000',
    current_fleet_vessels: '6',
    average_vessel_capacity_teu: '1800',
    average_round_voyage_days: '14',
    operating_days_per_vessel_year: '330',
    target_demand_growth_pct: '4',
    freight_rate_index_pct_of_baseline: '96',
    bunker_price_usd_per_tonne: '720',
    charter_rate_usd_per_vessel_day: '22000',
    charter_availability_index_pct: '45',
    disruption_severity_pct: '65',
    competitor_capacity_change_pct: '4',
    growth_ambition_pct: '6',
    budget_ceiling_usd: '22000000',
    vessel_utilisation_target_pct: '82',
    reefer_share_pct: '12',
    average_speed_knots: '15',
    fuel_consumption_tonnes_per_day: '25',
    annual_fixed_cost_per_vessel_usd: '1200000',
    annual_variable_cost_per_vessel_usd: '1150000',
    one_time_charter_setup_cost_usd: '200000',
    vessel_purchase_cost_usd: '28000000',
    annual_revenue_per_teu_usd: '910',
    planning_buffer_capacity_pct: '15',
    assumption_version: '1.0',
    data_status: 'Synthetic'
  },
  {
    scenario_id: 'SAIL-LOW-005',
    scenario_name: 'Constrained Budget / Watch',
    trade_lane: 'Singapore-Klang-Jakarta',
    region: 'Southeast Asia',
    planning_horizon_years: '3',
    baseline_annual_demand_teu: '120000',
    current_available_capacity_teu_per_year: '132000',
    current_fleet_vessels: '6',
    average_vessel_capacity_teu: '1800',
    average_round_voyage_days: '14',
    operating_days_per_vessel_year: '330',
    target_demand_growth_pct: '3',
    freight_rate_index_pct_of_baseline: '92',
    bunker_price_usd_per_tonne: '620',
    charter_rate_usd_per_vessel_day: '18500',
    charter_availability_index_pct: '75',
    disruption_severity_pct: '12',
    competitor_capacity_change_pct: '6',
    growth_ambition_pct: '5',
    budget_ceiling_usd: '5000000',
    vessel_utilisation_target_pct: '80',
    reefer_share_pct: '11',
    average_speed_knots: '15',
    fuel_consumption_tonnes_per_day: '23',
    annual_fixed_cost_per_vessel_usd: '1200000',
    annual_variable_cost_per_vessel_usd: '1000000',
    one_time_charter_setup_cost_usd: '150000',
    vessel_purchase_cost_usd: '28000000',
    annual_revenue_per_teu_usd: '870',
    planning_buffer_capacity_pct: '10',
    assumption_version: '1.0',
    data_status: 'Synthetic'
  }
];

export const SLIDER_SPECS: ScenarioSliderSpec[] = [
  { key: 'target_demand_growth_pct', label: 'Demand growth', min: -10, max: 25, step: 1, suffix: '%' },
  { key: 'freight_rate_index_pct_of_baseline', label: 'Freight rate level', min: 50, max: 150, step: 1, suffix: '% of base' },
  { key: 'bunker_price_usd_per_tonne', label: 'Fuel / bunker price', min: 300, max: 1000, step: 10, prefix: '$' },
  { key: 'charter_rate_usd_per_vessel_day', label: 'Charter rate', min: 10000, max: 30000, step: 500, prefix: '$ / day' },
  { key: 'disruption_severity_pct', label: 'Disruption severity', min: 0, max: 100, step: 1, suffix: '%' },
  { key: 'competitor_capacity_change_pct', label: 'Competitor capacity', min: -20, max: 30, step: 1, suffix: '%' },
  { key: 'growth_ambition_pct', label: 'Growth ambition', min: 0, max: 30, step: 1, suffix: '%' },
  { key: 'budget_ceiling_usd', label: 'Budget ceiling', min: 2000000, max: 50000000, step: 1000000, prefix: '$', format: 'm' }
];

export const num = (v: string | number | undefined | null): number => Number(v) || 0;
export const formatNumber = (v: number): string => Math.round(v).toLocaleString('en-US');
export const formatMoney = (v: number): string => `$${(v / 1e6).toFixed(1)}m`;

/**
 * Executes transparent scenario planning math exactly as defined in the SAIL specification.
 */
export function calculateScenario(d: ScenarioAssumption): ScenarioCalculationResult {
  const horizon = num(d.planning_horizon_years) || 3;
  const growth = num(d.target_demand_growth_pct) / 100;
  const ambition = num(d.growth_ambition_pct) / 100;
  const demand0 = num(d.baseline_annual_demand_teu);
  const projected = demand0 * Math.pow(1 + growth, horizon);
  const demand = projected * (1 + Math.max(0, ambition - growth) * 0.25);
  const disruption = num(d.disruption_severity_pct) / 100;
  const competitor = num(d.competitor_capacity_change_pct) / 100;
  const utilisation = Math.max(0.55, Math.min(0.95, num(d.vessel_utilisation_target_pct) / 100));
  const buffer = num(d.planning_buffer_capacity_pct) / 100;
  const effectiveDemand = demand * (1 + disruption * 0.12 + Math.max(0, competitor) * 0.04);
  const required = (effectiveDemand * (1 + buffer)) / utilisation;
  const currentCapacity = num(d.current_available_capacity_teu_per_year);
  const baseVessels = Math.max(1, num(d.current_fleet_vessels));
  const baseProductivity = currentCapacity / baseVessels;
  const effectiveVoyageDays = num(d.average_round_voyage_days) * (1 + disruption * 0.35);
  const productivity = baseProductivity / (1 + disruption * 0.35);
  const vessels = Math.ceil(required / Math.max(1, productivity));
  const gap = required - currentCapacity;
  const newVessels = Math.max(0, vessels - baseVessels);
  const charterAvailability = num(d.charter_availability_index_pct) / 100;
  const charterVessels = Math.min(newVessels, Math.ceil(newVessels * charterAvailability));
  const ownedVessels = Math.max(0, newVessels - charterVessels);
  const fuelCost =
    num(d.bunker_price_usd_per_tonne) *
    num(d.fuel_consumption_tonnes_per_day) *
    num(d.operating_days_per_vessel_year) *
    vessels;
  const annualCost =
    vessels * (num(d.annual_fixed_cost_per_vessel_usd) + num(d.annual_variable_cost_per_vessel_usd)) +
    charterVessels * num(d.charter_rate_usd_per_vessel_day) * num(d.operating_days_per_vessel_year) +
    fuelCost;
  const revenue = effectiveDemand * num(d.annual_revenue_per_teu_usd) * (num(d.freight_rate_index_pct_of_baseline) / 100);
  const contribution = revenue - annualCost;
  const breakEvenRateIndex =
    effectiveDemand > 0 ? (annualCost / (effectiveDemand * num(d.annual_revenue_per_teu_usd))) * 100 : 0;
  const capex = ownedVessels * num(d.vessel_purchase_cost_usd) + charterVessels * num(d.one_time_charter_setup_cost_usd);

  let posture: 'GROW' | 'DEFEND' | 'WATCH' | 'HOLD' = 'HOLD';
  let desc = 'Maintain current deployment while monitoring demand and capacity signals.';

  const freightIndex = num(d.freight_rate_index_pct_of_baseline);
  if (freightIndex < 90 && competitor > 0.08) {
    posture = 'DEFEND';
    desc = 'Protect margin, prioritise flexible charters and redeployment, and avoid premature long-term commitments.';
  } else if (growth > 0.08 && freightIndex >= 100) {
    posture = 'GROW';
    desc = 'Prepare capacity ahead of demand; consider locking suitable capacity where the business case is supported.';
  } else if (disruption > 0.4) {
    posture = 'WATCH';
    desc = 'Preserve operational buffers, monitor voyage delays and retain flexibility before making irreversible commitments.';
  } else if (gap > 0) {
    posture = 'GROW';
    desc = 'Close the projected capacity gap in stages, subject to budget and vessel availability.';
  } else if (gap < -currentCapacity * 0.12) {
    posture = 'DEFEND';
    desc = 'Avoid adding capacity; review redeployment and utilisation to protect returns.';
  }

  const budget = num(d.budget_ceiling_usd);
  const affordable = capex <= budget;
  const locked =
    affordable && growth > 0.08 && freightIndex >= 100 ? Math.min(charterVessels, Math.ceil(newVessels * 0.5)) : 0;
  const flexible = Math.max(0, newVessels - locked);
  const watch = Math.max(0, Math.ceil(vessels * 0.15));

  return {
    horizon,
    projected,
    demand,
    required,
    vessels,
    productivity,
    effectiveVoyageDays,
    gap,
    newVessels,
    charterVessels,
    ownedVessels,
    annualCost,
    revenue,
    contribution,
    breakEvenRateIndex,
    capex,
    posture,
    desc,
    locked,
    flexible,
    watch,
    affordable,
    utilisation,
    buffer,
    fuelCost
  };
}

/**
 * Parses user-provided CSV into ScenarioAssumption array.
 */
export function parseScenarioCSV(text: string): ScenarioAssumption[] {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const results: ScenarioAssumption[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = vals[idx] ?? '';
    });
    if (obj.scenario_id || obj.scenario_name) {
      results.push(obj as unknown as ScenarioAssumption);
    }
  }
  return results;
}

/**
 * Generates an executive strategy brief text file for export.
 */
export function generateStrategyBrief(scenario: ScenarioAssumption, calc: ScenarioCalculationResult): string {
  const gapText =
    calc.gap > 0
      ? `shortfall of ${formatNumber(calc.gap)} TEU/year`
      : `surplus of ${formatNumber(Math.abs(calc.gap))} TEU/year`;
  const budgetText = calc.affordable
    ? 'Within stated budget ceiling.'
    : 'Exceeds budget ceiling; stage, charter or defer commitments.';

  return `SAIL STRATEGY BRIEF
================================================================================
Scenario: ${scenario.scenario_name} (${scenario.scenario_id})
Trade Lane: ${scenario.trade_lane} · Region: ${scenario.region}
Planning Horizon: ${calc.horizon} Years

STRATEGIC POSTURE & RECOMMENDATION
--------------------------------------------------------------------------------
Posture: ${calc.posture}
Strategic Move: ${calc.desc}

CAPACITY & FLEET REQUIREMENTS
--------------------------------------------------------------------------------
Projected Demand: ${formatNumber(calc.demand)} TEU/year
Current Capacity: ${formatNumber(num(scenario.current_available_capacity_teu_per_year))} TEU/year
Required Capacity: ${formatNumber(calc.required)} TEU/year (${gapText})
Baseline Fleet: ${scenario.current_fleet_vessels} Vessels
Required Vessel Equivalents: ${calc.vessels} Vessels (+${calc.newVessels} Additional)
Locked Charters: ${calc.locked} Vessels
Flexible Charters / Redeployment: ${calc.flexible} Vessels
Watch / Standby Buffer: ${calc.watch} Vessels
Round-Trip Voyage Time: ${calc.effectiveVoyageDays.toFixed(1)} Days (Baseline: ${scenario.average_round_voyage_days} Days)

FINANCIAL & ECONOMIC PROJECTIONS
--------------------------------------------------------------------------------
Indicative Annual Revenue: ${formatMoney(calc.revenue)}
Indicative Annual Fleet Cost: ${formatMoney(calc.annualCost)}
Contribution Before Other Costs: ${formatMoney(calc.contribution)}
One-Time Setup CAPEX: ${formatMoney(calc.capex)}
Budget Ceiling: ${formatMoney(num(scenario.budget_ceiling_usd))}
Budget Status: ${budgetText}
Break-Even Freight Index: ${calc.breakEvenRateIndex.toFixed(1)}% of Baseline (Current Index: ${scenario.freight_rate_index_pct_of_baseline}%)

KEY SENSITIVITIES & REVISIT TRIGGERS
--------------------------------------------------------------------------------
Market Signals:
- Target Demand Growth: ${scenario.target_demand_growth_pct}%
- Freight Rate Level: ${scenario.freight_rate_index_pct_of_baseline}%
- Bunker Price: $${formatNumber(num(scenario.bunker_price_usd_per_tonne))}/tonne
- Charter Rate: $${formatNumber(num(scenario.charter_rate_usd_per_vessel_day))}/day
- Disruption Severity: ${scenario.disruption_severity_pct}%
- Competitor Capacity Change: ${scenario.competitor_capacity_change_pct}%
- Growth Ambition: ${scenario.growth_ambition_pct}%

DISCLAIMER
--------------------------------------------------------------------------------
SAIL prototype scenario planning output. Synthetic planning data for decision-support.
Validate all operational and charter assumptions with Network Planning, Chartering,
and Financial Controllers prior to capital commitment.
`;
}
