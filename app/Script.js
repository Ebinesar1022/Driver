/* ==========================================================================
   Skyway Logistics — Driver Command Center
   Zoho Creator widget controller.

   Views: dashboard → trip start → trip page (no map).
   BFM limits are read from the "BFM Monitoring" Creator form; the demo
   defaults below are used when the form is unreachable (local preview).
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------- Creator report links ------------------------ */
  var REPORTS = {
    bfm: "All_BFM_Monitoring",   // report on your BFM Monitoring form
    trips: "All_Trips",
    duty: "All_Duty_Logs",
    alerts: "All_Alerts",
    // Confirmed from the actual Deluge report definition: the report is
    // named "Drivers" and is built on the "Driver_Details" form — NOT
    // "Driver" / "Employee_Form" as earlier versions guessed. This was the
    // root cause of every earlier mapping failure: right report/form name,
    // wrong ones were being queried.
    employees: "Drivers",
    // Extra report names to try, in order, ONLY if "employees" above comes
    // back with a permission error (Zoho code 2898 / HTTP 403) or an
    // invalid-report error. Keeping the old name here as a safety net in
    // case a differently-scoped portal report still exists under it.
    employeesFallbacks: ["Driver"],
    // Hub_Check_in_Check_Out1's Hub_Name field is a Lookup/picklist defined
    // as "values = Locations.ID" against the Locations form, displaying
    // each record's own Hub_Name text field. "Locations1" is tried first —
    // this app's other reports (Trip_Dispatch1, Hub_Check_in_Check_Out1)
    // both follow the "<form name>1" naming convention, so the Locations
    // report is most likely named the same way. "Locations" and
    // "All_Locations" are kept as fallbacks in case this report breaks
    // that pattern.
    locations: "Locations1",
    locationsFallbacks: ["Locations", "All_Locations"],
  };

  // Field API name on the Locations form — confirmed directly from the
  // Locations form definition: "must have Hub_Name (type = text)". "Name"
  // is kept only as a last-resort fallback.
  var LOCATION_FIELD_CANDIDATES = {
    hubName: ["Hub_Name", "Name"],
  };

  /* --------------------- Driver Form field API names -----------------------
     These must match the *API names* in Zoho Creator (Form builder → field →
     "API Name"), not the display labels. Update the right-hand strings only
     if you rename fields in Creator.
     -------------------------------------------------------------------- */
  /* --------------------- Driver Form field API names -----------------------
     Confirmed directly from the Deluge "list Drivers" report definition
     (report "Drivers", form "Driver_Details") — these are no longer guesses.
     Fields that DO NOT exist on this form (Blood Group, Emergency Contact,
     Medical Fitness Status, Medical Certificate, Medical Certificate Expiry)
     have been removed rather than left as dead guesses; fields that exist
     but weren't previously shown (Address, Licence Status, Vehicle Name,
     Licence Number, Passport Number/Copy, Visa status/expiry, Remark,
     Documents) have been added. This was the root cause of every earlier
     mapping failure: the report/form and several field names were wrong.
     -------------------------------------------------------------------- */
  var EMP_FIELD = {
    id: "Driver_ID",
    name: "Name",
    dob: "Date_of_Birth",
    gender: "Gender",
    photo: "Profile_Photo",
    mobile: "Mobile_Number",
    // NOTE: the Deluge report literally defines this field as "Al" (labeled
    // "Alternative Mobile" on-screen) — that unusual API name is copied
    // verbatim from the report source, not a typo introduced here.
    altMobile: "Al",
    email: "Email",
    address: "Address",
    licenceNo: "Licence_NO",              // labeled "Licence"
    licenceType: "Licence_Type",
    licenceIssueDate: "Licence_Issue_Date",
    licenceExpiry: "Licence_Expiry_Date",
    licenceDocument: "Licence_Document",  // attachment field
    licenceStatus: "Licence_Status",      // Active / Inactive / Suspended / Expired
    employmentType: "Employment_Type",
    joiningDate: "Joining_Date",
    department: "Department",
    vehicleName: "Vehicle_Name",
    licenceNumber: "Licence_Number",      // a second, separate field from Licence_NO on this form
    passportNumber: "Passport_Number",
    licenceCopy: "Licence_Copy",          // attachment field
    passportCopy: "Passport_Copy",        // attachment field
    experience: "Experience_Years",
    lastCheckupDate: "Last_Checkup_Date",
    documents: "Documents",               // attachment field
    remark: "Remark",
    visaStatus: "Visa_Right_to_Work_Status",
    visaExpiryDate: "Visa_Expiry_Date",
    expiryDate: "Expiry_Date",            // generic expiry field present on the form
    // Driver Documents page — four attachment fields, confirmed API names
    // taken directly from the "list Driver" report definition (form
    // Employee_Form). Licence_Document is already mapped above.
    medicalCertificate: "Medical_Certificate",
    rightToWorkDocument: "Right_to_Work_Document",
    identityDocumentCopy: "Identity_Document_Copy",
    // "BFM Accreditation" has no dedicated field on this form. If/when you
    // add one, map its API name here and it will be picked up automatically
    // by renderDriverProfile(). Left unmapped so the panel shows "—" instead
    // of guessing at the wrong field.
    bfmAccreditation: null,
  };

  /* ------------------- resilient field-name candidates ---------------------
     Every field is looked up by trying each candidate API name in order
     (the confirmed EMP_FIELD name first), then falling back to a normalized
     (lowercase, no separators) scan of every key actually present on the
     record (see findField() / findFieldKey()). mapEmployeeToDriver() logs,
     per field, exactly which API name was matched (or "NOT FOUND") to the
     browser console — open dev tools after the dashboard loads and look for
     "[Driver Dashboard] Field mapping report" to verify. */
  var FIELD_CANDIDATES = {
    id: [EMP_FIELD.id, "Driver_ID", "DriverID", "Driver_Id", "Employee_ID"],
    email: [EMP_FIELD.email, "Email", "Email_Address", "Driver_Email", "Login_Email"],
    name: [EMP_FIELD.name, "Name", "Driver_Name", "Full_Name"],
    gender: [EMP_FIELD.gender, "Gender", "Sex"],
    mobile: [EMP_FIELD.mobile, "Mobile_Number", "Mobile_No", "Mobile", "Phone_No", "Phone"],
    altMobile: [EMP_FIELD.altMobile, "Al", "Alternative_Mobile", "Alternate_Mobile_No", "Alt_Mobile_No"],
    dob: [EMP_FIELD.dob, "Date_of_Birth", "DOB", "Birth_Date"],
    photo: [EMP_FIELD.photo, "Profile_Photo", "Profile_Picture", "Photo"],
    address: [EMP_FIELD.address, "Address"],
    employmentType: [EMP_FIELD.employmentType, "Employment_Type", "Employee_Type"],
    joiningDate: [EMP_FIELD.joiningDate, "Joining_Date", "Date_of_Joining", "DOJ"],
    department: [EMP_FIELD.department, "Department", "Dept"],
    licenceNo: [EMP_FIELD.licenceNo, "Licence_NO", "Licence_No", "License_No"],
    licenceNumber: [EMP_FIELD.licenceNumber, "Licence_Number", "License_Number"],
    licenceIssueDate: [EMP_FIELD.licenceIssueDate, "Licence_Issue_Date", "License_Issue_Date"],
    licenceType: [EMP_FIELD.licenceType, "Licence_Type", "License_Type"],
    licenceExpiry: [EMP_FIELD.licenceExpiry, "Licence_Expiry_Date", "License_Expiry_Date"],
    licenceStatus: [EMP_FIELD.licenceStatus, "Licence_Status", "License_Status"],
    licenceDocument: [EMP_FIELD.licenceDocument, "Licence_Document", "License_Document"],
    licenceCopy: [EMP_FIELD.licenceCopy, "Licence_Copy", "License_Copy"],
    vehicleName: [EMP_FIELD.vehicleName, "Vehicle_Name", "Vehicle_Type", "Vehicle_Registration_No"],
    passportNumber: [EMP_FIELD.passportNumber, "Passport_Number"],
    passportCopy: [EMP_FIELD.passportCopy, "Passport_Copy"],
    experience: [EMP_FIELD.experience, "Experience_Years", "Driving_Experience", "Experience"],
    lastCheckupDate: [EMP_FIELD.lastCheckupDate, "Last_Checkup_Date", "Last_Medical_Checkup_Date"],
    documents: [EMP_FIELD.documents, "Documents"],
    remark: [EMP_FIELD.remark, "Remark", "Remarks"],
    visaStatus: [EMP_FIELD.visaStatus, "Visa_Right_to_Work_Status", "Visa_Status"],
    visaExpiryDate: [EMP_FIELD.visaExpiryDate, "Visa_Expiry_Date"],
    expiryDate: [EMP_FIELD.expiryDate, "Expiry_Date"],
    medicalCertificate: [EMP_FIELD.medicalCertificate, "Medical_Certificate"],
    rightToWorkDocument: [EMP_FIELD.rightToWorkDocument, "Right_to_Work_Document"],
    identityDocumentCopy: [EMP_FIELD.identityDocumentCopy, "Identity_Document_Copy"],
  };

  /* ---------------------- BFM configuration (defaults) -------------------
     Every value is in minutes and is overwritten by the BFM Monitoring
     record when one is found. Field names are mapped in readBfmRecord().
     ---------------------------------------------------------------------- */
  var bfm = {
    module: "Standard BFM",
    maxContinuousWork: 360,   // work before a rest block is required
    restBlock: 15,            // length of that rest block
    maxWorkPerShift: 840,     // 14 h in any 24 h
    minRestPerShift: 420,     // 7 h continuous stationary rest
    maxWorkPerWeek: 4320,     // 72 h in any 7 days
    warnBefore: 30,           // warn this long before a limit
    source: "Default BFM values",
  };

  /* ------------------------------ live state ----------------------------- */
  var state = {
    view: "dash",
    tripStarted: false,
    startTime: "06:30",
    endTime: "16:35",
    workedMins: 402,          // 06:42 worked so far
    sinceRestMins: 282,       // 04:42 since the last qualifying rest block
    restTakenMins: 45,
    weekWorkedMins: 2460,
    restAlertShown: false,
    restEscalated: false,
    notificationCount: 0,
  };

  var driver = {
    id: "—", name: "Loading…", score: 92,
    recordId: null, email: "", mobile: "", altMobile: "",
    photoUrl: "", depot: "", supervisor: "",
    gender: "", dob: "", address: "",
    licenceClass: "", licenceNo: "", licenceNumber: "", licenceIssueDate: "", licenceExpiry: "",
    licenceStatus: "", licenceDocumentPath: "", licenceCopyPath: "",
    started: "", employmentType: "", department: "",
    vehicleName: "", vehicleAssigned: "",
    passportNumber: "", passportCopyPath: "",
    experience: "", lastCheckupDate: "", documentsPath: "", remark: "",
    visaStatus: "", visaExpiryDate: "", expiryDate: "",
    medicalCertificatePath: "", rightToWorkDocumentPath: "", identityDocumentCopyPath: "",
    bfmAccreditation: "", route: "", loaded: false,
  };

  /* ---------------------- check-in / POD state ---------------------------- */
  // Holds the most recent hub check-in, carried across to the POD page.
  var checkInState = { hub: "", date: "", inTime: "", outTime: "" };
  // Saved POD reports, newest first — rendered on the Driver Dashboard.
  var podReports = [];

  // Sample product manifest per hub. Swap this for a Creator report lookup
  // (e.g. keyed off Trip_Stops / Hub) once wired up to live data.
  var PRODUCTS_BY_HUB = {
    "Melbourne Distribution Hub": [
      { id: "P1", name: "Pallet — Grocery mixed cartons", qty: 12 },
      { id: "P2", name: "Pallet — Chilled dairy", qty: 6 },
      { id: "P3", name: "Carton — Beverages", qty: 20 },
      { id: "P4", name: "Pallet — Household goods", qty: 8 },
    ],
    "Sydney Depot": [
      { id: "P5", name: "Pallet — Grocery mixed cartons", qty: 10 },
      { id: "P6", name: "Carton — Personal care", qty: 15 },
    ],
    "Eastern Creek Hub": [
      { id: "P7", name: "Pallet — Frozen goods", qty: 9 },
      { id: "P8", name: "Carton — Confectionery", qty: 18 },
    ],
    "Albury Transfer Hub": [
      { id: "P9", name: "Pallet — Grocery mixed cartons", qty: 7 },
      { id: "P10", name: "Carton — Beverages", qty: 11 },
    ],
    "Goulburn Hub": [
      { id: "P11", name: "Pallet — Grocery mixed cartons", qty: 6 },
      { id: "P12", name: "Carton — Bakery goods", qty: 14 },
    ],
    "Gundagai Hub": [
      { id: "P13", name: "Pallet — Chilled dairy", qty: 4 },
      { id: "P14", name: "Carton — Beverages", qty: 9 },
    ],
    "Albury Hub": [
      { id: "P15", name: "Pallet — Household goods", qty: 5 },
      { id: "P16", name: "Carton — Personal care", qty: 12 },
    ],
    "Seymour Hub": [
      { id: "P17", name: "Pallet — Grocery mixed cartons", qty: 7 },
      { id: "P18", name: "Pallet — Frozen goods", qty: 3 },
    ],
    "Craigieburn Hub": [
      { id: "P19", name: "Carton — Confectionery", qty: 16 },
      { id: "P20", name: "Pallet — Household goods", qty: 5 },
    ],
    "Broadmeadows Hub": [
      { id: "P21", name: "Carton — Beverages", qty: 10 },
      { id: "P22", name: "Pallet — Grocery mixed cartons", qty: 3 },
    ],
  };

  /* -------------------------------- helpers ------------------------------ */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function pad(n) { return String(Math.floor(n)).padStart(2, "0"); }
  function hm(mins) { mins = Math.max(0, Math.round(mins)); return pad(mins / 60) + ":" + pad(mins % 60); }

  // Formats a JS Date as "DD-MMM-YYYY HH:mm:ss" — the same display format
  // Zoho Creator itself sends/accepts for datetime fields (see
  // parseTripDateMs()'s fallback parser below, which reads this exact
  // shape back out of Trip_Dispatch1 records).
  var CREATOR_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function formatDateTimeForCreator(d) {
    return pad(d.getDate()) + "-" + CREATOR_MONTHS[d.getMonth()] + "-" + d.getFullYear() + " " +
      pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }
  function toMins(t) { if (!t) return null; var p = t.split(":"); return Number(p[0]) * 60 + Number(p[1]); }
  function todayLabel() {
    return new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }
  function setText(id, txt) { var el = document.getElementById(id); if (el) el.textContent = txt; }

  // Drives the loader's progress bar. Called at each real boot milestone below,
  // so the bar reflects actual progress rather than a fake timed animation.
  function setLoaderProgress(pct) {
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    var fill = document.getElementById("loaderProgressFill");
    var label = document.getElementById("loaderProgressPct");
    var bar = document.getElementById("loaderProgress");
    if (fill) fill.style.width = pct + "%";
    if (label) label.textContent = pct + "%";
    if (bar) bar.setAttribute("aria-valuenow", String(pct));
  }

  /* ----------------------------- loader timing ---------------------------
     The loading animation always runs for a full LOADER_MS before the
     dashboard is revealed. Progress is driven by elapsed time so the bar
     tracks the animation, and boot milestones can only ever bring the
     loader down early — never later than the timer.
     ---------------------------------------------------------------------- */
  var LOADER_MS = 5000;
  var loaderStart = Date.now();
  var loaderDone = false;
  var loaderTick = setInterval(function () {
    if (loaderDone) return;
    // Runs the full 0 → 100 sweep across LOADER_MS, driven by real elapsed
    // time so the bar always lands on 100% exactly as the timer fires.
    setLoaderProgress(Math.min(100, ((Date.now() - loaderStart) / LOADER_MS) * 100));
  }, 50);

  // Fades out the loader and drops the driver on the dashboard.
  function finishLoader() {
    if (loaderDone) return;
    loaderDone = true;
    clearInterval(loaderTick);
    setLoaderProgress(100);

    // Hold on a completed bar for a beat so 100% is actually seen, then fade.
    var loader = document.getElementById("pageLoader");
    setTimeout(function () {
      if (loader && !loader.classList.contains("is-hidden")) {
        loader.classList.add("is-hidden");
        setTimeout(function () { if (loader.parentNode) loader.remove(); }, 600);
      }
      // Loading complete → land on the dashboard.
      try { go("dash"); } catch (e) { /* view layer not ready — dash is default */ }
    }, 260);
  }

  // Boot milestones call this; it never cuts the animation short.
  function hidePageLoader() {
    var wait = LOADER_MS - (Date.now() - loaderStart);
    if (wait > 0) { setTimeout(finishLoader, wait); return; }
    finishLoader();
  }

  // The animation runs its full duration regardless of how fast boot finishes.
  setTimeout(finishLoader, LOADER_MS);


  function toast(msg) {
    var t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText =
      "position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:99;background:#0F2748;" +
      "color:#fff;padding:12px 18px;border-radius:10px;font-size:13px;font-weight:600;" +
      "box-shadow:0 10px 28px rgba(15,39,72,.28);max-width:88vw;text-align:center";
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2400);
  }

  /* ============================ BFM EVALUATION ===========================
     Compares live worked time against the configured limits and works out
     how much rest is owed once a limit is reached.
     ===================================================================== */
  function evaluateBfm() {
    var untilRest = bfm.maxContinuousWork - state.sinceRestMins;
    var shiftLeft = bfm.maxWorkPerShift - state.workedMins;
    var weekLeft = bfm.maxWorkPerWeek - state.weekWorkedMins;

    var status = "ok";
    if (untilRest <= 0 || shiftLeft <= 0 || weekLeft <= 0) status = "breach";
    else if (untilRest <= bfm.warnBefore || shiftLeft <= bfm.warnBefore) status = "warn";

    // Rest owed: the configured block, or the full stationary rest once the
    // shift limit is reached.
    var restRequired = 0;
    var restReason = "";
    if (shiftLeft <= 0) {
      restRequired = bfm.minRestPerShift;
      restReason = "Shift work limit reached — a continuous stationary rest is required before you drive again.";
    } else if (untilRest <= 0) {
      restRequired = bfm.restBlock;
      restReason = "Continuous work limit reached — take your rest block now.";
    }

    return {
      status: status,
      untilRest: untilRest,
      shiftLeft: shiftLeft,
      weekLeft: weekLeft,
      restRequired: restRequired,
      restReason: restReason,
      rules: [
        { label: "Continuous work before rest", used: state.sinceRestMins, max: bfm.maxContinuousWork, note: "Rest required: " + bfm.restBlock + " continuous minutes" },
        { label: "Work this shift", used: state.workedMins, max: bfm.maxWorkPerShift, note: "Rest required: " + hm(bfm.minRestPerShift) + " continuous stationary rest" },
        { label: "Work this week", used: state.weekWorkedMins, max: bfm.maxWorkPerWeek, note: "Rolling 7 days" },
      ],
    };
  }

  function renderRules(hostId, ev) {
    var host = document.getElementById(hostId);
    if (!host) return;
    host.innerHTML = ev.rules.map(function (r) {
      var pct = Math.min(100, (r.used / r.max) * 100);
      var tone = pct >= 100 ? "red" : pct >= 88 ? "amber" : "green";
      return '<div class="bfm__rule"><span>' + r.label +
        ' <b>' + hm(r.used) + " / " + hm(r.max) + '</b></span>' +
        '<div class="bar"><i class="' + tone + '" style="width:' + pct + '%"></i></div>' +
        '<em>' + r.note + "</em></div>";
    }).join("");
  }

  function renderBfm() {
    var ev = evaluateBfm();
    var label = { ok: "Compliant", warn: "Rest due soon", breach: "Rest required now" }[ev.status];
    var sub = {
      ok: "Working within your configured BFM limits.",
      warn: "Plan to pull over — a rest block is due shortly.",
      breach: "You have reached a configured limit. Stop and rest before driving on.",
    }[ev.status];

    // dashboard card
    var hero = $("#bfmHero");
    if (hero) hero.className = "bfm__hero bfm-" + ev.status;
    setText("bfmState", label);
    setText("bfmStateSub", sub);
    setText("bfmCountdown", ev.untilRest > 0 ? hm(ev.untilRest) : hm(ev.restRequired));
    setText("bfmCountLabel", ev.untilRest > 0 ? "Until rest due" : "Rest required");
    renderRules("bfmRules", ev);

    var rest = $("#bfmRest");
    if (rest) {
      rest.className = "bfm__rest " + ev.status;
      setText("bfmRestText", ev.restRequired
        ? ev.restReason + " Required rest: " + hm(ev.restRequired) + "."
        : "No rest owing right now. Next rest block of " + bfm.restBlock + " minutes is due in " + hm(ev.untilRest) + ".");
    }
    setText("bfmMeta", bfm.module + " · limits sourced from the BFM Monitoring form · warn threshold " + bfm.warnBefore + " min");
    setText("bfmSource", bfm.source);
    setText("panelBfmModule", bfm.module);

    // trip page mirror
    var th = $("#tripBfmHero");
    if (th) th.className = "bfm__hero bfm-" + ev.status;
    setText("tripBfmState", label);
    setText("tripBfmStateSub", sub);
    setText("tripBfmCountdown", ev.untilRest > 0 ? hm(ev.untilRest) : hm(ev.restRequired));
    setText("tripBfmSrc", bfm.source);
    renderRules("tripBfmRules", ev);
    var tr = $("#tripBfmRest");
    if (tr) {
      tr.className = "bfm__rest " + ev.status;
      setText("tripBfmRestText", ev.restRequired
        ? ev.restReason + " Required rest: " + hm(ev.restRequired) + "."
        : "No rest owing right now. Next rest block due in " + hm(ev.untilRest) + ".");
    }
    setText("tripBfm", label.toUpperCase());
    setText("tripBfmSub", ev.untilRest > 0 ? "Rest due in " + hm(ev.untilRest) : "Rest " + hm(ev.restRequired) + " required");

    // KPI figures
    setText("kpiDuty", hm(state.workedMins));
    setText("kpiDutySub", hm(Math.max(0, ev.shiftLeft)) + " left");
    setText("tripDriving", hm(state.workedMins));

    if (ev.restRequired && !state.restAlertShown) showRestAlert(ev);
    return ev;
  }

  /* ---------------------------- rest alert ------------------------------- */
  // Short two-tone beep via Web Audio — no audio file needed/available, and
  // this still gives an audible cue distinct from the visual banner.
  var audioCtx = null;
  function playAlertSound() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      var now = audioCtx.currentTime;
      [880, 660].forEach(function (freq, i) {
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.16);
        gain.gain.setValueAtTime(0.0001, now + i * 0.16);
        gain.gain.exponentialRampToValueAtTime(0.22, now + i * 0.16 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.15);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now + i * 0.16);
        osc.stop(now + i * 0.16 + 0.16);
      });
    } catch (e) { /* Web Audio unavailable — visual banner still fires */ }
  }

  // Bumps the notification-bell badge, used for every BFM alert raised.
  function pushNotification() {
    state.notificationCount += 1;
    var dot = $("#bellDot"), count = $("#bellCount");
    if (count) { count.hidden = false; count.textContent = state.notificationCount > 9 ? "9+" : String(state.notificationCount); }
    if (dot) dot.hidden = true; // the numeric badge replaces the plain dot once active
  }
  function clearNotifications() {
    state.notificationCount = 0;
    var count = $("#bellCount");
    if (count) count.hidden = true;
  }

  function showRestAlert(ev) {
    state.restAlertShown = true;
    pushNotification();
    playAlertSound();

    var box = document.createElement("div");
    box.className = "rest-alert";
    box.setAttribute("role", "alert");
    box.innerHTML =
      '<svg width="20" height="20" style="flex:none;color:#D3352B;margin-top:1px"><use href="#i-alert"/></svg>' +
      "<div style='flex:1'><b>Rest required now</b><p>" + ev.restReason +
      " Take " + hm(ev.restRequired) + " and log it before driving on.</p></div>" +
      '<button class="xbtn" aria-label="Dismiss">✕</button>';
    box.querySelector("button").addEventListener("click", function () { box.remove(); });
    document.body.appendChild(box);

    // If the driver hasn't logged a qualifying break within 2 minutes of the
    // first alert, escalate: a stronger warning plus a driver-score penalty.
    setTimeout(function () {
      if (!state.tripStarted || state.restEscalated) return;
      var stillOwed = evaluateBfm().restRequired > 0;
      if (!stillOwed) return; // driver took the break in time — no penalty
      escalateRestBreach();
    }, 120000);
  }

  function escalateRestBreach() {
    state.restEscalated = true;
    pushNotification();
    playAlertSound();

    driver.score = Math.max(0, driver.score - 5);
    animateScore();

    var box = document.createElement("div");
    box.className = "rest-alert rest-alert--escalated";
    box.setAttribute("role", "alert");
    box.innerHTML =
      '<svg width="20" height="20" style="flex:none;color:#D3352B;margin-top:1px"><use href="#i-alert"/></svg>' +
      "<div style='flex:1'><b>Required rest still missed</b><p>You haven't logged a qualifying rest block. " +
      "5 points have been deducted from your driver score — pull over and log a break now.</p></div>" +
      '<button class="xbtn" aria-label="Dismiss">✕</button>';
    box.querySelector("button").addEventListener("click", function () { box.remove(); });
    document.body.appendChild(box);
  }

  // Seeds the BFM clock from the driver's actual entered start time, so the
  // countdown reflects real elapsed duty time rather than the static demo
  // defaults.
  function bfmStartMonitoring(startTimeStr) {
    var startMins = toMins(startTimeStr);
    if (startMins === null) return;
    var now = new Date();
    var nowMins = now.getHours() * 60 + now.getMinutes();
    var elapsed = nowMins - startMins;
    if (elapsed < 0) elapsed += 1440; // trip started before midnight
    state.workedMins = elapsed;
    state.sinceRestMins = elapsed;
    state.weekWorkedMins += elapsed;
    state.restAlertShown = false;
    state.restEscalated = false;
    clearNotifications();
    renderBfm();
    renderAlerts();
  }
  function bfmStopMonitoring() {
    state.restAlertShown = false;
    state.restEscalated = false;
  }

  /* ------------------------------ trip timer ------------------------------
     A live HH:MM:SS readout of elapsed trip time, shown on the Assigned
     Trip page between the "Trip running since…" text and the Log a break
     button. Starts the moment the driver saves their trip start time and
     keeps running in the background (independent of which view is open)
     until the trip is completed. */
  var tripTimerInterval = null;

  function updateTripTimerDisplay() {
    if (!state.tripStarted) return;
    var startMins = toMins(state.startTime);
    if (startMins === null) return;
    var now = new Date();
    var nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    var elapsedSec = nowSec - startMins * 60;
    if (elapsedSec < 0) elapsedSec += 86400; // trip started before midnight
    var hh = pad(Math.floor(elapsedSec / 3600));
    var mm = pad(Math.floor((elapsedSec % 3600) / 60));
    var ss = pad(elapsedSec % 60);
    setText("tripTimerVal", hh + ":" + mm + ":" + ss);
  }

  function startTripTimer() {
    if (tripTimerInterval) return;
    updateTripTimerDisplay();
    tripTimerInterval = setInterval(updateTripTimerDisplay, 1000);
  }

  // Browser/device "back" guard — once a trip is active, the driver must
  // complete it via "Complete trip" rather than navigating away. A history
  // entry is pushed the moment the trip starts; popstate (back button,
  // swipe-back, etc.) re-pushes it and warns instead of letting the
  // navigation proceed.
  var tripBackGuardArmed = false;
  function armTripBackGuard() {
    if (tripBackGuardArmed) return;
    tripBackGuardArmed = true;
    try { history.pushState({ skywayTripGuard: true }, ""); } catch (e) { /* no history API — nothing to guard */ }
  }
  function disarmTripBackGuard() {
    tripBackGuardArmed = false;
  }
  window.addEventListener("popstate", function () {
    if (!state.tripStarted) return;
    toast("Complete your trip before leaving this workflow.");
    try { history.pushState({ skywayTripGuard: true }, ""); } catch (e) { /* ignore */ }
  });

  function stopTripTimer() {
    if (tripTimerInterval) { clearInterval(tripTimerInterval); tripTimerInterval = null; }
    setText("tripTimerVal", "00:00:00");
  }

  // Pauses the timer (e.g. while logging a break) without resetting its
  // displayed value. Since the value is always computed from the real
  // elapsed wall-clock time since trip start, resuming (startTripTimer())
  // simply catches the display back up — nothing needs to be tracked across
  // the pause.
  function pauseTripTimer() {
    if (tripTimerInterval) { clearInterval(tripTimerInterval); tripTimerInterval = null; }
  }

  /* ============================ VIEW ROUTING ============================= */
  // Views that stay reachable once a trip is under way — everything else
  // (dashboard, vehicle check-in, pre-trip checks, start-trip form) is
  // off-limits until the trip is completed via "Complete trip".
  var TRIP_LOCKED_VIEWS = ["trip", "checkin", "pod", "fuel", "incident", "vehicleissue", "break", "tripfeedback"];

  function go(view) {
    if (state.tripStarted && TRIP_LOCKED_VIEWS.indexOf(view) === -1) {
      toast("Complete your trip before leaving this workflow.");
      return;
    }
    // Any open overlay panel (Driver info, Trip attendance, etc.) must not
    // stay open floating over a newly navigated-to view — e.g. the "View
    // documents" button lives inside the Driver Information panel.
    closePanels();
    state.view = view;
    ["Dash", "Vcheck", "Chktyres", "Chkbattery", "Chkfuel", "Chkgps", "Chkhealth",
     "Start", "Trip", "CheckIn", "Pod", "Fuel", "Incident", "VehicleIssue", "Break", "TripFeedback",
     "Documents"].forEach(function (v) {
      var el = document.getElementById("view" + v);
      if (el) el.hidden = v.toLowerCase() !== view;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (view === "start") prefillStart();
    if (view === "trip") { animateRing(); if (state.tripStarted) startTripTimer(); renderActiveTripDetails(); }
    if (view === "checkin") prefillCheckIn();
    if (view === "pod") renderPodItems();
    if (view === "vcheck" || view.indexOf("chk") === 0) refreshVcheck();
    if (view === "chktyres") speakTyreInstruction();
    if (view === "trip") animateMap();
    else if (typeof stopMapLive === "function") stopMapLive();
    if (view === "fuel") prefillFuel();
    else if (fuelDateTimeTimer) { clearInterval(fuelDateTimeTimer); fuelDateTimeTimer = null; }
    if (view === "incident") prefillIncident();
    if (view === "vehicleissue") prefillVehicleIssue();
    if (view === "break") prefillBreak();
    if (view === "tripfeedback") prefillTripFeedback();
    if (view === "documents") renderDriverDocuments();
    animateBars();
  }

  /* --------------------------- trip start form --------------------------- */
  function prefillStart() {
    var now = new Date();
    if (!$("#inStart").value) $("#inStart").value = pad(now.getHours()) + ":" + pad(now.getMinutes());
    // End Location is fetched automatically from the assigned Trip_Dispatch1
    // record's To_Location field — never typed by the driver.
    var endLoc = $("#inEndLoc");
    if (endLoc) endLoc.value = ACTIVE_TRIP.record ? (tripField(ACTIVE_TRIP.record, "toLocation") || "") : "";
    setText("startTripId", CURRENT_TRIP_ID);
    setText("startTripIdBig", CURRENT_TRIP_ID);
    setText("startBfmNote",
      bfm.module + ": you may work up to " + hm(bfm.maxWorkPerShift) +
      " in a shift, with a " + bfm.restBlock + " minute rest block after every " +
      hm(bfm.maxContinuousWork) + " of work.");
    recalc();
  }

  /* ------------------------------ trip data ------------------------------- */
  /* Every hub on TR-1048. `state` is one of done | current | next | upcoming;
     the hub navigator and the current/next summary both read from this list,
     so there's a single source of truth for stop ordering. */
  var HUBS = [
    { no: 6, name: "Goulburn Hub", location: "Sooley Drive, Goulburn NSW 2580", distance: "212 km", eta: "09:40 AM", status: "done",
      delivery: [["Consignment", "CN-40216"], ["Pallets", "6 of 34"], ["Weight", "1,840 kg"], ["Received by", "M. Doyle"], ["POD", "Signed 09:52"]] },
    { no: 7, name: "Gundagai Hub", location: "Sheridan Street, Gundagai NSW 2722", distance: "154 km", eta: "11:05 AM", status: "done",
      delivery: [["Consignment", "CN-40217"], ["Pallets", "4 of 34"], ["Weight", "1,120 kg"], ["Received by", "S. Patel"], ["POD", "Signed 11:14"]] },
    { no: 8, name: "Albury Hub", location: "Wagga Road, Lavington NSW 2641", distance: "118 km", eta: "11:58 AM", status: "current",
      delivery: [["Consignment", "CN-40218"], ["Pallets", "5 of 34"], ["Weight", "1,410 kg"], ["Received by", "K. Nguyen"], ["POD", "Signed 12:06"]] },
    { no: 9, name: "Seymour Hub", location: "Emily Street, Seymour VIC 3660", distance: "18.4 km", eta: "02:15 PM", status: "next",
      delivery: [["Consignment", "CN-40219"], ["Pallets", "7 of 34"], ["Weight", "1,960 kg"], ["Contact", "D. Harris · 0413 552 118"], ["Window", "2:00 – 3:00 PM"]] },
    { no: 10, name: "Craigieburn Hub", location: "Hume Highway, Craigieburn VIC 3064", distance: "62 km", eta: "03:10 PM", status: "upcoming",
      delivery: [["Consignment", "CN-40220"], ["Pallets", "5 of 34"], ["Weight", "1,380 kg"], ["Contact", "L. Romano · 0402 771 640"], ["Window", "3:00 – 4:00 PM"]] },
    { no: 11, name: "Broadmeadows Hub", location: "Camp Road, Broadmeadows VIC 3047", distance: "14 km", eta: "03:52 PM", status: "upcoming",
      delivery: [["Consignment", "CN-40221"], ["Pallets", "3 of 34"], ["Weight", "820 kg"], ["Contact", "A. Silva · 0455 903 214"], ["Window", "3:45 – 4:30 PM"]] },
    { no: 12, name: "Melbourne Distribution Hub", location: "Operations Way, Tullamarine VIC 3043", distance: "11 km", eta: "04:35 PM", status: "upcoming",
      delivery: [["Consignment", "CN-40222"], ["Pallets", "4 of 34"], ["Weight", "1,051 kg"], ["Contact", "Control desk · 03 9338 4100"], ["Window", "4:15 – 5:00 PM"]] },
  ];
  var TOTAL_STOPS = 12;
  var hubIndex = HUBS.findIndex(function (h) { return h.status === "next"; });
  if (hubIndex < 0) hubIndex = 0;

  // The trip the driver is currently assigned to start/drive. Referenced by
  // the Start Trip page, the dashboard's "Today's trip" card, and every
  // Trip_ID written back to Creator.
  var CURRENT_TRIP_ID = "TR-1048";

  // ---------------------------------------------------------------------
  // Active trip context — set ONCE, the moment the driver taps "Start
  // Trip" on a specific Today's Trip row (see setActiveTripFromRecord()),
  // and left untouched for the rest of that trip. Every trip-related save
  // for the remainder of the trip (vehicle check-in, fuel, incident,
  // vehicle issue, break, check-in, POD, Trip_Start) reads Trip ID,
  // Vehicle, Driver, and Driver ID from here — never re-derived, never
  // regenerated — so every record written to Zoho Creator for this trip
  // carries the exact same original identity.
  //
  // Two forms of each identity are kept: the human-readable value (for
  // forms/fields that store plain text) and the record's own Zoho ID (for
  // lookup/picklist fields like Vehicle_check_in's Trip_ID, Driver,
  // Trip_Name, and Vehicle, which store the linked record's ID, not its
  // display text).
  // ---------------------------------------------------------------------
  var ACTIVE_TRIP = {
    tripRecordId: null,   // Trip_Dispatch1 record's own Zoho ID
    tripId: "",            // Trip_ID display value, e.g. "TR-1048"
    tripName: "",           // Trip_Name display value
    vehicleRecordId: null, // Vehicle lookup's own Zoho ID
    vehicleName: "",        // Vehicle display value
    driverRecordId: null,  // Driver form record's own Zoho ID
    driverId: "",            // Driver's business "Driver ID" field value
    driverName: "",          // Driver's display name
    record: null,            // the full, original Trip_Dispatch1 record — every
                              // field the Trip Details section shows is read
                              // from here via tripField(), never re-derived.
  };

  // Captures Trip ID / Vehicle / Driver / Driver ID off the exact
  // Trip_Dispatch1 record the driver tapped Start Trip on, plus the
  // already-resolved driver identity. Called once, at the moment Start
  // Trip is tapped — nothing here is invented; every value is either the
  // record's own original field value or the driver's own resolved
  // identity (driver.recordId / driver.id / driver.name).
  function setActiveTripFromRecord(rec) {
    if (!rec) return;
    ACTIVE_TRIP.tripRecordId = rec.ID || rec.id || null;
    ACTIVE_TRIP.tripId = tripField(rec, "tripId") || "";
    ACTIVE_TRIP.tripName = tripField(rec, "tripName") || "";
    ACTIVE_TRIP.vehicleRecordId = tripFieldId(rec, "vehicle") || null;
    ACTIVE_TRIP.vehicleName = tripField(rec, "vehicle") || "";
    ACTIVE_TRIP.driverRecordId = driver.recordId || null;
    ACTIVE_TRIP.driverId = driver.id || "";
    ACTIVE_TRIP.driverName = driver.name || "";
    ACTIVE_TRIP.record = rec;
    if (ACTIVE_TRIP.tripId) CURRENT_TRIP_ID = ACTIVE_TRIP.tripId;
    console.log(LOG_TAG, "Active trip set:", ACTIVE_TRIP);
    renderActiveTripDetails();
    prefillStart();
  }

  // ---------------------------------------------------------------------
  // Trip Details section (the live Trip page) — every value here is read
  // straight off ACTIVE_TRIP.record, the exact Trip_Dispatch1 record the
  // driver tapped Start Trip on. Nothing is invented: fields with no
  // confirmed API name on that form (see the comment on TRIP_FIELD_
  // CANDIDATES above) render as "—" rather than a guess.
  // ---------------------------------------------------------------------
  function renderActiveTripDetails() {
    var rec = ACTIVE_TRIP.record;
    if (!rec) return;

    var tripId = tripField(rec, "tripId") || "—";
    var route = tripField(rec, "route") || "—";

    setText("atdHeaderTripId", tripId);
    setText("atdHeaderRoute", route);
    setText("atdTripId", tripId);
    setText("atdRoutePill", route);
    setText("atdTripName", tripField(rec, "tripName") || "—");
    setText("atdTripType", tripField(rec, "tripType") || "—");
    setText("atdTripStatus", tripField(rec, "status") || "—");
    setText("atdRoute", route);
    setText("atdBookingDate", tripField(rec, "bookingDate") || "—");
    setText("atdPlannedDelivery", tripField(rec, "plannedDelivery") || "—");
    setText("atdDeliveryMode", tripField(rec, "deliveryMode") || "—");
    setText("atdVehicle", tripField(rec, "vehicle") || "—");
    setText("atdVehicleCapacity", tripField(rec, "vehicleCapacity") || "—");
    setText("atdSupervisor", tripField(rec, "supervisor") || "—");
    setText("atdPrimaryDriver", tripField(rec, "primaryDriver") || "—");
    setText("atdSecondaryDriver", tripField(rec, "secondaryDriver") || "—");
    setText("atdPickupLocation", tripField(rec, "pickupLocation") || tripField(rec, "fromLocation") || "—");
    setText("atdDeliveryLocation", tripField(rec, "deliveryLocation") || tripField(rec, "toLocation") || "—");
    setText("atdQuantity", tripField(rec, "quantity") || "—");
    setText("atdWeight", tripField(rec, "weight") || "—");
    setText("atdTrackingNumber", tripField(rec, "trackingNumber") || "—");
    setText("atdFromLocation", tripField(rec, "fromLocation") || "—");
    setText("atdStartDateTime", tripField(rec, "startDateTime") || "—");
    setText("atdEstimatedDistance", tripField(rec, "estimatedDistance") || "—");
    setText("atdTotalLoadedWeight", tripField(rec, "totalLoadedWeight") || "—");
    setText("atdTripCompletion", tripField(rec, "tripCompletion") || "—");
    setText("atdToLocation", tripField(rec, "toLocation") || "—");
    setText("atdTripDuration", tripField(rec, "tripDuration") || "—");
  }

  // Trips assigned to this driver today.
  var TODAY_TRIPS = [
    { id: "TR-1046", route: "Eastern Creek → Goulburn", window: "04:10 – 05:55", stops: 3, status: "Completed" },
    { id: "TR-1047", route: "Goulburn → Gundagai", window: "06:00 – 06:25", stops: 2, status: "Completed" },
    { id: "TR-1048", route: "Sydney → Melbourne", window: "06:30 – 16:35", stops: 12, status: "Active" },
    { id: "TR-1051", route: "Tullamarine → Laverton", window: "17:20 – 18:40", stops: 2, status: "Scheduled" },
  ];

  // Rolling attendance record — starts at zero so the dashboard ring never
  // animates to a fabricated percentage before applyTripAttendance() sets
  // these from the driver's real Trip_Dispatch1 records.
  var ATTENDANCE = {
    attended: 0,
    cancelled: 0,
    get total() { return this.attended + this.cancelled; },
  };

  /* ------------------------------ hub navigator --------------------------- */
  function statusLabel(st) {
    return { done: "Delivered", current: "Current", next: "Next", upcoming: "Upcoming" }[st] || st;
  }

  // Paints the whole hub block: pair summary, dots, and the selected detail.
  function renderHubs() {
    var host = $("#hubDetail");
    if (!host) return;

    var current = HUBS.filter(function (h) { return h.status === "current"; })[0] || HUBS[0];
    var next = HUBS.filter(function (h) { return h.status === "next"; })[0] || HUBS[HUBS.length - 1];

    setText("hubCurrentName", current.name);
    setText("hubCurrentMeta", "Departed " + current.eta + " · Stop #" + current.no);
    setText("hubNextName", next.name);
    setText("hubNextMeta", next.distance + " · ETA " + next.eta);

    // pipeline: full sequence of hubs from origin to destination
    var pipe = $("#hubPipeline");
    if (pipe && pipe.childElementCount !== HUBS.length) {
      pipe.innerHTML = "";
      HUBS.forEach(function (h, i) {
        var node = document.createElement("button");
        node.type = "button";
        node.className = "hubpipe__node is-" + h.status;
        node.setAttribute("role", "tab");
        node.setAttribute("aria-label", "Stop " + h.no + " · " + h.name);
        node.innerHTML =
          '<span class="hubpipe__dot" aria-hidden="true"></span>' +
          '<span class="hubpipe__label">' + h.name + '</span>';
        node.addEventListener("click", function () { hubIndex = i; renderHubs(); });
        pipe.appendChild(node);
      });
    }
    if (pipe) {
      $$(".hubpipe__node", pipe).forEach(function (b, i) {
        b.classList.toggle("is-active", i === hubIndex);
        b.setAttribute("aria-selected", i === hubIndex ? "true" : "false");
      });
      var activeNode = pipe.children[hubIndex];
      if (activeNode) activeNode.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }

    var h = HUBS[hubIndex];
    setText("hubIndexLabel", "Stop " + h.no);
    setText("hubTotal", String(TOTAL_STOPS));
    setText("hubBadge", "Stop #" + h.no);
    setText("hubName", h.name);
    setText("hubLocation", h.location);
    setText("hubEta", h.eta);

    var st = $("#hubStatus");
    if (st) { st.textContent = statusLabel(h.status); st.className = "hubstatus is-" + h.status; }

    host.classList.remove("is-swap");
    void host.offsetWidth;          // restart the fade
    host.classList.add("is-swap");

    var prev = $("#hubPrev"), nxt = $("#hubNext");
    if (prev) prev.disabled = hubIndex === 0;
    if (nxt) nxt.disabled = hubIndex === HUBS.length - 1;

    // keep the trip-details summary in step with the selected hub
    setText("tripNextStopName", "Stop #" + next.no + " · " + next.name);
  }

  // Scrolls the trip page to the Hubs & stops card and flags it briefly.
  function goToHubs() {
    var card = $("#hubDetail");
    if (!card) return;
    var section = card.closest(".card") || card;
    setTimeout(function () {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      section.classList.remove("is-flash");
      void section.offsetWidth;
      section.classList.add("is-flash");
    }, 60);
  }

  function stepHub(delta) {
    hubIndex = Math.max(0, Math.min(HUBS.length - 1, hubIndex + delta));
    renderHubs();
  }

  /* --------------------------- trips & attendance ------------------------- */
  function tripRow(t) {
    var li = document.createElement("li");
    li.className = "triprow is-" + t.status.toLowerCase();
    li.innerHTML =
      '<div class="triprow__main">' +
        '<b class="triprow__id"></b>' +
        '<span class="triprow__route"></span>' +
        '<span class="triprow__meta"></span>' +
      '</div>' +
      '<span class="triprow__status"></span>';
    li.querySelector(".triprow__id").textContent = t.id;
    li.querySelector(".triprow__route").textContent = t.route;
    li.querySelector(".triprow__meta").textContent = t.window + " · " + t.stops + " stops";
    li.querySelector(".triprow__status").textContent = t.status;
    return li;
  }

  function renderTrips() {
    var host = $("#tripList");
    if (host) {
      host.innerHTML = "";
      TODAY_TRIPS.forEach(function (t) { host.appendChild(tripRow(t)); });
    }
    var done = TODAY_TRIPS.filter(function (t) { return t.status === "Completed"; }).length;
    var active = TODAY_TRIPS.filter(function (t) { return t.status === "Active"; }).length;
    var sched = TODAY_TRIPS.filter(function (t) { return t.status === "Scheduled"; }).length;

    setText("tripsAssigned", String(TODAY_TRIPS.length));
    setText("tripsDone", String(done));
    setText("tripsLeft", String(TODAY_TRIPS.length - done));
    setText("kpiTodayTrips", String(TODAY_TRIPS.length));
    setText("kpiTodayTripsSub", active + " active · " + done + " done · " + sched + " scheduled");
    setText("tripsDateLabel", todayLabel());

    var kpiBar = document.querySelector('[data-panel="panelTrips"] [data-fill]');
    if (kpiBar) kpiBar.setAttribute("data-fill", Math.round((done / TODAY_TRIPS.length) * 100));
  }

  // Shows a neutral "loading" placeholder in the Today's Trip list while
  // loadDriverTripsAndRender()'s real Trip_Dispatch1 fetch is in flight.
  // Deliberately shows no trip data at all here — per the requirement, only
  // the driver's real, original Zoho records are ever displayed, never a
  // sample/mock trip, not even briefly before the real data loads.
  function renderTodayTrip() {
    setText("dashTripCountLabel", "Loading…");
    var host = $("#dashTodayTripList");
    if (!host) return;
    host.innerHTML = "";
    var li = document.createElement("li");
    li.className = "triprow";
    li.textContent = "Loading trips…";
    host.appendChild(li);
  }

  // ---------------------------------------------------------------------
  // Live "Today's trip" lookup from the Trip & Dispatch report.
  //
  // Matches the Driver Name shown in the Driver Information panel
  // (driver.name — the same value resolved by mapEmployeeToDriver() from
  // the Driver form) EXACTLY against the Driver Name on each Trip_Dispatch1
  // record. Field API names are probed with candidate lists (via the
  // existing findField()/luVal() helpers) so this keeps working whether the
  // real field is called Driver_Name, Primary_Driver, etc., and whether it
  // comes back as a plain string or a lookup {ID, display_value} object.
  // ---------------------------------------------------------------------
  var TRIP_DISPATCH_REPORT = "Trip_Dispatch1";

  var TRIP_FIELD_CANDIDATES = {
    driverName: ["Driver_Name", "Primary_Driver"],
    secondaryDriverName: ["Secondary_Driver"],
    tripId: ["Trip_ID"],
    tripName: ["Trip_Name", "Route"],
    tripType: ["Trip_Type"],
    status: ["Trip_Status"],
    route: ["Route"],
    // "Trip Date" — the field the requirement filters/sorts Today's Trip
    // by. Confirmed field name from the shared Trip_Dispatch1 list config.
    startDateTime: ["Start_Date_Time"],
    customer: ["Customer"],
    bookingDate: ["Booking_Date"],
    // Confirmed field is Planned_Delivery_Date; the _Time variant is kept
    // as a fallback in case an older form revision is still in use.
    plannedDelivery: ["Planned_Delivery_Date", "Planned_Delivery_Date_Time"],
    vehicle: ["Vehicle"],
    vehicleCapacity: ["Vehicle_Capacity"],
    supervisor: ["Supervisor"],
    primaryDriver: ["Primary_Driver"],
    // Confirmed field, same list config as everything above.
    secondaryDriver: ["Secondary_Driver"],
    // Confirmed field. On this form Delivery Mode is what the requirement
    // calls "Delivery Mode" on the Trip Details section.
    deliveryMode: ["Delivery_Mode"],
    vehicleInspectionStatus: ["Vehicle_Inspection_Status"],
    driverComplianceStatus: ["Driver_Compliance_Status"],
    dispatcher: ["Dispatcher"],
    assignedHub: ["Assigned_Hub"],
    // These have no confirmed API name in the shared Trip_Dispatch1 list
    // config (no Pickup/Delivery Location, Quantity, or Tracking Number
    // field exists on this form) — kept as candidates so this starts
    // working immediately if/when those fields are added, without showing
    // fabricated data in the meantime (tripField() returns "—" when none
    // of the candidates match).
    assignedBookings: ["Assigned_Bookings", "Bookings", "Booking_IDs"],
    fromLocation: ["From_Location"],
    toLocation: ["To_Location"],
    pickupLocation: ["Pickup_Location", "Pick_Up_Location"],
    deliveryLocation: ["Delivery_Location"],
    estimatedDistance: ["Estimated_Distance_KM"],
    actualDistance: ["Actual_Distance_KM"],
    tripDuration: ["Trip_Duration"],
    quantity: ["Quantity", "Total_Quantity"],
    // Confirmed field is Total_loaded_Weight — there is no separate plain
    // "Weight" field on Trip_Dispatch1, so both the "Weight" and "Total
    // Loaded Weight" rows in the Trip Details section read this same field.
    weight: ["Total_loaded_Weight", "Weight"],
    totalLoadedWeight: ["Total_loaded_Weight"],
    // Confirmed field. No separate "Expected Delivery" field exists —
    // Planned_Delivery_Date is the closest match and is kept as a fallback.
    expectedDelivery: ["Expected_Delivery", "Expected_Delivery_Date", "Planned_Delivery_Date"],
    trackingNumber: ["Tracking_Number", "Tracking_No", "Tracking_ID"],
    tripCompletion: ["Trip_Completion_Date_Time"],
    actualDeparture: ["Actual_Departure_Date_Time"],
  };

  // Pulls a field off a Trip_Dispatch1 record, unwrapping lookup-field
  // values ({ID, display_value}) into a plain display string. Also handles
  // subform / multi-lookup fields (e.g. Assigned Bookings) that come back
  // as an array, joining each item's display value with a comma. This is
  // the ONLY transformation applied anywhere — every value shown on the
  // dashboard is the record's own original value, never invented or
  // recombined into a new synthetic value.
  function tripField(rec, logicalField) {
    var raw = findField(rec, TRIP_FIELD_CANDIDATES[logicalField] || []);
    if (Array.isArray(raw)) {
      return raw.map(function (item) { return luVal(item); }).filter(Boolean).join(", ");
    }
    return luVal(raw);
  }

  // Companion to tripField(): returns a lookup field's record ID (e.g. the
  // Vehicle lookup's own Zoho ID) instead of its display text. Used only
  // when that ID needs to be WRITTEN to another form's lookup field —
  // display rendering always uses tripField()/luVal().
  function tripFieldId(rec, logicalField) {
    var raw = findField(rec, TRIP_FIELD_CANDIDATES[logicalField] || []);
    if (Array.isArray(raw)) raw = raw[0];
    return luId(raw);
  }

  // Exact match, per the requirement: same Driver Name, ignoring only
  // leading/trailing whitespace (case is compared as-is).
  function isExactDriverNameMatch(recDriverName, wantedName) {
    return String(recDriverName || "").trim() === String(wantedName || "").trim();
  }

  function tripMatchesDriver(rec, wantedName) {
    return isExactDriverNameMatch(tripField(rec, "driverName"), wantedName)
      || isExactDriverNameMatch(tripField(rec, "secondaryDriverName"), wantedName);
  }

  // Parses whatever date format Trip_Dispatch1's Trip Date field comes back
  // as (Zoho typically sends "DD-MMM-YYYY HH:mm:ss" or ISO) into a sortable
  // number. Unparseable/blank values sort last, never crash the sort.
  function parseTripDateMs(value) {
    if (!value) return 0;
    var t = Date.parse(value);
    if (!isNaN(t)) return t;
    // Fallback for Zoho's common "DD-MMM-YYYY HH:mm:ss" display format.
    var m = String(value).match(/(\d{1,2})-(\w{3})-(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (m) {
      var months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
      var mo = months[m[2]];
      if (mo !== undefined) {
        var d = new Date(+m[3], mo, +m[1], +(m[4] || 0), +(m[5] || 0));
        if (!isNaN(d.getTime())) return d.getTime();
      }
    }
    return 0;
  }

  // True once a trip's date is today or later (start of today, local time)
  // — used to keep past-dated trips out of Today's Trip.
  function isTodayOrLaterMs(ms) {
    if (!ms) return false;
    var startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return ms >= startOfToday.getTime();
  }

  // True when a trip's Start Date & Time falls on today's calendar date —
  // this (and only this) is what decides whether that trip's row gets a
  // Start Trip button. Upcoming (future-dated) trips never get one.
  function isSameCalendarDay(ms) {
    if (!ms) return false;
    var d = new Date(ms), now = new Date();
    return d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth()
      && d.getDate() === now.getDate();
  }

  // Orders trips by Start Date & Time, most recent first — used by Trip
  // Attendance, which is a history list (unlike Today's Trip, which reads
  // soonest-first via applyTodayTrip's own ascending sort).
  function sortTripsByRecency(trips) {
    return trips.slice().sort(function (a, b) {
      return parseTripDateMs(tripField(b, "startDateTime")) - parseTripDateMs(tripField(a, "startDateTime"));
    });
  }

  function clearTodayTripCard(message) {
    setText("dashTripCountLabel", message || "No trips");
    var host = $("#dashTodayTripList");
    if (!host) return;
    host.innerHTML = "";
    var empty = document.createElement("li");
    empty.className = "triprow";
    empty.textContent = message || "No assigned trips for today or upcoming.";
    host.appendChild(empty);
  }

  // One row in the Today's Trip list — Trip Name, Trip ID, Trip Status,
  // Route, and Location details, all original Zoho values (nothing
  // recombined or reformatted beyond a plain UI label). A Start Trip
  // button is added only when this trip's Start Date & Time is today;
  // upcoming (future-dated) trips get no button at all, per requirement.
  function todayTripRow(rec) {
    var id = tripField(rec, "tripId") || "—";
    var name = tripField(rec, "tripName") || "—";
    var route = tripField(rec, "route") || "—";
    var from = tripField(rec, "fromLocation") || "—";
    var to = tripField(rec, "toLocation") || "—";
    var date = tripField(rec, "startDateTime") || "—";
    var status = tripField(rec, "status") || "—";
    var isToday = isSameCalendarDay(parseTripDateMs(tripField(rec, "startDateTime")));

    var li = document.createElement("li");
    li.className = "triprow " + tripStatusStateClass(status);
    li.setAttribute("data-trip-id", id);
    li.innerHTML =
      '<div class="triprow__main">' +
        '<b class="triprow__id"></b>' +
        '<span class="triprow__route" data-name></span>' +
        '<span class="triprow__meta" data-route></span>' +
        '<span class="triprow__meta" data-locations></span>' +
        '<span class="triprow__meta" data-date></span>' +
      '</div>' +
      '<span class="triprow__status"></span>' +
      (isToday
        ? '<button type="button" class="triprow__view is-start" data-nav="vcheck" data-start-trip data-trip-id="' + id + '">Start Trip · ' + id + '</button>'
        : '');
    li.querySelector(".triprow__id").textContent = id;
    li.querySelector("[data-name]").textContent = name;
    li.querySelector("[data-route]").textContent = "Route: " + route;
    li.querySelector("[data-locations]").textContent = "From: " + from + "  ·  To: " + to;
    li.querySelector("[data-date]").textContent = "Start: " + date;
    li.querySelector(".triprow__status").textContent = status;
    return li;
  }

  // Populates the dashboard's Today's Trip list, per the requirement:
  //   - Driver Name already matched (rows is pre-filtered by the caller).
  //   - Trip_Status must be exactly "Assigned".
  //   - Trip Date must be today or a future date (no past trips).
  //   - Earliest date first.
  // Every displayed value is the record's own original field value (via
  // tripField()/luVal()) — nothing here is created, modified, or replaced.
  // Returns the list of trips it actually rendered.
  function applyTodayTrip(rows) {
    var eligible = rows.filter(function (rec) {
      return tripField(rec, "status") === "Assigned"
        && isTodayOrLaterMs(parseTripDateMs(tripField(rec, "startDateTime")));
    });

    // Earliest first (ascending) — the opposite order from the Trip
    // Attendance list, which reads most-recent-first.
    var picked = eligible.slice().sort(function (a, b) {
      return parseTripDateMs(tripField(a, "startDateTime")) - parseTripDateMs(tripField(b, "startDateTime"));
    });

    setText("dashTripCountLabel", picked.length ? (picked.length + (picked.length === 1 ? " trip" : " trips")) : "No trips");

    // The top-of-dashboard "Start Trip" tile always mirrors the earliest
    // trip in this same list (see boot()'s #btnStartTop handler), so it
    // can never launch the vehicle check-in without a real trip behind it.
    TODAY_TRIP_PICKED = picked;
    var topLabel = $("#startTopLabel");
    if (topLabel) {
      topLabel.textContent = picked.length
        ? ("Trip " + (tripField(picked[0], "tripId") || "—") + " · ready")
        : "No trip assigned yet";
    }

    var host = $("#dashTodayTripList");
    if (host) {
      host.innerHTML = "";
      if (!picked.length) {
        var empty = document.createElement("li");
        empty.className = "triprow";
        empty.textContent = "No assigned trips for today or upcoming.";
        host.appendChild(empty);
      } else {
        picked.forEach(function (rec) {
          // Registered in the shared lookup map so the Start Trip button
          // (see boot()'s data-start-trip handler) can retrieve the full
          // original record and call setActiveTripFromRecord() with it.
          var id = tripField(rec, "tripId") || "—";
          DRIVER_TRIPS_BY_ID[id] = rec;
          host.appendChild(todayTripRow(rec));
        });
      }
    }

    return picked;
  }

  // ---------------------------------------------------------------------
  // Trip Attendance — every trip assigned to the driver with a status other
  // than "Assigned" (Assigned trips live in Today's Trip instead), each row
  // showing only Trip ID, Trip Date, Trip Status, and a View button that
  // opens the full Trip Details popup.
  // ---------------------------------------------------------------------

  // Maps a Trip_Status value onto the .triprow / .hubstatus state classes
  // that already exist in Style.css, so real Zoho statuses get sensible
  // colouring without needing new CSS.
  function tripStatusStateClass(status) {
    var s = String(status || "").toLowerCase();
    if (s === "completed") return "is-completed";
    if (s === "cancelled") return "is-cancelled";
    if (["dispatched", "in transit", "arrived"].indexOf(s) !== -1) return "is-active";
    return "is-scheduled"; // Planned, or anything unrecognised
  }

  // Trip ID -> raw record, so a click on View can look the full record
  // back up without a second network call.
  var DRIVER_TRIPS_BY_ID = {};
  // The exact list applyTodayTrip() last rendered — read by the top
  // starttop tile's click handler so it always starts the same trip
  // shown as first in that list, never a stale/hardcoded one.
  var TODAY_TRIP_PICKED = [];

  // One row in the Trip Attendance list: Trip ID, Trip Date, Trip Status,
  // and a View button — exactly the four things the requirement calls for,
  // nothing else. The View button (not the row) is what opens the popup.
  function driverTripRow(rec) {
    var id = tripField(rec, "tripId") || "—";
    var date = tripField(rec, "startDateTime") || "—";
    var status = tripField(rec, "status") || "—";

    var li = document.createElement("li");
    li.className = "triprow " + tripStatusStateClass(status);
    li.setAttribute("data-trip-id", id);
    li.innerHTML =
      '<div class="triprow__main">' +
        '<b class="triprow__id"></b>' +
        '<span class="triprow__meta"></span>' +
      '</div>' +
      '<span class="triprow__status"></span>' +
      '<button type="button" class="triprow__view" data-view-trip>View</button>';
    li.querySelector(".triprow__id").textContent = id;
    li.querySelector(".triprow__meta").textContent = date;
    li.querySelector(".triprow__status").textContent = status;
    return li;
  }

  // Renders the Trip Attendance numbers (header avatar, dashboard card, and
  // the Trip attendance panel) — computed from every trip assigned to the
  // driver, so the percentage reflects the driver's full trip history —
  // plus the trip list: every trip NOT already shown in Today's Trip
  // (todaysTripIds), most recent first. Excluding by actual trip ID rather
  // than just "status !== Assigned" also catches an edge case: an Assigned
  // trip dated in the past (so it didn't qualify for Today's Trip's
  // today-or-later filter) still shows up here instead of disappearing.
  function applyTripAttendance(rows, todaysTripIds, emptyMessage) {
    var attended = rows.filter(function (t) { return tripField(t, "status") === "Completed"; }).length;
    var cancelled = rows.filter(function (t) { return tripField(t, "status") === "Cancelled"; }).length;
    var total = rows.length;
    var pct = total ? Math.round((attended / total) * 100) : 0;

    setText("attDone", String(attended));
    setText("attCancel", String(cancelled));
    setText("attTotal", String(total));
    setText("attDone2", String(attended));
    setText("attCancel2", String(cancelled));
    setText("attTotal2", String(total));
    setText("attSub", pct + "% attendance · all assigned trips");
    setText("tripAttMini", pct + "%");
    setText("tripAttSub", attended + " of " + total);
    setText("dashAttDone", String(attended));
    setText("dashAttCancel", String(cancelled));
    setText("dashAttTotal", String(total));
    setText("dashAttSub", attended + " of " + total);

    // animateOneAttRing() reads its percentage straight off ATTENDANCE, so
    // keeping that object's numbers in sync keeps both rings (header avatar
    // + dashboard card + panel) correct wherever/whenever they're animated.
    ATTENDANCE.attended = attended;
    ATTENDANCE.cancelled = cancelled;
    animateDashAttRing();
    var attPanelEl = $("#panelAttendance");
    if (attPanelEl && !attPanelEl.hidden) animateAttRing();

    var excludeIds = todaysTripIds || [];
    // Two independent exclusions, both required:
    //  1. status !== "Assigned" — per the requirement, Assigned trips never
    //     appear here at all, regardless of date. Filtering only by
    //     excludeIds previously missed a past-dated Assigned trip (one that
    //     didn't qualify for Today's Trip's today-or-later date filter),
    //     which would otherwise leak into this list.
    //  2. excludeIds — belt-and-braces: keeps this list from ever
    //     double-showing a trip that Today's Trip is currently rendering.
    var otherRows = sortTripsByRecency(rows.filter(function (t) {
      return tripField(t, "status") !== "Assigned"
        && excludeIds.indexOf(tripField(t, "tripId")) === -1;
    }));

    otherRows.forEach(function (rec) {
      var id = tripField(rec, "tripId") || "—";
      DRIVER_TRIPS_BY_ID[id] = rec;
    });

    // Rendered in two places: the dashboard's Trip Attendance card
    // (#dashAttList, always visible) and the same list inside the full
    // Trip Attendance panel (#attList, opened via the avatar button or the
    // new Summary button) — both stay in sync since they're built here.
    [$("#dashAttList"), $("#attList")].forEach(function (host) {
      if (!host) return;
      host.innerHTML = "";
      if (!otherRows.length) {
        var empty = document.createElement("li");
        empty.className = "triprow";
        empty.textContent = emptyMessage || "No other trips assigned to this driver.";
        host.appendChild(empty);
        return;
      }
      otherRows.forEach(function (rec) { host.appendChild(driverTripRow(rec)); });
    });
  }

  // Populates and opens the Trip Details popup for one Trip_Dispatch1
  // record, covering all four groups: Trip details, Assignment, Bookings,
  // and Locations & delivery.
  function openTripDetailsPopup(rec) {
    if (!rec) return;

    var tripId = tripField(rec, "tripId") || "—";
    var status = tripField(rec, "status") || "—";
    var stateClass = tripStatusStateClass(status);

    setText("tdTripId", tripId);
    setText("tdTripIdRow", tripId);
    setText("tdTripType", tripField(rec, "tripType") || "—");
    setText("tdTripStatus", status);
    setText("tdTripStatusRow", status);
    setText("tdRoute", tripField(rec, "route") || "—");
    setText("tdBookingDate", tripField(rec, "bookingDate") || "—");
    setText("tdPlannedDelivery", tripField(rec, "plannedDelivery") || "—");

    setText("tdVehicle", tripField(rec, "vehicle") || "—");
    setText("tdVehicleCapacity", tripField(rec, "vehicleCapacity") || "—");
    setText("tdSupervisor", tripField(rec, "supervisor") || "—");
    setText("tdPrimaryDriver", tripField(rec, "primaryDriver") || "—");
    setText("tdVehicleInspectionStatus", tripField(rec, "vehicleInspectionStatus") || "—");

    setText("tdFromLocation", tripField(rec, "fromLocation") || "—");
    setText("tdToLocation", tripField(rec, "toLocation") || "—");
    setText("tdPickupLocation", tripField(rec, "pickupLocation") || "—");
    setText("tdDeliveryLocation", tripField(rec, "deliveryLocation") || "—");
    setText("tdEstimatedDistance", tripField(rec, "estimatedDistance") || "—");
    setText("tdTripDuration", tripField(rec, "tripDuration") || "—");
    setText("tdQuantity", tripField(rec, "quantity") || "—");
    setText("tdWeight", tripField(rec, "weight") || "—");
    setText("tdExpectedDelivery", tripField(rec, "expectedDelivery") || "—");

    var statusEl = $("#tdTripStatus");
    if (statusEl) statusEl.className = "hubstatus " + stateClass;

    openPanel("panelTripDetails", null);
  }

  // Single shared fetch: pulls Trip_Dispatch1, keeps only the records whose
  // Driver Name exactly matches the Driver Name shown in the Driver
  // Information panel (driver.name), and feeds that same filtered list into
  // both the dashboard's "Today's trip" card and the Trip Attendance
  // section — so the two stay consistent and there's only one network call.
  // Resolves quietly (never rejects) so a lookup failure here can't break
  // the rest of the driver profile load in loadFromCreator().
  function loadDriverTripsAndRender() {
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA) {
      DRIVER_TRIPS_BY_ID = {};
      clearTodayTripCard("Preview mode — not connected to Zoho Creator");
      applyTripAttendance([], [], "Preview mode — not connected to Zoho Creator.");
      return Promise.resolve();
    }
    if (!driver.name || driver.name === "Driver not found") {
      DRIVER_TRIPS_BY_ID = {};
      clearTodayTripCard("No matching driver found");
      applyTripAttendance([], [], "No matching driver found.");
      return Promise.resolve();
    }

    var driverName = driver.name.trim();

    return getRecordsSafe({
      report_name: TRIP_DISPATCH_REPORT,
      field_config: "all",
      max_records: 200,
    }).then(function (res) {
      var allRows = (res && res.data) || [];
      var rows = allRows.filter(function (rec) { return tripMatchesDriver(rec, driverName); });
      console.log(LOG_TAG, TRIP_DISPATCH_REPORT, "exact Driver Name matches for", driverName, ":", rows.length, "of", allRows.length);

      // Reset once per fetch, before either list is (re)built, so both
      // applyTodayTrip() and applyTripAttendance() populate it fresh —
      // neither one wipes out entries the other just added.
      DRIVER_TRIPS_BY_ID = {};

      if (!rows.length) {
        clearTodayTripCard("No trip assigned");
        applyTripAttendance([], [], "No trips assigned to this driver.");
        return;
      }

      var todaysTrips = applyTodayTrip(rows);
      var todaysTripIds = todaysTrips.map(function (rec) { return tripField(rec, "tripId"); });
      applyTripAttendance(rows, todaysTripIds);
    }).catch(function (err) {
      console.error(LOG_TAG, "loadDriverTripsAndRender failed:", err);
      DRIVER_TRIPS_BY_ID = {};
      clearTodayTripCard("Couldn't load trip");
      applyTripAttendance([], [], "Couldn't load trips for this driver.");
    });
  }

  // Shows neutral "loading" placeholders for the attendance stats and Other
  // Trips list while loadDriverTripsAndRender()'s real fetch is in flight.
  // No mock numbers or mock trips are shown here — only the real
  // Trip_Dispatch1 data, once loaded, ever appears (see applyTripAttendance).
  function renderAttendance() {
    ["attDone", "attCancel", "attTotal", "attDone2", "attCancel2", "attTotal2",
     "dashAttDone", "dashAttCancel", "dashAttTotal"].forEach(function (id) { setText(id, "—"); });
    setText("attSub", "Loading…");
    setText("tripAttMini", "—");
    setText("tripAttSub", "Loading…");
    setText("dashAttSub", "Loading…");

    [$("#attList"), $("#dashAttList")].forEach(function (host) {
      if (!host) return;
      host.innerHTML = "";
      var li = document.createElement("li");
      li.className = "triprow";
      li.textContent = "Loading trips…";
      host.appendChild(li);
    });
    return 0;
  }

  // Sweeps a single attendance ring element (svg circle + percent label).
  function animateOneAttRing(ringId, pctId) {
    var ring = $("#" + ringId), lbl = $("#" + pctId);
    if (!ring) return;
    var pct = ATTENDANCE.total ? ATTENDANCE.attended / ATTENDANCE.total : 0;
    var circ = 339;
    ring.style.transition = "none";
    ring.style.strokeDashoffset = circ;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        ring.style.transition = "stroke-dashoffset 1.1s cubic-bezier(.3,.8,.3,1)";
        ring.style.strokeDashoffset = circ * (1 - pct);
      });
    });
    if (lbl) {
      var target = Math.round(pct * 100), i = 0;
      var t = setInterval(function () {
        i += Math.max(1, Math.round(target / 22));
        if (i >= target) { i = target; clearInterval(t); }
        lbl.textContent = i + "%";
      }, 40);
    }
  }

  // Sweeps the attendance ring when its panel opens.
  function animateAttRing() {
    animateOneAttRing("attRing", "attPct");
  }
  // Dashboard "Trip attendance" card's own ring — animated on boot and any
  // time attendance data refreshes, independent of the slide-over panel.
  function animateDashAttRing() {
    animateOneAttRing("dashAttRing", "dashAttPct");
  }

  /* -------------------------- vehicle check-in ---------------------------- */
  /* Each check reports Pass / Monitor / Defect. Numeric readings are graded
     against realistic thresholds, and the worst grade across a card's inputs
     becomes that card's result — one bad reading fails the check. */
  var vcheckResult = null;

  var VCHECKS = {
    tyres: { label: "Tyres", fields: ["fTyrePress", "fTyreSpare", "fTyreCond"] },
    battery: { label: "Battery", fields: ["fBattCond", "fBattFunc"] },
    fuel: { label: "Fuel", fields: ["fVcFuelType", "fFuelPct", "fFuelOk"] },
    gps: { label: "GPS", fields: ["fGpsFixed", "fGpsId", "fGpsCond"] },
    health: { label: "Driver health", fields: ["fHealthDrive", "fHealthFatigue"] },
  };
  var RANK = { Pass: 0, Monitor: 1, Defect: 2 };

  // Grades a number: below `defect` fails, below `monitor` warns.
  function gradeNum(v, monitor, defect) {
    if (v === "" || v === null || isNaN(v)) return null;
    v = Number(v);
    if (v < defect) return "Defect";
    if (v < monitor) return "Monitor";
    return "Pass";
  }
  function worst(list) {
    var out = "Pass";
    for (var i = 0; i < list.length; i++) {
      if (list[i] === null) return null;             // incomplete
      if (RANK[list[i]] > RANK[out]) out = list[i];
    }
    return out;
  }
  function sel(id) { var v = val(id); return v || null; }
  // Grades a Yes/No hidden field: "yes" passes, "no" is a defect, unset is incomplete.
  function gradeYN(id) {
    var v = val(id);
    if (v === "") return null;
    return v === "yes" ? "Pass" : "Defect";
  }
  // Grades a dropdown by mapping its raw option value through `map`.
  function gradeMap(id, map) {
    var v = val(id);
    if (v === "") return null;
    return map[v] || "Defect";
  }

  // Returns { tyres: "Pass"|"Monitor"|"Defect"|null, … }
  function gradeVcheck() {
    var tyreKeys = Object.keys(tyrePressures);
    var allTyresSet = tyreKeys.every(function (k) { return tyrePressures[k] !== null || tyrePressureOk[k] !== null; });
    var tyreGrade = null;
    if (allTyresSet) {
      tyreGrade = "Pass";
      tyreKeys.forEach(function (k) {
        var g = gradeTyreOverall(k);
        if (RANK[g] > RANK[tyreGrade]) tyreGrade = g;
      });
    }
    return {
      tyres: worst([
        tyreGrade,
        sel("#inTyreCond") === null ? null : (
          val("#inTyreCond") === "Good" ? "Pass" :
          val("#inTyreCond") === "Average" ? "Monitor" : "Defect"
        ),
      ]),
      battery: worst([
        gradeMap("#inBattCond", { Good: "Pass", Bad: "Defect", Change: "Defect" }),
        gradeYN("#inBattFunc"),
      ]),
      fuel: worst([
        sel("#inVcFuelType") === null ? null : "Pass",
        gradeNum(val("#inVcFuelLevel"), 40, 25),
        gradeYN("#inFuelOk"),
      ]),
      gps: worst([
        gradeYN("#inGpsFixed"),
        sel("#inGpsUnit") === null ? null : "Pass",
        gradeMap("#inGpsCond", { Good: "Pass", Weak: "Monitor", Faulty: "Defect" }),
      ]),
      health: worst([
        gradeYN("#inHealthDrive"),
        sel("#inHealthFatigue"),
      ]),
    };
  }

  // Repaints each card's status pill and the running tally.
  // Per-check verification. A check counts as verified only once the driver
  // has opened it, filled every field, and pressed Verify — grading alone
  // isn't enough, since the point is a deliberate confirmation.
  var vcVerified = { tyres: false, battery: false, fuel: false, gps: false, health: false };

  // Repaints the KPI tiles, detail-card accents and the progress summary.
  function refreshVcheck() {
    var g = gradeVcheck(), verified = 0, defects = 0;

    Object.keys(VCHECKS).forEach(function (k) {
      var v = g[k];
      if (v === "Defect") { defects++; vcVerified[k] = false; }
      if (vcVerified[k]) verified++;

      var pill = document.querySelector('[data-pill="' + k + '"]');
      if (pill) {
        pill.textContent = v === null ? "Not checked" : v;
        pill.className = "checkpill" + (v === null ? "" : " is-" + v.toLowerCase());
      }

      var card = document.querySelector('[data-check="' + k + '"]');
      if (card) {
        card.classList.remove("is-pass", "is-monitor", "is-defect");
        if (v) card.classList.add("is-" + v.toLowerCase());
      }

      // Tile face
      var tile = document.querySelector('[data-check-card="' + k + '"]');
      var stateEl = document.querySelector('[data-kpi-state="' + k + '"]');
      if (stateEl) {
        stateEl.textContent = vcVerified[k] ? "Verified" : (v === null ? "Not checked" : v);
        stateEl.className = "qa__state" +
          (vcVerified[k] ? " is-verified" : (v === null ? "" : " is-" + v.toLowerCase()));
      }
      if (tile) {
        tile.classList.remove("is-pass", "is-monitor", "is-defect", "is-verified");
        if (v) tile.classList.add("is-" + v.toLowerCase());
        if (vcVerified[k]) tile.classList.add("is-verified");
      }
    });

    setText("vcPassed", verified + " / 5");
    setText("vcDefects", String(defects));
    var bar = $("#vcProgress");
    if (bar) bar.style.width = (verified / 5 * 100) + "%";

    var allDone = verified === 5;
    setText("vcResult", allDone ? "Cleared to depart" : (defects ? "Defects raised" : "Incomplete"));

    // Green Start Trip CTA unlocks only once all five checks are verified.
    // Always shows the Trip ID for the trip this check-in is actually for
    // (ACTIVE_TRIP.tripId once set, else CURRENT_TRIP_ID) so the driver can
    // confirm they're starting the right trip before it unlocks.
    var startCta = $("#btnStartTripCta");
    if (startCta) {
      startCta.disabled = !allDone;
      var ctaTripId = ACTIVE_TRIP.tripId || CURRENT_TRIP_ID || "";
      var ctaLabel = startCta.querySelector("span");
      if (ctaLabel) {
        ctaLabel.textContent = (allDone ? "Start Trip" : "Start Trip — " + verified + "/5 checks")
          + (ctaTripId ? " · " + ctaTripId : "");
      }
    }
    return g;
  }

  // Each check has its own page now, so opening one is just navigation.
  var CHECK_VIEW = {
    tyres: "chktyres", battery: "chkbattery", fuel: "chkfuel",
    gps: "chkgps", health: "chkhealth",
  };
  function openCheck(key) {
    if (CHECK_VIEW[key]) go(CHECK_VIEW[key]);
  }
  function closeCheck() { go("vcheck"); }

  // Validates a single check and marks it verified.
  function verifyCheck(key) {
    var err = document.querySelector('[data-err="' + key + '"]');
    clearBad(VCHECKS[key].fields);
    if (err) err.hidden = true;

    var g = gradeVcheck();
    var v = g[key];

    if (v === null) {
      VCHECKS[key].fields.forEach(function (id) {
        var el = document.getElementById(id);
        var input = el && el.querySelector("input, select");
        if (el && input && !String(input.value).trim()) el.classList.add("is-bad");
      });
      if (err) { err.textContent = "Complete every field in this check before verifying."; err.hidden = false; }
      refreshVcheck();
      return;
    }

    if (v === "Defect") {
      if (err) {
        err.textContent = "This check has failed. Raise a vehicle issue — the trip can't start with an open defect.";
        err.hidden = false;
      }
      refreshVcheck();
      return;
    }

    vcVerified[key] = true;
    refreshVcheck();
    closeCheck();
    toast(VCHECKS[key].label + " verified" + (v === "Monitor" ? " — flagged to monitor" : ""));

    if (Object.keys(vcVerified).every(function (k) { return vcVerified[k]; })) {
      saveVcheck();
      toast("All checks verified — VH-208 cleared to depart");
    }
  }

  /* --------------------- tyre illustration + popup ------------------------ */
  // Tyre-count filter: the driver can switch the vehicle between 6 / 8 / 12
  // / 16 tyres. Each option maps to an axle layout (front axles carry a
  // single tyre per side, rear axles carry duals per side) that drives the
  // dynamic key set below, the fallback tyre grid, and the 3D truck model —
  // all three always stay in sync with the current selection.
  var TYRE_COUNT_CONFIGS = {
    6:  { frontAxles: 1, rearDualAxles: 1 },
    8:  { frontAxles: 2, rearDualAxles: 1 },
    12: { frontAxles: 2, rearDualAxles: 2 },
    16: { frontAxles: 2, rearDualAxles: 3 }
  };
  var DEFAULT_TYRE_COUNT = 6;
  var currentTyreCount = DEFAULT_TYRE_COUNT;

  // Builds the ordered {key: {x, z, dual, label}} layout for a tyre count.
  // x/z are the 3D truck's local axle/side coordinates (also reused by
  // veh3dBuildTruck); dual marks a rear axle sharing one checkable badge
  // across its twin tyres, same convention the original fl/fr/rl/rr used.
  function computeAxlePositions(count) {
    var cfg = TYRE_COUNT_CONFIGS[count] || TYRE_COUNT_CONFIGS[DEFAULT_TYRE_COUNT];
    var positions = {};

    var frontXs = cfg.frontAxles === 1 ? [1.7] : [1.95, 1.4];
    frontXs.forEach(function (x, i) {
      var n = i + 1;
      var multi = cfg.frontAxles > 1;
      var lk = multi ? ("f" + n + "l") : "fl";
      var rk = multi ? ("f" + n + "r") : "fr";
      var prefix = multi ? ("Front axle " + n + " ") : "Front ";
      positions[lk] = { x: x, z: 0.83, dual: false, label: prefix + "left tyre" };
      positions[rk] = { x: x, z: -0.83, dual: false, label: prefix + "right tyre" };
    });

    var rearCount = cfg.rearDualAxles;
    var rearXs = rearCount === 1 ? [-1.5] : rearCount === 2 ? [-1.3, -1.85] : [-1.05, -1.55, -2.05];
    rearXs.forEach(function (x, i) {
      var n = i + 1;
      var multi = rearCount > 1;
      var lk = multi ? ("r" + n + "l") : "rl";
      var rk = multi ? ("r" + n + "r") : "rr";
      var prefix = multi ? ("Rear axle " + n + " ") : "Rear ";
      positions[lk] = { x: x, z: 0.83, dual: true, label: prefix + "left tyres" };
      positions[rk] = { x: x, z: -0.83, dual: true, label: prefix + "right tyres" };
    });

    return positions;
  }

  function tyreCountTotal(count) {
    var cfg = TYRE_COUNT_CONFIGS[count] || TYRE_COUNT_CONFIGS[DEFAULT_TYRE_COUNT];
    return cfg.frontAxles * 2 + cfg.rearDualAxles * 4;
  }

  var TYRE_LABELS = {};
  var tyrePressures = {};
  var tyrePressureOk = {};
  var activeTyre = null;

  // (Re)builds the label/state objects for a given tyre count. Existing
  // readings for positions that still exist after the switch are kept;
  // positions that no longer exist are simply dropped.
  function applyTyreCount(count, keepExisting) {
    var positions = computeAxlePositions(count);
    var nextPressures = {}, nextOk = {}, nextLabels = {};
    Object.keys(positions).forEach(function (k) {
      nextPressures[k] = (keepExisting && tyrePressures[k] !== undefined) ? tyrePressures[k] : null;
      nextOk[k] = (keepExisting && tyrePressureOk[k] !== undefined) ? tyrePressureOk[k] : null;
      nextLabels[k] = positions[k].label;
    });
    tyrePressures = nextPressures;
    tyrePressureOk = nextOk;
    TYRE_LABELS = nextLabels;
    currentTyreCount = count;
    return positions;
  }
  applyTyreCount(DEFAULT_TYRE_COUNT, false);

  // Entry point for the Tyre filter (6 / 8 / 12 / 16 tyres): rebuilds the
  // tracked positions, the fallback grid, and — if the 3D viewer booted —
  // the truck model itself, then repaints badges/rings and the check's
  // pass/monitor/defect grade against the new layout.
  function setTyreCount(count) {
    count = Number(count) || DEFAULT_TYRE_COUNT;
    if (!TYRE_COUNT_CONFIGS[count]) count = DEFAULT_TYRE_COUNT;
    if (count === currentTyreCount && Object.keys(tyrePressures).length) return;
    var positions = applyTyreCount(count, true);
    rebuildFallbackGrid(positions);
    veh3dRebuildTruck(positions);
    syncTyreIllustration();
  }

  function gradeTyrePsi(v) {
    if (v === null || v === "" || isNaN(v)) return null;
    v = Number(v);
    if (v >= 100 && v <= 120) return "Pass";
    if (v >= 90 && v <= 130) return "Monitor";
    return "Defect";
  }

  // Combines the numeric psi reading with the driver's Yes/No declaration —
  // a "No" always fails the tyre regardless of what the number says.
  function gradeTyreOverall(key) {
    var numGrade = gradeTyrePsi(tyrePressures[key]);
    if (tyrePressureOk[key] === "no") return "Defect";
    if (tyrePressureOk[key] === "yes" && numGrade === null) return "Pass";
    return numGrade;
  }

  // Pushes the worst (least-safe) reading into the hidden field the existing
  // grading logic (#inTyrePress) already reads, and refreshes each tyre's
  // badge plus the on-illustration summary line.
  function syncTyreIllustration() {
    var keys = Object.keys(tyrePressures);
    var set = keys.filter(function (k) { return tyrePressures[k] !== null || tyrePressureOk[k] !== null; });

    var worstVal = null, worstRank = -1, rank = { Pass: 0, Monitor: 1, Defect: 2 };
    set.forEach(function (k) {
      var g = gradeTyreOverall(k);
      if (rank[g] > worstRank) { worstRank = rank[g]; worstVal = tyrePressures[k]; }
    });
    var hidden = $("#inTyrePress");
    if (hidden) hidden.value = worstVal === null ? (worstRank >= 0 ? "0" : "") : worstVal;

    keys.forEach(function (k) {
      var btn = document.querySelector('.tyre3d__tyre[data-tyre="' + k + '"]');
      var badge = document.querySelector('[data-badge="' + k + '"]');
      if (!btn || !badge) return;
      var v = tyrePressures[k], g = gradeTyreOverall(k);
      btn.classList.remove("is-set", "is-monitor", "is-defect");
      if (v === null && tyrePressureOk[k] === null) { badge.textContent = "Tap to add"; }
      else {
        badge.textContent = (v === null ? (tyrePressureOk[k] === "yes" ? "OK" : "Not OK") : v + " psi");
        if (g === "Pass") btn.classList.add("is-set");
        else if (g === "Monitor") btn.classList.add("is-monitor");
        else btn.classList.add("is-defect");
      }
      if (typeof veh3dSetTyreStatus === "function") veh3dSetTyreStatus(k, g);
    });

    setText("tyre3dSummary", set.length + " of " + keys.length + " tyre positions recorded (" + currentTyreCount + " tyres total)");
    refreshVcheck();
  }

  function openTyrePopup(key) {
    activeTyre = key;
    setText("tyrePopupTitle", TYRE_LABELS[key] || "Tyre");
    var input = $("#tyrePopupInput");
    if (input) input.value = tyrePressures[key] === null ? "" : tyrePressures[key];
    var okGroup = document.querySelector('.yn-toggle[data-yn-target="tyrePopupOk"]');
    if (okGroup) {
      $$(".yn-btn", okGroup).forEach(function (b) {
        b.classList.toggle("is-active", b.getAttribute("data-yn-val") === tyrePressureOk[key]);
      });
    }
    var okHidden = $("#tyrePopupOk");
    if (okHidden) okHidden.value = tyrePressureOk[key] || "";
    $("#tyrePopup").hidden = false;
    $("#tyreScrim").hidden = false;
    document.body.style.overflow = "hidden";
    if (input) setTimeout(function () { input.focus(); }, 60);
  }
  function closeTyrePopup() {
    $("#tyrePopup").hidden = true;
    $("#tyreScrim").hidden = true;
    document.body.style.overflow = "";
    activeTyre = null;
  }
  function saveTyrePopup() {
    if (!activeTyre) return;
    var input = $("#tyrePopupInput");
    var v = input ? val("#tyrePopupInput") : "";
    tyrePressures[activeTyre] = v === "" ? null : Number(v);
    var okVal = val("#tyrePopupOk");
    tyrePressureOk[activeTyre] = okVal === "" ? null : okVal;
    syncTyreIllustration();
    closeTyrePopup();
  }

  /* --------------------- 3D vehicle viewer (WebGL, drag to rotate) -------- */
  // Renders a real interactive 3D truck (via Three.js) that the driver can
  // freely rotate with a finger or mouse, plus tap/click each wheel to open
  // the same tyre-pressure popup used elsewhere. Falls back to a flat,
  // keyboard-accessible list of four tyre buttons if WebGL or the Three.js
  // library isn't available on the device.
  var veh3d = {
    ready: false,
    failed: false,
    renderer: null,
    scene: null,
    camera: null,
    truck: null,
    wheels: {},
    canvas: null,
    dragging: false,
    moved: false,
    lastX: 0,
    lastY: 0,
    rotY: -0.55,
    rotX: 0.18,
    baseDist: 9.6,
    idleSpin: false
  };

  // Split in two: WebGL support is a device capability (checked immediately),
  // while the Three.js library itself is now loaded on demand with a
  // multi-CDN fallback (see loadThreeLib) so a single blocked host can't
  // silently take the 3D truck down.
  function veh3dWebglAvailable() {
    try {
      var c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext &&
        (c.getContext("webgl") || c.getContext("experimental-webgl")));
    } catch (e) { return false; }
  }

  var THREE_LIB_SOURCES = [
    "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
    "https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js",
    "https://unpkg.com/three@0.128.0/build/three.min.js"
  ];

  // Loads Three.js from the first CDN that responds, falling through the
  // list on error so one blocked/offline host doesn't take out the whole
  // 3D truck. Calls back with (ok).
  function loadThreeLib(cb, idx) {
    idx = idx || 0;
    if (typeof window.THREE !== "undefined") { cb(true); return; }
    if (idx >= THREE_LIB_SOURCES.length) { cb(false); return; }
    var s = document.createElement("script");
    s.src = THREE_LIB_SOURCES[idx];
    s.async = true;
    s.onload = function () { cb(typeof window.THREE !== "undefined"); };
    s.onerror = function () { loadThreeLib(cb, idx + 1); };
    document.head.appendChild(s);
  }

  /* --------------------- Tyres page — voice instruction -------------------
     Reads out the tyre-check instruction using the Web Speech API, preferring
     a female voice where the browser/OS exposes one. Voice lists load
     asynchronously in most browsers, so this waits for 'voiceschanged' the
     first time if the list isn't ready yet, then caches it. */
  var TYRE_VOICE_TEXT = "Please select the vehicle's tyres and check the tyre condition.";
  var cachedVoices = null;
  var tyreInstructionSpoken = false;

  // Ranked by how warm/natural the voice typically sounds, best first —
  // modern neural/cloud voices, then well-known pleasant system voices,
  // then a generic "female" flag as a last resort before giving up on
  // finding one specifically. Names are matched case-insensitively.
  var PREFERRED_FEMALE_VOICES = [
    /google\s*us\s*english/i,               // Chrome/Android default — warm, natural
    /microsoft\s*(aria|jenny|emma)/i,       // Edge neural voices — very natural
    /samantha/i,                            // Apple/iOS — natural, friendly
    /google\s*uk\s*english\s*female/i,
    /moira|tessa|karen|fiona|serena|kate|joanna|kimberly|ivy|susan|victoria/i,
    /zira/i,
  ];

  function pickFemaleVoice(voices) {
    if (!voices || !voices.length) return null;
    for (var i = 0; i < PREFERRED_FEMALE_VOICES.length; i++) {
      var match = voices.filter(function (v) { return PREFERRED_FEMALE_VOICES[i].test(v.name); });
      if (match.length) return match[0];
    }
    var byFlag = voices.filter(function (v) { return /female/i.test(v.name) || /female/i.test(v.voiceURI || ""); });
    if (byFlag.length) return byFlag[0];
    // Fall back to any English voice so the instruction still plays even if
    // no voice can be confidently identified as female.
    var english = voices.filter(function (v) { return /^en/i.test(v.lang); });
    return english[0] || voices[0];
  }

  function speakTyreInstruction() {
    try {
      if (!("speechSynthesis" in window)) return;
      var synth = window.speechSynthesis;

      function say() {
        var utter = new SpeechSynthesisUtterance(TYRE_VOICE_TEXT);
        var voice = pickFemaleVoice(cachedVoices);
        if (voice) utter.voice = voice;
        // Tuned for a sweet, friendly, natural-sounding delivery: slightly
        // slower than default for warmth and clarity, slightly higher pitch.
        utter.rate = 0.92;
        utter.pitch = 1.12;
        utter.volume = 1;
        synth.cancel(); // don't stack instructions if the page is revisited quickly
        synth.speak(utter);
      }

      cachedVoices = synth.getVoices();
      if (cachedVoices && cachedVoices.length) {
        say();
      } else if (!tyreInstructionSpoken) {
        // Voices not loaded yet (common on first page load) — wait once.
        synth.addEventListener("voiceschanged", function onVoices() {
          synth.removeEventListener("voiceschanged", onVoices);
          cachedVoices = synth.getVoices();
          say();
        });
      } else {
        say(); // best effort with whatever default voice is available
      }
      tyreInstructionSpoken = true;
    } catch (e) { /* speech synthesis unavailable — silently skip */ }
  }

  // Renders the (fixed) fallback tyre grid to match the current axle
  // layout — used both for the no-WebGL fallback and, harmlessly, kept in
  // sync even when the 3D view is active so switching devices never shows
  // stale buttons.
  function rebuildFallbackGrid(positions) {
    var grid = document.querySelector(".veh3d__fallback-grid");
    if (!grid) return;
    var keys = Object.keys(positions);
    var html = keys.map(function (k) {
      var pos = k.toUpperCase();
      var label = TYRE_LABELS[k] || "Tyre";
      return (
        '<button type="button" class="tyre3d__tyre" data-tyre="' + k + '" aria-label="' + label + ' pressure">' +
          '<span class="tyre3d__ring"><svg viewBox="0 0 24 24"><use href="#i-tyre"/></svg></span>' +
          '<span class="tyre3d__pos">' + pos + '</span>' +
          '<span class="tyre3d__badge" data-badge="' + k + '">Tap to add</span>' +
        '</button>'
      );
    }).join("");
    grid.innerHTML = html;
    grid.classList.toggle("is-wide", keys.length > 4);
  }

  function veh3dShowFallback() {
    var canvas = $("#veh3dCanvas");
    var fallback = $("#veh3dFallback");
    if (canvas) canvas.hidden = true;
    if (fallback) fallback.hidden = false;
    setText("veh3dSideLabel", "Tap a tyre");
  }

  // Builds a detailed, proportionate rigid logistics truck — bonneted cab,
  // chrome grille and light detailing, box tray with panel ribs, dual rear
  // wheels — with four tappable wheel groups mapped to the real tyre
  // positions (front axle single tyres, rear axle duals sharing one target).
  function veh3dBuildTruck(THREE, axlePositions) {
    var group = new THREE.Group();

    var paintMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e5fd8, roughness: 0.32, metalness: 0.55, clearcoat: 0.6, clearcoatRoughness: 0.22
    });
    var paintDarkMat = new THREE.MeshPhysicalMaterial({
      color: 0x123a8f, roughness: 0.35, metalness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.25
    });
    var glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0c2038, roughness: 0.08, metalness: 0.2, clearcoat: 1, transparent: true, opacity: 0.92
    });
    var trayMat = new THREE.MeshPhysicalMaterial({ color: 0xf1f4f9, roughness: 0.55, metalness: 0.1, clearcoat: 0.25 });
    var trayRibMat = new THREE.MeshStandardMaterial({ color: 0xd7dde6, roughness: 0.6, metalness: 0.1 });
    var chassisMat = new THREE.MeshStandardMaterial({ color: 0x23293a, roughness: 0.75, metalness: 0.35 });
    var chromeMat = new THREE.MeshStandardMaterial({ color: 0xd7dbe2, roughness: 0.15, metalness: 0.95 });
    var lampMat = new THREE.MeshStandardMaterial({ color: 0xfff7dd, emissive: 0xfff2c4, emissiveIntensity: 0.9, roughness: 0.3 });
    var indicatorMat = new THREE.MeshStandardMaterial({ color: 0xff9d2e, emissive: 0xff8a00, emissiveIntensity: 0.7 });
    var tailMat = new THREE.MeshStandardMaterial({ color: 0xb3241c, emissive: 0x7a140e, emissiveIntensity: 0.55 });
    var markerMat = new THREE.MeshStandardMaterial({ color: 0xffb400, emissive: 0xff9d00, emissiveIntensity: 0.85 });

    function box(w, h, d, mat, x, y, z) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = true; m.receiveShadow = true;
      group.add(m);
      return m;
    }

    /* ------------------------------ chassis ------------------------------ */
    var chassis = box(4.9, 0.16, 1.46, chassisMat, -0.05, -0.32, 0);
    box(4.9, 0.06, 0.08, chassisMat, -0.05, -0.25, 0.66);
    box(4.9, 0.06, 0.08, chassisMat, -0.05, -0.25, -0.66);

    /* --------------------------------- cab -------------------------------- */
    var cab = box(1.28, 1.62, 1.6, paintMat, 1.78, 0.78, 0);
    var cabRoof = box(1.16, 0.22, 1.5, paintMat, 1.74, 1.7, 0);
    var hood = box(0.62, 1.0, 1.42, paintDarkMat, 2.55, 0.15, 0);
    var hoodTop = box(0.6, 0.06, 1.3, paintMat, 2.55, 0.68, 0);

    // Grille + bumper + headlights
    box(0.06, 0.62, 1.06, chromeMat, 2.87, 0.16, 0);
    var bumper = box(0.14, 0.22, 1.5, chromeMat, 2.92, -0.2, 0);
    var lampL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 20), lampMat);
    lampL.rotation.z = Math.PI / 2; lampL.position.set(2.9, 0.22, 0.55); group.add(lampL);
    var lampR = lampL.clone(); lampR.position.z = -0.55; group.add(lampR);
    var indL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), indicatorMat);
    indL.position.set(2.9, 0.02, 0.62); group.add(indL);
    var indR = indL.clone(); indR.position.z = -0.62; group.add(indR);

    // Windscreen + side glass + sun visor + mirrors
    var windshield = box(0.06, 0.82, 1.36, glassMat, 2.32, 1.0, 0);
    windshield.rotation.z = -0.06;
    box(0.75, 0.62, 0.05, glassMat, 1.5, 1.08, 0.79);
    box(0.75, 0.62, 0.05, glassMat, 1.5, 1.08, -0.79);
    box(0.5, 0.05, 1.5, paintDarkMat, 2.35, 1.46, 0);
    ["l", "r"].forEach(function (side) {
      var sgn = side === "l" ? 1 : -1;
      var arm = box(0.28, 0.03, 0.03, chromeMat, 2.02, 1.12, 0.86 * sgn);
      var mirror = box(0.05, 0.22, 0.16, chromeMat, 2.15, 1.1, 0.98 * sgn);
    });

    // Roof marker lights — a classic Australian-truck touch.
    for (var i = -2; i <= 2; i++) {
      var mk = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), markerMat);
      mk.position.set(2.28, 1.83, i * 0.26);
      group.add(mk);
    }

    // Exhaust stack behind the cab
    var stack = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.3, 14), chromeMat);
    stack.position.set(1.16, 1.15, 0.68); group.add(stack);
    var stackCap = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.1, 14), chassisMat);
    stackCap.position.set(1.16, 1.83, 0.68); group.add(stackCap);

    // Fuel tank
    var tank = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.62, 18), chromeMat);
    tank.rotation.z = Math.PI / 2;
    tank.position.set(0.65, -0.05, 0.72); tank.castShadow = true;
    group.add(tank);
    var tankStrap1 = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.015, 8, 20), chassisMat);
    tankStrap1.rotation.y = Math.PI / 2; tankStrap1.position.set(0.44, -0.05, 0.72); group.add(tankStrap1);
    var tankStrap2 = tankStrap1.clone(); tankStrap2.position.x = 0.86; group.add(tankStrap2);

    /* ---------------------------- tray / body ------------------------------ */
    var tray = box(2.9, 1.7, 1.62, trayMat, -1.15, 0.75, 0);
    var trayRoof = box(2.94, 0.06, 1.66, trayRibMat, -1.15, 1.63, 0);
    var trayFrame = box(2.98, 0.1, 1.7, chassisMat, -1.15, -0.34, 0);
    // Corrugated panel ribs down each side for a pantech-body look.
    for (var rx = -2.45; rx <= 0.15; rx += 0.29) {
      box(0.035, 1.6, 0.02, trayRibMat, rx, 0.75, 0.815);
      box(0.035, 1.6, 0.02, trayRibMat, rx, 0.75, -0.815);
    }
    // Reflective safety strip + rear tail-lights + rear step bumper.
    box(2.9, 0.05, 0.02, chromeMat, -1.15, 0.05, 0.816);
    box(2.9, 0.05, 0.02, chromeMat, -1.15, 0.05, -0.816);
    var tailL = box(0.05, 0.22, 0.16, tailMat, -2.58, 0.1, 0.55);
    var tailR = box(0.05, 0.22, 0.16, tailMat, -2.58, 0.1, -0.55);
    box(0.12, 0.14, 1.66, chromeMat, -2.62, -0.3, 0);

    /* --------------------------------- wheels ------------------------------ */
    var tyreGeo = new THREE.CylinderGeometry(0.47, 0.47, 0.34, 28);
    var rimGeo = new THREE.CylinderGeometry(0.23, 0.23, 0.36, 20);
    var hubGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.4, 12);
    var treadMat = { color: 0x191c22, roughness: 0.95, metalness: 0.03 };

    function buildWheel(x, z) {
      var w = new THREE.Group();
      var tyre = new THREE.Mesh(tyreGeo, new THREE.MeshStandardMaterial(treadMat));
      tyre.rotation.x = Math.PI / 2; tyre.castShadow = true;
      w.add(tyre);
      var rim = new THREE.Mesh(rimGeo, chromeMat);
      rim.rotation.x = Math.PI / 2;
      w.add(rim);
      var hub = new THREE.Mesh(hubGeo, chromeMat);
      hub.rotation.x = Math.PI / 2;
      w.add(hub);
      // 6 wheel-nuts for a bit of hub detail.
      for (var n = 0; n < 6; n++) {
        var nut = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.42, 6), chassisMat);
        nut.rotation.x = Math.PI / 2;
        var ang = (n / 6) * Math.PI * 2;
        nut.position.set(Math.cos(ang) * 0.13, Math.sin(ang) * 0.13, 0);
        w.add(nut);
      }
      w.position.set(x, 0, z);
      return { w: w, tyre: tyre };
    }

    var ringMatBase = { color: 0x5b6472, roughness: 0.35, metalness: 0.2, emissive: 0x000000 };

    // Axle layout comes from the tyre-count filter (computeAxlePositions) —
    // falls back to the default 6-tyre layout if none was supplied.
    axlePositions = axlePositions || computeAxlePositions(DEFAULT_TYRE_COUNT);
    veh3d.wheels = {};

    Object.keys(axlePositions).forEach(function (key) {
      var pos = axlePositions[key];
      var wheelGroup = new THREE.Group();
      var rings = [];

      var offsets = pos.dual ? [-0.17, 0.17] : [0];
      offsets.forEach(function (off) {
        var built = buildWheel(pos.x, off);
        wheelGroup.add(built.w);
        var ring = new THREE.Mesh(new THREE.TorusGeometry(0.49, 0.04, 10, 28), new THREE.MeshStandardMaterial(ringMatBase));
        ring.rotation.x = Math.PI / 2;
        built.w.add(ring);
        rings.push(ring);
      });

      // Mudguard arc over the wheel(s) — a half-torus in the wheel's own
      // XY plane (no extra rotation) so it hugs the tyre curve exactly,
      // slightly wider for the dual rear wheels.
      var guardR = pos.dual ? 0.58 : 0.53;
      var guardGeo = new THREE.TorusGeometry(guardR, 0.045, 8, 20, Math.PI);
      var guard = new THREE.Mesh(guardGeo, paintDarkMat);
      guard.position.set(pos.x, 0, pos.z);
      guard.castShadow = true;
      group.add(guard);

      wheelGroup.position.set(0, 0, pos.z);
      wheelGroup.userData.tyre = key;

      var hit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.66, 0.66, pos.dual ? 0.62 : 0.5, 16),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.rotation.x = Math.PI / 2;
      hit.position.set(pos.x, 0, 0);
      hit.userData.tyre = key;
      wheelGroup.add(hit);

      group.add(wheelGroup);
      veh3d.wheels[key] = { group: wheelGroup, rings: rings, hit: hit };
    });

    group.position.y = 0.5;
    return group;
  }

  // Tears down the current truck group's geometries/materials (Three.js
  // doesn't garbage-collect GPU resources on its own) and rebuilds it for a
  // new axle layout — called whenever the tyre-count filter changes.
  function veh3dDisposeTruck(group) {
    if (!group) return;
    group.traverse(function (obj) {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(function (m) { m.dispose(); });
        else obj.material.dispose();
      }
    });
  }

  function veh3dRebuildTruck(axlePositions) {
    if (!veh3d.ready || !window.THREE) return;
    var THREE = window.THREE;
    if (veh3d.truck) {
      veh3d.scene.remove(veh3d.truck);
      veh3dDisposeTruck(veh3d.truck);
    }
    veh3d.truck = veh3dBuildTruck(THREE, axlePositions);
    veh3d.scene.add(veh3d.truck);
    veh3dRender();
  }

  function veh3dRender() {
    if (!veh3d.ready) return;
    veh3d.truck.rotation.y = veh3d.rotY;
    veh3d.truck.rotation.x = 0;
    var dist = veh3d.baseDist;
    veh3d.camera.position.set(
      0,
      1.95 + veh3d.rotX * 1.7,
      dist
    );
    veh3d.camera.lookAt(0, 0.68, 0);
    veh3d.renderer.render(veh3d.scene, veh3d.camera);
  }

  // Gentle idle auto-rotate — a small "showroom" touch that pauses the
  // instant the person drags, and resumes a couple of seconds after they
  // let go so it never fights their input.
  var veh3dIdleTimer = null;
  function veh3dStartIdleLoop() {
    var last = performance.now();
    function tick(now) {
      if (!veh3d.ready) return;
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!veh3d.dragging && veh3d.idleSpin) {
        veh3d.rotY += dt * 0.18;
        veh3dRender();
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  function veh3dPauseIdle() {
    veh3d.idleSpin = false;
    if (veh3dIdleTimer) clearTimeout(veh3dIdleTimer);
    veh3dIdleTimer = setTimeout(function () { veh3d.idleSpin = true; }, 2600);
  }

  function veh3dResize() {
    if (!veh3d.ready) return;
    var scene = $("#veh3dScene");
    if (!scene) return;
    var w = scene.clientWidth, h = scene.clientHeight;
    if (!w || !h) return;
    veh3d.renderer.setSize(w, h, false);
    veh3d.camera.aspect = w / h;
    veh3d.camera.updateProjectionMatrix();
    veh3dRender();
  }

  function veh3dPointFromEvent(e) {
    var rect = veh3d.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((e.clientY - rect.top) / rect.height) * 2 + 1
    };
  }

  function veh3dPickTyre(e) {
    var THREE = window.THREE;
    var pt = veh3dPointFromEvent(e);
    var raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pt, veh3d.camera);
    var targets = Object.keys(veh3d.wheels).map(function (k) { return veh3d.wheels[k].hit; });
    var hits = raycaster.intersectObjects(targets, false);
    if (hits.length) return hits[0].object.userData.tyre;
    return null;
  }

  function veh3dPointerDown(e) {
    veh3d.dragging = true;
    veh3d.moved = false;
    veh3d.lastX = e.clientX;
    veh3d.lastY = e.clientY;
    veh3dPauseIdle();
    var wrap = $("#veh3dViewer");
    if (wrap) wrap.classList.add("is-dragging");
    if (veh3d.canvas.setPointerCapture) {
      try { veh3d.canvas.setPointerCapture(e.pointerId); } catch (err) {}
    }
  }

  function veh3dPointerMove(e) {
    if (!veh3d.dragging) return;
    var dx = e.clientX - veh3d.lastX;
    var dy = e.clientY - veh3d.lastY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) veh3d.moved = true;
    veh3d.lastX = e.clientX;
    veh3d.lastY = e.clientY;
    veh3d.rotY += dx * 0.012;
    veh3d.rotX = Math.max(-0.3, Math.min(0.75, veh3d.rotX + dy * 0.006));
    veh3dRender();
  }

  function veh3dPointerUp(e) {
    if (!veh3d.dragging) return;
    veh3d.dragging = false;
    var wrap = $("#veh3dViewer");
    if (wrap) wrap.classList.remove("is-dragging");
    if (!veh3d.moved) {
      var tyre = veh3dPickTyre(e);
      if (tyre) openTyrePopup(tyre);
    }
  }

  function veh3dResetView() {
    veh3d.rotY = -0.55;
    veh3d.rotX = 0.18;
    veh3dRender();
  }

  // Colours a wheel's status ring to reflect its recorded pressure grade —
  // called from syncTyreIllustration() so the 3D model and the badges/
  // fallback list always agree.
  function veh3dSetTyreStatus(key, grade) {
    var wheel = veh3d.wheels && veh3d.wheels[key];
    if (!wheel) return;
    var colors = {
      Pass: 0x0f9d58,
      Monitor: 0xc77700,
      Defect: 0xd3352b
    };
    var c = colors[grade] || 0x5b6472;
    (wheel.rings || []).forEach(function (ring) {
      ring.material.color.setHex(c);
      ring.material.emissive.setHex(grade ? c : 0x000000);
      ring.material.emissiveIntensity = grade ? 0.4 : 0;
    });
    veh3dRender();
  }

  function initVeh3d() {
    var wrap = $("#veh3dViewer");
    var canvas = $("#veh3dCanvas");
    if (!wrap || !canvas) return;

    if (!veh3dWebglAvailable()) { veh3d.failed = true; veh3dShowFallback(); return; }

    // Three.js loads on demand (with CDN fallback) so a slow/blocked first
    // host can't strand the truck on the flat fallback grid.
    loadThreeLib(function (ok) {
      if (!ok) { veh3d.failed = true; veh3dShowFallback(); return; }
      veh3dBoot(canvas);
    });
  }

  function veh3dBoot(canvas) {
    var THREE = window.THREE;
    try {
      veh3d.canvas = canvas;
      veh3d.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
      veh3d.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      if ("shadowMap" in veh3d.renderer) {
        veh3d.renderer.shadowMap.enabled = true;
        veh3d.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      }
      if ("outputEncoding" in veh3d.renderer && THREE.sRGBEncoding) {
        veh3d.renderer.outputEncoding = THREE.sRGBEncoding;
      }

      veh3d.scene = new THREE.Scene();
      veh3d.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

      veh3d.scene.add(new THREE.HemisphereLight(0xdce6ff, 0x33394a, 0.85));
      var key = new THREE.DirectionalLight(0xfff4de, 1.05);
      key.position.set(3.4, 5, 2.6);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.left = -4.5; key.shadow.camera.right = 4.5;
      key.shadow.camera.top = 4.5; key.shadow.camera.bottom = -4.5;
      key.shadow.camera.near = 0.5; key.shadow.camera.far = 14;
      key.shadow.bias = -0.0025;
      veh3d.scene.add(key);
      var fill = new THREE.DirectionalLight(0xbcd4ff, 0.4);
      fill.position.set(-4, 2.5, -3);
      veh3d.scene.add(fill);
      var rim = new THREE.DirectionalLight(0xffffff, 0.3);
      rim.position.set(-1, 1.5, 4);
      veh3d.scene.add(rim);

      veh3d.truck = veh3dBuildTruck(THREE, computeAxlePositions(currentTyreCount));
      veh3d.truck.rotation.x = 0;
      veh3d.scene.add(veh3d.truck);

      // Shadow-only ground plane: invisible except where the truck casts a
      // soft contact shadow, so it blends with any card background.
      var ground = new THREE.Mesh(
        new THREE.PlaneGeometry(30, 30),
        new THREE.ShadowMaterial({ opacity: 0.28 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = 0.001;
      ground.receiveShadow = true;
      veh3d.scene.add(ground);

      veh3d.idleSpin = true;
      veh3d.ready = true;
      veh3dResize();
      veh3dRender();
      veh3dStartIdleLoop();
    } catch (err) {
      veh3d.failed = true;
      veh3dShowFallback();
      return;
    }

    canvas.addEventListener("pointerdown", veh3dPointerDown);
    window.addEventListener("pointermove", veh3dPointerMove);
    window.addEventListener("pointerup", veh3dPointerUp);
    window.addEventListener("pointercancel", veh3dPointerUp);

    var resetBtn = $("#veh3dReset");
    if (resetBtn) resetBtn.addEventListener("click", veh3dResetView);

    // ResizeObserver both sizes the canvas correctly the first time the
    // (initially hidden, display:none) tyres page is shown, and keeps it
    // correctly sized across device rotation / window resize afterwards.
    if (typeof ResizeObserver !== "undefined") {
      var ro = new ResizeObserver(function () { veh3dResize(); });
      var scene = $("#veh3dScene");
      if (scene) ro.observe(scene);
    } else {
      window.addEventListener("resize", veh3dResize);
      // Fallback for browsers without ResizeObserver: size once the tyres
      // check view is actually navigated to.
      setTimeout(veh3dResize, 300);
    }
  }

  function prefillVcheck() { refreshVcheck(); }


  // Writes the completed inspection once every check has been verified.
  // Translates this widget's internal GPS-condition short codes to the
  // exact literal picklist values configured on the real Vehicle_check_in
  // form's GPS_condition field — Zoho validates against the configured
  // values verbatim, so the short codes ("Good") can't be sent as-is.
  var GPS_CONDITION_LABELS = {
    Good: "Good — locked and tracking",
    Weak: "Weak — intermittent signal",
    Faulty: "Faulty — no signal / unit fault",
  };
  // Same idea for Select_level (fatigue assessment).
  var FATIGUE_LEVEL_LABELS = {
    Pass: "Alert — fit to drive",
    Monitor: "Slightly tired — fit with breaks",
    Defect: "Fatigued — not fit to drive",
  };
  // The yn-toggle controls store "yes"/"no" internally; the form's
  // radiobutton fields are configured with values = {"Yes","No"}.
  function ynLabel(v) { return v === "yes" ? "Yes" : (v === "no" ? "No" : ""); }

  function saveVcheck() {
    var g = gradeVcheck();
    vcheckResult = {
      tyrePressure: Number(val("#inTyrePress")) || 0,
      tyrePressures: { fl: tyrePressures.fl, fr: tyrePressures.fr, rl: tyrePressures.rl, rr: tyrePressures.rr },
      tyrePressureOk: { fl: tyrePressureOk.fl, fr: tyrePressureOk.fr, rl: tyrePressureOk.rl, rr: tyrePressureOk.rr },
      spareTyres: Number(val("#inTyreSpare")) || 0,
      tyreCondition: val("#inTyreCond"),
      batteryCondition: val("#inBattCond"),
      batteryFunctional: val("#inBattFunc"),
      fuelType: val("#inVcFuelType"),
      fuelPercent: Number(val("#inVcFuelLevel")) || 0,
      fuelOkForTrip: val("#inFuelOk"),
      gpsFixed: val("#inGpsFixed"),
      gpsId: val("#inGpsUnit"),
      gpsCondition: val("#inGpsCond"),
      driverFitToDrive: val("#inHealthDrive"),
      fatigue: val("#inHealthFatigue"),
      notes: val("#inVcNotes"),
      grades: g,
    };

    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA) return; // preview mode

    // Trip_ID, Driver, and Trip_Name are lookup/picklist fields on the real
    // Vehicle_check_in form (values = Trip_Dispatch.ID / Employee_Form[...].ID
    // respectively) — Zoho expects the linked record's own ID here, not
    // display text. Vehicle is the same: a lookup to Vehicles_Report1.ID.
    // All four come from ACTIVE_TRIP, locked in once at Start Trip and never
    // regenerated — the same original Trip ID / Vehicle / Driver identity
    // is written on every save for the rest of this trip.
    if (!ACTIVE_TRIP.tripRecordId || !ACTIVE_TRIP.driverRecordId) {
      console.error(LOG_TAG, "Vehicle_check_in not saved — no active trip. Start a trip from Today's Trip first.");
      toast("Start a trip first — this check-in isn't linked to a trip yet.");
      return;
    }

    ZOHO.CREATOR.DATA.addRecords({
      form_name: "Vehicle_check_in",
      payload: {
        data: {
          Trip_ID: ACTIVE_TRIP.tripRecordId,
          Driver: ACTIVE_TRIP.driverRecordId,
          Trip_Name: ACTIVE_TRIP.tripRecordId,
          Vehicle: ACTIVE_TRIP.vehicleRecordId,
          Front_right_tyre: ynLabel(vcheckResult.tyrePressureOk.fr),
          Front_left_tyre: ynLabel(vcheckResult.tyrePressureOk.fl),
          Spare_tyres_taken_for_the_trip: String(vcheckResult.spareTyres),
          Rear_right_tyre: ynLabel(vcheckResult.tyrePressureOk.rr),
          Rear_left_tyre: ynLabel(vcheckResult.tyrePressureOk.rl),
          Tyre_condition: vcheckResult.tyreCondition,
          Battery_condition: vcheckResult.batteryCondition,
          Battery_functionality: ynLabel(vcheckResult.batteryFunctional),
          Fuel_type: vcheckResult.fuelType,
          Fuel_condition_for_trip: ynLabel(vcheckResult.fuelOkForTrip),
          Current_fuel_percentage: String(vcheckResult.fuelPercent),
          GPS_ID: vcheckResult.gpsId,
          GPS_condition: GPS_CONDITION_LABELS[vcheckResult.gpsCondition] || vcheckResult.gpsCondition,
          GPS_fixed_and_working: ynLabel(vcheckResult.gpsFixed),
          Driver_condition_for_driving: ynLabel(vcheckResult.driverFitToDrive),
          Select_level: FATIGUE_LEVEL_LABELS[vcheckResult.fatigue] || vcheckResult.fatigue,
          Notes: vcheckResult.notes,
        },
      },
    }).catch(function (err) {
      console.error(LOG_TAG, "Vehicle_check_in save failed:", err);
      toast("Couldn't save the vehicle check-in — please try again.");
    });
  }

  /* ------------------------------ trip start ------------------------------ */
  function recalc() {
    var s = val("#inStart");
    var start = toMins(s);
    setText("calcMax", hm(bfm.maxWorkPerShift));
    if (start === null || !s) {
      setText("calcDuty", "—");
      setText("calcRest", "—");
      return;
    }
    // Latest legal finish = start + the shift ceiling.
    var latest = (start + bfm.maxWorkPerShift) % 1440;
    setText("calcDuty", pad(Math.floor(latest / 60)) + ":" + pad(latest % 60));
    setText("calcRest", hm(Math.floor(bfm.maxWorkPerShift / bfm.maxContinuousWork) * bfm.restBlock) + " in blocks");
  }

  function saveTimes() {
    var err = $("#startErr");
    var s = val("#inStart");
    clearBad(["fStart", "fStartLoc", "fStartUrl", "fStartOdo"]);
    err.hidden = true;

    if (!s) { $("#fStart").classList.add("is-bad"); err.textContent = "Enter your start time."; err.hidden = false; return; }
    if (!val("#inStartLoc")) { $("#fStartLoc").classList.add("is-bad"); err.textContent = "Enter your live location."; err.hidden = false; return; }
    var startOdo = val("#inStartOdo");
    if (!startOdo) { $("#fStartOdo").classList.add("is-bad"); err.textContent = "Enter the starting odometer reading."; err.hidden = false; return; }

    // The Trip_Start form's Trip_ID / Trip_Name / Driver_ID / Driver_Name
    // fields are all Zoho Creator picklist (lookup) fields — per the form
    // definition, Trip_ID and Trip_Name both take "values = Trip_Dispatch.ID"
    // and Driver_ID/Driver_Name both take "values = Driver_Details.ID". A
    // lookup field's stored value is the LINKED RECORD'S OWN ZOHO ID, not
    // its display text — so all four must be set to the same underlying
    // record IDs (tripRecordId / driverRecordId), never the human-readable
    // Trip ID / Driver ID text. These come from ACTIVE_TRIP, locked in once
    // when the driver tapped Start Trip — never re-derived or regenerated,
    // so every save for this trip carries the exact same original identity.
    var tripId = ACTIVE_TRIP.tripId || CURRENT_TRIP_ID || "";       // display-only, for messages
    var tripRecordId = ACTIVE_TRIP.tripRecordId;
    var driverRecordId = ACTIVE_TRIP.driverRecordId;
    if (!tripRecordId || !driverRecordId) {
      err.textContent = "Can't save — no assigned trip/driver is loaded yet. Please wait for the page to finish loading and try again.";
      err.hidden = false;
      return;
    }

    // Planned finish is derived from the BFM ceiling rather than typed in.
    var start = toMins(s);
    var endM = (start + bfm.maxWorkPerShift) % 1440;
    var e = pad(Math.floor(endM / 60)) + ":" + pad(endM % 60);

    var startLocation = val("#inStartLoc");
    var startLocationUrl = val("#inStartUrl");
    var endLocation = val("#inEndLoc");
    var startOdometerNum = Number(startOdo);

    // Combine today's date with the entered start time into a single
    // Date object for the form's Start_Date_Time field.
    var startDateTime = new Date();
    startDateTime.setHours(Math.floor(start / 60), start % 60, 0, 0);

    // Same save method as Vehicle Check-In (saveVcheck): update local
    // state and the UI immediately, fire a single write straight to
    // Zoho Creator, and only .catch to log/toast if that write fails —
    // no waiting on the promise before moving the driver on.
    state.startTime = s;
    state.endTime = e;
    state.tripStarted = true;
    state.startLocation = startLocation;
    state.startLocationUrl = startLocationUrl;
    state.endLocation = endLocation;
    state.startOdometer = startOdometerNum;

    setText("tripStart", s);
    setText("tripEnd", e);
    setText("tripStartedAt", s);
    setText("tripWindow", s + " – " + e);
    setText("tripStartLoc", state.startLocation);
    setText("kpiStatus", "IN TRANSIT");
    var sticky = $("#stickyStart");
    if (sticky) {
      sticky.textContent = "Open trip";
      sticky.setAttribute("data-nav", "trip");
    }

    // Trip Details (Trip ID, Route, Vehicle, etc.) is already populated
    // from the real Trip_Dispatch1 record — refresh it here too so
    // anything derived from the just-saved start time/location is
    // current.
    renderActiveTripDetails();

    if (typeof bfmStartMonitoring === "function") bfmStartMonitoring(s);
    startTripTimer();
    armTripBackGuard();

    // Dashboard and bell badge both reflect the trip start immediately
    // — no page reload needed, this is a same-page (SPA) navigation.
    pushNotification();
    toast("Trip " + tripId + " started at " + s + " — saved to Zoho Creator");
    go("trip");

    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA) return; // preview mode

    // Single write to the Trip_Start form/report, using the actual field
    // API names confirmed from that form's Deluge definition. Trip_ID and
    // Trip_Name are both lookups into Trip_Dispatch, so both get
    // tripRecordId; Driver_ID and Driver_Name are both lookups into
    // Driver_Details, so both get driverRecordId. Every value comes from
    // the assigned trip / what the driver just entered — nothing
    // hard-coded, nothing regenerated.
    ZOHO.CREATOR.DATA.addRecords({
      form_name: "Trip_Start",
      payload: {
        data: {
          Trip_ID: tripRecordId,
          Trip_Name: tripRecordId,
          Driver_ID: driverRecordId,
          Driver_Name: driverRecordId,
          Start_Date_Time: formatDateTimeForCreator(startDateTime),
          Live_location: startLocation,
          Live_location_URL: startLocationUrl,
          End_location: endLocation,
          Starting_Odometer_Reading: startOdometerNum,
        },
      },
    }).then(function () {
      // Starting_Odometer is a confirmed field on the Trip_Dispatch1
      // record itself (form "Trip_Dispatch") — written directly onto
      // that record too so it shows up wherever the rest of the trip's
      // real data does, not only in the Trip_Start log. This is
      // best-effort/supplementary and never blocks the driver moving on.
      saveStartingOdometerToTrip(startOdometerNum);
    }).catch(function (err) {
      console.error(LOG_TAG, "Trip_Start save failed:", err);
      toast("Couldn't save the trip start — please try again.");
    });
  }

  function saveStartingOdometerToTrip(odometer) {
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA || !ZOHO.CREATOR.DATA.updateRecords) return;
    if (!ACTIVE_TRIP.tripRecordId) return;
    ZOHO.CREATOR.DATA.updateRecords({
      form_name: "Trip_Dispatch",
      id: ACTIVE_TRIP.tripRecordId,
      payload: { data: { Starting_Odometer: odometer } },
    }).catch(function (err) {
      console.error(LOG_TAG, "Could not write Starting_Odometer back to Trip_Dispatch1:", err);
    });
  }

  /* ------------------------------ check-in -------------------------------- */
  function prefillCheckIn() {
    setText("inCheckDate", "");
    var dateEl = $("#inCheckDate");
    if (dateEl) dateEl.value = todayLabel();

    if ($("#inHub") && checkInState.hub) $("#inHub").value = checkInState.hub;

    if ($("#inCheckInTime") && !$("#inCheckInTime").value) {
      var now = new Date();
      $("#inCheckInTime").value = pad(now.getHours()) + ":" + pad(now.getMinutes());
    }
  }

  function saveCheckIn() {
    var err = $("#checkInErr");
    err.hidden = true;

    var hub = $("#inHub").value;
    var inTime = $("#inCheckInTime").value;

    if (!hub) { err.textContent = "Select the hub you're checking in to."; err.hidden = false; return; }
    if (!inTime) { err.textContent = "Enter your check-in time."; err.hidden = false; return; }

    checkInState = {
      hub: hub,
      date: $("#inCheckDate").value,
      inTime: inTime,
      outTime: $("#inCheckOutTime").value,
    };

    toast("Checked in at " + hub + " — opening POD");
    go("pod"); // straight through to proof of delivery
  }

  /* --------------------------------- POD ---------------------------------- */
  function renderPodItems() {
    var hub = checkInState.hub || $("#inHub").value;
    var items = PRODUCTS_BY_HUB[hub] || [];
    var list = $("#podItemList");

    setText("podHubTitle", hub ? "POD — " + hub : "POD — no hub selected");
    setText("podHubDate", checkInState.date || todayLabel());

    if (!list) return;

    if (!hub || !items.length) {
      list.innerHTML = '<li class="pod-item pod-item--empty">No products found. Go back and check in to a hub first.</li>';
      return;
    }

    list.innerHTML = items.map(function (p) {
      return '<li class="pod-item">' +
        '<label class="pod-item__check"><input type="checkbox" data-pid="' + p.id + '" checked><span>' + p.name + "</span></label>" +
        '<div class="pod-item__qty"><span>Qty delivered</span><input type="number" min="0" data-qty="' + p.id + '" value="' + p.qty + '"></div>' +
        "</li>";
    }).join("");
  }

  function goToPod() {
    if (!checkInState.hub) {
      var hub = $("#inHub").value;
      if (!hub) { toast("Select a hub and save your check-in first."); return; }
      checkInState.hub = hub;
      checkInState.date = $("#inCheckDate").value || todayLabel();
    }
    go("pod");
  }

  function savePod() {
    var err = $("#podErr");
    err.hidden = true;

    var statusEl = $("#inPodStatus");
    var status = statusEl ? statusEl.value : "";
    if (!status) {
      if ($("#fPodStatus")) $("#fPodStatus").classList.add("is-bad");
      err.textContent = "Select a POD status from the dropdown.";
      err.hidden = false;
      return;
    }
    if ($("#fPodStatus")) $("#fPodStatus").classList.remove("is-bad");

    var hub = checkInState.hub;
    if (!hub) { err.textContent = "No hub selected — go back to check-in."; err.hidden = false; return; }

    var items = (PRODUCTS_BY_HUB[hub] || []).map(function (p) {
      var checkEl = document.querySelector('[data-pid="' + p.id + '"]');
      var qtyEl = document.querySelector('[data-qty="' + p.id + '"]');
      return {
        name: p.name,
        delivered: checkEl ? checkEl.checked : false,
        qty: qtyEl ? Number(qtyEl.value) || 0 : 0,
      };
    });

    podReports.unshift({
      hub: hub,
      date: checkInState.date || todayLabel(),
      status: status,
      items: items,
      notes: $("#podNotes").value.trim(),
      savedAt: new Date().toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }),
    });

    renderPodReports();
    toast("POD saved for " + hub + " — " + status);
    $("#podNotes").value = "";
    if (statusEl) statusEl.value = "";

    // Back to Hubs & stops (on the trip page) so the driver can pick up the
    // next stop straight away, rather than bouncing out to the dashboard.
    go("trip");
    // Land on the Hubs & stops card itself, focused on the next stop.
    var nextIdx = HUBS.findIndex(function (h) { return h.status === "next"; });
    if (nextIdx >= 0) hubIndex = nextIdx;
    renderHubs();
    setTimeout(function () {
      var card = $("#hubDetail");
      if (card && card.closest(".card")) {
        card.closest(".card").scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 120);
    goToHubs();
  }

  function renderPodReports() {
    var host = $("#podReportList");
    if (!host) return;

    if (!podReports.length) {
      host.innerHTML = '<li class="pod-report pod-report--empty">No POD reports saved yet. Check in at a hub to get started.</li>';
      return;
    }

    host.innerHTML = podReports.map(function (r) {
      var tone = r.status === "Cancelled" ? "red" : r.status === "Partially Received" ? "amber" : "green";
      var delivered = r.items.filter(function (i) { return i.delivered; }).length;
      return '<li class="pod-report"><i class="status-dot ' + tone + '" style="margin-top:5px"></i>' +
        "<div><p><b>" + r.hub + "</b> — " + r.status + "</p>" +
        "<time>" + delivered + " of " + r.items.length + " items delivered · " + r.date + " · " + r.savedAt + "</time></div></li>";
    }).join("");
  }

  /* ------------------------------ fuel entry ------------------------------ */
  // Saved fuel entries, newest first.
  var fuelEntries = [];

  function prefillFuel() {
    var country = $("#inFuelCountry");
    if (country && !country.value) country.value = "Australia";
    recalcFuelTotal();
    startFuelDateTimeDisplay();
  }

  // Date and Time fields on the Fuel Entry page are read-only — they're
  // not typed in, they show the actual current date/time and keep
  // ticking while the page is open, so what the driver sees always
  // matches what will be captured the moment they hit Submit.
  var fuelDateTimeTimer = null;
  function renderFuelDateTimeDisplay() {
    var now = new Date();
    var dateEl = $("#inFuelDate");
    var timeEl = $("#inFuelTime");
    if (dateEl) dateEl.value = now.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    if (timeEl) timeEl.value = now.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  function startFuelDateTimeDisplay() {
    renderFuelDateTimeDisplay();
    if (fuelDateTimeTimer) clearInterval(fuelDateTimeTimer);
    fuelDateTimeTimer = setInterval(renderFuelDateTimeDisplay, 1000);
  }

  // Total = quantity × cost per unit. Left editable so a driver can match the
  // receipt exactly when rounding differs.
  function recalcFuelTotal() {
    var qty = Number(($("#inFuelQty") || {}).value) || 0;
    var unit = Number(($("#inFuelCost") || {}).value) || 0;
    var total = $("#inFuelTotal");
    if (total) total.value = qty && unit ? (qty * unit).toFixed(2) : "";
  }

  function saveFuel() {
    var err = $("#fuelErr");
    err.hidden = true;
    ["fFuelCurrentLoc", "fFuelType", "fFuelQty", "fFuelCost", "fFuelOdo"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.remove("is-bad");
    });

    function val(sel) { var el = $(sel); return el ? el.value.trim() : ""; }

    var required = [
      ["#inFuelCurrentLoc", "fFuelCurrentLoc", "Enter your current location."],
      ["#inFuelType", "fFuelType", "Select the fuel type."],
      ["#inFuelQty", "fFuelQty", "Enter the fuel quantity in litres."],
      ["#inFuelCost", "fFuelCost", "Enter the cost per unit."],
      ["#inFuelOdo", "fFuelOdo", "Enter the current mileage."],
    ];

    for (var i = 0; i < required.length; i++) {
      if (!val(required[i][0])) {
        var f = document.getElementById(required[i][1]);
        if (f) f.classList.add("is-bad");
        err.textContent = required[i][2];
        err.hidden = false;
        return;
      }
    }

    var qty = Number(val("#inFuelQty"));
    var unit = Number(val("#inFuelCost"));
    if (qty <= 0) { $("#fFuelQty").classList.add("is-bad"); err.textContent = "Fuel quantity must be greater than zero."; err.hidden = false; return; }
    if (unit <= 0) { $("#fFuelCost").classList.add("is-bad"); err.textContent = "Cost per unit must be greater than zero."; err.hidden = false; return; }

    recalcFuelTotal();

    // Trip, Vehicle, Driver_ID, and Driver are lookup/picklist fields on
    // the real Fuel_Entry form — same identity rule as Vehicle Check-In:
    // all four come from ACTIVE_TRIP, locked in once at Start Trip and
    // never regenerated, so the same original Trip / Vehicle / Driver /
    // Driver ID identity is written on every save for the rest of this
    // trip.
    if (!ACTIVE_TRIP.tripRecordId || !ACTIVE_TRIP.driverRecordId) {
      console.error(LOG_TAG, "Fuel_Entry not saved — no active trip. Start a trip from Today's Trip first.");
      toast("Start a trip first — this fuel entry isn't linked to a trip yet.");
      return;
    }

    // Fuel_Entry_Date_Time is a "must have" field on the real Fuel_Entry
    // form — captured as the actual current date/time at the moment
    // Submit is pressed, never a placeholder. The read-only Date/Time
    // fields on the page are refreshed here too so what's shown matches
    // exactly what gets written.
    var now = new Date();
    renderFuelDateTimeDisplay();

    var entry = {
      currentLocation: val("#inFuelCurrentLoc"),
      // liveLocationUrl: val("#inFuelUrl"),
      stationName: val("#inFuelStation"),
      fuelType: val("#inFuelType"),
      litres: qty,
      costPerUnit: unit,
      totalCost: Number(val("#inFuelTotal")) || Number((qty * unit).toFixed(2)),
      mileage: Number(val("#inFuelOdo")) || 0,
      fuelDateTime: formatDateTimeForCreator(now),
      savedAt: now.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }),
    };

    // Same save method as Vehicle Check-In (saveVcheck): update local
    // state and the UI immediately, fire a single write straight to
    // Zoho Creator, and only .catch to log/toast if that write fails.
    fuelEntries.unshift(entry);

    // clear the form so the next refuel starts fresh
    ["#inFuelCurrentLoc", "#inFuelUrl", "#inFuelStation",
     "#inFuelType", "#inFuelQty", "#inFuelCost", "#inFuelTotal", "#inFuelOdo"]
      .forEach(function (s) { var el = $(s); if (el) el.value = ""; });

    toast("Fuel Entry Added Successfully — " + qty.toFixed(2) + " L for $" + entry.totalCost.toFixed(2));
    go("trip"); // back to the assigned trip page once saved

    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA) return; // preview mode

    // Writes to the real Fuel_Entry form using its confirmed field API
    // names. Vehicle, Trip, Driver_ID, and Driver are all Lookup/picklist
    // fields on that form (Vehicle -> Vehicles_Report1.ID, Trip ->
    // Trip_Dispatch.ID, Driver_ID -> Driver_Details.ID, Driver ->
    // Employee_Form[Designation=="Driver"].ID), so each must be written as
    // the linked record's own Zoho ID — never its display text.
    //
    // Driver uses the same ACTIVE_TRIP.driverRecordId as Driver_ID, the
    // same approach Vehicle_check_in already uses for its own "Driver"
    // lookup field — so Trip, Vehicle, Driver, and Driver ID all stay
    // locked to the exact same original assigned-trip identity for the
    // whole trip, on every form.
    // Build payload and only include Live_Location_URL when it's non-empty
    // and looks like a valid http(s) URL. Sending an invalid/empty value
    // caused Creator to reject the request (see network error code 3001).
    var payloadData = {
      Vehicle: ACTIVE_TRIP.vehicleRecordId,
      Trip: ACTIVE_TRIP.tripRecordId,
      // Driver_ID: ACTIVE_TRIP.driverRecordId,
      // Driver: ACTIVE_TRIP.driverRecordId,
      Fuel_Entry_Date_Time: entry.fuelDateTime,
      Fuel_Station: entry.stationName,
      Current_location: entry.currentLocation,
      Fuel_Type: entry.fuelType,
      Fuel_Quantity_L_kWh: entry.litres,
      Cost_Per_Unit: entry.costPerUnit,
      Total_Fuel_Cost: entry.totalCost,
      Odometer_Reading: entry.mileage,
    };

    // var liveUrl = (entry.liveLocationUrl || "").trim();
    // if (liveUrl) {
    //   // basic sanity check: must start with http:// or https://
    //   if (/^https?:\/\//i.test(liveUrl)) payloadData.Live_Location_URL = liveUrl;
    //   else console.warn(LOG_TAG, 'Skipping Live_Location_URL — not a valid URL:', liveUrl);
    // }

    ZOHO.CREATOR.DATA.addRecords({ form_name: "Fuel_Entry", payload: { data: payloadData } })
      .catch(function (err) {
        console.error(LOG_TAG, "Fuel_Entry save failed:", err);
        toast("Couldn't save the fuel entry — please try again.");
      });
  }

  /* -------------------- shared form helpers (new pages) ------------------- */
  // Clears the red "is-bad" ring from a set of field wrappers.
  function clearBad(ids) {
    ids.forEach(function (id) { var el = document.getElementById(id); if (el) el.classList.remove("is-bad"); });
  }
  function val(sel) { var el = $(sel); return el ? String(el.value).trim() : ""; }

  // Wires every .yn-toggle segmented Yes/No control on the page: clicking a
  // button marks it active and writes "yes"/"no" into the hidden input named
  // in data-yn-target, so the rest of the form can read it like any field.
  function initYesNoToggles() {
    $$(".yn-toggle").forEach(function (group) {
      if (group.dataset.ynWired) return;
      group.dataset.ynWired = "1";
      var hidden = document.getElementById(group.getAttribute("data-yn-target"));
      $$(".yn-btn", group).forEach(function (btn) {
        btn.addEventListener("click", function () {
          $$(".yn-btn", group).forEach(function (b) { b.classList.remove("is-active"); });
          btn.classList.add("is-active");
          if (hidden) {
            hidden.value = btn.getAttribute("data-yn-val");
            hidden.dispatchEvent(new Event("change", { bubbles: true }));
          }
        });
      });
    });
  }
  // Walks a [inputSelector, fieldId, message] list and flags the first gap.
  function requireFields(list, errEl) {
    for (var i = 0; i < list.length; i++) {
      if (!val(list[i][0])) {
        var f = document.getElementById(list[i][1]);
        if (f) f.classList.add("is-bad");
        errEl.textContent = list[i][2];
        errEl.hidden = false;
        return false;
      }
    }
    return true;
  }
  function todayISO() {
    var n = new Date();
    return n.getFullYear() + "-" + pad(n.getMonth() + 1) + "-" + pad(n.getDate());
  }
  function nowHM() { var n = new Date(); return pad(n.getHours()) + ":" + pad(n.getMinutes()); }

  // Writes a record to Creator when running inside Zoho; silent in preview.
  // Every trip-related save shares the SAME Trip ID / Vehicle / Driver /
  // Driver ID for the whole trip — sourced from ACTIVE_TRIP (locked in
  // once when Start Trip was tapped), never regenerated or hardcoded per
  // entry. If a caller has already set one of these fields explicitly,
  // that value is left alone rather than overwritten.
  function pushToCreator(formName, data) {
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA) return;
    if (data.Trip_ID === undefined) data.Trip_ID = ACTIVE_TRIP.tripId || CURRENT_TRIP_ID || "";
    if (data.Vehicle === undefined) data.Vehicle = ACTIVE_TRIP.vehicleName || "";
    if (data.Driver === undefined) data.Driver = ACTIVE_TRIP.driverName || driver.name || "";
    if (data.Driver_ID === undefined) data.Driver_ID = ACTIVE_TRIP.driverId || driver.id || "";
    ZOHO.CREATOR.DATA.addRecords({ form_name: formName, payload: { data: data } })
      .catch(function () { /* preview mode — nothing to write to */ });
  }

  // Fills a location field pair from the device GPS.
  function captureLocation(which) {
    var map = {
      veh: { url: "#inVehUrl", loc: "#inVehLoc" },
      brk: { url: "#inBrkUrl", loc: "#inBrkLoc" },
      start: { url: "#inStartUrl", loc: "#inStartLoc" },
      fuel: { url: "#inFuelUrl", loc: "#inFuelCurrentLoc" },
      inc: { url: "#inIncUrl", loc: "#inIncLoc" },
    };
    var t = map[which];
    if (!t) return;
    var urlSel = t.url, locSel = t.loc;
    if (!navigator.geolocation) { toast("Location isn't available on this device."); return; }
    toast("Getting your location…");
    navigator.geolocation.getCurrentPosition(function (pos) {
      var la = pos.coords.latitude.toFixed(6), lo = pos.coords.longitude.toFixed(6);
      var url = $(urlSel);
      if (url) url.value = "https://maps.google.com/?q=" + la + "," + lo;
      var loc = $(locSel);
      if (loc && !loc.value) loc.value = la + ", " + lo;
      toast("Location captured");
    }, function () { toast("Couldn't get your location — enter it manually."); }, { timeout: 10000 });
  }

  /* --------------------------- report incident ---------------------------- */
  var incidentReports = [];

  function prefillIncident() {
    var d = $("#inIncDate"); if (d && !d.value) d.value = todayISO();
    var t = $("#inIncTime"); if (t && !t.value) t.value = nowHM();
  }

  function saveIncident() {
    var err = $("#incErr");
    err.hidden = true;
    clearBad(["fIncName", "fIncPlace", "fIncLoc", "fIncDate", "fIncTime", "fIncTrip",
              "fIncDamageCost", "fIncRepairs", "fIncParts", "fIncAltVeh", "fIncDur"]);

    var ok = requireFields([
      ["#inIncName", "fIncName", "Enter a name for this accident."],
      ["#inIncPlace", "fIncPlace", "Enter the accident place."],
      ["#inIncLoc", "fIncLoc", "Enter your live location."],
      ["#inIncDate", "fIncDate", "Enter the date of the accident."],
      ["#inIncTime", "fIncTime", "Enter the time of the accident."],
      ["#inIncTrip", "fIncTrip", "Select the trip status."],
      ["#inIncDamageCost", "fIncDamageCost", "Describe the damage and cost."],
      ["#inIncRepairs", "fIncRepairs", "Select whether vehicle repairs are needed."],
      ["#inIncParts", "fIncParts", "Select whether vehicle parts are damaged."],
      ["#inIncAltVeh", "fIncAltVeh", "Select whether an alternative vehicle is required."],
      ["#inIncDur", "fIncDur", "Enter the total accident duration in hours."],
    ], err);
    if (!ok) return;

    var dur = Number(val("#inIncDur"));
    if (dur < 0) { $("#fIncDur").classList.add("is-bad"); err.textContent = "Duration can't be negative."; err.hidden = false; return; }

    var rec = {
      name: val("#inIncName"),
      place: val("#inIncPlace"),
      liveLocation: val("#inIncLoc"),
      liveLocationUrl: val("#inIncUrl"),
      date: val("#inIncDate"),
      time: val("#inIncTime"),
      tripStatus: val("#inIncTrip"),
      damageCost: val("#inIncDamageCost"),
      repairs: val("#inIncRepairs"),
      parts: val("#inIncParts"),
      altVehicleRequired: val("#inIncAltVeh"),
      durationHours: dur,
    };
    incidentReports.unshift(rec);

    pushToCreator("Incident_Report", {
      Accident_Name: rec.name,
      Accident_Place: rec.place,
      Live_Location: rec.liveLocation,
      Live_Location_URL: rec.liveLocationUrl,
      Date: rec.date,
      Time: rec.time,
      Trip_Status: rec.tripStatus,
      Damage_And_Cost: rec.damageCost,
      Vehicle_Repairs: rec.repairs,
      Vehicle_Parts_Damaged: rec.parts,
      Alternative_Vehicle_Required: rec.altVehicleRequired,
      Total_Accident_Duration_Hours: rec.durationHours,
    });

    ["#inIncName", "#inIncPlace", "#inIncLoc", "#inIncUrl", "#inIncDate", "#inIncTime", "#inIncTrip",
     "#inIncDamageCost", "#inIncRepairs", "#inIncParts", "#inIncAltVeh", "#inIncDur"]
      .forEach(function (s) { var el = $(s); if (el) el.value = ""; });
    $$("#viewIncident .yn-btn").forEach(function (b) { b.classList.remove("is-active"); });

    toast("Incident report saved — " + rec.name);
    go("trip");
  }

  /* ---------------------------- vehicle issue ----------------------------- */
  var vehicleIssues = [];

  function prefillVehicleIssue() {
    var w = $("#inVehWhen");
    if (w && !w.value) w.value = todayISO() + "T" + nowHM();
  }

  function saveVehicleIssue() {
    var err = $("#vehErr");
    err.hidden = true;
    clearBad(["fVehName", "fVehLoc", "fVehWhen", "fVehStatus", "fVehContinue", "fVehAltVeh", "fVehDamages"]);

    var ok = requireFields([
      ["#inVehName", "fVehName", "Enter the incident name."],
      ["#inVehLoc", "fVehLoc", "Enter the live location."],
      ["#inVehWhen", "fVehWhen", "Enter the incident date and time."],
      ["#inVehStatus", "fVehStatus", "Select a status."],
      ["#inVehContinue", "fVehContinue", "Select whether the driver can continue to drive."],
      ["#inVehAltVeh", "fVehAltVeh", "Select whether an alternative vehicle is required."],
      ["#inVehDamages", "fVehDamages", "Describe the damages."],
    ], err);
    if (!ok) return;

    var rec = {
      name: val("#inVehName"),
      location: val("#inVehLoc"),
      when: val("#inVehWhen"),
      status: val("#inVehStatus"),
      continueToDrive: val("#inVehContinue"),
      altVehicleRequired: val("#inVehAltVeh"),
      liveUrl: val("#inVehUrl"),
      damages: val("#inVehDamages"),
      notes: val("#inVehNotes"),
    };
    vehicleIssues.unshift(rec);

    pushToCreator("Vehicle_Defect", {
      Incident_Name: rec.name,
      Live_Location: rec.location,
      Incident_Date_Time: rec.when,
      Status: rec.status,
      Continue_To_Drive: rec.continueToDrive,
      Alternative_Vehicle_Required: rec.altVehicleRequired,
      Live_Location_URL: rec.liveUrl,
      Damages: rec.damages,
      Notes: rec.notes,
    });

    ["#inVehName", "#inVehLoc", "#inVehWhen", "#inVehNotes", "#inVehStatus", "#inVehContinue", "#inVehAltVeh", "#inVehUrl", "#inVehDamages"]
      .forEach(function (s) { var el = $(s); if (el) el.value = ""; });
    $$("#viewVehicleIssue .yn-btn").forEach(function (b) { b.classList.remove("is-active"); });

    toast("Vehicle issue saved — " + rec.name);
    go("trip");
  }

  /* -------------------------------- break --------------------------------- */
  var breakLogs = [];

  function prefillBreak() {
    var d = $("#inBrkDate"); if (d) d.value = todayLabel();
    var s = $("#inBrkStart"); if (s && !s.value) s.value = nowHM();
    // These are readonly display fields — always resynced from the real
    // active trip (never left at whatever static value the HTML shipped
    // with) so a break log always names the trip actually under way.
    var tn = $("#inBrkTripName"); if (tn) tn.value = ACTIVE_TRIP.tripName || ACTIVE_TRIP.tripId || CURRENT_TRIP_ID || "";
    var ti = $("#inBrkTripId"); if (ti) ti.value = ACTIVE_TRIP.tripId || CURRENT_TRIP_ID || "";
    recalcBreak();
  }

  // Same idea as prefillBreak(): the Trip Feedback page's Trip ID/Trip Name
  // fields are readonly display-only, resynced from the real active trip
  // every time this page opens, so the feedback saved to Zoho is always
  // tagged with the trip that was actually driven.
  function prefillTripFeedback() {
    var ti = $("#inTfbTripId"); if (ti) ti.value = ACTIVE_TRIP.tripId || CURRENT_TRIP_ID || "";
    var tn = $("#inTfbTripName"); if (tn) tn.value = ACTIVE_TRIP.tripName || ACTIVE_TRIP.tripId || CURRENT_TRIP_ID || "";
  }

  // Break length, handling a block that runs past midnight.
  function breakMins() {
    var s = toMins(val("#inBrkStart")), e = toMins(val("#inBrkEnd"));
    if (s === null || e === null || !val("#inBrkStart") || !val("#inBrkEnd")) return null;
    return e >= s ? e - s : e + 1440 - s;
  }

  function recalcBreak() {
    var m = breakMins();
    setText("brkLength", m === null ? "—" : hm(m));
    setText("brkRequired", bfm.restBlock + " min");
    setText("brkStatus", m === null ? "—" : (m >= bfm.restBlock ? "Qualifies as a rest block" : "Shorter than required"));
  }

  function saveBreak() {
    var err = $("#brkErr");
    err.hidden = true;
    clearBad(["fBrkDate", "fBrkStart", "fBrkEnd", "fBrkLoc"]);

    var ok = requireFields([
      ["#inBrkStart", "fBrkStart", "Enter your break start time."],
      ["#inBrkEnd", "fBrkEnd", "Enter your break end time."],
      ["#inBrkLoc", "fBrkLoc", "Enter your live location."],
    ], err);
    if (!ok) return;

    var mins = breakMins();
    if (mins === 0) { $("#fBrkEnd").classList.add("is-bad"); err.textContent = "End time cannot match the start time."; err.hidden = false; return; }

    var rec = {
      date: val("#inBrkDate") || todayLabel(),
      tripName: val("#inBrkTripName"),
      tripId: val("#inBrkTripId"),
      start: val("#inBrkStart"),
      end: val("#inBrkEnd"),
      location: val("#inBrkLoc"),
      liveUrl: val("#inBrkUrl"),
      minutes: mins,
    };
    breakLogs.unshift(rec);

    pushToCreator("Break_Log", {
      Current_Date: rec.date,
      Trip_Name: rec.tripName,
      Trip_ID: rec.tripId,
      Start_Time: rec.start,
      End_Time: rec.end,
      Total_Break_Duration_Min: rec.minutes,
      Live_Location: rec.location,
      Live_Location_URL: rec.liveUrl,
    });

    // A qualifying break resets the continuous-work clock.
    if (mins >= bfm.restBlock) {
      state.sinceRestMins = 0;
      state.restAlertShown = false;
      state.restEscalated = false;
      clearNotifications();
    }
    state.restTakenMins += mins;
    renderBfm();
    renderAlerts();

    ["#inBrkStart", "#inBrkEnd", "#inBrkLoc", "#inBrkUrl"]
      .forEach(function (s) { var el = $(s); if (el) el.value = ""; });
    recalcBreak();

    toast("Break saved — " + hm(mins) + " logged");
    go("trip");
  }

  /* ------------------------------ KPI tiles ------------------------------- */
  /* Hover tilt follows the pointer so the 3D reads as a real surface rather
     than a fixed rotation. Touch devices get the same lit state via .is-lit,
     since :hover either never fires or sticks after the finger lifts. */
  function initKpiTiles() {
    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var fine = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    $$(".kpi").forEach(function (card) {
      if (fine && !reduced) {
        card.addEventListener("mousemove", function (e) {
          var r = card.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width - 0.5;   // -0.5 … 0.5
          var py = (e.clientY - r.top) / r.height - 0.5;
          card.style.transform =
            "translateY(-6px) scale(1.018) rotateX(" + (-py * 7).toFixed(2) +
            "deg) rotateY(" + (px * 8).toFixed(2) + "deg)";
        });
        card.addEventListener("mouseleave", function () { card.style.transform = ""; });
      }

      // Touch / click glow — lights the card, then releases it.
      card.addEventListener("pointerdown", function () { card.classList.add("is-lit"); });
      ["pointerup", "pointercancel", "pointerleave", "blur"].forEach(function (evt) {
        card.addEventListener(evt, function () {
          setTimeout(function () { card.classList.remove("is-lit"); }, 260);
        });
      });
    });
  }

  /* ----------------------------- live trip map ---------------------------- */
  /* Draws the driven portion of the route as a stroke-dashoffset sweep,
     places a pin for every hub in HUBS along that same path, and parks the
     vehicle marker at the current progress point so everything agrees. */
  var mapLiveTimer = null;
  var mapSelectedHub = null;

  function mapRouteEl() { return document.getElementById("mapRoute") || document.getElementById("mapProgress"); }

  // Builds one <g class="mhub"> pin per hub, spaced evenly along the route
  // path (excluding the final hub, which coincides with the END pin).
  function buildMapHubs() {
    var host = document.getElementById("tripmapHubs");
    var route = mapRouteEl();
    if (!host || !route || !route.getTotalLength) return;
    var len = route.getTotalLength();
    var mapHubs = HUBS.slice(0, HUBS.length - 1); // last hub ≈ END pin, already drawn

    host.innerHTML = "";
    mapHubs.forEach(function (h, i) {
      var t = (i + 1) / (mapHubs.length + 1);
      var p = route.getPointAtLength(len * t);
      var ns = "http://www.w3.org/2000/svg";
      var g = document.createElementNS(ns, "g");
      g.setAttribute("class", "mhub is-" + h.status);
      g.setAttribute("data-hub", h.name);
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.setAttribute("aria-label", h.name + " · " + statusLabel(h.status));

      var c = document.createElementNS(ns, "circle");
      c.setAttribute("cx", p.x.toFixed(1)); c.setAttribute("cy", p.y.toFixed(1)); c.setAttribute("r", "7");
      var tx = document.createElementNS(ns, "text");
      tx.setAttribute("x", p.x.toFixed(1)); tx.setAttribute("y", (p.y - 16).toFixed(1));
      tx.textContent = h.name;

      g.appendChild(c); g.appendChild(tx);
      g.addEventListener("click", function () { selectMapHub(h.name); });
      g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectMapHub(h.name); } });
      host.appendChild(g);
    });
  }

  // Populates the "Hub filter" dropdown from HUBS (kept in sync with the map).
  function populateMapHubFilter() {
    var sel = document.getElementById("mapHubFilter");
    if (!sel || sel.dataset.filled) return;
    sel.dataset.filled = "1";
    HUBS.forEach(function (h) {
      var opt = document.createElement("option");
      opt.value = h.name;
      opt.textContent = h.name;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", function () { selectMapHub(sel.value || null); });
  }

  // Highlights a hub's pin on the map and shows its details in the info panel.
  function selectMapHub(name) {
    mapSelectedHub = name;
    var sel = document.getElementById("mapHubFilter");
    if (sel && sel.value !== (name || "")) sel.value = name || "";

    $$(".mhub").forEach(function (g) {
      g.classList.toggle("is-active", !!name && g.getAttribute("data-hub") === name);
    });

    var panel = document.getElementById("mapHubInfo");
    if (!panel) return;
    if (!name) { panel.hidden = true; return; }
    var h = HUBS.filter(function (x) { return x.name === name; })[0];
    if (!h) { panel.hidden = true; return; }

    setText("mapHubInfoBadge", "Stop #" + h.no);
    setText("mapHubInfoName", h.name);
    setText("mapHubInfoLoc", h.location);
    var st = document.getElementById("mapHubInfoStatus");
    if (st) { st.textContent = statusLabel(h.status); st.className = "hubstatus is-" + h.status; }
    panel.hidden = false;
  }

  // Simulates a live GPS feed: nudges the vehicle a little further along the
  // route every few seconds (bounded so it doesn't run past the next stop)
  // and refreshes the "position updated" timestamp — there's no live backend
  // in this build, so this stands in for a real telematics feed.
  var mapLivePct = 486 / 874;
  var mapLiveSecondsAgo = 0;

  function tickMapLive() {
    var route = document.getElementById("mapProgress");
    var veh = document.getElementById("mapVehicle");
    if (!route || !route.getTotalLength) return;
    var len = route.getTotalLength();

    var cap = 212 / 300; // don't drive the marker past the "next stop" pin
    mapLivePct = Math.min(cap, mapLivePct + (Math.random() * 0.0035 + 0.0015));
    route.style.transition = "stroke-dashoffset 3.4s linear";
    route.style.strokeDashoffset = len * (1 - mapLivePct);

    if (veh) {
      var p = route.getPointAtLength(len * mapLivePct);
      veh.style.transition = "transform 3.4s linear";
      veh.setAttribute("transform", "translate(" + p.x.toFixed(1) + "," + p.y.toFixed(1) + ")");
      var speedLbl = veh.querySelector("text");
      if (speedLbl) speedLbl.textContent = "VH-208 · " + (86 + Math.round(Math.random() * 14)) + " km/h";
    }
    mapLiveSecondsAgo = 0;
  }

  function startMapLive() {
    if (mapLiveTimer) return;
    mapLiveSecondsAgo = 0;
    mapLiveTimer = setInterval(function () {
      mapLiveSecondsAgo += 1;
      setText("mapUpdated", mapLiveSecondsAgo <= 1 ? "just now" : mapLiveSecondsAgo + "s ago");
      if (mapLiveSecondsAgo % 4 === 0) tickMapLive();
    }, 1000);
  }
  function stopMapLive() {
    if (mapLiveTimer) { clearInterval(mapLiveTimer); mapLiveTimer = null; }
  }

  function animateMap() {
    var route = document.getElementById("mapProgress");
    var veh = document.getElementById("mapVehicle");
    if (!route || !route.getTotalLength) return;

    buildMapHubs();
    populateMapHubFilter();

    var len = route.getTotalLength();
    var pct = mapLivePct;                       // km covered of total

    route.style.transition = "none";
    route.style.strokeDasharray = len;
    route.style.strokeDashoffset = len;

    if (veh) {
      var p = route.getPointAtLength(len * pct);
      veh.setAttribute("transform", "translate(" + p.x.toFixed(1) + "," + p.y.toFixed(1) + ")");
    }

    // next frame, so the browser registers the start state before transitioning
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        route.style.transition = "stroke-dashoffset 1.5s cubic-bezier(.3,.8,.3,1)";
        route.style.strokeDashoffset = len * (1 - pct);
      });
    });

    startMapLive();
  }

  /* ------------------------------- panels -------------------------------- */
  function openPanel(id, btn) {
    closePanels();
    document.getElementById(id).hidden = false;
    $("#scrim").hidden = false;
    if (btn) btn.classList.add("is-open"), btn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }
  function closePanels() {
    $$(".panel").forEach(function (p) { p.hidden = true; });
    $("#scrim").hidden = true;
    $$(".avbtn").forEach(function (b) { b.classList.remove("is-open"); b.setAttribute("aria-expanded", "false"); });
    $$("[data-panel]").forEach(function (b) { b.classList.remove("is-open"); });
    document.body.style.overflow = "";
  }

  /* ------------------------------ animation ------------------------------ */
  function animateBars() {
    $$("[data-fill]").forEach(function (el, i) {
      var pct = Math.max(0, Math.min(100, Number(el.getAttribute("data-fill")) || 0));
      el.style.width = "0";
      setTimeout(function () { el.style.width = pct + "%"; }, 90 + i * 55);
    });
  }

  function animateRing() {
    var ring = $("#ringV"), label = $("#ringPct");
    if (!ring) return;
    var pct = 67, circ = 2 * Math.PI * 50;
    ring.style.strokeDashoffset = circ;
    setTimeout(function () { ring.style.strokeDashoffset = circ * (1 - pct / 100); }, 200);
    var n = 0, step = setInterval(function () {
      n += 2; if (n >= pct) { n = pct; clearInterval(step); }
      label.textContent = n + "%";
    }, 22);
  }

  function animateScore() {
    var circ = 2 * Math.PI * 50, mini = 2 * Math.PI * 14;
    var big = $("#scoreRing"), small = $("#scoreArc");
    if (big) setTimeout(function () { big.style.strokeDashoffset = circ * (1 - driver.score / 100); }, 250);
    if (small) { small.setAttribute("stroke-dasharray", mini); setTimeout(function () { small.style.transition = "stroke-dashoffset 1s ease"; small.style.strokeDashoffset = mini * (1 - driver.score / 100); }, 350); }
    setText("scoreMini", driver.score);
    setText("scoreBig", driver.score);
  }

  /* -------------------------------- alerts ------------------------------- */
  function renderAlerts() {
    var ev = evaluateBfm();
    var items = [];
    if (ev.restRequired) items.push({ tone: "red", text: "Rest required now — " + hm(ev.restRequired) + " before driving on", time: "Now" });
    else items.push({ tone: "amber", text: "Rest block due in " + hm(ev.untilRest), time: "Scheduled" });
    items.push({ tone: "amber", text: "Vehicle service due in 620 km", time: "13 minutes ago" });
    items.push({ tone: "green", text: "POD successfully submitted — Stop #8", time: "12:20" });
    items.push({ tone: "green", text: "Route updated by Dispatch — continue on the M31", time: "11:02" });
    items.push({ tone: "amber", text: "Medical certificate expires in 28 days", time: "Today" });

    $("#alertList").innerHTML = items.map(function (a) {
      return '<li class="alert ' + a.tone + '"><i class="status-dot ' + a.tone +
        '" style="margin-top:5px"></i><div><p>' + a.text + "</p><time>" + a.time + "</time></div></li>";
    }).join("");
  }

  /* ============================ CREATOR BRIDGE =========================== */

  /* ---------------------------- field helpers ----------------------------
     Zoho returns compound fields (Name, Address, lookups) as objects rather
     than plain strings. These helpers pull a sane display string out of
     whatever shape comes back, so the dashboard doesn't break if a field's
     exact response shape differs slightly between reports. */
  // Looks a value up on a Creator record trying several possible API-name
  // spellings in turn, then — if none hit exactly — falls back to a
  // normalized (lowercase, no separators) scan of every key on the record.
  // This exists because a single guessed API name (e.g. "Driving_Experience")
  // is fragile: if the real field is named "Experience_Years" or
  // "Driving_Experience_Yrs" the value silently comes back blank. Passing a
  // handful of likely candidates makes the mapping resilient to that.
  function normFieldKey(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
  function findFieldKey(rec, candidates) {
    if (!rec) return null;
    for (var i = 0; i < candidates.length; i++) {
      var key = candidates[i];
      if (key && rec[key] !== undefined && rec[key] !== null && rec[key] !== "") return key;
    }
    var wanted = candidates.filter(Boolean).map(normFieldKey);
    var keys = Object.keys(rec);
    for (var j = 0; j < keys.length; j++) {
      if (wanted.indexOf(normFieldKey(keys[j])) === -1) continue;
      var v = rec[keys[j]];
      if (v !== undefined && v !== null && v !== "") return keys[j];
    }
    return null;
  }
  function findField(rec, candidates) {
    var key = findFieldKey(rec, candidates);
    return key ? rec[key] : "";
  }

  function luVal(v) {
    // lookup / picklist-from-form fields: usually a string already, but can
    // come back as {ID, display_value} / {ID, zc_display_value}.
    if (v === null || v === undefined) return "";
    if (typeof v === "string" || typeof v === "number") return String(v);
    return v.display_value || v.zc_display_value || v.ID || "";
  }
  // Companion to luVal(): returns a lookup field's own record ID rather
  // than its display text. Needed when WRITING to a lookup/picklist field
  // (e.g. Vehicle_check_in's Trip_ID, Driver, Trip_Name, Vehicle fields) —
  // Zoho Creator expects the linked record's ID as the value, not its
  // display name. If the raw value is already a plain string, it's assumed
  // to already be the ID (some responses return lookups this way).
  function luId(v) {
    if (v === null || v === undefined) return "";
    if (typeof v === "string" || typeof v === "number") return String(v);
    return v.ID || v.zc_id || v.id || "";
  }
  function nameVal(v) {
    if (!v) return "";
    if (typeof v === "string") return v;
    return v.display_value ||
      [v.prefix, v.first_name, v.last_name, v.suffix].filter(Boolean).join(" ");
  }
  function addrVal(v) {
    if (!v) return "";
    if (typeof v === "string") return v;
    return v.display_value ||
      [v.district_city, v.state_province].filter(Boolean).join(" ");
  }
  function initialsOf(name) {
    var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "--";
    return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
  }
  // Parses Zoho's default "dd-MMM-yyyy" date string (e.g. "12-Jun-2028").
  // Falls back to native Date parsing for any other format.
  function parseZohoDate(s) {
    if (!s) return null;
    var m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})/.exec(s);
    if (m) {
      var months = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
      var mo = months[m[2]];
      if (mo !== undefined) return new Date(Number(m[3]), mo, Number(m[1]));
    }
    var d = new Date(s);
    return isNaN(d) ? null : d;
  }
  function daysUntil(s) {
    var d = parseZohoDate(s);
    if (!d) return null;
    return Math.round((d - new Date()) / 86400000);
  }

  /* -------------------- avatar image (Profile_Picture) --------------------
     Image field values come back as a relative Creator API download path
     (e.g. "/api/v2/.../Driver/view/Driver/123/Profile_Picture/download").
     ZOHO.CREATOR.UTIL.setImageData() resolves that path with the widget's
     session/auth and paints it into the <img>. Also used for the Medical
     Certificate file field, wired up as a plain download link instead of an
     <img>, since it may not be an image. */
  function setAvatar(imgId, initialsId, path, fallbackInitials) {
    var img = document.getElementById(imgId);
    var initialsEl = document.getElementById(initialsId);
    if (initialsEl) initialsEl.textContent = fallbackInitials || "--";
    if (!path || !img) return;
    if (window.ZOHO && ZOHO.CREATOR && ZOHO.CREATOR.UTIL && ZOHO.CREATOR.UTIL.setImageData) {
      ZOHO.CREATOR.UTIL.setImageData(img, path, function () {
        img.hidden = false;
        if (initialsEl) initialsEl.hidden = true;
      });
    } else {
      img.src = path;
      img.hidden = false;
      if (initialsEl) initialsEl.hidden = true;
    }
  }

  /* --------------------------- document viewer popup -----------------------
     Opens a resolved document link (from wireDocumentLink, below) in an
     in-page popup instead of a new tab, with a Download action. Works for
     any file type the browser can preview inline (PDF, images); other
     types will simply show a blank preview but the Download/Open-in-new-tab
     actions still work since they point straight at the same resolved URL.
     -------------------------------------------------------------------- */
  function suggestDownloadName(title) {
    var safe = (title || "document").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    return (safe || "document") + ".pdf";
  }

  function openDocPopup(title, url) {
    if (!url) return;
    setText("docViewerTitle", title || "Document");

    var loading = $("#docViewerLoading");
    if (loading) loading.hidden = false;

    var frame = $("#docViewerFrame");
    if (frame) {
      frame.onload = function () { if (loading) loading.hidden = true; };
      frame.src = url;
    }

    var dl = $("#docViewerDownload");
    if (dl) { dl.href = url; dl.setAttribute("download", suggestDownloadName(title)); }

    var openTab = $("#docViewerOpenTab");
    if (openTab) openTab.href = url;

    $("#docViewerPopup").hidden = false;
    $("#docViewerScrim").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeDocPopup() {
    var popup = $("#docViewerPopup");
    var scrim = $("#docViewerScrim");
    if (popup) popup.hidden = true;
    if (scrim) scrim.hidden = true;
    document.body.style.overflow = "";
    var frame = $("#docViewerFrame");
    if (frame) frame.src = "about:blank";
  }

  /* -------------------------- driver documents page ------------------------
     Resolves one attachment-field path (Medical Certificate, Licence
     Document, Right to Work Document, Identity Document Copy) into a
     working "Open" link on the Driver Documents page. Reuses the exact
     same ZOHO.CREATOR.UTIL.setImageData() resolver as the avatar photo —
     it isn't image-specific, it just authenticates + resolves a Creator
     attachment path — via an offscreen <img> whose resolved .src (a blob
     or signed URL) is then handed to the visible <a href>. This works for
     any file type (PDF, JPG, etc.), not just images, and every link only
     ever points at the driver's own original file — nothing is generated,
     copied, or substituted here.
     -------------------------------------------------------------------- */
  function wireDocumentLink(path, cardId, statusId, linkId) {
    var cardEl = document.getElementById(cardId);
    var statusEl = document.getElementById(statusId);
    var linkEl = document.getElementById(linkId);

    function markMissing(msg) {
      if (statusEl) statusEl.textContent = msg || "Not on file";
      if (cardEl) cardEl.classList.add("is-missing");
      if (linkEl) { linkEl.setAttribute("aria-disabled", "true"); linkEl.removeAttribute("href"); }
    }
    function markReady(url) {
      if (statusEl) statusEl.textContent = "On file";
      if (cardEl) cardEl.classList.remove("is-missing");
      if (linkEl) { linkEl.href = url; linkEl.removeAttribute("aria-disabled"); }
    }

    if (!path) { markMissing(); return; }
    if (statusEl) statusEl.textContent = "Loading…";

    if (window.ZOHO && ZOHO.CREATOR && ZOHO.CREATOR.UTIL && ZOHO.CREATOR.UTIL.setImageData) {
      var resolver = document.createElement("img");
      resolver.hidden = true;
      document.body.appendChild(resolver);
      ZOHO.CREATOR.UTIL.setImageData(resolver, path, function () {
        markReady(resolver.src);
        resolver.remove();
      });
    } else {
      // Preview/offline mode — best effort, may not resolve without the
      // widget SDK's auth, but at least isn't left stuck on "Loading…".
      markReady(path);
    }
  }

  // Populates the Driver Documents page from the same Driver form record
  // already loaded for the rest of the dashboard — no second fetch. Only
  // the four document types the requirement calls for are shown.
  function renderDriverDocuments() {
    setText("docsDriverName", driver.name || "—");
    setText("docsDriverId", driver.id || "—");

    var noteEl = document.getElementById("docsLookupNote");
    var noteTxt = document.getElementById("docsLookupNoteText");
    if (!driver.loaded) {
      if (noteTxt) noteTxt.textContent = "Couldn't identify your driver record yet — documents will appear once it loads.";
      if (noteEl) noteEl.hidden = false;
    } else if (noteEl) {
      noteEl.hidden = true;
    }

    wireDocumentLink(driver.medicalCertificatePath, "docCardMedical", "docStatusMedical", "docLinkMedical");
    wireDocumentLink(driver.licenceDocumentPath, "docCardLicence", "docStatusLicence", "docLinkLicence");
    wireDocumentLink(driver.rightToWorkDocumentPath, "docCardRtw", "docStatusRtw", "docLinkRtw");
    wireDocumentLink(driver.identityDocumentCopyPath, "docCardIdentity", "docStatusIdentity", "docLinkIdentity");
  }

  // Wires a file/attachment field (e.g. Medical_Certificate) as a download
  // link. Zoho file fields come back as a relative API path; the download
  // URL for File Upload fields follows the same
  // .../<Form>/<recordId>/<field>/download pattern as image fields, so it's
  // safe to point an <a href> straight at it once we know the report/base
  // used to fetch the record supports it.
  function setFileLink(linkId, path, label, fallbackId) {
    var link = document.getElementById(linkId);
    var fallback = fallbackId ? document.getElementById(fallbackId) : null;
    if (!link) return;
    if (!path) {
      link.hidden = true;
      link.removeAttribute("href");
      if (fallback) fallback.hidden = false;
      return;
    }
    link.hidden = false;
    link.textContent = label || "View file";
    link.setAttribute("href", path);
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener");
    if (fallback) fallback.hidden = true;
  }

  /* --------------------------- BFM Monitoring -----------------------------
     Maps a BFM Monitoring record onto the config object. NOTE: the uploaded
     app's BFM_Monitoring form only has BFM_ID / Start_Time / End_Time /
     Rest_Duration — none of the Driver_ID / Fatigue_Module / *_Minutes
     fields referenced below exist there yet. Add them to that form (or
     rename the keys here to match whatever fields you do add) to make this
     section live; until then it silently keeps the sensible defaults above. */
  function readBfmRecord(rec) {
    if (!rec) return;
    bfm.module = rec.Fatigue_Module || bfm.module;
    bfm.maxContinuousWork = Number(rec.Max_Continuous_Work_Minutes) || bfm.maxContinuousWork;
    bfm.restBlock = Number(rec.Rest_Block_Minutes) || bfm.restBlock;
    bfm.maxWorkPerShift = Number(rec.Max_Work_Per_Shift_Minutes) || bfm.maxWorkPerShift;
    bfm.minRestPerShift = Number(rec.Min_Rest_Per_Shift_Minutes) || bfm.minRestPerShift;
    bfm.maxWorkPerWeek = Number(rec.Max_Work_Per_Week_Minutes) || bfm.maxWorkPerWeek;
    bfm.warnBefore = Number(rec.Warning_Threshold_Minutes) || bfm.warnBefore;
    bfm.source = "BFM Monitoring · " + (rec.Rule_Set_Name || bfm.module);
  }

  function loadBfmForDriver() {
    return ZOHO.CREATOR.DATA.getRecords({
      report_name: REPORTS.bfm,
      criteria: '(Driver_ID == "' + driver.id + '" && Active == true)',
      field_config: "all",
      max_records: 200,
    })
      .then(function (res) {
        readBfmRecord(res && res.data && res.data[0]);
      })
      .catch(function () {
        bfm.source = "Default BFM values (form unreachable)";
      })
      .then(function () {
        renderBfm();
        renderAlerts();
      });
  }

  /* --------------------------- driver profile ------------------------------
     Login email -> Driver Form match -> driver record -> render.
     Every field the Driver Information panel shows now comes straight off
     this single Driver Form record — there is no second form to merge. */
  function mapEmployeeToDriver(rec) {
    var report = []; // { field, matchedKey, value } — logged to console below

    function pick(logicalField, rawFn) {
      var candidates = FIELD_CANDIDATES[logicalField] || [];
      var key = findFieldKey(rec, candidates);
      var raw = key ? rec[key] : "";
      var value = rawFn ? rawFn(raw) : (raw || "");
      report.push({ field: logicalField, matchedApiName: key || "NOT FOUND", value: value });
      return value;
    }

    driver.recordId = rec.ID || rec.id || null;
    driver.id = pick("id") || driver.id;
    driver.name = pick("name", nameVal) || driver.name;
    driver.gender = pick("gender", luVal);
    driver.email = pick("email") || driver.email;
    driver.mobile = pick("mobile");
    driver.altMobile = pick("altMobile");
    driver.dob = pick("dob");
    driver.photoPath = pick("photo");
    driver.address = pick("address", addrVal);
    driver.employmentType = pick("employmentType");
    driver.started = pick("joiningDate");            // Joining Date
    driver.department = pick("department", luVal);
    driver.licenceNo = pick("licenceNo");             // "Licence" (Licence_NO)
    driver.licenceNumber = pick("licenceNumber");     // separate "Licence Number" field on this form
    driver.licenceIssueDate = pick("licenceIssueDate");
    driver.licenceClass = pick("licenceType", luVal);
    driver.licenceExpiry = pick("licenceExpiry");
    driver.licenceStatus = pick("licenceStatus", luVal);
    driver.licenceDocumentPath = pick("licenceDocument");
    driver.licenceCopyPath = pick("licenceCopy");
    driver.vehicleName = pick("vehicleName", luVal);
    driver.vehicleAssigned = driver.vehicleName;
    driver.passportNumber = pick("passportNumber");
    driver.passportCopyPath = pick("passportCopy");
    driver.experience = pick("experience");
    driver.lastCheckupDate = pick("lastCheckupDate");
    driver.documentsPath = pick("documents");
    driver.remark = pick("remark");
    driver.visaStatus = pick("visaStatus", luVal);
    driver.visaExpiryDate = pick("visaExpiryDate");
    driver.expiryDate = pick("expiryDate");
    driver.medicalCertificatePath = pick("medicalCertificate");
    driver.rightToWorkDocumentPath = pick("rightToWorkDocument");
    driver.identityDocumentCopyPath = pick("identityDocumentCopy");
    // BFM Accreditation: only populated once EMP_FIELD.bfmAccreditation is
    // pointed at a real field on the Driver form (see the comment above).
    driver.bfmAccreditation = EMP_FIELD.bfmAccreditation ? (rec[EMP_FIELD.bfmAccreditation] || "") : "";
    driver.loaded = true;

    // Diagnostic report — open the browser console after the dashboard
    // loads to see exactly which Zoho API name matched each field (or
    // "NOT FOUND" if none of the candidates in FIELD_CANDIDATES matched).
    // A field showing NOT FOUND with a value present in the raw record
    // below means its real API name needs adding to FIELD_CANDIDATES.
    console.log(LOG_TAG, "Field mapping report:");
    if (console.table) console.table(report); else console.log(report);
    console.log(LOG_TAG, "Raw record returned by Zoho (all keys as-received):", rec);
  }

  function shortName(name) {
    var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "—";
    return parts.length > 1 ? parts[0] + " " + parts[1][0] + "." : parts[0];
  }

  function renderDriverProfile() {
    var initials = initialsOf(driver.name);
    setText("hdrDriverId", driver.id);
    setText("hdrDriverName", shortName(driver.name));
    setText("panelDriverName", driver.name);
    setText("panelDriverSub", driver.id + (driver.department ? " · " + driver.department : ""));
    setText("tripDriverLabel", driver.name + " (" + driver.id + ")");
    setText("tripsDriverName", driver.name);

    setAvatar("hdrAvatarImg", "hdrAvatarInitials", driver.photoPath, initials);
    // Profile Picture — shown as the driver's avatar photo in the panel header.
    setAvatar("panelAvatarImg", "panelAvatarInitials", driver.photoPath, initials);

    // Driver Documents page — refreshed here so it's always in sync with
    // whatever Driver record was last loaded, whether or not the page is
    // currently open.
    renderDriverDocuments();

    // Personal information
    setText("panelEmployeeId", driver.id || "—");
    setText("panelName", driver.name || "—");
    setText("panelGender", driver.gender || "—");
    setText("panelDob", driver.dob || "—");
    setText("panelMobile", driver.mobile || "—");
    setText("panelEmail", driver.email || "—");
    setText("panelAddress", driver.address || "—"); // "Full Address" field

    // Employment
    setText("panelEmploymentType", driver.employmentType || "—");
    setText("panelStarted", driver.started || "—");            // Joining Date
    setText("panelDepartment", driver.department || "—");

    // Licence
    setText("panelLicenceNo", driver.licenceNo || "—");         // "Licence" (Licence_NO)
    setText("panelLicenceClass", driver.licenceClass || "—");   // Licence Type
    setText("panelLicenceIssueDate", driver.licenceIssueDate || "—");
    setText("panelLicenceExpiry", driver.licenceExpiry || "—");
    setText("panelLicenceStatus", driver.licenceStatus || "—");

    // Driving — "Driver Experience (Years)"; append "years" only for a
    // plain numeric value — if the Driver Form field already returns text
    // (e.g. "5 years"), show it as-is rather than doubling the unit.
    var expVal = driver.experience;
    var expIsPlainNumber = expVal !== "" && !isNaN(Number(expVal));
    setText("panelExperience", expVal ? (expIsPlainNumber ? expVal + " years" : String(expVal)) : "—");
    setText("panelLastCheckup", driver.lastCheckupDate || "—");

    // Expiry warning banner — driven by Licence Expiry Date, the one
    // safety-critical expiry this form actually has (there is no medical
    // certificate field to warn on).
    var warnEl = document.getElementById("panelDocWarn");
    var warnTxt = document.getElementById("panelDocWarnText");
    var dLeft = daysUntil(driver.licenceExpiry);
    if (warnEl && warnTxt) {
      if (dLeft !== null && dLeft <= 30) {
        warnTxt.textContent = dLeft < 0
          ? "Licence expired " + Math.abs(dLeft) + " days ago"
          : "Licence expires in " + dLeft + " days";
        warnEl.hidden = false;
      } else {
        warnEl.hidden = true;
      }
    }
  }

  var LOG_TAG = "[Driver Dashboard]";

  function normEmail(s) {
    return String(s || "").trim().toLowerCase();
  }

  // Shows/hides the visible "couldn't identify driver" banner in the Driver
  // Information panel. This exists so a portal user who isn't matched sees a
  // clear message instead of the header/panel silently hanging on "Loading…"
  // or (worse) showing another driver's leftover data.
  function showDriverLookupIssue(message) {
    var el = document.getElementById("driverLookupError");
    var txt = document.getElementById("driverLookupErrorText");
    if (txt) txt.textContent = message;
    if (el) el.hidden = false;
  }
  function clearDriverLookupIssue() {
    var el = document.getElementById("driverLookupError");
    if (el) el.hidden = true;
  }

  // Resolves the email to match against the Driver form, trying every source
  // that can carry it in a Client Portal context, in priority order:
  //  1. ?driverEmail= on the widget/page URL — set this from a Deluge
  //     on-load script on the portal page/dashboard using
  //     zoho.loginuserid (or thisapp.portal.loginUserName()) if
  //     getInitParams() doesn't resolve reliably for your portal.
  //  2. ZOHO.CREATOR.UTIL.getWidgetParams() — if the widget was inserted
  //     with a "Driver Email" widget parameter bound to the portal user.
  //  3. ZOHO.CREATOR.UTIL.getInitParams().loginUser — the general
  //     logged-in-user API; works for most internal/public app contexts
  //     but is not guaranteed to be populated for every Portal embedding.
  // NOTE (v2): getQueryParams() is promise-based in JS API v2 (it was
  // synchronous in v1), so it has to be awaited/chained like every other
  // UTIL/DATA task instead of being read directly off the call.
  function resolveLoginEmail() {
    var queryParamsPromise = (ZOHO.CREATOR.UTIL.getQueryParams
      ? ZOHO.CREATOR.UTIL.getQueryParams().catch(function () { return {}; })
      : Promise.resolve({}));

    return queryParamsPromise.then(function (cfg) {
      cfg = cfg || {};
      if (cfg.driverEmail) {
        console.log(LOG_TAG, "email source: URL param ?driverEmail=", cfg.driverEmail);
        return cfg.driverEmail;
      }

      var widgetParamsPromise = (ZOHO.CREATOR.UTIL.getWidgetParams
        ? ZOHO.CREATOR.UTIL.getWidgetParams().catch(function () { return {}; })
        : Promise.resolve({}));

      return widgetParamsPromise.then(function (wp) {
        var fromWidgetParam = wp && (wp.Driver_Email || wp.driverEmail);
        if (fromWidgetParam) {
          console.log(LOG_TAG, "email source: widget parameter", fromWidgetParam);
          return fromWidgetParam;
        }
        return ZOHO.CREATOR.UTIL.getInitParams().then(function (initParams) {
          console.log(LOG_TAG, "getInitParams() ->", initParams);
          var email = initParams && initParams.loginUser;
          if (!email) {
            throw new Error(
              "getInitParams() returned no loginUser. In a Customer Portal this can " +
              "happen depending on how the widget page is embedded — pass the portal " +
              "user's email in explicitly instead: add a query param to this widget's " +
              "page URL (e.g. via a Deluge on-load script using zoho.loginuserid) and " +
              "read it here as ?driverEmail=..."
            );
          }
          console.log(LOG_TAG, "email source: getInitParams().loginUser", email);
          return email;
        });
      });
    });
  }

  // Detects whether a getRecords rejection is specifically Zoho's "report
  // not shared with this user" permission error (HTTP 403, code 2898) as
  // opposed to some other failure (network, invalid report name, etc.), so
  // the on-screen message can give the exact right fix.
  // Pulls the actual human-readable message out of a Zoho Creator API
  // rejection so it can be shown to the driver as-is, instead of a generic
  // "something went wrong". Zoho's v2 addRecords/updateRecords errors come
  // back in a few different shapes depending on the failure, so this tries
  // each in order before falling back to the raw JSON.
  function describeCreatorError(err) {
    if (!err) return "Unknown error.";
    if (typeof err === "string") return err;
    if (err.message) return err.message;
    if (err.data && err.data.message) return err.data.message;
    if (Array.isArray(err.data) && err.data[0] && err.data[0].message) return err.data[0].message;
    try {
      var text = JSON.stringify(err);
      return text && text !== "{}" ? text : "Unknown error.";
    } catch (e) {
      return String(err);
    }
  }

  function isPermissionDeniedError(err) {
    var text = "";
    try { text = JSON.stringify(err); } catch (e) { text = String(err); }
    return /"?status"?\s*[:=]\s*403/.test(text) || /2898/.test(text) || /permission denied/i.test(text);
  }

  // Tries one Creator report by name: exact-match on Email first, falling
  // back to a client-side case/whitespace-insensitive scan over a bounded
  // page. Resolves with the found record (or null if genuinely not found in
  // a report we *could* read) — rejects only when the report itself
  // couldn't be read (permission/invalid report/network).
  // Zoho Creator's v2 getRecords() rejects the promise — rather than
  // resolving with an empty array — when a criteria-based query matches
  // zero records (HTTP 400, code 9280, "No records found matching the
  // given criteria"). Without this, a driver simply not being in the report
  // yet gets misread as "the report itself couldn't be read" and produces a
  // misleading permission-style error. This detects that specific case.
  function isNoRecordsError(err) {
    var text = "";
    try { text = JSON.stringify(err); } catch (e) { text = String(err); }
    return /9280/.test(text) || /no records found/i.test(text);
  }

  // Wraps getRecords so a "no records found" rejection resolves as an empty
  // result (matching what v1 / a normal empty query returns), while any
  // other failure (permission, invalid report, network) still rejects
  // normally so tryNext() can move on to a fallback report.
  async function getRecordsSafe(params) {
    console.log("Get records Params:", params);
    // const data_result = await ZOHO.CREATOR.DATA.getRecords(params);
    // console.log("data_result:",data_result)
    
    
    return ZOHO.CREATOR.DATA.getRecords(params).catch(function (err) {
      if (isNoRecordsError(err)) return { data: [] };
      throw err;
    });
  }

  function tryReportForEmail(reportName, email, wanted) {
    var exactCriteria = '(' + EMP_FIELD.email + ' == "' + email.trim() + '")';
    console.log("exactCriteria:",exactCriteria)
    console.log(LOG_TAG, "Trying report:", reportName, "| criteria:", exactCriteria);

    return getRecordsSafe({
      report_name: reportName,
      criteria: `(${EMP_FIELD.email} == "${email.trim()}")`,
      field_config: "all",
      max_records: 200,
    }).then(function (res) {
      var rows = (res && res.data) || [];
      console.log(LOG_TAG, reportName, "exact-match rows:", rows.length);
      if (rows.length) return rows[0];

      console.warn(LOG_TAG, reportName, "— no exact match, retrying with a case/whitespace-insensitive scan.");
      return getRecordsSafe({
        report_name: reportName,
        field_config: "all",
        max_records: 200,
      }).then(function (res2) {
        var all = (res2 && res2.data) || [];
        var matches = all.filter(function (r) { return normEmail(findField(r, FIELD_CANDIDATES.email)) === wanted; });
        console.log(LOG_TAG, reportName, "fallback scan matched", matches.length, "of", all.length, "records");
        if (matches.length > 1) {
          console.warn(LOG_TAG, "Multiple records in", reportName, "share this email — using the first:", matches);
        }
        if (!matches.length && all.length) {
          console.log(LOG_TAG, "Emails seen in", reportName, "for comparison:",
            all.map(function (r) { return findField(r, FIELD_CANDIDATES.email); }));
        }
        return matches[0] || null;
      });
    });
  }

  // Walks the primary report plus any configured fallbacks, in order,
  // moving to the next candidate only when the current one is unreadable
  // (permission/invalid-report error) — a report that's readable but simply
  // doesn't contain a matching record is treated as the authoritative
  // answer (no record), not a reason to keep guessing.
  function findEmployeeByEmail(email) {
    var wanted = normEmail(email);
    var candidates = [REPORTS.employees].concat(REPORTS.employeesFallbacks || [])
      .filter(function (name, i, arr) { return name && arr.indexOf(name) === i; });
    var attempted = [];
    var lastErr = null;

    function tryNext(idx) {
      if (idx >= candidates.length) {
        var permissionIssue = lastErr && isPermissionDeniedError(lastErr);
        if (permissionIssue) {
          throw new Error(
            "Zoho denied access to the Driver report (HTTP 403 / code 2898 — " +
            "\"Permission denied to view record(s)\"). This is a Zoho Creator " +
            "sharing setting, not something this dashboard's code can fix on its " +
            "own. To resolve it: 1) In Zoho Creator, open this app → Settings → " +
            "Portal (or Users, depending on your plan). 2) Find the report named " +
            (attempted.length ? '"' + attempted.join('", "') + '"' : '"' + REPORTS.employees + '"') +
            " (whichever your Driver Form report is called) and confirm it is " +
            "explicitly shared with the Client Portal role/profile this driver " +
            "logs in as, with at least View permission. 3) Also confirm the " +
            "underlying Driver Form itself is shared with that same portal role — " +
            "a shared report on an unshared form still returns this error. This " +
            "same query already works for admin users, which is expected: portal " +
            "users are permission-scoped separately."
          );
        }
        throw new Error(
          "Could not read " + (attempted.length ? 'the report(s) "' + attempted.join('", "') + '"' : 'the Driver report') +
          " (" + (lastErr && lastErr.message ? lastErr.message : JSON.stringify(lastErr)) + ")."
        );
      }
      var name = candidates[idx];
      attempted.push(name);
      return tryReportForEmail(name, email, wanted).catch(function (err) {
        console.error(LOG_TAG, "getRecords on", name, "failed:", err);
        lastErr = err;
        return tryNext(idx + 1); // only reached on a read failure, not a "no match" result
      });
    }

    return tryNext(0);
  }

  // ---------------------------------------------------------------------
  // Hub Name (Hub_Check_in_Check_Out1's Hub_Name picklist) — populates
  // #inHub with the real Locations records instead of a hardcoded list.
  // Tries REPORTS.locations, then each of REPORTS.locationsFallbacks, in
  // order, stopping at the first report that's actually readable — same
  // pattern as findEmployeeByEmail()'s report fallback.
  // ---------------------------------------------------------------------
  function populateHubSelect(rows) {
    var select = $("#inHub");
    if (!select) return;
    var names = rows
      .map(function (rec) { return findField(rec, LOCATION_FIELD_CANDIDATES.hubName); })
      .map(luVal)
      .filter(Boolean);
    // De-duplicate while preserving order.
    var seen = {};
    names = names.filter(function (n) { return seen[n] ? false : (seen[n] = true); });

    var currentValue = select.value;
    select.innerHTML = '<option value="">Select a hub…</option>';
    names.forEach(function (name) {
      var opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });
    if (currentValue && names.indexOf(currentValue) !== -1) select.value = currentValue;
  }

  function loadHubNamesAndPopulateSelect() {
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA) return Promise.resolve();

    var candidates = [REPORTS.locations].concat(REPORTS.locationsFallbacks || [])
      .filter(function (name, i, arr) { return name && arr.indexOf(name) === i; });

    function tryNext(idx) {
      if (idx >= candidates.length) {
        console.error(LOG_TAG, "Could not read a Locations report for Hub Name (tried: " + candidates.join(", ") + ").");
        return;
      }
      return getRecordsSafe({
        report_name: candidates[idx],
        field_config: "all",
        max_records: 200,
      }).then(function (res) {
        populateHubSelect((res && res.data) || []);
      }).catch(function (err) {
        console.error(LOG_TAG, "getRecords on", candidates[idx], "(Locations) failed:", err);
        return tryNext(idx + 1);
      });
    }

    return tryNext(0);
  }

  function loadFromCreator() {
    if (!window.ZOHO || !ZOHO.CREATOR) {
      bfm.source = "Default BFM values (preview)";
      renderDriverProfile();
      hidePageLoader();
      return;
    }

    loadHubNamesAndPopulateSelect(); // fire-and-forget — never blocks driver load

    var resolvedEmail = "";

    // NOTE: ZOHO.CREATOR.init() is a JS API v1 requirement only. This widget
    // loads the v2 SDK (see the <script> tag in widget.html — CDN URL
    // https://js.zohostatic.com/creator/widgets/version/2.0/widgetsdk-min.js),
    // where DATA/UTIL calls can be made directly with no init handshake — so
    // the chain starts straight off resolveLoginEmail().
    resolveLoginEmail()
      .then(function (email) {
        resolvedEmail = email.trim();
        return findEmployeeByEmail(resolvedEmail);
      })
      .then(function (rec) {
        if (!rec) {
          throw new Error(
            "No Driver form record has Email == \"" + resolvedEmail + "\". " +
            "Check that record's Email field for typos, extra spaces, or a " +
            "different case than the portal login."
          );
        }
        clearDriverLookupIssue();
        // Every displayed field comes from this one Driver form record — no
        // duplicate driver record is created and no second form is queried.
        mapEmployeeToDriver(rec);
      })
      .then(function () {
        renderDriverProfile();
        loadDriverTripsAndRender(); // fire-and-forget: never rejects, see its own .catch()
        return loadBfmForDriver();
      })
      .then(function () {
        hidePageLoader();
      })
      .catch(function (err) {
        console.error(LOG_TAG, "Driver profile load failed:", err);
        driver.loaded = false;
        driver.name = "Driver not found";
        driver.id = "—";
        renderDriverProfile();
        showDriverLookupIssue(
          (resolvedEmail ? "Signed in as " + resolvedEmail + ". " : "") +
          (err && err.message ? err.message : "Could not load this driver's profile.")
        );
        clearTodayTripCard("No matching driver found");
        applyTripAttendance([], [], "No matching driver found.");
        bfm.source = "Default BFM values (driver lookup failed)";
        renderBfm();
        hidePageLoader();
      });
  }

  /* ------------------------------- actions ------------------------------- */
  var ACTION_MAP = {
    contact: { type: "form", link: "Contact_Control" },
    alerts: { type: "report", link: REPORTS.alerts },
    "view-stop": { type: "report", link: "Trip_Stops" },
    "score-report": { type: "report", link: "Driver_Scorecard" },
    trip: { type: "report", link: REPORTS.trips },
    deliveries: { type: "report", link: "Trip_Stops" },
    duty: { type: "report", link: REPORTS.duty },
    route: { type: "report", link: REPORTS.trips },
    fuel: { type: "report", link: "Fuel_Entries" },
  };

  function openInCreator(cfg) {
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.UTIL) return false;
    try {
      // NOTE (v2): navigateParentURL()'s config only supports action / url /
      // window — there is no queryParams key like the old v1-style config
      // some snippets show. Any parameters have to be encoded into the url
      // string itself instead.
      var qs = "?Driver_ID=" + encodeURIComponent(driver.id) + "&Trip_ID=" + encodeURIComponent(ACTIVE_TRIP.tripId || CURRENT_TRIP_ID || "");
      ZOHO.CREATOR.UTIL.navigateParentURL({
        action: "open",
        url: (cfg.type === "form" ? "#Form:" : "#Report:") + cfg.link + qs,
        window: "new",
      });
      return true;
    } catch (e) { return false; }
  }

  /* --------------------------------- boot -------------------------------- */
  // Guard: if DOMContentLoaded somehow fires twice (or the script is injected
  // after the event), booting again would bind every listener a second time
  // and make each click count double.
  var booted = false;
  document.addEventListener("DOMContentLoaded", function () {
    // The loader's own timer (LOADER_MS) already guarantees it clears, even
    // if something later in boot throws.
    try {
      if (booted) return;
      booted = true;
      boot();
    } catch (err) {
      // A boot error must never leave the loader stuck over a blank screen.
      console.error("Dashboard boot error:", err);
      hidePageLoader();
    }
  });

  function boot() {
    setText("hdrDate", todayLabel());
    setText("hdrDriverId", driver.id);

    // view navigation
    document.addEventListener("click", function (e) {
      var navEl = e.target.closest("[data-nav]");
      if (navEl) {
        var navTarget = navEl.getAttribute("data-nav");
        // A Today's Trip row's own Start Trip button carries the real,
        // original Trip ID for that specific trip. Look up its full record
        // and lock in Trip ID / Vehicle / Driver / Driver ID for the rest
        // of the trip — every save from here on reads this same identity,
        // never a stale or regenerated one.
        if (navEl.hasAttribute("data-start-trip")) {
          var startedTripId = navEl.getAttribute("data-trip-id");
          var startedTripRec = startedTripId ? DRIVER_TRIPS_BY_ID[startedTripId] : null;
          if (startedTripRec) {
            setActiveTripFromRecord(startedTripRec);
          } else if (startedTripId) {
            CURRENT_TRIP_ID = startedTripId; // record lookup unavailable — at least keep the ID in sync
          }
        }
        // The top-of-dashboard "Start Trip" tile isn't tied to one row —
        // it always starts whichever trip is earliest in Today's Trip
        // (the same one its own label mirrors). If there isn't one, this
        // is refused rather than opening vehicle check-in with no trip
        // identity behind it.
        if (navEl.id === "btnStartTop") {
          if (!TODAY_TRIP_PICKED.length) {
            toast("No trip assigned yet — nothing to start.");
            return;
          }
          setActiveTripFromRecord(TODAY_TRIP_PICKED[0]);
        }
        // Logging a break pauses the trip timer — warn the driver with a
        // pop-up before it stops, then navigate through as normal.
        if (navTarget === "break" && tripTimerInterval) {
          window.alert("The timer will stop now.");
          pauseTripTimer();
        }
        go(navTarget);
        return;
      }

      var panelEl = e.target.closest("[data-panel]");
      if (panelEl) {
        var pid = panelEl.getAttribute("data-panel");
        openPanel(pid, null);
        animateBars();
        if (pid === "panelAttendance") animateAttRing();
        return;
      }

      var geoEl = e.target.closest("[data-geo]");
      if (geoEl) { captureLocation(geoEl.getAttribute("data-geo")); return; }

      var actEl = e.target.closest("[data-action]");
      if (actEl) {
        var key = actEl.getAttribute("data-action");
        if (key === "alerts") {
          renderAlerts();
          openPanel("panelAlerts", null);
          clearNotifications();
          return;
        }
        var cfg = ACTION_MAP[key];
        if (cfg && openInCreator(cfg)) return;
        toast(actEl.textContent.trim() + " — connect this to a Creator form to go live.");
      }
    });

    $("#btnDriver").addEventListener("click", function () { openPanel("panelDriver", this); });
    $("#btnTripAttended").addEventListener("click", function () { openPanel("panelAttendance", this); animateAttRing(); });
    $("#btnScore").addEventListener("click", function () { openPanel("panelScore", this); animateBars(); animateScore(); });
    $("#scrim").addEventListener("click", closePanels);
    $$("[data-close]").forEach(function (b) { b.addEventListener("click", closePanels); });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      closePanels();
      if (!$("#tyrePopup").hidden) closeTyrePopup();
      if (!$("#docViewerPopup").hidden) closeDocPopup();
    });

    // Bound defensively: several dashboard controls are optional, so a missing
    // element must never stop the rest of boot.
    function on(sel, evt, fn) { var el = $(sel); if (el) el.addEventListener(evt, fn); }

    // Trip Attendance lists (dashboard card + full panel) — clicking a row's
    // View button opens the Trip Details popup for that trip. Real <button>
    // elements handle Enter/Space natively, so no separate keydown handler
    // is needed here.
    function wireTripViewButtons(sel) {
      on(sel, "click", function (e) {
        var btn = e.target.closest("[data-view-trip]");
        if (!btn) return;
        var rowEl = btn.closest("[data-trip-id]");
        if (!rowEl) return;
        var rec = DRIVER_TRIPS_BY_ID[rowEl.getAttribute("data-trip-id")];
        if (rec) openTripDetailsPopup(rec);
      });
    }
    wireTripViewButtons("#dashAttList");
    wireTripViewButtons("#attList");

    // Summary button — opens the full Trip Attendance panel (ring,
    // breakdown, and the same other-trips list) for a closer look.
    on("#btnAttSummary", "click", function () { openPanel("panelAttendance", null); animateAttRing(); });

    on("#btnSaveTimes", "click", saveTimes);
    on("#inStart", "change", recalc);
    on("#inStart", "input", recalc);

    on("#btnSaveVcheck", "click", saveVcheck);

    // Tyre illustration — tap a tyre to open its pressure popup. Delegated
    // (rather than bound per-button) so the fallback grid can be rebuilt by
    // the tyre-count filter without ever needing to be re-wired.
    on("#veh3dFallback", "click", function (e) {
      var b = e.target.closest(".tyre3d__tyre");
      if (b) openTyrePopup(b.getAttribute("data-tyre"));
    });
    on("#tyrePopupSave", "click", saveTyrePopup);
    on("#tyrePopupCancel", "click", closeTyrePopup);
    on("#tyrePopupClose", "click", closeTyrePopup);
    on("#tyreScrim", "click", closeTyrePopup);
    on("#tyrePopupInput", "keydown", function (e) { if (e.key === "Enter") saveTyrePopup(); });

    // Tyre-count filter — 6 / 8 / 12 / 16 tyres, top-right of the Tyres card.
    on("#tyreCountFilter", "change", function (e) { setTyreCount(e.target.value); });

    // Document viewer popup — opens each Documents card's file inline with
    // a Download action instead of navigating away to a new tab.
    on("#docsGrid", "click", function (e) {
      var link = e.target.closest(".doccard__open");
      if (!link || link.getAttribute("aria-disabled") === "true") return;
      e.preventDefault();
      var card = link.closest(".doccard");
      var titleEl = card && card.querySelector(".doccard__body b");
      openDocPopup(titleEl ? titleEl.textContent : "Document", link.getAttribute("href"));
    });
    on("#docViewerClose", "click", closeDocPopup);
    on("#docViewerScrim", "click", closeDocPopup);

    syncTyreIllustration();
    initVeh3d();
    initYesNoToggles();
    // Check KPI tiles open their detail card; verify/close act on one check.
    // Cards carry data-nav, so the global navigation handler opens each page.
    $$("[data-check-verify]").forEach(function (b) {
      b.addEventListener("click", function () { verifyCheck(b.getAttribute("data-check-verify")); });
    });
    $$("[data-check-close]").forEach(function (b) {
      b.addEventListener("click", function () { closeCheck(); });
    });

    // Hub navigator
    on("#hubPrev", "click", function () { stepHub(-1); });
    on("#hubNext", "click", function () { stepHub(1); });
    on("#btnHubPod", "click", function () {
      var h = HUBS[hubIndex];
      checkInState.hub = h.name;
      checkInState.date = checkInState.date || todayLabel();
      if ($("#inHub")) $("#inHub").value = h.name;
      go("pod");
    });
    renderHubs();
    renderTrips();
    renderAttendance();
    renderTodayTrip();
    animateDashAttRing();
    // Live pill updates as the driver works down the inspection.
    $$(".checkcard input, .checkcard select").forEach(function (el) {
      el.addEventListener("input", refreshVcheck);
      el.addEventListener("change", refreshVcheck);
    });
    $$(".checkcard .yn-btn").forEach(function (btn) {
      btn.addEventListener("click", function () { setTimeout(refreshVcheck, 0); });
    });

    on("#btnSaveCheckIn", "click", saveCheckIn);
    on("#btnGoToPod", "click", goToPod);
    on("#btnSavePod", "click", savePod);

    on("#btnSaveFuel", "click", saveFuel);
    on("#inFuelQty", "input", recalcFuelTotal);
    on("#inFuelCost", "input", recalcFuelTotal);

    on("#btnSaveIncident", "click", saveIncident);
    on("#btnSaveVehicle", "click", saveVehicleIssue);
    on("#btnSaveBreak", "click", saveBreak);
    on("#inBrkStart", "input", recalcBreak);
    on("#inBrkEnd", "input", recalcBreak);

    renderPodReports();
    on("#btnComplete", "click", function () {
      go("tripfeedback");
    });
    on("#btnSubmitTripFeedback", "click", function () {
      var err = $("#tfbErr");
      err.hidden = true;
      clearBad(["fTfbFeedback"]);
      var feedback = val("#inTfbFeedback");
      if (!feedback) {
        $("#fTfbFeedback").classList.add("is-bad");
        err.textContent = "Enter some feedback before submitting.";
        err.hidden = false;
        return;
      }

      pushToCreator("Trip_Feedback", {
        Trip_ID: val("#inTfbTripId"),
        Trip_Name: val("#inTfbTripName"),
        Trip_Feedback: feedback,
      });

      toast("Trip " + (ACTIVE_TRIP.tripId || CURRENT_TRIP_ID) + " completed — feedback submitted");
      state.tripStarted = false;
      $("#inTfbFeedback").value = "";
      if (typeof bfmStopMonitoring === "function") bfmStopMonitoring();
      stopTripTimer();
      disarmTripBackGuard();
      go("dash");
    });

    renderBfm();
    renderAlerts();
    animateBars();
    animateScore();
    initKpiTiles();
    loadFromCreator(); // hides the loader itself once its promise settles

    // Live BFM clock — a minute of work is a minute against every limit.
    setInterval(function () {
      if (!state.tripStarted) return;
      state.workedMins += 1;
      state.sinceRestMins += 1;
      state.weekWorkedMins += 1;
      renderBfm();
      renderAlerts();
    }, 60000);
  }
})();