import type { APIRoute } from "astro";
import { courseExists } from "../../../../lib/catalogue";
import { addCourse, getPlan, removeCourse } from "../../../../lib/plans";

// Add or remove one course, then back to the plan (keeping the search).
export const POST: APIRoute = async ({ params, request, redirect }) => {
  const plan = getPlan(params.id ?? "");
  if (!plan) return new Response("No such plan", { status: 404 });

  const form = await request.formData();
  const courseId = String(form.get("courseId") ?? "");
  const action = String(form.get("action") ?? "");
  const q = String(form.get("q") ?? "").trim();

  if (action === "add") {
    if (!courseExists(courseId)) return new Response("Unknown course", { status: 400 });
    addCourse(plan.id, courseId);
  } else if (action === "remove") {
    removeCourse(plan.id, courseId);
  } else {
    return new Response("Unknown action", { status: 400 });
  }
  return redirect(q ? `/plan/${plan.id}?q=${encodeURIComponent(q)}` : `/plan/${plan.id}`, 303);
};
