# Crit 7 reflection

## What was the breakthrough that moved the work forward?

Mine wasn't a coding breakthrough so much as a design one. I'd used a system
that already solved this problem well — the University of Minnesota's
Schedule Builder — so instead of designing a scheduling UX from scratch, I
decided early to migrate that already-proven approach and adapt it to ANU's
actual situation: its own catalogue structure (subjects, levels, the CSSA
scrape instead of an official API), and a clash rule that has to account for
classes that only meet in specific teaching weeks, not just day and time.
Committing to "adapt a system that works" rather than "invent something new"
up front — spec and clash rule settled before any app code — is what let the
rest of the build move as fast as it did.

## What did this work change about who I want to be as a software developer?

To me, the most compelling part of being a developer is finding a real pain
point and solving it — and then not stopping there: shipping it so more
people actually use it, and having that surface the next round of problems to
solve. This project reinforced that: the two ANU timetable pains I'd felt
myself — trying tutorial combinations by hand, and not seeing the whole week
until you'd already committed to classes — were the whole reason to build
this, and each feature added since came from watching real friction, not from
a spec written in isolation. That loop — notice a problem, fix it, put it in
front of people, notice what breaks next — is the kind of developer I want to
keep being.
