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

  // AUTO FILTER
  $("#filterFrom, #filterTo").on("change", () => pitchingTable.ajax.reload());
  $("#filterKOL").on("change", () => pitchingTable.ajax.reload());
}


/* ======================================================
   LOAD MASTER
====================================================== */

async function loadMaster() {

  // ===== LOAD KOL BY ADMIN =====
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

  // ===== LOAD ACTIVE BRANDS =====
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

  // DEFAULT 3 BULAN
  const today = new Date();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(today.getMonth() - 3);

  $("#filterFrom").val(threeMonthsAgo.toISOString().split("T")[0]);
  $("#filterTo").val(today.toISOString().split("T")[0]);
}


/* ======================================================
   INIT SELECT2
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

  $("#brandSelect").select2({
    width: "100%",
    dropdownParent: $("#pitchingModal")
  });
}


/* ======================================================
   DATATABLE SERVER SIDE
====================================================== */

function initDataTable() {

  pitchingTable = $("#pitchingTable").DataTable({
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
          brands(brand_name),
          kol:users!pitching_reports_kol_user_id_fkey(full_name)
        `, { count: "exact" })
        .eq("admin_user_id", currentUser.id)
        .order("pitching_date", { ascending: false });

      /* FILTER */
      const from = $("#filterFrom").val();
      const to = $("#filterTo").val();
      const kol = $("#filterKOL").val();

      if (from) query = query.gte("pitching_date", from);
      if (to) query = query.lte("pitching_date", to);
      if (kol) query = query.eq("kol_user_id", kol);

      /* SEARCH */
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

      callback({
        draw: data.draw,
        recordsTotal: count,
        recordsFiltered: count,
        data: rows.map(d => [
          d.pitching_date || "",
          d.brands?.brand_name || "",
          d.kol?.full_name || "",
          d.markom_name || "",
          d.markom_phone || "",
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
        ])
      });
    }
  });

  bindTableActions();
}


/* ======================================================
   TABLE BUTTON EVENTS (delegation)
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
  $("#pitchingDate").val(data.pitching_date);
  $("#brandSelect").val(data.brand_id).trigger("change");
  $("#kolSelect").val(data.kol_user_id).trigger("change");
  $("#markomName").val(data.markom_name);
  $("#markomPhone").val(data.markom_phone);

  pitchingModal.show();
}


/* ======================================================
   SAVE
====================================================== */

async function saveData(e) {

  e.preventDefault();

  const id = $("#pitchingId").val();

  const payload = {
    pitching_date: $("#pitchingDate").val(),
    brand_id: $("#brandSelect").val(),
    kol_user_id: $("#kolSelect").val(),
    admin_user_id: currentUser.id,
    markom_name: $("#markomName").val(),
    markom_phone: $("#markomPhone").val()
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
