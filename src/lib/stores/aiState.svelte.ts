import type { ChartType } from '$lib/config/design';

export interface AngleData {
  id: string;
  headline: string;
  summary: string;
  suggestedChartType: ChartType;
  compatibleChartTypes: ChartType[];
  reasoning: string;
  sources: string[];
  keyFinding: string;
  explain: string;
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      borderColor?: string;
      backgroundColor?: string;
    }>;
  };
}

export interface ApiResponse {
  query: string;
  sourceType: string;
  sourceData: {
    text: string;
    citations: string[];
  };
  angles: AngleData[];
}

interface AiState {
  step: 'input' | 'loading' | 'results' | 'error';
  audience: string;
  query: string;
  sourceType: 'pdf' | 'url' | 'csv';
  sourceFile: File | null;
  sourceUrl: string;
  extractedText: string;
  fileUri?: string;
  apiResponse: ApiResponse | null;
  angleChartTypes: Record<string, ChartType>;
  error: { message: string; code?: string; retryable: boolean } | null;
  timestamp: number | null;
  sources: string[];
}

function createAiState() {
  let state = $state<AiState>({
    step: 'input',
    audience: '',
    query: '',
    sourceType: 'pdf',
    sourceFile: null,
    sourceUrl: '',
    extractedText: '',
    apiResponse: null,
    angleChartTypes: {},
    error: null,
    timestamp: null,
    sources: []
  });

  return {
    get value() { return state; },
    set value(v: AiState) { state = v; },
    reset() {
      state = {
        step: 'input',
        audience: '',
        query: '',
        sourceType: 'pdf',
        sourceFile: null,
        sourceUrl: '',
        extractedText: '',
        apiResponse: null,
        angleChartTypes: {},
        error: null,
        timestamp: null,
        sources: []
      };
    },
    setStep(step: AiState['step']) { state.step = step; },
    setError(message: string, retryable = true) {
      state.step = 'error';
      state.error = { message, retryable };
    },
    setResponse(response: ApiResponse) {
      state.apiResponse = response;
      state.angleChartTypes = {};
      response.angles.forEach(a => {
        state.angleChartTypes[a.id] = a.suggestedChartType;
      });
      state.step = 'results';
      state.timestamp = Date.now();
    },
    setAngleChartType(angleId: string, chartType: ChartType) {
      state.angleChartTypes[angleId] = chartType;
    }
  };
}

export const aiState = createAiState();
