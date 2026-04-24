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

  $("#pitchingForm").on("submit", saveData);

  $("#filterFrom, #filterTo").on("change", () => pitchingTable.ajax.reload());
  $("#filterKOL").on("change", () => pitchingTable.ajax.reload());
  $("#filterAdmin").on("change", () => pitchingTable.ajax.reload());
  $("#filterStatus").on("change", () => pitchingTable.ajax.reload());
}


/* ======================================================
   LOAD MASTER
====================================================== */

async function loadMaster() {

  // ===== LOAD ADMIN =====
  const { data: adminList } = await supabase
    .from("users")
    .select("id, full_name")
    .eq("role", "2");

  $("#filterAdmin").empty().append(`<option value="">All Admin</option>`);

  adminList?.forEach(a => {
    $("#filterAdmin").append(
      `<option value="${a.id}">${a.full_name}</option>`
    );
  });

  // ===== LOAD BRAND =====
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

  // DEFAULT DATE
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

  ["#kolSelect", "#filterKOL", "#filterAdmin", "#brandSelect"].forEach(id => {
    if ($(id).hasClass("select2-hidden-accessible")) {
      $(id).select2("destroy");
    }
  });

  $("#kolSelect").select2({
    width: "100%",
    dropdownParent: $("#pitchingModal")
  });

  $("#filterKOL").select2({ width: "100%" });
  $("#filterAdmin").select2({ width: "100%" });
  $("#filterStatus").select2({ width: "100%" });

  $("#brandSelect").select2({
    width: "100%",
    dropdownParent: $("#pitchingModal")
  });
}


/* ======================================================
   DATATABLE
====================================================== */

function initDataTable() {

  pitchingTable = $("#pitchingTableManagement").DataTable({
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
          kol:users!pitching_reports_kol_user_id_fkey(full_name),
          admin:users!pitching_reports_admin_user_id_fkey(full_name)
        `, { count: "exact" })
        .order("pitching_date", { ascending: false });

      // ===== FILTER =====
      const from = $("#filterFrom").val();
      const to = $("#filterTo").val();
      const kol = $("#filterKOL").val();
      const admin = $("#filterAdmin").val();

      if (from) query = query.gte("pitching_date", from);
      if (to) query = query.lte("pitching_date", to);
      if (admin) query = query.eq("admin_user_id", admin);

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

      const formatDate = (date) =>
        date ? new Date(date).toLocaleDateString("id-ID") : "-";

      callback({
        draw: data.draw,
        recordsTotal: count,
        recordsFiltered: selectedStatus ? filteredRows.length : count,

        data: filteredRows.map(d => {

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
            d.admin?.full_name || "",
            d.markom_name || "",
            d.markom_phone || "",
            status,

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

  $("#pitchingTableManagement").on("click", ".editBtn", function () {
    editData($(this).data("id"));
  });

  $("#pitchingTableManagement").on("click", ".deleteBtn", function () {
    deleteData($(this).data("id"));
  });
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

  const id = $("#pitchingId").val();

  const payload = {
    brand_id: $("#brandSelect").val(),
    markom_name: $("#markomName").val(),
    markom_phone: $("#markomPhone").val(),

    pitching_date: $("#pitchingDate").val(),
    respon_date: $("#responDate").val() || null,
    followup_date: $("#followupDate").val() || null,
    deal_date: $("#dealDate").val() || null,
    notes: $("#notes").val()
  };

  const { error } = await supabase
    .from("pitching_reports")
    .update(payload)
    .eq("id", id);

  if (error) {
    Swal.fire("Error", error.message, "error");
    return;
  }

  Swal.fire("Success", "Data berhasil diupdate", "success");
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
