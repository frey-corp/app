import { supabase } from "../supabase.js";
import { getCurrentUser } from "../app.js";

let usersTable;
let userModal;
let currentUser;

export async function init() {
  currentUser = getCurrentUser();
  if (!currentUser) {
    Swal.fire("Error", "User not logged in", "error");
    return;
  }

  userModal = new bootstrap.Modal(document.getElementById("userModal"));

  initDataTable();

  $("#btnAddUser").on("click", () => openUserModal());

  $("#userForm").on("submit", async function(e) {
    e.preventDefault();
    await saveUser();
  });
}

function roleName(role) {
  switch (role) {
    case 1: return "Management";
    case 2: return "Admin";
    case 3: return "KOL";
    default: return "-";
  }
}

function statusBadge(is_active) {
  return is_active == 1
    ? `<span class="badge bg-success">Active</span>`
    : `<span class="badge bg-secondary">Inactive</span>`;
}

function initDataTable() {

  $.fn.DataTable.ext.pager.numbers_length = 2;

  usersTable = $("#usersTable").DataTable({
    processing: true,
    serverSide: true,
    searching: true,
    responsive: true,
    ordering: true,
    pageLength: 25,
    lengthMenu: [10, 25, 50, 100],
    dom: 'Blfrtip',
    pagingType: "simple_numbers",
    renderer: "bootstrap",

    ajax: async function(data, callback) {
      const start = data.start;
      const length = data.length;
      const searchValue = data.search.value;

      let query = supabase
        .from("users")
        .select("*", { count: "exact" });

      // SEARCH
      if (searchValue) {
        const safeSearch = searchValue.replace(/[,()]/g, "");
        const search = `%${safeSearch}%`;

        const filters = [
          `username.ilike.${search}`,
          `full_name.ilike.${search}`
        ];

        query = query.or(filters.join(",")); 
      }

      // =========================
      // ORDERING
      // =========================
      let orderBy = "created_at";
      let ascending = false;

      if (data.order && data.order.length > 0) {
        const orderColIndex = data.order[0].column;
        const orderDir = data.order[0].dir; // asc / desc

        // Mapping kolom DataTable ke nama field Supabase
        const columnMap = {
          1: "username",
          2: "full_name",
          3: "role",
          4: "instagram_account",
          5: "tiktok_account",
          6: "whatsapp_number",
          7: "bank_name",
          8: "bank_account_number",
          9: "alamat",
          10: "is_active"
        };

        if (columnMap[orderColIndex]) {
          orderBy = columnMap[orderColIndex];
          ascending = orderDir === "asc";
        }
      }

      const { data: users, count, error } = await query
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
        data: users.map((u, i) => [
          start + i + 1,
          u.username,
          u.full_name,
          roleName(u.role),
          u.instagram_account || "",
          u.tiktok_account || "",
          u.whatsapp_number || "",
          u.bank_name || "",
          u.bank_account_number || "",
          u.alamat || "",
          statusBadge(u.is_active),
          `
            <button class="btn btn-sm btn-warning editBtn" data-id="${u.id}">Edit</button>
          `
        ])
      });
    }
  });

  bindTableActions();
}


function bindTableActions() {
  $("#usersTable").off("click", ".editBtn").on("click", ".editBtn", function() {
    editUser($(this).data("id"));
  });
}

function openUserModal(user = null) {
  $("#userForm")[0].reset();
  $("#userId").val("");
  $("#userModalTitle").text(user ? "Edit User" : "Add User");

  // Default untuk add
  $("#username").prop("disabled", false);
  $("#password").prop("required", true);
  $("#role").val(2);       // default Admin
  $("#isActive").val(1);   // default Active

  if (user) {
    $("#userId").val(user.id);
    $("#username").val(user.username).prop("disabled", true);
    $("#password").val(user.password_hash).prop("required", false);
    $("#fullName").val(user.full_name);
    $("#role").val(user.role);
    $("#alamat").val(user.alamat || "");
    $("#instagram").val(user.instagram_account || "");
    $("#tiktok").val(user.tiktok_account || "");
    $("#whatsapp").val(user.whatsapp_number || "");
    $("#bankName").val(user.bank_name || "");
    $("#bankAccount").val(user.bank_account_number || "");
    $("#isActive").val(user.is_active || 1);
  }

  userModal.show();
}

async function editUser(id) {
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    Swal.fire("Error", error.message, "error");
    return;
  }

  openUserModal(user);
}

async function saveUser() {
  const id = $("#userId").val();
  const payload = {
    username: $("#username").val(),
    password_hash: $("#password").val(),
    full_name: $("#fullName").val(),
    role: parseInt($("#role").val()),
    is_active: parseInt($("#isActive").val()),
    alamat: $("#alamat").val(),
    instagram_account: $("#instagram").val(),
    tiktok_account: $("#tiktok").val(),
    whatsapp_number: $("#whatsapp").val(),
    bank_name: $("#bankName").val(),
    bank_account_number: $("#bankAccount").val(),
    updated_at: new Date()
  };

  let result;
  if (id) {
    // edit
    if (!payload.password_hash) delete payload.password_hash; // jangan ubah password kalau kosong
    result = await supabase.from("users").update(payload).eq("id", id);
  } else {
    // insert
    payload.is_active = 1; // default active
    result = await supabase.from("users").insert(payload);
  }

  if (result.error) {
    Swal.fire("Error", result.error.message, "error");
    return;
  }

  Swal.fire("Success", "User saved", "success");
  userModal.hide();
  usersTable.ajax.reload();
}
