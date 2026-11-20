/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
export type ThinkingLevel = 'Low' | 'Medium' | 'High';
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  status?: 'planning' | 'retrieving' | 'synthesizing' | 'complete' | 'error';
  statusMessage?: string;
  searchTopics?: string[];
  retrievals?: {
    News_Collection: string[];
    AIS_Collection: string[];
    Seaport_Collection: string[];
    Filling_Collection: string[];
  };
  traceId?: string;
  confidenceScore?: string | number;
  durationMs?: number;
}

export interface RSSEntry {
  title: string;
  link: string;
  pubDate?: string;
  summary?: string;
  sourceFeed: string;
}

export interface RSSFeedResult {
  url: string;
  title: string;
  entries: RSSEntry[];
  error?: string;
}

export interface MLflowSpan {
  spanId: string;
  name: string;
  spanType: 'CHAIN' | 'RETRIEVER' | 'LLM' | 'AGENT' | 'EMBEDDING';
  startTimeMs: number;
  endTimeMs?: number;
  durationMs?: number;
  status: 'OK' | 'ERROR' | 'RUNNING';
  attributes?: Record<string, unknown>;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
}

export interface MLflowTrace {
  traceId: string;
  sessionId: string;
  timestamp: string;
  experimentName: string;
  rootSpanName: string;
  status: 'SUCCESS' | 'ERROR' | 'IN_PROGRESS';
  spans: MLflowSpan[];
  inputs: {
    user_prompt: string;
    search_topics?: string[];
    zilliz_retrievals?: {
      News_Collection: string[];
      AIS_Collection: string[];
      Seaport_Collection: string[];
      Filling_Collection: string[];
    };
    llm_input_prompt?: string;
  };
  outputs: {
    llm_response?: string;
    confidence_score?: string | number;
  };
  metrics: {
    totalDurationMs: number;
    retrievalDurationMs: number;
    llmDurationMs: number;
    retrievedDocsCount: number;
  };
  databricksSync: {
    synced: boolean;
    host?: string;
    statusText: string;
    timestamp?: string;
    spansDump?: Array<Record<string, unknown>>;
  };
}

export interface SystemStatus {
  online: boolean;
  version: string;
  gemini: {
    model: string;
    configured: boolean;
  };
  embedding?: {
    model: string;
    apiVersion: string;
    dimensions: number;
  };
  zilliz: {
    isConfigured: boolean;
    uri: string;
    mode: 'zilliz_cloud' | 'local_high_speed_cache';
    collections: string[];
    entityCounts: Record<string, number>;
    lastLatencyMs: number;
  };
  mlflow: {
    isConfigured: boolean;
    trackingUri: string;
    experimentName: string;
    databricksHost: string;
    totalRecordedTraces: number;
    activeSpansCount: number;
  };
}

export interface DiagnosticResult {
  phase1Llm: { success: boolean; durationMs: number; details: string };
  phase2Embeddings: { success: boolean; durationMs: number; dimensions?: number; details: string };
  phase3Zilliz: { success: boolean; durationMs: number; details: string; collections: string[]; loadedState: string };
  overallSuccess: boolean;
}

export interface AISVessel {
  MMSI: string;
  BaseDateTime?: string;
  LAT?: string | number;
  LON?: string | number;
  SOG?: string | number;
  COG?: string | number;
  Heading?: string | number;
  VesselName: string;
  IMO?: string;
  CallSign?: string;
  VesselType?: string;
  Status?: string;
  Length?: string | number;
  Width?: string | number;
  Draft?: string | number;
  Cargo?: string;
  dest_cluster?: string;
  dest_lat?: string | number;
  dest_lon?: string | number;
  dist_km?: string | number;
  SOG_kmh?: string | number;
  ETA_hours?: string | number;
  Speed_Category: string;
}

export interface ShippingLane {
  id: string;
  name: string;
  code: string;
  region: string;
  type: 'Trunk Lane' | 'Strait Chokepoint' | 'Feeder Corridor' | 'Archipelagic Route';
  primaryPorts: string[];
  transitDistanceNm: number;
  avgTransitDays: number;
  congestionStatus: 'Normal' | 'Moderate' | 'Heavy Congestion';
  draftLimitMeters: number;
  dominantVessels: string;
  dailyDensity: number;
  description: string;
  keyHazards: string;
  currentRatesEstimate: string;
  activeFeederLoops: string[];
}

export interface SavedChatSummary {
  id: string;
  numericId?: number;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  preview: string;
  userQueries?: string[];
}

export interface SavedChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

export type ShortcutIconName = 'TrendingUp' | 'Ship' | 'Anchor' | 'Layers' | 'Compass' | 'Database' | 'Sparkles';

export interface ShortcutPrompt {
  id: string;
  numericId?: number;
  title: string;
  desc: string;
  query: string;
  icon?: ShortcutIconName;
  createdAt: number;
  updatedAt: number;
}

export interface ShortcutSyncStatus {
  zillizAvailable: boolean;
  storageMode?: 'QuickPrompt' | 'ChatHistoryFallback' | 'local';
  collectionName?: string;
  lastError: string | null;
  detectedZillizKeys?: string[];
}

export interface ZillizHttpTrace {
  id: string;
  timestamp: string;
  timestampMs: number;
  operation: 'list_collections' | 'create_collection' | 'upsert_chat' | 'query_chats' | 'delete_chat' | 'upsert_shortcut' | 'query_shortcuts' | 'delete_shortcut' | 'diagnostic_roundtrip' | 'vector_search';
  method: string;
  url: string;
  endpoint: string;
  requestPayload?: Record<string, unknown> | null;
  responseStatus: number;
  statusText?: string;
  durationMs: number;
  responseBody?: Record<string, unknown> | null;
  error?: string | null;
  success: boolean;
  notes?: string;
}

export interface ZillizDiagnosticStep {
  name: string;
  success: boolean;
  durationMs: number;
  details: string;
  payloadSent?: Record<string, unknown>;
  responseReceived?: Record<string, unknown>;
}

export interface ZillizDiagnosticResult {
  timestamp: string;
  configured: boolean;
  overallSuccess: boolean;
  zillizUri: string;
  steps: ZillizDiagnosticStep[];
  error?: string;
}

export interface ScenarioAssumption {
  scenario_id: string;
  scenario_name: string;
  trade_lane: string;
  region: string;
  planning_horizon_years: string | number;
  baseline_annual_demand_teu: string | number;
  current_available_capacity_teu_per_year: string | number;
  current_fleet_vessels: string | number;
  average_vessel_capacity_teu: string | number;
  average_round_voyage_days: string | number;
  operating_days_per_vessel_year: string | number;
  target_demand_growth_pct: string | number;
  freight_rate_index_pct_of_baseline: string | number;
  bunker_price_usd_per_tonne: string | number;
  charter_rate_usd_per_vessel_day: string | number;
  charter_availability_index_pct: string | number;
  disruption_severity_pct: string | number;
  competitor_capacity_change_pct: string | number;
  growth_ambition_pct: string | number;
  budget_ceiling_usd: string | number;
  vessel_utilisation_target_pct: string | number;
  reefer_share_pct: string | number;
  average_speed_knots: string | number;
  fuel_consumption_tonnes_per_day: string | number;
  annual_fixed_cost_per_vessel_usd: string | number;
  annual_variable_cost_per_vessel_usd: string | number;
  one_time_charter_setup_cost_usd: string | number;
  vessel_purchase_cost_usd: string | number;
  annual_revenue_per_teu_usd: string | number;
  planning_buffer_capacity_pct: string | number;
  assumption_version: string;
  data_status: string;
}

export type ScenarioPosture = 'GROW' | 'DEFEND' | 'WATCH' | 'HOLD';

export interface ScenarioCalculationResult {
  horizon: number;
  projected: number;
  demand: number;
  required: number;
  vessels: number;
  productivity: number;
  effectiveVoyageDays: number;
  gap: number;
  newVessels: number;
  charterVessels: number;
  ownedVessels: number;
  annualCost: number;
  revenue: number;
  contribution: number;
  breakEvenRateIndex: number;
  capex: number;
  posture: ScenarioPosture;
  desc: string;
  locked: number;
  flexible: number;
  watch: number;
  affordable: boolean;
  utilisation: number;
  buffer: number;
  fuelCost: number;
}

export interface ScenarioSliderSpec {
  key: keyof ScenarioAssumption;
  label: string;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
  format?: 'm';
}

