import type { APIRoute } from "astro";
import { selectionExists } from "../../../../lib/catalogue";
import { addCourse, backTo, getPlan, setPref } from "../../../../lib/plans";

const MODES = ["only", "exclude", "clear"] as const;

// Mark one class "only" / "exclude" (adding its course to the plan), or clear
// the mark, then back to the page the form was on.
export const POST: APIRoute = async ({ params, request, redirect }) => {
  const plan = getPlan(params.id ?? "");
  if (!plan) return new Response("No such plan", { status: 404 });

  const form = await request.formData();
  const target = {
    courseId: String(form.get("courseId") ?? ""),
    activity: String(form.get("activity") ?? ""),
    occurrence: String(form.get("occurrence") ?? ""),
  };
  const mode = MODES.find((m) => m === form.get("mode"));
  if (!mode) return new Response("Unknown mode", { status: 400 });
  if (!selectionExists([target])) return new Response("Not a class in this timetable", { status: 400 });

  if (mode !== "clear") addCourse(plan.id, target.courseId);
  setPref(plan.id, target, mode);

  return redirect(backTo(plan.id, String(form.get("back") ?? "")) ?? `/plan/${plan.id}`, 303);
};
