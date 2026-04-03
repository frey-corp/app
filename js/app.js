import { renderNavbar } from "./components/navbar.js";

const app = document.getElementById("app");

let currentUser = null;
let navbarContainer = null;

export function getCurrentUser() {
  return currentUser;
}

export function setCurrentUser(user) {
  currentUser = user;
  localStorage.setItem("currentUser", JSON.stringify(user));
  renderRoleNavbar();
  loadDefaultPageByRole();
}

async function loadPage(page) {
  try {
    if (page !== "login") {
      localStorage.setItem("lastPage", page);
    }

    const res = await fetch(`pages/${page}.html`);
    const html = await res.text();

    app.innerHTML = html;

    if (navbarContainer && page !== "login") {
      app.insertAdjacentElement("afterbegin", navbarContainer);
    }

    const module = await import(`./pages/${page}.js`);
    if (module.init) await module.init();

    const logoutBtn = document.getElementById("btnlogout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        Swal.fire({
          title: "Yakin mau logout?",
          text: "Kamu akan keluar dari akun ini",
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Ya, logout",
          cancelButtonText: "Batal"
        }).then((result) => {
          if (result.isConfirmed) {
            logout();
          }
        });
      });
    }

  } catch (err) {
    app.innerHTML = `<div class="container mt-5"><h3>Page tidak ditemukan</h3></div>`;
    console.error("Load page error:", err);
  }
}

function renderRoleNavbar() {
  if (!currentUser) return;

  navbarContainer = document.createElement("div");
  navbarContainer.innerHTML = renderNavbar(currentUser.role);

  navbarContainer.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const page = btn.dataset.page;
      loadPage(page);
      setActive(page);
    });
  });

  // Semua kode logout dihapus
}

function setActive(page) {
  if (!navbarContainer) return;
  navbarContainer.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.remove("active");
    if (btn.dataset.page === page) {
      btn.classList.add("active");
    }
  });
}


function loadDefaultPageByRole() {
  if (!currentUser) {
    loadPage("login");
    return;
  }

  const lastPage = localStorage.getItem("lastPage");

  switch (currentUser.role) {
    case 1:
      loadPage(lastPage || "management");
      setActive(lastPage || "management");
      break;
    case 2:
      loadPage(lastPage || "deals");
      setActive(lastPage || "deals");
      break;
    case 3:
      loadPage(lastPage || "kol");
      setActive(lastPage || "kol");
      break;
    default:
      loadPage("login");
  }
}

const savedUser = localStorage.getItem("currentUser");

if (savedUser) {
  currentUser = JSON.parse(savedUser);
  renderRoleNavbar();
  loadDefaultPageByRole();
} else {
  loadPage("login");
}

export function logout() {
  currentUser = null;

  // hapus data dari localStorage
  localStorage.removeItem("currentUser");
  localStorage.removeItem("lastPage");

  // reset navbar
  navbarContainer = null;

  // kembali ke halaman login
  loadPage("login");
}
