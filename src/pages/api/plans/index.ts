import type { APIRoute } from "astro";
import { createPlan, PLAN_COOKIE, planCookieOptions } from "../../../lib/plans";

// Start a plan: new row, remember it in this browser, go to its page.
export const POST: APIRoute = ({ cookies, redirect }) => {
  const plan = createPlan();
  cookies.set(PLAN_COOKIE, plan.id, planCookieOptions);
  return redirect(`/plan/${plan.id}`, 303);
};
