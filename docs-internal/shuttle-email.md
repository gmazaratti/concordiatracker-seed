# Email draft — shuttle@concordia.ca

Send from **concordiatracker@gmail.com**. Keep it short; the person reading this
runs a bus service, not a data programme, and the fastest way to a no is a wall
of text about APIs.

Everything in it is already true of the app today, which matters: if they look,
the shuttle widget really does refuse to show times past a timetable's validity
date, and it really does say "scheduled" rather than "arriving".

---

**To:** shuttle@concordia.ca
**Cc:** *(leave empty for now — see the note on Transportation Services below)*
**Subject:** Shuttle schedule data — request from a student-built Concordia app

---

Hello,

My name is Alex Degryse. I'm a Concordia student and I build ConcordiaTracker
(https://concordiatracker.com), a free academic planner used by students here to
keep track of deadlines, grades and their timetable.

One of the things students ask for most is the SGW–Loyola shuttle, so the app
shows the next few departures alongside their class schedule. Right now I do that
by transcribing the timetable you publish as a PDF. That works, but it means my
copy silently goes out of date the moment you change something — and a student who
misses a bus because of a schedule I typed out is a problem I'd rather not create.

Three questions, in order of usefulness to us:

1. **Is there a schedule feed we can consume?** Anything machine-readable — GTFS,
   CSV, JSON, even a spreadsheet — would let us stay accurate automatically instead
   of by hand.

2. **Is there any sanctioned way to access live departure or vehicle data?** I found
   the bus map at shuttle.concordia.ca, but the service behind it isn't reachable
   from outside and I haven't tried to work around that — I'd rather ask than scrape
   something that wasn't meant to be public.

3. **If neither exists, could we be told when the timetable changes?** Even an email
   to a list when a new schedule is published would solve most of the problem.

How we'd handle it on our side:

- We cache aggressively and would poll no more than you're comfortable with — we
  have no interest in putting load on your systems.
- We'd credit Concordia Transportation as the source and link to your page.
- We already carry your own wording: departures are shown as **scheduled**, not
  guaranteed, with the note that buses leave once they reach capacity. We'd keep
  any disclaimer you'd like us to display.
- Every schedule we hold has an explicit expiry date, and past it the app refuses
  to show times and tells the student to check the official timetable rather than
  guessing.

For clarity: ConcordiaTracker is an independent student project and is not
affiliated with or endorsed by the University, and we say so on the site. I'm not
asking for an endorsement — just for a more reliable way to show students something
you already publish.

Happy to meet, or to work with whoever owns this if it sits with another team.

Thank you for your time,

Alex Degryse
ConcordiaTracker
concordiatracker@gmail.com
https://concordiatracker.com

---

## Notes before sending

- **Send it from the project address, not a personal one.** It reads as a project
  rather than a one-off request, and it puts the reply somewhere you'll find it.
- **Don't attach anything and don't ask for a meeting in the first line.** One
  screenshot of the shuttle widget is worth adding only if they reply asking what
  it looks like.
- **If shuttle@concordia.ca bounces or goes quiet for two weeks**, the next stop is
  Transportation Services through the main switchboard, and after that
  `webmaster@concordia.ca`, who can usually say which team owns a given service.
- **If they say no to data but yes to notification**, take it. A change email is
  90% of the value — the transcription itself is twenty minutes.
- **If they ask whether you'd take it down**, say yes, immediately and without
  argument. That answer is what keeps the door open for the association work later,
  and the shuttle widget is not worth a relationship.
