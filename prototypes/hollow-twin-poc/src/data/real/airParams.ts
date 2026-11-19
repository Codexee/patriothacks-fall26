// Cited constants (workstream 4). Each value carries its own source. A constant that is not here keeps its old
// guess in src/sim/engine.ts. Rule: we cite a value only when a primary source gives a number that maps to the sim.
//
// Kept as guesses (no comparable published number was found, checked 2026-11-19):
// - airDeath (0.0001 per 1,000 ppm per hour): no study gives an hourly death share per ppm of CO2. Real CO2 deaths
//   need far higher levels (NIOSH: lowest reported lethal level 90,000 ppm for 5 min). Not invented.
// - preparedSave (0.6): no study gives the share of deaths avoided by a warned, prepared person in bad air.
//   The nearest number is population-level and for heat: France 2006 had about 2,065 excess deaths against about
//   6,452 expected from the pre-2003 model (Fouillet et al. 2008, Int J Epidemiol, PMC2652641), about 68% fewer.
//   It mixes the warning system with other changes after 2003, so we do not use it as a value.
// - volPerPerson (62 m³): the engine value is scaled to give about 300 ppm/h of CO2 rise with the fans off. The
//   MSHA refuge-chamber standard (30 CFR 7.505) requires 30–60 ft³ (0.85–1.7 m³) per person. With that real
//   volume, CO2 rises about 11,000 ppm/h, so it does not fit the sim's open sections without an engine change.
// - followBase / followTrust (0.5 / 0.5): studies find that trust in officials raises compliance (Kim & Oh 2015,
//   J Risk Research 18(1)), but they give no share at zero and at full trust. Self-reported response to
//   California Flex Alerts is about two-thirds of households (CPUC, citing an Opinion Dynamics study we could not
//   open). That is one point, not a base and a slope, so we do not use it.
import type { AirData } from './index.ts';

export const airParams: AirData | null = {
  airDanger: {
    value: 5000,
    source: {
      label: 'OSHA PEL and NIOSH REL for carbon dioxide: 5,000 ppm (8-hour average)',
      detail:
        'The sim starts air harm at the US workplace limit for CO2, 5,000 ppm averaged over 8 hours (OSHA PEL, NIOSH REL). ' +
        'This is a limit for safe work, not a lethal level. NIOSH puts the IDLH at 40,000 ppm and the lowest reported lethal level at 90,000 ppm for 5 min. ' +
        'The sim cannot use those: its CO2 index is capped at 10,000 ppm and its air volume is scaled. So deaths start low and grow slowly above this limit.',
      url: 'https://www.cdc.gov/niosh/npg/npgd0103.html',
    },
  },
};
