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
          5: "agency_fee",
          6: "kol_fee",
          7: "brief_sow",
          8: "content_link",
          9: "insight_link",
          10: "transfer_date",
          11: "status",
          12: "type_promote",
          13: "notes"
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
          (d.iu_fee || 0) + (d.admin_fee || 0) + (d.admin_fee_2 || 0) + (d.agency_fee || 0) !== 0
          ? "Rp " + formatNumber(
              (d.iu_fee || 0) +
              (d.admin_fee || 0) +
              (d.admin_fee_2 || 0) +
              (d.agency_fee || 0)
            )
          : "-",
          d.kol_fee != null && d.kol_fee != 0 ? "Rp " + formatNumber(d.kol_fee) : "-",
          d.brief_sow || "",
          d.content_link || "",
          d.insight_link || "",
          d.transfer_date || "",
          d.status,
          d.type_promote,
          d.notes || "",
          `<button class="btn btn-sm btn-secondary printInvoiceBtn"
              data-id="${d.id}">
              Print Invoice
            </button>`
        ])
      });
    }

  });

  $(document).on("click", ".printInvoiceBtn", async function () {
    const id = $(this).data("id");

    // =========================
    // AMBIL DATA UTAMA (JOIN)
    // =========================
    const { data, error } = await supabase
      .from("deals")
      .select(`
        id,
        deal_date,
        created_at,
        deadline,
        job_description,
        brief_sow,
        notes,
        amount_dealing,

        brand:brands (
          brand_name,
          brand_addres
        ),

        kol:users!fk_kol_user (
          full_name,
          username,
          instagram_account,
          tiktok_account,
          whatsapp_number,
          bank_name,
          bank_account_number,
          alamat
        ),

        admin:users!fk_admin_user (
          full_name,
          whatsapp_number
        )
      `)
      .eq("id", id)
      .single();

    if (error || !data) {
      console.error(error);
      alert("Gagal ambil data");
      return;
    }

    // =========================
    // GENERATE No INV (STABLE)
    // =========================
    const date = new Date(data.deal_date);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");

    const startDate = `${year}-${month}-01`;

    // bulan berikutnya (AMAN, tanpa bug tanggal)
    const nextMonthDate = new Date(year, date.getMonth() + 1, 1);
    const nextYear = nextMonthDate.getFullYear();
    const nextMonth = String(nextMonthDate.getMonth() + 1).padStart(2, "0");

    // ambil semua deals di bulan tsb
    const { data: monthlyDeals, error: errDeals } = await supabase
      .from("deals")
      .select("id, deal_date, created_at")
      .gte("deal_date", startDate)
      .lt("deal_date", `${nextYear}-${nextMonth}-01`);

    if (errDeals || !monthlyDeals) {
      console.error(errDeals);
      alert("Gagal generate invoice number");
      return;
    }

    // =========================
    // SORT STABIL (WAJIB)
    // =========================
    monthlyDeals.sort((a, b) => {
      if (a.deal_date !== b.deal_date) {
        return new Date(a.deal_date) - new Date(b.deal_date);
      }
      if (a.created_at !== b.created_at) {
        return new Date(a.created_at) - new Date(b.created_at);
      }
      return a.id.localeCompare(b.id);
    });

    // =========================
    // CARI URUTAN
    // =========================
    const index = monthlyDeals.findIndex(d => d.id === data.id) + 1;

    if (index === 0) {
      alert("Data tidak ditemukan di list bulanan");
      return;
    }

    const invoiceNumber = `INV-${year}${month}-FREY${String(index).padStart(4, "0")}`;

    // =========================
    // FORMAT DATA
    // =========================
    const formatRupiah = (num) =>
      "IDR " + Number(num || 0).toLocaleString("id-ID");

    const params = new URLSearchParams({
      invoice: invoiceNumber,
      issued_date: data.deadline || "",

      brand: data.brand?.brand_name || "",
      brand_address: data.brand?.brand_addres || "",

      kol: data.kol?.full_name || "",
      kol_username: data.kol?.username || "",
      kol_address: data.kol?.alamat || "",

      description: data.job_description || "",

      amount: formatRupiah(data.amount_dealing),

      instagram: data.kol?.instagram_account || "",
      tiktok: data.kol?.tiktok_account || "",
      whatsapp: data.kol?.whatsapp_number || "",

      bank: data.kol?.bank_name || "",
      rekening: data.kol?.bank_account_number || "",

      admin_name: data.admin?.full_name || "",
      admin_wa: data.kol?.whatsapp_number || ""
    });

    // =========================
    // OPEN PRINT PAGE
    // =========================
    window.open(`invoice.html?${params.toString()}`, "_blank");
  });
  
}
