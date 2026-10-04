import { Mastra } from "@mastra/core/mastra";
import { bookPricingAgent } from "./agents/book-pricing-agent";
import {
  analyzeGoogleSheetTool,
  updateSheetStatusTool,
} from "./tools/google-sheets-tool";
import {
  scrapeAmazonOffersTool,
  amazonAddToCartTool,
} from "./tools/amazon-scraper-tool";
import { offerEvaluatorTool } from "./tools/offer-evaluator-tool";

export const mastra = new Mastra({
  agents: {
    bookPricingAgent,
  },
  tools: {
    analyzeGoogleSheetTool,
    updateSheetStatusTool,
    scrapeAmazonOffersTool,
    amazonAddToCartTool,
    offerEvaluatorTool,
  },
});