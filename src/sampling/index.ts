/**
 * MCP Sampling integration for review insights.
 *
 * This module provides server-side AI analysis of reviews using MCP Sampling.
 * It enables tools to request AI completion from the connected client,
 * allowing for sophisticated analysis without sending raw data to the context.
 */

// Prompts
export { getAnalysisPrompt, ANALYSIS_SYSTEM_PROMPT } from './prompts';

// Request building
export {
  buildSamplingRequest,
  buildMergeRequest,
  SamplingRequest,
  SamplingRequestOptions,
  PeriodContext
} from './request-builder';

// Response parsing
export {
  parseSamplingResponse,
  normalizeResponseData,
  SamplingParseError,
  SamplingResponse
} from './response-parser';

// Batch processing
export {
  processInBatches,
  DEFAULT_BATCH_SIZE,
  MAX_BATCHES,
  SamplingFunction,
  BatchProcessingResult
} from './batching';
