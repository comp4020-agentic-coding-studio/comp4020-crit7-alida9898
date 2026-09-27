import type { APIRoute } from "astro";
import { courseExists } from "../../../../lib/catalogue";
import { addCourse, getPlan, removeCourse } from "../../../../lib/plans";

// Add or remove one course, then back to the page the form was on.
export const POST: APIRoute = async ({ params, request, redirect }) => {
  const plan = getPlan(params.id ?? "");
  if (!plan) return new Response("No such plan", { status: 404 });

  const form = await request.formData();
  const courseId = String(form.get("courseId") ?? "");
  const action = String(form.get("action") ?? "");
  const q = String(form.get("q") ?? "").trim();
  // the search page sends where to come back to; only this plan's own pages
  const back = String(form.get("back") ?? "");
  const home = `/plan/${plan.id}`;

  if (action === "add") {
    if (!courseExists(courseId)) return new Response("Unknown course", { status: 400 });
    addCourse(plan.id, courseId);
  } else if (action === "remove") {
    removeCourse(plan.id, courseId);
  } else {
    return new Response("Unknown action", { status: 400 });
  }
  if (back === home || back.startsWith(`${home}/search`)) return redirect(back, 303);
  return redirect(q ? `${home}?q=${encodeURIComponent(q)}` : home, 303);
};
