import { supabase } from "../supabase.js";
import { getCurrentUser } from "../app.js";

let currentUser;
let dealModal;

export async function init() {

  currentUser = getCurrentUser();

  if (!currentUser) {
    console.warn("User belum login");
    return;
  }

  $("#welcomeText").text(`Welcome, ${currentUser.full_name}`);
  $("#dashboard").removeClass("d-none");

  $("input[name='typePromote']").on("change", handleTypePromote);

  $("#filterDateFrom, #filterDateTo, #filterKOL, #filterStatus")
  .off("change")
  .on("change", function () {
    $("#dealsTable").DataTable().ajax.reload();
  });


  dealModal = new bootstrap.Modal(document.getElementById("dealModal"));
  registerEvents();
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

// =========================
// TYPE PROMOTE HANDLER
// =========================
function handleTypePromote() {
  const type = $("input[name='typePromote']:checked").val();

  if (type === "PAID") {
    $("#amountWrapper").show();
    $("#kolFeeWrapper").show();
  } else {
    $("#amountWrapper").hide();
    $("#kolFeeWrapper").hide();
    $("#amountDealing").val("");
    $("#adminFee").val("");
    $("#adminFee2").val("");
    $("#agencyFee").val("");
    $("#iuFee").val("");
    $("#kolFee").val("");
  }
}

$("#amountDealing").on("input", function () {
  let value = $(this).val().replace(/\./g, "");

  if (!value) {
    $(this).val("");
    $("#adminFee").val("");
    $("#agencyFee").val("");
    calculateKolFee();
    return;
  }

  let amount = parseInt(value);

  // Auto isi default
  $("#adminFee").val(formatNumber(amount * 0.15));
  $("#agencyFee").val(formatNumber(amount * 0.05));
  $(this).val(formatNumber(amount));

  calculateKolFee();
});

// Semua field trigger ulang
$("#adminFee, #agencyFee, #adminFee2, #iuFee").on("input", function () {
  let value = $(this).val().replace(/\./g, "");

  if (!value) {
    $(this).val("");
  } else {
    $(this).val(formatNumber(parseInt(value)));
  }

  calculateKolFee();
});

// =========================
// KOL FEE CALCULATION
// =========================
function calculateKolFee() {

  const type = $("input[name='typePromote']:checked").val();
  if (type !== "PAID") {
    $("#kolFee").val("");
    return;
  }

  const amount = parseNumber($("#amountDealing").val());
  const admin2 = parseNumber($("#adminFee2").val());
  const iuFee = parseNumber($("#iuFee").val());

  if (!amount) {
    $("#kolFee").val("");
    return;
  }

  let admin1 = parseNumber($("#adminFee").val());
  let agency = parseNumber($("#agencyFee").val());

  if (!admin1) {
    admin1 = amount * 0.15;
  }

  if (!agency) {
    agency = amount * 0.05;
  }

  const kol = amount - admin1 - admin2 - agency - iuFee;

  $("#kolFee").val(formatNumber(kol < 0 ? 0 : kol));
}

// =========================
// LOAD MASTER
// =========================
async function loadMaster() {

  const { data: kolMap } = await supabase
    .from("admin_kol_mapping")
    .select(`
      kol_user_id,
      kol:kol_user_id (
        id,
        full_name
      )
    `)
    .eq("admin_user_id", currentUser.id);

  $("#kolSelect").empty().append(`<option value=""></option>`);
  $("#filterKOL").empty().append(`<option value="">ALL</option>`);

  kolMap.forEach(k => {
    if (k.kol) {
      $("#kolSelect").append(`<option value="${k.kol.id}">${k.kol.full_name}</option>`);
      $("#filterKOL").append(`<option value="${k.kol.id}">${k.kol.full_name}</option>`);
    }
  });

  $("#kolSelect").select2({
    width: "100%",
    dropdownParent: $("#dealModal")
  });

  $("#filterKOL").select2({ width: "100%" });

  const { data: brands, error } = await supabase
  .from("brands")
  .select("*")
  .eq("is_active", 1)
  .order("brand_name", { ascending: true });

  $("#brandSelect").empty().append(`<option value=""></option>`);
  brands.forEach(b => {
    $("#brandSelect").append(`<option value="${b.id}">${b.brand_name}</option>`);
  });

  $("#brandSelect").select2({
    width: "100%",
    dropdownParent: $("#dealModal")
  });

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
      
      const id_admin = currentUser.id
      query.eq("admin_user_id", id_admin);

      /* ======================
        FILTER CUSTOM
      =======================*/

      const dateFrom = $("#filterDateFrom").val();
      const dateTo = $("#filterDateTo").val();
      const filterKOL = $("#filterKOL").val();
      const filterStatus = $("#filterStatus").val();

      if (dateFrom) query = query.gte("deal_date", dateFrom);
      if (dateTo) query = query.lte("deal_date", dateTo);
      if (filterKOL) query = query.eq("kol_user_id", filterKOL);
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
          `insight_link.ilike.${search}`,
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
          3: "job_description",
          4: "deadline",
          5: "amount_dealing",
          6: "admin_fee",
          7: "admin_fee_2",
          8: "agency_fee",
          9: "iu_fee",
          10: "kol_fee",
          11: "brief_sow",
          12: "content_link",
          13: "insight_link",
          14: "transfer_date",
          15: "status",
          16: "type_promote",
          17: "notes"
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
          d.kol_name || "",
          d.job_description || "",
          d.deadline || "",
          d.type_promote === "PAID" ? "Rp " + formatNumber(d.amount_dealing) : "-",
          d.iu_fee != null ? "Rp " + formatNumber(d.iu_fee) : "-",
          d.admin_fee != null ? "Rp " + formatNumber(d.admin_fee) : "-",
          d.admin_fee_2 != null ? "Rp " + formatNumber(d.admin_fee_2) : "-",
          d.agency_fee != null ? "Rp " + formatNumber(d.agency_fee) : "-",
          d.kol_fee != null ? "Rp " + formatNumber(d.kol_fee) : "-",
          d.brief_sow || "",
          d.content_link || "",
          d.insight_link || "",
          d.transfer_date || "",
          d.status,
          d.type_promote,
          d.notes || "",
          `
            ${d.status === "ON_PROGRESS" ? `
              <button class="btn btn-sm btn-primary editDealBtn"
                data-id="${d.id}">
                Edit
              </button>
            ` : ""}
            <button class="btn btn-sm btn-secondary printInvoiceBtn"
              data-id="${d.id}">
              Print
            </button>
            <button class="btn btn-sm btn-warning copyAlamat"
              data-alamat="${d.kol_alamat || ''}">
              Alamat KOL
            </button>
          `
        ])
      });
    }

  });
}

function registerEvents() {

  // =========================
  // ADD DEAL
  // =========================
  $("#addDealBtn").off("click").on("click", function () {

    $("#dealForm")[0].reset();
    $("#dealForm").removeData("id");

    $("#dealDate").val(today());
    $("#statusSelect").val("ON_PROGRESS");
    $("#brandSelect").val(null).trigger("change");
    $("#kolSelect").val(null).trigger("change");

    $("input[name='typePromote'][value='PAID']")
      .prop("checked", true);

    handleTypePromote();

    dealModal.show();
  });


  // =========================
  // SAVE DEAL
  // =========================
  $("#dealForm").off("submit").on("submit", async function (e) {
    e.preventDefault();

    const type = $("input[name='typePromote']:checked").val();

    if (type === "PAID" && !parseNumber($("#amountDealing").val())) {
      Swal.fire("Error", "Paid Promote wajib isi Amount Dealing", "error");
      return;
    }

    if ($("#statusSelect").val() === "FINISH" && !$("#transferDate").val()) {
      Swal.fire("Error", "Status FINISH wajib isi Tanggal Transfer", "error");
      return;
    }

    const payload = {
      deal_date: $("#dealDate").val(),
      brand_id: Number($("#brandSelect").val()),
      kol_user_id: $("#kolSelect").val(),
      admin_user_id: currentUser.id,
      job_description: $("#jobDesc").val(),
      notes: $("#notes").val() || null,
      type_promote: type,
      deadline: $("#deadline").val() || null,
      amount_dealing: type === "PAID" ? parseNumber($("#amountDealing").val()) : null,
      iu_fee: parseNumber($("#iuFee").val()),
      admin_fee: parseNumber($("#adminFee").val()),
      admin_fee_2: parseNumber($("#adminFee2").val()),
      agency_fee: parseNumber($("#agencyFee").val()),
      kol_fee: type === "PAID" ? parseNumber($("#kolFee").val()) : null,
      brief_sow: $("#briefSow").val() || null,
      content_link: $("#contentLink").val() || null,
      insight_link: $("#insightLink").val() || null,
      transfer_date: $("#transferDate").val() || null,
      status: $("#statusSelect").val()
    };

    const id = $("#dealForm").data("id");

    Swal.fire({ title: "Saving...", didOpen: () => Swal.showLoading() });

    const query = id
      ? supabase.from("deals").update(payload).eq("id", id)
      : supabase.from("deals").insert([payload]);

    const { error } = await query;
    Swal.close();

    if (error) {
      Swal.fire("Error", error.message, "error");
      return;
    }

    Swal.fire("Success", "Data berhasil disimpan", "success");
    dealModal.hide();
    loadDeals();
  });


  // =========================
  // EDIT DEAL
  // =========================
  $(document)
    .off("click", ".editDealBtn")
    .on("click", ".editDealBtn", async function () {

      const id = $(this).data("id");

      const { data } = await supabase
        .from("deals")
        .select("*")
        .eq("id", id)
        .single();

      $("#dealForm").data("id", id);

      $("#dealDate").val(data.deal_date);
      $("#brandSelect").val(data.brand_id).trigger("change");
      $("#kolSelect").val(data.kol_user_id).trigger("change");
      $("#jobDesc").val(data.job_description);
      $("#notes").val(data.notes);

      $("input[name='typePromote'][value='" + data.type_promote + "']")
        .prop("checked", true);

      handleTypePromote();

      $("#deadline").val(data.deadline);
      $("#amountDealing").val(formatNumber(data.amount_dealing));
      $("#iuFee").val(formatNumber(data.iu_fee));
      $("#adminFee").val(formatNumber(data.admin_fee));
      $("#adminFee2").val(formatNumber(data.admin_fee_2));
      $("#agencyFee").val(formatNumber(data.agency_fee));
      $("#kolFee").val(formatNumber(data.kol_fee));
      $("#briefSow").val(data.brief_sow);
      $("#contentLink").val(data.content_link);
      $("#insightLink").val(data.insight_link);
      $("#transferDate").val(data.transfer_date);
      $("#statusSelect").val(data.status);

      dealModal.show();
    });
}


// =========================
// PRINT INVOICE (SEMUA STATUS)
// =========================
$(document).on("click", ".printInvoiceBtn", async function () {

  const id = $(this).data("id");

  const { data: deal } = await supabase
    .from("deals")
    .select("deal_date, job_description, amount_dealing, kol_user_id, brand_id, notes")
    .eq("id", id)
    .single();

  const { data: brand } = await supabase
    .from("brands")
    .select("brand_name")
    .eq("id", deal.brand_id)
    .single();

  const { data: kol } = await supabase
    .from("users")
    .select(`
      full_name,
      instagram_account,
      tiktok_account,
      whatsapp_number,
      bank_name,
      bank_account_number
    `)
    .eq("id", deal.kol_user_id)
    .single();

  generateInvoicePDF({
    deal_date: deal.deal_date,
    brand: brand?.brand_name,
    kol: kol.full_name,
    job: deal.job_description,
    note: deal.notes,
    amount: deal.amount_dealing,
    instagram: kol.instagram_account,
    tiktok: kol.tiktok_account,
    whatsapp: kol.whatsapp_number,
    bank: kol.bank_name,
    rekening: kol.bank_account_number
  });
});

// =========================
// PDF INVOICE
// =========================
function generateInvoicePDF(data) {
  const today = new Date();
  const invoiceNo = today.toISOString().slice(0,10).replace(/-/g,"");
  const dateText = today.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });

  const invoice = $("#invoiceTemplate").clone().show();

  invoice.find(".brand").text(data.brand);
  invoice.find(".invoiceNo").text(invoiceNo);
  invoice.find(".date").text(dateText);
  invoice.find(".job").text(data.job);
  invoice.find(".amount").text("IDR " + Number(data.amount).toLocaleString("id-ID"));
  if (data.note && data.note.trim() !== "") {
    invoice.find(".note-text").text(data.note);
    invoice.find(".note-section").show();
  } else {
    invoice.find(".note-section").remove();
  }
  invoice.find(".total").text(
    "Total : IDR " + Number(data.amount).toLocaleString("id-ID")
  );

  invoice.find(".instagram").text(data.instagram);
  invoice.find(".tiktok").text(data.tiktok);
  invoice.find(".whatsapp").text(data.whatsapp);
  invoice.find(".kol").text(data.kol);
  invoice.find(".bank").text(data.bank);
  invoice.find(".rekening").text(data.rekening);

  $("body").append(invoice);

html2pdf()
  .from(invoice[0])
  .set({
    margin: 0,
    filename: `Invoice_${invoiceNo}_${data.brand}.pdf`,

    html2canvas: {
      scale: 4,              // 🔥 PALING PENTING (2 = lumayan, 4 = super tajam)
      dpi: 400,              // 🔥 PRINT QUALITY
      letterRendering: true, // 🔥 teks lebih tajam
      useCORS: true,
      backgroundColor: null,
      windowWidth: 794,      // A4 px
      windowHeight: 1122
    },

    jsPDF: {
      unit: "mm",
      format: "a4",
      orientation: "portrait",
      compressPDF: false     // 🔥 jangan dikompres
    },

    pagebreak: { mode: ["avoid-all"] }
  })
  .save()
  .then(() => invoice.remove());
}

// =========================
// Copy Alamat
// =========================
$(document).on("click", ".copyAlamat", function () {

    const alamat = $(this).data("alamat");

    if (!alamat) {
        Swal.fire({
            icon: "warning",
            title: "Alamat kosong",
            timer: 1500,
            showConfirmButton: false
        });
        return;
    }

    navigator.clipboard.writeText(alamat).then(() => {
        Swal.fire({
            icon: "success",
            title: "Alamat KOL berhasil disalin!",
            timer: 1000,
            showConfirmButton: false
        });
    }).catch(() => {
        Swal.fire({
            icon: "error",
            title: "Gagal menyalin alamat"
        });
    });

});
