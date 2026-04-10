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
  await loadRekapan();

  $("#filterYear")
    .off("change")
    .on("change", async function () {
      await loadRekapan();
    });

  $("#filterYear").select2({
    width: "100%"
  });
}

// ================= UTIL =================
function formatNumber(val) {
  if (!val || isNaN(val)) return "-";
  return "Rp " + Number(val).toLocaleString("id-ID");
}

function getMonthIndex(date) {
  return new Date(date).getMonth(); // 0-11
}

// ================= LOAD TAHUN =================
async function loadYears() {

  const { data, error } = await supabase
    .from("deals_search")
    .select("deal_date");

  if (error) {
    console.error(error);
    return;
  }

  const years = [...new Set(
    data
      .filter(d => d.deal_date)
      .map(d => new Date(d.deal_date).getFullYear())
  )].sort((a, b) => b - a);

  $("#filterYear").empty().append(`<option value=""></option>`);

  years.forEach(y => {
    $("#filterYear").append(`<option value="${y}">${y}</option>`);
  });

  // auto pilih tahun terbaru
  if (years.length) {
    $("#filterYear").val(years[0]).trigger("change");
  }
}

// ================= LOAD REKAP =================
async function loadRekapan() {

  let query = supabase
    .from("deals_search")
    .select("*");

  const year = $("#filterYear").val();

  if (year) {
    query = query
      .gte("deal_date", `${year}-01-01`)
      .lte("deal_date", `${year}-12-31`);
  }

  const { data, error } = await query;

  if (error) {
    console.error(error);
    return;
  }

  buildRekapKOL(data);
  buildRekapAdmin(data);
  buildRekapAgency(data);
}

// ================= REKAP KOL =================
function buildRekapKOL(data) {

  let map = {};
  let monthlyTotal = Array(12).fill(0);

  data.forEach(d => {

    if (!d.kol_name) return;

    const month = getMonthIndex(d.deal_date);
    const fee = Number(d.kol_fee) || 0;

    if (!map[d.kol_name]) {
      map[d.kol_name] = Array(12).fill(0);
    }

    map[d.kol_name][month] += fee;
    monthlyTotal[month] += fee;
  });

  // SORT by total terbesar
  const sorted = Object.entries(map).sort((a, b) => {
    const sumA = a[1].reduce((x, y) => x + y, 0);
    const sumB = b[1].reduce((x, y) => x + y, 0);
    return sumB - sumA;
  });

  const tbody = $("#rekapKolTable tbody");
  tbody.empty();

  sorted.forEach(([name, months]) => {

    let row = `<tr>
      <td class="sticky-col">${name}</td>`;

    months.forEach(v => {
      row += `<td>${v ? formatNumber(v) : "-"}</td>`;
    });

    row += `</tr>`;
    tbody.append(row);
  });

  // FOOTER TOTAL
  const footer = $("#rekapKolTotal th:not(:first)");
  footer.each(function (i) {
    $(this).text(monthlyTotal[i] ? formatNumber(monthlyTotal[i]) : "-");
  });
}

// ================= REKAP ADMIN =================
function buildRekapAdmin(data) {

  let map = {};
  let monthlyTotal = Array(12).fill(0);

  data.forEach(d => {

    if (!d.admin_name || d.admin_name === "Admin") return;

    const month = getMonthIndex(d.deal_date);
    const fee = Number(d.admin_fee) || 0;

    if (!map[d.admin_name]) {
      map[d.admin_name] = Array(12).fill(0);
    }

    map[d.admin_name][month] += fee;
    monthlyTotal[month] += fee;
  });

  // SORT
  const sorted = Object.entries(map).sort((a, b) => {
    const sumA = a[1].reduce((x, y) => x + y, 0);
    const sumB = b[1].reduce((x, y) => x + y, 0);
    return sumB - sumA;
  });

  const tbody = $("#rekapAdminTable tbody");
  tbody.empty();

  sorted.forEach(([name, months]) => {

    let row = `<tr>
      <td class="sticky-col">${name}</td>`;

    months.forEach(v => {
      row += `<td>${v ? formatNumber(v) : "-"}</td>`;
    });

    row += `</tr>`;
    tbody.append(row);
  });

  // FOOTER
  const footer = $("#rekapAdminTotal th:not(:first)");
  footer.each(function (i) {
    $(this).text(monthlyTotal[i] ? formatNumber(monthlyTotal[i]) : "-");
  });
}

// ================= REKAP AGENCY =================
function buildRekapAgency(data) {

  let monthly = Array(12).fill(0);

  data.forEach(d => {
    const month = getMonthIndex(d.deal_date);
    const fee = Number(d.agency_fee) || 0;
    monthly[month] += fee;
  });

  const row = $("#rekapAgencyRow td:not(:first)");

  row.each(function (i) {
    $(this).text(monthly[i] ? formatNumber(monthly[i]) : "-");
  });
}
