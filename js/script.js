// --- Constants ---
const EXCHANGE_RATE_URL = 'https://budhi-halim.github.io/exchange-rate/data/today.json';
const BUFFER_AMOUNT = 500;
const BUFFER_ROUND = 100;
const NUM_ROWS = 10;
const USD_FORMAT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2
});
const IDR_FORMAT = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});
const GROWTH = {
  spices: 0.005,
  seasoning: 0.015
};
const BUFFER = {
  spices: 0.1,
  seasoning: 0.2
};

// --- DOM Elements ---
const rateValue = document.getElementById('rate-value');
const bufferedRateValue = document.getElementById('buffered-rate-value');
const tableBody = document.querySelector('#price-table tbody');
const alertBox = document.getElementById('alert');
const calculateBtn = document.getElementById('calculate-btn');
const errorMessage = document.getElementById('error-message');
const scrollTopBtn = document.getElementById('scrollTopBtn');
const darkModeToggle = document.getElementById('darkModeToggle');

// --- State ---
let currentRate = null;
let bufferedRate = null;
let fetchingRate = true;

// --- Utility Functions ---
function showAlert(msg) {
  alertBox.textContent = msg;
  alertBox.classList.add('show');
  alertBox.style.display = 'block';
  setTimeout(() => {
    alertBox.classList.remove('show');
    setTimeout(() => {
      alertBox.style.display = 'none';
    }, 400);
  }, 2200);
}

function roundToNearest(val, nearest) {
  return Math.round(val / nearest) * nearest;
}

function roundToDecimal(val, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

function getCurrentYear() {
  return new Date().getFullYear();
}

// --- Table Row Generation ---
function createTableRows() {
  let rows = '';
  for (let i = 0; i < NUM_ROWS; i++) {
    rows += `<tr>
      <td><div class="usd-input-wrapper"><span class="usd-prefix">$</span><input type="number" class="input-usd" min="0" step="0.01" autocomplete="off"></div></td>
      <td class="output-idr">-</td>
      <td><input type="number" class="input-year" min="2000" max="2100" step="1" autocomplete="off"></td>
      <td class="output-spices-usd">-</td>
      <td class="output-spices-idr">-</td>
      <td class="output-seasoning-usd">-</td>
      <td class="output-seasoning-idr">-</td>
    </tr>`;
  }
  tableBody.innerHTML = rows;
}

// --- Calculation Logic ---
function calculateTable(options = { skipIDR: false, onlyIDR: false }) {
  const rows = tableBody.querySelectorAll('tr');
  let valid = true;
  rows.forEach(row => {
    const usdInput = row.querySelector('.input-usd');
    const idrCell = row.querySelector('.output-idr');
    const yearInput = row.querySelector('.input-year');
    const spicesUsdCell = row.querySelector('.output-spices-usd');
    const spicesIdrCell = row.querySelector('.output-spices-idr');
    const seasoningUsdCell = row.querySelector('.output-seasoning-usd');
    const seasoningIdrCell = row.querySelector('.output-seasoning-idr');

    const usd = parseFloat(usdInput.value);
    const year = parseInt(yearInput.value);
    let hasInput = usdInput.value !== '' || yearInput.value !== '';
    if (!hasInput) {
      if (!options.onlyIDR) {
        spicesUsdCell.textContent = '-';
        seasoningUsdCell.textContent = '-';
      }
      if (!options.skipIDR) {
        idrCell.textContent = '-';
        spicesIdrCell.textContent = '-';
        seasoningIdrCell.textContent = '-';
      }
      return;
    }
    if (isNaN(usd) || isNaN(year)) {
      if (!options.onlyIDR) {
        spicesUsdCell.textContent = '-';
        seasoningUsdCell.textContent = '-';
      }
      if (!options.skipIDR) {
        idrCell.textContent = '-';
        spicesIdrCell.textContent = '-';
        seasoningIdrCell.textContent = '-';
      }
      valid = false;
      return;
    }
    const yearDiff = getCurrentYear() - year;
    let spicesUsd = usd * Math.pow(1 + GROWTH.spices, yearDiff > 0 ? yearDiff : 0) * (1 + BUFFER.spices);
    spicesUsd = roundToDecimal(spicesUsd, 1);
    if (!options.onlyIDR) {
      spicesUsdCell.textContent = USD_FORMAT.format(spicesUsd);
      seasoningUsdCell.textContent = USD_FORMAT.format(
        roundToDecimal(
          usd * Math.pow(1 + GROWTH.seasoning, yearDiff > 0 ? yearDiff : 0) * (1 + BUFFER.seasoning),
          1
        )
      );
    }
    if (!options.skipIDR && bufferedRate) {
      const idr = roundToNearest(usd * bufferedRate, 1000);
      idrCell.textContent = IDR_FORMAT.format(idr);
      spicesIdrCell.textContent = IDR_FORMAT.format(roundToNearest(spicesUsd * bufferedRate, 1000));
      let seasoningUsd = usd * Math.pow(1 + GROWTH.seasoning, yearDiff > 0 ? yearDiff : 0) * (1 + BUFFER.seasoning);
      seasoningUsd = roundToDecimal(seasoningUsd, 1);
      seasoningIdrCell.textContent = IDR_FORMAT.format(roundToNearest(seasoningUsd * bufferedRate, 1000));
    } else if (!options.skipIDR) {
      idrCell.textContent = '-';
      spicesIdrCell.textContent = '-';
      seasoningIdrCell.textContent = '-';
    }
  });
  if (!valid) {
    showAlert('Both Bottom Price USD and Year must be filled.');
  }
  return valid;
}

// --- Exchange Rate Fetching ---
async function fetchExchangeRate() {
  try {
    const res = await fetch(EXCHANGE_RATE_URL);
    const data = await res.json();
    currentRate = data.tt_counter_selling_rate;
    bufferedRate = data.tt_counter_selling_rate_buffered;
    rateValue.textContent = IDR_FORMAT.format(currentRate);
    bufferedRateValue.textContent = IDR_FORMAT.format(bufferedRate);
    if (calculateTable({ skipIDR: true })) {
      calculateTable();
    }
  } catch (e) {
    rateValue.textContent = '-';
    bufferedRateValue.textContent = '-';
    errorMessage.textContent = 'Failed to fetch exchange rate. IDR prices unavailable.';
    errorMessage.classList.remove('hidden');
  } finally {
    fetchingRate = false;
  }
}

// --- Event Listeners and Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  createTableRows();
  fetchingRate = true;
  fetchExchangeRate();

  calculateBtn.addEventListener('click', () => {
    if (!bufferedRate || fetchingRate) {
      calculateTable({ skipIDR: true });
    } else {
      calculateTable();
    }
  });

  // Enter key to calculate
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      calculateBtn.click();
    }
  });

  // Arrow key navigation
  tableBody.addEventListener('keydown', e => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const target = e.target;
    if (!target.classList.contains('input-usd') && !target.classList.contains('input-year')) return;

    const inputs = Array.from(document.querySelectorAll('.input-usd, .input-year'));
    const index = inputs.indexOf(target);
    let nextIndex;

    switch (e.key) {
      case 'ArrowUp':
        nextIndex = index - 2;
        break;
      case 'ArrowDown':
        nextIndex = index + 2;
        break;
      case 'ArrowLeft':
        nextIndex = index - 1;
        break;
      case 'ArrowRight':
        nextIndex = index + 1;
        break;
    }

    if (nextIndex >= 0 && nextIndex < inputs.length) {
      inputs[nextIndex].focus();
    }
  });

  // Scroll to top button
  window.addEventListener('scroll', () => {
    if (window.scrollY > window.innerHeight) {
      scrollTopBtn.classList.add('show');
    } else {
      scrollTopBtn.classList.remove('show');
    }
  });

  scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Dark mode logic
  const colorSchemeMedia = window.matchMedia('(prefers-color-scheme: dark)');

  if (colorSchemeMedia.matches) {
    document.body.classList.add('dark');
    if (darkModeToggle) darkModeToggle.checked = true;
  } else {
    document.body.classList.remove('dark');
    if (darkModeToggle) darkModeToggle.checked = false;
  }

  function applySystemPreference() {
    const isDark = colorSchemeMedia.matches;
    const darkToggleContainer = document.querySelector('.darkmode-toggle');
    const isToggleVisible = darkToggleContainer && window.getComputedStyle(darkToggleContainer).display !== 'none';

    if (!isToggleVisible) {
      document.body.classList.toggle('dark', isDark);
      if (darkModeToggle) darkModeToggle.checked = isDark;
    }
  }

  colorSchemeMedia.addEventListener('change', applySystemPreference);
  window.addEventListener('resize', applySystemPreference);

  if (darkModeToggle) {
    darkModeToggle.addEventListener('change', () => {
      document.body.classList.toggle('dark', darkModeToggle.checked);
    });
  }
});