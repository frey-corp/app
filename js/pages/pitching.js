import { supabase } from "../supabase.js";
import { getCurrentUser } from "../app.js";

let currentUser;
let pitchingModal;
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

  pitchingModal = new bootstrap.Modal(
    document.getElementById("pitchingModal")
  );

  await loadMaster();
  initDataTable();

  $("#btnAdd").on("click", openInsert);
  $("#pitchingForm").on("submit", saveData);

  $("#filterFrom, #filterTo").on("change", () => pitchingTable.ajax.reload());
  $("#filterKOL").on("change", () => pitchingTable.ajax.reload());
  $("#filterStatus").on("change", () => pitchingTable.ajax.reload());
}


/* ======================================================
   LOAD MASTER
====================================================== */

async function loadMaster() {

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

  const { data: brands } = await supabase
    .from("brands")
    .select("*")
    .eq("is_active", 1)
    .order("brand_name");

  $("#brandSelect").empty().append(`<option value=""></option>`);

  brands?.forEach(b => {
    $("#brandSelect").append(
      `<option value="${b.id}">${b.brand_name}</option>`
    );
  });

  initSelect2();

  const today = new Date();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(today.getMonth() - 3);

  $("#filterFrom").val(threeMonthsAgo.toISOString().split("T")[0]);
  $("#filterTo").val(today.toISOString().split("T")[0]);
}


/* ======================================================
   SELECT2
====================================================== */

function initSelect2() {

  ["#kolSelect", "#filterKOL", "#brandSelect"].forEach(id => {
    if ($(id).hasClass("select2-hidden-accessible")) {
      $(id).select2("destroy");
    }
  });

  $("#kolSelect").select2({
    width: "100%",
    dropdownParent: $("#pitchingModal")
  });

  $("#filterKOL").select2({ width: "100%" });
  $("#filterStatus").select2({ width: "100%" });

  $("#brandSelect").select2({
    width: "100%",
    dropdownParent: $("#pitchingModal"),
    tags: true,
    placeholder: "Pilih atau ketik brand baru"
  });
}

async function getOrCreateBrand(brandValue) {

  // kalau kosong
  if (!brandValue) return null;

  // cek apakah value numeric (id dari dropdown lama)
  if (!isNaN(brandValue)) {
    return brandValue;
  }

  // ===== berarti ini brand baru (string) =====
  const brandName = brandValue.trim();

  // cek dulu apakah sudah ada (case insensitive)
  const { data: existing } = await supabase
    .from("brands")
    .select("id")
    .ilike("brand_name", brandName)
    .maybeSingle();

  if (existing) {
    return existing.id;
  }

  // ===== insert brand baru =====
  const { data: newBrand, error } = await supabase
    .from("brands")
    .insert({
      brand_name: brandName,
      is_active: 1
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return newBrand.id;
}


/* ======================================================
   DATATABLE
====================================================== */

function initDataTable() {

  pitchingTable = $("#pitchingTable").DataTable({
    processing: true,
    serverSide: true,
    responsive: true,
    searching: true,
    ordering: false,
    pageLength: 25,
    dom: 'Blfrtip',

    ajax: async function (data, callback) {

      const start = data.start;
      const length = data.length;
      const searchValue = data.search.value;

      let query = supabase
        .from("pitching_reports")
        .select(`
          *,
          brands(brand_name),
          kol:users!pitching_reports_kol_user_id_fkey(full_name)
        `, { count: "exact" })
        .eq("admin_user_id", currentUser.id)
        .order("pitching_date", { ascending: false });

      // ===== FILTER =====
      const from = $("#filterFrom").val();
      const to = $("#filterTo").val();
      const kol = $("#filterKOL").val();

      if (from) query = query.gte("pitching_date", from);
      if (to) query = query.lte("pitching_date", to);
      if (kol) query = query.eq("kol_user_id", kol);

      // ===== SEARCH =====
      if (searchValue) {
        query = query.or(`
          markom_name.ilike.%${searchValue}%,
          markom_phone.ilike.%${searchValue}%
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
            d.kol?.full_name || "",
            status,
            d.markom_name || "",
            d.markom_phone || "",

            formatDate(d.pitching_date),
            formatDate(d.respon_date),
            formatDate(d.followup_date),
            formatDate(d.deal_date),

            d.notes || "-",

            `
              <button class="btn btn-sm btn-warning editBtn"
                data-id="${d.id}">
                Edit
              </button>
              <button class="btn btn-sm btn-danger deleteBtn"
                data-id="${d.id}">
                Delete
              </button>
            `
          ];
        })
      });
    }
  });

  bindTableActions();
}


/* ======================================================
   ACTION BUTTON
====================================================== */

function bindTableActions() {

  $("#pitchingTable").on("click", ".editBtn", function () {
    editData($(this).data("id"));
  });

  $("#pitchingTable").on("click", ".deleteBtn", function () {
    deleteData($(this).data("id"));
  });
}


/* ======================================================
   INSERT
====================================================== */

function openInsert() {
  $("#pitchingForm")[0].reset();
  $("#pitchingId").val("");
  $("#kolSelect, #brandSelect").val(null).trigger("change");
  pitchingModal.show();
}


/* ======================================================
   EDIT
====================================================== */

async function editData(id) {

  const { data, error } = await supabase
    .from("pitching_reports")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    Swal.fire("Error", error.message, "error");
    return;
  }

  $("#pitchingId").val(data.id);
  $("#brandSelect").val(data.brand_id).trigger("change");
  $("#kolSelect").val(data.kol_user_id).trigger("change");
  $("#markomName").val(data.markom_name);
  $("#markomPhone").val(data.markom_phone);

  $("#pitchingDate").val(data.pitching_date);
  $("#responDate").val(data.respon_date);
  $("#followupDate").val(data.followup_date);
  $("#dealDate").val(data.deal_date);
  $("#notes").val(data.notes);

  pitchingModal.show();
}


/* ======================================================
   SAVE
====================================================== */

async function saveData(e) {
  e.preventDefault();

  try {
    const id = $("#pitchingId").val();

    const brandId = await getOrCreateBrand($("#brandSelect").val());

    const payload = {
      brand_id: brandId,
      kol_user_id: $("#kolSelect").val(),
      admin_user_id: currentUser.id,
      markom_name: $("#markomName").val(),
      markom_phone: $("#markomPhone").val(),

      pitching_date: $("#pitchingDate").val(),
      respon_date: $("#responDate").val() || null,
      followup_date: $("#followupDate").val() || null,
      deal_date: $("#dealDate").val() || null,
      notes: $("#notes").val()
    };

    let result;

    if (id) {
      result = await supabase
        .from("pitching_reports")
        .update(payload)
        .eq("id", id);
    } else {
      result = await supabase
        .from("pitching_reports")
        .insert(payload);
    }

    if (result.error) {
      Swal.fire("Error", result.error.message, "error");
      return;
    }

    Swal.fire("Success", "Data berhasil disimpan", "success");
    pitchingModal.hide();
    pitchingTable.ajax.reload();

    await loadMaster();

  } catch (err) {
    Swal.fire("Error", err.message, "error");
  }
}


/* ======================================================
   DELETE
====================================================== */

async function deleteData(id) {

  const confirm = await Swal.fire({
    title: "Yakin?",
    text: "Data akan dihapus",
    icon: "warning",
    showCancelButton: true
  });

  if (!confirm.isConfirmed) return;

  const { error } = await supabase
    .from("pitching_reports")
    .delete()
    .eq("id", id);

  if (error) {
    Swal.fire("Error", error.message, "error");
    return;
  }

  Swal.fire("Deleted!", "Data berhasil dihapus", "success");
  pitchingTable.ajax.reload();
}


