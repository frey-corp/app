import { supabase } from "../supabase.js";
import { getCurrentUser } from "../app.js";

let mappingTable;
let mappingModal;
let currentUser;

export async function init() {

  currentUser = getCurrentUser();
  if (!currentUser) {
    Swal.fire("Error", "User not logged in", "error");
    return;
  }

  mappingModal = new bootstrap.Modal(document.getElementById("mappingModal"));

  await loadKOLDropdown();
  initDataTable();

  $("#mappingForm").on("submit", async function (e) {
    e.preventDefault();
    await saveMapping();
  });
}

async function loadKOLDropdown() {

  const { data, error } = await supabase
    .from("users")
    .select("id, full_name")
    .eq("role", 3)
    .eq("is_active", 1)
    .order("full_name");

  if (error) {
    Swal.fire("Error", error.message, "error");
    return;
  }

  $("#mappingKOL").empty();

  data.forEach(k => {
    $("#mappingKOL").append(
      `<option value="${k.id}">${k.full_name}</option>`
    );
  });

  $("#mappingKOL").select2({
    dropdownParent: $("#mappingModal"),
    width: "100%"
  });
}

export function initDataTable() {

  $.fn.DataTable.ext.pager.numbers_length = 2;

  mappingTable = $("#mappingTable").DataTable({
    processing: true,
    serverSide: true,
    responsive: true,
    searching: true,
    ordering: true,
    pageLength: 10,
    lengthMenu: [10, 25, 50, 100],
    dom: 'Blfrtip',
    pagingType: "simple_numbers",
    renderer: "bootstrap",

    ajax: async function(data, callback) {
      try {
        const start = data.start;
        const length = data.length;
        const searchValue = data.search.value?.toLowerCase() || "";

        const { data: totalAdminsData, count: totalAdmins, error: errCount } = await supabase
          .from("users")
          .select("id", { count: "exact" })
          .eq("role", 2)
          .eq("is_active", 1);
        if (errCount) throw errCount;

        let query = supabase
          .from("users")
          .select("id, full_name")
          .eq("role", 2)
          .eq("is_active", 1)
          .range(start, start + length - 1);

        if (searchValue) {
          query = query.ilike("full_name", `%${searchValue}%`);
        }

        const { data: admins, error: errAdmins } = await query;
        if (errAdmins) throw errAdmins;

        const { data: mappings, error: errMap } = await supabase
          .from("admin_kol_mapping")
          .select("admin_user_id, kol_user_id");
        if (errMap) throw errMap;

        const rows = admins.map((a, i) => {
          const kolCount = mappings.filter(m => m.admin_user_id === a.id).length;
          return [
            start + i + 1,
            a.full_name,
            kolCount,
            `<button class="btn btn-sm btn-primary editBtn" 
                     data-id="${a.id}" 
                     data-name="${a.full_name}">
               Mapping
             </button>`
          ];
        });

        callback({
          draw: data.draw,
          recordsTotal: totalAdmins,
          recordsFiltered: searchValue ? rows.length : totalAdmins,
          data: rows
        });

      } catch (err) {
        console.error(err);
        Swal.fire("Error", err.message, "error");
        callback({ data: [], recordsTotal: 0, recordsFiltered: 0 });
      }
    }
  });

  bindActions();
}

function bindActions() {

  $("#mappingTable")
    .off("click", ".editBtn")
    .on("click", ".editBtn", function () {

      const adminId = $(this).data("id");
      const adminName = $(this).data("name");

      openModal(adminId, adminName);
    });
}

async function openModal(adminId, adminName) {

  $("#mappingAdminId").val(adminId);
  $("#mappingAdminName").val(adminName);

  const { data } = await supabase
    .from("admin_kol_mapping")
    .select("kol_user_id")
    .eq("admin_user_id", adminId);

  const kolIds = data?.map(x => x.kol_user_id) || [];

  $("#mappingKOL").val(kolIds).trigger("change");

  mappingModal.show();
}

async function saveMapping() {

  const adminId = $("#mappingAdminId").val();
  const kolIds = $("#mappingKOL").val();

  if (!adminId) return;

  // delete old
  await supabase
    .from("admin_kol_mapping")
    .delete()
    .eq("admin_user_id", adminId);

  // insert new
  if (kolIds?.length) {

    const payload = kolIds.map(k => ({
      admin_user_id: adminId,
      kol_user_id: k
    }));

    const { error } = await supabase
      .from("admin_kol_mapping")
      .insert(payload);

    if (error) {
      Swal.fire("Error", error.message, "error");
      return;
    }
  }

  Swal.fire("Success", "Mapping saved", "success");

  mappingModal.hide();
  mappingTable.ajax.reload();
}
