# Demo video: shot list and script

Length: **about 2:45** (the limit is not published; stay under 3:00). One continuous screen recording of the live site, https://hollow-twin-poc.vercel.app, with a voice-over. Do not cut during the 3D beat (0:55–1:35).

**Before you record:**
- Use a 1920×1080 browser window, zoom at 100%, dark mode. Close other tabs and turn off notifications.
- Open the site once beforehand, so the films and the 3D view are cached.
- Read the narration aloud once with a timer. At about 140 words per minute, the narration below runs about 2:39 (373 words).

All numbers come from `public/results/scenarios.json` and `impact.json` (test seeds 11–20). Say them exactly as written.

| Time | Shot (what is on screen) | Narration |
| --- | --- | --- |
| **0:00–0:15** Hook | Homepage hero. The film plays: two shafts, the left one going red. | "2087. Two billion people live underground in the Hollow. The power plants are failing, the water recyclers are breaking, and a lung sickness is spreading. The deep levels lose first." |
| **0:15–0:30** Problem | Hold on the headline, 35,323,038 → 861,761. Slowly point the cursor at the left number. | "We ran seven disasters, ten times each. With no help, 35 million people die across those runs. Residents cannot see the plants, only which levels are dark." |
| **0:30–0:55** Tool | Scroll to "01 The app and its impact". Move down the list of 7 apps and their bars. Stop on the phone. | "HollowGuard is a phone app for residents. It has seven apps, for seven of the brief's fifteen problems. Each app reads only what residents have: their outage reports, their own head count and the Directorate's census." |
| **0:55–1:35** Live demo, **the wow beat** | Click "Watch it run". The 3D view opens on "Two plants lost at once". Let it play. At day 5, point at the left shaft going dark. Click a deep section in the right shaft, and the phone moves there. A banner slides down on the phone. | "Same disaster, same seed. Left: no HollowGuard. Right: with it. On day 5, two plants lose output, in the same hour-by-hour shape as two real coal plants in Winter Storm Elliott. On the left the deep levels go dark, and the plants trip again and again. On the right, Blackout Warning saw the dark line move up in residents' reports. It warned those levels and asked everyone to save power. Across ten runs of this disaster, the plants trip 9 times instead of 59. The phone shows what reached this resident today, for example a boil-water notice or a save-power request." |
| **1:35–1:55** Impact | Back to the homepage, "The app and its impact". Point at the bars. | "We measured every app by switching it off and rerunning the same 70 tests. Blackout Warning avoids 33 million deaths. Food Sharing avoids 23 million. Water Safety, 4.2 million. Off-Network Messaging shows zero, because our test runs have no network cut, and we say so." |
| **1:55–2:15** Real data | Scroll to "02 Built on real-world data". Point at the three loss curves, then at the check-first tile. | "The disasters are not made up. Four copy real US plant losses, hour by hour, from EIA-930. Our second model ranks which areas to check first. We tested it once, on real 2023–2024 outages it never saw: top-10 overlap 0.459, against 0.278 for history." |
| **2:15–2:35** How it works | Scroll to "How Blackout Warning works" (the 5 steps and the shaft figure). | "How do residents forecast a blackout without seeing a plant? Power reaches the top levels first, so the deepest lit level tells you the supply. When that line moves up day over day, supply is falling, and the levels between the two lines are next. We tuned on seeds 1 to 5, checked on 6 to 10, and tested once on 11 to 20." |
| **2:35–2:50** Close | Back to the hero. The cursor rests on "Play the 90-second tour". | "HollowGuard: seven problems, one phone, and every number measured. 49 of 70 runs end stable with it, and none without. Try the 90-second tour at hollow-twin-poc.vercel.app." |

## The wow beat (0:55–1:35)
The moment the left shaft goes dark while the right one stays blue, and the phone banner arrives. Record this part in one take. If the 3D view stutters on the recording machine, set Speed to 1 d/s before you start.

## Backup clip
Record the 3D beat once more on its own (40 s), so the editor has a clean take. If the live 3D view fails, use the homepage film for "Two plants lost at once" (`public/films/twoplants.mp4`), which shows the same run.
