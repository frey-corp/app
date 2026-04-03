import { supabase } from "../supabase.js";
import { setCurrentUser } from "../app.js";

export async function init() {
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return;

  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const showCheckbox = document.getElementById("show");
  const rememberMe = document.getElementById("rememberMe");

  const savedLogin = localStorage.getItem("rememberLogin");
  if (savedLogin) {
    const parsed = JSON.parse(savedLogin);
    usernameInput.value = parsed.username;
    passwordInput.value = parsed.password;
    rememberMe.checked = true;
  }

  showCheckbox.addEventListener("change", () => {
    passwordInput.type = showCheckbox.checked ? "text" : "password";
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
      Swal.fire({
        icon: "warning",
        title: "Oops...",
        text: "Username & Password wajib diisi"
      });
      return;
    }

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .single();

    if (error || !data) {
      Swal.fire({
        icon: "error",
        title: "Login Gagal",
        text: "User tidak ditemukan"
      });
      return;
    }

    if (password !== data.password_hash) {
      Swal.fire({
        icon: "error",
        title: "Login Gagal",
        text: "Password salah"
      });
      return;
    }

    if (rememberMe.checked) {
      localStorage.setItem("rememberLogin", JSON.stringify({
        username,
        password
      }));
    } else {
      localStorage.removeItem("rememberLogin");
    }

    Swal.fire({
      icon: "success",
      title: "Login Berhasil",
      showConfirmButton: false,
      timer: 1000
    }).then(() => {
      setCurrentUser(data);
    });
  });
}
