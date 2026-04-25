import { supabase } from "../supabase.js";
import { getCurrentUser } from "../app.js";

let currentUser;
let pitchingTable;

/* ======================================================
   INIT
====================================================== */

export async function init() {

  currentUser = getCurrentUser();

  if (!currentUser) {
    Swal.fire("Error", "User not logged in", "error");
    return;
  }

  initDataTable();

  $("#filterFrom, #filterTo").on("change", () => pitchingTable.ajax.reload());
  $("#filterStatus").on("change", () => pitchingTable.ajax.reload());

  // DEFAULT 3 BULAN
  const today = new Date();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(today.getMonth() - 3);

  $("#filterFrom").val(threeMonthsAgo.toISOString().split("T")[0]);
  $("#filterTo").val(today.toISOString().split("T")[0]);
}


/* ======================================================
   DATATABLE
====================================================== */

function initDataTable() {

  pitchingTable = $("#pitchingTableKol").DataTable({
    processing: true,
    serverSide: true,
    responsive: true,
    searching: true,
    ordering: false,
    pageLength: 25,
    lengthMenu: [10, 25, 50, 100, 500, 1000, 3000],
    dom: 'Blfrtip',

    ajax: async function (data, callback) {

      const start = data.start;
      const length = data.length;
      const searchValue = data.search.value;

      let query = supabase
        .from("pitching_reports")
        .select(`
          *,
          brands(brand_name)
        `, { count: "exact" })
        .eq("kol_user_id", currentUser.id)
        .order("pitching_date", { ascending: false });

      // ===== FILTER TANGGAL =====
      const from = $("#filterFrom").val();
      const to = $("#filterTo").val();

      if (from) query = query.gte("pitching_date", from);
      if (to) query = query.lte("pitching_date", to);

      // ===== SEARCH =====
      if (searchValue) {
        query = query.or(`
          notes.ilike.%${searchValue}%
        `);
      }

      const { data: rows, count, error } = await query
        .range(start, start + length - 1);

      if (error) {
        Swal.fire("Error", error.message, "error");
        return;
      }

      // ===== FILTER STATUS (CLIENT SIDE) =====
      const selectedStatus = $("#filterStatus").val();

      let filteredRows = rows;

      if (selectedStatus) {
        filteredRows = rows.filter(d => {

          if (selectedStatus === "Deal") return !!d.deal_date;

          if (selectedStatus === "Follow Up")
            return !d.deal_date && !!d.followup_date;

          if (selectedStatus === "Respon")
            return !d.followup_date && !!d.respon_date;

          if (selectedStatus === "Pitching")
            return !d.respon_date && !!d.pitching_date;

          return true;
        });
      }

      // ===== FORMAT DATE =====
      const formatDate = (date) =>
        date ? new Date(date).toLocaleDateString("id-ID") : "-";

      callback({
        draw: data.draw,
        recordsTotal: count,
        recordsFiltered: selectedStatus ? filteredRows.length : count,

        data: filteredRows.map(d => {

          // ===== STATUS BADGE =====
          let status = `<span class="badge bg-secondary">Unknown</span>`;

          if (d.deal_date)
            status = `<span class="badge bg-success">Deal</span>`;
          else if (d.followup_date)
            status = `<span class="badge bg-primary">Follow Up</span>`;
          else if (d.respon_date)
            status = `<span class="badge bg-info text-dark">Respon</span>`;
          else if (d.pitching_date)
            status = `<span class="badge bg-warning text-dark">Pitching</span>`;

          return [
            d.brands?.brand_name || "",
            status,

            formatDate(d.pitching_date),
            formatDate(d.respon_date),
            formatDate(d.followup_date),
            formatDate(d.deal_date),

            d.notes || "-"
          ];
        })
      });
    }
  });
}

