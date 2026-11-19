# The Residents' System: pitch and demo (for judges)

*Draft for the pitch. Written Nov 19, 2026. Note for the team: the locked team spec makes the Earth product the main
demo. Use this text only if the team decides to show the Hollow rebuild.*

## Contents

1. [The problem](#1-the-problem)
2. [Our answer](#2-our-answer)
3. [What a resident sees](#3-what-a-resident-sees)
4. [How it knows](#4-how-it-knows)
5. [Does it work?](#5-does-it-work)
6. [Why you can trust the result](#6-why-you-can-trust-the-result)
7. [What it does not do yet](#7-what-it-does-not-do-yet)
8. [The 2-minute demo](#8-the-2-minute-demo)
9. [Track fit](#9-track-fit)

---

## 1. The problem

The track brief, problem #1: *"Blackouts in the deep levels now last for days, and no one knows when the next one
will hit. How would you warn people before the power or air cuts out?"*

In the Hollow, power is life. Fans move the air. When the power goes, the fans stop, and the air goes bad. The
Directorate gives power to the upper levels first, so the deep levels go dark first. And the Directorate's numbers
do not match what people see.

## 2. Our answer

**The Residents' System**: an app that the people of the Hollow run for themselves. It does not need the
Directorate's data, and it does not trust it.

Its first module, **Blackout Warning**, does three things:

1. It **tells each level when its next blackout will start**, and for how long.
2. It **asks everyone to switch off part of their non-essential power** when the plants run at their limit. This
   keeps the plants from overloading and tripping, which would black out the whole Hollow.
3. It **shows its evidence.** Every alert has a "Why?" that lists the data behind it.

The system is built from modules, one per problem in the brief. More modules come next.

## 3. What a resident sees

On a resident's phone (for example, a home on level 47):

- **"Next blackout on your level: today from about 15:00, lasting about 6 hours."**
- An alert: **"Blackout coming."** Get ready now: charge lights, store water, and plan where children, the elderly
  and the sick will go for air.
- An alert: **"Save power."** Everyone: switch off 21% of non-essential load today, so the plants do not trip.
- **Why?** For example: "Yesterday at 15:00, only the top 44 levels had power. The blackout line is moving up about
  2 levels a day."

## 4. How it knows

The system uses only what residents really have:

- **Their own outage reports.** Residents tap "power out" and "power back" in the app.
- **Their own head count.** Each home says how many people live there.
- **A fact everyone knows:** the deep levels lose power first.

From these it finds the **blackout line**: how many levels from the top still have power, hour by hour. Because power
goes to the upper levels first, that line shows how much power the plants make. Yesterday's line, and how it moved,
predicts today's.

**The census lie.** The Directorate's census reports 1.65 billion people. The real number is 2 billion: 18% are not
counted, most of them on the crowded deep levels. If the system trusted the census, it would plan for too little
power. Residents' own head count corrects it.

It does **not** use plant meters, weather forecasts or the Directorate's data. Residents do not have them.

## 5. Does it work?

We built a **test world**: a simulated Hollow with 50 levels, 400 neighborhoods, 6 aging geothermal plants and about
1.6 million simulated people. It replays a disaster shaped like the **Texas power crisis of February 2021**: a storm
cuts about 40% of plant output for 4 days while demand rises 30%. The same disaster runs twice: once without the
system, once with it.

| | Without the Residents' System | With Blackout Warning |
| --- | --- | --- |
| Deaths (of 1.6 million) | **637,782** (40%) | **1,260** (less than 0.1%) |
| Outcome | Never stable in 120 days | Stable on day 21 |
| Plant trips | 418 | 6 |
| Blackout time that residents were warned about | 0% | 75% |

Deaths fall by **99.8%**. Other storms and seeds give the same pattern:

| Scenario | Without | With |
| --- | --- | --- |
| Texas 2021, two other seeds | 565,107 and 624,054 deaths | 10,342 and 6,473 deaths, stable by day 22 |
| Chicago heat wave, 1995 | 345,945 deaths | 1,570 deaths, stable on day 18 |
| No storm (steady) | 344,666 deaths | 1,208 deaths, stable on day 21 |

Most of the lives are saved by the **save-power request**: it stops the overloads that black out the whole Hollow.
The **warnings** reduce the deaths in the blackouts that still happen.

## 6. Why you can trust the result

- **The system never sees the hidden truth.** It gets only what residents would have. An automatic check confirms
  this on every run.
- **The same disaster replays exactly.** "With" and "without" are a fair comparison. An automatic check confirms
  this too.
- **You can break the world live.** Trip a plant in the middle of the demo. The system is not told; it must notice
  from residents' reports.
- **We removed every input that residents would not have,** even when it made the results worse. With plant meters
  and a forecast, 1,167 people died. With residents' data only, 1,260 die. We chose the honest version.

## 7. What it does not do yet

- **The first blackout comes without warning.** The system learns from outage reports, and there are none before
  the first blackout.
- **It warns for today only.** Without a forecast, it cannot see a sudden plant failure coming.
- **Some numbers are our assumptions,** for example how many residents follow an alert, and how much a warning
  helps. They are listed in the app's info icons.
- **This is one module of 15.** Heat, water, sickness, food, crowding, the network and the surface come next.

## 8. The 2-minute demo

| Time | On screen | Say |
| --- | --- | --- |
| 0:00 | The Hollow cutaway: the poisoned surface, 50 levels of tunnel neighborhoods | "Two billion people live underground. Power is life: when it goes, the fans stop and the air goes bad." |
| 0:15 | Texas disaster, module off. Next day a few times. The red blackout line climbs; deep levels turn black, then pulse red | "No one knows when the next blackout will hit. The deep levels go first." |
| 0:40 | Reset with Blackout Warning on. A level-47 phone: "Blackout today from about 15:00" | "The Residents' System reads only residents' own reports, and tells each level when its blackout will come." |
| 1:00 | The Save power alert; levels dim instead of going dark | "It asks everyone to save a little power, so the plants never overload." |
| 1:20 | The Modules panel: census 1.32 million against residents' count 1.6 million | "The Directorate's census misses one person in five. Residents count themselves." |
| 1:35 | Compare: 637,782 against 1,260 | "Same storm. Without it, 40% die. With it, less than 0.1%." |
| 1:50 | The 15 problem dots, one filled | "One problem solved. Fourteen to go, module by module." |

## 9. Track fit

- **Problem #1, solved:** warn people before the power or air cuts out.
- **Problem #2, partly:** the save-power request shares the shortage across all levels instead of letting the deep
  levels lose everything.
- **Problems #6 and #9, partly:** residents' own head count shows the crowding the Directorate does not count, and
  checks the Directorate's numbers against reality.
- **Path:** making life underground more sustainable.
