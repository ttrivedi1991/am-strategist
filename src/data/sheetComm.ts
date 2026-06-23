// Finance-approved commissionable actuals from post-close commission sheets.
// These values override the warehouse blended-rate estimate for any month/partner
// listed here. Includes manual adjustments made after books close.
//
// HOW TO UPDATE: When a new commission sheet arrives, add a new month key to
// each partner's record. Use the "Current Month Commissionable Dollars" column
// (= revenue_reporting_net × inclusion_rate per SKU, adjusted by finance).
// Partners only in the sheet but not the warehouse should still be added here.
//
// Tanmay Trivedi — Q2 2026 (Apr + May actuals)
// Source: Q2 commission calculation sheet shared 2026-06-23.
// Keyed by AGID → month label (matching revenueHistory week format).

export const SHEET_COMM: Record<string, Record<string, number>> = {
  // CoStar Group
  "AG-SLC55MDZ":    { "Apr 26": 63580.11, "May 26": 64331.77 },
  // Telkom SA Soc Ltd.
  "AG-SHZ2GS2S":    { "Apr 26": 77604.80, "May 26": 39634.38 },
  // United Wholesale Mortgage, LLC
  "AG-4JFDHHX7W4":  { "Apr 26": 39330.00, "May 26": 39330.00 },
  // SM Marketing International
  "AG-TZJNXBPR3D":  { "Apr 26": 14129.83, "May 26": 14250.00 },
  // ApartmentRatings
  "AG-R97ZFF44":    { "Apr 26": 13313.78, "May 26": 15236.77 },
  // Web.com
  "AG-LP8TVPZ9":    { "Apr 26": 13532.75, "May 26": 13532.75 },
  // DealerRater.com
  "AG-XGLXXXRJ":    { "Apr 26": 10531.32, "May 26": 10560.77 },
  // Stephens Solutions
  "AG-PKSWWWKV4T":  { "Apr 26":  6450.78, "May 26":  6412.68 },
  // EZlocal
  "AG-NNDCHZXF":    { "Apr 26":  5965.68, "May 26":  5829.82 },
  // FormPiper PRESENCE
  "AG-BSQ264C7PF":  { "Apr 26":  4879.63, "May 26":  4867.13 },
  // VisitorReach
  "AG-PFFSGFF668":  { "Apr 26":  4836.18, "May 26":  4866.05 },
  // BBB Atlanta & NE Georgia
  "AG-BS3RNGK7WC":  { "Apr 26":  4996.18, "May 26":  4601.09 },
  // TripAdvisor
  "AG-V3CTBD72":    { "Apr 26":  3975.75, "May 26":  3892.15 },
  // LocalBizNOW
  "AG-BFDSF9DJ":    { "Apr 26":  5042.25, "May 26":  5028.00 },
  // Platr.ai
  "AG-NWCCJ46JGG":  { "Apr 26":  2495.65, "May 26":  2492.15 },
  // Cantrex Nationwide
  "AG-GCRSZFJPNC":  { "Apr 26":  2084.38, "May 26":  2036.61 },
  // ChartLocal
  "AG-QT3RXNJG":    { "Apr 26":  1382.53, "May 26":  1382.53 },
  // Fiska Inc.
  "AG-BNW3QSPBVV":  { "Apr 26":  1126.70, "May 26":  1147.22 },
  // Digital Air Strike
  "AG-LFTMQX4J":    { "Apr 26":  1027.31, "May 26":  1254.06 },
  // Cylex
  "AG-MXQRFLNQRK":  { "Apr 26":  1020.30, "May 26":    21.85 },
  // Funasia Digital
  "AG-GFFFT52QTD":  { "Apr 26":   894.59, "May 26":   913.90 },
  // Data Axle
  "AG-KDB93NJ8":    { "Apr 26":   887.25, "May 26":   938.25 },
  // FranConnect
  "AG-N6K9PLSL":    { "Apr 26":   648.75, "May 26":   648.75 },
  // ReachEdge
  "AG-XJZ8JB2J":    { "Apr 26":   379.62, "May 26":   379.62 },
  // BBB Serving Central East Texas
  "AG-FLN6NHZTRR":  { "Apr 26":   278.05, "May 26":   278.05 },
  // DealerRater.ca
  "AG-6H26M6RHTB":  { "Apr 26":   241.49, "May 26":   241.49 },
  // Register.com
  "AG-TNQSWRQC84":  { "Apr 26":   232.75, "May 26":   232.75 },
  // Network Solutions
  "AG-4ZR8NJ2TBZ":  { "Apr 26":   142.50, "May 26":   133.00 },
  // Houzz
  "AG-7TM4C6L6HP":  { "Apr 26":   151.61, "May 26":   152.76 },
  // Vivial
  "AG-TZW5J82T":    { "Apr 26":    39.00, "May 26":    29.00 },
  // HBS Systems Inc
  "AG-6WDDX2MJGZ":  { "Apr 26":    26.40, "May 26":    26.40 },
  // Note: Local Ad Agency (EVVN) has no AGID in the system; Apr $0.27 omitted.
};
