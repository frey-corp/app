
import { supabase } from "../supabase.js";
import { getCurrentUser } from "../app.js";

let currentUser;

// ================= INIT =================
export async function init() {

  currentUser = getCurrentUser();

  if (!currentUser) {
    console.warn("User belum login");
    return;
  }

  $("#rekapanPage").removeClass("d-none");

  await loadYears();
  await loadRekapanAmount();
  await loadRekapanFee();

  $("#filterYear, #filterStatus")
    .off("change")
    .on("change", async function () {
      await loadRekapanAmount();
      await loadRekapanFee();
    });

  $("#downloadExcel").off("click").on("click", downloadExcel);

  $("#filterYear, #filterStatus").select2({
    width: "100%"
  });
}

// ================= UTIL =================
function formatNumber(val) {
  if (!val || isNaN(val)) return "-";
  return "Rp " + Number(val).toLocaleString("id-ID");
}

function getMonthIndex(date) {
  return new Date(date).getMonth();
}

function getMonthName() {
  return ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
}

// ================= LOAD TAHUN =================
async function loadYears() {

  const { data, error } = await supabase
    .from("deals_search")
    .select("deal_date");

  if (error) return console.error(error);

  const years = [...new Set(
    data
      .filter(d => d.deal_date)
      .map(d => new Date(d.deal_date).getFullYear())
  )].sort((a, b) => b - a);

  years.forEach(y => {
    $("#filterYear").append(`<option value="${y}">${y}</option>`);
  });

  if (years.length) {
    $("#filterYear").val(years[0]).trigger("change");
  }
}

// ================= LOAD AMOUNT =================
async function loadRekapanAmount() {

  let query = supabase
    .from("deals_search")
    .select(`
      deal_date,
      status,
      kol_name,
      amount_dealing
    `);

  const year = $("#filterYear").val();
  const status = $("#filterStatus").val();

  if (year) {
    query = query
      .gte("deal_date", `${year}-01-01`)
      .lte("deal_date", `${year}-12-31`);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return console.error(error);

  buildRekapAmount(data);

  await loadRekapanFeeForChart(data);
}

// ================= LOAD FEE =================
async function loadRekapanFee() {

  let query = supabase
    .from("deals_search")
    .select(`
      transfer_date,
      status,
      kol_name,
      admin_name,
      kol_fee,
      admin_fee,
      iu_fee,
      agency_fee
    `);

  const year = $("#filterYear").val();
  const status = $("#filterStatus").val();

  if (year) {
    query = query
      .gte("transfer_date", `${year}-01-01`)
      .lte("transfer_date", `${year}-12-31`);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return console.error(error);

  buildRekapKOL(data);
  buildRekapAdmin(data);
  buildRekapIu(data);
  buildRekapAgency(data);
}

// ================= HELPER =================
function initMonthArray() {
  return Array(12).fill(0);
}

function sortByName(map) {
  return Object.entries(map)
    .sort((a, b) => a[0].localeCompare(b[0]));
}

function appendRow(tbody, name, months) {
  let row = `<tr>
    <td class="sticky-col">${name}</td>`;

  months.forEach(v => {
    row += `<td>${v ? formatNumber(v) : "-"}</td>`;
  });

  row += `</tr>`;
  tbody.append(row);
}

function renderTotalRow(selector, monthlyTotal) {
  $(`${selector} th:not(:first)`).each(function(i){
    $(this).text(monthlyTotal[i] ? formatNumber(monthlyTotal[i]) : "-");
  });
}

// ================= BUILD AMOUNT =================
function buildRekapAmount(data) {

  let map = {};
  let monthlyTotal = initMonthArray();

  data.forEach(d => {
    if (!d.kol_name) return;

    const m = getMonthIndex(d.deal_date);
    const val = Number(d.amount_dealing) || 0;

    if (!map[d.kol_name]) map[d.kol_name] = initMonthArray();

    map[d.kol_name][m] += val;
    monthlyTotal[m] += val;
  });

  const tbody = $("#rekapAmountTable tbody");
  tbody.empty();

  sortByName(map).forEach(([name, months]) => {
    appendRow(tbody, name, months);
  });

  renderTotalRow("#rekapAmountTotal", monthlyTotal);
}


// ================= BUILD KOL =================
function buildRekapKOL(data) {

  let map = {};
  let monthlyTotal = initMonthArray();

  data.forEach(d => {
    if (!d.kol_name) return;

    const m = getMonthIndex(d.transfer_date);
    const val = Number(d.kol_fee) || 0;

    if (!map[d.kol_name]) map[d.kol_name] = initMonthArray();

    map[d.kol_name][m] += val;
    monthlyTotal[m] += val;
  });

  const tbody = $("#rekapKolTable tbody");
  tbody.empty();

  sortByName(map).forEach(([name, months]) => {
    appendRow(tbody, name, months);
  });

  renderTotalRow("#rekapKolTotal", monthlyTotal);
}


// ================= BUILD ADMIN =================
function buildRekapAdmin(data) {

  let map = {};
  let monthlyTotal = initMonthArray();

  data.forEach(d => {
    if (!d.admin_name || d.admin_name === "Admin") return;

    const m = getMonthIndex(d.transfer_date);
    const val = Number(d.admin_fee) || 0;

    if (!map[d.admin_name]) map[d.admin_name] = initMonthArray();

    map[d.admin_name][m] += val;
    monthlyTotal[m] += val;
  });

  const tbody = $("#rekapAdminTable tbody");
  tbody.empty();

  sortByName(map).forEach(([name, months]) => {
    appendRow(tbody, name, months);
  });

  renderTotalRow("#rekapAdminTotal", monthlyTotal);
}

// ================= BUILD IU =================
function buildRekapIu(data) {

  let monthlyTotal = initMonthArray();

  data.forEach(d => {
    const m = getMonthIndex(d.transfer_date);
    const val = Number(d.iu_fee) || 0;
    monthlyTotal[m] += val;
  });

  $("#rekapIuRow td:not(:first)").each(function(i){
    $(this).text(monthlyTotal[i] ? formatNumber(monthlyTotal[i]) : "-");
  });
}

// ================= BUILD AGENCY =================
function buildRekapAgency(data) {

  let monthlyTotal = initMonthArray();

  data.forEach(d => {
    const m = getMonthIndex(d.transfer_date);
    const val = Number(d.agency_fee) || 0;
    monthlyTotal[m] += val;
  });

  $("#rekapAgencyRow td:not(:first)").each(function(i){
    $(this).text(monthlyTotal[i] ? formatNumber(monthlyTotal[i]) : "-");
  });
}

// ================= CHART (UPDATED) =================
function buildChart(dataAmount, dataFee) {

  let monthlyAmount = Array(12).fill(0);
  let monthlyKOL = Array(12).fill(0);

  dataAmount.forEach(d => {
    if (!d.kol_name) return;
    const m = getMonthIndex(d.deal_date);
    monthlyAmount[m] += Number(d.amount_dealing) || 0;
  });

  dataFee.forEach(d => {
    if (!d.kol_name) return;
    const m = getMonthIndex(d.transfer_date);
    monthlyKOL[m] += Number(d.kol_fee) || 0;
  });

  Highcharts.chart("rekapChart", {
    chart: { type: "column" },
    title: { text: "Perbandingan Amount vs KOL Fee" },
    xAxis: { categories: getMonthName() },
    yAxis: { title: { text: "Total (Rp)" } },
    tooltip: {
      shared: true,
      formatter: function () {
        let s = `<b>${this.x}</b>`;
        this.points.forEach(p => {
          s += `<br/>${p.series.name}: <b>${formatNumber(p.y)}</b>`;
        });
        return s;
      }
    },
    series: [
      { name: "Amount", data: monthlyAmount },
      { name: "KOL Fee", data: monthlyKOL }
    ]
  });
}

// ================= AMBIL DATA FEE UNTUK CHART =================
async function loadRekapanFeeForChart(amountData) {

  let query = supabase
    .from("deals_search")
    .select(`
      transfer_date,
      kol_name,
      kol_fee,
      status
    `);

  const year = $("#filterYear").val();
  const status = $("#filterStatus").val();

  if (year) {
    query = query
      .gte("transfer_date", `${year}-01-01`)
      .lte("transfer_date", `${year}-12-31`);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data: feeData, error } = await query;
  if (error) return console.error(error);

  buildChart(amountData, feeData);
}

// ================= DOWNLOAD EXCEL =================
function downloadExcel() {

  let wb = XLSX.utils.book_new();

  $("#rekapAmountTable, #rekapKolTable, #rekapAdminTable, #rekapAgencyTable")
    .each(function (i, table) {

      let ws = XLSX.utils.table_to_sheet(table);
      XLSX.utils.book_append_sheet(wb, ws, `Sheet${i+1}`);
    });

  XLSX.writeFile(wb, "Rekapan.xlsx");
}
