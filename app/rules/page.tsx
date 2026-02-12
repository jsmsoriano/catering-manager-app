"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_RULES, clamp, loadRules, saveRules, toNumber } from "@/lib/moneyRules";
import type { MoneyRules } from "@/types/money";

export default function MoneyRulesPage() {
  const [rules, setRules] = useState<MoneyRules>(DEFAULT_RULES);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setRules(loadRules()), []);

  const validation = useMemo(() => {
    const issues: string[] = [];

    const ownerTotal = (rules.profitDistributions.ownerSplitA || 0) + (rules.profitDistributions.ownerSplitB || 0);
    if (Math.round(ownerTotal) !== 100) issues.push(`Ownership split must total 100%. Current: ${ownerTotal}%`);

    const monthTotal =
      (rules.profitDistributions.monthlyDistributionPercent || 0) +
      (rules.profitDistributions.monthlyRetainedPercent || 0);
    if (Math.round(monthTotal) !== 100) issues.push(`Monthly payout + retained must total 100%. Current: ${monthTotal}%`);

    const tipTotal = (rules.privateDinnerPay.chefTipSharePercent || 0) + (rules.privateDinnerPay.assistantTipSharePercent || 0);
    if (Math.round(tipTotal) !== 100) issues.push(`Private dinner tip split must total 100%. Current: ${tipTotal}%`);

    if (!rules.revenueTreatment.gratuityIsTipPool) issues.push("Gratuity must remain Tip Pool (not business revenue).");

    if (rules.pricing.premiumAddOnMinPerGuest > rules.pricing.premiumAddOnMaxPerGuest) {
      issues.push("Premium add-on min cannot be greater than max.");
    }

    return { ok: issues.length === 0, issues };
  }, [rules]);

  function update(path: string, value: any) {
    setRules((prev) => {
      const next: any = structuredClone(prev);
      const keys = path.split(".");
      let cur = next;
      for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
      cur[keys[keys.length - 1]] = value;
      return next as MoneyRules;
    });
    setDirty(true);
  }

  function onSave() {
    if (!validation.ok) return;
    saveRules(rules);
    setDirty(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  function onReset() {
    setRules(DEFAULT_RULES);
    setDirty(true);
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Money Rules</h1>
      <p style={{ color: "#888" }}>Pricing defaults, tip pool rules, reserves, and profit splits.</p>

      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button onClick={onReset}>Reset</button>
        <button onClick={onSave} disabled={!dirty || !validation.ok}>
          Save
        </button>
        {saved && <span style={{ color: "#4ade80" }}>Saved.</span>}
      </div>

      {!validation.ok && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #ff4d4f", borderRadius: 8 }}>
          <strong style={{ color: "#ff4d4f" }}>Fix these before saving</strong>
          <ul>
            {validation.issues.map((i) => (
              <li key={i} style={{ color: "#ffb3b3" }}>
                {i}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <section style={{ padding: 14, border: "1px solid #333", borderRadius: 10 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Pricing</h2>

          <label>Base private per guest</label>
          <input
            type="number"
            value={rules.pricing.basePrivatePerGuest}
            onChange={(e) => update("pricing.basePrivatePerGuest", clamp(toNumber(e.target.value), 0, 10000))}
          />

          <label style={{ display: "block", marginTop: 10 }}>Default gratuity %</label>
          <input
            type="number"
            value={rules.pricing.defaultGratuityPercent}
            onChange={(e) => update("pricing.defaultGratuityPercent", clamp(toNumber(e.target.value), 0, 100))}
          />

          <label style={{ display: "block", marginTop: 10 }}>Max guests per chef</label>
          <input
            type="number"
            value={rules.pricing.maxGuestsPerChef}
            onChange={(e) => update("pricing.maxGuestsPerChef", clamp(toNumber(e.target.value), 1, 100))}
          />
        </section>

        <section style={{ padding: 14, border: "1px solid #333", borderRadius: 10 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Private Dinner Pay</h2>

          <label>Chef base % of subtotal</label>
          <input
            type="number"
            value={rules.privateDinnerPay.chefBasePercentOfSubtotal}
            onChange={(e) => update("privateDinnerPay.chefBasePercentOfSubtotal", clamp(toNumber(e.target.value), 0, 100))}
          />

          <label style={{ display: "block", marginTop: 10 }}>Chef tip share %</label>
          <input
            type="number"
            value={rules.privateDinnerPay.chefTipSharePercent}
            onChange={(e) => update("privateDinnerPay.chefTipSharePercent", clamp(toNumber(e.target.value), 0, 100))}
          />

          <label style={{ display: "block", marginTop: 10 }}>Assistant base pay per event</label>
          <input
            type="number"
            value={rules.privateDinnerPay.assistantBasePerEvent}
            onChange={(e) => update("privateDinnerPay.assistantBasePerEvent", clamp(toNumber(e.target.value), 0, 10000))}
          />
        </section>
      </div>
    </div>
  );
}