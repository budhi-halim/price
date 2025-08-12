// --- Constants ---
const RATE_SOURCE_URL = 'https://www.bca.co.id/id/informasi/kurs';
const BUFFER_AMOUNT = 500;
const BUFFER_ROUND = 100;
const NUM_ROWS = 10;
const USD_FORMAT = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const IDR_FORMAT = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const GROWTH = {
    'spices': 0.005,
    'seasoning': 0.015
};
const BUFFER = {
    'spices': 0.1,
    'seasoning': 0.2
};

// --- DOM Elements ---
const rateValue = document.getElementById('rate-value');
const bufferedRateValue = document.getElementById('buffered-rate-value');
const tableBody = document.querySelector('#price-table tbody');
const alertBox = document.getElementById('alert');
const calculateBtn = document.getElementById('calculate-btn');

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
        setTimeout(() => { alertBox.style.display = 'none'; }, 400);
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
        }
    });
    if (!valid) {
        showAlert('Both Bottom Price > USD and Year must be filled.');
    }
    return valid;
}

// --- Exchange Rate Fetching ---
async function fetchExchangeRate() {
    try {
        const proxy = 'https://api.allorigins.win/get?url=';
        const url = proxy + encodeURIComponent(RATE_SOURCE_URL);
        const res = await fetch(url);
        const data = await res.json();
        const html = data.contents;
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        let rate = null;
        doc.querySelectorAll('tr').forEach(tr => {
            if (tr.textContent.includes('USD')) {
                const tds = tr.querySelectorAll('td');
                if (tds.length >= 7) {
                    let raw = tds[6].textContent.trim();
                    raw = raw.replace(/[^\d.,]/g, '');
                    raw = raw.replace(/([.,]\d{2})$/, '');
                    raw = raw.replace(/[.,]/g, '');
                    rate = parseInt(raw, 10);
                }
            }
        });
        if (!rate) throw new Error('Rate not found');
        currentRate = rate;
        bufferedRate = roundToNearest(rate + BUFFER_AMOUNT, BUFFER_ROUND);
        rateValue.textContent = (currentRate % 1 === 0)
            ? IDR_FORMAT.format(currentRate)
            : IDR_FORMAT.format(Math.floor(currentRate)) + ' (' + currentRate.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ')';
        bufferedRateValue.textContent = IDR_FORMAT.format(bufferedRate);
        if (calculateTable({ skipIDR: true })) {
            calculateTable();
        }
    } catch (e) {
        rateValue.textContent = '-';
        bufferedRateValue.textContent = '-';
        showAlert('Failed to fetch exchange rate.');
    } finally {
        fetchingRate = false;
    }
}

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
});
