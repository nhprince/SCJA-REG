(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const loginScreen = $("loginScreen");
  const appShell = $("appShell");
  const loginForm = $("loginForm");
  const loginError = $("loginError");
  const loginBtn = $("loginBtn");

  const searchInput = $("searchInput");
  const departmentFilter = $("departmentFilter");
  const sortSelect = $("sortSelect");
  const exportBtn = $("exportBtn");
  const membersTableBody = $("membersTableBody");
  const resultCount = $("resultCount");
  const selectAllCheckbox = $("selectAllCheckbox");
  const selectPendingBtn = $("selectPendingBtn");
  const bulkBar = $("bulkBar");
  const bulkCount = $("bulkCount");
  const bulkConfirmBtn = $("bulkConfirmBtn");
  const bulkClearBtn = $("bulkClearBtn");

  let deptChart = null;
  let currentDeleteId = null;
  let searchDebounce = null;
  let currentMembers = [];
  const selectedIds = new Set();

  // ---------- Helpers ----------

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function initials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]).join("").toUpperCase();
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso.replace(" ", "T") + "Z");
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }

  function openModal(id) {
    $(id).classList.add("active");
  }

  function closeModal(id) {
    $(id).classList.remove("active");
  }

  document.querySelectorAll("[data-close]").forEach((el) => {
    el.addEventListener("click", () => closeModal(el.dataset.close));
  });

  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.classList.remove("active");
    });
  });

  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (res.status === 401) {
      showLogin();
      throw new Error("Session expired. Please log in again.");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  }

  // ---------- Auth ----------

  function showLogin() {
    appShell.classList.remove("active");
    loginScreen.style.display = "flex";
  }

  function showApp() {
    loginScreen.style.display = "none";
    appShell.classList.add("active");
    initDashboard();
  }

  async function checkAuth() {
    try {
      const res = await fetch("/api/admin/check");
      if (res.ok) {
        showApp();
      } else {
        showLogin();
      }
    } catch {
      showLogin();
    }
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.classList.remove("active");
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner"></span>';

    try {
      const password = $("password").value;
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Login failed.");
      $("password").value = "";
      showApp();
    } catch (err) {
      loginError.textContent = err.message;
      loginError.classList.add("active");
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = "Log in";
    }
  });

  $("logoutBtn").addEventListener("click", async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.reload();
  });

  // ---------- Dashboard init ----------

  let dashboardInitialized = false;

  function initDashboard() {
    loadStats();
    loadMembers();

    if (!dashboardInitialized) {
      dashboardInitialized = true;

      searchInput.addEventListener("input", () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(loadMembers, 350);
      });
      departmentFilter.addEventListener("change", loadMembers);
      sortSelect.addEventListener("change", loadMembers);
      exportBtn.addEventListener("click", () => {
        window.location.href = "/api/admin/export";
      });

      selectAllCheckbox.addEventListener("change", () => {
        membersTableBody.querySelectorAll(".row-check").forEach((cb) => {
          cb.checked = selectAllCheckbox.checked;
          toggleSelected(Number(cb.dataset.id), selectAllCheckbox.checked);
        });
        updateBulkBar();
      });

      membersTableBody.addEventListener("change", (e) => {
        if (!e.target.classList.contains("row-check")) return;
        toggleSelected(Number(e.target.dataset.id), e.target.checked);
        updateBulkBar();
      });

      selectPendingBtn.addEventListener("click", () => {
        currentMembers
          .filter((m) => m.confirmation_status !== "confirmed")
          .forEach((m) => selectedIds.add(m.id));
        membersTableBody.querySelectorAll(".row-check").forEach((cb) => {
          cb.checked = selectedIds.has(Number(cb.dataset.id));
        });
        updateBulkBar();
      });

      bulkClearBtn.addEventListener("click", clearSelection);

      bulkConfirmBtn.addEventListener("click", confirmBulk);
    }
  }

  // ---------- Stats ----------

  async function loadStats() {
    try {
      const stats = await api("/api/admin/stats");

      $("statTotal").textContent = stats.total;
      $("statRecent").textContent = stats.recent;
      $("statDepartments").textContent = stats.departments.length;

      const topInterest = Object.entries(stats.interests).sort((a, b) => b[1] - a[1])[0];
      $("statTopInterest").textContent = topInterest ? topInterest[0] : "—";

      populateDepartmentFilter(stats.departments.map((d) => d.department));
      renderChart(stats.departments);
    } catch (err) {
      showToast(err.message);
    }
  }

  function populateDepartmentFilter(departments) {
    const current = departmentFilter.value;
    const options = ['<option value="">All departments</option>']
      .concat(departments.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`));
    departmentFilter.innerHTML = options.join("");
    if (departments.includes(current)) departmentFilter.value = current;
  }

  // Robust Bar Chart Renderer with Brave Shields/Adblock Fallback
  function renderChart(departments) {
    const canvas = $("deptChart");
    if (!canvas) return;

    const labels = departments.map((d) => d.department);
    const counts = departments.map((d) => d.count);

    // Option A: If Chart.js loaded successfully from CDN, use it
    if (typeof Chart !== "undefined") {
      const ctx = canvas.getContext("2d");
      if (deptChart) {
        deptChart.data.labels = labels;
        deptChart.data.datasets[0].data = counts;
        deptChart.update();
        return;
      }

      deptChart = new Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [{
            label: "Members",
            data: counts,
            backgroundColor: "#0a7d3e",
            borderRadius: 6,
            maxBarThickness: 40,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#dcebe2" } },
            x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 60 } },
          },
        },
      });
      return;
    }

    // Option B: High-DPI Native Canvas Fallback (immune to Brave Shields & adblockers)
    renderNativeCanvasChart(canvas, labels, counts);
  }

  function renderNativeCanvasChart(canvas, labels, counts) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 600;
    const height = rect.height || 230;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    if (labels.length === 0) {
      ctx.fillStyle = "#55675d";
      ctx.font = "14px Work Sans, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No department data available yet", width / 2, height / 2);
      return;
    }

    const maxCount = Math.max(...counts, 1);
    const paddingBottom = 40;
    const paddingTop = 25;
    const paddingLeft = 30;
    const paddingRight = 20;

    const chartW = width - paddingLeft - paddingRight;
    const chartH = height - paddingTop - paddingBottom;

    // Draw baseline
    ctx.strokeStyle = "#dcebe2";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, height - paddingBottom);
    ctx.lineTo(width - paddingRight, height - paddingBottom);
    ctx.stroke();

    const barWidth = Math.min(38, Math.max(16, (chartW / labels.length) * 0.6));
    const step = chartW / labels.length;

    labels.forEach((label, i) => {
      const val = counts[i];
      const barH = (val / maxCount) * chartH;
      const x = paddingLeft + i * step + (step - barWidth) / 2;
      const y = height - paddingBottom - barH;

      // Draw rounded bar
      ctx.fillStyle = "#0a7d3e";
      ctx.beginPath();
      const r = Math.min(6, barH);
      ctx.roundRect ? ctx.roundRect(x, y, barWidth, barH, [r, r, 0, 0]) : ctx.rect(x, y, barWidth, barH);
      ctx.fill();

      // Value label on top
      ctx.fillStyle = "#065a2b";
      ctx.font = "bold 12px Work Sans, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(val), x + barWidth / 2, y - 6);

      // Department text underneath
      ctx.fillStyle = "#55675d";
      ctx.font = "11px Work Sans, sans-serif";
      const shortLabel = label.length > 11 ? label.slice(0, 10) + "…" : label;
      ctx.fillText(shortLabel, x + barWidth / 2, height - paddingBottom + 18);
    });
  }

  // ---------- Members table ----------

  async function loadMembers() {
    membersTableBody.innerHTML = '<tr class="loading-row"><td colspan="9">Loading members…</td></tr>';

    const [sortCol, sortOrder] = sortSelect.value.split(":");
    const params = new URLSearchParams({
      search: searchInput.value.trim(),
      department: departmentFilter.value,
      sort: sortCol,
      order: sortOrder,
    });

    try {
      const data = await api(`/api/admin/members?${params.toString()}`);
      clearSelection();
      currentMembers = data.members;
      renderMembers(data.members);
    } catch (err) {
      membersTableBody.innerHTML = `<tr class="loading-row"><td colspan="9">${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function renderMembers(members) {
    resultCount.textContent = `${members.length} member${members.length === 1 ? "" : "s"} found`;

    if (members.length === 0) {
      membersTableBody.innerHTML = `
        <tr><td colspan="9">
          <div class="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 1rem;"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path></svg>
            <div>No members match your filters.</div>
          </div>
        </td></tr>`;
      return;
    }

    membersTableBody.innerHTML = members.map((m) => {
      const avatar = m.has_profile_photo
        ? `<img class="avatar" src="/api/admin/members/${m.id}/photo?field=profile_photo" alt="" />`
        : `<div class="avatar">${escapeHtml(initials(m.full_name))}</div>`;
      const confirmed = m.confirmation_status === "confirmed";

      return `
      <tr>
        <td class="col-check"><input type="checkbox" class="row-check" data-id="${m.id}" /></td>
        <td class="member-name-td" data-label="Name">
          <div class="member-name-cell">
            ${avatar}
            <div class="details">
              <strong>${escapeHtml(m.full_name)}</strong>
              <span>${escapeHtml(m.blood_group || "")}</span>
            </div>
          </div>
        </td>
        <td data-label="Student ID">${escapeHtml(m.student_id)}</td>
        <td data-label="Department">${escapeHtml(m.department)}</td>
        <td data-label="Year / Session">${escapeHtml(m.year)}<br /><span class="text-muted">${escapeHtml(m.session)}</span></td>
        <td data-label="Contact">${escapeHtml(m.email)}<br /><span class="text-muted">${escapeHtml(m.phone)}</span></td>
        <td data-label="Registered">${formatDate(m.created_at)}</td>
        <td data-label="Status">
          <span class="status-badge ${confirmed ? "status-confirmed" : "status-pending"}">${confirmed ? "Confirmed" : "Pending"}</span>
        </td>
        <td data-label="">
          <div class="row-actions">
            <button class="icon-btn" title="View" onclick="AdminPanel.viewMember(${m.id})">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
            <button class="icon-btn" title="${confirmed ? "Resend confirmation email" : "Send confirmation email"}" onclick="AdminPanel.confirmMember(${m.id})">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16v16H4z" opacity="0"></path><path d="M3 7l9 6 9-6"></path><rect x="3" y="5" width="18" height="14" rx="2"></rect></svg>
            </button>
            <button class="icon-btn" title="Edit" onclick="AdminPanel.editMember(${m.id})">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>
            </button>
            <button class="icon-btn danger" title="Delete" onclick="AdminPanel.deleteMember(${m.id}, '${escapeHtml(m.full_name).replace(/'/g, "\\'")}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
    }).join("");
  }

  // ---------- Bulk selection & bulk confirm ----------

  function toggleSelected(id, isSelected) {
    if (isSelected) selectedIds.add(id);
    else selectedIds.delete(id);
  }

  function clearSelection() {
    selectedIds.clear();
    membersTableBody.querySelectorAll(".row-check").forEach((cb) => (cb.checked = false));
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    updateBulkBar();
  }

  function updateBulkBar() {
    const count = selectedIds.size;
    bulkCount.textContent = `${count} selected`;
    bulkBar.classList.toggle("active", count > 0);
  }

  async function confirmBulk() {
    if (selectedIds.size === 0) return;

    bulkConfirmBtn.disabled = true;
    const originalText = bulkConfirmBtn.textContent;
    bulkConfirmBtn.innerHTML = '<span class="spinner"></span>';

    try {
      const data = await api("/api/admin/members/confirm-bulk", {
        method: "POST",
        body: JSON.stringify({ ids: [...selectedIds] }),
      });

      const parts = [];
      if (data.sent) parts.push(`${data.sent} sent`);
      if (data.failed && data.failed.length) parts.push(`${data.failed.length} failed`);
      if (data.skipped && data.skipped.length) parts.push(`${data.skipped.length} hit the daily limit`);
      showToast(data.warning || (parts.length ? parts.join(", ") + "." : "No emails were sent."));

      clearSelection();
      loadMembers();
      loadStats();
    } catch (err) {
      showToast(err.message || "Bulk send failed.");
    } finally {
      bulkConfirmBtn.disabled = false;
      bulkConfirmBtn.textContent = originalText;
    }
  }

  // ---------- View modal ----------

  async function viewMember(id) {
    openModal("viewModal");
    $("viewModalBody").innerHTML = '<p class="text-muted">Loading…</p>';

    try {
      const { member: m } = await api(`/api/admin/members/${id}`);

      let html = "";

      html += `<div class="modal-photos">`;
      if (m.profile_photo) html += `<div><img src="${m.profile_photo}" alt="Profile" /><div class="photo-label">Profile</div></div>`;
      if (m.id_document_photo) html += `<div><img src="${m.id_document_photo}" alt="ID document" /><div class="photo-label">ID / Birth cert.</div></div>`;
      html += `</div>`;

      const confirmed = m.confirmation_status === "confirmed";
      html += `<div class="modal-section-title">Confirmation</div><div class="detail-grid">`;
      html += `<div><div class="k">Status</div><div class="v"><span class="status-badge ${confirmed ? "status-confirmed" : "status-pending"}">${confirmed ? "Confirmed" : "Pending"}</span></div></div>`;
      html += `<div><div class="k">${confirmed ? "Confirmed on" : "Sent"}</div><div class="v">${m.confirmed_at ? formatDate(m.confirmed_at) : "—"}</div></div>`;
      html += `<div class="detail-full"><button type="button" class="btn btn-ghost btn-sm" onclick="AdminPanel.confirmMember(${m.id})">${confirmed ? "Resend confirmation email" : "Send confirmation email"}</button></div>`;
      html += `</div>`;

      html += `<div class="modal-section-title">Personal</div><div class="detail-grid">`;
      html += `<div><div class="k">Full name</div><div class="v">${escapeHtml(m.full_name)}</div></div>`;
      html += `<div><div class="k">Date of birth</div><div class="v">${escapeHtml(m.date_of_birth) || "—"}</div></div>`;
      html += `<div><div class="k">Blood group</div><div class="v">${escapeHtml(m.blood_group) || "—"}</div></div>`;
      html += `</div>`;

      html += `<div class="modal-section-title">Academic</div><div class="detail-grid">`;
      html += `<div><div class="k">Student ID</div><div class="v">${escapeHtml(m.student_id)}</div></div>`;
      html += `<div><div class="k">Department / Group</div><div class="v">${escapeHtml(m.department)}</div></div>`;
      html += `<div><div class="k">Year</div><div class="v">${escapeHtml(m.year)}</div></div>`;
      html += `<div><div class="k">Session</div><div class="v">${escapeHtml(m.session)}</div></div>`;
      html += `</div>`;

      html += `<div class="modal-section-title">Contact & guardian</div><div class="detail-grid">`;
      html += `<div><div class="k">Email</div><div class="v">${escapeHtml(m.email)}</div></div>`;
      html += `<div><div class="k">Phone</div><div class="v">${escapeHtml(m.phone)}</div></div>`;
      html += `<div class="detail-full"><div class="k">Present address</div><div class="v">${escapeHtml(m.present_address) || "—"}</div></div>`;
      html += `<div class="detail-full"><div class="k">Permanent address</div><div class="v">${escapeHtml(m.permanent_address) || "—"}</div></div>`;
      html += `<div><div class="k">Guardian's name</div><div class="v">${escapeHtml(m.guardian_name) || "—"}</div></div>`;
      html += `<div><div class="k">Guardian's phone</div><div class="v">${escapeHtml(m.guardian_phone) || "—"}</div></div>`;
      html += `</div>`;

      html += `<div class="modal-section-title">Additional</div><div class="detail-grid">`;
      html += `<div class="detail-full"><div class="k">Interests</div><div class="v">${m.interests.length ? escapeHtml(m.interests.join(", ")) : "—"}</div></div>`;
      html += `<div class="detail-full"><div class="k">Social link</div><div class="v">${m.social_link ? `<a href="${escapeHtml(m.social_link)}" target="_blank" rel="noopener">${escapeHtml(m.social_link)}</a>` : "—"}</div></div>`;
      html += `<div class="detail-full"><div class="k">Reason to join</div><div class="v">${escapeHtml(m.reason_to_join) || "—"}</div></div>`;
      html += `<div class="detail-full"><div class="k">Previous experience</div><div class="v">${escapeHtml(m.previous_experience) || "—"}</div></div>`;
      html += `<div class="detail-full"><div class="k">Registered on</div><div class="v">${formatDate(m.created_at)}</div></div>`;
      html += `</div>`;

      $("viewModalBody").innerHTML = html;
    } catch (err) {
      $("viewModalBody").innerHTML = `<p class="text-muted">${escapeHtml(err.message)}</p>`;
    }
  }

  // ---------- Edit modal ----------

  // Holds newly-selected (not yet saved) photo data URIs, keyed by field name.
  // A field is only sent in the PUT payload if the admin actually picked a
  // new photo — otherwise the existing photo on the server is left alone.
  const editPhotoState = {};

  function compressImage(file, maxDim = 900, quality = 0.72) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read file."));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error("Could not read image."));
        img.onload = () => {
          let { width, height } = img;
          if (width > height && width > maxDim) {
            height = Math.round(height * (maxDim / width));
            width = maxDim;
          } else if (height >= width && height > maxDim) {
            width = Math.round(width * (maxDim / height));
            height = maxDim;
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function editField(id, label, value, type = "text") {
    if (type === "textarea") {
      return `<div class="field"><label for="${id}">${escapeHtml(label)}</label><textarea id="${id}" rows="2">${escapeHtml(value || "")}</textarea></div>`;
    }
    return `<div class="field"><label for="${id}">${escapeHtml(label)}</label><input type="${type}" id="${id}" value="${escapeHtml(value || "")}" /></div>`;
  }

  function photoEditField(fieldKey, label, currentValue) {
    const hasPhoto = !!currentValue;
    return `
      <div class="field">
        <label>${escapeHtml(label)}</label>
        <div class="upload-card">
          <div class="upload-preview" id="editPreview_${fieldKey}">
            ${hasPhoto
              ? `<img src="${currentValue}" alt="" />`
              : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"></circle><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6"></path></svg>`}
          </div>
          <div class="upload-content">
            <strong id="editLabel_${fieldKey}">${hasPhoto ? "Photo on file" : "No photo on file"}</strong>
            <span class="upload-subtext">JPG or PNG, resized automatically</span>
            <div class="upload-btn-group">
              <button type="button" class="btn-action btn-browse" data-photo-trigger="${fieldKey}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                Change Photo
              </button>
            </div>
          </div>
          <input type="file" id="editFile_${fieldKey}" accept="image/*" class="visually-hidden" />
        </div>
      </div>`;
  }

  async function handleEditPhotoChange(fieldKey, file) {
    if (!file) return;
    const label = $(`editLabel_${fieldKey}`);
    const originalLabel = label.textContent;
    label.textContent = "Processing image…";

    try {
      const dataUrl = await compressImage(file);
      editPhotoState[fieldKey] = dataUrl;
      $(`editPreview_${fieldKey}`).innerHTML = `<img src="${dataUrl}" alt="" />`;
      label.textContent = "New photo selected";
    } catch {
      label.textContent = originalLabel;
      showToast("Couldn't read that image — please try another file.");
    }
  }

  async function editMember(id) {
    openModal("editModal");
    $("editModalBody").innerHTML = '<p class="text-muted">Loading…</p>';
    $("edit_id").value = id;
    editPhotoState.profile_photo = undefined;
    editPhotoState.id_document_photo = undefined;

    try {
      const { member: m } = await api(`/api/admin/members/${id}`);

      let html = "";
      html += photoEditField("profile_photo", "Profile photo", m.profile_photo);
      html += `<div class="field-row">${editField("edit_full_name", "Full name", m.full_name)}${editField("edit_student_id", "Student ID", m.student_id)}</div>`;
      html += `<div class="field-row">${editField("edit_department", "Department / Group", m.department)}${editField("edit_year", "Year", m.year)}</div>`;
      html += `<div class="field-row">${editField("edit_session", "Session", m.session)}${editField("edit_blood_group", "Blood group", m.blood_group)}</div>`;
      html += `<div class="field-row">${editField("edit_email", "Email", m.email, "email")}${editField("edit_phone", "Phone", m.phone, "tel")}</div>`;
      html += editField("edit_present_address", "Present address", m.present_address, "textarea");
      html += editField("edit_permanent_address", "Permanent address", m.permanent_address, "textarea");
      html += `<div class="field-row">${editField("edit_guardian_name", "Guardian's name", m.guardian_name)}${editField("edit_guardian_phone", "Guardian's phone", m.guardian_phone)}</div>`;
      html += editField("edit_reason_to_join", "Reason to join", m.reason_to_join, "textarea");
      html += editField("edit_previous_experience", "Previous experience", m.previous_experience, "textarea");
      html += editField("edit_social_link", "Social link", m.social_link, "url");
      html += photoEditField("id_document_photo", "ID card / birth certificate", m.id_document_photo);

      $("editModalBody").innerHTML = html;

      $("editModalBody").querySelectorAll("[data-photo-trigger]").forEach((btn) => {
        const fieldKey = btn.dataset.photoTrigger;
        btn.addEventListener("click", () => $(`editFile_${fieldKey}`).click());
        $(`editFile_${fieldKey}`).addEventListener("change", (e) => {
          handleEditPhotoChange(fieldKey, e.target.files && e.target.files[0]);
        });
      });
    } catch (err) {
      $("editModalBody").innerHTML = `<p class="text-muted">${escapeHtml(err.message)}</p>`;
    }
  }

  $("editForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = $("edit_id").value;
    const saveBtn = $("saveEditBtn");
    saveBtn.disabled = true;
    const originalText = saveBtn.textContent;
    saveBtn.innerHTML = '<span class="spinner"></span>';

    const payload = {
      full_name: $("edit_full_name").value.trim(),
      student_id: $("edit_student_id").value.trim(),
      department: $("edit_department").value.trim(),
      year: $("edit_year").value.trim(),
      session: $("edit_session").value.trim(),
      blood_group: $("edit_blood_group").value.trim(),
      email: $("edit_email").value.trim(),
      phone: $("edit_phone").value.trim(),
      present_address: $("edit_present_address").value.trim(),
      permanent_address: $("edit_permanent_address").value.trim(),
      guardian_name: $("edit_guardian_name").value.trim(),
      guardian_phone: $("edit_guardian_phone").value.trim(),
      reason_to_join: $("edit_reason_to_join").value.trim(),
      previous_experience: $("edit_previous_experience").value.trim(),
      social_link: $("edit_social_link").value.trim(),
    };

    if (editPhotoState.profile_photo) payload.profile_photo = editPhotoState.profile_photo;
    if (editPhotoState.id_document_photo) payload.id_document_photo = editPhotoState.id_document_photo;

    try {
      await api(`/api/admin/members/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      closeModal("editModal");
      showToast("Member updated.");
      loadMembers();
      loadStats();
    } catch (err) {
      showToast(err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = originalText;
    }
  });

  // ---------- Delete ----------

  function deleteMember(id, name) {
    currentDeleteId = id;
    $("deleteMemberName").textContent = name;
    openModal("deleteModal");
  }

  $("confirmDeleteBtn").addEventListener("click", async () => {
    if (!currentDeleteId) return;
    const btn = $("confirmDeleteBtn");
    btn.disabled = true;

    try {
      await api(`/api/admin/members/${currentDeleteId}`, { method: "DELETE" });
      closeModal("deleteModal");
      showToast("Member removed.");
      loadMembers();
      loadStats();
    } catch (err) {
      showToast(err.message);
    } finally {
      btn.disabled = false;
      currentDeleteId = null;
    }
  });

  // ---------- Confirmation email ----------

  const confirmInFlight = new Set();

  async function confirmMember(id) {
    if (confirmInFlight.has(id)) return;
    confirmInFlight.add(id);

    try {
      const data = await api(`/api/admin/members/${id}/confirm`, { method: "POST" });
      showToast(data.warning || data.message || "Confirmation email sent.");
      loadMembers();
      if (document.getElementById("viewModal").classList.contains("active")) {
        viewMember(id);
      }
    } catch (err) {
      showToast(err.message || "Failed to send confirmation email.");
    } finally {
      confirmInFlight.delete(id);
    }
  }

  window.AdminPanel = { viewMember, editMember, deleteMember, confirmMember };

  checkAuth();
})();