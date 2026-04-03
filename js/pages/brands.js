import { supabase } from "../supabase.js";

let brandModal;
let brandTable;

export function init() {

  brandModal = new bootstrap.Modal(
    document.getElementById("brandModal")
  );

  initDataTable();

  document.getElementById("addBrandBtn")
    .addEventListener("click", openAddModal);

  document.getElementById("brandForm")
    .addEventListener("submit", saveBrand);

  document.getElementById("statusFilter")
    .addEventListener("change", () => {
      brandTable.ajax.reload();
    });

  $(document).on("click", ".editBrandBtn", openEditModal);
}

/* =====================================
   DATATABLE SERVER SIDE
=====================================*/

function initDataTable() {

  $.fn.DataTable.ext.pager.numbers_length = 2;
  brandTable = $("#brandTable").DataTable({
    processing: true,
    serverSide: true,
    searching: true,
    ordering: true,
    pageLength: 25,
    lengthMenu: [10, 25, 50, 100],
    dom: 'Blfrtip',
    pagingType: "simple_numbers",
    renderer: "bootstrap", 

    ajax: async function (data, callback) {

      const start = data.start;
      const length = data.length;
      const searchValue = data.search.value;
      const statusFilter = document.getElementById("statusFilter").value;

      let query = supabase
        .from("brands")
        .select("*", { count: "exact" });

      // SEARCH
      if (searchValue) {
        query = query.ilike("brand_name", `%${searchValue}%`);
      }

      // FILTER STATUS
      if (statusFilter) {
        query = query.eq("is_active", parseInt(statusFilter));
      }

      // =========================
      // ORDERING
      // =========================
      let orderBy = "id";
      let ascending = false;

      if (data.order && data.order.length > 0) {
        const orderColIndex = data.order[0].column;
        const orderDir = data.order[0].dir; // asc / desc

        // Mapping kolom DataTable ke nama field Supabase
        // Kolom: 0 = No, 1 = brand_name, 2 = status, 3 = actions
        const columnMap = {
          1: "brand_name",
          2: "is_active"
        };

        if (columnMap[orderColIndex]) {
          orderBy = columnMap[orderColIndex];
          ascending = orderDir === "asc";
        }
      }

      const { data: brands, count, error } = await query
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
        data: brands.map((b, i) => [
          start + i + 1,
          b.brand_name,
          b.is_active == 1
            ? `<span class="badge bg-success">Active</span>`
            : `<span class="badge bg-secondary">Inactive</span>`,
          `
            <button class="btn btn-sm btn-warning editBrandBtn"
              data-id="${b.id}"
              data-name="${b.brand_name}"
              data-status="${b.is_active}">
              Edit
            </button>
          `
        ])
      });
    }

  });
}

/* =====================================
   MODAL
=====================================*/

function openAddModal() {

  document.getElementById("modalTitle").innerText = "Add Brand";
  document.getElementById("brandId").value = "";
  document.getElementById("brandName").value = "";
  document.getElementById("brandStatus").value = "1"; // default active

  brandModal.show();
}

function openEditModal() {

  const id = $(this).data("id");
  const name = $(this).data("name");
  const status = $(this).data("status");

  document.getElementById("modalTitle").innerText = "Edit Brand";
  document.getElementById("brandId").value = id;
  document.getElementById("brandName").value = name;
  document.getElementById("brandStatus").value = status;

  brandModal.show();
}

/* =====================================
   SAVE
=====================================*/

async function saveBrand(e) {

  e.preventDefault();

  const id = document.getElementById("brandId").value;
  const name = document.getElementById("brandName").value.trim();
  const status = parseInt(document.getElementById("brandStatus").value);

  if (!name) {
    Swal.fire("Warning", "Brand name is required!", "warning");
    return;
  }

  // CHECK DUPLICATE (hanya yg aktif)
  const { data: existing } = await supabase
    .from("brands")
    .select("id")
    .ilike("brand_name", name);

  if (existing.length && existing[0].id != id) {
    Swal.fire("Warning", "Brand already exists!", "warning");
    return;
  }

  let result;

  if (id) {
    result = await supabase
      .from("brands")
      .update({
        brand_name: name,
        is_active: status
      })
      .eq("id", id);
  } else {
    result = await supabase
      .from("brands")
      .insert([{
        brand_name: name,
        is_active: 1 // default active
      }]);
  }

  if (result.error) {
    Swal.fire("Error", result.error.message, "error");
    return;
  }

  brandModal.hide();

  Swal.fire({
    icon: "success",
    title: "Success",
    text: "Brand saved successfully",
    timer: 1500,
    showConfirmButton: false
  });

  brandTable.ajax.reload(null, false);
}
