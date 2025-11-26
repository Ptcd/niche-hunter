/**
 * Client-safe scoring functions
 * These can be imported in browser/client code without Node.js dependencies
 */

export {
  getCTRFromDifficulty,
  calculateProjectedRevenue,
  calculateROI,
  getRecommendation,
  calculateConfidence,
  type RevenueResult,
  type RevenueInputs,
  type ROIResult,
  type Recommendation,
  type Confidence,
} from './v5000-engine';

