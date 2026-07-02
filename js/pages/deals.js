import { supabase } from "../supabase.js";
import { getCurrentUser } from "../app.js";

let currentUser;
let dealModal;

export async function init() {

  currentUser = getCurrentUser();

  let dpFiles = [];
  let finalFiles = [];

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

  dealModal = new bootstrap.Modal(document.getElementById("dealModal"));
  registerEvents();
  
  await loadMaster();
  await loadDeals();

  $("#dpAttachments").on("change", function () {
    dpFiles.push(...this.files);

    renderAttachmentPreview(
      dpFiles,
      "#dpAttachmentPreview",
      "dp"
    );

    $(this).val("");
  });

  $("#finalAttachments").on("change", function () {
    finalFiles.push(...this.files);

    renderAttachmentPreview(
      finalFiles,
      "#finalAttachmentPreview",
      "final"
    );

    $(this).val("");
  });
  
  $(document)
  .off("click", ".removeAttachment")
  .on("click", ".removeAttachment", function () {
    const type = $(this).data("type");
    const index = $(this).data("index");

    if (type === "dp") {
      dpFiles.splice(index, 1);

      renderAttachmentPreview(
        dpFiles,
        "#dpAttachmentPreview",
        "dp"
      );
    } else {
      finalFiles.splice(index, 1);

      renderAttachmentPreview(
        finalFiles,
        "#finalAttachmentPreview",
        "final"
      );
    }
  });

  // =========================
  // SAVE DEAL
  // =========================
  $("#dealForm").off("submit").on("submit", async function (e) {
    e.preventDefault();

    try {
      const type = $("input[name='typePromote']:checked").val();
      const amountDp = parseNumber($("#amountDp").val());

      // =========================
      // VALIDATION
      // =========================

      if (type === "PAID" && !parseNumber($("#amountDealing").val())) {
        Swal.fire("Error", "Paid Promote wajib isi Amount Dealing.", "error");
        return;
      }

      if (amountDp > 0) {
        if (!$("#transferDpDate").val()) {
          Swal.fire(
            "Error",
            "Amount DP sudah diisi, silakan isi Transfer DP Date.",
            "error"
          );
          return;
        }

        if (dpFiles.length === 0 && !$("#dpAttachmentPreview").children().length) {
          Swal.fire(
            "Error",
            "Amount DP sudah diisi, silakan upload Attachment Transfer DP.",
            "error"
          );
          return;
        }
      }

      if ($("#statusSelect").val() === "FINISH") {
        if (!$("#transferDate").val()) {
          Swal.fire(
            "Error",
            "Status FINISH wajib isi Tanggal Transfer.",
            "error"
          );
          return;
        }

        if (finalFiles.length === 0 && !$("#finalAttachmentPreview").children().length) {
          Swal.fire(
            "Error",
            "Status FINISH wajib upload Attachment Transfer Final.",
            "error"
          );
          return;
        }
      }

      const brandId = await getOrCreateBrand($("#brandSelect").val());

      const payload = {
        deal_date: $("#dealDate").val(),
        brand_id: brandId,
        kol_user_id: $("#kolSelect").val(),
        admin_user_id: currentUser.id,
        job_description: $("#jobDesc").val(),
        notes: $("#notes").val() || null,
        type_promote: type,
        deadline: $("#deadline").val() || null,

        amount_dealing:
          type === "PAID"
            ? parseNumber($("#amountDealing").val())
            : null,

        iu_fee: parseNumber($("#iuFee").val()),

        amount_dp: amountDp || null,
        transfer_dp_date: $("#transferDpDate").val() || null,

        admin_fee: parseNumber($("#adminFee").val()),
        admin_fee_2: parseNumber($("#adminFee2").val()),
        agency_fee: parseNumber($("#agencyFee").val()),

        kol_fee:
          type === "PAID"
            ? parseNumber($("#kolFee").val())
            : null,

        brief_sow: $("#briefSow").val() || null,
        content_link: $("#contentLink").val() || null,
        insight_link: $("#insightLink").val() || null,

        transfer_date: $("#transferDate").val() || null,

        status: $("#statusSelect").val()
      };

      const id = $("#dealForm").data("id");

      Swal.fire({
        title: "Saving...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      // =========================
      // INSERT / UPDATE DEAL
      // =========================
      let dealId = id;

      if (id && dpFiles.length > 0) {
        // Hapus semua attachment DP
        const { data: dpOldFiles } = await supabase.storage
          .from("attachments")
          .list(`deals/${dealId}/dp`);

        if (dpOldFiles && dpOldFiles.length > 0) {
          await supabase.storage
            .from("attachments")
            .remove(
              dpOldFiles.map(file => `deals/${dealId}/dp/${file.name}`)
            );
        }
      }

      if (id && finalFiles.length > 0) {
        // Hapus semua attachment Final
        const { data: finalOldFiles } = await supabase.storage
          .from("attachments")
          .list(`deals/${dealId}/final`);

        if (finalOldFiles && finalOldFiles.length > 0) {
          await supabase.storage
            .from("attachments")
            .remove(
              finalOldFiles.map(file => `deals/${dealId}/final/${file.name}`)
            );
        }
      }

      if (id) {
        const { error } = await supabase
          .from("deals")
          .update(payload)
          .eq("id", id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("deals")
          .insert(payload)
          .select("id")
          .single();

        if (error) throw error;

        dealId = data.id;
      }

      // =========================
      // UPLOAD DP ATTACHMENT
      // =========================
      let dpCount = 0;

      for (let i = 0; i < dpFiles.length; i++) {
        const file = dpFiles[i];
        const ext = file.name.split(".").pop().toLowerCase();

        const fileName = `dp_${String(i + 1).padStart(3, "0")}.${ext}`;

        const { error } = await supabase.storage
          .from("attachments")
          .upload(
            `deals/${dealId}/dp/${fileName}`,
            file,
            {
              upsert: true
            }
          );

        if (error) throw error;

        dpCount++;
      }

      // =========================
      // UPLOAD FINAL ATTACHMENT
      // =========================
      let finalCount = 0;

      for (let i = 0; i < finalFiles.length; i++) {
        const file = finalFiles[i];
        const ext = file.name.split(".").pop().toLowerCase();

        const fileName = `final_${String(i + 1).padStart(3, "0")}.${ext}`;

        const { error } = await supabase.storage
          .from("attachments")
          .upload(
            `deals/${dealId}/final/${fileName}`,
            file,
            {
              upsert: true
            }
          );

        if (error) throw error;

        finalCount++;
      }

      Swal.close();

      Swal.fire(
        "Success",
        "Data berhasil disimpan.",
        "success"
      );

      // Reset attachment
      dpFiles = [];
      finalFiles = [];

      $("#dpAttachments").val("");
      $("#finalAttachments").val("");

      $("#dpAttachmentPreview").empty();
      $("#finalAttachmentPreview").empty();

      dealModal.hide();

      await loadMaster();

      $("#dealsTable")
        .DataTable()
        .ajax.reload(null, false);

    } catch (err) {
      Swal.close();

      Swal.fire(
        "Error",
        err.message,
        "error"
      );
    }
  });

  async function loadAttachments(dealId, type, containerId) {
    const container = $(containerId);
    container.empty();

    const { data: files, error } = await supabase.storage
      .from("attachments")
      .list(`deals/${dealId}/${type}`, {
        limit: 100,
        sortBy: {
          column: "name",
          order: "asc"
        }
      });

    if (error || !files) return;

    files.forEach(file => {
      const ext = file.name.split(".").pop().toLowerCase();

      const {
        data: { publicUrl }
      } = supabase.storage
        .from("attachments")
        .getPublicUrl(`deals/${dealId}/${type}/${file.name}`);

      const imageUrl = `${publicUrl}?v=${Date.now()}`;

      const preview = ["jpg", "jpeg", "png", "webp"].includes(ext)
        ? `
          <img
            src="${imageUrl}"
            class="img-fluid rounded-top"
            style="height:140px;width:100%;object-fit:cover;">
        `
        : `
          <div
            class="d-flex justify-content-center align-items-center bg-light"
            style="height:140px;">
            <div class="text-center">
              <i class="bi bi-file-earmark-pdf fs-1 text-danger"></i>
              <div class="small mt-2">PDF</div>
            </div>
          </div>
        `;

      container.append(`
        <div class="col-6 col-md-3">
          <div class="card shadow-sm h-100">

            ${preview}

            <div class="card-body p-2">

              <div
                class="small text-truncate"
                title="${file.name}">
                ${file.name}
              </div>

              <a
                href="${imageUrl}"
                target="_blank"
                class="btn btn-sm btn-primary w-100 mt-2">
                Preview
              </a>

            </div>

          </div>
        </div>
      `);
    });
  }

  // =========================
  // EDIT DEAL
  // =========================
  $(document)
    .off("click", ".editDealBtn")
    .on("click", ".editDealBtn", async function () {
      const id = $(this).data("id");

      Swal.fire({
        title: "Loading Deal...",
        text: "Memuat data dan attachment...",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading()
      });

      const { data } = await supabase
        .from("deals")
        .select("*")
        .eq("id", id)
        .single();

      dpFiles = [];
      finalFiles = [];

      $("#dpAttachments").val("");
      $("#finalAttachments").val("");

      $("#dpAttachmentPreview").empty();
      $("#finalAttachmentPreview").empty();

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

      // DP
      $("#amountDp").val(formatNumber(data.amount_dp));
      $("#transferDpDate").val(data.transfer_dp_date);

      $("#adminFee").val(formatNumber(data.admin_fee));
      $("#adminFee2").val(formatNumber(data.admin_fee_2));
      $("#agencyFee").val(formatNumber(data.agency_fee));
      $("#kolFee").val(formatNumber(data.kol_fee));

      calculateKolFee();

      $("#briefSow").val(data.brief_sow);
      $("#contentLink").val(data.content_link);
      $("#insightLink").val(data.insight_link);

      $("#transferDate").val(data.transfer_date);
      $("#statusSelect").val(data.status);

      // Load Existing Attachment
      await loadAttachments(
        id,
        "dp",
        "#dpAttachmentPreview"
      );

      await loadAttachments(
        id,
        "final",
        "#finalAttachmentPreview"
      );
      Swal.close(); 
      dealModal.show();
    });

  // =========================
  // ADD DEAL
  // =========================
  $("#addDealBtn").off("click").on("click", function () {
    $("#dealForm")[0].reset();
    $("#dealForm").removeData("id");
    $("#dealForm").removeData("dp-count");
    $("#dealForm").removeData("final-count");

    dpFiles = [];
    finalFiles = [];

    $("#dpAttachments").val("");
    $("#finalAttachments").val("");

    $("#dpAttachmentPreview").empty();
    $("#finalAttachmentPreview").empty();

    $("#dealDate").val(today());
    $("#statusSelect").val("ON_PROGRESS");

    $("#brandSelect").val(null).trigger("change");
    $("#kolSelect").val(null).trigger("change");

    $("input[name='typePromote'][value='PAID']").prop(
      "checked",
      true
    );

    handleTypePromote();
    calculateKolFee();

    dealModal.show();
  });
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

  // Ambil raw input
  const adminInput = $("#adminFee").val();
  const agencyInput = $("#agencyFee").val();

  const admin1 = adminInput === "" ? 0 : parseNumber(adminInput);
  const agency = agencyInput === "" ? 0 : parseNumber(agencyInput);

  // console.log("amount", amount);
  // console.log("admin1", admin1);
  // console.log("admin2", admin2);
  // console.log("agency", agency);
  // console.log("iuFee", iuFee);
  // console.log("==============================");

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
    dropdownParent: $("#dealModal"),
    tags: true,
    placeholder: "Pilih atau ketik brand baru"
  });

  const from = new Date();
  from.setMonth(from.getMonth() - 3);

  $("#filterDateFrom").val(from.toISOString().split("T")[0]);
  $("#filterDateTo").val(today());
}

async function getOrCreateBrand(brandValue) {

  if (!brandValue) return null;

  // kalau angka → berarti ID existing
  if (!isNaN(brandValue)) {
    return Number(brandValue);
  }

  const brandName = brandValue.trim();

  // cek existing (case-insensitive)
  const { data: existing } = await supabase
    .from("brands")
    .select("id")
    .ilike("brand_name", brandName)
    .maybeSingle();

  if (existing) {
    return existing.id;
  }

  // insert baru
  const { data: newBrand, error } = await supabase
    .from("brands")
    .insert({
      brand_name: brandName,
      is_active: 1
    })
    .select()
    .single();

  if (error) throw error;

  return newBrand.id;
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
          6: "iu_fee",
          7: "amount_dp",
          8: "transfer_dp_date",
          9: "admin_fee",
          10: "admin_fee_2",
          11: "agency_fee",
          12: "kol_fee",
          13: "brief_sow",
          14: "content_link",
          15: "insight_link",
          16: "transfer_date",
          17: "status",
          18: "type_promote",
          19: "notes"
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
          d.iu_fee != null && d.iu_fee != 0 ? "Rp " + formatNumber(d.iu_fee) : "-",
          d.amount_dp != null && d.amount_dp != 0 ? "Rp " + formatNumber(d.amount_dp) : "-",
          d.transfer_dp_date || "",
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
          d.notes || "",
          // `
          //   ${d.status === "ON_PROGRESS" ? `
          //     <button class="btn btn-sm btn-primary editDealBtn"
          //       data-id="${d.id}">
          //       Edit
          //     </button>
          //   ` : ""}
          //   <button class="btn btn-sm btn-secondary printInvoiceBtn"
          //     data-id="${d.id}">
          //     Print
          //   </button>
          //   <button class="btn btn-sm btn-warning copyAlamat"
          //     data-alamat="${d.kol_alamat || ''}">
          //     Alamat KOL
          //   </button>
          // `
          `
            <button class="btn btn-sm btn-primary editDealBtn"
              data-id="${d.id}">
              Edit
            </button>
            <button class="btn btn-sm btn-danger deleteDealBtn"
              data-id="${d.id}">
              Delete
            </button>
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
  // TYPE PROMOTE
  // =========================
  $(document)
    .off("change", "input[name='typePromote']")
    .on("change", "input[name='typePromote']", function () {
      handleTypePromote();
      calculateKolFee();
    });

  // =========================
  // AMOUNT DEALING
  // =========================
  $(document)
    .off("input", "#amountDealing")
    .on("input", "#amountDealing", function () {

      let value = $(this).val().replace(/\./g, "");

      if (!value) {
        $(this).val("");
        $("#adminFee").val("");
        $("#agencyFee").val("");
        calculateKolFee();
        return;
      }

      let amount = parseInt(value);

      $("#adminFee").val(formatNumber(amount * 0.15));
      $("#agencyFee").val(formatNumber(amount * 0.05));
      $(this).val(formatNumber(amount));

      calculateKolFee();
    });

  $(document)
    .off("input", "#adminFee, #agencyFee, #adminFee2, #iuFee")
    .on("input", "#adminFee, #agencyFee, #adminFee2, #iuFee", function () {

      let value = $(this).val().replace(/\./g, "");

      if (!value) {
        $(this).val("");
      } else {
        $(this).val(formatNumber(parseInt(value)));
      }

      calculateKolFee();
    });

  // =========================
  // DP
  // =========================
  $(document)
    .off("input", "#amountDp")
    .on("input", "#amountDp", function () {

      let value = $(this).val().replace(/\./g, "");

      if (!value) {
        $(this).val("");
      } else {
        $(this).val(formatNumber(parseInt(value)));
      }
    });

  // =========================
  // DELETE DEAL
  // =========================
  $(document)
    .off("click", ".deleteDealBtn")
    .on("click", ".deleteDealBtn", async function () {
      const id = $(this).data("id");

      const confirm = await Swal.fire({
        title: "Yakin hapus data?",
        text: "Data yang dihapus tidak bisa dikembalikan!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Ya, hapus!",
        cancelButtonText: "Batal"
      });

      if (!confirm.isConfirmed) return;

      Swal.fire({ title: "Deleting...", didOpen: () => Swal.showLoading() });

      const { error } = await supabase
        .from("deals")
        .delete()
        .eq("id", id);

      Swal.close();

      if (error) {
        Swal.fire("Error", error.message, "error");
        return;
      }

      Swal.fire("Success", "Data berhasil dihapus", "success");
      loadDeals();
    });
}

// =========================
// PDF INVOICE
// =========================
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
        whatsapp_number_admin,
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
    admin_wa: data.kol?.whatsapp_number_admin || ""
  });

  // =========================
  // OPEN PRINT PAGE
  // =========================
  window.open(`invoice.html?${params.toString()}`, "_blank");
});

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

function renderAttachmentPreview(files, containerId, type) {
  const container = $(containerId);
  container.empty();

  files.forEach((file, index) => {
    const ext = file.name.split(".").pop().toLowerCase();

    const isImage = ["jpg", "jpeg", "png", "webp"].includes(ext);

    const preview = isImage
      ? `<img
            src="${URL.createObjectURL(file)}"
            class="img-fluid rounded-top"
            style="height:140px;width:100%;object-fit:cover;">`
      : `
        <div
          class="d-flex justify-content-center align-items-center bg-light"
          style="height:140px;">
            <div class="text-center">
              <i class="bi bi-file-earmark-pdf fs-1 text-danger"></i>
              <div class="small mt-2">PDF</div>
            </div>
        </div>
      `;

    container.append(`
      <div class="col-6 col-md-3">
        <div class="card shadow-sm h-100">

          ${preview}

          <div class="card-body p-2">

            <div
              class="small text-truncate mb-2"
              title="${file.name}">
              ${file.name}
            </div>

            <button
              type="button"
              class="btn btn-sm btn-danger w-100 removeAttachment"
              data-type="${type}"
              data-index="${index}">
              Remove
            </button>

          </div>

        </div>
      </div>
    `);
  });
}
