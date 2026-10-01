(() => {
  "use strict";

  const TOTAL_STEPS = 6;
  const STEP_TITLES = {
    1: "Personal Information",
    2: "Academic Information",
    3: "Contact & Guardian",
    4: "Additional Information",
    5: "Documents",
    6: "Review & Submit",
  };

  const state = {
    currentStep: 1,
    profile_photo: null,
    id_document_photo: null,
    processingProfile: false,
    processingId: false,
  };

  const $ = (id) => document.getElementById(id);

  const form = $("registrationForm");
  const progressTrack = $("progressTrack");
  const stepTitleEl = $("stepTitle");
  const stepCountEl = $("stepCount");
  const backBtn = $("backBtn");
  const nextBtn = $("nextBtn");
  const submitError = $("submitError");
  const formShell = $("formShell");
  const successScreen = $("successScreen");

  const yearSelect = $("year");
  const departmentSelect = $("department");
  const departmentOtherField = $("field_department_other");
  const departmentOtherInput = $("department_other");

  // ---------- Academic levels: HSC groups & Honours departments ----------

  const HSC_GROUPS = ["Science", "Business Studies", "Humanities"];

  // Honours departments offered by Govt. Shaheed Suhrawardy College,
  // organised by faculty as listed on the college website.
  const HONOURS_DEPARTMENTS = [
    {
      label: "Humanities",
      items: [
        "Bangla",
        "English",
        "Arabic",
        "History",
        "Islamic History & Culture",
        "Philosophy",
        "Islamic Studies",
        "Political Science",
        "Economics",
      ],
    },
    {
      label: "Science",
      items: ["Physics", "Chemistry", "Botany", "Zoology", "Geography & Environment", "Mathematics"],
    },
    {
      label: "Commerce",
      items: ["Accounting", "Management"],
    },
  ];

  const DEPARTMENT_COPY = {
    none: {
      label: "Group / Department",
      placeholder: "Select your academic year first",
      error: "Please select your group or department.",
      hint: "HSC students choose a group; Honours students choose their department.",
      otherLabel: "Please specify",
      otherPlaceholder: "Your group or department",
    },
    hsc: {
      label: "Group",
      placeholder: "Select your group",
      error: "Please select your group.",
      hint: "Choose your HSC group.",
      otherLabel: "Please specify your group",
      otherPlaceholder: "Your group or track",
    },
    honours: {
      label: "Department",
      placeholder: "Select your department",
      error: "Please select your department.",
      hint: "Choose your Honours department.",
      otherLabel: "Please specify your department",
      otherPlaceholder: "Your department",
    },
  };

  function levelOf(yearValue) {
    if (!yearValue) return "none";
    return yearValue.indexOf("Honours") === 0 ? "honours" : "hsc";
  }

  const sameAddressCheckbox = $("sameAddress");
  const presentAddressInput = $("present_address");
  const permanentAddressField = $("field_permanent_address");
  const permanentAddressInput = $("permanent_address");

  window.$ = $;

  // ---------- Live Camera Viewfinder Engine (WebRTC) ----------

  let activeCameraStream = null;
  let currentTargetPhotoKey = null;
  let currentFacingMode = "user"; // "user" (front) or "environment" (rear)

  const cameraModal = $("cameraModal");
  const cameraVideo = $("cameraVideo");
  const cameraGuide = $("cameraGuide");
  const cameraModalTitle = $("cameraModalTitle");
  const cameraSwitchBtn = $("cameraSwitchBtn");
  const cameraCloseBtn = $("cameraCloseBtn");
  const cameraCaptureBtn = $("cameraCaptureBtn");

  async function startCameraStream() {
    if (activeCameraStream) {
      activeCameraStream.getTracks().forEach((track) => track.stop());
    }

    try {
      const constraints = {
        video: {
          facingMode: currentFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      };

      activeCameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      cameraVideo.srcObject = activeCameraStream;

      // Mirror preview if using front selfie camera
      cameraVideo.classList.toggle("mirror", currentFacingMode === "user");
    } catch (err) {
      alert("Unable to access camera. Please allow camera permissions in your browser or use the 'Upload File' button.");
      closeCameraModal();
    }
  }

  function openCamera(targetKey) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Direct camera access is not supported by your browser. Please use 'Upload File'.");
      $(targetKey).click();
      return;
    }

    currentTargetPhotoKey = targetKey;
    if (targetKey === "profile_photo") {
      cameraModalTitle.textContent = "Take Profile Photo";
      currentFacingMode = "user"; // front camera
      cameraGuide.className = "camera-guide guide-profile";
    } else {
      cameraModalTitle.textContent = "Capture ID / Document";
      currentFacingMode = "environment"; // rear camera on mobile
      cameraGuide.className = "camera-guide guide-document";
    }

    cameraModal.classList.add("active");
    startCameraStream();
  }

  function closeCameraModal() {
    if (activeCameraStream) {
      activeCameraStream.getTracks().forEach((track) => track.stop());
      activeCameraStream = null;
    }
    cameraVideo.srcObject = null;
    cameraModal.classList.remove("active");
    currentTargetPhotoKey = null;
  }

  cameraCloseBtn.addEventListener("click", closeCameraModal);
  cameraModal.addEventListener("click", (e) => {
    if (e.target === cameraModal) closeCameraModal();
  });

  cameraSwitchBtn.addEventListener("click", () => {
    currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
    startCameraStream();
  });

  cameraCaptureBtn.addEventListener("click", async () => {
    if (!activeCameraStream) return;

    const canvas = $("cameraCanvas");
    canvas.width = cameraVideo.videoWidth || 1280;
    canvas.height = cameraVideo.videoHeight || 960;
    const ctx = canvas.getContext("2d");

    // Mirror image on canvas if front camera was used
    if (currentFacingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
    const rawDataUrl = canvas.toDataURL("image/jpeg", 0.88);

    const isProfile = currentTargetPhotoKey === "profile_photo";
    const previewEl = $(isProfile ? "profilePreview" : "idDocPreview");
    const labelEl = $(isProfile ? "profileUploadLabel" : "idDocUploadLabel");

    state[currentTargetPhotoKey] = rawDataUrl;
    previewEl.innerHTML = `<img src="${rawDataUrl}" alt="" style="width:100%;height:100%;object-fit:cover;" />`;
    labelEl.textContent = "Photo captured ✓";

    if (!isProfile) setError("field_id_document_photo", true);

    closeCameraModal();
  });

  window.openCamera = openCamera;

  // ---------- Modern Custom Select Component ----------

  function initCustomSelect(selectEl) {
    if (!selectEl || selectEl.dataset.customized === "true") return;
    selectEl.dataset.customized = "true";

    selectEl.style.position = "absolute";
    selectEl.style.opacity = "0";
    selectEl.style.pointerEvents = "none";
    selectEl.style.width = "1px";
    selectEl.style.height = "1px";

    const wrapper = document.createElement("div");
    wrapper.className = "custom-select-wrapper";

    const trigger = document.createElement("div");
    trigger.className = "custom-select-trigger";
    trigger.setAttribute("tabindex", "0");

    const triggerText = document.createElement("span");
    triggerText.className = "trigger-text";
    triggerText.textContent = selectEl.options[selectEl.selectedIndex]?.text || "Select";

    trigger.innerHTML = `
      <svg class="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    `;
    trigger.prepend(triggerText);

    const menu = document.createElement("div");
    menu.className = "custom-select-menu";

    function buildOptions() {
      menu.innerHTML = "";
      const children = Array.from(selectEl.children);

      children.forEach((child) => {
        if (child.tagName === "OPTGROUP") {
          const groupHeader = document.createElement("div");
          groupHeader.className = "custom-select-group-header";
          groupHeader.textContent = child.label;
          menu.appendChild(groupHeader);

          Array.from(child.children).forEach((opt) => createOption(opt));
        } else if (child.tagName === "OPTION") {
          createOption(child);
        }
      });
    }

    function createOption(opt) {
      const optEl = document.createElement("div");
      optEl.className = "custom-select-option" + (opt.value === selectEl.value ? " selected" : "");
      optEl.textContent = opt.textContent;
      optEl.dataset.value = opt.value;

      optEl.addEventListener("click", (e) => {
        e.stopPropagation();
        selectEl.value = opt.value;
        triggerText.textContent = opt.textContent;

        menu.querySelectorAll(".custom-select-option").forEach((o) => o.classList.remove("selected"));
        optEl.classList.add("selected");
        wrapper.classList.remove("open");

        selectEl.dispatchEvent(new Event("change", { bubbles: true }));
      });

      menu.appendChild(optEl);
    }

    buildOptions();

    // Lets other code swap the <select>'s options and have the custom menu follow.
    selectEl.addEventListener("refresh", () => {
      buildOptions();
      triggerText.textContent = selectEl.options[selectEl.selectedIndex]?.text || "Select";
    });

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = wrapper.classList.contains("open");
      document.querySelectorAll(".custom-select-wrapper.open").forEach((w) => w.classList.remove("open"));
      if (!isOpen) wrapper.classList.add("open");
    });

    trigger.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        wrapper.classList.toggle("open");
      } else if (e.key === "Escape") {
        wrapper.classList.remove("open");
      }
    });

    selectEl.parentNode.insertBefore(wrapper, selectEl);
    wrapper.appendChild(trigger);
    wrapper.appendChild(menu);
    wrapper.appendChild(selectEl);

    selectEl.addEventListener("change", () => {
      const selected = selectEl.options[selectEl.selectedIndex];
      if (selected) {
        triggerText.textContent = selected.text;
        menu.querySelectorAll(".custom-select-option").forEach((opt) => {
          opt.classList.toggle("selected", opt.dataset.value === selectEl.value);
        });
      }
    });
  }

  document.addEventListener("click", () => {
    document.querySelectorAll(".custom-select-wrapper.open").forEach((w) => w.classList.remove("open"));
  });

  function setupAllCustomSelects() {
    document.querySelectorAll("select").forEach(initCustomSelect);
  }

  // ---------- Progress bar ----------

  function buildProgressTrack() {
    progressTrack.innerHTML = "";
    for (let i = 1; i <= TOTAL_STEPS; i++) {
      const segment = document.createElement("div");
      segment.className = "segment";
      segment.dataset.segment = String(i);
      segment.innerHTML = '<div class="fill"></div>';
      progressTrack.appendChild(segment);
    }
  }

  function updateProgress() {
    document.querySelectorAll(".segment").forEach((seg) => {
      const i = Number(seg.dataset.segment);
      seg.classList.toggle("done", i < state.currentStep);
      seg.classList.toggle("current", i === state.currentStep);
    });
    stepTitleEl.textContent = STEP_TITLES[state.currentStep];
    stepCountEl.textContent = `Step ${state.currentStep} of ${TOTAL_STEPS}`;
  }

  // ---------- Step navigation ----------

  function showStep(step) {
    document.querySelectorAll(".step").forEach((el) => {
      el.classList.toggle("active", Number(el.dataset.step) === step);
    });
    state.currentStep = step;
    updateProgress();

    backBtn.style.visibility = step === 1 ? "hidden" : "visible";

    if (step === TOTAL_STEPS) {
      nextBtn.textContent = "Submit Registration";
    } else if (step === TOTAL_STEPS - 1) {
      nextBtn.textContent = "Continue to Review";
    } else {
      nextBtn.textContent = "Continue";
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setError(fieldId, isValid) {
    const el = $(fieldId);
    if (el) el.classList.toggle("has-error", !isValid);
    return isValid;
  }

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function validateStep(step) {
    let valid = true;

    if (step === 1) {
      valid = setError("field_full_name", $("full_name").value.trim() !== "") && valid;
    }

    if (step === 2) {
      valid = setError("field_student_id", $("student_id").value.trim() !== "") && valid;

      const deptValue = departmentSelect.value;
      const deptValid = deptValue !== "" && (deptValue !== "__other__" || departmentOtherInput.value.trim() !== "");
      valid = setError("field_department", deptValid) && valid;
      if (deptValue === "__other__") {
        valid = setError("field_department_other", departmentOtherInput.value.trim() !== "") && valid;
      }

      valid = setError("field_year", $("year").value.trim() !== "") && valid;
      valid = setError("field_session", $("session").value.trim() !== "") && valid;
    }

    if (step === 3) {
      valid = setError("field_email", isEmail($("email").value.trim())) && valid;
      valid = setError("field_phone", $("phone").value.trim() !== "") && valid;
    }

    if (step === 5) {
      if (state.processingId) return false;
      valid = setError("field_id_document_photo", !!state.id_document_photo) && valid;
    }

    return valid;
  }

  backBtn.addEventListener("click", () => {
    if (state.currentStep > 1) showStep(state.currentStep - 1);
  });

  nextBtn.addEventListener("click", () => {
    if (state.currentStep === TOTAL_STEPS) {
      submitForm();
      return;
    }

    if (!validateStep(state.currentStep)) return;

    const next = state.currentStep + 1;
    if (next === TOTAL_STEPS) buildReview();
    showStep(next);
  });

  function updateDepartmentOtherField() {
    departmentOtherField.style.display = departmentSelect.value === "__other__" ? "block" : "none";
  }

  function populateDepartments() {
    const level = levelOf(yearSelect.value);
    const copy = DEPARTMENT_COPY[level];
    const previous = departmentSelect.value;

    const addOption = (parent, value, text) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = text;
      parent.appendChild(opt);
    };

    departmentSelect.innerHTML = "";
    addOption(departmentSelect, "", copy.placeholder);

    if (level === "hsc") {
      HSC_GROUPS.forEach((g) => addOption(departmentSelect, g, g));
    } else if (level === "honours") {
      HONOURS_DEPARTMENTS.forEach((faculty) => {
        const optgroup = document.createElement("optgroup");
        optgroup.label = faculty.label;
        faculty.items.forEach((d) => addOption(optgroup, d, d));
        departmentSelect.appendChild(optgroup);
      });
    }
    if (level !== "none") addOption(departmentSelect, "__other__", "Other (please specify)");

    // Keep the previous choice only if it still exists for the new level.
    const stillValid = previous !== "" && Array.from(departmentSelect.options).some((o) => o.value === previous);
    departmentSelect.value = stillValid ? previous : "";
    if (!stillValid) departmentOtherInput.value = "";

    $("departmentLabel").innerHTML = `${copy.label} <span class="required">*</span>`;
    $("departmentError").textContent = copy.error;
    $("departmentHint").textContent = copy.hint;
    $("departmentOtherLabel").innerHTML = `${copy.otherLabel} <span class="required">*</span>`;
    departmentOtherInput.placeholder = copy.otherPlaceholder;

    departmentSelect.dispatchEvent(new Event("refresh"));
    updateDepartmentOtherField();
    setError("field_department", true);
  }

  departmentSelect.addEventListener("change", updateDepartmentOtherField);
  yearSelect.addEventListener("change", populateDepartments);

  function syncAddress() {
    if (sameAddressCheckbox.checked) {
      permanentAddressInput.value = presentAddressInput.value;
    }
  }

  sameAddressCheckbox.addEventListener("change", () => {
    permanentAddressField.style.display = sameAddressCheckbox.checked ? "none" : "block";
    syncAddress();
  });

  presentAddressInput.addEventListener("input", syncAddress);

  // ---------- Image Compression ----------

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

  function wireUploadInput(inputId, previewId, labelId, stateKey, processingKey) {
    const input = $(inputId);
    const preview = $(previewId);
    const label = $(labelId);
    const originalLabel = label.textContent;

    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return;

      state[processingKey] = true;
      label.textContent = "Processing image…";

      try {
        const dataUrl = await compressImage(file);
        state[stateKey] = dataUrl;
        preview.innerHTML = `<img src="${dataUrl}" alt="" style="width:100%;height:100%;object-fit:cover;" />`;
        label.textContent = "Photo ready ✓";
        if (stateKey === "id_document_photo") setError("field_id_document_photo", true);
      } catch (err) {
        state[stateKey] = null;
        label.textContent = originalLabel;
        input.value = "";
      } finally {
        state[processingKey] = false;
      }
    });
  }

  wireUploadInput("profile_photo", "profilePreview", "profileUploadLabel", "profile_photo", "processingProfile");
  wireUploadInput("id_document_photo", "idDocPreview", "idDocUploadLabel", "id_document_photo", "processingId");

  // ---------- Review & Submit ----------

  function fieldLabel(value, fallback = "—") {
    const v = (value || "").toString().trim();
    return v === "" ? fallback : escapeHtml(v);
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function collectData() {
    const department = departmentSelect.value === "__other__" ? departmentOtherInput.value.trim() : departmentSelect.value;
    const interests = Array.from(document.querySelectorAll('input[name="interests"]:checked')).map((el) => el.value);

    return {
      full_name: $("full_name").value.trim(),
      date_of_birth: $("date_of_birth").value,
      blood_group: $("blood_group").value,
      profile_photo: state.profile_photo,

      student_id: $("student_id").value.trim(),
      department,
      year: $("year").value,
      session: $("session").value.trim(),

      email: $("email").value.trim(),
      phone: $("phone").value.trim(),
      present_address: $("present_address").value.trim(),
      permanent_address: $("permanent_address").value.trim(),
      guardian_name: $("guardian_name").value.trim(),
      guardian_phone: $("guardian_phone").value.trim(),

      reason_to_join: $("reason_to_join").value.trim(),
      previous_experience: $("previous_experience").value.trim(),
      interests,
      social_link: $("social_link").value.trim(),
      id_document_photo: state.id_document_photo,

      website_url: $("website_url").value,
    };
  }

  function buildReview() {
    const d = collectData();

    const section = (title, items) => `
      <div class="review-section">
        <h3>${title}</h3>
        <div class="review-grid">
          ${items.map(([k, v]) => `<div class="review-item"><div class="k">${k}</div><div class="v">${v}</div></div>`).join("")}
        </div>
      </div>`;

    let html = "";

    html += `<div class="review-photos">`;
    if (d.profile_photo) html += `<img src="${d.profile_photo}" alt="Profile photo" />`;
    if (d.id_document_photo) html += `<img src="${d.id_document_photo}" alt="ID document" />`;
    html += `</div>`;

    html += section("Personal", [
      ["Full name", fieldLabel(d.full_name)],
      ["Date of birth", fieldLabel(d.date_of_birth)],
      ["Blood group", fieldLabel(d.blood_group)],
    ]);

    html += section("Academic", [
      ["Class Roll / Student ID", fieldLabel(d.student_id)],
      ["Group / Department", fieldLabel(d.department)],
      ["Year", fieldLabel(d.year)],
      ["Session", fieldLabel(d.session)],
    ]);

    html += section("Contact & guardian", [
      ["Email", fieldLabel(d.email)],
      ["Phone", fieldLabel(d.phone)],
      ["Present address", fieldLabel(d.present_address)],
      ["Permanent address", fieldLabel(d.permanent_address)],
      ["Guardian's name", fieldLabel(d.guardian_name)],
      ["Guardian's phone", fieldLabel(d.guardian_phone)],
    ]);

    html += section("Additional", [
      ["Interests", d.interests.length ? escapeHtml(d.interests.join(", ")) : "—"],
      ["Social link", fieldLabel(d.social_link)],
      ["Reason to join", fieldLabel(d.reason_to_join)],
      ["Previous experience", fieldLabel(d.previous_experience)],
    ]);

    $("reviewContent").innerHTML = html;
  }

  async function submitForm() {
    submitError.classList.remove("active");
    nextBtn.disabled = true;
    backBtn.disabled = true;
    const originalText = nextBtn.textContent;
    nextBtn.innerHTML = '<span class="spinner"></span>';

    try {
      const payload = collectData();
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong. Please try again.");
      }

      formShell.classList.add("hidden");
      successScreen.classList.add("active");
    } catch (err) {
      submitError.textContent = err.message || "Something went wrong. Please try again.";
      submitError.classList.add("active");
      submitError.scrollIntoView({ behavior: "smooth", block: "center" });
    } finally {
      nextBtn.disabled = false;
      backBtn.disabled = false;
      nextBtn.textContent = originalText;
    }
  }

  $("submitAnotherBtn").addEventListener("click", () => window.location.reload());
  form.addEventListener("submit", (e) => e.preventDefault());

  buildProgressTrack();
  setupAllCustomSelects();
  showStep(1);
})();