import { supabase } from "../supabase.js";
import { getCurrentUser } from "../app.js";

let currentUser;

export async function init() {
  currentUser = getCurrentUser();
  if (!currentUser) {
    Swal.fire("Error", "User not logged in", "error");
    return;
  }

  // ======================
  // Populate form with current data
  // ======================
  const { data: userData, error: fetchError } = await supabase
    .from("users")
    .select("*")
    .eq("id", currentUser.id)
    .single();

  if (fetchError) {
    Swal.fire("Error", fetchError.message, "error");
    return;
  }

  currentUser = userData;

  $("#userId").val(currentUser.id);
  $("#username").val(currentUser.username);
  $("#fullName").val(currentUser.full_name || "");
  $("#alamat").val(currentUser.alamat || "");
  $("#instagram").val(currentUser.instagram_account || "");
  $("#tiktok").val(currentUser.tiktok_account || "");
  $("#whatsapp").val(currentUser.whatsapp_number || "");
  $("#whatsappAdmin").val(currentUser.whatsapp_number_admin || "");
  $("#bankName").val(currentUser.bank_name || "");
  $("#bankAccount").val(currentUser.bank_account_number || "");

  // ======================
  // Update Profile
  // ======================
  $("#profileForm").on("submit", async function(e) {
    e.preventDefault();

    const payload = {
      full_name: $("#fullName").val(),
      alamat: $("#alamat").val(),
      instagram_account: $("#instagram").val(),
      tiktok_account: $("#tiktok").val(),
      whatsapp_number: $("#whatsapp").val(),
      whatsapp_number_admin: $("#whatsappAdmin").val(),
      bank_name: $("#bankName").val(),
      bank_account_number: $("#bankAccount").val(),
      updated_at: new Date()
    };

    const { error } = await supabase
      .from("users")
      .update(payload)
      .eq("id", currentUser.id);

    if (error) {
      Swal.fire("Error", error.message, "error");
      return;
    }

    // update local currentUser
    Object.assign(currentUser, payload);

    Swal.fire("Success", "Profile updated", "success");
  });

  // ======================
  // Change Password
  // ======================
  $("#passwordForm").on("submit", async function(e) {
    e.preventDefault();

    const oldPassword = $("#oldPassword").val();
    const newPassword = $("#newPassword").val();

    if (oldPassword !== currentUser.password_hash) {
      Swal.fire("Error", "Old password incorrect", "error");
      return;
    }

    const { error } = await supabase
      .from("users")
      .update({ password_hash: newPassword, updated_at: new Date() })
      .eq("id", currentUser.id);

    if (error) {
      Swal.fire("Error", error.message, "error");
      return;
    }

    currentUser.password_hash = newPassword;
    Swal.fire("Success", "Password changed", "success");

    $("#oldPassword").val("");
    $("#newPassword").val("");
  });

  // ======================
  // Logout
  // ======================
  $("#logoutBtn").on("click", () => {
    currentUser = null;
    window.location.reload(); // akan load login page
  });

  // Toggle show/hide password
    $("#showPassword").on("change", function() {
        const type = this.checked ? "text" : "password";
        $("#oldPassword").attr("type", type);
        $("#newPassword").attr("type", type);
    });

}
