// Finance-approved commissionable actuals from post-close commission sheets.
// FINANCE DATA ONLY — never put warehouse estimates in this file; the engine
// falls back to LIVE_COMM (warehouse SKU-level, from `npm run refresh`) and
// then to blended-rate estimates on its own.
//
// HOW TO UPDATE: When a new commission workbook arrives, add a new month key
// per partner from its "Data" tab — sum "Current Month Commissionable Dollars"
// per partner (= revenue_reporting_net × inclusion_rate per inclusion
// category, incl. finance's post-close manual adjustments).
//
// Tanmay Trivedi — Jan–May 2026 finance actuals
// Sources:
//   Q1 (Jan–Mar): Mar rep-wise workbook, Data tab (verified again 2026-07-14
//     against the local xlsx — per-partner totals match this file exactly).
//   Apr–May: Q2 workbook Data tab (read 2026-07-06).
//   Jun was REMOVED 2026-07-14: it had been reconstructed from invoice PDFs
//   with ~95% rates applied to listings-heavy partners (Listings pay 50%),
//   overstating June by ~$15.4K vs finance's official $265,407 close. June
//   now comes from LIVE_COMM (warehouse SKU-level, reconciles within 0.2%).
// Keyed by AGID → month label (matching revenueHistory week format).
//
// Currency note: P0QK (Cantrex) and ZA8K (Home.CA AI Inc.) bill in CAD.
// The commission.ts currency split ensures USD_TO_CAD is NOT applied to
// these partners at payout time.

export const SHEET_COMM: Record<string, Record<string, number>> = {
  // CoStar Group
  "AG-SLC55MDZ":    { "Jan 26": 64194.21, "Feb 26": 63620.11, "Mar 26": 64638.76, "Apr 26": 63580.11, "May 26": 64331.77 },
  // Telkom SA Soc Ltd.  (Apr inflated by $20K overcharge; May depressed by $40K credit — telescope cancels in Q2 WAMGR)
  "AG-SHZ2GS2S":    { "Jan 26": 58459.80, "Feb 26": 58338.60, "Mar 26": 58741.50, "Apr 26": 77604.80, "May 26": 39634.38 },
  // United Wholesale Mortgage, LLC (contractual flat $41,400/mo × 95%)
  "AG-4JFDHHX7W4":  { "Jan 26": 39330.00, "Feb 26": 39351.85, "Mar 26": 39330.00, "Apr 26": 39330.00, "May 26": 39330.00 },
  // ApartmentRatings
  "AG-R97ZFF44":    { "Jan 26": 14028.19, "Feb 26": 14606.57, "Mar 26": 14457.37, "Apr 26": 13313.78, "May 26": 15236.77 },
  // SM Marketing International  (no Jan — assigned Feb 2026; Q1 recognized manually by finance)
  "AG-TZJNXBPR3D":  { "Feb 26": 14250.00, "Mar 26": 14370.18, "Apr 26": 14129.83, "May 26": 14250.00 },
  // Web.com
  "AG-LP8TVPZ9":    { "Jan 26": 13532.75, "Feb 26": 13532.75, "Mar 26": 13532.75, "Apr 26": 13532.75, "May 26": 13532.75 },
  // DealerRater.com
  "AG-XGLXXXRJ":    { "Jan 26": 10331.06, "Feb 26": 10307.50, "Mar 26": 10442.97, "Apr 26": 10531.32, "May 26": 10560.77 },
  // Stephens Solutions
  "AG-PKSWWWKV4T":  { "Jan 26":  7191.44, "Feb 26":  7319.76, "Mar 26":  7157.30, "Apr 26":  6450.78, "May 26":  6412.68 },
  // EZlocal
  "AG-NNDCHZXF":    { "Jan 26":  6691.06, "Feb 26":  6615.41, "Mar 26":  6293.45, "Apr 26":  5965.68, "May 26":  5829.82 },
  // BBB Atlanta & NE Georgia
  "AG-BS3RNGK7WC":  { "Jan 26":  6325.77, "Feb 26":  5539.89, "Mar 26":  5771.96, "Apr 26":  4996.18, "May 26":  4601.09 },
  // FormPiper PRESENCE
  "AG-BSQ264C7PF":  { "Jan 26":  4968.89, "Feb 26":  4885.25, "Mar 26":  4885.25, "Apr 26":  4879.63, "May 26":  4867.13 },
  // VisitorReach
  "AG-PFFSGFF668":  { "Jan 26":  4695.05, "Feb 26":  4859.30, "Mar 26":  4825.55, "Apr 26":  4836.18, "May 26":  4866.05 },
  // TripAdvisor
  "AG-V3CTBD72":    { "Jan 26":  4424.15, "Feb 26":  4325.35, "Mar 26":  4249.35, "Apr 26":  3975.75, "May 26":  3892.15 },
  // LocalBizNOW
  "AG-BFDSF9DJ":    { "Jan 26":  3911.75, "Feb 26":  5047.00, "Mar 26":  5042.25, "Apr 26":  5042.25, "May 26":  5028.00 },
  // Fiska Inc.
  "AG-BNW3QSPBVV":  { "Jan 26":  3195.12, "Feb 26":  2824.73, "Mar 26":  1029.23, "Apr 26":  1126.70, "May 26":  1147.22 },
  // Platr.ai
  "AG-NWCCJ46JGG":  { "Jan 26":  2737.60, "Feb 26":  2659.09, "Mar 26":  2619.47, "Apr 26":  2495.65, "May 26":  2492.15 },
  // Cantrex Nationwide (CAD — no USD_TO_CAD applied at payout)
  "AG-GCRSZFJPNC":  { "Jan 26":  2005.75, "Feb 26":  2007.17, "Mar 26":  2037.70, "Apr 26":  2084.38, "May 26":  2036.61 },
  // ChartLocal
  "AG-QT3RXNJG":    { "Jan 26":  1513.45, "Feb 26":  1463.45, "Mar 26":  1423.45, "Apr 26":  1382.53, "May 26":  1382.53 },
  // Data Axle
  "AG-KDB93NJ8":    { "Jan 26":  1131.35, "Feb 26":   996.30, "Mar 26":   927.60, "Apr 26":   887.25, "May 26":   938.25 },
  // Cylex  (large May drop reflects downgrade, not churn)
  "AG-MXQRFLNQRK":  { "Jan 26":  1069.23, "Feb 26":  1036.45, "Mar 26":  1026.17, "Apr 26":  1020.30, "May 26":    21.85 },
  // Digital Air Strike
  "AG-LFTMQX4J":    { "Jan 26":  1045.20, "Feb 26":   743.64, "Mar 26":   970.19, "Apr 26":  1027.31, "May 26":  1254.06 },
  // Funasia Digital
  "AG-GFFFT52QTD":  { "Jan 26":   819.54, "Feb 26":   894.59, "Mar 26":   894.59, "Apr 26":   894.59, "May 26":   913.90 },
  // FranConnect
  "AG-N6K9PLSL":    { "Jan 26":   648.75, "Feb 26":   648.75, "Mar 26":   648.75, "Apr 26":   648.75, "May 26":   648.75 },
  // Houzz
  "AG-7TM4C6L6HP":  { "Jan 26":   149.91, "Feb 26":   150.94, "Mar 26":   151.35, "Apr 26":   151.61, "May 26":   152.76 },
  // ReachEdge
  "AG-XJZ8JB2J":    { "Jan 26":   379.62, "Feb 26":   379.62, "Mar 26":   379.62, "Apr 26":   379.62, "May 26":   379.62 },
  // BBB Serving Central East Texas
  "AG-FLN6NHZTRR":  { "Jan 26":   278.05, "Feb 26":   278.05, "Mar 26":   278.05, "Apr 26":   278.05, "May 26":   278.05 },
  // DealerRater.ca
  "AG-6H26M6RHTB":  { "Jan 26":   241.49, "Feb 26":   241.49, "Mar 26":   241.49, "Apr 26":   241.49, "May 26":   241.49 },
  // Register.com
  "AG-TNQSWRQC84":  { "Jan 26":   232.75, "Feb 26":   232.75, "Mar 26":   232.75, "Apr 26":   232.75, "May 26":   232.75 },
  // Network Solutions
  "AG-4ZR8NJ2TBZ":  { "Jan 26":   142.50, "Feb 26":   142.50, "Mar 26":   142.50, "Apr 26":   142.50, "May 26":   133.00 },
  // Vivial
  "AG-TZW5J82T":    { "Jan 26":    44.00, "Feb 26":    44.00, "Mar 26":    39.00, "Apr 26":    39.00, "May 26":    29.00 },
  // HBS Systems Inc
  "AG-6WDDX2MJGZ":  { "Jan 26":    26.40, "Feb 26":    26.40, "Mar 26":    26.40, "Apr 26":    26.40, "May 26":    26.40 },
  // Note: Magnfi (MGFI, first billing Apr 2026) and Home.CA AI Inc. (ZA8K, CAD,
  // first billing Jun 2026) have no finance actuals yet — they flow from LIVE_COMM.
  // Note: Local Ad Agency (EVVN) — no AGID; churned Apr 2026. Q1 comm: Jan $571.22, Feb $501.87, Mar $501.87 — excluded.
};
