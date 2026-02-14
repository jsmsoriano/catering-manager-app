'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_RULES, loadRules } from '@/lib/moneyRules';
import type { MoneyRules } from '@/lib/types';

export default function MoneyRulesPage() {
  const [rules, setRules] = useState<MoneyRules>(DEFAULT_RULES);
  const [hasChanges, setHasChanges] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  // Load saved rules from localStorage on mount (using safe deep merge)
  useEffect(() => {
    setRules(loadRules());
  }, []);

  const handleSave = () => {
    localStorage.setItem('moneyRules', JSON.stringify(rules));
    window.dispatchEvent(new Event('moneyRulesUpdated'));
    setHasChanges(false);
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 3000);
  };

  const handleReset = () => {
    if (confirm('Reset all values to defaults? This cannot be undone.')) {
      setRules(DEFAULT_RULES);
      localStorage.removeItem('moneyRules');
      setHasChanges(false);
    }
  };

  const updateRules = (path: string[], value: any) => {
    // Sanitize NaN from parseFloat("") — treat as 0 to prevent corrupted saves
    const safeValue = typeof value === 'number' && !Number.isFinite(value) ? 0 : value;
    setRules((prev) => {
      const newRules = { ...prev };
      let current: any = newRules;

      for (let i = 0; i < path.length - 1; i++) {
        current[path[i]] = { ...current[path[i]] };
        current = current[path[i]];
      }

      current[path[path.length - 1]] = safeValue;
      return newRules;
    });
    setHasChanges(true);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Money Rules Configuration
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Configure all pricing, labor, and profit distribution rules for your business.
        </p>
      </div>

      {/* Save/Reset Actions */}
      <div className="mb-8 flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
            hasChanges
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'cursor-not-allowed bg-zinc-400'
          }`}
        >
          Save Changes
        </button>
        <button
          onClick={handleReset}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Reset to Defaults
        </button>
        {showSaveSuccess && (
          <span className="text-sm font-medium text-emerald-600">
            ✓ Saved successfully
          </span>
        )}
        {hasChanges && (
          <span className="text-sm text-amber-600">● Unsaved changes</span>
        )}
      </div>

      <div className="space-y-8">
        {/* PRICING SECTION */}
        <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Pricing
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Private Dinner Base Price ($/person)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={rules.pricing.privateDinnerBasePrice}
                onChange={(e) =>
                  updateRules(['pricing', 'privateDinnerBasePrice'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Buffet Base Price ($/person)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={rules.pricing.buffetBasePrice}
                onChange={(e) =>
                  updateRules(['pricing', 'buffetBasePrice'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Premium Add-on Min ($/person)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={rules.pricing.premiumAddOnMin}
                onChange={(e) =>
                  updateRules(['pricing', 'premiumAddOnMin'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Premium Add-on Max ($/person)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={rules.pricing.premiumAddOnMax}
                onChange={(e) =>
                  updateRules(['pricing', 'premiumAddOnMax'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Default Gratuity (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.pricing.defaultGratuityPercent}
                onChange={(e) =>
                  updateRules(['pricing', 'defaultGratuityPercent'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Child Discount (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.pricing.childDiscountPercent}
                onChange={(e) =>
                  updateRules(['pricing', 'childDiscountPercent'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>
        </section>

        {/* STAFFING SECTION */}
        <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Staffing Rules
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Max Guests per Chef (Private)
              </label>
              <input
                type="number"
                min="1"
                value={rules.staffing.maxGuestsPerChefPrivate}
                onChange={(e) =>
                  updateRules(['staffing', 'maxGuestsPerChefPrivate'], parseInt(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Max Guests per Chef (Buffet)
              </label>
              <input
                type="number"
                min="1"
                value={rules.staffing.maxGuestsPerChefBuffet}
                onChange={(e) =>
                  updateRules(['staffing', 'maxGuestsPerChefBuffet'], parseInt(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={rules.staffing.assistantRequired}
                  onChange={(e) =>
                    updateRules(['staffing', 'assistantRequired'], e.target.checked)
                  }
                  className="mr-2"
                />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Assistant Required (Private Events)
                </span>
              </label>
            </div>
          </div>
        </section>

        {/* PRIVATE LABOR SECTION */}
        <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Private Event Labor
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Lead Chef Base (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.privateLabor.leadChefBasePercent}
                onChange={(e) =>
                  updateRules(['privateLabor', 'leadChefBasePercent'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Lead Chef Cap ($)
              </label>
              <input
                type="number"
                min="0"
                value={rules.privateLabor.leadChefCap}
                onChange={(e) =>
                  updateRules(['privateLabor', 'leadChefCap'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Overflow Chef Base (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.privateLabor.overflowChefBasePercent}
                onChange={(e) =>
                  updateRules(['privateLabor', 'overflowChefBasePercent'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Overflow Chef Cap ($)
              </label>
              <input
                type="number"
                min="0"
                value={rules.privateLabor.overflowChefCap}
                onChange={(e) =>
                  updateRules(['privateLabor', 'overflowChefCap'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Full Chef Base (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.privateLabor.fullChefBasePercent}
                onChange={(e) =>
                  updateRules(['privateLabor', 'fullChefBasePercent'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Full Chef Cap ($)
              </label>
              <input
                type="number"
                min="0"
                value={rules.privateLabor.fullChefCap}
                onChange={(e) =>
                  updateRules(['privateLabor', 'fullChefCap'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Assistant Base (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.privateLabor.assistantBasePercent}
                onChange={(e) =>
                  updateRules(['privateLabor', 'assistantBasePercent'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Assistant Cap ($ or leave 0 for no cap)
              </label>
              <input
                type="number"
                min="0"
                value={rules.privateLabor.assistantCap || 0}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  updateRules(['privateLabor', 'assistantCap'], val === 0 ? null : val);
                }}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>

          {/* Gratuity Split */}
          <div className="mt-6 border-t border-zinc-200 pt-6 dark:border-zinc-700">
            <h3 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-50">
              Gratuity Split (Private Events)
            </h3>
            <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
              How gratuity is divided between chefs and assistant. Must total 100%.
            </p>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Chef(s) Gratuity Split (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={rules.privateLabor.chefGratuitySplitPercent}
                  onChange={(e) =>
                    updateRules(['privateLabor', 'chefGratuitySplitPercent'], parseFloat(e.target.value))
                  }
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Split equally among all chefs on the event
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Assistant Gratuity Split (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={rules.privateLabor.assistantGratuitySplitPercent}
                  onChange={(e) =>
                    updateRules(['privateLabor', 'assistantGratuitySplitPercent'], parseFloat(e.target.value))
                  }
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>
            {Math.abs(
              (rules.privateLabor.chefGratuitySplitPercent || 0) +
              (rules.privateLabor.assistantGratuitySplitPercent || 0) - 100
            ) > 0.1 && (
              <p className="mt-3 text-sm font-medium text-orange-600 dark:text-orange-400">
                Total is {((rules.privateLabor.chefGratuitySplitPercent || 0) + (rules.privateLabor.assistantGratuitySplitPercent || 0)).toFixed(1)}% — should be 100%
              </p>
            )}
          </div>
        </section>

        {/* BUFFET LABOR SECTION */}
        <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Buffet Event Labor
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Chef Base (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.buffetLabor.chefBasePercent}
                onChange={(e) =>
                  updateRules(['buffetLabor', 'chefBasePercent'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Chef Cap ($)
              </label>
              <input
                type="number"
                min="0"
                value={rules.buffetLabor.chefCap}
                onChange={(e) =>
                  updateRules(['buffetLabor', 'chefCap'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>
        </section>

        {/* COST STRUCTURE SECTION */}
        <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Cost Structure
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Food Cost - Private (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.costs.foodCostPercentPrivate}
                onChange={(e) =>
                  updateRules(['costs', 'foodCostPercentPrivate'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Food Cost - Buffet (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.costs.foodCostPercentBuffet}
                onChange={(e) =>
                  updateRules(['costs', 'foodCostPercentBuffet'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Supplies Cost (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.costs.suppliesCostPercent}
                onChange={(e) =>
                  updateRules(['costs', 'suppliesCostPercent'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Transportation Stipend ($)
              </label>
              <input
                type="number"
                min="0"
                value={rules.costs.transportationStipend}
                onChange={(e) =>
                  updateRules(['costs', 'transportationStipend'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>
        </section>

        {/* DISTANCE FEES SECTION */}
        <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Distance Fees
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Free Distance (miles)
              </label>
              <input
                type="number"
                min="0"
                value={rules.distance.freeDistanceMiles}
                onChange={(e) =>
                  updateRules(['distance', 'freeDistanceMiles'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Base Distance Fee ($)
              </label>
              <input
                type="number"
                min="0"
                value={rules.distance.baseDistanceFee}
                onChange={(e) =>
                  updateRules(['distance', 'baseDistanceFee'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Additional Fee per Increment ($)
              </label>
              <input
                type="number"
                min="0"
                value={rules.distance.additionalFeePerIncrement}
                onChange={(e) =>
                  updateRules(['distance', 'additionalFeePerIncrement'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Increment Miles
              </label>
              <input
                type="number"
                min="1"
                value={rules.distance.incrementMiles}
                onChange={(e) =>
                  updateRules(['distance', 'incrementMiles'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>
        </section>

        {/* PROFIT DISTRIBUTION SECTION */}
        <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Profit Distribution
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Business Retained (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.profitDistribution.businessRetainedPercent}
                onChange={(e) =>
                  updateRules(['profitDistribution', 'businessRetainedPercent'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Owner Distribution (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.profitDistribution.ownerDistributionPercent}
                onChange={(e) =>
                  updateRules(['profitDistribution', 'ownerDistributionPercent'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Owner A Equity (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.profitDistribution.ownerAEquityPercent}
                onChange={(e) =>
                  updateRules(['profitDistribution', 'ownerAEquityPercent'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Owner B Equity (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.profitDistribution.ownerBEquityPercent}
                onChange={(e) =>
                  updateRules(['profitDistribution', 'ownerBEquityPercent'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Distribution Frequency
              </label>
              <select
                value={rules.profitDistribution.distributionFrequency}
                onChange={(e) =>
                  updateRules(['profitDistribution', 'distributionFrequency'], e.target.value)
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
          </div>
        </section>

        {/* SAFETY LIMITS SECTION */}
        <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Safety Limits (Warnings Only)
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Max Total Labor (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.safetyLimits.maxTotalLaborPercent}
                onChange={(e) =>
                  updateRules(['safetyLimits', 'maxTotalLaborPercent'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Max Food Cost (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.safetyLimits.maxFoodCostPercent}
                onChange={(e) =>
                  updateRules(['safetyLimits', 'maxFoodCostPercent'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={rules.safetyLimits.warnWhenExceeded}
                  onChange={(e) =>
                    updateRules(['safetyLimits', 'warnWhenExceeded'], e.target.checked)
                  }
                  className="mr-2"
                />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Show Warnings When Exceeded
                </span>
              </label>
            </div>
          </div>
        </section>
      </div>

      {/* Bottom Save Button */}
      <div className="mt-8 flex justify-end gap-4">
        <button
          onClick={handleReset}
          className="rounded-md border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Reset to Defaults
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className={`rounded-md px-6 py-3 text-sm font-medium text-white ${
            hasChanges
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'cursor-not-allowed bg-zinc-400'
          }`}
        >
          Save All Changes
        </button>
      </div>
    </div>
  );
}
