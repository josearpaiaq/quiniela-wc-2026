// Official 2026 FIFA World Cup data, verified 2026-06-11 against Wikipedia
// (per-group pages + knockout stage page). All kickoff times in UTC.
// Sources notation for knockout slots:
//   "A1"/"A2"  -> winner / runner-up of group A
//   "3ABCDF"   -> best third placed in one of groups A,B,C,D,F (FIFA slot constraint)
//   "W73"/"L101" -> winner / loser of match 73 / 101

export type GroupLetter =
  | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L";

export type Phase = "group" | "r32" | "r16" | "qf" | "sf" | "third" | "final";

export interface SeedTeam {
  code: string;
  name: string;
  flag: string;
  group: GroupLetter;
  drawPosition: 1 | 2 | 3 | 4;
}

export interface SeedMatch {
  id: number; // official FIFA match number 1-104
  phase: Phase;
  group?: GroupLetter;
  kickoffAt: string; // ISO UTC
  venue: string;
  home?: string; // team code (group matches only)
  away?: string;
  homeSource?: string; // knockout matches only
  awaySource?: string;
}

const t = (
  code: string,
  name: string,
  flag: string,
  group: GroupLetter,
  drawPosition: 1 | 2 | 3 | 4,
): SeedTeam => ({ code, name, flag, group, drawPosition });

export const TEAMS: SeedTeam[] = [
  // Group A
  t("MEX", "México", "🇲🇽", "A", 1),
  t("RSA", "Sudáfrica", "🇿🇦", "A", 2),
  t("KOR", "Corea del Sur", "🇰🇷", "A", 3),
  t("CZE", "Chequia", "🇨🇿", "A", 4),
  // Group B
  t("CAN", "Canadá", "🇨🇦", "B", 1),
  t("BIH", "Bosnia y Herzegovina", "🇧🇦", "B", 2),
  t("QAT", "Catar", "🇶🇦", "B", 3),
  t("SUI", "Suiza", "🇨🇭", "B", 4),
  // Group C
  t("BRA", "Brasil", "🇧🇷", "C", 1),
  t("MAR", "Marruecos", "🇲🇦", "C", 2),
  t("HAI", "Haití", "🇭🇹", "C", 3),
  t("SCO", "Escocia", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "C", 4),
  // Group D
  t("USA", "Estados Unidos", "🇺🇸", "D", 1),
  t("PAR", "Paraguay", "🇵🇾", "D", 2),
  t("AUS", "Australia", "🇦🇺", "D", 3),
  t("TUR", "Turquía", "🇹🇷", "D", 4),
  // Group E
  t("GER", "Alemania", "🇩🇪", "E", 1),
  t("CUW", "Curazao", "🇨🇼", "E", 2),
  t("CIV", "Costa de Marfil", "🇨🇮", "E", 3),
  t("ECU", "Ecuador", "🇪🇨", "E", 4),
  // Group F
  t("NED", "Países Bajos", "🇳🇱", "F", 1),
  t("JPN", "Japón", "🇯🇵", "F", 2),
  t("SWE", "Suecia", "🇸🇪", "F", 3),
  t("TUN", "Túnez", "🇹🇳", "F", 4),
  // Group G
  t("BEL", "Bélgica", "🇧🇪", "G", 1),
  t("EGY", "Egipto", "🇪🇬", "G", 2),
  t("IRN", "Irán", "🇮🇷", "G", 3),
  t("NZL", "Nueva Zelanda", "🇳🇿", "G", 4),
  // Group H
  t("ESP", "España", "🇪🇸", "H", 1),
  t("CPV", "Cabo Verde", "🇨🇻", "H", 2),
  t("KSA", "Arabia Saudita", "🇸🇦", "H", 3),
  t("URU", "Uruguay", "🇺🇾", "H", 4),
  // Group I
  t("FRA", "Francia", "🇫🇷", "I", 1),
  t("SEN", "Senegal", "🇸🇳", "I", 2),
  t("IRQ", "Irak", "🇮🇶", "I", 3),
  t("NOR", "Noruega", "🇳🇴", "I", 4),
  // Group J
  t("ARG", "Argentina", "🇦🇷", "J", 1),
  t("ALG", "Argelia", "🇩🇿", "J", 2),
  t("AUT", "Austria", "🇦🇹", "J", 3),
  t("JOR", "Jordania", "🇯🇴", "J", 4),
  // Group K
  t("POR", "Portugal", "🇵🇹", "K", 1),
  t("COD", "RD Congo", "🇨🇩", "K", 2),
  t("UZB", "Uzbekistán", "🇺🇿", "K", 3),
  t("COL", "Colombia", "🇨🇴", "K", 4),
  // Group L
  t("ENG", "Inglaterra", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "L", 1),
  t("CRO", "Croacia", "🇭🇷", "L", 2),
  t("GHA", "Ghana", "🇬🇭", "L", 3),
  t("PAN", "Panamá", "🇵🇦", "L", 4),
];

// Venues
const AZTECA = "Estadio Azteca, Ciudad de México";
const AKRON = "Estadio Akron, Zapopan";
const BBVA = "Estadio BBVA, Monterrey";
const BMO = "BMO Field, Toronto";
const BCPLACE = "BC Place, Vancouver";
const SOFI = "SoFi Stadium, Los Ángeles";
const LEVIS = "Levi's Stadium, San Francisco";
const LUMEN = "Lumen Field, Seattle";
const GILLETTE = "Gillette Stadium, Boston";
const METLIFE = "MetLife Stadium, Nueva York/Nueva Jersey";
const LINCOLN = "Lincoln Financial Field, Filadelfia";
const NRG = "NRG Stadium, Houston";
const ATT = "AT&T Stadium, Dallas";
const HARDROCK = "Hard Rock Stadium, Miami";
const MERCEDES = "Mercedes-Benz Stadium, Atlanta";
const ARROWHEAD = "Arrowhead Stadium, Kansas City";

const g = (
  id: number,
  group: GroupLetter,
  kickoffAt: string,
  venue: string,
  home: string,
  away: string,
): SeedMatch => ({ id, phase: "group", group, kickoffAt, venue, home, away });

const k = (
  id: number,
  phase: Phase,
  kickoffAt: string,
  venue: string,
  homeSource: string,
  awaySource: string,
): SeedMatch => ({ id, phase, kickoffAt, venue, homeSource, awaySource });

export const MATCHES: SeedMatch[] = [
  // ── Matchday 1 ──────────────────────────────────────────────
  g(1, "A", "2026-06-11T19:00:00Z", AZTECA, "MEX", "RSA"),
  g(2, "A", "2026-06-12T02:00:00Z", AKRON, "KOR", "CZE"),
  g(3, "B", "2026-06-12T19:00:00Z", BMO, "CAN", "BIH"),
  g(4, "D", "2026-06-13T01:00:00Z", SOFI, "USA", "PAR"),
  g(5, "C", "2026-06-14T01:00:00Z", GILLETTE, "HAI", "SCO"),
  g(6, "D", "2026-06-14T04:00:00Z", BCPLACE, "AUS", "TUR"),
  g(7, "C", "2026-06-13T22:00:00Z", METLIFE, "BRA", "MAR"),
  g(8, "B", "2026-06-13T19:00:00Z", LEVIS, "QAT", "SUI"),
  g(9, "E", "2026-06-14T23:00:00Z", LINCOLN, "CIV", "ECU"),
  g(10, "E", "2026-06-14T17:00:00Z", NRG, "GER", "CUW"),
  g(11, "F", "2026-06-14T20:00:00Z", ATT, "NED", "JPN"),
  g(12, "F", "2026-06-15T02:00:00Z", BBVA, "SWE", "TUN"),
  g(13, "H", "2026-06-15T22:00:00Z", HARDROCK, "KSA", "URU"),
  g(14, "H", "2026-06-15T16:00:00Z", MERCEDES, "ESP", "CPV"),
  g(15, "G", "2026-06-16T01:00:00Z", SOFI, "IRN", "NZL"),
  g(16, "G", "2026-06-15T19:00:00Z", LUMEN, "BEL", "EGY"),
  g(17, "I", "2026-06-16T19:00:00Z", METLIFE, "FRA", "SEN"),
  g(18, "I", "2026-06-16T22:00:00Z", GILLETTE, "IRQ", "NOR"),
  g(19, "J", "2026-06-17T01:00:00Z", ARROWHEAD, "ARG", "ALG"),
  g(20, "J", "2026-06-17T04:00:00Z", LEVIS, "AUT", "JOR"),
  g(21, "L", "2026-06-17T23:00:00Z", BMO, "GHA", "PAN"),
  g(22, "L", "2026-06-17T20:00:00Z", ATT, "ENG", "CRO"),
  g(23, "K", "2026-06-17T17:00:00Z", NRG, "POR", "COD"),
  g(24, "K", "2026-06-18T02:00:00Z", AZTECA, "UZB", "COL"),
  // ── Matchday 2 ──────────────────────────────────────────────
  g(25, "A", "2026-06-18T16:00:00Z", MERCEDES, "CZE", "RSA"),
  g(26, "B", "2026-06-18T19:00:00Z", SOFI, "SUI", "BIH"),
  g(27, "B", "2026-06-18T22:00:00Z", BCPLACE, "CAN", "QAT"),
  g(28, "A", "2026-06-19T01:00:00Z", AKRON, "MEX", "KOR"),
  g(29, "C", "2026-06-20T00:30:00Z", LINCOLN, "BRA", "HAI"),
  g(30, "C", "2026-06-19T22:00:00Z", GILLETTE, "SCO", "MAR"),
  g(31, "D", "2026-06-20T03:00:00Z", LEVIS, "TUR", "PAR"),
  g(32, "D", "2026-06-19T19:00:00Z", LUMEN, "USA", "AUS"),
  g(33, "E", "2026-06-20T20:00:00Z", BMO, "GER", "CIV"),
  g(34, "E", "2026-06-21T00:00:00Z", ARROWHEAD, "ECU", "CUW"),
  g(35, "F", "2026-06-20T17:00:00Z", NRG, "NED", "SWE"),
  g(36, "F", "2026-06-21T04:00:00Z", BBVA, "TUN", "JPN"),
  g(37, "H", "2026-06-21T22:00:00Z", HARDROCK, "URU", "CPV"),
  g(38, "H", "2026-06-21T16:00:00Z", MERCEDES, "ESP", "KSA"),
  g(39, "G", "2026-06-21T19:00:00Z", SOFI, "BEL", "IRN"),
  g(40, "G", "2026-06-22T01:00:00Z", BCPLACE, "NZL", "EGY"),
  g(41, "I", "2026-06-23T00:00:00Z", METLIFE, "NOR", "SEN"),
  g(42, "I", "2026-06-22T21:00:00Z", LINCOLN, "FRA", "IRQ"),
  g(43, "J", "2026-06-22T17:00:00Z", ATT, "ARG", "AUT"),
  g(44, "J", "2026-06-23T03:00:00Z", LEVIS, "JOR", "ALG"),
  g(45, "L", "2026-06-23T20:00:00Z", GILLETTE, "ENG", "GHA"),
  g(46, "L", "2026-06-23T23:00:00Z", BMO, "PAN", "CRO"),
  g(47, "K", "2026-06-23T17:00:00Z", NRG, "POR", "UZB"),
  g(48, "K", "2026-06-24T02:00:00Z", AKRON, "COL", "COD"),
  // ── Matchday 3 (simultaneous per group) ─────────────────────
  g(49, "C", "2026-06-24T22:00:00Z", HARDROCK, "SCO", "BRA"),
  g(50, "C", "2026-06-24T22:00:00Z", MERCEDES, "MAR", "HAI"),
  g(51, "B", "2026-06-24T19:00:00Z", BCPLACE, "SUI", "CAN"),
  g(52, "B", "2026-06-24T19:00:00Z", LUMEN, "BIH", "QAT"),
  g(53, "A", "2026-06-25T01:00:00Z", AZTECA, "CZE", "MEX"),
  g(54, "A", "2026-06-25T01:00:00Z", BBVA, "RSA", "KOR"),
  g(55, "E", "2026-06-25T20:00:00Z", LINCOLN, "CUW", "CIV"),
  g(56, "E", "2026-06-25T20:00:00Z", METLIFE, "ECU", "GER"),
  g(57, "F", "2026-06-25T23:00:00Z", ATT, "JPN", "SWE"),
  g(58, "F", "2026-06-25T23:00:00Z", ARROWHEAD, "TUN", "NED"),
  g(59, "D", "2026-06-26T02:00:00Z", SOFI, "TUR", "USA"),
  g(60, "D", "2026-06-26T02:00:00Z", LEVIS, "PAR", "AUS"),
  g(61, "I", "2026-06-26T19:00:00Z", GILLETTE, "NOR", "FRA"),
  g(62, "I", "2026-06-26T19:00:00Z", BMO, "SEN", "IRQ"),
  g(63, "G", "2026-06-27T03:00:00Z", LUMEN, "EGY", "IRN"),
  g(64, "G", "2026-06-27T03:00:00Z", BCPLACE, "NZL", "BEL"),
  g(65, "H", "2026-06-27T00:00:00Z", NRG, "CPV", "KSA"),
  g(66, "H", "2026-06-27T00:00:00Z", AKRON, "URU", "ESP"),
  g(67, "L", "2026-06-27T21:00:00Z", METLIFE, "PAN", "ENG"),
  g(68, "L", "2026-06-27T21:00:00Z", LINCOLN, "CRO", "GHA"),
  g(69, "J", "2026-06-28T02:00:00Z", ARROWHEAD, "ALG", "AUT"),
  g(70, "J", "2026-06-28T02:00:00Z", ATT, "JOR", "ARG"),
  g(71, "K", "2026-06-27T23:30:00Z", HARDROCK, "COL", "POR"),
  g(72, "K", "2026-06-27T23:30:00Z", MERCEDES, "COD", "UZB"),
  // ── Round of 32 ─────────────────────────────────────────────
  k(73, "r32", "2026-06-28T19:00:00Z", SOFI, "A2", "B2"),
  k(74, "r32", "2026-06-29T20:30:00Z", GILLETTE, "E1", "3ABCDF"),
  k(75, "r32", "2026-06-30T01:00:00Z", BBVA, "F1", "C2"),
  k(76, "r32", "2026-06-29T17:00:00Z", NRG, "C1", "F2"),
  k(77, "r32", "2026-06-30T21:00:00Z", METLIFE, "I1", "3CDFGH"),
  k(78, "r32", "2026-06-30T17:00:00Z", ATT, "E2", "I2"),
  k(79, "r32", "2026-07-01T01:00:00Z", AZTECA, "A1", "3CEFHI"),
  k(80, "r32", "2026-07-01T16:00:00Z", MERCEDES, "L1", "3EHIJK"),
  k(81, "r32", "2026-07-02T00:00:00Z", LEVIS, "D1", "3BEFIJ"),
  k(82, "r32", "2026-07-01T20:00:00Z", LUMEN, "G1", "3AEHIJ"),
  k(83, "r32", "2026-07-02T23:00:00Z", BMO, "K2", "L2"),
  k(84, "r32", "2026-07-02T19:00:00Z", SOFI, "H1", "J2"),
  k(85, "r32", "2026-07-03T03:00:00Z", BCPLACE, "B1", "3EFGIJ"),
  k(86, "r32", "2026-07-03T22:00:00Z", HARDROCK, "J1", "H2"),
  k(87, "r32", "2026-07-04T01:30:00Z", ARROWHEAD, "K1", "3DEIJL"),
  k(88, "r32", "2026-07-03T18:00:00Z", ATT, "D2", "G2"),
  // ── Round of 16 ─────────────────────────────────────────────
  k(89, "r16", "2026-07-04T21:00:00Z", LINCOLN, "W74", "W77"),
  k(90, "r16", "2026-07-04T17:00:00Z", NRG, "W73", "W75"),
  k(91, "r16", "2026-07-05T20:00:00Z", METLIFE, "W76", "W78"),
  k(92, "r16", "2026-07-06T00:00:00Z", AZTECA, "W79", "W80"),
  k(93, "r16", "2026-07-06T19:00:00Z", ATT, "W83", "W84"),
  k(94, "r16", "2026-07-07T00:00:00Z", LUMEN, "W81", "W82"),
  k(95, "r16", "2026-07-07T16:00:00Z", MERCEDES, "W86", "W88"),
  k(96, "r16", "2026-07-07T20:00:00Z", BCPLACE, "W85", "W87"),
  // ── Quarterfinals ───────────────────────────────────────────
  k(97, "qf", "2026-07-09T20:00:00Z", GILLETTE, "W89", "W90"),
  k(98, "qf", "2026-07-10T19:00:00Z", SOFI, "W93", "W94"),
  k(99, "qf", "2026-07-11T21:00:00Z", HARDROCK, "W91", "W92"),
  k(100, "qf", "2026-07-12T01:00:00Z", ARROWHEAD, "W95", "W96"),
  // ── Semifinals ──────────────────────────────────────────────
  k(101, "sf", "2026-07-14T19:00:00Z", ATT, "W97", "W98"),
  k(102, "sf", "2026-07-15T19:00:00Z", MERCEDES, "W99", "W100"),
  // ── Third place & Final ─────────────────────────────────────
  k(103, "third", "2026-07-18T21:00:00Z", HARDROCK, "L101", "L102"),
  k(104, "final", "2026-07-19T19:00:00Z", METLIFE, "W101", "W102"),
];
