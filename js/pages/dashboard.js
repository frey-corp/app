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
    loadKOL();
    loadDashboard();

    $("#filterKOL").select2({
        placeholder: "All KOL",
        allowClear: true,
        width: "100%"
    });

    document.getElementById("filterFrom")
        ?.addEventListener("change", loadDashboard);

    document.getElementById("filterTo")
        ?.addEventListener("change", loadDashboard);

    $("#filterKOL").on("change", loadDashboard);
}

function setDefaultMonthFilter() {
  const today = new Date();

  const thisMonth = today.toISOString().slice(0, 7);

  const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonth = lastMonthDate.toISOString().slice(0, 7);

  $("#filterFrom").val(lastMonth);
  $("#filterTo").val(thisMonth);
}


/* ===============================
   GET DATA BASED ON FILTER
================================= */
async function getDeals() {

  let query = supabase.from("deals").select("*");

  const fromMonth = document.getElementById("filterFrom")?.value;
  const toMonth = document.getElementById("filterTo")?.value;
  const kol = document.getElementById("filterKOL")?.value;

  if (fromMonth) {
    const startDate = fromMonth + "-01";
    query = query.gte("deal_date", startDate);
  }

  if (toMonth) {
    const endDate = new Date(toMonth + "-01");
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(0); // last day of month

    const endFormatted = endDate.toISOString().split("T")[0];
    query = query.lte("deal_date", endFormatted);
  }

  if (kol) query = query.eq("kol_user_id", kol);

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

  const deals = await getDeals();

  generateKPI(deals);
  generateRevenueChart(deals);
  generateStatusChart(deals);
}

/* ===============================
   LOAD KOL
================================= */
async function loadKOL() {

  const { data: kolMap } = await supabase
      .from("admin_kol_mapping")
      .select(`
        kol_user_id,
        kol:users!fk_kol (id, full_name)
      `)
      .eq("admin_user_id", currentUser.id);
  
    $("#kolSelect").empty().append(`<option value=""></option>`);
    $("#filterKOL").empty().append(`<option value="">ALL</option>`);
  
    kolMap?.forEach(k => {
      if (k.kol) {
        $("#kolSelect").append(
          `<option value="${k.kol.id}">${k.kol.full_name}</option>`
        );
  
        $("#filterKOL").append(
          `<option value="${k.kol.id}">${k.kol.full_name}</option>`
        );
      }
    });
}

/* ===============================
   KPI
================================= */
function generateKPI(data) {

  let totalDeal = 0;
  let admin1 = 0;
  let admin2 = 0;
  let kolFee = 0;
  let agencyFee = 0;

  data.forEach(d => {
    totalDeal += Number(d.amount_dealing || 0);
    admin1 += Number(d.admin_fee || 0);
    admin2 += Number(d.admin_fee_2 || 0);
    kolFee += Number(d.kol_fee || 0);
    agencyFee += Number(d.agency_fee || 0);
  });

  const totalAdmin = admin1 + admin2;

  const container = document.getElementById("kpiContainer");
  if (!container) return;

  container.innerHTML = `
    ${card("Total Deal", totalDeal)}
    ${card("Admin Fee 1", admin1)}
    ${card("Admin Fee 2", admin2)}
    ${card("Total Admin", totalAdmin)}
    ${card("Total KOL Fee", kolFee)}
    ${card("Total Agency Fee", agencyFee)}
  `;
}

function card(title, value) {
  return `
    <div class="col-6 mb-3">
      <div class="card shadow-sm">
        <div class="card-body">
          <small>${title}</small>
          <h5 class="fw-bold">Rp ${format(value)}</h5>
        </div>
      </div>
    </div>
  `;
}

/* ===============================
   REVENUE CHART
================================= */
function generateRevenueChart(data) {

  const container = document.getElementById("chartRevenue");
  if (!container) return;

  const monthly = {};

  data.forEach(d => {
    const month = d.deal_date.substring(0, 7);
    const totalAdmin =
      Number(d.admin_fee || 0) +
      Number(d.admin_fee_2 || 0);

    if (!monthly[month]) monthly[month] = 0;
    monthly[month] += totalAdmin;
  });

  const categories = Object.keys(monthly).sort();
  const values = categories.map(m => monthly[m]);

  if (chartRevenue) {
    chartRevenue.destroy();
  }

  chartRevenue = Highcharts.chart("chartRevenue", {
    chart: { type: "column" },
    title: { text: "Admin Revenue per Month" },
    xAxis: { categories },
    yAxis: { title: { text: "Amount" } },
    series: [{
      name: "Total Admin Fee",
      data: values
    }]
  });
}

/* ===============================
   STATUS CHART
================================= */
function generateStatusChart(data) {

  const container = document.getElementById("chartStatus");
  if (!container) return;

  let onProgress = 0;
  let finish = 0;

  data.forEach(d => {
    if (d.status === "ON_PROGRESS") onProgress++;
    if (d.status === "FINISH") finish++;
  });

  if (chartStatus) {
    chartStatus.destroy();
  }

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

function format(x) {
  return x.toLocaleString("id-ID");
}
