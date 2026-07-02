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
  const dealTypeEl = document.getElementById('dealType');
  const acvLabelEl = document.getElementById('acv-label');
  const tcvFieldEl = document.getElementById('tcv-field');
  const tcvInputEl = document.getElementById('tcv');

  const currencyFmt = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
  const currencyFmt2 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2 });
  const formatMoney = (n) => currencyFmt.format(n);
  const formatMoney2 = (n) => currencyFmt2.format(n);
  const formatPct = (n) => `${n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}%`;

  const ACV_LABELS = {
    newBusiness: 'ACV — Annual Contract Value',
    renewal: 'Renewal ACV',
    oyNb: 'Out-year ACV',
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
    tcvInputEl.required = dealType === 'newBusiness';
  }

  dealTypeEl.addEventListener('change', updateDealFieldsForType);

  function readDealFromForm() {
    return {
      dealType: dealTypeEl.value,
      acv: parseFloat(document.getElementById('acv').value),
      tcv: parseFloat(tcvInputEl.value),
    };
  }

  function renderBreakdown(plan, deal, r) {
    let items;

    if (r.dealType === 'renewal') {
      items = [
        `Renewal ACV: <span class="mono">${formatMoney2(r.commissionableValue)}</span>`,
        `Flat renewal rate: <span class="mono">${formatPct(r.ratePct)}</span> (no tiers or acceleration)`,
        `Gross commission: ${formatMoney2(r.commissionableValue)} &times; ${formatPct(r.ratePct)} = <span class="mono">${formatMoney2(r.grossCommission)}</span>`,
        `Deductions: ${formatMoney2(r.grossCommission)} &times; ${formatPct(plan.deductionPct)} = <span class="mono">${formatMoney2(r.deductionAmount)}</span>`,
        `Net commission: ${formatMoney2(r.grossCommission)} &minus; ${formatMoney2(r.deductionAmount)} = <span class="mono">${formatMoney2(r.netCommission)}</span>`,
      ];
    } else if (r.dealType === 'oyNb') {
      items = [
        `Out-year ACV: <span class="mono">${formatMoney2(r.commissionableValue)}</span>`,
        `Effective rate: BCR ${formatPct(plan.baseCommissionRate)} &times; ${r.multiplier}&times; OY multiplier = <span class="mono">${formatPct(r.ratePct)}</span> (no tiers or acceleration)`,
        `Gross commission: ${formatMoney2(r.commissionableValue)} &times; ${formatPct(r.ratePct)} = <span class="mono">${formatMoney2(r.grossCommission)}</span>`,
        `Deductions: ${formatMoney2(r.grossCommission)} &times; ${formatPct(plan.deductionPct)} = <span class="mono">${formatMoney2(r.deductionAmount)}</span>`,
        `Net commission: ${formatMoney2(r.grossCommission)} &minus; ${formatMoney2(r.deductionAmount)} = <span class="mono">${formatMoney2(r.netCommission)}</span>`,
      ];
    } else {
      items = [
        `TCV uplift beyond ACV: ${formatMoney(deal.tcv)} &minus; ${formatMoney(deal.acv)} = <span class="mono">${formatMoney(r.tcvUplift)}</span>`,
        `TCV credited at ${formatPct(plan.tcvCreditPct)}: <span class="mono">${formatMoney2(r.tcvCredited)}</span>`,
        `Commissionable value: ${formatMoney(deal.acv)} + ${formatMoney2(r.tcvCredited)} = <span class="mono">${formatMoney2(r.commissionableValue)}</span>`,
        `Attainment before this deal: ${formatMoney(r.attainmentBefore)} &divide; ${formatMoney(plan.quota)} quota = <span class="mono">${formatPct(r.attainmentPctBefore)}</span>`,
        `Attainment after this deal: ${formatMoney(r.attainmentAfter)} &divide; ${formatMoney(plan.quota)} quota = <span class="mono">${formatPct(r.attainmentPctAfter)}</span>`,
        `Graduated across ${r.segments.length} tier${r.segments.length === 1 ? '' : 's'} (each dollar taxed at the band it falls in):`,
      ];
      r.segments.forEach((seg) => {
        const maxLabel = seg.maxAttainmentPct === Infinity ? '∞' : formatPct(seg.maxAttainmentPct);
        items.push(
          `&nbsp;&nbsp;${formatPct(seg.minAttainmentPct)}&ndash;${maxLabel} tier (${seg.multiplier}&times;, rate ${formatPct(seg.ratePct)}): ${formatMoney2(seg.width)} &times; ${formatPct(seg.ratePct)} = <span class="mono">${formatMoney2(seg.commission)}</span>`
        );
      });
      items.push(
        `Gross commission (sum of tiers): <span class="mono">${formatMoney2(r.grossCommission)}</span>`,
        `Deductions: ${formatMoney2(r.grossCommission)} &times; ${formatPct(plan.deductionPct)} = <span class="mono">${formatMoney2(r.deductionAmount)}</span>`,
        `Net commission: ${formatMoney2(r.grossCommission)} &minus; ${formatMoney2(r.deductionAmount)} = <span class="mono">${formatMoney2(r.netCommission)}</span>`
      );
    }

    breakdownListEl.innerHTML = items.map((i) => `<li>${i}</li>`).join('');
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
    resultGrossEl.textContent = formatMoney2(r.grossCommission);
    resultNetEl.textContent = formatMoney2(r.netCommission);
    renderBreakdown(plan, deal, r);
    resultsEl.hidden = false;
  });

  // ---------------------------------------------------------------- init

  renderPlan(loadPlan());
  updateDealFieldsForType();
})();
