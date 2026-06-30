/**
 * One-time setup: create the "palette Pro" subscription plan + its monthly and
 * annual plan variations in your Square catalog, then print the variation IDs.
 *
 * Run from the functions/ directory with your Square access token in the env:
 *
 *   SQUARE_ACCESS_TOKEN=xxx SQUARE_ENVIRONMENT=sandbox npm run setup:plans
 *
 * Copy the printed SQUARE_PLAN_MONTHLY / SQUARE_PLAN_ANNUAL values into
 * functions/.env, then redeploy the functions.
 *
 * Prices default to $5/mo and $25/yr; override with MONTHLY_CENTS / ANNUAL_CENTS.
 */

import { Client, Environment } from "square";
import { randomUUID } from "node:crypto";

const accessToken = process.env.SQUARE_ACCESS_TOKEN;
if (!accessToken) {
  console.error("✖ SQUARE_ACCESS_TOKEN env var is required.");
  process.exit(1);
}

const environment =
  process.env.SQUARE_ENVIRONMENT === "production" ? Environment.Production : Environment.Sandbox;
const monthlyCents = BigInt(parseInt(process.env.MONTHLY_CENTS ?? "500", 10));
const annualCents = BigInt(parseInt(process.env.ANNUAL_CENTS ?? "2500", 10));

const client = new Client({ accessToken, environment });

async function main() {
  console.log(`Creating subscription plan in Square (${environment})…`);

  const res = await client.catalogApi.batchUpsertCatalogObjects({
    idempotencyKey: randomUUID(),
    batches: [
      {
        objects: [
          {
            type: "SUBSCRIPTION_PLAN",
            id: "#palette-pro-plan",
            subscriptionPlanData: {
              name: "palette Pro",
              subscriptionPlanVariations: [
                {
                  type: "SUBSCRIPTION_PLAN_VARIATION",
                  id: "#monthly",
                  subscriptionPlanVariationData: {
                    name: "Monthly",
                    phases: [
                      {
                        cadence: "MONTHLY",
                        pricing: {
                          type: "STATIC",
                          priceMoney: { amount: monthlyCents, currency: "USD" },
                        },
                      },
                    ],
                  },
                },
                {
                  type: "SUBSCRIPTION_PLAN_VARIATION",
                  id: "#annual",
                  subscriptionPlanVariationData: {
                    name: "Annual",
                    phases: [
                      {
                        cadence: "ANNUAL",
                        pricing: {
                          type: "STATIC",
                          priceMoney: { amount: annualCents, currency: "USD" },
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  });

  const mappings = res.result.idMappings ?? [];
  const idFor = (clientId: string) =>
    mappings.find((m) => m.clientObjectId === clientId)?.objectId ?? "(not found)";

  const monthlyId = idFor("#monthly");
  const annualId = idFor("#annual");

  console.log("\n✔ Plan created. Add these to functions/.env:\n");
  console.log(`SQUARE_PLAN_MONTHLY=${monthlyId}`);
  console.log(`SQUARE_PLAN_ANNUAL=${annualId}\n`);
}

main().catch((err) => {
  const squareErrors = err?.result?.errors ?? err?.errors;
  console.error("✖ Failed to create plan:", squareErrors ?? err?.message ?? err);
  process.exit(1);
});
