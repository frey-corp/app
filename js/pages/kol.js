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

  $("#filterDateFrom, #filterDateTo, #filterStatus")
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

function today() {
  return new Date().toISOString().split("T")[0];
}

async function loadMaster() {

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
    lengthMenu: [10, 25, 50, 100],
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
      const filterStatus = $("#filterStatus").val();

      if (dateFrom) query = query.gte("deal_date", dateFrom);
      if (dateTo) query = query.lte("deal_date", dateTo);
      if (filterStatus) query = query.eq("status", filterStatus);
      query.eq("kol_user_id", currentUser.id);

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
          `brand_name.ilike.${search}`
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
          2: "job_description",
          3: "deadline",
          4: "amount_dealing",
          5: "admin_fee",
          6: "admin_fee_2",
          7: "agency_fee",
          8: "kol_fee",
          9: "brief_sow",
          10: "content_link",
          11: "transfer_date",
          12: "status",
          13: "type_promote",
          14: "notes"
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
          d.job_description || "",
          d.deadline || "",
          d.type_promote === "PAID" ? "Rp " + formatNumber(d.amount_dealing) : "-",
          d.admin_fee != null ? "Rp " + formatNumber(d.admin_fee) : "-",
          d.admin_fee_2 != null ? "Rp " + formatNumber(d.admin_fee_2) : "-",
          d.agency_fee != null ? "Rp " + formatNumber(d.agency_fee) : "-",
          d.kol_fee != null ? "Rp " + formatNumber(d.kol_fee) : "-",
          d.brief_sow || "",
          d.content_link || "",
          d.transfer_date || "",
          d.status,
          d.type_promote,
          d.notes || ""
        ])
      });
    }

  });
}