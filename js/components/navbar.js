export function renderNavbar(role) {

  let buttons = "";

  if (role === 1) {
    buttons += navItem("management", "bi-briefcase", "Management");
    buttons += navItem("rekaps", "bi bi-clipboard2-data", "Rekapan");
    buttons += navItem("brands", "bi-tags", "Brand");
    buttons += navItem("users", "bi-people", "Users");
    buttons += navItem("mapkol", "bi-diagram-3", "Mapp KOL");
  }

  if (role === 2) {
    buttons += navItem("deals", "bi-receipt", "Deals");
    buttons += navItem("brands", "bi-tags", "Brand");
    buttons += navItem("pitching", "bi-rocket", "Pitching");
    buttons += navItem("dashboard", "bi-speedometer2", "Dashboard");
  }

  if (role === 3) {
    buttons += navItem("kol", "bi-person", "KOL");
    buttons += navItem("dashboardkol", "bi-speedometer2", "Dashboard");
  }

  buttons += `
    <button id="profileBtn" class="nav-item nav-btn" data-page="profile">
      <i class="bi bi-person-circle"></i>
      <span>Profile</span>
    </button>
  `;


  return `
    <nav class="bottom-navbar">
      ${buttons}
    </nav>
  `;
}

function navItem(page, icon, label) {
  return `
    <button class="nav-item nav-btn" data-page="${page}">
      <i class="bi ${icon}"></i>
      <span>${label}</span>
    </button>
  `;
}
