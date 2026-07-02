/* UI wiring for the commission calculator: reads/writes the DOM and
 * localStorage, and delegates all maths to calc.js (window.CommissionCalc).
 * Keep calculation logic out of this file — it belongs in calc.js.
 */
(() => {
  const STORAGE_KEY = 'comp-calc:plan';
  const { defaultPlan, validatePlan, validateDeal, calculateCommission } = window.CommissionCalc;

  const planForm = document.getElementById('plan-form');
  const dealForm = document.getElementById('deal-form');
  const tiersList = document.getElementById('tiers-list');
  const addTierBtn = document.getElementById('add-tier');
  const resetPlanBtn = document.getElementById('reset-plan');
  const planErrorsEl = document.getElementById('plan-errors');
  const dealErrorsEl = document.getElementById('deal-errors');
  const saveStatusEl = document.getElementById('save-status');
  const resultsEl = document.getElementById('results');
  const resultGrossEl = document.getElementById('result-gross');
  const resultNetEl = document.getElementById('result-net');
  const breakdownListEl = document.getElementById('breakdown-list');
  const yearBreakdownSectionEl = document.getElementById('year-breakdown-section');
  const yearBreakdownListEl = document.getElementById('year-breakdown-list');
  const dealTypeEl = document.getElementById('dealType');
  const acvLabelEl = document.getElementById('acv-label');
  const acvInputEl = document.getElementById('acv');
  const tcvFieldEl = document.getElementById('tcv-field');
  const tcvLinesListEl = document.getElementById('tcv-lines-list');
  const addTcvLineBtn = document.getElementById('add-tcv-line');
  const tcvTotalValueEl = document.getElementById('tcv-total-value');

  // Deal-side figures (ACV, TCV, quota, attainment) are USD — that's the
  // currency deals are quoted in. Commission payouts (gross/net/deductions)
  // are GBP — that's this plan's rate structure, not a currency conversion:
  // a dollar deal value times a percentage rate produces a pound figure.
  // Keeping two separate formatters means the breakdown can never show a
  // dollar amount with a £ sign or vice versa.
  const usdFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const usdFmt2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  const gbpFmt2 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2 });
  const formatUSD = (n) => usdFmt.format(n);
  const formatUSD2 = (n) => usdFmt2.format(n);
  const formatGBP2 = (n) => gbpFmt2.format(n);
  const formatPct = (n) => `${n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}%`;

  const ACV_LABELS = {
    newBusiness: 'ACV — Annual Contract Value (USD $)',
    renewal: 'Renewal ACV (USD $)',
    oyNb: 'Out-year ACV (USD $)',
  };

  // ---------------------------------------------------------------- storage

  function loadPlan() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultPlan();
      const parsed = JSON.parse(raw);
      if (validatePlan(parsed).length > 0) return defaultPlan();
      return parsed;
    } catch {
      return defaultPlan();
    }
  }

  function savePlan(plan) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  }

  // ------------------------------------------------------------ tier rows

  function renderTierRow(tier, index) {
    const row = document.createElement('div');
    row.className = 'tier-row';
    row.dataset.index = String(index);
    row.innerHTML = `
      <label>
        <span>From attainment (%)</span>
        <input type="number" class="tier-min" min="0" step="any" inputmode="decimal" value="${tier.minAttainmentPct}" />
      </label>
      <label>
        <span>Multiplier</span>
        <input type="number" class="tier-multiplier" min="0" step="any" inputmode="decimal" value="${tier.multiplier}" />
      </label>
      <button type="button" class="tier-remove" title="Remove tier" aria-label="Remove tier">&times;</button>
    `;
    row.querySelector('.tier-remove').addEventListener('click', () => {
      row.remove();
      updateTierRemoveState();
    });
    return row;
  }

  function updateTierRemoveState() {
    const rows = tiersList.querySelectorAll('.tier-row');
    rows.forEach((row) => {
      row.querySelector('.tier-remove').disabled = rows.length <= 1;
    });
  }

  function renderTiers(tiers) {
    tiersList.innerHTML = '';
    tiers.forEach((tier, i) => tiersList.appendChild(renderTierRow(tier, i)));
    updateTierRemoveState();
  }

  function readTiersFromForm() {
    return [...tiersList.querySelectorAll('.tier-row')].map((row) => ({
      minAttainmentPct: parseFloat(row.querySelector('.tier-min').value),
      multiplier: parseFloat(row.querySelector('.tier-multiplier').value),
    }));
  }

  addTierBtn.addEventListener('click', () => {
    const nextIndex = tiersList.querySelectorAll('.tier-row').length;
    tiersList.appendChild(renderTierRow({ minAttainmentPct: 0, multiplier: 1 }, nextIndex));
    updateTierRemoveState();
  });

  // ------------------------------------------------------------ plan form

  function renderPlan(plan) {
    document.getElementById('quota').value = plan.quota;
    document.getElementById('priorAttainment').value = plan.priorAttainment;
    document.getElementById('baseCommissionRate').value = plan.baseCommissionRate;
    document.getElementById('tcvCreditPct').value = plan.tcvCreditPct;
    document.getElementById('deductionPct').value = plan.deductionPct;
    document.getElementById('renewalRatePct').value = plan.renewalRatePct;
    document.getElementById('oyNbMultiplier').value = plan.oyNbMultiplier;
    renderTiers(plan.tiers);
  }

  function readPlanFromForm() {
    return {
      quota: parseFloat(document.getElementById('quota').value),
      priorAttainment: parseFloat(document.getElementById('priorAttainment').value),
      baseCommissionRate: parseFloat(document.getElementById('baseCommissionRate').value),
      tcvCreditPct: parseFloat(document.getElementById('tcvCreditPct').value),
      deductionPct: parseFloat(document.getElementById('deductionPct').value),
      renewalRatePct: parseFloat(document.getElementById('renewalRatePct').value),
      oyNbMultiplier: parseFloat(document.getElementById('oyNbMultiplier').value),
      tiers: readTiersFromForm(),
    };
  }

  function showErrors(container, errors) {
    if (errors.length === 0) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = `<ul>${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  planForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const plan = readPlanFromForm();
    const errors = validatePlan(plan);
    showErrors(planErrorsEl, errors);
    if (errors.length > 0) {
      saveStatusEl.textContent = '';
      return;
    }
    savePlan(plan);
    saveStatusEl.textContent = 'Saved ✓';
    setTimeout(() => {
      if (saveStatusEl.textContent === 'Saved ✓') saveStatusEl.textContent = '';
    }, 2500);
  });

  resetPlanBtn.addEventListener('click', () => {
    const plan = defaultPlan();
    renderPlan(plan);
    savePlan(plan);
    showErrors(planErrorsEl, []);
    saveStatusEl.textContent = 'Reset to defaults';
    setTimeout(() => {
      if (saveStatusEl.textContent === 'Reset to defaults') saveStatusEl.textContent = '';
    }, 2500);
  });

  // ------------------------------------------------------------ deal form

  function updateDealFieldsForType() {
    const dealType = dealTypeEl.value;
    acvLabelEl.textContent = ACV_LABELS[dealType];
    tcvFieldEl.hidden = dealType !== 'newBusiness';
  }

  dealTypeEl.addEventListener('change', updateDealFieldsForType);

  // -------------------------------------------------------- out-year lines

  function renderTcvLineRow(value) {
    const row = document.createElement('div');
    row.className = 'tcv-line-row';
    row.innerHTML = `
      <label>
        <span>Out-year value (USD $)</span>
        <input type="number" class="tcv-line-value" min="0" step="any" inputmode="decimal" value="${value}" />
      </label>
      <button type="button" class="tier-remove" title="Remove line" aria-label="Remove line">&times;</button>
    `;
    row.querySelector('.tcv-line-value').addEventListener('input', updateTcvTotal);
    row.querySelector('.tier-remove').addEventListener('click', () => {
      row.remove();
      updateTcvTotal();
    });
    return row;
  }

  addTcvLineBtn.addEventListener('click', () => {
    tcvLinesListEl.appendChild(renderTcvLineRow(0));
    updateTcvTotal();
  });

  acvInputEl.addEventListener('input', updateTcvTotal);

  function readTcvLines() {
    return [...tcvLinesListEl.querySelectorAll('.tcv-line-value')].map((el) => parseFloat(el.value));
  }

  function computeTotalTcv() {
    const acv = parseFloat(acvInputEl.value);
    const lines = readTcvLines();
    const validAcv = Number.isFinite(acv) ? acv : 0;
    const linesSum = lines.reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0);
    return validAcv + linesSum;
  }

  function updateTcvTotal() {
    tcvTotalValueEl.textContent = formatUSD2(computeTotalTcv());
  }

  function readDealFromForm() {
    const dealType = dealTypeEl.value;
    return {
      dealType,
      acv: parseFloat(acvInputEl.value),
      tcv: dealType === 'newBusiness' ? computeTotalTcv() : undefined,
    };
  }

  function renderBreakdown(plan, deal, r) {
    let items;

    if (r.dealType === 'renewal') {
      items = [
        `Renewal ACV (USD): <span class="mono">${formatUSD2(r.commissionableValue)}</span>`,
        `Flat renewal rate: <span class="mono">${formatPct(r.ratePct)}</span> (no tiers or acceleration)`,
        `Gross commission (GBP): ${formatUSD2(r.commissionableValue)} &times; ${formatPct(r.ratePct)} = <span class="mono">${formatGBP2(r.grossCommission)}</span>`,
        `Deductions (GBP): ${formatGBP2(r.grossCommission)} &times; ${formatPct(plan.deductionPct)} = <span class="mono">${formatGBP2(r.deductionAmount)}</span>`,
        `Net commission (GBP): ${formatGBP2(r.grossCommission)} &minus; ${formatGBP2(r.deductionAmount)} = <span class="mono">${formatGBP2(r.netCommission)}</span>`,
      ];
    } else if (r.dealType === 'oyNb') {
      items = [
        `Out-year ACV (USD): <span class="mono">${formatUSD2(r.commissionableValue)}</span>`,
        `Effective rate: BCR ${formatPct(plan.baseCommissionRate)} &times; ${r.multiplier}&times; OY multiplier = <span class="mono">${formatPct(r.ratePct)}</span> (no tiers or acceleration)`,
        `Gross commission (GBP): ${formatUSD2(r.commissionableValue)} &times; ${formatPct(r.ratePct)} = <span class="mono">${formatGBP2(r.grossCommission)}</span>`,
        `Deductions (GBP): ${formatGBP2(r.grossCommission)} &times; ${formatPct(plan.deductionPct)} = <span class="mono">${formatGBP2(r.deductionAmount)}</span>`,
        `Net commission (GBP): ${formatGBP2(r.grossCommission)} &minus; ${formatGBP2(r.deductionAmount)} = <span class="mono">${formatGBP2(r.netCommission)}</span>`,
      ];
    } else {
      const outYearLines = readTcvLines().filter((v) => Number.isFinite(v) && v > 0);
      items = [];
      if (outYearLines.length > 0) {
        items.push(
          `Out-year value lines (USD): ${outYearLines.map((v) => formatUSD(v)).join(' + ')} = <span class="mono">${formatUSD(outYearLines.reduce((a, b) => a + b, 0))}</span>`
        );
      }
      items.push(
        `Total TCV (USD): ${formatUSD(deal.acv)} ACV + ${formatUSD(deal.tcv - deal.acv)} out-year = <span class="mono">${formatUSD(deal.tcv)}</span>`,
        `TCV uplift beyond ACV (USD): ${formatUSD(deal.tcv)} &minus; ${formatUSD(deal.acv)} = <span class="mono">${formatUSD(r.tcvUplift)}</span>`,
        `TCV credited at ${formatPct(plan.tcvCreditPct)} (USD): <span class="mono">${formatUSD2(r.tcvCredited)}</span>`,
        `Commissionable value (USD): ${formatUSD(deal.acv)} + ${formatUSD2(r.tcvCredited)} = <span class="mono">${formatUSD2(r.commissionableValue)}</span>`,
        `Attainment before this deal: ${formatUSD(r.attainmentBefore)} &divide; ${formatUSD(plan.quota)} quota = <span class="mono">${formatPct(r.attainmentPctBefore)}</span>`,
        `Attainment after this deal: ${formatUSD(r.attainmentAfter)} &divide; ${formatUSD(plan.quota)} quota = <span class="mono">${formatPct(r.attainmentPctAfter)}</span>`,
        `Graduated across ${r.segments.length} tier${r.segments.length === 1 ? '' : 's'} (each USD dollar of this deal is taxed at the band it falls in, producing a GBP commission figure):`
      );
      r.segments.forEach((seg) => {
        const maxLabel = seg.maxAttainmentPct === Infinity ? '∞' : formatPct(seg.maxAttainmentPct);
        items.push(
          `&nbsp;&nbsp;${formatPct(seg.minAttainmentPct)}&ndash;${maxLabel} tier (${seg.multiplier}&times;, rate ${formatPct(seg.ratePct)}): ${formatUSD2(seg.width)} &times; ${formatPct(seg.ratePct)} = <span class="mono">${formatGBP2(seg.commission)}</span>`
        );
      });
      items.push(
        `Gross commission (sum of tiers, GBP): <span class="mono">${formatGBP2(r.grossCommission)}</span>`,
        `Deductions (GBP): ${formatGBP2(r.grossCommission)} &times; ${formatPct(plan.deductionPct)} = <span class="mono">${formatGBP2(r.deductionAmount)}</span>`,
        `Net commission (GBP): ${formatGBP2(r.grossCommission)} &minus; ${formatGBP2(r.deductionAmount)} = <span class="mono">${formatGBP2(r.netCommission)}</span>`
      );
    }

    breakdownListEl.innerHTML = items.map((i) => `<li>${i}</li>`).join('');
  }

  // Year 1 is this deal's New Business ACV commission (already computed as
  // `r`). Year 2+ is each out-year TCV line, paid annually — each one priced
  // via the same Out-Year New Business calculation as the standalone OY NB
  // deal type, just reused per line instead of typed in one at a time.
  function renderYearBreakdown(plan, deal, r, outYearLines) {
    if (outYearLines.length === 0) {
      yearBreakdownSectionEl.hidden = true;
      yearBreakdownListEl.innerHTML = '';
      return;
    }

    const rows = [
      {
        label: `Year 1 &mdash; New Business ACV (${formatUSD(deal.acv)})`,
        gross: r.grossCommission,
        net: r.netCommission,
      },
      ...outYearLines.map((value, i) => {
        const oyResult = calculateCommission(plan, { dealType: 'oyNb', acv: value });
        return {
          label: `Year ${i + 2} &mdash; Out-Year New Business (${formatUSD(value)})`,
          gross: oyResult.grossCommission,
          net: oyResult.netCommission,
        };
      }),
    ];

    const totalGross = rows.reduce((sum, row) => sum + row.gross, 0);
    const totalNet = rows.reduce((sum, row) => sum + row.net, 0);

    const rowHtml = (row, extraClass = '') => `
      <div class="year-row ${extraClass}">
        <span class="year-label">${row.label}</span>
        <span class="year-amounts">Gross ${formatGBP2(row.gross)} &middot; Net ${formatGBP2(row.net)}</span>
      </div>
    `;

    yearBreakdownListEl.innerHTML =
      rows.map((row) => rowHtml(row)).join('') +
      rowHtml({ label: 'Total across all years', gross: totalGross, net: totalNet }, 'year-row-total');

    yearBreakdownSectionEl.hidden = false;
  }

  dealForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const plan = readPlanFromForm();
    const planErrors = validatePlan(plan);
    const deal = readDealFromForm();
    const dealErrors = validateDeal(deal);

    showErrors(planErrorsEl, planErrors);
    showErrors(dealErrorsEl, dealErrors);

    if (planErrors.length > 0 || dealErrors.length > 0) {
      resultsEl.hidden = true;
      return;
    }

    const r = calculateCommission(plan, deal);
    resultGrossEl.textContent = formatGBP2(r.grossCommission);
    resultNetEl.textContent = formatGBP2(r.netCommission);
    renderBreakdown(plan, deal, r);

    const outYearLines = deal.dealType === 'newBusiness' ? readTcvLines().filter((v) => Number.isFinite(v) && v > 0) : [];
    renderYearBreakdown(plan, deal, r, outYearLines);

    resultsEl.hidden = false;
  });

  // ---------------------------------------------------------------- init

  renderPlan(loadPlan());
  updateDealFieldsForType();
  updateTcvTotal();
})();
