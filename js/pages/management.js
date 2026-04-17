import { supabase } from "../supabase.js";
import { getCurrentUser } from "../app.js";

let currentUser;

export async function init() {

  currentUser = getCurrentUser();

  if (!currentUser) {
    console.warn("User belum login");
    return;
  }

  $("#welcomeText").text(`Welcome, ${currentUser.full_name}`);
  $("#dashboard").removeClass("d-none");

  $("#filterDateFrom, #filterDateTo, #filterKOL, #filterStatus")
  .off("change")
  .on("change", function () {
    $("#dealsTable").DataTable().ajax.reload();
  });

  await loadMaster();
  await loadDeals();
}

// =========================
// UTIL
// =========================
function formatNumber(val) {
  if (!val || isNaN(val)) return "";
  return Number(val).toLocaleString("id-ID");
}

function parseNumber(val) {
  if (!val) return 0;
  return Number(val.toString().replace(/[^\d]/g, ""));
}

function today() {
  return new Date().toISOString().split("T")[0];
}


$("#amountDealing, #adminFee, #adminFee2, #agencyFee").on("input", function () {
  
  let cursorPos = this.selectionStart;
  let value = $(this).val().replace(/\./g, "");
  
  if (!value) {
    $(this).val("");
    calculateKolFee();
    return;
  }

  let formatted = formatNumber(parseInt(value));
  $(this).val(formatted);

  calculateKolFee();
});



// =========================
// LOAD MASTER
// =========================
async function loadMaster() {

  const { data: kolMap } = await supabase
    .from("users")
    .select("id, full_name")
    .eq("role", 2);

  $("#kolSelect").empty().append(`<option value=""></option>`);
  $("#filterKOL").empty().append(`<option value="">ALL</option>`);

  kolMap.forEach(k => {
    if (k.id) {
      $("#kolSelect").append(`<option value="${k.id}">${k.full_name}</option>`);
      $("#filterKOL").append(`<option value="${k.id}">${k.full_name}</option>`);
    }
  });

  $("#kolSelect").select2({
    width: "100%",
    dropdownParent: $("#dealModal")
  });

  $("#filterKOL").select2({ width: "100%" });

  const from = new Date();
  from.setMonth(from.getMonth() - 3);

  $("#filterDateFrom").val(from.toISOString().split("T")[0]);
  $("#filterDateTo").val(today());
}

// =========================
// LOAD DEALS
// =========================
function loadDeals() {

  if ($.fn.DataTable.isDataTable("#dealsTable")) {
    $("#dealsTable").DataTable().destroy();
  }

  $("#dealsTable").DataTable({
    processing: true,
    serverSide: true,
    responsive: true,
    searching: true,
    ordering: true,
    pageLength: 25,
    lengthMenu: [10, 25, 50, 100, 500, 1000, 3000],
    dom: 'Blfrtip',

    ajax: async function (data, callback) {

      const start = data.start;
      const length = data.length;
      const searchValue = data.search.value;

      let query = supabase
          .from("deals_search")
          .select("*", { count: "exact" });

      /* ======================
        FILTER CUSTOM
      =======================*/

      const dateFrom = $("#filterDateFrom").val();
      const dateTo = $("#filterDateTo").val();
      const filterKOL = $("#filterKOL").val();
      const filterStatus = $("#filterStatus").val();

      if (dateFrom) query = query.gte("deal_date", dateFrom);
      if (dateTo) query = query.lte("deal_date", dateTo);
      if (filterKOL) query = query.eq("admin_user_id", filterKOL);
      if (filterStatus) query = query.eq("status", filterStatus);

      /* ======================
        SEARCH GLOBAL
      =======================*/

      if (searchValue) {
        const safeSearch = searchValue.replace(/[,()]/g, "");
        const search = `%${safeSearch}%`;

        const filters = [
          `job_description.ilike.${search}`,
          `notes.ilike.${search}`,
          `status.ilike.${search}`,
          `type_promote.ilike.${search}`,
          `brief_sow.ilike.${search}`,
          `content_link.ilike.${search}`,
          `brand_name.ilike.${search}`,
          `kol_name.ilike.${search}`,
          `admin_name.ilike.${search}`
        ];

        query = query.or(filters.join(",")); 
      }

      // =========================
      // ORDERING
      // =========================
      let orderBy = "deal_date";
      let ascending = false;

      if (data.order && data.order.length > 0) {
        const orderColIndex = data.order[0].column;
        const orderDir = data.order[0].dir; // asc / desc

        // Mapping kolom DataTable ke field Supabase
        // Kolom: 0 = deal_date, 1 = brand, 2 = kol, 3 = job_description, dst...
        const columnMap = {
          0: "deal_date",
          1: "brand_id",
          2: "kol_user_id",
          3: "admin_user_id",
          4: "job_description",
          5: "deadline",
          6: "amount_dealing",
          7: "iu_fee",
          8: "admin_fee",
          9: "admin_fee_2",
          10: "agency_fee",
          11: "kol_fee",
          12: "brief_sow",
          13: "content_link",
          14: "insight_link",
          15: "transfer_date",
          16: "status",
          17: "type_promote",
          18: "notes"
        };

        if (columnMap[orderColIndex]) {
          orderBy = columnMap[orderColIndex];
          ascending = orderDir === "asc";
        }
      }

      const { data: deals, count, error } = await query
        .order(orderBy, { ascending })
        .range(start, start + length - 1);

      if (error) {
        Swal.fire("Error", error.message, "error");
        return;
      }

      callback({
        draw: data.draw,
        recordsTotal: count,
        recordsFiltered: count,
        data: deals.map(d => [
          d.deal_date || "",
          d.brand_name || "",
          d.admin_name || "",
          d.kol_name || "",
          d.job_description || "",
          d.deadline || "",
          d.type_promote === "PAID" ? "Rp " + formatNumber(d.amount_dealing) : "-",
          d.iu_fee != null && d.iu_fee != 0 ? "Rp " + formatNumber(d.iu_fee) : "-",
          d.admin_fee != null && d.admin_fee != 0 ? "Rp " + formatNumber(d.admin_fee) : "-",
          d.admin_fee_2 != null && d.admin_fee_2 != 0 ? "Rp " + formatNumber(d.admin_fee_2) : "-",
          d.agency_fee != null && d.agency_fee != 0 ? "Rp " + formatNumber(d.agency_fee) : "-",
          d.kol_fee != null && d.kol_fee != 0 ? "Rp " + formatNumber(d.kol_fee) : "-",
          d.brief_sow || "",
          d.content_link || "",
          d.insight_link || "",
          d.transfer_date || "",
          d.status,
          d.type_promote,
          d.notes || ""
        ])
      });
    }

  });
}
