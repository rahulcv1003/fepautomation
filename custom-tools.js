(function () {
  "use strict";
  const KEY = "fep-custom-fields-v1";
  const REPO = "rahulcv1003/fepautomation";
  const FIELD = 'input:not([type="hidden"]):not([type="password"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select, .ant-select';
  const clean = value => String(value || "").replace(/\s+/g, " ").trim();
  const visible = element => !!element && !!element.getClientRects().length;
  let panel, pickerCleanup, busy = false;

  function pagePattern(path = location.pathname) {
    return path.split("/").map(part => /^\d+$/.test(part) || /^[a-f\d]{24}$/i.test(part) || /^[a-f\d]{8}-[a-f\d-]{27,}$/i.test(part) ? "*" : part).join("/");
  }
  function matches(rule) {
    const pattern = rule.path.split("*").map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[^/]+");
    return (rule.host === "*" || rule.host === location.hostname) && new RegExp(`^${pattern}$`).test(location.pathname);
  }
  async function rules() {
    const result = await chrome.storage.local.get(KEY);
    return Array.isArray(result[KEY]) ? result[KEY] : [];
  }
  async function save(items) { await chrome.storage.local.set({ [KEY]: items }); }
  function typeOf(element) {
    if (element.matches(".ant-select, select")) return "dropdown";
    if (element.matches('input[type="checkbox"]')) return "checkbox";
    if (element.matches('input[type="radio"]')) return "radio";
    if (element.matches('input[type="date"]')) return "date";
    return "text";
  }
  function fields() {
    return Array.from(document.querySelectorAll(FIELD)).filter(element =>
      visible(element) && !element.closest("#fep-launcher, #fep-popup, [data-fep-tools]") &&
      !(element.matches("input") && element.closest(".ant-select")));
  }
  function labelOf(element) {
    const item = element.closest(".ant-form-item");
    const label = element.labels?.[0]?.cloneNode(true);
    label?.querySelectorAll("input, select, textarea, button").forEach(node => node.remove());
    return clean(label?.textContent || element.getAttribute("aria-label") ||
      item?.querySelector(".ant-form-item-label label, .ant-form-item-label")?.textContent ||
      element.getAttribute("placeholder") || element.getAttribute("name") || element.id).replace(/^\*\s*/, "");
  }
  function candidates(locator) {
    return fields().filter(element => {
      if (typeOf(element) !== locator.type) return false;
      if (locator.kind === "label") return labelOf(element) === locator.value;
      return element.getAttribute(locator.kind) === locator.value;
    });
  }
  function describe(element) {
    const type = typeOf(element);
    const label = labelOf(element);
    for (const kind of ["data-testid", "name", "label", "id", "placeholder"]) {
      const value = kind === "label" ? label : element.getAttribute(kind);
      if (!value) continue;
      const locator = { kind, value, type };
      const found = candidates(locator);
      if (found.length === 1) return { ...locator, count: 1, occurrence: 0 };
    }
    if (label) {
      const locator = { kind: "label", value: label, type };
      const found = candidates(locator);
      return { ...locator, count: found.length, occurrence: found.indexOf(element) };
    }
    throw new Error("This field has no stable label or attribute. Ask the page developer to add one.");
  }
  function resolve(rule) {
    const found = candidates(rule.locator);
    if (found.length !== rule.locator.count) throw new Error("Field missing or its matches changed. Pick it again.");
    const element = found[rule.locator.occurrence];
    if (!element || element.disabled || element.readOnly || element.getAttribute("aria-disabled") === "true" || element.classList.contains("ant-select-disabled")) {
      throw new Error("Field is missing, disabled, or read-only.");
    }
    return element;
  }
  function setValue(element, value) {
    const prototype = element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype :
      element.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));
  }
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  function valueMatches(element, expected) {
    if (element.value === String(expected)) return true;
    // Ant InputNumber uses type=text, but normalizes values such as 0123 to 123.
    // Keep exact comparison for ordinary text fields (phone numbers, IDs, etc.).
    if (!element.matches('input[type="number"], input[role="spinbutton"], input.ant-input-number-input')) return false;
    const number = value => {
      const text = String(value).trim();
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return null;
      const parsed = Number(text);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const wanted = number(expected), actual = number(element.value);
    return wanted !== null && actual !== null && wanted === actual;
  }
  async function fill(rule) {
    const element = resolve(rule);
    const type = rule.locator.type;
    if (type === "dropdown" && element.matches(".ant-select")) {
      if (element.classList.contains("ant-select-multiple")) throw new Error("Multi-select dropdowns are not supported yet.");
      const trigger = element.querySelector(".ant-select-selector");
      if (!trigger) throw new Error("Dropdown control is unavailable.");
      trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      trigger.click();
      const input = element.querySelector("input");
      const dropdownId = input?.getAttribute("aria-controls") || input?.getAttribute("aria-owns");
      const findDropdown = () => {
        const owned = dropdownId && document.getElementById(dropdownId);
        if (owned) return owned.closest(".ant-select-dropdown") || owned;
        const shown = Array.from(document.querySelectorAll(".ant-select-dropdown")).filter(visible);
        return shown.length === 1 ? shown[0] : null;
      };
      let selected = false;
      try {
        if (input && !input.readOnly) { input.focus(); setValue(input, rule.value); }
        for (let attempt = 0; attempt < 40; attempt++) {
          if (!matches(rule)) throw new Error("Page changed while filling.");
          const dropdown = findDropdown();
          const options = dropdown ? Array.from(dropdown.querySelectorAll(".ant-select-item-option")) : [];
          const option = options.find(item => clean(item.querySelector(".ant-select-item-option-content")?.textContent || item.textContent) === clean(rule.value) &&
            !item.classList.contains("ant-select-item-option-disabled") && item.getAttribute("aria-disabled") !== "true");
          if (option) { option.click(); selected = true; break; }
          await wait(75);
        }
        if (!selected) throw new Error(`Dropdown option unavailable: ${rule.value}`);
        await wait(100);
        const text = clean(element.querySelector(".ant-select-selection-item")?.textContent);
        if (text !== clean(rule.value)) throw new Error("Dropdown selection was not confirmed.");
      } finally {
        if (!selected && input) setValue(input, "");
        input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      }
    } else if (type === "dropdown") {
      const options = Array.from(element.options).filter(option => !option.disabled && !option.parentElement.disabled && clean(option.textContent) === clean(rule.value));
      if (options.length !== 1) throw new Error("Dropdown option missing or ambiguous.");
      setValue(element, options[0].value);
    } else if (type === "checkbox" || type === "radio") {
      const desired = rule.value === "true";
      if (type === "radio" && !desired) throw new Error("Select the radio option you want checked.");
      if (element.checked !== desired) element.click();
      if (element.checked !== desired) throw new Error("Selection was not confirmed.");
    } else {
      element.focus();
      setValue(element, rule.value);
      element.blur();
      // Allow controlled fields to normalize or replace the input after React renders.
      let current;
      for (let attempt = 0; attempt < 5; attempt++) {
        await wait(60);
        if (!matches(rule)) throw new Error("Page changed while filling.");
        current = resolve(rule);
      }
      if (!valueMatches(current, rule.value)) throw new Error(`Value was not accepted. Requested “${rule.value}”; field shows “${current.value}”. Check the field's allowed range and format.`);
    }
    await wait(100);
  }

  function el(tag, text, parent) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    parent?.appendChild(node);
    return node;
  }
  function button(text, parent, action, secondary = false) {
    const node = el("button", text, parent);
    node.type = "button";
    if (secondary) node.className = "secondary";
    node.addEventListener("click", async () => {
      node.disabled = true;
      try { await action(); } catch (error) { status(error.message, true); }
      finally { node.disabled = false; }
    });
    return node;
  }
  function status(text, error = false) {
    if (!panel) return;
    const node = panel.querySelector("[role=status]");
    node.textContent = text;
    node.style.color = error ? "#b42318" : "#166534";
  }
  function close() {
    pickerCleanup?.();
    panel?.host.remove();
    panel = null;
    document.removeEventListener("keydown", escape);
  }
  function escape(event) { if (event.key === "Escape") close(); }
  function modal(title, intro) {
    close();
    const host = el("div", undefined, document.body);
    host.dataset.fepTools = "true";
    host.style.cssText = "position:fixed;inset:0;z-index:2147483647";
    const root = host.attachShadow({ mode: "open" });
    panel = root;
    el("style", `:host{font:14px/1.5 system-ui,sans-serif;color:#172554}*{box-sizing:border-box} .backdrop{position:absolute;inset:0;background:#0f172a88;display:grid;place-items:center;padding:20px}.card{width:620px;max-width:100%;max-height:90vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 24px 80px #0f172a55;padding:28px}h2{margin:0;font-size:24px;letter-spacing:-.6px}p{color:#64748b;margin:8px 0 18px}label{display:block;font-weight:650;margin-top:14px}input,select,textarea{display:block;width:100%;font:inherit;border:1px solid #cbd5e1;border-radius:9px;padding:10px;margin-top:5px;background:#fff;color:#0f172a}textarea{min-height:90px;resize:vertical}button{font:inherit;font-weight:650;padding:9px 14px;border:0;border-radius:9px;background:#4f46e5;color:white;cursor:pointer}button:disabled{opacity:.5;cursor:wait}.secondary{background:#eef2ff;color:#3730a3}.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.top{display:flex;justify-content:space-between;gap:20px}.top button{background:#f1f5f9;color:#334155}.rule{border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-top:12px}.rule p{margin:4px 0;font-size:12px;overflow-wrap:anywhere}.muted{font-size:12px;color:#64748b} [role=status]{white-space:pre-line;margin-top:14px;overflow-wrap:anywhere}:focus-visible{outline:3px solid #818cf8;outline-offset:3px}`, root);
    const backdrop = el("div", undefined, root); backdrop.className = "backdrop";
    const card = el("section", undefined, backdrop); card.className = "card";
    card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "true");
    const top = el("div", undefined, card); top.className = "top";
    const heading = el("h2", title, top); heading.id = "heading";
    card.setAttribute("aria-labelledby", "heading");
    const closer = button("Close", top, close, true);
    el("p", intro, card);
    const body = el("div", undefined, card);
    const message = el("div", "", card); message.setAttribute("role", "status");
    backdrop.addEventListener("click", event => { if (event.target === backdrop) close(); });
    root.addEventListener("keydown", event => {
      if (event.key !== "Tab") return;
      const nodes = Array.from(card.querySelectorAll("button,input,textarea,select,a[href]")).filter(node => !node.disabled);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && root.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && root.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    document.addEventListener("keydown", escape);
    closer.focus();
    return body;
  }
  function input(label, parent, value = "", tag = "input") {
    const wrapper = el("label", label, parent);
    const node = el(tag, undefined, wrapper); node.value = value;
    node.setAttribute("aria-label", label);
    return node;
  }
  function select(label, parent, values, current) {
    const node = input(label, parent, "", "select");
    for (const [value, text] of values) { const option = el("option", text, node); option.value = value; }
    node.value = current;
    return node;
  }

  async function editor(element, existing) {
    const locator = existing?.locator || describe(element);
    const body = modal(existing ? "Edit custom field" : "Save a custom field", "Choose a value and where it applies. Fields are filled only when you ask; forms are never submitted.");
    const name = input("Rule name", body, existing?.name || labelOf(element) || locator.value);
    const type = select("Field type", body, [["text","Text / number / email"],["dropdown","Dropdown"],["date","Date (native date field)"],["checkbox","Checkbox"],["radio","Radio option"]], locator.type);
    type.disabled = true;
    let value;
    if (["checkbox","radio"].includes(locator.type)) value = select("Value", body, locator.type === "radio" ? [["true","Checked"]] : [["true","Checked"],["false","Unchecked"]], existing?.value || "true");
    else {
      const currentValue = element?.matches("select") ? element.selectedOptions[0]?.textContent : element?.matches(".ant-select") ? element.querySelector(".ant-select-selection-item")?.textContent : element?.value;
      value = input(locator.type === "dropdown" ? "Exact option text" : "Value to fill", body, existing?.value ?? clean(currentValue), element?.matches("textarea") ? "textarea" : "input");
      if (locator.type === "dropdown") el("p", "Enter the exact field value as displayed in the dropdown, including spelling and capitalization. For example: Residential. The rule will not pick a different option if it cannot find that value.", body).className = "muted";
      if (locator.type === "date") value.type = "date";
    }
    const host = select("Environment", body, [[location.hostname, `This host: ${location.hostname}`],["*","All supported environments"]], existing?.host || location.hostname);
    if (existing && !["*",location.hostname].includes(existing.host)) { const option=el("option",existing.host,host);option.value=existing.host;host.value=existing.host; }
    const path = input("Page path (* matches one path segment)", body, existing?.path || pagePattern());
    el("p", `Match: ${locator.kind} “${locator.value}”${locator.count > 1 ? ` · occurrence ${locator.occurrence+1} of ${locator.count}. Recheck after layout changes.` : ""}. Query parameters are ignored.`, body).className="muted";
    const actions = el("div", undefined, body); actions.className="actions";
    button("Save rule", actions, async () => {
      if (!name.value.trim() || !path.value.startsWith("/") || path.value.includes("?") || path.value.includes("#")) throw new Error("Enter a name and a page path starting with /, without query parameters or fragments.");
      if (locator.type === "dropdown" && !value.value.trim()) throw new Error("Enter the exact dropdown option text.");
      const items = await rules();
      const rule = {id: existing?.id || crypto.randomUUID(), name:name.value.trim(), locator, value:value.value, host:host.value, path:path.value.trim(), enabled:existing?.enabled ?? true};
      const index=items.findIndex(item=>item.id===rule.id);
      if(index>=0)items[index]=rule;else items.push(rule);
      await save(items); await manager(); status("Rule saved. Use Test to check it on this page.");
    });
    button("Cancel", actions, manager, true);
  }
  function pick() {
    close();
    const host=el("div",undefined,document.body); host.dataset.fepTools="true";
    host.style.cssText="position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#172554;color:white;padding:14px 22px;border-radius:12px;font:14px system-ui;box-shadow:0 8px 30px #0004;pointer-events:none";
    host.textContent="Click a text field, dropdown, date, checkbox, or radio option · Esc to cancel";
    const highlight=el("div",undefined,document.body); highlight.dataset.fepTools="true";
    highlight.style.cssText="position:fixed;pointer-events:none;border:3px solid #6366f1;background:#6366f118;border-radius:5px;z-index:2147483646;display:none";
    const targetOf=event=>{
      if(event.target.closest?.("[data-fep-tools], #fep-launcher, #fep-popup"))return null;
      const ant=event.target.closest?.(".ant-select");
      const target=ant || event.target.closest?.(FIELD) || event.target.closest?.(".ant-form-item, label")?.querySelector(FIELD);
      return target && fields().includes(target) ? target : null;
    };
    const move=event=>{const target=targetOf(event);if(!target){highlight.style.display="none";return;}const r=target.getBoundingClientRect();Object.assign(highlight.style,{display:"block",left:r.left+"px",top:r.top+"px",width:r.width+"px",height:r.height+"px"});};
    const choose=event=>{const target=targetOf(event);if(!target)return;event.preventDefault();event.stopImmediatePropagation();pickerCleanup();editor(target).catch(async error=>{await manager();status(error.message,true);});};
    const cancel=event=>{if(event.key==="Escape"){event.preventDefault();pickerCleanup();manager();}};
    pickerCleanup=()=>{host.remove();highlight.remove();document.removeEventListener("mousemove",move,true);document.removeEventListener("click",choose,true);document.removeEventListener("keydown",cancel,true);pickerCleanup=null;};
    document.addEventListener("mousemove",move,true);document.addEventListener("click",choose,true);document.addEventListener("keydown",cancel,true);
  }
  async function fillSaved({ silent = false } = {}) {
    if (busy) { if(!silent)status("Custom autofill is already running."); return; }
    busy=true;
    try {
      const applicable=(await rules()).filter(rule=>rule.enabled && matches(rule));
      const results=[];
      for(const rule of applicable){try{if(!matches(rule))throw new Error("Page changed; skipped.");await fill(rule);results.push({name:rule.name,ok:true});}catch(error){results.push({name:rule.name,ok:false,error:error.message});}}
      if(!silent || results.some(item=>!item.ok)){
        const body=modal("Custom autofill results",applicable.length ? `${results.filter(item=>item.ok).length} of ${results.length} fields filled.` : "No enabled rules match this page and environment.");
        for(const item of results)el("p",`${item.ok?"✓":"✗"} ${item.name}${item.ok?"":": "+item.error}`,body);
        button("Manage custom fields",body,manager,true);
      }
      return results;
    } finally {busy=false;}
  }
  async function manager() {
    const items=await rules();
    const body=modal("Custom Field Builder","Pick a field, save your value, and reuse it on matching pages. Saved rules override the built-in values each time you use Autofill on a matching page and environment. Rules stay in this browser. Avoid saving passwords or other secrets.");
    const actions=el("div",undefined,body);actions.className="actions";
    button("Pick a field on this page",actions,pick);
    button("Fill saved fields",actions,()=>fillSaved(),true);
    if(!items.length)el("p","No custom fields yet. Open the form you want to customize, then pick a field.",body);
    for(const rule of items){
      const card=el("div",undefined,body);card.className="rule";
      el("strong",rule.name,card);
      el("p",`Value: ${rule.value === "" ? "(empty)" : rule.value}`,card);
      el("p",`${rule.locator.type} · ${rule.host==="*"?"All environments":rule.host} · ${rule.path}`,card);
      el("p",`${matches(rule)?"Matches this page":"Different page / environment"} · ${rule.enabled?"Enabled":"Disabled"}`,card);
      const row=el("div",undefined,card);row.className="actions";
      button("Edit",row,()=>editor(null,rule),true);
      button(rule.enabled?"Disable":"Enable",row,async()=>{await save((await rules()).map(item=>item.id===rule.id?{...item,enabled:!item.enabled}:item));await manager();},true);
      button("Test",row,async()=>{if(!matches(rule))throw new Error("Open a matching page before testing.");await fill(rule);status(`Filled: ${rule.name}`);},true);
      button("Delete",row,async()=>{
        const confirmBody=modal("Delete custom field?",`Delete “${rule.name}”? This removes its saved value from this browser.`);
        const row=el("div",undefined,confirmBody);row.className="actions";
        button("Delete rule",row,async()=>{await save((await rules()).filter(item=>item.id!==rule.id));await manager();});
        button("Keep rule",row,manager,true);
      },true);
    }
  }

  function report() {
    const body=modal("Feedback & feature requests","Share a bug, feature suggestion, or general feedback with Rahul through GitHub. You’ll review it on GitHub and click Submit new issue. A GitHub account is required; reports are public. Don’t include customer details, tokens, or payment information.");
    const category=select("Feedback type",body,[["Bug","Bug report"],["Feature","Feature suggestion"],["Feedback","General feedback"]],"Bug");
    const title=input("Short summary",body);title.maxLength=160;
    const area=select("Affected feature",body,[["Autofill","Autofill"],["Custom fields","Custom Field Builder"],["Payments","Pay Advance Payment"],["Documents","Documents"],["Survey / installation","Survey / installation"],["Other","Other"]],"Autofill");
    const steps=input("Steps to reproduce / proposed workflow",body,"","textarea");steps.maxLength=2500;
    const expected=input("Expected result / desired improvement",body,"","textarea");expected.maxLength=1500;
    const actual=input("Current behavior / problem to solve",body,"","textarea");actual.maxLength=2500;
    el("p",`Included context: extension ${chrome.runtime.getManifest().version}, ${location.hostname}, browser family. No page URLs, project IDs, field values, or request payloads are collected.`,body).className="muted";
    button("Review report on GitHub",body,()=>{
      if(!title.value.trim() || !steps.value.trim() || !expected.value.trim() || !actual.value.trim())throw new Error("Complete the summary, steps, expected result, and actual result.");
      const browser=/Edg\//.test(navigator.userAgent)?"Edge":/Chrome\//.test(navigator.userAgent)?"Chrome / Chromium":"Other";
      const text=`### Feedback type\n${category.value}\n\n### Feature\n${area.value}\n\n### Steps to reproduce / proposed workflow\n${steps.value.trim()}\n\n### Expected result\n${expected.value.trim()}\n\n### Actual result\n${actual.value.trim()}\n\n### Environment\n- Extension: ${chrome.runtime.getManifest().version}\n- Host: ${location.hostname}\n- Browser: ${browser}`;
      const url=new URL(`https://github.com/${REPO}/issues/new`);
      url.searchParams.set("template","bug_report.yml");url.searchParams.set("title",`[${category.value}] ${title.value.trim()}`);url.searchParams.set("report",text);url.searchParams.set("browser",browser);
      if (url.href.length > 8000) throw new Error("This report is too long to open on GitHub. Shorten it, then add more detail or attachments on GitHub.");
      window.open(url.href,"_blank","noopener,noreferrer");
      status("Review and submit the report in the GitHub tab. It has not been submitted by the extension.");
    });
  }
  globalThis.FepCustomTools=Object.freeze({manager,fillSaved,report});
})();
