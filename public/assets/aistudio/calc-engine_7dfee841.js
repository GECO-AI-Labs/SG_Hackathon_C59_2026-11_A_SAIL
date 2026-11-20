/**
 * SAIL - Scenario & Intelligence for Liners
 * Strategic Calculation Engine & Rule-Based Decision Logic
 * 
 * Implements deterministic, rule-based calculations across the 8 core planning sliders:
 * 1. Demand growth (marketDemandGrowth, % p.a.)
 * 2. Freight rate level (freightRateLevel, % of baseline)
 * 3. Fuel / bunker price (bunkerPrice, $ / tonne)
 * 4. Charter rate (charterRate, $ / vessel / day)
 * 5. Disruption severity (disruptionSeverity, 0-100%)
 * 6. Competitor capacity (competitorCapacityGrowth, % p.a.)
 * 7. Growth ambition (businessAmbitionGrowth, % p.a.)
 * 8. Budget ceiling (budgetCeiling, $ USD)
 */

const SailCalcEngine = {
  formatNumber(val) {
    if (isNaN(val) || val === null || val === undefined) return "0";
    return Math.round(val).toLocaleString("en-US");
  },

  formatDecimal(val, places = 1) {
    if (isNaN(val) || val === null || val === undefined) return "0.0";
    return Number(val).toLocaleString("en-US", {
      minimumFractionDigits: places,
      maximumFractionDigits: places
    });
  },

  formatCurrency(val, compact = false) {
    if (isNaN(val) || val === null || val === undefined) return "$0";
    const sign = val < 0 ? "-" : "";
    const absVal = Math.abs(val);
    if (compact) {
      if (absVal >= 1e9) {
        return `${sign}$${(absVal / 1e9).toFixed(2)}B`;
      }
      if (absVal >= 1e6) {
        return `${sign}$${(absVal / 1e6).toFixed(1)}M`;
      }
      if (absVal >= 1e3) {
        return `${sign}$${(absVal / 1e3).toFixed(0)}K`;
      }
    }
    return `${sign}$${Math.round(absVal).toLocaleString("en-US")}`;
  },

  formatPercent(val, places = 1) {
    if (isNaN(val) || val === null || val === undefined) return "0.0%";
    const sign = val > 0 ? "+" : "";
    return `${sign}${Number(val).toFixed(places)}%`;
  },

  /**
   * Core Calculation Routine
   * Executes the deterministic pipeline from the 8 strategic sliders + vessel class baseline.
   */
  calculateModel(inputs) {
    // -------------------------------------------------------------
    // 1. EXTRACT & SANITIZE THE 8 CORE SLIDERS & BASELINE PARAMETERS
    // -------------------------------------------------------------
    const mktGrowth = Number(inputs.marketDemandGrowth ?? 14.0);             // 1. Demand growth (% p.a.)
    const freightRateLevel = Math.max(30, Number(inputs.freightRateLevel ?? 100)); // 2. Freight rate level (% of base)
    const bunkerPrice = Math.max(100, Number(inputs.bunkerPrice ?? 600));    // 3. Fuel / bunker price ($/tonne)
    const charterRate = Math.max(5000, Number(inputs.charterRate ?? 18000)); // 4. Charter rate ($/day)
    const disruptionSeverity = Math.min(100, Math.max(0, Number(inputs.disruptionSeverity ?? 10))); // 5. Disruption severity (%)
    const compGrowth = Number(inputs.competitorCapacityGrowth ?? 2.0);       // 6. Competitor capacity (% p.a.)
    const ambitionGrowth = Number(inputs.businessAmbitionGrowth ?? 18.0);    // 7. Growth ambition (% p.a.)
    const budgetCeiling = Math.max(1000000, Number(inputs.budgetCeiling ?? 45000000)); // 8. Budget ceiling ($ USD)

    // Baseline operational parameters
    const currentCap = Math.max(1000, Number(inputs.currentFleetCapacity) || 160000); // TEU/yr
    const currentUtil = Math.min(100, Math.max(30, Number(inputs.existingFleetUtilisation) || 92)); // %
    const horizon = Math.min(5, Math.max(1, Math.round(Number(inputs.planningHorizon) || 3))); // Years
    const bufferPct = Math.min(30, Math.max(0, Number(inputs.targetCapacityBuffer) || 10)); // %
    const vesselClassId = inputs.selectedVesselClass || "panamax";

    // Lookup vessel class benchmark
    const vesselSpec = VESSEL_CLASSES.find(v => v.id === vesselClassId) || VESSEL_CLASSES[1];
    const baseVesselProd = Number(vesselSpec.annualProductivityTEU) || 32000;
    const operatingDaysPerYear = 330;

    // -------------------------------------------------------------
    // 2. DEMAND FORECASTING (DEMAND GROWTH + GROWTH AMBITION + DISRUPTION)
    // -------------------------------------------------------------
    const initialDemandTEU = currentCap * (currentUtil / 100);
    const disruptionFactor = disruptionSeverity / 100;
    const compFactor = compGrowth / 100;

    // Market baseline demand compound growth
    const mktRate = mktGrowth / 100;
    const ambRate = ambitionGrowth / 100;
    const projectedMarketDemand = initialDemandTEU * Math.pow(Math.max(0.5, 1 + mktRate), horizon);

    // Effective compound growth blends Market Demand Growth with Growth Ambition:
    // Base Growth Rate = Demand Growth + 0.65 * (Growth Ambition - Demand Growth)
    const baseGrowthRate = mktRate + 0.65 * (ambRate - mktRate);

    // Disruption severity adds schedule absorption demand (+8% at 100% disruption)
    const disruptionDemandMultiplier = 1 + 0.08 * disruptionFactor;
    const baseDemand = initialDemandTEU * Math.pow(Math.max(0.5, 1 + baseGrowthRate), horizon) * disruptionDemandMultiplier;

    // Low Case growth rate: Down-cycle sensitivity & competitive share pressure
    const lowGrowthRate = Math.min(mktRate - 0.035, baseGrowthRate * 0.60) - Math.max(0, compFactor) * 0.15;
    const lowDemand = initialDemandTEU * Math.pow(Math.max(0.45, 1 + lowGrowthRate), horizon);

    // High Case growth rate: Upside surge + disruption buffer spike
    const highGrowthRate = Math.max(mktRate + 0.035, ambRate * 1.15, baseGrowthRate * 1.25) + disruptionFactor * 0.04;
    const highDemand = initialDemandTEU * Math.pow(Math.max(0.55, 1 + highGrowthRate), horizon) * disruptionDemandMultiplier;

    // -------------------------------------------------------------
    // 3. DISRUPTION-ADJUSTED PRODUCTIVITY & REQUIRED CAPACITY
    // -------------------------------------------------------------
    // Port congestion & canal rerouting (Disruption Severity) extend round-trip voyage time by up to +30%,
    // reducing effective annual TEU productivity per vessel:
    // Effective Vessel Productivity = Benchmark Productivity / (1 + 0.30 * Disruption)
    const voyageDelayMultiplier = 1 + 0.30 * disruptionFactor;
    const effectiveVesselProd = Math.round(baseVesselProd / voyageDelayMultiplier);

    const targetUtilRate = 0.88;
    const safetyBufferFactor = 1 + (bufferPct / 100);

    const requiredCapacityBase = (baseDemand * safetyBufferFactor) / targetUtilRate;
    const requiredCapacityLow = (lowDemand * safetyBufferFactor) / targetUtilRate;
    const requiredCapacityHigh = (highDemand * safetyBufferFactor) / targetUtilRate;

    const additionalCapacity = Math.max(0, requiredCapacityBase - currentCap);
    const capacitySurplusShortfall = currentCap - requiredCapacityBase;
    const isShortfall = capacitySurplusShortfall < 0;

    // -------------------------------------------------------------
    // 4. VESSEL EQUIVALENTS & DYNAMIC UNIT VESSEL ECONOMICS
    // -------------------------------------------------------------
    // Current vessels based on nominal class productivity; required vessels based on disruption-adjusted productivity
    const currentVessels = Math.ceil(currentCap / baseVesselProd);
    const totalRequiredVessels = Math.ceil(requiredCapacityBase / effectiveVesselProd);
    const additionalVessels = Math.max(0, totalRequiredVessels - currentVessels);

    const effectiveFutureCapacity = totalRequiredVessels * effectiveVesselProd;
    const projectedFutureUtilisation = effectiveFutureCapacity > 0
      ? Math.min(100, (baseDemand / effectiveFutureCapacity) * 100)
      : 0;

    // Dynamic Annual Vessel OpCost driven by Fuel / Bunker Price ($/t) and Charter Rate ($/day):
    // Baseline reference: Bunker = $600/t, Charter = $18,000/day
    const fuelTonsDay = vesselSpec.fuelConsumptionTonsDay || 26;
    const annualFuelCostPerVessel = bunkerPrice * fuelTonsDay * operatingDaysPerYear;
    const baselineFuelCostPerVessel = 600 * fuelTonsDay * operatingDaysPerYear;

    const annualCharterCostPerVessel = charterRate * operatingDaysPerYear;
    const baselineCharterCostPerVessel = 18000 * operatingDaysPerYear;

    // Blended unit vessel operating cost adjusts class benchmark OpCost by fuel delta + charter delta (60% charter weight)
    const baseOpCost = Math.max(
      2000000,
      vesselSpec.annualOpCostUSD +
        (annualFuelCostPerVessel - baselineFuelCostPerVessel) +
        (annualCharterCostPerVessel - baselineCharterCostPerVessel) * 0.60
    );

    // Revenue, Contribution & Break-Even Freight Index (driven by Freight Rate Level slider)
    const baselineRevenuePerTEU = 950; // $950 / TEU at 100% Freight Rate Index
    const effectiveRevenuePerTEU = baselineRevenuePerTEU * (freightRateLevel / 100);
    const annualRevenueBaseUSD = baseDemand * effectiveRevenuePerTEU;

    // -------------------------------------------------------------
    // 5. THREE-LAYER CAPACITY COMMITMENT & BUDGET CEILING GOVERNANCE
    // -------------------------------------------------------------
    // Raw unconstrained layer TEU requirements:
    const rawLockedTEU = Math.max(0, requiredCapacityLow - currentCap);
    const rawFlexibleTEU = Math.max(0, requiredCapacityBase - Math.max(currentCap, requiredCapacityLow));
    const rawWatchZoneTEU = Math.max(0, requiredCapacityHigh - Math.max(currentCap, requiredCapacityBase));
    const totalIncrementalCapacityTEU = rawLockedTEU + rawFlexibleTEU + rawWatchZoneTEU;

    // Budget ceiling governance:
    // Maximum annual incremental commitment supported by Budget Ceiling ($ USD)
    // High disruption (>45%) or depressed freight rates (<88%) also shift firm Locked capacity into Flexible / Watch Zone
    let lockedRiskFactor = 1.0;
    if (freightRateLevel < 88) lockedRiskFactor *= 0.50;
    if (disruptionSeverity > 45) lockedRiskFactor *= 0.65;
    if (compGrowth > mktGrowth + 6) lockedRiskFactor *= 0.70;

    const maxAffordableIncrTEU = (budgetCeiling / baseOpCost) * effectiveVesselProd;
    const lockedCapacityTEU = Math.min(rawLockedTEU * lockedRiskFactor, maxAffordableIncrTEU);
    const lockedVessels = Math.ceil(lockedCapacityTEU / effectiveVesselProd);

    const remainingBudgetTEU = Math.max(0, maxAffordableIncrTEU - lockedCapacityTEU);
    const desiredBaseIncrTEU = rawLockedTEU + rawFlexibleTEU;
    const uncappedFlexTEU = Math.max(0, desiredBaseIncrTEU - lockedCapacityTEU);
    const flexibleCapacityTEU = Math.min(uncappedFlexTEU, remainingBudgetTEU);
    const flexibleVessels = Math.ceil(flexibleCapacityTEU / effectiveVesselProd);

    // Any base incremental capacity deferred by Budget Ceiling flows into Watch Zone so 100% reconciliation holds
    const budgetDeferredTEU = Math.max(0, uncappedFlexTEU - flexibleCapacityTEU);
    const watchZoneCapacityTEU = rawWatchZoneTEU + budgetDeferredTEU;
    const watchZoneVessels = Math.ceil(watchZoneCapacityTEU / effectiveVesselProd);

    const lockedSharePct = totalIncrementalCapacityTEU > 0 ? (lockedCapacityTEU / totalIncrementalCapacityTEU) * 100 : 0;
    const flexibleSharePct = totalIncrementalCapacityTEU > 0 ? (flexibleCapacityTEU / totalIncrementalCapacityTEU) * 100 : 0;
    const watchZoneSharePct = totalIncrementalCapacityTEU > 0 ? (watchZoneCapacityTEU / totalIncrementalCapacityTEU) * 100 : 0;

    // -------------------------------------------------------------
    // 6. COST, REVENUE & RETURN SENSITIVITY ANALYSIS (LOW, BASE, HIGH BANDS)
    // -------------------------------------------------------------
    const buildCostBand = (multiplier, label) => {
      const unitOpCostUSD = baseOpCost * multiplier;
      const totalFleetCostUSD = totalRequiredVessels * unitOpCostUSD;
      const incrementalFleetCostUSD = additionalVessels * unitOpCostUSD;
      const costPerTEU = baseDemand > 0 ? totalFleetCostUSD / baseDemand : 0;
      const lockedCostUSD = lockedVessels * unitOpCostUSD;
      const flexibleCostUSD = flexibleVessels * (unitOpCostUSD * 1.05);
      const watchZoneHoldingCostUSD = watchZoneVessels * (unitOpCostUSD * 0.05);
      const netContributionUSD = annualRevenueBaseUSD - totalFleetCostUSD;
      const breakEvenFreightIndex = baseDemand > 0
        ? (totalFleetCostUSD / (baseDemand * baselineRevenuePerTEU)) * 100
        : 100;
      const withinBudget = incrementalFleetCostUSD <= budgetCeiling;

      return {
        multiplier,
        label,
        unitOpCostUSD,
        totalFleetCostUSD,
        incrementalFleetCostUSD,
        costPerTEU,
        lockedCostUSD,
        flexibleCostUSD,
        watchZoneHoldingCostUSD,
        annualRevenueUSD: annualRevenueBaseUSD,
        netContributionUSD,
        breakEvenFreightIndex,
        withinBudget
      };
    };

    const costBands = {
      low: buildCostBand(0.90, "Low Case (-10%)"),
      base: buildCostBand(1.00, "Base Case (100%)"),
      high: buildCostBand(1.15, "High Case (+15%)")
    };

    // -------------------------------------------------------------
    // 7. MULTI-SIGNAL RULE-BASED STRATEGIC POSTURE ENGINE
    // -------------------------------------------------------------
    const postureResult = this.evaluateStrategicPosture({
      mktGrowth,
      freightRateLevel,
      bunkerPrice,
      charterRate,
      disruptionSeverity,
      compGrowth,
      ambitionGrowth,
      budgetCeiling,
      incrementalCostUSD: costBands.base.incrementalFleetCostUSD,
      breakEvenFreightIndex: costBands.base.breakEvenFreightIndex,
      capacityGap: additionalCapacity,
      isShortfall
    });

    // -------------------------------------------------------------
    // 8. FLEET INVESTMENT & DEPLOYMENT ROADMAP GENERATION
    // -------------------------------------------------------------
    const roadmapSchedule = this.generateRoadmapSchedule({
      posture: postureResult.posture,
      horizon,
      lockedVessels,
      flexibleVessels,
      watchZoneVessels,
      additionalVessels
    });

    return {
      inputs: {
        marketDemandGrowth: mktGrowth,
        freightRateLevel,
        bunkerPrice,
        charterRate,
        disruptionSeverity,
        competitorCapacityGrowth: compGrowth,
        businessAmbitionGrowth: ambitionGrowth,
        budgetCeiling,
        currentFleetCapacity: currentCap,
        existingFleetUtilisation: currentUtil,
        planningHorizon: horizon,
        targetCapacityBuffer: bufferPct,
        averageVesselProductivity: effectiveVesselProd,
        baseVesselProductivity: baseVesselProd,
        annualVesselOpCost: baseOpCost,
        selectedVesselClass: vesselClassId
      },
      vesselSpec,
      demand: {
        initialDemandTEU,
        projectedMarketDemand,
        baseDemand,
        lowDemand,
        highDemand,
        baseGrowthRate,
        lowGrowthRate,
        highGrowthRate
      },
      capacity: {
        currentCap,
        requiredCapacityBase,
        requiredCapacityLow,
        requiredCapacityHigh,
        additionalCapacity,
        capacitySurplusShortfall,
        isShortfall,
        currentVessels,
        totalRequiredVessels,
        additionalVessels,
        projectedFutureUtilisation,
        effectiveVesselProd,
        voyageDelayPct: Math.round((voyageDelayMultiplier - 1) * 100)
      },
      economics: {
        freightRateLevel,
        bunkerPrice,
        charterRate,
        annualFuelCostPerVessel,
        annualCharterCostPerVessel,
        effectiveRevenuePerTEU,
        annualRevenueBaseUSD,
        netContributionBaseUSD: costBands.base.netContributionUSD,
        breakEvenFreightIndex: costBands.base.breakEvenFreightIndex,
        budgetCeiling,
        withinBudget: costBands.base.withinBudget,
        budgetDeferredTEU
      },
      posture: postureResult,
      commitmentLayers: {
        locked: {
          teu: lockedCapacityTEU,
          vessels: lockedVessels,
          sharePct: lockedSharePct,
          commitmentApproach: "Owned newbuilds / Long-term firm charters (3-5+ years)",
          rationale: budgetDeferredTEU > 0
            ? "Capped within Budget Ceiling & risk gates to guarantee full absorption in a down-cycle."
            : "Represents non-negotiable floor demand required even in a market downturn. Eliminates idle tonnage risk.",
          riskRating: "Low Risk (Volume Guaranteed)",
          badgeColor: "locked"
        },
        flexible: {
          teu: flexibleCapacityTEU,
          vessels: flexibleVessels,
          sharePct: flexibleSharePct,
          commitmentApproach: "Short & medium-term charters (6-18 months), index-linked fixtures, slot swaps",
          rationale: "Covers incremental requirement to meet baseline growth while preserving off-hire agility if demand or freight rates soften.",
          riskRating: "Moderate Risk (Flexible Exposure)",
          badgeColor: "flexible"
        },
        watchZone: {
          teu: watchZoneCapacityTEU,
          vessels: watchZoneVessels,
          sharePct: watchZoneSharePct,
          commitmentApproach: "Standby options, contingent charter slots, broker speed-dial alerts",
          rationale: budgetDeferredTEU > 0
            ? `Captures high-demand upside plus ${this.formatNumber(budgetDeferredTEU)} TEU deferred by Budget Ceiling until trigger gates are met.`
            : "Protects high-demand upside without incurring binding capital expenditure until market triggers trip.",
          riskRating: "Contingent Risk (Call Options Only)",
          badgeColor: "watch"
        },
        totalIncrementalCapacityTEU,
        reconciled: true
      },
      costBands,
      roadmapSchedule
    };
  },

  /**
   * Evaluates Strategic Posture across all 8 sliders using deterministic maritime decision rules
   */
  evaluateStrategicPosture({
    mktGrowth,
    freightRateLevel,
    bunkerPrice,
    charterRate,
    disruptionSeverity,
    compGrowth,
    ambitionGrowth,
    budgetCeiling,
    incrementalCostUSD,
    breakEvenFreightIndex,
    capacityGap,
    isShortfall
  }) {
    let posture = "Flexible Expansion";
    let badgeClass = "badge-flexible";
    let rationale = "";
    let keySignals = [];

    const budgetConstrained = incrementalCostUSD > budgetCeiling;

    // Condition 1: CAPACITY PRESERVATION
    // Triggered by weak/negative demand, depressed freight rates (<82%), or severe cost/budget squeeze
    if (
      mktGrowth < 0.5 ||
      freightRateLevel < 82 ||
      (ambitionGrowth <= 1.0 && compGrowth >= 4.0) ||
      (!isShortfall && capacityGap === 0 && mktGrowth <= 2.5)
    ) {
      posture = "Capacity Preservation";
      badgeClass = "badge-preservation";
      rationale = `Softening cargo demand (${this.formatPercent(mktGrowth)} p.a.) or compressed freight rates (${freightRateLevel}% of base vs ${breakEvenFreightIndex.toFixed(1)}% break-even) make capital & cash preservation paramount. Focus shifts to slow-steaming ($${bunkerPrice}/t bunker), route consolidation, and redelivering expiring charters.`;
      keySignals = [
        `Demand growth (${this.formatPercent(mktGrowth)} p.a.) & freight rate level (${freightRateLevel}% of base) signal margin compression.`,
        `Bunker price ($${bunkerPrice}/t) & charter rate ($${this.formatNumber(charterRate)}/day) set break-even index at ${breakEvenFreightIndex.toFixed(1)}%.`,
        `Budget ceiling (${this.formatCurrency(budgetCeiling, true)}) & +${compGrowth.toFixed(1)}% competitor supply call for strict capacity discipline.`
      ];
    }
    // Condition 2: DEFENSIVE GROWTH
    // Triggered when competitors expand aggressively or freight rates soften against active rivalry
    else if (
      (compGrowth >= 8.0 && ambitionGrowth >= 3.0) ||
      (compGrowth > mktGrowth + 4.0 && ambitionGrowth >= 3.0) ||
      (freightRateLevel < 95 && compGrowth >= 6.0)
    ) {
      posture = "Defensive Growth";
      badgeClass = "badge-defensive";
      rationale = `Competitors are injecting capacity aggressively (${this.formatPercent(compGrowth)} p.a.) while freight rates stand at ${freightRateLevel}% of base. The fleet must defend slot share and service frequency using flexible charters ($${this.formatNumber(charterRate)}/day) without locking into irreversible oversupply.`;
      keySignals = [
        `Competitor capacity growth (${this.formatPercent(compGrowth)} p.a.) threatens core trade lane slot share.`,
        `Growth ambition (${this.formatPercent(ambitionGrowth)} p.a.) & ${disruptionSeverity}% disruption severity require schedule protection.`,
        `Budget ceiling (${this.formatCurrency(budgetCeiling, true)}) prioritizes agile 6–18 month charters over long-term capex.`
      ];
    }
    // Condition 3: AGGRESSIVE GROWTH
    // Triggered when demand & ambition are strong, freight rates are healthy, disruption is manageable, and budget supports expansion
    else if (
      ((mktGrowth >= 8.0 && ambitionGrowth >= 10.0 && compGrowth <= 6.0) ||
        (ambitionGrowth - compGrowth >= 8.0 && mktGrowth >= 5.0)) &&
      freightRateLevel >= 95 &&
      disruptionSeverity <= 45 &&
      !budgetConstrained
    ) {
      posture = "Aggressive Growth";
      badgeClass = "badge-aggressive";
      rationale = `Strong demand growth (${this.formatPercent(mktGrowth)} p.a.), supportive freight rates (${freightRateLevel}% of base), and high growth ambition (${this.formatPercent(ambitionGrowth)} p.a.) against modest competitor additions (${this.formatPercent(compGrowth)} p.a.) create an immediate window to lock capacity ahead of the market within the ${this.formatCurrency(budgetCeiling, true)} budget ceiling.`;
      keySignals = [
        `Demand growth (${this.formatPercent(mktGrowth)} p.a.) & growth ambition (${this.formatPercent(ambitionGrowth)} p.a.) drive robust volume expansion.`,
        `Freight rate level (${freightRateLevel}% of base) exceeds the ${breakEvenFreightIndex.toFixed(1)}% break-even index at $${bunkerPrice}/t bunker.`,
        `Incremental cost (${this.formatCurrency(incrementalCostUSD, true)}) fits within the ${this.formatCurrency(budgetCeiling, true)} budget ceiling.`
      ];
    }
    // Condition 4: FLEXIBLE EXPANSION (High disruption, budget constraint, or moderate/uncertain signals)
    else {
      posture = "Flexible Expansion";
      badgeClass = "badge-flexible";
      const constraintNote = budgetConstrained
        ? `Because incremental base cost (${this.formatCurrency(incrementalCostUSD, true)}) exceeds the ${this.formatCurrency(budgetCeiling, true)} budget ceiling, excess tonnage is staged in the Watch Zone.`
        : `With disruption severity at ${disruptionSeverity}% and charter rates at $${this.formatNumber(charterRate)}/day, modular short-term fixtures preserve downside optionality.`;
      rationale = `Market signals show ${this.formatPercent(mktGrowth)} p.a. demand growth and ${freightRateLevel}% freight rate level. ${constraintNote}`;
      keySignals = [
        `Demand growth (${this.formatPercent(mktGrowth)} p.a.) & ambition (${this.formatPercent(ambitionGrowth)} p.a.) support staged capacity additions.`,
        `Disruption severity (${disruptionSeverity}%) reduces vessel productivity by ${Math.round((1 - 1 / (1 + 0.3 * (disruptionSeverity / 100))) * 100)}%, requiring agile buffer tonnage.`,
        `Budget ceiling (${this.formatCurrency(budgetCeiling, true)}) & charter rate ($${this.formatNumber(charterRate)}/day) favor flexible charters + watch options.`
      ];
    }

    return {
      posture,
      badgeClass,
      rationale,
      keySignals
    };
  },

  /**
   * Generates dynamic Gantt-style investment and deployment roadmap milestones
   */
  generateRoadmapSchedule({ posture, horizon, lockedVessels, flexibleVessels, watchZoneVessels }) {
    const totalQuarters = Math.max(4, horizon * 4);
    let phases = [];

    if (posture === "Aggressive Growth") {
      phases = [
        {
          id: "phase-1",
          name: "Confirm Capacity Requirements & Budget Gate",
          category: "Planning",
          layer: "Planning",
          startQuarter: 1,
          durationQuarters: 2,
          milestoneText: "Board fleet authorization & budget ceiling verification",
          status: "Scheduled"
        },
        {
          id: "phase-2",
          name: "Secure Locked Capacity (Long-Term Fixtures)",
          category: "Locked",
          layer: "Locked Capacity",
          startQuarter: 1,
          durationQuarters: 3,
          milestoneText: `Execute long-term charter / purchase contracts (${lockedVessels} vessels)`,
          status: "High Priority"
        },
        {
          id: "phase-3",
          name: "Negotiate Flexible Vessel Arrangements",
          category: "Flexible",
          layer: "Flexible Capacity",
          startQuarter: 2,
          durationQuarters: 3,
          milestoneText: `Finalise agile charters & slot-swap agreements (${flexibleVessels} vessels)`,
          status: "In Progress"
        },
        {
          id: "phase-4",
          name: "Monitor Watch-Zone Triggers & Freight Index Gates",
          category: "Watch",
          layer: "Watch Zone",
          startQuarter: 3,
          durationQuarters: totalQuarters - 2,
          milestoneText: `Continuous freight & disruption monitoring (${watchZoneVessels} vessels)`,
          status: "Ongoing"
        },
        {
          id: "phase-5",
          name: "Acquire & Charter Vessel Inflow Window",
          category: "Execution",
          layer: "Fleet Inflow",
          startQuarter: 2,
          durationQuarters: 4,
          milestoneText: "Tonnage inspection, handover & sea trials",
          status: "Scheduled"
        },
        {
          id: "phase-6",
          name: "Deploy Additional Capacity on Core Loops",
          category: "Deployment",
          layer: "Deployment",
          startQuarter: 4,
          durationQuarters: totalQuarters - 3,
          milestoneText: "Service rotation induction & berth slot activation",
          status: "Planned"
        },
        {
          id: "phase-7",
          name: "Mid-Horizon Commitment Review & Optimization",
          category: "Governance",
          layer: "Governance",
          startQuarter: Math.min(totalQuarters, 6),
          durationQuarters: 2,
          milestoneText: "Evaluate load factor, bunker burn & competitor reactions",
          status: "Review Gate"
        }
      ];
    } else if (posture === "Defensive Growth") {
      phases = [
        {
          id: "phase-1",
          name: "Confirm Capacity Requirements & Competitor Benchmarking",
          category: "Planning",
          layer: "Planning",
          startQuarter: 1,
          durationQuarters: 2,
          milestoneText: "Slot-cost & freight rate vulnerability audit",
          status: "Scheduled"
        },
        {
          id: "phase-2",
          name: "Secure Essential Locked Capacity",
          category: "Locked",
          layer: "Locked Capacity",
          startQuarter: 2,
          durationQuarters: 2,
          milestoneText: `Protect baseline slot coverage (${lockedVessels} vessels)`,
          status: "Scheduled"
        },
        {
          id: "phase-3",
          name: "Negotiate Fast Flexible Charters & Slot Swaps",
          category: "Flexible",
          layer: "Flexible Capacity",
          startQuarter: 1,
          durationQuarters: 3,
          milestoneText: `Secure 6-12 month adjustable capacity (${flexibleVessels} vessels)`,
          status: "High Priority"
        },
        {
          id: "phase-4",
          name: "Monitor Competitor Slot Dumping & Spot Rates",
          category: "Watch",
          layer: "Watch Zone",
          startQuarter: 2,
          durationQuarters: totalQuarters - 1,
          milestoneText: `Weekly freight index triggers (${watchZoneVessels} standby vessels)`,
          status: "Active"
        },
        {
          id: "phase-5",
          name: "Charter Vessel Inward Staging Window",
          category: "Execution",
          layer: "Fleet Inflow",
          startQuarter: 3,
          durationQuarters: 3,
          milestoneText: "Staggered delivery to match competitor sailing schedules",
          status: "Planned"
        },
        {
          id: "phase-6",
          name: "Targeted Deployment to Defend Market Share",
          category: "Deployment",
          layer: "Deployment",
          startQuarter: 4,
          durationQuarters: totalQuarters - 3,
          milestoneText: "Port call frequency protection & schedule buffering",
          status: "Planned"
        },
        {
          id: "phase-7",
          name: "Quarterly Competitive Defense Audit",
          category: "Governance",
          layer: "Governance",
          startQuarter: Math.min(totalQuarters, 5),
          durationQuarters: 2,
          milestoneText: "Route profitability & capacity right-sizing check",
          status: "Review Gate"
        }
      ];
    } else if (posture === "Capacity Preservation") {
      phases = [
        {
          id: "phase-1",
          name: "Audit Existing Fleet Utilisation & Route Yields",
          category: "Planning",
          layer: "Planning",
          startQuarter: 1,
          durationQuarters: 2,
          milestoneText: "Identify loss-making rotations and under-utilised tonnage",
          status: "High Priority"
        },
        {
          id: "phase-2",
          name: "Freeze Discretionary Locked Commitments",
          category: "Locked",
          layer: "Locked Capacity",
          startQuarter: 1,
          durationQuarters: 4,
          milestoneText: "Impose moratorium on new purchase orders & long-term leases",
          status: "Active"
        },
        {
          id: "phase-3",
          name: "Negotiate Early Redelivery & Charter Off-Hires",
          category: "Flexible",
          layer: "Flexible Capacity",
          startQuarter: 2,
          durationQuarters: 3,
          milestoneText: "Exercising off-hire options on expiring vessels",
          status: "Actionable"
        },
        {
          id: "phase-4",
          name: "Monitor Market Rebound & Scrapping Signals",
          category: "Watch",
          layer: "Watch Zone",
          startQuarter: 1,
          durationQuarters: totalQuarters,
          milestoneText: "Watch for idle fleet reduction & freight rate recovery",
          status: "Active"
        },
        {
          id: "phase-5",
          name: "Fleet Rationalisation & Slow-Steaming Implementation",
          category: "Execution",
          layer: "Fleet Inflow",
          startQuarter: 2,
          durationQuarters: 4,
          milestoneText: "Bunker optimization, voyage consolidation & dry-docking",
          status: "Scheduled"
        },
        {
          id: "phase-6",
          name: "Selective Fleet Redeployment",
          category: "Deployment",
          layer: "Deployment",
          startQuarter: 5,
          durationQuarters: Math.max(2, totalQuarters - 4),
          milestoneText: "Realign remaining vessels to high-margin contracts",
          status: "Contingent"
        },
        {
          id: "phase-7",
          name: "Semi-Annual Liquidity & Fleet Preservation Gate",
          category: "Governance",
          layer: "Governance",
          startQuarter: Math.min(totalQuarters, 4),
          durationQuarters: 2,
          milestoneText: "Cash burn review & budget ceiling compliance",
          status: "Review Gate"
        }
      ];
    } else {
      phases = [
        {
          id: "phase-1",
          name: "Confirm Capacity Requirements & Disruption Buffers",
          category: "Planning",
          layer: "Planning",
          startQuarter: 1,
          durationQuarters: 2,
          milestoneText: "Trade forecast validation & schedule buffer sizing",
          status: "Scheduled"
        },
        {
          id: "phase-2",
          name: "Lock Conservative Baseline Capacity",
          category: "Locked",
          layer: "Locked Capacity",
          startQuarter: 2,
          durationQuarters: 2,
          milestoneText: `Secure low-case floor requirement (${lockedVessels} vessels)`,
          status: "Scheduled"
        },
        {
          id: "phase-3",
          name: "Establish Modular Charter Agreements & Options",
          category: "Flexible",
          layer: "Flexible Capacity",
          startQuarter: 2,
          durationQuarters: 3,
          milestoneText: `Execute flexible short-term fixtures (${flexibleVessels} vessels)`,
          status: "In Progress"
        },
        {
          id: "phase-4",
          name: "Monitor Watch-Zone Call Triggers",
          category: "Watch",
          layer: "Watch Zone",
          startQuarter: 2,
          durationQuarters: totalQuarters - 1,
          milestoneText: `Maintain option pool (${watchZoneVessels} standby vessels)`,
          status: "Active"
        },
        {
          id: "phase-5",
          name: "Staged Vessel Delivery & On-Hire Inspections",
          category: "Execution",
          layer: "Fleet Inflow",
          startQuarter: 3,
          durationQuarters: 3,
          milestoneText: "Staged on-hire window tied to cargo confirmations",
          status: "Planned"
        },
        {
          id: "phase-6",
          name: "Agile Fleet Deployment across Service Network",
          category: "Deployment",
          layer: "Deployment",
          startQuarter: 4,
          durationQuarters: totalQuarters - 3,
          milestoneText: "Flexible loop frequency scaling based on cargo bookings",
          status: "Planned"
        },
        {
          id: "phase-7",
          name: "Mid-Term Strategic Commitment Gate",
          category: "Governance",
          layer: "Governance",
          startQuarter: Math.min(totalQuarters, 6),
          durationQuarters: 2,
          milestoneText: "Assess freight index & disruption before converting charters",
          status: "Review Gate"
        }
      ];
    }

    return {
      totalQuarters,
      horizonYears: horizon,
      phases
    };
  },

  /**
   * Dynamically generates the complete written executive strategy brief incorporating all 8 sliders
   */
  generateStrategyBrief(model, scenarioName = "Current Working Scenario") {
    const { inputs, vesselSpec, demand, capacity, economics, posture, commitmentLayers, costBands, roadmapSchedule } = model;

    const todayDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });

    const isSurplus = !capacity.isShortfall;
    const gapAbsTEU = Math.abs(capacity.capacitySurplusShortfall);
    const budgetStatusText = economics.withinBudget
      ? `Within Stated Budget Ceiling (${this.formatCurrency(costBands.base.incrementalFleetCostUSD, true)} vs ${this.formatCurrency(inputs.budgetCeiling, true)} limit)`
      : `Constrained by Budget Ceiling (${this.formatCurrency(inputs.budgetCeiling, true)} limit; ${this.formatNumber(economics.budgetDeferredTEU)} TEU staged in Watch Zone)`;

    return `# SAIL STRATEGIC FLEET PLANNING BRIEF
**Document ID:** SAIL-STRAT-${Date.now().toString().slice(-6)}
**Scenario Reference:** ${scenarioName}
**Generated Date:** ${todayDate}
**Author:** SAIL Deterministic Fleet Planning Engine
**Status:** Official Strategy Brief (8-Factor Deterministic Model)

---

## 1. Executive Summary & 8-Slider Input Signals
This strategic brief sets out the recommended fleet deployment and capacity commitment strategy across a **${inputs.planningHorizon}-year planning horizon**, calibrated from the 8 core scenario planning parameters:

* **1. Demand Growth:** ${this.formatPercent(inputs.marketDemandGrowth)} p.a.
* **2. Freight Rate Level:** ${inputs.freightRateLevel}% of baseline ($${this.formatNumber(economics.effectiveRevenuePerTEU)}/TEU effective yield)
* **3. Fuel / Bunker Price:** $${this.formatNumber(inputs.bunkerPrice)} / tonne (${vesselSpec.fuelConsumptionTonsDay} t/day vessel burn)
* **4. Charter Rate:** $${this.formatNumber(inputs.charterRate)} / vessel / day
* **5. Disruption Severity:** ${inputs.disruptionSeverity}% (+${capacity.voyageDelayPct}% voyage turnaround impact)
* **6. Competitor Capacity:** ${this.formatPercent(inputs.competitorCapacityGrowth)} p.a.
* **7. Growth Ambition:** ${this.formatPercent(inputs.businessAmbitionGrowth)} p.a.
* **8. Budget Ceiling:** ${this.formatCurrency(inputs.budgetCeiling, true)} (${budgetStatusText})

Over the ${inputs.planningHorizon}-year horizon, base cargo demand is projected to move from **${this.formatNumber(demand.initialDemandTEU)} TEU/year** to **${this.formatNumber(demand.baseDemand)} TEU/year** (including disruption schedule buffer absorption).

${posture.rationale}

---

## 2. Recommended Strategic Posture
* **Strategic Posture:** **${posture.posture.toUpperCase()}**
* **Decision Engine Evaluation:**
${posture.keySignals.map(s => `  - ${s}`).join("\n")}

### Strategic Directive:
${
  posture.posture === "Aggressive Growth"
    ? "Capitalise on favorable market tailwinds and freight rates by securing forward capacity commitments early. Build ahead of the market curve within the stated budget ceiling to capture high-value shipper contracts before competitor tonnage enters service."
    : posture.posture === "Defensive Growth"
    ? "Defend incumbent slot share and trade route frequencies aggressively. Leverage flexible, agile charters to counter competitor capacity expansion without taking on irreversible long-term financial liabilities."
    : posture.posture === "Capacity Preservation"
    ? "Execute strict operational discipline. Freeze discretionary capital expenditure, slow-steam rotations to mitigate bunker fuel costs, optimize current fleet utilisation, and rationalise service loops to preserve cash buffers."
    : "Maintain operational agility. Commit only to guaranteed floor volumes within the budget ceiling while staging incremental and disruption-buffered requirements through short-term charter arrangements and contingent Watch Zone option pools."
}

---

## 3. Capacity Requirements & Disruption-Adjusted Vessel Specifications
To satisfy forecast demand while safeguarding a **${this.formatDecimal(inputs.targetCapacityBuffer)}% operational safety buffer** at an 88% operational target utilisation rate and **${inputs.disruptionSeverity}% disruption severity**:

* **Total Required Fleet Capacity (Base Case):** ${this.formatNumber(capacity.requiredCapacityBase)} TEU/year
* **Current Available Fleet Capacity:** ${this.formatNumber(capacity.currentCap)} TEU/year
* **Net Capacity Position:** ${isSurplus ? `Surplus of +${this.formatNumber(gapAbsTEU)} TEU/year` : `Shortfall of -${this.formatNumber(gapAbsTEU)} TEU/year`}
* **Additional Capacity Required:** ${this.formatNumber(capacity.additionalCapacity)} TEU/year

### Selected Vessel Specification:
* **Vessel Class:** ${vesselSpec.name} (${this.formatNumber(vesselSpec.nominalTEU)} Nominal TEU / ${this.formatNumber(vesselSpec.effectiveTEU)} Effective TEU)
* **Disruption-Adjusted Vessel Productivity:** ${this.formatNumber(capacity.effectiveVesselProd)} TEU/yr (Benchmark: ${this.formatNumber(inputs.baseVesselProductivity)} TEU/yr, adjusted for ${inputs.disruptionSeverity}% disruption severity)
* **Dynamic Unit Vessel OpCost:** ${this.formatCurrency(inputs.annualVesselOpCost)} / vessel / yr (at $${this.formatNumber(inputs.bunkerPrice)}/t bunker & $${this.formatNumber(inputs.charterRate)}/day charter rate)
* **Current Fleet Equivalents:** ${this.formatNumber(capacity.currentVessels)} vessels
* **Total Required Fleet Equivalents:** ${this.formatNumber(capacity.totalRequiredVessels)} vessels (+${this.formatNumber(capacity.additionalVessels)} additional vessels)
* **Operational Suitability:** ${vesselSpec.deploymentSuitability}

---

## 4. Three-Layer Capacity Commitment Strategy (Budget-Reconciled)
To balance commercial ambition against downside demand risk and the **${this.formatCurrency(inputs.budgetCeiling, true)} budget ceiling**, incremental capacity is allocated into three reconciled commitment layers:

| Commitment Layer | Incremental Capacity (TEU) | Vessel Equivalents | Share of Incremental | Recommended Procurement Mechanism | Risk & Strategic Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Locked Capacity** | ${this.formatNumber(commitmentLayers.locked.teu)} TEU | ${commitmentLayers.locked.vessels} vessels | ${this.formatDecimal(commitmentLayers.locked.sharePct)}% | ${commitmentLayers.locked.commitmentApproach} | ${commitmentLayers.locked.rationale} |
| **Flexible Capacity** | ${this.formatNumber(commitmentLayers.flexible.teu)} TEU | ${commitmentLayers.flexible.vessels} vessels | ${this.formatDecimal(commitmentLayers.flexible.sharePct)}% | ${commitmentLayers.flexible.commitmentApproach} | ${commitmentLayers.flexible.rationale} |
| **Watch Zone Capacity** | ${this.formatNumber(commitmentLayers.watchZone.teu)} TEU | ${commitmentLayers.watchZone.vessels} vessels | ${this.formatDecimal(commitmentLayers.watchZone.sharePct)}% | ${commitmentLayers.watchZone.commitmentApproach} | ${commitmentLayers.watchZone.rationale} |

* **Low Case Demand Requirement:** ${this.formatNumber(capacity.requiredCapacityLow)} TEU/year
* **Base Case Demand Requirement:** ${this.formatNumber(capacity.requiredCapacityBase)} TEU/year
* **High Case Upside Requirement:** ${this.formatNumber(capacity.requiredCapacityHigh)} TEU/year (100% reconciled across Current Fleet + Locked + Flexible + Watch Zone)

---

## 5. Investment & Phased Deployment Roadmap
The implementation plan is structured across a **${roadmapSchedule.totalQuarters}-quarter execution timeline**:

${roadmapSchedule.phases.map(p => `* **Q${p.startQuarter}–Q${p.startQuarter + p.durationQuarters - 1}: ${p.name}**
  - Layer: *${p.layer}* | Status: *${p.status}*
  - Key Milestone: ${p.milestoneText}`).join("\n\n")}

---

## 6. Financial Implications, Freight Revenue & Cost Sensitivity Analysis
*Dynamic unit vessel operating cost:* **${this.formatCurrency(inputs.annualVesselOpCost)} / vessel / year** (incorporating **$${this.formatNumber(inputs.bunkerPrice)}/t** fuel price and **$${this.formatNumber(inputs.charterRate)}/day** charter rate).
*Indicative annual freight revenue (at ${inputs.freightRateLevel}% freight rate level):* **${this.formatCurrency(economics.annualRevenueBaseUSD, true)} / year**.

| Metric | Low Cost Band (-10%) | Base Cost Band (100%) | High Cost Band (+15%) |
| :--- | :--- | :--- | :--- |
| **Unit Vessel Operating Cost** | ${this.formatCurrency(costBands.low.unitOpCostUSD)} | ${this.formatCurrency(costBands.base.unitOpCostUSD)} | ${this.formatCurrency(costBands.high.unitOpCostUSD)} |
| **Total Annual Fleet Cost** | ${this.formatCurrency(costBands.low.totalFleetCostUSD, true)} | ${this.formatCurrency(costBands.base.totalFleetCostUSD, true)} | ${this.formatCurrency(costBands.high.totalFleetCostUSD, true)} |
| **Incremental Fleet Cost** | ${this.formatCurrency(costBands.low.incrementalFleetCostUSD, true)} | ${this.formatCurrency(costBands.base.incrementalFleetCostUSD, true)} | ${this.formatCurrency(costBands.high.incrementalFleetCostUSD, true)} |
| **Net Fleet Contribution** | ${this.formatCurrency(costBands.low.netContributionUSD, true)} | ${this.formatCurrency(costBands.base.netContributionUSD, true)} | ${this.formatCurrency(costBands.high.netContributionUSD, true)} |
| **Break-Even Freight Index** | ${this.formatDecimal(costBands.low.breakEvenFreightIndex)}% of base | ${this.formatDecimal(costBands.base.breakEvenFreightIndex)}% of base | ${this.formatDecimal(costBands.high.breakEvenFreightIndex)}% of base |
| **Average Cost per TEU Carried** | ${this.formatCurrency(costBands.low.costPerTEU)} / TEU | ${this.formatCurrency(costBands.base.costPerTEU)} / TEU | ${this.formatCurrency(costBands.high.costPerTEU)} / TEU |

### Commitment Layer Cost Breakdown & Budget Governance (Base Band):
* **Locked Capacity Commitment:** ${this.formatCurrency(costBands.base.lockedCostUSD, true)} / year (Firm fixed commitment)
* **Flexible Capacity Commitment:** ${this.formatCurrency(costBands.base.flexibleCostUSD, true)} / year (Includes +5% charter agility buffer)
* **Watch Zone Holding Cost:** ${this.formatCurrency(costBands.base.watchZoneHoldingCostUSD, true)} / year (5% option reservation fee)
* **Budget Ceiling Compliance:** ${budgetStatusText}

---

## 7. Strategic Risks & Key Monitoring Considerations
1. **Demand & Ambition Divergence:** If actual annual volume growth falls below the low-case threshold (${this.formatDecimal(demand.lowGrowthRate * 100)}% p.a.), immediately exercise redelivery options on flexible charters.
2. **Freight Rate vs Break-Even Spread:** Current freight rate level is **${inputs.freightRateLevel}%** against a base break-even index of **${this.formatDecimal(costBands.base.breakEvenFreightIndex)}%**. If spot freight indices drop within 5 points of break-even, freeze Watch Zone conversions.
3. **Bunker & Charter Escalation:** At **$${this.formatNumber(inputs.bunkerPrice)}/t** bunker and **$${this.formatNumber(inputs.charterRate)}/day** charter rates, a +15% cost spike elevates annual fleet opex to ${this.formatCurrency(costBands.high.totalFleetCostUSD, true)}.
4. **Disruption & Competitor Capacity:** With disruption severity at **${inputs.disruptionSeverity}%** and competitor additions at **${this.formatPercent(inputs.competitorCapacityGrowth)} p.a.**, maintain slot-swap agreements to protect weekly sailing frequency without breaching the **${this.formatCurrency(inputs.budgetCeiling, true)}** budget ceiling.

*Disclaimer: This strategic planning brief is generated using synthetic baseline demonstration data and deterministic planning rules. Prior to commercial commitment, figures must be verified against audited financial models and verified charter market quotes.*
`;
  }
};

if (typeof globalThis !== "undefined") {
  globalThis.SailCalcEngine = SailCalcEngine;
}
if (typeof window !== "undefined") {
  window.SailCalcEngine = SailCalcEngine;
}
