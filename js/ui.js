import { element } from '../assets/family/js/workspace.js';
import { calculatePrice } from './logic.js';
import { fetchExchange } from '../assets/family/js/exchange-service.js';
import { createNotifications } from '../assets/family/js/notifications.js';

const usdFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const idrFormat = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
let bufferedRate = null;
let loading = false;
const notifications = createNotifications();
const rows = [];
const body = document.querySelector('#price-table tbody');
for (let index = 0; index < 10; index++) {
  const tr = element('tr'), fields = {};
  for (const key of ['usd', 'bottomIdr', 'year', 'spices', 'spicesIdr', 'seasoning', 'seasoningIdr']) {
    const td = element('td');
    if (key === 'usd' || key === 'year') {
      const input = element('input'); input.type = 'number'; input.min = key === 'usd' ? '0' : '2000';
      input.step = key === 'usd' ? '.01' : '1'; if (key === 'year') input.max = '2100';
      input.setAttribute('aria-label', `${key === 'usd' ? 'Bottom price USD' : 'Year'} row ${index + 1}`);
      input.className = `input-${key}`; fields[key] = input; td.append(input);
    } else { fields[key] = td; td.textContent = '—'; td.className = `output-${key}`; }
    tr.append(td);
  }
  rows.push(fields); body.append(tr);
}

function calculate() {
  let invalid = false;
  for (const row of rows) {
    const usd = parseFloat(row.usd.value), year = parseInt(row.year.value, 10);
    const filled = row.usd.value !== '' || row.year.value !== '';
    const valid = filled && !Number.isNaN(usd) && !Number.isNaN(year);
    row.usd.setAttribute('aria-invalid', String(filled && Number.isNaN(usd)));
    row.year.setAttribute('aria-invalid', String(filled && Number.isNaN(year)));
    if (filled && !valid) invalid = true;
    const result = valid ? calculatePrice(usd, year, new Date().getFullYear(), bufferedRate) : null;
    for (const key of ['bottomIdr', 'spices', 'spicesIdr', 'seasoning', 'seasoningIdr']) {
      row[key].textContent = result?.[key] == null ? '—' : (key.endsWith('Idr') ? idrFormat : usdFormat).format(result[key]);
    }
  }
  const message = document.querySelector('#validation');
  message.hidden = !invalid; message.textContent = 'Fill in both Bottom Price USD and Year for each row you use.';
  if (invalid) notifications.show('Please check the highlighted inputs.', { key: 'validation', tone: 'error' });
  else notifications.dismiss('validation');
}

async function loadRate() {
  if (loading) return;
  loading = true; document.querySelector('#retry-rate').disabled = true;
  const status = document.querySelector('#rate-status'); status.textContent = 'Loading exchange rates…'; status.hidden = false;
  status.removeAttribute('data-tone');
  notifications.dismiss('rate-error');
  try {
    const data = await fetchExchange('today.json', AbortSignal.timeout(30000));
    if (![data.tt_counter_selling_rate, data.tt_counter_selling_rate_buffered].every(value => Number.isFinite(value) && value > 0)) throw new Error('schema');
    bufferedRate = data.tt_counter_selling_rate_buffered;
    document.querySelector('#rate-value').textContent = idrFormat.format(data.tt_counter_selling_rate);
    document.querySelector('#buffered-rate-value').textContent = idrFormat.format(bufferedRate);
    status.hidden = true; calculate();
  } catch {
    status.textContent = 'Exchange rates are unavailable. USD calculations remain available.'; status.dataset.tone = 'error';
    notifications.show('Exchange rates could not be loaded. Use Refresh rates to try again.', { key: 'rate-error', tone: 'error' });
  } finally { loading = false; document.querySelector('#retry-rate').disabled = false; }
}
document.querySelector('#calculate-btn').addEventListener('click', calculate);
document.querySelector('#retry-rate').addEventListener('click', loadRate);
document.querySelector('#reset').addEventListener('click', () => { for (const row of rows) { row.usd.value = ''; row.year.value = ''; } calculate(); rows[0].usd.focus(); });
body.addEventListener('keydown', event => {
  if (event.key === 'Enter') { event.preventDefault(); calculate(); return; }
  const inputs = [...body.querySelectorAll('input')], index = inputs.indexOf(event.target);
  if (index < 0) return;
  const offset = { ArrowDown: 2, ArrowUp: -2, ArrowRight: 1, ArrowLeft: -1 }[event.key];
  if (offset === undefined) return;
  event.preventDefault(); inputs[index + offset]?.focus();
});
loadRate();
