(function () {
  "use strict";

  const LOG_PREFIX = "[FEP MASTER]";
  const BUTTON_IDS = {
    docs: "fep-master-docs-btn"   // upload button — still injected per-page
  };

  console.log(LOG_PREFIX, "Loaded on", location.href);

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function normalize(str) {
    return (str || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function realClick(el) {
    if (!el) return;
    // Guard: if the element has been removed from the DOM (SPA navigation,
    // React re-render, etc.) calling .click() on a detached submit-button
    // produces Chrome's "Form submission canceled — form not connected" warning.
    if (!el.isConnected) return;

    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    el.click();
  }

  function setReactValue(el, value) {
    const descriptor = Object.getOwnPropertyDescriptor(el.__proto__, "value");
    if (!descriptor || typeof descriptor.set !== "function") {
      el.value = value;
    } else {
      descriptor.set.call(el, value);
    }

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function getRandomLetters(length = 6) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    return Array.from(
      { length },
      () => chars.charAt(Math.floor(Math.random() * chars.length))
    ).join("");
  }

  function getValidPhone() {
    const first = Math.floor(Math.random() * 5) + 1;
    return (
      first +
      Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join("")
    );
  }

  function getRandomEmail() {
    return `test${Math.floor(Math.random() * 100000)}@mail.com`;
  }

  function getFormItems() {
    return Array.from(document.querySelectorAll(".ant-form-item"));
  }

  function findFormItemsByLabel(label) {
    return getFormItems().filter((el) =>
      normalize(el.innerText).includes(normalize(label))
    );
  }

  function findFormItemByLabel(label, occurrence = 1) {
    const items = findFormItemsByLabel(label);
    return items[Math.max(0, occurrence - 1)];
  }

  async function waitDropdown() {
    for (let i = 0; i < 25; i += 1) {
      const dropdowns = Array.from(
        document.querySelectorAll(".ant-select-dropdown")
      ).filter((el) => el.offsetHeight > 0);

      if (dropdowns.length) {
        return dropdowns[dropdowns.length - 1];
      }

      await sleep(200);
    }

    return null;
  }

  function dropdownOptions(dropdown) {
    return Array.from(dropdown.querySelectorAll(".ant-select-item-option"));
  }

  async function selectDropdownByLabel(label, mode = "first", occurrence = 1) {
    const item = findFormItemByLabel(label, occurrence);
    if (!item) {
      return;
    }

    const select = item.querySelector(".ant-select-selector");
    realClick(select);

    const dropdown = await waitDropdown();
    if (!dropdown) {
      return;
    }

    const options = dropdownOptions(dropdown);
    if (!options.length) {
      return;
    }

    if (mode === "first") {
      realClick(options[0]);
    }

    if (mode === "last") {
      realClick(options[options.length - 1]);
    }

    await sleep(400);
  }

  async function selectDropdownByText(label, text, occurrence = 1) {
    const item = findFormItemByLabel(label, occurrence);
    if (!item) {
      return;
    }

    const select = item.querySelector(".ant-select-selector");
    realClick(select);

    const dropdown = await waitDropdown();
    if (!dropdown) {
      return;
    }

    const options = dropdownOptions(dropdown);
    const option = options.find((el) =>
      normalize(el.innerText).includes(normalize(text))
    );

    if (option) {
      realClick(option);
    }

    await sleep(400);
  }

  async function fillInputByLabel(label, value, occurrence = 1) {
    const item = findFormItemByLabel(label, occurrence);
    if (!item) {
      return;
    }

    const input = item.querySelector("input");
    if (!input) {
      return;
    }

    input.focus();
    setReactValue(input, value);

    await sleep(200);
  }

  async function fillInputById(id, value) {
    const input = document.getElementById(id);
    if (!input) {
      return;
    }

    input.focus();
    setReactValue(input, value);

    await sleep(200);
  }

  async function fillInputByPlaceholder(placeholder, value) {
    const input = Array.from(document.querySelectorAll("input")).find((el) =>
      normalize(el.placeholder).includes(normalize(placeholder))
    );
    if (!input) {
      return;
    }

    input.focus();
    setReactValue(input, value);

    await sleep(200);
  }

  async function fillDate(id, dateStr) {
    const input = document.getElementById(id);
    if (!input) {
      return;
    }

    input.focus();
    setReactValue(input, dateStr);
    input.blur();

    await sleep(300);
  }

  async function fillLead() {
    await fillInputByLabel("First Name", `Test ${getRandomLetters(4)}`);
    await fillInputByLabel("Last Name", getRandomLetters(5));
    await fillInputByLabel("Contact Number", getValidPhone());
    await fillInputByLabel("Email", getRandomEmail());

    await fillInputByLabel("Pincode", "500019", 1);
    await sleep(1500);

    await selectDropdownByLabel("Area", "first", 1);
    await selectDropdownByText("Project Type", "Independent");
    await selectDropdownByLabel("Range of Electricity Bill", "first");

    await fillInputByLabel("Door No", "12");
    await fillInputByLabel("Pincode", "500019", 2);
    await sleep(1000);

    await selectDropdownByLabel("Area", "first", 2);
    await selectDropdownByText("Serviceable State", "Telangana");
    await sleep(1000);
    await selectDropdownByText("Serviceable City", "Hyderabad");
    await selectDropdownByLabel("DISCOM", "first");
    await selectDropdownByText("Lead Source", "Advertisement");

    const comment = document.querySelector("textarea");
    if (comment) {
      setReactValue(comment, "Created using autofill");
    }

    console.log(LOG_PREFIX, "Lead Autofill Done");
  }

  async function fillProposal() {
    await selectDropdownByLabel("DISCOM", "first");
    await sleep(800);

    const subsidy = document.querySelector(
      '#subsidyEnergyRequirements input[value="Yes"]'
    );
    if (subsidy) {
      subsidy.click();
    }

    await fillInputByLabel("Current Contract Load", 4);
    await selectDropdownByLabel("Current Grid Phase", "first");
    await selectDropdownByLabel("Required Solar System Size", "last");
    await selectDropdownByLabel("Required Solar Inverter Phase", "last");
    await fillInputByLabel("Available Roof Area", 5000000);

    const structure = Array.from(document.querySelectorAll("div")).find((el) =>
      normalize(el.innerText).includes("flat roof")
    );
    if (structure) {
      realClick(structure);
    }

    await fillInputByLabel("Grid tariff", 7);

    console.log(LOG_PREFIX, "Proposal Autofill Done");
  }

  async function fillPO() {
    await selectDropdownByText("Site Status", "Ready Building");
    await selectDropdownByText("Name Change Required", "No");
    await selectDropdownByText("Category Change Required", "No");
    await selectDropdownByText("project under finance", "Yes");
    await sleep(800);

    await selectDropdownByText("Financed through Jan Samarth", "Yes");
    await fillInputById("janSamarthBankName", "Test Bank");

    await fillInputById("pan", "ABCDE1234F");
    await selectDropdownByLabel("Gender", "first");
    await selectDropdownByLabel("Tenure", "first");
    await selectDropdownByLabel("Marital Status", "first");
    await fillDate("dob", "15-03-1990");

    await fillInputByPlaceholder("Amount to be financed", 200000);
    await fillInputByPlaceholder("Monthly Power bill", 12345);
    await selectDropdownByLabel("Profession", "first");
    await fillInputByPlaceholder("Monthly Income", 12345);

    await fillInputByPlaceholder("Applicant Name", "TEST APPLICANT");
    await fillInputByPlaceholder("Mother", "TEST MOTHER");
    await fillInputById("phoneNumber", getValidPhone());
    await fillInputByPlaceholder("Email of the Applicant", "5136572@mail.com");

    await fillInputByPlaceholder("Name of the Company", "TESTCOMPANY");
    await fillInputByPlaceholder("Email of the Company", "testcompany@mail.com");
    await fillInputById("companyContact", getValidPhone());

    console.log(LOG_PREFIX, "PO Autofill Done");
  }

  function createDummyFile(name = "test-document.pdf") {
    // Minimal valid single-page PDF generated in memory
    const pdf = [
      "%PDF-1.4",
      "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
      "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
      "3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj",
      "xref",
      "0 4",
      "0000000000 65535 f ",
      "0000000009 00000 n ",
      "0000000058 00000 n ",
      "0000000115 00000 n ",
      "trailer<</Size 4/Root 1 0 R>>",
      "startxref",
      "196",
      "%%EOF"
    ].join("\n");

    const blob = new Blob([pdf], { type: "application/pdf" });
    return new File([blob], name, { type: "application/pdf" });
  }

  async function autoUploadDocs(scope) {
    // Wait for any loading spinner inside the scope to disappear
    async function waitForReady() {
      for (let i = 0; i < 20; i++) {
        if (!scope.querySelector(".ant-spin-spinning")) return;
        await sleep(300);
      }
    }

    // A row is "pending" if its list item does NOT contain "re-upload" text
    function pendingInputs() {
      return Array.from(scope.querySelectorAll('input[type="file"]')).filter(
        (input) => {
          const row =
            input.closest("li") ||
            input.closest('[class*="ant-list-item"]');
          return row ? !normalize(row.innerText).includes("re-upload") : true;
        }
      );
    }

    const total = pendingInputs().length;
    if (!total) {
      console.log(LOG_PREFIX, "No pending file inputs found");
      return;
    }

    // Max attempts = total docs × 2 as safety cap
    for (let attempt = 0; attempt < total * 2; attempt++) {
      await waitForReady();
      await sleep(300);

      const pending = pendingInputs();
      if (!pending.length) break;

      const input = pending[0];
      const dt = new DataTransfer();
      dt.items.add(createDummyFile("test-document.pdf"));
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));

      // Wait for upload API + React re-render to finish
      await sleep(1500);
    }

    const leftover = pendingInputs().length;
    console.log(
      LOG_PREFIX,
      leftover === 0
        ? "All documents uploaded successfully"
        : `Upload done — ${leftover} document(s) still pending`
    );
  }

  async function fillLETFR() {
    // Process one section by its DOM id
    async function processSection(sectionId) {
      const section = document.getElementById(sectionId);
      if (!section) {
        console.log(LOG_PREFIX, `Section not found: #${sectionId}`);
        return;
      }
      console.log(LOG_PREFIX, `Processing: #${sectionId}`);

      // 1. Date pickers — inputs inside .ant-picker, empty and not disabled/readonly
      const dateInputs = Array.from(
        section.querySelectorAll(".ant-picker input")
      ).filter((el) => !el.disabled && !el.readOnly && !el.value);

      for (const input of dateInputs) {
        // Close any stale calendar before opening a new one
        const staleDropdown = Array.from(
          document.querySelectorAll(".ant-picker-dropdown")
        ).find((el) => {
          if (el.classList.contains("ant-picker-dropdown-hidden")) return false;
          const r = el.getBoundingClientRect();
          return r.height > 0 && r.width > 0;
        });
        if (staleDropdown) {
          document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
          await sleep(400);
        }
        await sleep(300);

        // Click the OUTER .ant-picker wrapper — Ant Design's open handler lives there
        const pickerWrapper = input.closest(".ant-picker") || input;
        realClick(pickerWrapper);
        await sleep(1500);

        const dropdown = Array.from(
          document.querySelectorAll(".ant-picker-dropdown")
        ).find((el) => {
          if (el.classList.contains("ant-picker-dropdown-hidden")) return false;
          const r = el.getBoundingClientRect();
          return r.height > 0 && r.width > 0;
        });

        if (dropdown) {
          const target =
            dropdown.querySelector(".ant-picker-today-btn") ||
            dropdown.querySelector(".ant-picker-cell-today .ant-picker-cell-inner") ||
            dropdown.querySelector(".ant-picker-cell-in-view .ant-picker-cell-inner");
          if (target) {
            realClick(target);
            await sleep(800);
          }
          // Force-close if still open
          const stillOpen = Array.from(
            document.querySelectorAll(".ant-picker-dropdown")
          ).find((el) => {
            if (el.classList.contains("ant-picker-dropdown-hidden")) return false;
            const r = el.getBoundingClientRect();
            return r.height > 0 && r.width > 0;
          });
          if (stillOpen) {
            document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
            await sleep(300);
          }
        } else {
          // Fallback: type the date in DD-MM-YYYY format (same as DOB field)
          const d = new Date();
          const typed = [
            String(d.getDate()).padStart(2, "0"),
            String(d.getMonth() + 1).padStart(2, "0"),
            d.getFullYear()
          ].join("-");
          input.focus();
          setReactValue(input, typed);
          input.blur();
          await sleep(400);
        }

        await sleep(500);
      }

      // 2. Plain text/number inputs — skip date pickers, file inputs, hidden, disabled
      const textInputs = Array.from(section.querySelectorAll("input")).filter(
        (el) =>
          el.type !== "file" &&
          !el.disabled &&
          !el.readOnly &&
          !el.value &&
          !el.closest(".ant-picker") &&
          !el.classList.contains("hidden") &&
          el.style.display !== "none"
      );

      for (const input of textInputs) {
        input.focus();
        // Ant Design InputNumber wraps its <input> inside .ant-input-number
        // — feeding it a string like "TEST-001" is silently rejected.
        const isNumeric =
          input.type === "number" ||
          !!input.closest(".ant-input-number") ||
          /amount|price|fee|cost|rate|charge/i.test(input.placeholder || "");
        setReactValue(input, isNumeric ? "100000" : "TEST-001");
        await sleep(200);
      }

      // 3. Textareas — empty, not disabled
      const textareas = Array.from(
        section.querySelectorAll("textarea")
      ).filter((el) => !el.disabled && !el.readOnly && !el.value);

      for (const ta of textareas) {
        ta.focus();
        setReactValue(ta, "Test remarks");
        await sleep(200);
      }

      // 4. File inputs — Ant Design hidden + native "Choose file"
      const fileInputs = Array.from(
        section.querySelectorAll("input[type='file']")
      );

      for (const fileInput of fileInputs) {
        const dt = new DataTransfer();
        dt.items.add(createDummyFile("test-document.pdf"));
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(800);
      }

      // 5. Save and wait for API response
      const saveBtn = Array.from(section.querySelectorAll("button")).find(
        (b) => normalize(b.innerText) === "save"
      );
      if (saveBtn) {
        realClick(saveBtn);
        await sleep(2000);
      }

      await sleep(500);
    }

    // Run all 4 sections sequentially using their DOM ids
    await processSection("nationalFeasibilityApplication");
    await processSection("nationalFeasibilityApproval");
    await processSection("stateFeasibilityApplication");
    await processSection("stateFeasibilityApproval");

    console.log(LOG_PREFIX, "LE-TFR Autofill Done");
  }

  async function fillLiaising() {
    // 1. Toggle "All Documents Clear?" to Yes if not already
    const toggle = document.getElementById("allDocumentsReceived");
    if (toggle && toggle.getAttribute("aria-checked") !== "true") {
      realClick(toggle);
      await sleep(600);
    }

    // 2. Click the "Clear" button that appears after toggling Yes
    const clearBtn = Array.from(document.querySelectorAll("button")).find(
      (el) => normalize(el.innerText) === "clear"
    );
    if (clearBtn) {
      realClick(clearBtn);
      await sleep(600);
    }

    // 3. Initial Contract Load = 4
    await fillInputByLabel("Initial Contract Load", 4);

    // 4. Consumer Number
    await fillInputById("consumerNumber", "1234567");

    // 5. DISCOM dropdown → first item
    await selectDropdownByLabel("DISCOM", "first");

    // 6. Grid Phase dropdown → first item
    await selectDropdownByLabel("Grid Phase", "first");

    // 7. Bill Category dropdown → first item
    await selectDropdownByLabel("Bill Category", "first");

    console.log(LOG_PREFIX, "Liaising Autofill Done");
  }

  async function fillNetMetering() {
    // ── Discover sections from DOM structure, not from heading text ────────────
    //
    // Each section on this page has exactly ONE "Save" button.
    // Strategy: for every Save button, walk UP the DOM until we find the
    // smallest ancestor whose total Save-button count is exactly 1.
    // That ancestor IS the section boundary.
    // Sort results by document order so we process top → bottom.
    function discoverSections() {
      const found = new Set();

      Array.from(document.querySelectorAll("button"))
        .filter((b) => normalize(b.innerText) === "save")
        .forEach((saveBtn) => {
          let el = saveBtn.parentElement;
          while (el && el !== document.body) {
            const n = el.querySelectorAll("button").length
              ? Array.from(el.querySelectorAll("button")).filter(
                  (b) => normalize(b.innerText) === "save"
                ).length
              : 0;
            if (n === 1) { found.add(el); break; }
            if (n > 1) break; // overshot — contains multiple sections
            el = el.parentElement;
          }
        });

      // Sort by DOM position (top of page first)
      return Array.from(found).sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      );
    }

    // "Net meter Testing" section should click Complete, not Save.
    // Detect it by looking for an ant-switch (the No/Yes toggle) inside the section.
    function needsComplete(section) {
      return !!section.querySelector(".ant-switch");
    }

    // ── Close any floating calendar that is still visible ─────────────────────
    async function closeOpenCalendar() {
      const stillOpen = Array.from(
        document.querySelectorAll(".ant-picker-dropdown")
      ).some((el) => {
        const r = el.getBoundingClientRect();
        return r.height > 0 && r.width > 0;
      });
      if (stillOpen) {
        document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        await sleep(400);
      }
    }

    // ── Process one section: Date → Files → Save/Complete ─────────────────────
    async function processSection(section) {
      const headingEl = section.querySelector("h2,h3,h4,h5,h6,strong,b");
      const label = headingEl ? headingEl.textContent.trim() : "(unknown)";
      const clickComplete = needsComplete(section);
      console.log(LOG_PREFIX, `Net-metering: "${label}"${clickComplete ? " → Complete" : " → Save"}`);

      // STEP 1 — Date pickers (empty, enabled)
      const dateInputs = Array.from(
        section.querySelectorAll(".ant-picker input")
      ).filter((el) => !el.disabled && !el.readOnly && !el.value);

      for (const input of dateInputs) {
        await closeOpenCalendar();
        await sleep(300);

        // Click the OUTER .ant-picker wrapper — Ant Design attaches its
        // open-calendar handler there, not on the bare <input> element.
        const pickerWrapper = input.closest(".ant-picker") || input;
        realClick(pickerWrapper);
        await sleep(1500); // give the calendar panel time to render

        // A visible dropdown is one that is NOT marked hidden by Ant Design
        // AND has real dimensions (guard against display:none or visibility tricks)
        const dropdown = Array.from(
          document.querySelectorAll(".ant-picker-dropdown")
        ).find((el) => {
          if (el.classList.contains("ant-picker-dropdown-hidden")) return false;
          const r = el.getBoundingClientRect();
          return r.height > 0 && r.width > 0;
        });

        if (dropdown) {
          const target =
            dropdown.querySelector(".ant-picker-today-btn") ||
            dropdown.querySelector(".ant-picker-cell-today .ant-picker-cell-inner") ||
            dropdown.querySelector(".ant-picker-cell-in-view .ant-picker-cell-inner");
          if (target) {
            realClick(target);
            await sleep(800);
          }
          await closeOpenCalendar();
        } else {
          // Calendar did not open — type the date string directly as fallback
          const d = new Date();
          const typed = [
            String(d.getDate()).padStart(2, "0"),
            String(d.getMonth() + 1).padStart(2, "0"),
            d.getFullYear()
          ].join("-");
          input.focus();
          setReactValue(input, typed);
          input.blur();
          await sleep(500);
        }

        await sleep(500); // small gap between consecutive date fields
      }

      if (dateInputs.length) await sleep(2000);

      // STEP 2 — File inputs (enabled only)
      const fileInputs = Array.from(
        section.querySelectorAll("input[type='file']")
      ).filter((el) => !el.disabled);

      for (const fi of fileInputs) {
        const dt = new DataTransfer();
        dt.items.add(createDummyFile("test-document.pdf"));
        fi.files = dt.files;
        fi.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(1500);
      }

      if (fileInputs.length) await sleep(2000);

      // STEP 3 — Click Save or Complete
      const actionText = clickComplete ? "complete" : "save";
      const actionBtn = Array.from(section.querySelectorAll("button")).find(
        (b) => normalize(b.innerText) === actionText && !b.disabled
      );
      if (actionBtn) {
        realClick(actionBtn);
        await sleep(3000); // wait for server response
      } else {
        console.log(LOG_PREFIX, `  ⚠ "${actionText}" not available in "${label}"`);
      }

      await sleep(2000); // gap before next section
    }

    // ── Main: find all sections in DOM order and run them sequentially ─────────
    const sections = discoverSections();
    console.log(LOG_PREFIX, `Net-metering: found ${sections.length} sections`);

    for (const section of sections) {
      await processSection(section);
    }

    console.log(LOG_PREFIX, "Net Metering Autofill Done");
  }

  function createButton({ id, text, style, onClick }) {
    if (document.getElementById(id)) {
      return;
    }

    const btn = document.createElement("button");
    btn.id = id;
    btn.type = "button";
    btn.textContent = text;
    btn.style.cssText = style;
    btn.addEventListener("click", onClick);
    document.body.appendChild(btn);
  }

  async function autoUploadDocsViaModal() {
    // Click "Manage Documents" to open the modal
    const manageBtn = Array.from(document.querySelectorAll("button")).find(
      (el) => normalize(el.innerText).includes("manage documents")
    );
    if (manageBtn) realClick(manageBtn);

    // Wait for the modal to open and file inputs to be available
    let modal = null;
    for (let i = 0; i < 30; i++) {
      modal = Array.from(document.querySelectorAll(".ant-modal-content")).find(
        (el) => el.offsetHeight > 0 && el.querySelector('input[type="file"]')
      );
      if (modal) break;
      await sleep(300);
    }

    if (!modal) {
      console.log(LOG_PREFIX, "Document modal did not open");
      return;
    }

    await autoUploadDocs(modal);
  }

  function injectUploadDocsButton() {
    // ── confirm-po: file inputs live directly on the page ──────────────────
    if (location.href.includes("confirm-po")) {
      if (document.getElementById(BUTTON_IDS.docs)) return;

      const card = document.getElementById("uploadDocuments");
      if (!card) return;

      const cardHead = card.querySelector(".ant-card-head");
      if (!cardHead) return;

      cardHead.style.cssText += ";display:flex;align-items:center;justify-content:space-between;";

      const btn = document.createElement("button");
      btn.id = BUTTON_IDS.docs;
      btn.type = "button";
      btn.textContent = "Auto Upload Docs";
      btn.style.cssText =
        "background:#e67e22;color:#fff;padding:6px 14px;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.15);white-space:nowrap;margin-left:12px;";
      btn.addEventListener("click", () => autoUploadDocs(card));
      cardHead.appendChild(btn);
      return;
    }

    // ── project-details: inject button next to "Manage Documents" ───────────
    if (location.href.includes("project-details")) {
      if (document.getElementById(BUTTON_IDS.docs)) return;

      // Find the "Manage Documents" button on the page
      const manageBtn = Array.from(document.querySelectorAll("button")).find(
        (el) => normalize(el.innerText).includes("manage documents")
      );
      if (!manageBtn) return;

      const btn = document.createElement("button");
      btn.id = BUTTON_IDS.docs;
      btn.type = "button";
      btn.textContent = "Auto Upload Docs";
      btn.style.cssText =
        "background:#e67e22;color:#fff;padding:6px 14px;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.15);white-space:nowrap;margin-right:8px;";
      btn.addEventListener("click", autoUploadDocsViaModal);

      // Insert our button just before "Manage Documents"
      manageBtn.parentNode.insertBefore(btn, manageBtn);
    }
  }

  // ── Unified draggable launcher ─────────────────────────────────────────────
  //
  // One small pill button lives on every page.
  // Click it → popup with two options:
  //   "Fill Lead"        — always available (lead modal doesn't change the URL)
  //   "Auto Fill Details"— context-aware: triggers the right filler for the
  //                        current URL; greyed out when no filler applies.
  // Drag the pill anywhere on screen; a small movement (<6 px) is treated as
  // a click, not a drag.
  function createLauncher() {
    if (document.getElementById("fep-launcher")) return;

    // ── Pill button ──────────────────────────────────────────────────────────
    const launcher = document.createElement("div");
    launcher.id = "fep-launcher";
    launcher.textContent = "FEP ▲";
    launcher.style.cssText = [
      "position:fixed",
      "bottom:24px",
      "right:24px",
      "background:#16a085",
      "color:#fff",
      "padding:10px 18px",
      "border-radius:24px",
      "font-size:13px",
      "font-weight:700",
      "cursor:pointer",
      "z-index:2147483647",
      "box-shadow:0 4px 16px rgba(0,0,0,0.28)",
      "user-select:none",
      "white-space:nowrap",
      "letter-spacing:.3px"
    ].join(";");

    // ── Popup card ───────────────────────────────────────────────────────────
    const popup = document.createElement("div");
    popup.id = "fep-popup";
    popup.style.cssText = [
      "position:fixed",
      "display:none",
      "flex-direction:column",
      "gap:8px",
      "background:#fff",
      "border-radius:14px",
      "padding:12px",
      "box-shadow:0 10px 32px rgba(0,0,0,0.22)",
      "z-index:2147483646",
      "min-width:180px"
    ].join(";");

    const base = [
      "width:100%",
      "padding:10px 14px",
      "border:none",
      "border-radius:9px",
      "font-size:13px",
      "font-weight:600",
      "cursor:pointer",
      "text-align:left",
      "box-sizing:border-box"
    ].join(";");

    const leadBtn = document.createElement("button");
    leadBtn.type = "button";
    leadBtn.textContent = "Fill Lead";
    leadBtn.style.cssText = base + ";background:#009688;color:#fff;";

    const detailsBtn = document.createElement("button");
    detailsBtn.type = "button";
    detailsBtn.textContent = "Auto Fill Details";
    detailsBtn.style.cssText = base + ";background:#27ae60;color:#fff;";

    popup.appendChild(leadBtn);
    popup.appendChild(detailsBtn);
    document.body.appendChild(popup);
    document.body.appendChild(launcher);

    // ── URL → filler mapping (checked fresh on every popup open) ─────────────
    function getDetailsFn() {
      const h = location.href;
      if (h.includes("create-proposal"))    return fillProposal;
      if (h.includes("generate-po"))        return fillPO;
      if (h.includes("liaising-tracker/new")) return fillLiaising;
      if (h.includes("le-and-tfr"))         return fillLETFR;
      if (h.includes("net-metering"))       return fillNetMetering;
      return null;
    }

    // ── Popup open / close ───────────────────────────────────────────────────
    function positionPopup() {
      const r = launcher.getBoundingClientRect();
      // Prefer positioning above the launcher; flip below if not enough room
      const spaceAbove = r.top;
      const popupH = popup.offsetHeight || 100;
      if (spaceAbove > popupH + 12) {
        popup.style.bottom = (window.innerHeight - r.top + 8) + "px";
        popup.style.top    = "auto";
      } else {
        popup.style.top    = (r.bottom + 8) + "px";
        popup.style.bottom = "auto";
      }
      popup.style.right = (window.innerWidth - r.right) + "px";
      popup.style.left  = "auto";
    }

    function openPopup() {
      const fn = getDetailsFn();
      detailsBtn.disabled        = !fn;
      detailsBtn.style.opacity   = fn ? "1" : "0.4";
      detailsBtn.style.cursor    = fn ? "pointer" : "not-allowed";
      detailsBtn.title           = fn ? "" : "No autofill available for this page";
      popup.style.display = "flex";
      positionPopup();
      launcher.textContent = "FEP ▼";
    }

    function closePopup() {
      popup.style.display  = "none";
      launcher.textContent = "FEP ▲";
    }

    // ── Button handlers ──────────────────────────────────────────────────────
    leadBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closePopup();
      fillLead();
    });

    detailsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const fn = getDetailsFn();
      if (!fn) return;
      closePopup();
      fn();
    });

    // Close when clicking outside
    document.addEventListener("click", (e) => {
      if (!launcher.contains(e.target) && !popup.contains(e.target)) {
        if (popup.style.display !== "none") closePopup();
      }
    });

    // ── Drag logic ───────────────────────────────────────────────────────────
    let dragging = false;
    let didMove  = false;
    let ox = 0, oy = 0; // cursor offset from launcher top-left

    launcher.addEventListener("mousedown", (e) => {
      dragging = true;
      didMove  = false;
      const r  = launcher.getBoundingClientRect();
      ox = e.clientX - r.left;
      oy = e.clientY - r.top;
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - ox;
      const dy = e.clientY - oy;
      // Threshold: 6 px before we treat it as a drag
      if (!didMove && Math.hypot(dx - launcher.getBoundingClientRect().left,
                                 dy - launcher.getBoundingClientRect().top) > 6) {
        didMove = true;
      }
      if (!didMove) return;

      const maxX = window.innerWidth  - launcher.offsetWidth;
      const maxY = window.innerHeight - launcher.offsetHeight;
      launcher.style.left   = Math.max(0, Math.min(dx, maxX)) + "px";
      launcher.style.top    = Math.max(0, Math.min(dy, maxY)) + "px";
      launcher.style.right  = "auto";
      launcher.style.bottom = "auto";

      if (popup.style.display !== "none") positionPopup();
    });

    document.addEventListener("mouseup", () => {
      if (dragging && !didMove) {
        // Pure click — toggle popup
        if (popup.style.display === "none") openPopup();
        else closePopup();
      }
      dragging = false;
    });
  }

  function createButtons() {
    // Upload-docs buttons are injected inline on specific pages
    if (
      location.href.includes("confirm-po") ||
      location.href.includes("project-details")
    ) {
      injectUploadDocsButton();
    }

    // Single unified launcher present on every page
    createLauncher();
  }

  async function fillOTPModal() {
    // Wait for the OTP modal to appear
    let otpInput = null;
    for (let i = 0; i < 25; i++) {
      otpInput = Array.from(document.querySelectorAll("input")).find(
        (el) => normalize(el.placeholder).includes("enter otp")
      );
      if (otpInput) break;
      await sleep(200);
    }

    if (!otpInput) return;

    otpInput.focus();
    setReactValue(otpInput, "112233");
    await sleep(300);

    // Find and click the "Verify OTP" button inside the modal
    const verifyBtn = Array.from(document.querySelectorAll(".ant-modal button"))
      .find((el) => normalize(el.innerText).includes("verify otp"));

    if (verifyBtn) {
      realClick(verifyBtn);
    }
  }

  function watchOTPButton() {
    if (!location.href.includes("confirm-po")) return;

    const otpTrigger = Array.from(document.querySelectorAll("button")).find(
      (el) => normalize(el.innerText).includes("click here to verify otp")
    );

    if (!otpTrigger || otpTrigger.dataset.otpWatched) return;

    otpTrigger.dataset.otpWatched = "true";
    otpTrigger.addEventListener("click", () => {
      fillOTPModal();
    });
  }

  const observer = new MutationObserver(() => {
    createButtons();
    watchOTPButton();
  });

  function start() {
    if (!document.body) {
      return;
    }

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    window.setTimeout(() => { createButtons(); watchOTPButton(); }, 1500);
  }

  start();
})();
