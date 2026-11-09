export type NetMeteringMode = "none" | "full" | "partial";

export interface EconomicsInput {
  systemSizeKw: number;
  annualProductionKwh: number;
  annualUsageKwh: number;
  ratePerKwh: number;
  /** Installed cost before incentives ($/W DC). */
  costPerWatt: number;
  /** Federal ITC fraction, e.g. 0.30 */
  itcFraction: number;
  netMetering: NetMeteringMode;
  /** For partial NM: export credit as fraction of retail rate */
  exportRateFraction: number;
  /** Annual module degradation */
  degradationPerYear: number;
  /** Utility rate inflation */
  rateInflationPerYear: number;
  years: number;
}

export interface YearCashflow {
  year: number;
  productionKwh: number;
  savingsUsd: number;
  cumulativeSavingsUsd: number;
  netPositionUsd: number;
}

export interface EconomicsResult {
  grossInstallUsd: number;
  itcUsd: number;
  netInstallUsd: number;
  annualSelfUseKwh: number;
  annualExportKwh: number;
  year1SavingsUsd: number;
  billBeforeUsd: number;
  billAfterUsd: number;
  simplePaybackYears: number | null;
  lifetimeSavingsUsd: number;
  cashflow: YearCashflow[];
}

function yearSavings(
  production: number,
  usage: number,
  rate: number,
  nm: NetMeteringMode,
  exportFrac: number
): {
  selfUse: number;
  exportKwh: number;
  savings: number;
  billBefore: number;
  billAfter: number;
} {
  const selfUse = Math.min(production, usage);
  const exportKwh = Math.max(0, production - usage);
  const billBefore = usage * rate;

  let exportCredit = 0;
  if (nm === "full") exportCredit = exportKwh * rate;
  else if (nm === "partial") exportCredit = exportKwh * rate * exportFrac;

  // When full/partial NM, export earns credit; none = self-consumption only
  const trueSavings =
    nm === "none"
      ? selfUse * rate
      : selfUse * rate + exportCredit;

  return {
    selfUse,
    exportKwh,
    savings: trueSavings,
    billBefore,
    billAfter: Math.max(0, billBefore - trueSavings),
  };
}

export function calculateEconomics(input: EconomicsInput): EconomicsResult {
  const grossInstallUsd = input.systemSizeKw * 1000 * input.costPerWatt;
  const itcUsd = grossInstallUsd * input.itcFraction;
  const netInstallUsd = Math.max(0, grossInstallUsd - itcUsd);

  const y1 = yearSavings(
    input.annualProductionKwh,
    input.annualUsageKwh,
    input.ratePerKwh,
    input.netMetering,
    input.exportRateFraction
  );

  const cashflow: YearCashflow[] = [];
  let cumulative = 0;
  let payback: number | null = null;

  for (let y = 1; y <= input.years; y++) {
    const prod =
      input.annualProductionKwh *
      Math.pow(1 - input.degradationPerYear, y - 1);
    const rate =
      input.ratePerKwh * Math.pow(1 + input.rateInflationPerYear, y - 1);
    const s = yearSavings(
      prod,
      input.annualUsageKwh,
      rate,
      input.netMetering,
      input.exportRateFraction
    );
    cumulative += s.savings;
    const netPosition = cumulative - netInstallUsd;
    if (payback == null && netPosition >= 0) {
      payback = y;
    }
    cashflow.push({
      year: y,
      productionKwh: prod,
      savingsUsd: s.savings,
      cumulativeSavingsUsd: cumulative,
      netPositionUsd: netPosition,
    });
  }

  // Fractional simple payback if year1 > 0
  let simplePaybackYears = payback;
  if (y1.savings > 0 && netInstallUsd > 0) {
    const rough = netInstallUsd / y1.savings;
    simplePaybackYears = rough;
  } else if (y1.savings <= 0) {
    simplePaybackYears = null;
  }

  return {
    grossInstallUsd,
    itcUsd,
    netInstallUsd,
    annualSelfUseKwh: y1.selfUse,
    annualExportKwh: y1.exportKwh,
    year1SavingsUsd: y1.savings,
    billBeforeUsd: y1.billBefore,
    billAfterUsd: y1.billAfter,
    simplePaybackYears,
    lifetimeSavingsUsd: cumulative - netInstallUsd,
    cashflow,
  };
}
