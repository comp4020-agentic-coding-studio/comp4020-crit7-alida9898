import type { APIRoute } from "astro";
import { selectionExists } from "../../../../lib/catalogue";
import { getPlan, saveSchedule } from "../../../../lib/plans";
import { parseSelection } from "../../../../lib/selection";

// Save the schedule on screen, then back to the same page of results.
export const POST: APIRoute = async ({ params, request, redirect }) => {
  const plan = getPlan(params.id ?? "");
  if (!plan) return new Response("No such plan", { status: 404 });

  const form = await request.formData();
  const selection = parseSelection(String(form.get("selection") ?? ""));
  if (!selection || !selectionExists(selection)) {
    return new Response("Not a schedule from this timetable", { status: 400 });
  }
  saveSchedule(plan.id, selection);
  const n = Number.parseInt(String(form.get("n") ?? ""), 10);
  return redirect(`/plan/${plan.id}${Number.isInteger(n) && n > 0 ? `?n=${n}` : ""}#saved`, 303);
};
