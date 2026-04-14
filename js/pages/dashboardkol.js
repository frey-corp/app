import { supabase } from "../supabase.js";
import { getCurrentUser } from "../app.js";

let chartRevenue = null;
let chartStatus = null;

let currentUser;

export function init() {

    currentUser = getCurrentUser();

    if (!currentUser) {
        Swal.fire("Error", "User not logged in", "error");
        return;
    }

    setDefaultMonthFilter(); 
    loadDashboard();

    ["filterFrom", "filterTo"].forEach(id => {
        document.getElementById(id)?.addEventListener("change", loadDashboard);
    });
}

/* ===============================
   DEFAULT FILTER
================================= */
function setDefaultMonthFilter() {
  const today = new Date();

  const thisMonth = today.toISOString().slice(0, 7);

  const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonth = lastMonthDate.toISOString().slice(0, 7);

  $("#filterFrom").val(lastMonth);
  $("#filterTo").val(thisMonth);
}

function getFilter() {
  return {
    from: document.getElementById("filterFrom")?.value,
    to: document.getElementById("filterTo")?.value
  };
}

/* ===============================
   QUERY HELPERS
================================= */
function applyMonthFilter(query, field, from, to) {

  if (from) {
    query = query.gte(field, from + "-01");
  }

  if (to) {
    const endDate = new Date(to + "-01");
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(0);

    query = query.lte(field, endDate.toISOString().split("T")[0]);
  }

  return query;
}

/* ===============================
   1. DEAL DATA (DEAL DATE)
================================= */
async function getDealsByDealDate() {

  const { from, to } = getFilter();

  let query = supabase.from("deals").select("*");

  query = applyMonthFilter(query, "deal_date", from, to);

  query.eq("kol_user_id", currentUser.id);

  const { data, error } = await query;

  if (error) {
    console.error(error);
    return [];
  }

  return data || [];
}

/* ===============================
   2. SUDAH TF (TRANSFER DATE)
================================= */
async function getTransferredDeals() {

  const { from, to } = getFilter();

  let query = supabase.from("deals").select("*");

  query = applyMonthFilter(query, "transfer_date", from, to);

  query.not("transfer_date", "is", null);

  query.eq("kol_user_id", currentUser.id);

  const { data, error } = await query;

  if (error) {
    console.error(error);
    return [];
  }

  return data || [];
}

/* ===============================
   3. BELUM TF
================================= */
async function getUntransferredDeals() {

  const { from, to } = getFilter();

  let query = supabase.from("deals").select("*");

  query = applyMonthFilter(query, "deal_date", from, to);

  query.is("transfer_date", null);

  query.eq("kol_user_id", currentUser.id);

  const { data, error } = await query;

  if (error) {
    console.error(error);
    return [];
  }

  return data || [];
}

/* ===============================
   LOAD DASHBOARD
================================= */
async function loadDashboard() {

  const dealData = await getDealsByDealDate();
  const transferred = await getTransferredDeals();
  const untransferred = await getUntransferredDeals();

  generateKPI(dealData, transferred, untransferred);
  generateRevenueChart(transferred);
  generateStatusChart(dealData);
}

/* ===============================
   KPI
================================= */
function generateKPI(dealData, transferred, untransferred) {

  let totalDeal = 0;

  let kolTF = 0;
  let kolBelum = 0;

  let agencyTF = 0;
  let agencyBelum = 0;

  let onProgress = 0;
  let finish = 0;

  // DEAL
  dealData.forEach(d => {
    totalDeal += Number(d.amount_dealing || 0);

    if (d.status === "ON_PROGRESS") onProgress++;
    if (d.status === "FINISH") finish++;
  });

  // SUDAH TF
  transferred.forEach(d => {
    const agency =
      Number(d.admin_fee || 0) +
      Number(d.admin_fee_2 || 0) +
      Number(d.agency_fee || 0) +
      Number(d.iu_fee || 0);

    kolTF += Number(d.kol_fee || 0);
    agencyTF += agency;
  });

  // BELUM TF
  untransferred.forEach(d => {
    const agency =
      Number(d.admin_fee || 0) +
      Number(d.admin_fee_2 || 0) +
      Number(d.agency_fee || 0) +
      Number(d.iu_fee || 0);

    kolBelum += Number(d.kol_fee || 0);
    agencyBelum += agency;
  });

  const totalDealsCount = dealData.length;

  const conversionRate = totalDealsCount
    ? (finish / totalDealsCount) * 100
    : 0;

  const container = document.getElementById("kpiContainer");
  if (!container) return;

  container.innerHTML = `

    <!-- TOTAL DEAL FULL -->
    <div class="col-12 mb-3">
      <div class="card shadow-sm">
        <div class="card-body text-center">
          <small>Total Deal</small>
          <h4 class="fw-bold">Rp ${format(totalDeal)}</h4>
        </div>
      </div>
    </div>

    <!-- KOL FEE -->
    ${card("KOL Fee (Sudah TF)", kolTF)}
    ${card("KOL Fee (Belum TF)", kolBelum)}

    <!-- AGENCY FEE -->
    ${card("Agency Fee (Sudah TF)", agencyTF)}
    ${card("Agency Fee (Belum TF)", agencyBelum)}

    <!-- STATUS -->
    ${card("On Progress", onProgress, false)}

    <!-- FINISH + CONVERSION -->
    <div class="col-6 mb-3">
      <div class="card shadow-sm h-100">
        <div class="card-body d-flex justify-content-between align-items-center">

          <div>
            <small>Finish</small>
            <h5 class="fw-bold mb-0">${finish}</h5>
          </div>

          <div class="text-end">
            <small>Conversion Rate</small>
            <h5 class="fw-bold text-success mb-0">
              ${conversionRate.toFixed(1)}%
            </h5>
          </div>

        </div>
      </div>
    </div>
  `;
}

function card(title, value, isCurrency = true) {
  return `
    <div class="col-6 mb-3">
      <div class="card shadow-sm">
        <div class="card-body">
          <small>${title}</small>
          <h5 class="fw-bold">
            ${isCurrency ? "Rp " + format(value) : value}
          </h5>
        </div>
      </div>
    </div>
  `;
}

/* ===============================
   REVENUE CHART (SUDAH TF ONLY)
================================= */
function generateRevenueChart(data) {

  const monthly = {};

  data.forEach(d => {
    const month = d.transfer_date?.substring(0, 7);
    if (!month) return;

    if (!monthly[month]) monthly[month] = 0;
    monthly[month] += Number(d.kol_fee || 0);
  });

  const categories = Object.keys(monthly).sort();
  const values = categories.map(m => monthly[m]);

  if (chartRevenue) chartRevenue.destroy();

  chartRevenue = Highcharts.chart("chartRevenue", {
    chart: { type: "column" },
    title: { text: "KOL Revenue (Sudah TF)" },
    xAxis: { categories },
    yAxis: { title: { text: "Amount" } },
    series: [{
      name: "KOL Fee",
      data: values
    }]
  });
}

/* ===============================
   STATUS CHART
================================= */
function generateStatusChart(data) {

  let onProgress = 0;
  let finish = 0;

  data.forEach(d => {
    if (d.status === "ON_PROGRESS") onProgress++;
    if (d.status === "FINISH") finish++;
  });

  if (chartStatus) chartStatus.destroy();

  chartStatus = Highcharts.chart("chartStatus", {
    chart: { type: "pie" },
    title: { text: "Deal Status" },
    series: [{
      name: "Deals",
      data: [
        { name: "ON_PROGRESS", y: onProgress },
        { name: "FINISH", y: finish }
      ]
    }]
  });
}

/* ===============================
   FORMAT
================================= */
function format(x) {
  return x.toLocaleString("id-ID");
}
