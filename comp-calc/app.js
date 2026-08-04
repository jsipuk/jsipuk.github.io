/* UI wiring for the commission calculator: reads/writes the DOM and
 * localStorage, and delegates all maths to calc.js (window.CommissionCalc).
 * Keep calculation logic out of this file — it belongs in calc.js.
 */
(() => {
  const STORAGE_KEY = 'comp-calc:plan';
  const { emptyPlan, examplePlan, isEmptyPlan, validatePlan, validateDeal, calculateCommission } = window.CommissionCalc;

  const planForm = document.getElementById('plan-form');
  const dealForm = document.getElementById('deal-form');
  const tiersList = document.getElementById('tiers-list');
  const addTierBtn = document.getElementById('add-tier');
  const loadExampleBtn = document.getElementById('load-example');
  const clearPlanBtn = document.getElementById('clear-plan');
  const emptyPlanHintEl = document.getElementById('empty-plan-hint');
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

  // Large dollar-amount fields (quota, attainment, ACV, out-year lines) get
  // live thousands-separator formatting as you type. type="number" inputs
  // can't display commas at all, so these fields are plain text inputs
  // instead — formatThousands() re-renders on every keystroke and
  // parseFormattedNumber() strips the commas back out before any maths runs.
  function formatThousands(raw) {
    if (typeof raw !== 'string') return '';
    const [rawInt, ...rest] = raw.replace(/[^\d.]/g, '').split('.');
    const intPart = rawInt.replace(/^0+(?=\d)/, '');
    const decPart = rest.length > 0 ? '.' + rest.join('') : '';
    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return withCommas + decPart;
  }

  function parseFormattedNumber(raw) {
    if (typeof raw !== 'string') return NaN;
    const cleaned = raw.replace(/,/g, '').trim();
    if (cleaned === '' || cleaned === '.') return NaN;
    return parseFloat(cleaned);
  }

  function setThousandsValue(input, value) {
    input.value = Number.isFinite(value) ? formatThousands(String(value)) : '';
  }

  function attachThousandsFormatting(input) {
    input.addEventListener('input', () => {
      const prevValue = input.value;
      const prevCursor = input.selectionStart;
      const digitsBeforeCursor = prevValue.slice(0, prevCursor).replace(/[^\d.]/g, '').length;

      input.value = formatThousands(prevValue);

      if (digitsBeforeCursor === 0) {
        input.setSelectionRange(0, 0);
        return;
      }
      let seen = 0;
      let newCursor = input.value.length;
      for (let i = 0; i < input.value.length; i++) {
        if (/[\d.]/.test(input.value[i])) seen++;
        if (seen === digitsBeforeCursor) {
          newCursor = i + 1;
          break;
        }
      }
      input.setSelectionRange(newCursor, newCursor);
    });
  }

  const ACV_LABELS = {
    newBusiness: 'ACV — Annual Contract Value (USD $)',
    renewal: 'Renewal ACV (USD $)',
    oyNb: 'Out-year ACV (USD $)',
  };

  // ---------------------------------------------------------------- storage

  // The stored value is a SecureStore envelope, the same format Ground uses:
  // { app, v, enc:false, data } when unprotected, or { app, v, enc:true, kdf,
  // iter, salt, iv, ct } when a passphrase is set. Protecting the plan is
  // opt-in per browser, which is exactly what the envelope's `enc` flag is
  // for. Plans saved before encryption existed are bare objects and are
  // re-wrapped on the next save.
  //
  // The key is derived once per unlock and held in memory for the session, so
  // saving does not pay the 600,000 PBKDF2 iterations again.
  let sessionKey = null;
  let sessionSalt = null;
  let sessionIter = null;

  function readStored() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function usablePlan(plan) {
    if (!plan || validatePlan(plan).length > 0) return emptyPlan();
    return plan;
  }

  function isProtected() {
    return SecureStore.isEncrypted(readStored());
  }

  // Writes through whichever envelope the browser is currently using. A
  // session key means the plan is protected and stays protected.
  function savePlan(plan) {
    if (sessionKey) {
      return SecureStore.reseal(plan, sessionKey, sessionSalt, sessionIter).then((env) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(env));
      });
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SecureStore.plainEnvelope(plan)));
    return Promise.resolve();
  }

  function forgetPlan() {
    localStorage.removeItem(STORAGE_KEY);
    sessionKey = null;
    sessionSalt = null;
    sessionIter = null;
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

  // A missing figure renders as an empty box, never as "null" — the first-run
  // plan has every numeric field unset.
  function setNumberValue(id, value) {
    document.getElementById(id).value = Number.isFinite(value) ? value : '';
  }

  function renderPlan(plan) {
    setThousandsValue(document.getElementById('quota'), plan.quota);
    setThousandsValue(document.getElementById('priorAttainment'), plan.priorAttainment);
    setNumberValue('baseCommissionRate', plan.baseCommissionRate);
    setNumberValue('tcvCreditPct', plan.tcvCreditPct);
    setNumberValue('deductionPct', plan.deductionPct);
    setNumberValue('renewalRatePct', plan.renewalRatePct);
    setNumberValue('oyNbMultiplier', plan.oyNbMultiplier);
    renderTiers(plan.tiers);
    emptyPlanHintEl.hidden = !isEmptyPlan(plan);
  }

  function readPlanFromForm() {
    return {
      quota: parseFormattedNumber(document.getElementById('quota').value),
      priorAttainment: parseFormattedNumber(document.getElementById('priorAttainment').value),
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
    savePlan(plan).then(() => {
      emptyPlanHintEl.hidden = true;
      flashStatus(sessionKey ? 'Saved and encrypted ✓' : 'Saved ✓');
    });
  });

  function flashStatus(message) {
    saveStatusEl.textContent = message;
    setTimeout(() => {
      if (saveStatusEl.textContent === message) saveStatusEl.textContent = '';
    }, 2500);
  }

  // Fills the form with the invented example so the shape of a plan is
  // visible. It is not saved until Save plan is clicked.
  loadExampleBtn.addEventListener('click', () => {
    renderPlan(examplePlan());
    showErrors(planErrorsEl, []);
    flashStatus('Example loaded, not saved');
  });

  clearPlanBtn.addEventListener('click', () => {
    renderPlan(emptyPlan());
    forgetPlan();
    showErrors(planErrorsEl, []);
    resultsEl.hidden = true;
    refreshProtectionUi();
    flashStatus('Plan cleared from this browser');
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
        <input type="text" class="tcv-line-value" inputmode="decimal" autocomplete="off" />
      </label>
      <button type="button" class="tier-remove" title="Remove line" aria-label="Remove line">&times;</button>
    `;
    const lineInput = row.querySelector('.tcv-line-value');
    setThousandsValue(lineInput, value);
    attachThousandsFormatting(lineInput);
    lineInput.addEventListener('input', updateTcvTotal);
    row.querySelector('.tier-remove').addEventListener('click', () => {
      row.remove();
      updateTcvTotal();
    });
    return row;
  }

  addTcvLineBtn.addEventListener('click', () => {
    tcvLinesListEl.appendChild(renderTcvLineRow(NaN));
    updateTcvTotal();
  });

  attachThousandsFormatting(acvInputEl);
  acvInputEl.addEventListener('input', updateTcvTotal);

  function readTcvLines() {
    return [...tcvLinesListEl.querySelectorAll('.tcv-line-value')].map((el) => parseFormattedNumber(el.value));
  }

  function computeTotalTcv() {
    const acv = parseFormattedNumber(acvInputEl.value);
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
      acv: parseFormattedNumber(acvInputEl.value),
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

  // ------------------------------------------------------- passphrase lock

  const lockPanelEl = document.getElementById('lock-panel');
  const lockFormEl = document.getElementById('lock-form');
  const lockTitleEl = document.getElementById('lock-title');
  const lockBlurbEl = document.getElementById('lock-blurb');
  const lockPassEl = document.getElementById('lock-pass');
  const lockPass2WrapEl = document.getElementById('lock-pass2-wrap');
  const lockPass2El = document.getElementById('lock-pass2');
  const lockErrEl = document.getElementById('lock-err');
  const lockGoEl = document.getElementById('lock-go');
  const lockCancelEl = document.getElementById('lock-cancel');
  const mainEl = document.querySelector('main.layout');
  const protectBtn = document.getElementById('protect-plan');
  const lockNowBtn = document.getElementById('lock-now');

  // 'unlock' opens existing encrypted storage; 'new' sets a passphrase on the
  // plan currently in the form; 'remove' takes one off again.
  let lockMode = 'unlock';

  function showLock(mode) {
    lockMode = mode;
    lockErrEl.textContent = '';
    lockPassEl.value = '';
    lockPass2El.value = '';
    lockPass2WrapEl.hidden = mode !== 'new';
    lockCancelEl.hidden = mode === 'unlock';

    if (mode === 'unlock') {
      lockTitleEl.textContent = 'This plan is protected';
      lockBlurbEl.textContent = 'Enter the passphrase for this browser to open it. There is no recovery: forget it and the saved plan is gone, though you can always clear it and start again.';
      lockGoEl.textContent = 'Unlock';
    } else if (mode === 'new') {
      lockTitleEl.textContent = 'Protect this plan with a passphrase';
      lockBlurbEl.textContent = 'The plan is encrypted before it is written to this browser, so it cannot be read from storage without the passphrase. At least 8 characters. There is no recovery.';
      lockGoEl.textContent = 'Encrypt and save';
    } else {
      lockTitleEl.textContent = 'Remove the passphrase';
      lockBlurbEl.textContent = 'Confirm the current passphrase. The plan stays saved in this browser, but in plain text, readable by anything that can read this browser profile.';
      lockGoEl.textContent = 'Remove protection';
    }

    lockPanelEl.hidden = false;
    mainEl.hidden = mode === 'unlock';
    lockPassEl.focus();
  }

  function hideLock() {
    lockPanelEl.hidden = true;
    mainEl.hidden = false;
  }

  function refreshProtectionUi() {
    const on = isProtected();
    protectBtn.textContent = on ? 'Remove passphrase' : 'Protect with a passphrase';
    lockNowBtn.hidden = !on;
  }

  lockFormEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const pass = lockPassEl.value;
    lockErrEl.textContent = '';

    if (lockMode === 'unlock') {
      SecureStore.unseal(readStored(), pass)
        .then(({ data, key, salt, iter }) => {
          sessionKey = key;
          sessionSalt = salt;
          sessionIter = iter;
          renderPlan(usablePlan(data));
          hideLock();
          refreshProtectionUi();
        })
        .catch((err) => {
          lockErrEl.textContent = err && /passphrase/i.test(err.message) ? err.message : 'Could not open the saved plan.';
        });
      return;
    }

    if (lockMode === 'new') {
      if (pass.length < 8) {
        lockErrEl.textContent = 'Use at least 8 characters.';
        return;
      }
      if (pass !== lockPass2El.value) {
        lockErrEl.textContent = 'The two passphrases do not match.';
        return;
      }
      const plan = readPlanFromForm();
      SecureStore.seal(plan, pass).then(({ envelope, key, salt, iter }) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
        sessionKey = key;
        sessionSalt = salt;
        sessionIter = iter;
        hideLock();
        refreshProtectionUi();
        emptyPlanHintEl.hidden = true;
        flashStatus('Saved and encrypted ✓');
      });
      return;
    }

    // remove: prove the passphrase before downgrading to plain storage
    SecureStore.unseal(readStored(), pass)
      .then(({ data }) => {
        sessionKey = null;
        sessionSalt = null;
        sessionIter = null;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(SecureStore.plainEnvelope(data)));
        renderPlan(usablePlan(data));
        hideLock();
        refreshProtectionUi();
        flashStatus('Passphrase removed, plan saved in plain text');
      })
      .catch((err) => {
        lockErrEl.textContent = err && /passphrase/i.test(err.message) ? err.message : 'Could not open the saved plan.';
      });
  });

  lockCancelEl.addEventListener('click', () => {
    hideLock();
    refreshProtectionUi();
  });

  protectBtn.addEventListener('click', () => showLock(isProtected() ? 'remove' : 'new'));

  lockNowBtn.addEventListener('click', () => {
    sessionKey = null;
    sessionSalt = null;
    sessionIter = null;
    renderPlan(emptyPlan());
    resultsEl.hidden = true;
    showLock('unlock');
  });

  // ---------------------------------------------------------------- init

  attachThousandsFormatting(document.getElementById('quota'));
  attachThousandsFormatting(document.getElementById('priorAttainment'));

  const stored = readStored();
  if (SecureStore.isEncrypted(stored)) {
    renderPlan(emptyPlan());
    showLock('unlock');
  } else if (SecureStore.isEnvelope(stored)) {
    renderPlan(usablePlan(stored.data));
  } else {
    // null, or a bare plan saved before encryption existed
    renderPlan(usablePlan(stored));
  }
  refreshProtectionUi();

  updateDealFieldsForType();
  updateTcvTotal();
})();
