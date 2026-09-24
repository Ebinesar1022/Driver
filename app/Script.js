/* ==========================================================================
   Skyway Logistics — Driver Dashboard
   Zoho Creator widget controller.

   Structure:
     - Field/report name maps + helpers
     - View routing (dashboard, vehicle check, start trip, trip page,
       hub check-in / POD, fuel, incident, break, etc.)
     - START TRIP PAGE section — prefill + save to "Start_Trip_in_Driver"
     - LOGGED-IN DRIVER RESOLUTION — resolveEmployeeFormId()
     - HUB CHECK-IN / CHECK-OUT section — dropdown + save
     - Zoho Creator DATA/UTIL bridge (getRecords/addRecords/updateRecords)
     - boot() — DOMContentLoaded entry point, wires every button/listener

   CORRECTED BUILD — Hub filtering, Trip→Booking mapping and selected-hub
   POD item/quantity mapping were rewritten against the real Zoho Creator
   schema (see the "HUB / BOOKING / POD RESOLUTION" section further down
   for the full list of what was wrong and why). Everything else in this
   file is byte-for-byte the same as before.

   BFM MAINTENANCE PATCH — fatigue-monitoring tier tracking is local-only
   (the BFM_Monitoring form/report does not exist in this Zoho Creator
   app, so nothing BFM-related is persisted server-side; only
   Driver_BFM_Notification event logging still writes to Zoho).

   IPHONE / CROSS-DEVICE FIX (this build) — all Zoho Creator API calls
   now run sequentially (awaited one at a time) instead of in parallel
   via Promise.all, which was unreliable on iPhone.
   ========================================================================== */
!(function () {
  "use strict";
  var e = {
      trips: "All_Trips",
      duty: "All_Duty_Logs",
      alerts: "All_Alerts",
      /* Confirmed against live traffic: "Drivers" 400s every time; "Driver"
         (singular) is the report that actually exists in this app. */
      employees: "Driver",
      employeesFallbacks: ["Drivers"],
      locations: "Locations2",
      locationsFallbacks: ["Locations", "All_Locations"],
      expenseTypes: "All_Expense_Types",
      expenseTypesFallbacks: [
        "All_Expense_Type",
        "Expense_Type",
        "Expense_Types",
      ],
    },
    t = ["Hub_Name", "Name"],
    r = "Email",
    n = null,
    i = {
      id: ["Driver_ID", "Driver_ID", "DriverID", "Driver_Id", "Employee_ID"],
      email: [r, "Email", "Email_Address", "Driver_Email", "Login_Email"],
      name: ["Name", "Name", "Driver_Name", "Full_Name"],
      gender: ["Gender", "Gender", "Sex"],
      mobile: [
        "Mobile_Number",
        "Mobile_Number",
        "Mobile_No",
        "Mobile",
        "Phone_No",
        "Phone",
      ],
      altMobile: [
        "Al",
        "Al",
        "Alternative_Mobile",
        "Alternate_Mobile_No",
        "Alt_Mobile_No",
      ],
      dob: ["Date_of_Birth", "Date_of_Birth", "DOB", "Birth_Date"],
      photo: [
        "Profile_Picture",
        "Profile Picture",
        "Profile_Photo",
        "Photo",
        "Driver_Photo",
        "Employee_Photo",
        "Driver_Image",
        "Employee_Image",
        "Image",
        "Upload_Photo",
        "Photo_Upload",
        "Avatar",
        "Picture",
        "Driver_Picture",
      ],
      address: ["Address", "Address"],
      employmentType: ["Employment_Type", "Employment_Type", "Employee_Type"],
      joiningDate: ["Joining_Date", "Joining_Date", "Date_of_Joining", "DOJ"],
      department: ["Department", "Department", "Dept"],
      designation: ["Designation", "Designation", "Job_Title", "Role"],
      licenceNo: ["Licence_NO", "Licence_NO", "Licence_No", "License_No"],
      licenceNumber: ["Licence_Number", "Licence_Number", "License_Number"],
      licenceIssueDate: [
        "Licence_Issue_Date",
        "Licence_Issue_Date",
        "License_Issue_Date",
      ],
      licenceType: ["Licence_Type", "Licence_Type", "License_Type"],
      licenceClass: ["Licence_Class", "Licence_Class", "License_Class"],
      licenceExpiry: [
        "Licence_Expiry_Date",
        "Licence_Expiry_Date",
        "License_Expiry_Date",
      ],
      licenceStatus: ["Licence_Status", "Licence_Status", "License_Status"],
      licenceDocument: [
        "Licence_Document",
        "Licence_Document",
        "License_Document",
      ],
      licenceCopy: ["Licence_Copy", "Licence_Copy", "License_Copy"],
      vehicleName: [
        "Vehicle_Name",
        "Vehicle_Name",
        "Vehicle_Type",
        "Vehicle_Registration_No",
      ],
      passportNumber: ["Passport_Number", "Passport_Number"],
      passportCopy: ["Passport_Copy", "Passport_Copy"],
      identityDocType: [
        "Identity_Document_Type",
        "Identity_Document_Type",
        "ID_Type",
        "Identity_Type",
      ],
      identityDocNumber: [
        "Identity_Document_Number",
        "Identity_Document_Number",
        "ID_Number",
        "Identity_Number",
      ],
      experience: [
        "Experience_Years",
        "Experience_Years",
        "Driving_Experience",
        "Experience",
      ],
      heavyVehicleExperience: [
        "Heavy_Vehicle_Experience",
        "Heavy_Vehicle_Experience",
        "HV_Experience",
      ],
      lastCheckupDate: [
        "Last_Checkup_Date",
        "Last_Checkup_Date",
        "Last_Medical_Checkup_Date",
      ],
      medicalFitnessStatus: [
        "Medical_Fitness_Status",
        "Medical_Fitness_Status",
        "Fitness_Status",
      ],
      medicalCertExpiry: [
        "Medical_Certificate_Expiry_Date",
        "Medical_Certificate_Expiry_Date",
        "Medical_Expiry_Date",
      ],
      fatigueModule: ["Fatigue_Module", "Fatigue_Module", "BFM_Module"],
      documents: ["Documents", "Documents"],
      remark: ["Remark", "Remark", "Remarks"],
      visaStatus: [
        "Visa_Right_to_Work_Status",
        "Visa_Right_to_Work_Status",
        "Visa_Status",
      ],
      visaExpiryDate: [
        "Visa_Expiry_Date",
        "Visa_Expiry_Date",
        "Visa_Work_Permit_Expiry_Date",
      ],
      expiryDate: ["Expiry_Date", "Expiry_Date"],
      medicalCertificate: ["Medical_Certificate", "Medical_Certificate"],
      rightToWorkDocument: ["Right_to_Work_Document", "Right_to_Work_Document"],
      identityDocumentCopy: [
        "Identity_Document_Copy",
        "Identity_Document_Copy",
      ],
    },
    a = {
      module: "Standard BFM",
      /* Exact rule table supplied by the customer. Each tier is an
         independent "clock": work accumulates against maxWorkMins since
         the last rest that satisfied that tier's own restMins, and once
         maxWorkMins is reached that tier is in breach until a qualifying
         rest is logged. A rest of length restMins also satisfies every
         other tier whose own restMins is <= that length (e.g. a 60 min
         break resets the 6¼hr/6hr, 9hr/8½hr AND 12hr/11hr tiers, but not
         the 24hr/14hr tier, which needs the full 7hr continuous
         stationary rest). No weekly/rolling-7-day rule is included here
         since it isn't part of the supplied table. */
      tiers: [
        {
          key: "t0",
          label: "20 Minute",
          windowMins: 20,
          maxWorkMins: 15,
          restMins: 5,
          restLabel: "5 min rest",
        },
        {
          key: "t1",
          label: "6¼ Hour",
          windowMins: 375,
          maxWorkMins: 360,
          restMins: 15,
          restLabel: "15 min continuous rest",
        },
        {
          key: "t2",
          label: "9 Hour",
          windowMins: 540,
          maxWorkMins: 510,
          restMins: 30,
          restLabel: "30 min rest",
        },
        {
          key: "t3",
          label: "12 Hour",
          windowMins: 720,
          maxWorkMins: 660,
          restMins: 60,
          restLabel: "60 min rest",
        },
        {
          key: "t4",
          label: "24 Hour",
          windowMins: 1440,
          maxWorkMins: 840,
          restMins: 420,
          restLabel: "7 hr continuous stationary rest",
        },
      ],
      /* Legacy aliases kept so the rest of the app (Log-a-break page,
         estimated end-time calc, BFM_Monitoring persistence, etc.) that
         reads a.maxWorkPerShift / a.restBlock / a.minRestPerShift /
         a.maxContinuousWork keeps working unchanged — they now simply
         mirror the matching tier from the table above instead of being
         separately hardcoded. */
      get maxContinuousWork() {
        return this.tiers[0].maxWorkMins;
      },
      get restBlock() {
        return this.tiers[0].restMins;
      },
      get maxWorkPerShift() {
        return this.tiers[4].maxWorkMins;
      },
      get minRestPerShift() {
        return this.tiers[4].restMins;
      },
      maxWorkPerWeek: 4320,
      warnBefore: 30,
      /* Score deducted per full 15 minutes a tier is driven while already
         in breach (over its maxWorkMins with no qualifying rest yet), and
         per instance of resuming from a break that was shorter than the
         rest an owing tier required. */
      scorePerOverageBlock: 1,
      overageBlockMins: 15,
      scorePerShortRest: 5,
      /* Other Driver Score deductions (all tunable here). The score is
         100 minus every deduction from the last scoreWindowDays days. */
      scorePerAccident: 10,
      scorePerPartialDelivery: 2,
      scorePerCancelledDelivery: 3,
      scoreWindowDays: 30,
      /* BFM rest notification: warn this many minutes before the required
         rest period ends ("Your rest time will be completed in 2 minutes."). */
      restWarnMins: 2,
      source: "Default BFM values",
    },
    o = {
      view: "dash",
      tripStarted: !1,
      startTime: "06:30",
      /* Full local timestamp used by the trip timer and restore flow. */
      startTs: 0,
      startTripRecordId: null,
      activeTripRecordId: null,
      /* Trip finished this session: ke() must never resume it, even if
         Creator is slow to flip its Trip_Status. */
      completedTripRecordId: null,
      restoredTrip: !1,
      /* One toast queued during restore, shown once the boot loader is gone. */
      pendingToast: "",
      endTime: "16:35",
      /* tierWorked[i] = minutes worked since tier i last had a qualifying
         rest; tierExtraMins[i] = minutes logged while tier i was in
         breach (for history/score); tierNotified[i] = whether the
         "rest required" alert has already fired for the tier's *current*
         breach (re-armed once the tier is reset by a qualifying rest). */
      tierWorked: [0, 0, 0, 0, 0],
      tierExtraMins: [0, 0, 0, 0, 0],
      tierNotified: [!1, !1, !1, !1, !1],
      /* Only one BFM rule is active at a time. A qualifying rest advances
         this cursor; after the final rule it wraps to the first rule. */
      activeBfmRuleIndex: 0,
      /* tierWarned[i] = whether the "rest due soon" alert (fired BEFORE a
         tier actually breaches, once its remaining work time drops to
         a.warnBefore minutes or less) has already fired for the tier's
         *current* work period. Re-armed once that tier is reset by a
         qualifying rest, same as tierNotified. This only fires while the
         driver is actively driving (see bfmTick()) — never while onBreak,
         so it never re-fires after the driver has already stopped the
         timer to take the rest it was warning about. */
      tierWarned: [!1, !1, !1, !1, !1],
      breakElapsedMins: 0,
      /* Rest-complete auto-notification (Issue #4): restTargetMins is the
         rest duration owed for the current break (set when the break
         starts — see G()); restCompleteNotified guards against firing the
         "rest hours complete" alert/email more than once per break. */
      restTargetMins: 0,
      restCompleteNotified: !1,
      restResolved: !1,
      /* Rule satisfied by the current break. Persisting it prevents a
         completed rest from being resolved again after a widget reload. */
      completedRestRuleIndex: null,
      /* 2-minutes-before-rest-ends warning: fired once per break;
         breakStartTs is the real start time of the current break. */
      restWarnNotified: !1,
      breakStartTs: 0,
      bfmDayKey: null,
      restAlertShown: !1,
      restEscalated: !1,
      notificationCount: 0,
      onBreak: !1,
      breakCount: 0,
      get workedMins() {
        return this.tierWorked[4];
      },
      set workedMins(v) {
        this.tierWorked[4] = v;
      },
      get sinceRestMins() {
        return this.tierWorked[0];
      },
      set sinceRestMins(v) {
        this.tierWorked[0] = v;
      },
      weekWorkedMins: 2460,
      restTakenMins: 45,
    },
    s = {
      id: "—",
      name: "Loading…",
      score: 100,
      recordId: null,
      email: "",
      mobile: "",
      altMobile: "",
      photoUrl: "",
      depot: "",
      supervisor: "",
      gender: "",
      dob: "",
      address: "",
      licenceClass: "",
      licenceType: "",
      licenceNo: "",
      licenceNumber: "",
      licenceIssueDate: "",
      licenceExpiry: "",
      licenceStatus: "",
      licenceDocumentPath: "",
      licenceCopyPath: "",
      started: "",
      employmentType: "",
      department: "",
      designation: "",
      vehicleName: "",
      vehicleAssigned: "",
      passportNumber: "",
      passportCopyPath: "",
      identityDocType: "",
      identityDocNumber: "",
      experience: "",
      heavyVehicleExperience: "",
      lastCheckupDate: "",
      medicalFitnessStatus: "",
      medicalCertExpiry: "",
      fatigueModule: "",
      documentsPath: "",
      remark: "",
      visaStatus: "",
      visaExpiryDate: "",
      expiryDate: "",
      medicalCertificatePath: "",
      rightToWorkDocumentPath: "",
      identityDocumentCopyPath: "",
      bfmAccreditation: "",
      route: "",
      loaded: !1,
    },
    c = {
      hub: "",
      date: "",
      inTime: "",
      outTime: "",
      /* Selected Booking IDs for this Hub Check-In/Check-Out, as
         [{id, label}, ...]. Booking_ID moved from a single Lookup to a
         Multi-Select on Trip_Dispatch/Hub_Check_in_Check_Out1, so a Trip
         can carry more than one Booking and the driver must be able to
         pick which ones this check-in covers. */
      bookingIds: [],
    },
    l = [],
    d = {
      "Melbourne Distribution Hub": [
        {
          id: "P1",
          name: "Pallet — Grocery mixed cartons",
          qty: 12,
        },
        {
          id: "P2",
          name: "Pallet — Chilled dairy",
          qty: 6,
        },
        {
          id: "P3",
          name: "Carton — Beverages",
          qty: 20,
        },
        {
          id: "P4",
          name: "Pallet — Household goods",
          qty: 8,
        },
      ],
      "Sydney Depot": [
        {
          id: "P5",
          name: "Pallet — Grocery mixed cartons",
          qty: 10,
        },
        {
          id: "P6",
          name: "Carton — Personal care",
          qty: 15,
        },
      ],
      "Eastern Creek Hub": [
        {
          id: "P7",
          name: "Pallet — Frozen goods",
          qty: 9,
        },
        {
          id: "P8",
          name: "Carton — Confectionery",
          qty: 18,
        },
      ],
      "Albury Transfer Hub": [
        {
          id: "P9",
          name: "Pallet — Grocery mixed cartons",
          qty: 7,
        },
        {
          id: "P10",
          name: "Carton — Beverages",
          qty: 11,
        },
      ],
      "Goulburn Hub": [
        {
          id: "P11",
          name: "Pallet — Grocery mixed cartons",
          qty: 6,
        },
        {
          id: "P12",
          name: "Carton — Bakery goods",
          qty: 14,
        },
      ],
      "Gundagai Hub": [
        {
          id: "P13",
          name: "Pallet — Chilled dairy",
          qty: 4,
        },
        {
          id: "P14",
          name: "Carton — Beverages",
          qty: 9,
        },
      ],
      "Albury Hub": [
        {
          id: "P15",
          name: "Pallet — Household goods",
          qty: 5,
        },
        {
          id: "P16",
          name: "Carton — Personal care",
          qty: 12,
        },
      ],
      "Seymour Hub": [
        {
          id: "P17",
          name: "Pallet — Grocery mixed cartons",
          qty: 7,
        },
        {
          id: "P18",
          name: "Pallet — Frozen goods",
          qty: 3,
        },
      ],
      "Craigieburn Hub": [
        {
          id: "P19",
          name: "Carton — Confectionery",
          qty: 16,
        },
        {
          id: "P20",
          name: "Pallet — Household goods",
          qty: 5,
        },
      ],
      "Broadmeadows Hub": [
        {
          id: "P21",
          name: "Carton — Beverages",
          qty: 10,
        },
        {
          id: "P22",
          name: "Pallet — Grocery mixed cartons",
          qty: 3,
        },
      ],
    };

  function u(e, t) {
    return (t || document).querySelector(e);
  }

  function m(e, t) {
    return Array.prototype.slice.call((t || document).querySelectorAll(e));
  }

  function p(e) {
    return String(Math.floor(e)).padStart(2, "0");
  }

  function f(e) {
    return p((e = Math.max(0, Math.round(e))) / 60) + ":" + p(e % 60);
  }
  var h = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  function v(e) {
    return (
      p(e.getDate()) +
      "-" +
      h[e.getMonth()] +
      "-" +
      e.getFullYear() +
      " " +
      p(e.getHours()) +
      ":" +
      p(e.getMinutes()) +
      ":" +
      p(e.getSeconds())
    );
  }

  function y(e) {
    if (!e) return "";
    var t = e.split("-");
    if (3 !== t.length) return e;
    var r = Number(t[0]),
      n = Number(t[1]) - 1,
      i = Number(t[2]);
    return r && !isNaN(n) && i ? p(i) + "-" + h[n] + "-" + r : e;
  }

  function g(e) {
    if (!e) return "";
    /* iOS Safari fix: Zoho Creator returns dates/timestamps as
       "DD-Mon-YYYY" or "DD-Mon-YYYY HH:mm:ss" (e.g. "12-Sep-2026
       14:35:00"), which is not a format the Date constructor is
       required to parse. Chrome/V8 (desktop + Android) parses it
       leniently anyway, but Safari's WebKit engine does not and
       returns Invalid Date — which is why dates/times silently went
       blank only on iPhone. me() (defined below) already has the
       correct Safari-safe fallback parser for exactly this format, so
       route through it here instead of calling `new Date(e)` directly. */
    var ts = me(e);
    if (!ts) return "";
    var t = new Date(ts);
    return isNaN(t.getTime()) ? "" : v(t);
  }

  function b(e) {
    if (!e) return "";
    var t = e.split(":");
    return (
      p(Number(t[0]) || 0) +
      ":" +
      p(Number(t[1]) || 0) +
      ":" +
      p(Number(t[2]) || 0)
    );
  }

  function _(e) {
    if (!e) return null;
    var t = e.split(":");
    return 60 * Number(t[0]) + Number(t[1]);
  }

  function k() {
    return new Date().toLocaleDateString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function w(e, t) {
    var r = document.getElementById(e);
    r && (r.textContent = t);
  }

  var LOADER_STAGE_TEXT = [
    "Dispatching…",
    "On the move…",
    "Approaching destination…",
    "Delivery successful",
  ];

  function loaderApplyStage(percent) {
    var scene = document.getElementById("pageLoader");
    if (!scene) return;
    var stage = percent < 33.33 ? 0 : percent < 66.66 ? 1 : 2;
    scene.classList.toggle("is-stage-1", stage >= 1);
    scene.classList.toggle("is-stage-2", stage >= 2 && percent < 100);
    scene.classList.toggle("is-stage-3", percent >= 100);
    var stripe = document.getElementById("loaderTrailerStripe");
    stripe &&
      stripe.setAttribute(
        "fill",
        percent < 33.33 ? "#0ea5e9" : percent < 66.66 ? "#a855f7" : "#10b981",
      );
  }

  function loaderApplyNodes(percent) {
    var thresholds = [0, 33.33, 66.66, 100];
    for (var i = 0; i < thresholds.length; i++) {
      var node = document.getElementById("loaderNode" + i);
      if (!node) continue;
      if (percent >= thresholds[i] && percent <= thresholds[i] + 3)
        node.classList.add("is-active");
      else node.classList.remove("is-active");
      if (percent > thresholds[i] + 3 || (100 === percent && i < 3))
        (node.classList.add("is-done"), node.classList.remove("is-active"));
      else if (percent < thresholds[i]) node.classList.remove("is-done");
    }
  }

  function loaderApplyStatusText(percent) {
    var el = document.getElementById("loaderStatusText"),
      txt =
        percent >= 100
          ? LOADER_STAGE_TEXT[3]
          : percent >= 66.66
            ? LOADER_STAGE_TEXT[2]
            : percent >= 33.33
              ? LOADER_STAGE_TEXT[1]
              : LOADER_STAGE_TEXT[0];
    el && el.textContent !== txt && (el.textContent = txt);
  }

  function loaderLaunchConfetti() {
    var fx = document.getElementById("loaderFx");
    if (!fx || fx.childElementCount) return;
    var colors = ["#0ea5e9", "#10b981", "#f59e0b", "#ffffff", "#a855f7"];
    for (var i = 0; i < 40; i++) {
      var span = document.createElement("span");
      span.className = "page-loader__confetti";
      span.style.background = colors[i % colors.length];
      var angle = Math.random() * Math.PI + Math.PI,
        velocity = 50 + Math.random() * 200;
      span.style.setProperty(
        "--cx",
        (Math.cos(angle) * velocity).toFixed(1) + "px",
      );
      span.style.setProperty(
        "--cy",
        (Math.sin(angle) * velocity).toFixed(1) + "px",
      );
      span.style.animationDelay = (Math.random() * 0.2).toFixed(2) + "s";
      fx.appendChild(span);
    }
  }

  function D(e) {
    e = Math.max(0, Math.min(100, Math.round(e)));
    var t = document.getElementById("loaderProgressFill"),
      r = document.getElementById("loaderProgressPct"),
      n = document.getElementById("loaderProgress"),
      truck = document.getElementById("loaderTruck");
    (t && (t.style.width = e + "%"),
      r && (r.textContent = e + "%"),
      n && n.setAttribute("aria-valuenow", String(e)),
      truck && (truck.style.left = e + "%"));
    (loaderApplyStage(e), loaderApplyNodes(e), loaderApplyStatusText(e));
  }
  var T = 900 /* Progress-bar pacing target only — purely cosmetic, how fast the bar animates toward 100% while waiting. L() (below) closes the loader as soon as real data is ready, regardless of where this animation has gotten to. */,
    FAILSAFE_MS = 2e4 /* Hard ceiling so a driver is never stranded on the loader if a fetch hangs. This used to share a variable with T above — when T was cut from 20000 to 900 to stop the loader over-waiting, it accidentally cut THIS failsafe to 900ms too, so the loader was force-closing before real data (e.g. the "Today's trip" list) had arrived. Kept generous and separate from T on purpose: T controls the common case (closes fast via L()), this only matters when something is actually stuck. */,
    C = Date.now(),
    I = !1,
    S = setInterval(function () {
      I || D(Math.min(100, ((Date.now() - C) / T) * 100));
    }, 50);

  function E() {
    if (!I) {
      ((I = !0), clearInterval(S), D(100), loaderLaunchConfetti());
      var e = document.getElementById("pageLoader");
      e && e.classList.add("is-complete");
      setTimeout(function () {
        /* Switch the view FIRST and let the browser actually paint it
           before the loader starts fading out. viewDash has no "hidden"
           attribute in the raw HTML (it's the default visible view from
           page load) while viewTrip does — so if the fade-out (opacity
           transition, not instant) started before this Y() call had been
           painted, it could briefly reveal the dashboard underneath even
           on a driver with an active trip, before snapping to "trip". The
           double rAF guarantees a full paint cycle has happened with the
           correct view already showing before anything becomes visible. */
        try {
          Y(o.restoredTrip || o.tripStarted ? "trip" : "dash");
        } catch (e) {}
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            e &&
              !e.classList.contains("is-hidden") &&
              (e.classList.add("is-hidden"),
              setTimeout(function () {
                e.parentNode && e.remove();
              }, 600));
            o.pendingToast && (R(o.pendingToast), (o.pendingToast = ""));
          });
        });
      }, 80);
    }
  }

  function L() {
    /* No artificial wait: close the instant real trip data is ready. T is
       only a pacing target for the progress-bar animation now — E() forces
       the bar to 100% regardless of how far the interval got. */
    E();
  }

  function R(e) {
    var t = document.createElement("div");
    ((t.textContent = e),
      (t.style.cssText =
        "position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:99;background:#0F2748;color:#fff;padding:12px 18px;border-radius:10px;font-size:13px;font-weight:600;box-shadow:0 10px 28px rgba(15,39,72,.28);max-width:88vw;text-align:center"),
      document.body.appendChild(t),
      setTimeout(function () {
        t.remove();
      }, 2400));
  }

  function x() {
    var activeIndex = Math.max(
        0,
        Math.min(a.tiers.length - 1, Number(o.activeBfmRuleIndex) || 0),
      ),
      tiers = a.tiers.map(function (tier, i) {
        var used = o.tierWorked[i],
          left = tier.maxWorkMins - used,
          breached = used >= tier.maxWorkMins,
          isActive = i === activeIndex,
          status = !isActive
            ? "pending"
            : breached
              ? "breach"
              : left <= a.warnBefore
                ? "warn"
                : "ok";
        return {
          index: i,
          key: tier.key,
          label: tier.label,
          used: used,
          max: tier.maxWorkMins,
          left: left,
          restMins: tier.restMins,
          restLabel: tier.restLabel,
          breached: isActive && breached,
          status: status,
          note: isActive
            ? "Rest required: " + tier.restLabel
            : "Pending next work period",
        };
      }),
      breachedTiers = tiers.filter(function (t) {
        return t.breached;
      }),
      warnTiers = tiers.filter(function (t) {
        return "warn" === t.status;
      }),
      overall = breachedTiers.length
        ? "breach"
        : warnTiers.length
          ? "warn"
          : "ok",
      /* The soonest tier to breach drives the countdown shown in the hero
         (or, once something is already breached, the largest outstanding
         rest requirement among breached tiers). */
      soonest = tiers[activeIndex],
      restRequired = breachedTiers.length
        ? Math.max.apply(
            null,
            breachedTiers.map(function (t) {
              return t.restMins;
            }),
          )
        : 0,
      restReason = breachedTiers.length
        ? breachedTiers
            .map(function (t) {
              return t.label + " limit reached";
            })
            .join(" · ") + " — rest required before driving on."
        : "";
    return {
      status: overall,
      untilRest: soonest ? soonest.left : 0,
      restRequired: restRequired,
      restReason: restReason,
      breachedTiers: breachedTiers,
      shiftLeft: soonest.left,
      weekLeft: a.maxWorkPerWeek - o.weekWorkedMins,
      rules: tiers,
    };
  }

  function A(e, t) {
    var r = document.getElementById(e);
    r &&
      (r.innerHTML = t.rules
        .map(function (e) {
          var t = Math.min(100, (e.used / e.max) * 100),
            r =
              "breach" === e.status
                ? "red"
                : "warn" === e.status
                  ? "amber"
                  : "green";
          return (
            '<div class="bfm__rule bfm__rule--' +
            e.status +
            '"><span>' +
            e.label +
            " work <b>" +
            f(e.used) +
            " / " +
            f(e.max) +
            '</b></span><div class="bar"><i class="' +
            r +
            '" style="width:' +
            t +
            '%"></i></div><em>' +
            e.note +
            "</em></div>"
          );
        })
        .join(""));
  }

  function P() {
    var e = x(),
      t = {
        ok: "Compliant",
        warn: "Rest due soon",
        breach: "Rest required now",
      }[e.status],
      r = {
        ok: "Working within your configured BFM limits.",
        warn: "Plan to pull over — a rest block is due shortly.",
        breach:
          "You have reached a configured limit. Stop and rest before driving on.",
      }[e.status],
      n = u("#bfmHero");
    (n && (n.className = "bfm__hero bfm-" + e.status),
      w("bfmState", t),
      w("bfmStateSub", r),
      w("bfmCountdown", e.untilRest > 0 ? f(e.untilRest) : f(e.restRequired)),
      w("bfmCountLabel", e.untilRest > 0 ? "Until rest due" : "Rest required"),
      A("bfmRules", e));
    var i = u("#bfmRest");
    (i &&
      ((i.className = "bfm__rest " + e.status),
      w(
        "bfmRestText",
        e.restRequired
          ? e.restReason + " Required rest: " + f(e.restRequired) + "."
          : "No rest owing right now. Next rest block due in " +
              f(e.untilRest) +
              ".",
      )),
      w(
        "bfmMeta",
        a.module +
          " · " +
          a.tiers.length +
          "-tier Standard BFM table · warn threshold " +
          a.warnBefore +
          " min",
      ),
      w("bfmSource", a.source),
      w("panelBfmModule", a.module));
    var c = u("#tripBfmHero");
    (c && (c.className = "bfm__hero bfm-" + e.status),
      w("tripBfmState", t),
      w("tripBfmStateSub", r),
      w(
        "tripBfmCountdown",
        e.untilRest > 0 ? f(e.untilRest) : f(e.restRequired),
      ),
      w("tripBfmSrc", a.source),
      A("tripBfmRules", e));
    var l = u("#tripBfmRest");
    (l &&
      ((l.className = "bfm__rest " + e.status),
      w(
        "tripBfmRestText",
        e.restRequired
          ? e.restReason + " Required rest: " + f(e.restRequired) + "."
          : "No rest owing right now. Next rest block due in " +
              f(e.untilRest) +
              ".",
      )),
      w("tripBfm", t.toUpperCase()),
      w(
        "tripBfmSub",
        e.untilRest > 0
          ? "Rest due in " + f(e.untilRest)
          : "Rest " + f(e.restRequired) + " required",
      ),
      w("kpiDuty", f(o.workedMins)),
      w("kpiDutySub", f(Math.max(0, e.shiftLeft)) + " left"),
      w("tripDriving", f(o.workedMins)),
      updateRestStamp());
    /* Fire the "rest required" alert once per tier per breach — re-armed
       automatically once that tier is reset by a qualifying rest (see
       resolveRestOnResume()). Each newly-breached tier also opens/updates
       its BFM_Monitoring history row via persistBfmTierEvent(). */
    return (
      e.breachedTiers.forEach(function (tier) {
        if (!o.tierNotified[tier.index]) {
          o.tierNotified[tier.index] = !0;
          var msg =
            tier.label +
            " work limit reached (" +
            f(tier.max) +
            ") — stop and take " +
            tier.restLabel +
            " before driving on.";
          (pushBfmNotification("red", msg),
            persistBfmTierEvent(tier.index, "Limit reached", 0, 0, msg));
          var toast = document.createElement("div");
          ((toast.className = "rest-alert"),
            toast.setAttribute("role", "alert"),
            (toast.innerHTML =
              '<svg width="20" height="20" style="flex:none;color:#D3352B;margin-top:1px"><use href="#i-alert"/></svg><div style=\'flex:1\'><b>Rest required — ' +
              tier.label +
              "</b><p>" +
              msg +
              '</p></div><button class="xbtn" aria-label="Dismiss">✕</button>'),
            toast
              .querySelector("button")
              .addEventListener("click", function () {
                toast.remove();
              }),
            document.body.appendChild(toast),
            setTimeout(function () {
              toast.parentNode && toast.remove();
            }, 15e3));
        }
      }),
      e
    );
  }
  setTimeout(E, FAILSAFE_MS);

  var N = null;

  function O() {
    try {
      var e = (N =
        N || new (window.AudioContext || window.webkitAudioContext)())
        .currentTime;
      [880, 660].forEach(function (t, r) {
        var n = N.createOscillator(),
          i = N.createGain();
        ((n.type = "sine"),
          n.frequency.setValueAtTime(t, e + 0.16 * r),
          i.gain.setValueAtTime(1e-4, e + 0.16 * r),
          i.gain.exponentialRampToValueAtTime(0.22, e + 0.16 * r + 0.02),
          i.gain.exponentialRampToValueAtTime(1e-4, e + 0.16 * r + 0.15),
          n.connect(i).connect(N.destination),
          n.start(e + 0.16 * r),
          n.stop(e + 0.16 * r + 0.16));
      });
    } catch (e) {}
  }

  function M() {
    o.notificationCount += 1;
    var e = u("#bellDot"),
      t = u("#bellCount");
    (t &&
      ((t.hidden = !1),
      (t.textContent =
        o.notificationCount > 9 ? "9+" : String(o.notificationCount))),
      e && (e.hidden = !0));
  }

  function F() {
    o.notificationCount = 0;
    var e = u("#bellCount");
    e && (e.hidden = !0);
  }
  var Lr = [];

  function pushBfmNotification(tone, text) {
    (Lr.unshift({
      tone: tone,
      text: text,
      ts: new Date(),
    }),
      M(),
      "red" === tone && O(),
      ir());
  }

  /* ============================================================
     REST DURATION NOTIFICATION (Issue #4)
     computeRestTargetMins() picks the rest owed for the break that's
     just starting: the longest restMins among tiers currently in
     breach (a single rest can satisfy several tiers at once — see
     resolveRestOnResume() above), or the shortest tier's rest (5 min)
     as a sensible minimum when nothing is in breach yet.
     ------------------------------------------------------------
     notifyRestComplete() fires the moment breakElapsedMins reaches
     that target: it always raises the in-app alert immediately, and
     also tries to email the logged-in driver via a Zoho Creator
     Custom API (ZOHO.CREATOR.DATA.invokeCustomApi) — sending an email
     has to happen server-side in Zoho (Deluge's sendmail task), a
     browser widget cannot send email on its own. This requires a
     Custom API to exist in the Zoho Creator app; see
     sendRestCompleteEmail() below for the exact contract expected.
     ============================================================ */
  function computeRestTargetMins() {
    var index = Math.max(
      0,
      Math.min(a.tiers.length - 1, Number(o.activeBfmRuleIndex) || 0),
    );
    return a.tiers[index].restMins;
  }

  function sendRestCompleteEmail(message) {
    if (
      !window.ZOHO ||
      !ZOHO.CREATOR ||
      !ZOHO.CREATOR.DATA ||
      !ZOHO.CREATOR.DATA.invokeCustomApi
    )
      return (
        console.warn(
          gr,
          "ZOHO.CREATOR.DATA.invokeCustomApi is unavailable — the rest-complete email was not sent. A browser widget cannot send email directly; it must call a Zoho Creator Custom API whose Deluge script runs a sendmail task.",
        ),
        Promise.resolve()
      );
    /* IMPORTANT: this Custom API ("Rest_Complete_Notification" below)
       must be created in Zoho Creator (Settings → Custom APIs) with a
       Deluge script similar to:
         driverEmail = input.driverEmail;
         driverName  = input.driverName;
         sendmail
         [
           from       :  zoho.adminuserid
           to         :  driverEmail
           subject    :  "Rest Duration Complete"
           message    :  input.message
         ];
       Update the api_name / workspace_name values below to match
       whatever link name is used when the Custom API is created. */
    return ZOHO.CREATOR.DATA.invokeCustomApi({
      api_name: "Rest_Complete_Notification",
      http_method: "POST",
      content_type: "application/json",
      data: {
        driverEmail: s.email || "",
        driverName: s.name || "",
        message: message,
      },
    }).catch(function (err) {
      console.error(gr, "Rest-complete email Custom API call failed:", err);
    });
  }

  function notifyRestComplete() {
    var msg = "Your rest time is finished. Please continue the trip and drive.";
    (clearRestWarnTimer(),
      bfmLogAdd("Rest complete", "BFM", msg, 0, "green"),
      pushBfmNotification("green", msg),
      resolveRestOnResume(),
      P(),
      saveTripSnapshot(),
      sendRestCompleteEmail(msg));
  }

  /* ---------- Driver Rest Time stamp ----------
     Shown at the top of the Assigned Trip page (between the trip heading and
     the Trip Summary button) when the driver is on a rest break and has let
     the rest run past the required rest duration. Hides again as soon as the
     driver resumes driving. */
  var REST_STAMP_SRC =
    "data:image/png;base64,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";

  function updateRestStamp() {
    var box = u("#restStamp");
    if (!box) return;
    var target = o.restTargetMins || a.tiers[0].restMins,
      show = !!(o.tripStarted && o.onBreak && o.breakElapsedMins > target);
    if (show) {
      var img = u("#restStampImg");
      img && !img.getAttribute("src") && (img.src = REST_STAMP_SRC || "");
      box.hidden &&
        ((box.hidden = !1),
        box.classList.remove("is-in"),
        void box.offsetWidth,
        box.classList.add("is-in"));
    } else box.hidden || ((box.hidden = !0), box.classList.remove("is-in"));
  }

  /* ---------- NEW: prominent "Rest time has been reached" banner ----------
     Shown at the top of the Assigned Trip page whenever the driver's BFM
     status is "breach" (a tier's max work time has been reached and a
     qualifying rest hasn't been taken yet) — i.e. exactly the moments the
     per-tier "rest required" alert above already fires for. Cleared again
     the moment the driver takes a qualifying rest and the tier(s) reset. */
  /* ---------- NEW: "rest time not reached yet" notification ----------
     Shown at the top of the Assigned Trip page if the driver tries to
     pause/stop the trip timer (i.e. start a break) before any BFM tier
     has actually reached its work limit — since no rest is owed yet,
     the driver is told to keep driving instead. Auto-dismisses itself a
     few seconds later; also hidden immediately if the driver leaves the
     Assigned Trip view or a break legitimately starts. */
  var restNotReachedHideTimer = null;

  function hideRestNotReachedBanner() {
    var box = u("#restNotReachedBanner");
    if (!box) return;
    (restNotReachedHideTimer &&
      (clearTimeout(restNotReachedHideTimer), (restNotReachedHideTimer = null)),
      box.hidden || (box.classList.remove("is-in"), (box.hidden = !0)));
  }

  function showRestNotReachedBanner() {
    var box = u("#restNotReachedBanner");
    if (!box) return;
    restNotReachedHideTimer && clearTimeout(restNotReachedHideTimer);
    ((box.hidden = !1),
      box.classList.remove("is-in"),
      void box.offsetWidth,
      box.classList.add("is-in"),
      (restNotReachedHideTimer = setTimeout(hideRestNotReachedBanner, 6000)));
  }

  function todayAt(h, m) {
    var d = new Date();
    return (d.setHours(h, m, 0, 0), d);
  }

  function relTime(ts) {
    var mins = Math.round((Date.now() - ts.getTime()) / 6e4);
    if (mins < 1) return "Just now";
    if (mins < 60) return mins + " min ago";
    var hrs = Math.round(mins / 60);
    return hrs < 24
      ? hrs + "h ago"
      : p(ts.getDate()) +
          "/" +
          p(ts.getMonth() + 1) +
          " " +
          p(ts.getHours()) +
          ":" +
          p(ts.getMinutes());
  }

  /* ---------- NEW: BFM activity/history logger ----------
     Writes one row per tier event (limit reached, insufficient rest,
     rest satisfied, continuing overage) to Driver_BFM_Notification,
     keyed by Trip_ID + Driver_ID + Date_field so history stays attached
     to the trip/driver and survives the trip spanning multiple days. */
  async function persistBfmTierEvent(
    tierIndex,
    eventType,
    minutes,
    scoreDelta,
    message,
  ) {
    bfmLogAdd(
      eventType,
      a.tiers[tierIndex] ? a.tiers[tierIndex].label : "BFM",
      message,
      scoreDelta,
      "Rest completed" === eventType || "Day rollover" === eventType
        ? "green"
        : "Overage" === eventType ||
            "Insufficient rest" === eventType ||
            "Limit reached" === eventType
          ? "red"
          : "amber",
    );
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA) return;
    try {
      var tier = a.tiers[tierIndex],
        empId = await resolveEmployeeFormId(),
        nowD = new Date(),
        payload = {
          Trip_ID: cr2(K.tripRecordId || K.tripId || ""),
          Trip_Name: cr2(K.tripRecordId || K.tripId || ""),
          Driver_ID: cr2(
            empId ||
              K.driverRecordId ||
              K.driverEmployeeRecordId ||
              s.recordId ||
              "",
          ),
          Driver_Name: cr2(
            empId ||
              K.driverRecordId ||
              K.driverEmployeeRecordId ||
              s.recordId ||
              "",
          ),
          Date_field:
            p(nowD.getDate()) +
            "-" +
            h[nowD.getMonth()] +
            "-" +
            nowD.getFullYear(),
          Start_Time: b(p(nowD.getHours()) + ":" + p(nowD.getMinutes())),
          Break_Hours: +(minutes / 60).toFixed(2),
          Notification:
            "[" +
            (tier ? tier.label : "BFM") +
            " · " +
            eventType +
            "] " +
            message +
            (scoreDelta
              ? " (score " +
                (scoreDelta > 0 ? "-" : "+") +
                Math.abs(scoreDelta) +
                ")"
              : ""),
        };
      await ZOHO.CREATOR.DATA.addRecords({
        form_name: "Driver_BFM_Notification",
        payload: {
          data: payload,
        },
      });
    } catch (err) {
      console.error(gr, "persistBfmTierEvent failed:", err);
    }
  }

  /* ---------- NEW: resolves rest taken against every owing tier ----------
     Called the moment the driver resumes driving. A rest of restMinsTaken
     satisfies (and resets) every tier whose own restMins requirement is
     <= restMinsTaken — so a single long rest can clear several tiers at
     once, exactly as the table implies (e.g. the 7hr continuous
     stationary rest clears all four). Tiers that were in breach but
     didn't get enough rest stay in breach, get their shortfall logged,
     and take an immediate score penalty; they'll keep accumulating
     "overage" penalties every 15 min the driver keeps working per the
     tick in boot(). */
  function resolveRestOnResume() {
    if (
      o.restResolved ||
      null != o.completedRestRuleIndex ||
      (!o.onBreak && !o.breakElapsedMins && !o.restTargetMins)
    )
      return;
    var restMinsTaken = o.breakElapsedMins;
    bfmLogAdd(
      "Break ended",
      "BFM",
      "Break ended after " + f(restMinsTaken) + " of rest.",
      0,
      "green",
    );
    var i = Math.max(
        0,
        Math.min(a.tiers.length - 1, Number(o.activeBfmRuleIndex) || 0),
      ),
      tier = a.tiers[i],
      wasBreached = o.tierWorked[i] >= tier.maxWorkMins;
    if (restMinsTaken >= tier.restMins) {
      ((o.tierWorked[i] = 0),
        (o.tierExtraMins[i] = 0),
        (o.tierNotified[i] = !1),
        (o.tierWarned[i] = !1),
        (o.restResolved = !0),
        (o.completedRestRuleIndex = i),
        wasBreached &&
          persistBfmTierEvent(
            i,
            "Rest completed",
            restMinsTaken,
            0,
            tier.label +
              " satisfied — " +
              f(restMinsTaken) +
              " rest logged (required " +
              tier.restLabel +
              ").",
          ),
        (o.activeBfmRuleIndex = (i + 1) % a.tiers.length),
        bfmLogAdd(
          "BFM rule advanced",
          tier.label,
          "Moving to " +
            a.tiers[o.activeBfmRuleIndex].label +
            " for the next work period.",
          0,
          "green",
        ));
    } else if (wasBreached) {
      var shortfallMins = tier.restMins - restMinsTaken;
      (scoreAdd(
        "fatigue",
        a.scorePerShortRest,
        tier.label +
          ": rest short by " +
          f(shortfallMins) +
          " (" +
          tier.restLabel +
          " required)",
      ),
        pushBfmNotification(
          "red",
          tier.label +
            ": rest taken was short by " +
            f(shortfallMins) +
            " — driver score reduced by " +
            a.scorePerShortRest +
            ".",
        ),
        persistBfmTierEvent(
          i,
          "Insufficient rest",
          restMinsTaken,
          a.scorePerShortRest,
          tier.label +
            " required " +
            tier.restLabel +
            " but only " +
            f(restMinsTaken) +
            " was taken (short by " +
            f(shortfallMins) +
            ").",
        ));
    }
    ((o.breakElapsedMins = 0), (o.restTargetMins = 0));
  }

  /* ---------- NEW: multi-day BFM cycling ----------
     bfmDateKey() gives the calendar-day key used everywhere Date_field
     is written (matches the "DD-Mon-YYYY" format already used by
     persistBfmOnPause/Resume). rolloverBfmDay() is what makes the rule
     table "repeat automatically for each day": it closes out the
     previous day's BFM_Monitoring row exactly as it stood, logs a
     rollover event to history, resets all four tiers back to zero so
     the new day starts its own fresh 6¼/9/12/24-hour cycle, and opens a
     new BFM_Monitoring row dated today — all without touching
     o.tripStarted, so monitoring simply keeps going, day after day,
     until the driver ends the trip. */
  function bfmDateKey(d) {
    return p(d.getDate()) + "-" + h[d.getMonth()] + "-" + d.getFullYear();
  }

  async function rolloverBfmDay() {
    /* Snapshot exactly how the previous day ended BEFORE anything is reset,
       so the new day's BFM cycle — and the BFM Logs entry recording the
       rollover — correctly reflect the previous day's end time and state
       (still driving vs. already resting, and how much work/rest each tier
       had logged) rather than silently discarding it. */
    var prevDayKey = o.bfmDayKey,
      prevEndedAt = new Date(),
      prevEndedAtLabel =
        p(prevEndedAt.getHours()) + ":" + p(prevEndedAt.getMinutes()),
      prevWasOnBreak = !!o.onBreak,
      prevTierSummary = a.tiers
        .map(function (tier, i) {
          return tier.label + ": " + f(o.tierWorked[i] || 0) + " worked";
        })
        .join(", ");
    await persistBfmOnPause();
    var newDayKey = bfmDateKey(new Date()),
      msg =
        "Day " +
        (prevDayKey || "—") +
        " ended at " +
        prevEndedAtLabel +
        " (" +
        (prevWasOnBreak ? "driver was resting" : "driver was driving") +
        " — " +
        prevTierSummary +
        "). New day (" +
        newDayKey +
        ") started for this trip — BFM monitoring continues from the active work/rest period.";
    /* Midnight creates a new monitoring record, but never restarts the
       rule cycle. Work/rest counters and the active rule remain tied to
       the driver's actual timestamps until a qualifying rest advances it. */
    ((o.bfmDayKey = newDayKey),
      pushBfmNotification("green", msg),
      persistBfmTierEvent(null, "Day rollover", 0, 0, msg),
      await openBfmDayRecord());
  }

  /* ---------- NEW: the once-a-minute BFM heartbeat ----------
     Runs continuously for the whole trip (this is what makes BFM
     tracking span multiple days — it just keeps ticking as long as
     o.tripStarted is true). The very first thing it checks is whether
     the calendar day has changed since the tiers were last reset; if
     so it rolls the BFM cycle over to the new day (see
     rolloverBfmDay() above) before doing anything else, so every new
     day from Trip Start Date through to Trip End Date begins its own
     applicable work/rest monitoring automatically.
     - Driving (tripStarted && !onBreak): every tier's tierWorked ticks
       up by 1. Any tier already in breach also ticks its tierExtraMins
       up by 1, and every full overageBlockMins (15) minutes of continued
       driving in breach costs scorePerOverageBlock points — this is the
       "extra time beyond the limit" penalty from the brief.
     - Resting (onBreak): breakElapsedMins ticks up by 1 so
       resolveRestOnResume() can tell how much rest was actually taken
       once the driver resumes. */
  function bfmTick() {
    if (o.tripStarted) {
      var tickNow = Date.now(),
        elapsedMins = o.bfmLastTickTs
          ? Math.max(1, Math.floor((tickNow - o.bfmLastTickTs) / 6e4))
          : 1;
      o.bfmLastTickTs = tickNow;
      var todayKey = bfmDateKey(new Date());
      if (o.bfmDayKey && o.bfmDayKey !== todayKey)
        return void rolloverBfmDay().then(function () {
          (P(), ir());
        });
      if (o.onBreak) {
        o.breakElapsedMins += elapsedMins;
        var restTarget = o.restTargetMins;
        restTarget &&
          !o.restCompleteNotified &&
          o.breakElapsedMins >= restTarget &&
          ((o.restCompleteNotified = !0), notifyRestComplete());
      } else {
        var i = Math.max(
            0,
            Math.min(a.tiers.length - 1, Number(o.activeBfmRuleIndex) || 0),
          ),
          tier = a.tiers[i];
        for (var elapsedStep = 0; elapsedStep < elapsedMins; elapsedStep++) {
          o.tierWorked[i] += 1;
          if (o.tierWorked[i] > tier.maxWorkMins) {
            o.tierExtraMins[i] += 1;
            if (0 === o.tierExtraMins[i] % a.overageBlockMins) {
              scoreAdd(
                "fatigue",
                a.scorePerOverageBlock,
                tier.label +
                  ": " +
                  f(o.tierExtraMins[i]) +
                  " driven past the limit",
              );
              var msg =
                tier.label +
                ": " +
                f(o.tierExtraMins[i]) +
                " driven past the limit with no qualifying rest — score reduced by " +
                a.scorePerOverageBlock +
                ".";
              (pushBfmNotification("red", msg),
                persistBfmTierEvent(
                  i,
                  "Overage",
                  o.tierExtraMins[i],
                  a.scorePerOverageBlock,
                  msg,
                ));
            }
          } else if (
            !o.tierWarned[i] &&
            tier.maxWorkMins - o.tierWorked[i] <= a.warnBefore
          ) {
            /* BFM PRE-BREACH WARNING (fired BEFORE the driver reaches the
               required break/rest time). Only reachable from this branch,
               which only runs while the driver is actively driving
               (!o.onBreak) — so once the driver stops the timer to take
               the rest, this can never fire again for the same breach
               cycle. Re-armed by resolveRestOnResume()/rolloverBfmDay()
               once the tier is genuinely reset. */
            o.tierWarned[i] = !0;
            var warnMsg =
              tier.label +
              " work limit: " +
              f(tier.maxWorkMins - o.tierWorked[i]) +
              " left before a rest break (" +
              tier.restLabel +
              ") is required.";
            /* Countdown remains visible in the BFM panel; no pre-limit notification or log entry. */
          }
        }
        o.weekWorkedMins += elapsedMins;
      }
    }
    (o.tripStarted && saveTripSnapshot(), P(), ir());
  }

  function B(e) {
    var t = "number" == typeof e ? e : o.startTs || 0,
      r = t ? Math.max(0, Math.floor((Date.now() - t) / 6e4)) : null;
    if (null === r) {
      var n = _(e);
      if (null === n) return;
      var i = new Date();
      ((r = 60 * i.getHours() + i.getMinutes() - n), r < 0 && (r += 1440));
    }
    ((o.tierWorked = a.tiers.map(function (_, i) {
      return i === o.activeBfmRuleIndex ? r : 0;
    })),
      (o.weekWorkedMins += r),
      (o.restAlertShown = !1),
      (o.restEscalated = !1),
      F(),
      P(),
      ir());
  }

  function H() {
    ((o.restAlertShown = !1), (o.restEscalated = !1));
  }
  var V = null;

  function q() {
    if (o.tripStarted && o.startTs) {
      var e = Math.max(0, Math.floor((Date.now() - o.startTs) / 1e3));
      w(
        "tripTimerVal",
        p(Math.floor(e / 3600)) +
          ":" +
          p(Math.floor((e % 3600) / 60)) +
          ":" +
          p(e % 60),
      );
    }
  }

  function W() {
    V || (q(), (V = setInterval(q, 1e3)));
  }

  function tripSnapshotKey() {
    return K && K.tripRecordId && s.recordId
      ? "skyway.trip." + K.tripRecordId + "." + s.recordId
      : "";
  }

  function saveTripSnapshot() {
    if (!o.tripStarted) return;
    var e = tripSnapshotKey();
    if (!e) return;
    try {
      localStorage.setItem(
        e,
        JSON.stringify({
          startTs: o.startTs,
          onBreak: o.onBreak,
          breakStartTs: o.onBreak
            ? o.breakStartTs || Date.now() - 6e4 * (o.breakElapsedMins || 0)
            : 0,
          restWarnNotified: !!o.restWarnNotified,
          breakElapsedMins: o.breakElapsedMins || 0,
          restTargetMins: o.restTargetMins || 0,
          restCompleteNotified: !!o.restCompleteNotified,
          restResolved: !!o.restResolved,
          completedRestRuleIndex:
            null == o.completedRestRuleIndex ? null : o.completedRestRuleIndex,
          tierWorked: o.tierWorked || [],
          tierExtraMins: o.tierExtraMins || [],
          tierNotified: o.tierNotified || [],
          tierWarned: o.tierWarned || [],
          activeBfmRuleIndex: o.activeBfmRuleIndex || 0,
          breakCount: o.breakCount || 0,
          weekWorkedMins: o.weekWorkedMins || 0,
          score: s.score,
          savedAt: Date.now(),
        }),
      );
    } catch (e) {
      console.warn(gr, "trip snapshot could not be saved:", e);
    }
  }

  function readTripSnapshot() {
    var e = tripSnapshotKey();
    if (!e) return null;
    try {
      var t = JSON.parse(localStorage.getItem(e) || "null");
      return t && t.startTs && t.savedAt ? t : null;
    } catch (e) {
      return (console.warn(gr, "trip snapshot could not be read:", e), null);
    }
  }

  function clearTripSnapshot() {
    var e = tripSnapshotKey();
    if (!e) return;
    try {
      localStorage.removeItem(e);
    } catch (e) {
      console.warn(gr, "trip snapshot could not be cleared:", e);
    }
  }

  /* Restores the BFM counters from a localStorage snapshot and fast-forwards
     them across the time the widget was closed (savedAt → now). Needs
     o.startTs already set. Returns the labels of tiers now in breach that
     the snapshot did not already know about. */
  function restoreBfmSnapshot(e) {
    var gap = Math.max(0, Math.floor((Date.now() - e.savedAt) / 6e4)),
      /* No tier can have worked longer than the trip has been running. */
      cap = Math.max(0, Math.floor((Date.now() - o.startTs) / 6e4)),
      num = function (v) {
        return Math.max(0, Number(v) || 0);
      },
      fresh = [];
    ((o.onBreak = !!e.onBreak),
      (o.activeBfmRuleIndex = Math.max(
        0,
        Math.min(a.tiers.length - 1, Math.floor(num(e.activeBfmRuleIndex))),
      )),
      (o.breakElapsedMins = num(e.breakElapsedMins)),
      (o.restTargetMins = num(e.restTargetMins)),
      (o.restCompleteNotified = !!e.restCompleteNotified),
      (o.restResolved = !!e.restResolved),
      (o.completedRestRuleIndex =
        null == e.completedRestRuleIndex
          ? null
          : Math.max(
              0,
              Math.min(
                a.tiers.length - 1,
                Math.floor(num(e.completedRestRuleIndex)),
              ),
            )),
      (o.tierWorked = a.tiers.map(function (t, i) {
        return num(e.tierWorked && e.tierWorked[i]);
      })),
      (o.tierExtraMins = a.tiers.map(function (t, i) {
        return num(e.tierExtraMins && e.tierExtraMins[i]);
      })),
      (o.tierNotified = a.tiers.map(function (t, i) {
        return !!(e.tierNotified && e.tierNotified[i]);
      })),
      (o.tierWarned = a.tiers.map(function (t, i) {
        return !!(e.tierWarned && e.tierWarned[i]);
      })),
      (o.breakCount = num(e.breakCount)),
      (o.weekWorkedMins = num(e.weekWorkedMins)),
      (o.restWarnNotified = !!e.restWarnNotified),
      (o.breakStartTs = o.onBreak
        ? Number(e.breakStartTs) || Date.now() - 6e4 * num(e.breakElapsedMins)
        : 0));
    /* Still on break: the break kept running while the widget was closed. */
    if (o.onBreak)
      ((o.breakElapsedMins += gap),
        o.restTargetMins &&
          o.breakElapsedMins >= o.restTargetMins &&
          (o.restCompleteNotified = !0));
    else
      ((o.tierWorked[o.activeBfmRuleIndex] = Math.min(
        cap,
        o.tierWorked[o.activeBfmRuleIndex] + gap,
      )),
        (o.weekWorkedMins += gap));
    /* Breaches that happened (or were already alerted) before this restore
       must never raise alerts or Creator rows again: mark them notified
       BEFORE the first P() runs. tierExtraMins is deliberately left alone,
       so overage penalties only accrue for minutes counted live from now
       on, not for time that passed while the widget was closed. */
    armRestCompleteTimer();
    var restoredTier = a.tiers[o.activeBfmRuleIndex],
      restoredUsed = o.tierWorked[o.activeBfmRuleIndex];
    (restoredUsed >= restoredTier.maxWorkMins
      ? (o.tierNotified[o.activeBfmRuleIndex] || fresh.push(restoredTier.label),
        (o.tierNotified[o.activeBfmRuleIndex] = !0),
        (o.tierWarned[o.activeBfmRuleIndex] = !0))
      : restoredTier.maxWorkMins - restoredUsed <= a.warnBefore &&
        (o.tierWarned[o.activeBfmRuleIndex] = !0),
      console.log(
        gr,
        "restore: BFM snapshot applied; fast-forwarded",
        gap,
        "min",
        o.onBreak ? "(on break)" : "",
      ));
    return fresh;
  }
  var U = !1;

  function Z() {
    var e = u("#btnStopTimer"),
      t = u("#btnContinueDriving");
    (e && (e.hidden = !!o.onBreak),
      t && (t.hidden = !o.onBreak),
      updateRestStamp());
  }

  /* ---------- NEW: time-field helpers ----------
     Zoho `time` fields come back as "HH:MM:SS" strings, not numbers. */
  function timeStrToMins(t) {
    if (!t) return 0;
    var parts = String(t).split(":");
    var hh = Number(parts[0]) || 0,
      mm = Number(parts[1]) || 0,
      ss = Number(parts[2]) || 0;
    return hh * 60 + mm + ss / 60;
  }

  function minsToTimeStr(mins) {
    mins = Math.max(0, Math.round(mins));
    var hh = Math.floor(mins / 60),
      mm = mins % 60;
    return p(hh) + ":" + p(mm) + ":00";
  }

  /* Tracks the current local work period (in-memory only — the
     BFM_Monitoring form/report no longer exists in this Zoho Creator
     app, so none of this is persisted server-side). */
  var ACTIVE_BFM_RECORD = {
    id: null,
    workMins: 0,
    maxMins: null,
  };

  /* ---------- closes out the open work period on pause/stop ---------- */
  async function persistBfmOnPause() {
    /* BFM_Monitoring form no longer exists in this Zoho Creator app, so
       this only updates the local work-period counters used elsewhere
       in the fatigue-monitoring UI; nothing is persisted to Zoho. */
    var maxMins = ACTIVE_BFM_RECORD.maxMins || a.maxWorkPerShift,
      workMins = o.workedMins;
    ((ACTIVE_BFM_RECORD.workMins = workMins),
      (ACTIVE_BFM_RECORD.maxMins = maxMins));
  }

  /* ---------- NEW: opens a fresh work period on resume ----------
     The just-closed period already has its End_Time saved by
     persistBfmOnPause(); this starts the next one. Also resolves the
     rest just taken against every tier's own requirement (see
     resolveRestOnResume() above) before the new period opens. */
  async function persistBfmOnResume() {
    (resolveRestOnResume(), await openBfmDayRecord());
  }

  /* ---------- opens a fresh local work period for "today" ----------
     Shared by persistBfmOnResume() (after resolving whatever rest was
     just taken) and rolloverBfmDay() (after a plain midnight rollover,
     where there's no rest to resolve — the driver may still be mid-shift
     when the day turns over). Local-only; nothing is persisted to
     Zoho. */
  async function openBfmDayRecord() {
    ((ACTIVE_BFM_RECORD.id = null),
      (ACTIVE_BFM_RECORD.workMins = 0),
      (ACTIVE_BFM_RECORD.maxMins = a.maxWorkPerShift));
  }

  /* Pausing the trip timer to take a break/rest is NOT the end of the
     driver's shift — saveBfmSummary() (the "Work period logged — Xh
     worked (limit Xh). Rest required: Xh." notification) is a shift-END
     summary and must only run once, when the trip is actually completed
     (see the trip-feedback submit handler further down). Previously this
     function called saveBfmSummary() on every single pause, which is why
     that notification fired after only a few minutes of driving; it has
     been removed here so pausing/stopping the timer for a routine BFM
     rest break no longer fires it. */
  function G() {
    if (!o.tripStarted) return;
    /* If the driver stops/pauses the timer before any BFM tier has
       actually reached its required work limit, no rest is owed yet —
       show the "keep driving" notification instead of starting a break. */
    if ("breach" !== x().status) return void showRestNotReachedBanner();
    hideRestNotReachedBanner();
    ((o.onBreak = !0),
      (o.breakElapsedMins = 0),
      (o.restTargetMins = computeRestTargetMins()),
      (o.restCompleteNotified = !1),
      (o.restWarnNotified = !1),
      (o.completedRestRuleIndex = null),
      (o.breakStartTs = Date.now()),
      (o.bfmLastTickTs = Date.now()),
      (o.restResolved = !1),
      armRestCompleteTimer(),
      bfmLogAdd(
        "Break started",
        "BFM",
        "Break started — required rest: " + f(o.restTargetMins) + ".",
        0,
        "amber",
      ),
      W(),
      Z(),
      persistBfmOnPause(),
      saveTripSnapshot());
  }

  function j() {
    o.tripStarted &&
      ((o.onBreak = !1),
      clearRestWarnTimer(),
      (o.breakStartTs = 0),
      (o.bfmLastTickTs = Date.now()),
      W(),
      Z(),
      "trip" !== o.view && Y("trip"),
      persistBfmOnResume(),
      saveTripSnapshot(),
      P(),
      ir());
  }

  window.addEventListener("popstate", function () {
    if (o.tripStarted) {
      R("Complete your trip before leaving this workflow.");
      try {
        history.pushState(
          {
            skywayTripGuard: !0,
          },
          "",
        );
      } catch (e) {}
    }
  });
  var z = [
    "trip",
    "checkin",
    "pod",
    "fuel",
    "incident",
    "vehicleissue",
    "expense",
    "break",
    "tripfeedback",
    "documents",
    "dispatch",
    "podbooking",
    "podresult",
  ];

  function Y(e) {
    var t;
    o.tripStarted && -1 === z.indexOf(e)
      ? R("Complete your trip before leaving this workflow.")
      : (tr(),
        (o.view = e),
        [
          "Dash",
          "Vcheck",
          "StartTrip",
          "Chktyres",
          "Chkbattery",
          "Chkfuel",
          "Chkgps",
          "Chkhealth",
          "Trip",
          "CheckIn",
          "Pod",
          "Fuel",
          "Incident",
          "VehicleIssue",
          "Expense",
          "Break",
          "TripFeedback",
          "Documents",
          "Dispatch",
          "PodBooking",
          "PodResult",
        ].forEach(function (t) {
          var r = document.getElementById("view" + t);
          r && (r.hidden = t.toLowerCase() !== e);
        }),
        window.scrollTo({
          top: 0,
          behavior: "smooth",
        }),
        "trip" === e &&
          (!(function () {
            var e = u("#ringV"),
              t = u("#ringPct");
            if (!e) return;
            var r = 67,
              n = 2 * Math.PI * 50;
            ((e.style.strokeDashoffset = n),
              setTimeout(function () {
                e.style.strokeDashoffset = n * (1 - r / 100);
              }, 200));
            var i = 0,
              a = setInterval(function () {
                ((i += 2) >= r && ((i = r), clearInterval(a)),
                  (t.textContent = i + "%"));
              }, 22);
          })(),
          o.tripStarted && !o.onBreak && W(),
          Z(),
          ee()),
        "starttrip" === e && prefillStartTripPage(),
        "checkin" === e &&
          (function () {
            w("inCheckDate", "");
            var e = u("#inCheckDate");
            e && (e.value = k());
            u("#inHub") && c.hub && (u("#inHub").value = c.hub);
            if (u("#inCheckInTime") && !u("#inCheckInTime").value) {
              var t = new Date();
              u("#inCheckInTime").value =
                p(t.getHours()) + ":" + p(t.getMinutes());
            }
            /* Refresh the hub dropdown every time this page is opened, so a
           trip that finished loading after boot still fills it. */
            (Dr().catch(function (err) {
              console.error(gr, "Dr() (Hub Name dropdown) failed:", err);
            }),
              BOOKING_ID_OPTIONS.length
                ? renderBookingIdChecklist()
                : Fr().catch(function (err) {
                    console.error(
                      gr,
                      "Fr() (Booking ID checklist) failed:",
                      err,
                    );
                  }),
              updateBookingIdChip(),
              updateHubItemCount((u("#inHub") && u("#inHub").value) || ""));
          })(),
        "pod" === e &&
          (function () {
            var hub = c.hub || u("#inHub").value;
            if (
              (updateBookingIdChip(),
              w("podHubTitle", hub ? "POD — " + hub : "POD — no hub selected"),
              w("podHubDate", c.date || k()),
              !hub)
            ) {
              var host = u("#podItemList");
              return void (
                host &&
                (host.innerHTML =
                  '<li class="pod-item pod-item--empty">No hub selected. Go back and check in to a hub first.</li>')
              );
            }
            loadPodItemsForHub(hub);
          })(),
        "dispatch" === e && populateDispatchBookingDropdown(),
        "podbooking" === e && loadPodItemsForDispatchBooking(),
        setTimeout(initPodSignaturePad, 30),
        setTimeout(initPodResultSignaturePad, 30),
        ("vcheck" !== e && 0 !== e.indexOf("chk")) || Ne(),
        "chktyres" === e &&
          (function () {
            try {
              if (!("speechSynthesis" in window)) return;
              var e = window.speechSynthesis;

              function t() {
                var t = new SpeechSynthesisUtterance($e),
                  r = (function (e) {
                    if (!e || !e.length) return null;
                    for (var t = 0; t < rt.length; t++) {
                      var r = e.filter(function (e) {
                        return rt[t].test(e.name);
                      });
                      if (r.length) return r[0];
                    }
                    var n = e.filter(function (e) {
                      return (
                        /female/i.test(e.name) ||
                        /female/i.test(e.voiceURI || "")
                      );
                    });
                    return n.length
                      ? n[0]
                      : e.filter(function (e) {
                          return /^en/i.test(e.lang);
                        })[0] || e[0];
                  })(et);
                (r && (t.voice = r),
                  (t.rate = 0.92),
                  (t.pitch = 1.12),
                  (t.volume = 1),
                  e.cancel(),
                  e.speak(t));
              }
              (((et = e.getVoices()) && et.length) || tt
                ? t()
                : e.addEventListener("voiceschanged", function r() {
                    (e.removeEventListener("voiceschanged", r),
                      (et = e.getVoices()),
                      t());
                  }),
                (tt = !0));
            } catch (r) {}
          })(),
        "trip" === e
          ? (loadTripMapOSM(), rebuildHubPipelineFromBooking())
          : void 0,
        "fuel" === e
          ? (function () {
              var e = u("#inFuelCountry");
              e && !e.value && (e.value = "Australia");
              var t = u("#inFuelTripId");
              t && (t.value = K.tripId || X || "");
              (St(),
                (function () {
                  (It(), Ct && clearInterval(Ct));
                  Ct = setInterval(It, 1e3);
                })());
            })()
          : Ct && (clearInterval(Ct), (Ct = null)),
        "incident" === e &&
          (function () {
            var e = u("#inIncDate");
            e && !e.value && (e.value = Nt());
            var t = u("#inIncTime");
            t && !t.value && (t.value = Ot());
          })(),
        "vehicleissue" === e &&
          (t = u("#inVehWhen")) &&
          !t.value &&
          (t.value = Nt() + "T" + Ot()),
        "expense" === e &&
          (function () {
            var e = u("#inExpDate");
            e && !e.value && (e.value = Nt());
            var tripEl = u("#inExpTripId");
            tripEl && (tripEl.value = K.tripId || X || "—");
            var vehEl = u("#inExpVehicleName");
            (vehEl && (vehEl.value = K.vehicleName || "—"),
              Xr().catch(function (err) {
                console.error(gr, "Xr() (Expense Type dropdown) failed:", err);
              }));
          })(),
        "break" === e &&
          (function () {
            var e = u("#inBrkDate");
            e && (e.value = k());
            var t = u("#inBrkStart");
            t && !t.value && (t.value = Ot());
            var r = u("#inBrkTripName");
            r && (r.value = K.tripName || K.tripId || X || "");
            var n = u("#inBrkTripId");
            n && (n.value = K.tripId || X || "");
            (zt(), br2());
          })(),
        "tripfeedback" === e &&
          (function () {
            var e = u("#inTfbTripId");
            e && (e.value = K.tripId || X || "");
            var t = u("#inTfbTripName");
            t && (t.value = K.tripName || K.tripId || X || "");
          })(),
        "documents" === e && hr(),
        rr());
  }
  var Q = [
      {
        no: 6,
        name: "Goulburn Hub",
        location: "Sooley Drive, Goulburn NSW 2580",
        distance: "212 km",
        eta: "09:40 AM",
        status: "done",
        delivery: [
          ["Consignment", "CN-40216"],
          ["Pallets", "6 of 34"],
          ["Weight", "1,840 kg"],
          ["Received by", "M. Doyle"],
          ["POD", "Signed 09:52"],
        ],
      },
      {
        no: 7,
        name: "Gundagai Hub",
        location: "Sheridan Street, Gundagai NSW 2722",
        distance: "154 km",
        eta: "11:05 AM",
        status: "done",
        delivery: [
          ["Consignment", "CN-40217"],
          ["Pallets", "4 of 34"],
          ["Weight", "1,120 kg"],
          ["Received by", "S. Patel"],
          ["POD", "Signed 11:14"],
        ],
      },
      {
        no: 8,
        name: "Albury Hub",
        location: "Wagga Road, Lavington NSW 2641",
        distance: "118 km",
        eta: "11:58 AM",
        status: "current",
        delivery: [
          ["Consignment", "CN-40218"],
          ["Pallets", "5 of 34"],
          ["Weight", "1,410 kg"],
          ["Received by", "K. Nguyen"],
          ["POD", "Signed 12:06"],
        ],
      },
      {
        no: 9,
        name: "Seymour Hub",
        location: "Emily Street, Seymour VIC 3660",
        distance: "18.4 km",
        eta: "02:15 PM",
        status: "next",
        delivery: [
          ["Consignment", "CN-40219"],
          ["Pallets", "7 of 34"],
          ["Weight", "1,960 kg"],
          ["Contact", "D. Harris · 0413 552 118"],
          ["Window", "2:00 – 3:00 PM"],
        ],
      },
      {
        no: 10,
        name: "Craigieburn Hub",
        location: "Hume Highway, Craigieburn VIC 3064",
        distance: "62 km",
        eta: "03:10 PM",
        status: "upcoming",
        delivery: [
          ["Consignment", "CN-40220"],
          ["Pallets", "5 of 34"],
          ["Weight", "1,380 kg"],
          ["Contact", "L. Romano · 0402 771 640"],
          ["Window", "3:00 – 4:00 PM"],
        ],
      },
      {
        no: 11,
        name: "Broadmeadows Hub",
        location: "Camp Road, Broadmeadows VIC 3047",
        distance: "14 km",
        eta: "03:52 PM",
        status: "upcoming",
        delivery: [
          ["Consignment", "CN-40221"],
          ["Pallets", "3 of 34"],
          ["Weight", "820 kg"],
          ["Contact", "A. Silva · 0455 903 214"],
          ["Window", "3:45 – 4:30 PM"],
        ],
      },
      {
        no: 12,
        name: "Melbourne Distribution Hub",
        location: "Operations Way, Tullamarine VIC 3043",
        distance: "11 km",
        eta: "04:35 PM",
        status: "upcoming",
        delivery: [
          ["Consignment", "CN-40222"],
          ["Pallets", "4 of 34"],
          ["Weight", "1,051 kg"],
          ["Contact", "Control desk · 03 9338 4100"],
          ["Window", "4:15 – 5:00 PM"],
        ],
      },
    ],
    J = Q.findIndex(function (e) {
      return "next" === e.status;
    });
  J < 0 && (J = 0);
  var X = "TR-1048",
    K = {
      tripRecordId: null,
      tripId: "",
      tripName: "",
      vehicleRecordId: null,
      vehicleName: "",
      driverRecordId: null,
      driverId: "",
      driverName: "",
      record: null,
    };

  function $(e) {
    e &&
      ((K.tripRecordId = e.ID || e.id || null),
      (K.tripId = le(e, "tripId") || ""),
      (K.tripName = le(e, "tripName") || ""),
      (K.vehicleRecordId = de(e, "vehicle") || null),
      (K.vehicleName = le(e, "vehicle") || ""),
      (K.driverRecordId = de(e, "primaryDriver") || de(e, "driver") || null),
      (K.driverEmployeeRecordId = s.recordId || null),
      (K.driverId = s.id || ""),
      (K.driverName = s.name || ""),
      (K.record = e),
      K.tripId && (X = K.tripId),
      (o.breakCount = 0),
      br2(),
      console.log(
        gr,
        "driverRecordId resolved to:",
        K.driverRecordId,
        "| driverEmployeeRecordId:",
        K.driverEmployeeRecordId,
        "| driverId (business, e.g. 'DR-101' — never send this into a lookup field):",
        K.driverId,
      ),
      console.log(gr, "Active trip set:", K),
      console.log(
        gr,
        "[booking-debug] raw Booking_ID field on this Trip record:",
        e.Booking_ID,
      ),
      ee(),
      updateBookingIdChip(),
      /* A new trip means a new booking: drop the cached hub set before
         rebuilding the dropdown, or the previous trip's hubs would be
         reused. */
      resetTripHubCache(),
      resetBookingIdSelection(),
      Dr().catch(function (err) {
        console.error(
          gr,
          "Dr() (Hub Name dropdown, trip/booking filtered) failed:",
          err,
        );
      }),
      Fr().catch(function (err) {
        console.error(gr, "Fr() (Booking ID checklist) failed:", err);
      }),
      rebuildHubPipelineFromBooking().catch(function (err) {
        console.error(gr, "rebuildHubPipelineFromBooking() failed:", err);
      }),
      (tripMapState.loadedForTrip = null),
      /* POD Completion KPI (Trip details card) — a new/changed trip means
         a new booking list, so recount for it. */
      refreshPodCompletionKpi());
  }

  /* Trip Summary popup + Driver BFM Log header — real trip-record values only. */
  function updateTripSummaryFields(e) {
    var st = String(le(e, "status") || "").trim();
    (w("tripSumStatus", (st || "In transit").toUpperCase()),
      w("bfmLogTripId", le(e, "tripId") || "—"),
      w("bfmLogTripName", le(e, "tripName") || "—"),
      w("bfmLogTripStatus", st || "—"),
      w("bfmLogStartDate", le(e, "startDateTime") || "—"),
      w("bfmLogCustomer", le(e, "customerCompany") || "—"),
      renderBookingIdCell(u("#bfmLogBookingId"), bookingIdsArray(e)),
      /* Mirror the same values into the "View" popup opened from the
         Driver BFM Log card header, until its final field list is
         confirmed. */
      w("bfmLogViewTripId", le(e, "tripId") || "—"),
      w("bfmLogViewTripName", le(e, "tripName") || "—"),
      renderBookingIdCell(u("#bfmLogViewBookingId"), bookingIdsArray(e)));
    var km = function (v) {
        var n = parseFloat(
          String(null == v ? "" : v)
            .replace(/,/g, "")
            .replace(/[^0-9.]/g, ""),
        );
        return isFinite(n) ? n : null;
      },
      fmt = function (n) {
        return String(Math.round(10 * n) / 10);
      },
      total = km(le(e, "estimatedDistance")),
      done = km(le(e, "actualDistance"));
    (w(
      "tripDistTotal",
      total && total > 0
        ? "Of " + fmt(total) + " km total"
        : "Total distance not set",
    ),
      w(
        "tripDistLeft",
        total && total > 0 && done && done > 0
          ? fmt(Math.max(0, total - done))
          : "—",
      ));
  }

  function ee() {
    var e = K.record;
    if (e) {
      updateTripSummaryFields(e);
      var t = le(e, "tripId") || "—",
        r = tripRoute(e);
      (w("atdHeaderTripId", t),
        w("atdHeaderRoute", r),
        w("atdTripId", t),
        w("atdRoutePill", r),
        w("atdTripName", le(e, "tripName") || "—"),
        w("atdTripType", le(e, "tripType") || "—"),
        w("atdTripStatus", le(e, "status") || "—"),
        w("atdRoute", r),
        w("atdBookingDate", le(e, "bookingDate") || "—"),
        w("atdPlannedDelivery", le(e, "plannedDelivery") || "—"),
        w("atdDeliveryMode", le(e, "deliveryMode") || "—"),
        w("atdVehicle", le(e, "vehicle") || "—"),
        w("atdVehicleCapacity", le(e, "vehicleCapacity") || "—"),
        w("atdSupervisor", le(e, "supervisor") || "—"),
        w("atdPrimaryDriver", le(e, "primaryDriver") || "—"),
        w("atdSecondaryDriver", le(e, "secondaryDriver") || "—"),
        w(
          "atdPickupLocation",
          le(e, "pickupLocation") || le(e, "fromLocation") || "—",
        ),
        w(
          "atdDeliveryLocation",
          le(e, "deliveryLocation") || le(e, "toLocation") || "—",
        ),
        w("atdQuantity", le(e, "quantity") || "—"),
        w("atdWeight", le(e, "weight") || "—"),
        w("atdTrackingNumber", le(e, "trackingNumber") || "—"),
        w("atdFromLocation", le(e, "fromLocation") || "—"),
        w("atdStartDateTime", le(e, "startDateTime") || "—"),
        w("atdEstimatedDistance", le(e, "estimatedDistance") || "—"),
        w("atdTotalLoadedWeight", le(e, "totalLoadedWeight") || "—"),
        w("atdTripCompletion", le(e, "tripCompletion") || "—"),
        w("atdToLocation", le(e, "toLocation") || "—"),
        w("atdTripDuration", le(e, "tripDuration") || "—"),
        /* Mirrors of the 6 fields shown on the trimmed "Trip details" card,
           duplicated under "tfd*" ids so the "View more" popup
           (#panelTripDetailsFull) can show the complete set without id
           collisions with the card. */
        w("tfdTripName", le(e, "tripName") || "—"),
        w("tfdTripType", le(e, "tripType") || "—"),
        w("tfdTripStatus", le(e, "status") || "—"),
        w("tfdRoute", r),
        w(
          "tfdPickupLocation",
          le(e, "pickupLocation") || le(e, "fromLocation") || "—",
        ),
        w(
          "tfdDeliveryLocation",
          le(e, "deliveryLocation") || le(e, "toLocation") || "—",
        ));
    }
  }
  var te = [
      {
        id: "TR-1046",
        route: "Eastern Creek → Goulburn",
        window: "04:10 – 05:55",
        stops: 3,
        status: "Completed",
      },
      {
        id: "TR-1047",
        route: "Goulburn → Gundagai",
        window: "06:00 – 06:25",
        stops: 2,
        status: "Completed",
      },
      {
        id: "TR-1048",
        route: "Sydney → Melbourne",
        window: "06:30 – 16:35",
        stops: 12,
        status: "Active",
      },
      {
        id: "TR-1051",
        route: "Tullamarine → Laverton",
        window: "17:20 – 18:40",
        stops: 2,
        status: "Scheduled",
      },
    ],
    re = {
      attended: 0,
      cancelled: 0,
      get total() {
        return this.attended + this.cancelled;
      },
    };

  function ne(e) {
    return (
      {
        done: "Delivered",
        current: "Current",
        next: "Next",
        upcoming: "Upcoming",
      }[e] || e
    );
  }

  function ie() {
    var e = u("#hubDetail");
    if (e) {
      var t =
          Q.filter(function (e) {
            return "current" === e.status;
          })[0] || Q[0],
        r =
          Q.filter(function (e) {
            return "next" === e.status;
          })[0] || Q[Q.length - 1];
      (w("hubCurrentName", t.name),
        w("hubCurrentMeta", "Departed " + t.eta + " · Stop #" + t.no),
        w("hubNextName", r.name),
        w("hubNextMeta", r.distance + " · ETA " + r.eta));
      var n = u("#hubPipeline"),
        pipelineSig = Q.map(function (e) {
          return e.name;
        }).join("|");
      if (
        (n &&
          n.getAttribute("data-sig") !== pipelineSig &&
          (n.setAttribute("data-sig", pipelineSig),
          (n.innerHTML = ""),
          Q.forEach(function (e, t) {
            var r = document.createElement("button");
            ((r.type = "button"),
              (r.className = "hubpipe__node is-" + e.status),
              r.setAttribute("role", "tab"),
              r.setAttribute("aria-label", "Stop " + e.no + " · " + e.name),
              (r.innerHTML =
                '<span class="hubpipe__dot" aria-hidden="true"></span><span class="hubpipe__label">' +
                e.name +
                "</span>"),
              r.addEventListener("click", function () {
                ((J = t), ie());
              }),
              n.appendChild(r));
          })),
        n)
      ) {
        m(".hubpipe__node", n).forEach(function (e, t) {
          (e.classList.toggle("is-active", t === J),
            e.setAttribute("aria-selected", t === J ? "true" : "false"));
        });
        var i = n.children[J];
        i &&
          i.scrollIntoView({
            behavior: "smooth",
            inline: "center",
            block: "nearest",
          });
      }
      var a = Q[J];
      (w("hubIndexLabel", "Stop " + a.no),
        w("hubTotal", String(Q.length)),
        w("hubBadge", "Stop #" + a.no),
        w("hubName", a.name),
        w("hubLocation", a.location),
        w("hubEta", a.eta));
      var o = u("#hubStatus");
      (o &&
        ((o.textContent = ne(a.status)),
        (o.className = "hubstatus is-" + a.status)),
        e.classList.remove("is-swap"),
        e.offsetWidth,
        e.classList.add("is-swap"));
      var s = u("#hubPrev"),
        c = u("#hubNext");
      (s && (s.disabled = 0 === J),
        c && (c.disabled = J === Q.length - 1),
        w("tripNextStopName", "Stop #" + r.no + " · " + r.name),
        updateStopsCompletedKpi());
    }
  }

  function ae(e) {
    ((J = Math.max(0, Math.min(Q.length - 1, J + e))), ie());
  }

  /* Renders the "Assigned trips" panel (#panelTrips), opened via the
     "View More" button on the Today's trip card. "list" is the
     driver's OTHER assigned trips — he() already excludes today's
     trip and the next upcoming one, since those two are shown on the
     main Today's trip card and must not repeat here. "totalCount" is
     the driver's full assigned-trip count, used only for the summary
     stat. Each row keeps its own "View" button (wired via the
     delegated data-view-trip handler on #tripList). */
  function oe(list, totalCount, todayItem) {
    var trips = (list || []).slice(),
      total = totalCount || trips.length,
      e = u("#tripList");
    if (e) {
      if (((e.innerHTML = ""), trips.length))
        trips.forEach(function (trip) {
          e.appendChild(fe(trip));
        });
      else {
        var empty = document.createElement("li");
        ((empty.className = "triprow"),
          (empty.textContent = "No additional assigned trips."),
          e.appendChild(empty));
      }
    }
    /* "Today" is passed in separately because `trips` (the "other assigned
       trips" list) always excludes today's trip by design — filtering
       `trips` itself for "today" here would always yield 0, which is why
       the Today's Trip value never showed up in this popup before. */
    var todayCount = todayItem ? 1 : 0,
      upcomingCount = trips.length;
    (w("tripsAssigned", String(total)),
      w("tripsDone", String(todayCount)),
      w("tripsLeft", String(upcomingCount)),
      w("tripsDriverName", s.name || "Driver"),
      w(
        "tripsDateLabel",
        trips.length
          ? trips.length + (1 === trips.length ? " more trip" : " more trips")
          : "No more trips",
      ));
    var i = document.querySelector('[data-panel="panelTrips"] [data-fill]');
    i &&
      i.setAttribute(
        "data-fill",
        total ? Math.round((todayCount / total) * 100) : 0,
      );
  }
  var se = "Trip_Dispatch1",
    ce = {
      driverName: ["Driver_Name", "Primary_Driver"],
      driverId: ["Driver_ID", "Driver_Id", "Driver_Code"],
      secondaryDriverName: ["Secondary_Driver"],
      tripId: ["Trip_ID"],
      tripName: ["Trip_Name", "Route"],
      tripType: ["Trip_Type"],
      status: ["Trip_Status"],
      route: ["Route"],
      startDateTime: ["Start_Date_Time"],
      customer: ["Customer"],
      bookingDate: ["Booking_Date"],
      plannedDelivery: ["Planned_Delivery_Date", "Planned_Delivery_Date_Time"],
      vehicle: ["Vehicle"],
      vehicleCapacity: ["Vehicle_Capacity"],
      supervisor: ["Supervisor"],
      primaryDriver: ["Primary_Driver"],
      secondaryDriver: ["Secondary_Driver"],
      deliveryMode: ["Delivery_Mode"],
      vehicleInspectionStatus: ["Vehicle_Inspection_Status"],
      driverComplianceStatus: ["Driver_Compliance_Status"],
      dispatcher: ["Dispatcher"],
      assignedHub: ["Assigned_Hub"],
      /* Trip_Dispatch.Booking_ID is a Multi-Select Lookup (Zoho
         Creator "type = list", values = Booking_Shipments.ID,
         displayformat = [Booking_ID]) — confirmed against the real
         form export — and is the field that links a Trip to its
         Booking(s). One Trip can carry several Bookings, so this
         resolves to an array, not a single value. It must come first
         here.

         "Assigned_Bookings" is deliberately kept AFTER it: on
         Trip_Dispatch that name belongs to a grid pointing at a
         different form (Assigned_Bookings.ID), so it must never win over
         Booking_ID. It stays only as a fallback for older trips. */
      assignedBookings: [
        "Booking_ID",
        "Assigned_Bookings",
        "Bookings",
        "Booking_IDs",
      ],
      fromLocation: ["From_Location"],
      toLocation: ["To_Location"],
      pickupLocation: ["Pickup_Location", "Pick_Up_Location"],
      deliveryLocation: ["Delivery_Location"],
      estimatedDistance: ["Estimated_Distance_KM"],
      actualDistance: ["Actual_Distance_KM"],
      tripDuration: ["Trip_Duration"],
      quantity: ["Quantity", "Total_Quantity"],
      weight: ["Total_loaded_Weight", "Weight"],
      totalLoadedWeight: ["Total_loaded_Weight"],
      expectedDelivery: [
        "Expected_Delivery",
        "Expected_Delivery_Date",
        "Planned_Delivery_Date",
      ],
      trackingNumber: ["Tracking_Number", "Tracking_No", "Tracking_ID"],
      tripCompletion: ["Trip_Completion_Date_Time"],
      actualDeparture: ["Actual_Departure_Date_Time"],
      startingOdometer: ["Starting_Odometer"],
      /* Added for the "Driver & recent trips" card's last-6-trips list. */
      endDateTime: [
        "Trip_Completion_Date_Time",
        "Trip_End_Date_Time",
        "End_Date_Time",
        "Actual_Delivery_Date_Time",
      ],
      workingHours: [
        "Total_Working_Hours",
        "Total_Work_Hours",
        "Working_Hours",
        "Trip_Duration",
        "Total_Hours",
      ],
      customerCompany: [
        "Customer",
        "Customer_Company",
        "Customer_Company_Name",
        "Company_Name",
      ],
    };

  function le(e, t) {
    var r = sr(e, ce[t] || []);
    return Array.isArray(r)
      ? r
          .map(function (e) {
            return cr(e);
          })
          .filter(Boolean)
          .join(", ")
      : cr(r);
  }

  /* ---------- Booking ID list helpers (Driver BFM Log) ----------
     A Trip can carry more than one Booking (Booking_ID is a multi-select
     lookup — see ce.assignedBookings above). bookingIdsArray() returns the
     individual Booking IDs as a plain array (instead of le()'s
     comma-joined string) so the UI can decide how to lay them out;
     renderBookingIdCell() then fills a "Booking ID" cell either as plain
     text (one Booking) or as a compact, scrollable list (more than one),
     used identically by the Driver BFM Log card, its "View All" popup,
     and each per-trip row. */
  function bookingIdsArray(e) {
    var r = sr(e, ce.assignedBookings || []);
    if (Array.isArray(r))
      return r
        .map(function (v) {
          return cr(v);
        })
        .filter(Boolean);
    var v = cr(r);
    return v ? [v] : [];
  }

  function renderBookingIdCell(el, ids) {
    if (!el) return;
    ids = ids || [];
    if (!ids.length)
      return (el.classList.remove("bk-multi"), void (el.textContent = "—"));
    if (1 === ids.length)
      return (el.classList.remove("bk-multi"), void (el.textContent = ids[0]));
    (el.classList.add("bk-multi"),
      (el.innerHTML =
        '<span class="bk-scroll" role="list" tabindex="0" aria-label="' +
        ids.length +
        ' Booking IDs — scroll to view all">' +
        ids
          .map(function (id) {
            var safe = String(id)
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;");
            return '<span class="bk-chip" role="listitem">' + safe + "</span>";
          })
          .join("") +
        "</span>"));
  }

  function de(e, t) {
    var r,
      n = sr(e, ce[t] || []);
    return (
      Array.isArray(n) && (n = n[0]),
      null == (r = n)
        ? ""
        : "string" == typeof r || "number" == typeof r
          ? String(r)
          : r.ID || r.zc_id || r.id || ""
    );
  }

  function tripRoute(e) {
    var t = le(e, "route");
    if (t) return t;
    var r = le(e, "fromLocation"),
      n = le(e, "toLocation");
    return r || n ? [r, n].filter(Boolean).join(" → ") : "—";
  }

  /* True while the driver already has a trip in progress (restored from
     Creator on boot, or started this session). Kept as a function on
     purpose: fe()/feCompact() shadow `o` with a local, so they can't read
     o.activeTripRecordId directly. */
  function hasActiveTrip() {
    return !!(o.tripStarted || o.activeTripRecordId);
  }

  /* Adjusts the "Start Trip" button of a trip row for an in-progress trip:
     the active trip's button becomes "Resume trip", every other trip's
     button is disabled (the click handler shows "Complete your active trip
     first"). */
  function tripStartControl(li, status) {
    var btn = li.querySelector("[data-start-trip]");
    if (!btn) return;
    if ("In Transit" === status) {
      (btn.setAttribute("data-nav", "trip"),
        btn.removeAttribute("data-start-trip"));
      var label = btn.querySelector("span");
      (label || btn).textContent = "Resume trip";
    } else
      hasActiveTrip() &&
        (btn.setAttribute("aria-disabled", "true"), (btn.style.opacity = ".5"));
  }

  function ue(e, t) {
    return String(e || "").trim() === String(t || "").trim();
  }

  function me(e) {
    if (!e) return 0;
    var t = Date.parse(e);
    if (!isNaN(t)) return t;
    var r = String(e).match(
      /(\d{1,2})-(\w{3})-(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
    );
    if (r) {
      var n = {
        Jan: 0,
        Feb: 1,
        Mar: 2,
        Apr: 3,
        May: 4,
        Jun: 5,
        Jul: 6,
        Aug: 7,
        Sep: 8,
        Oct: 9,
        Nov: 10,
        Dec: 11,
      }[r[2]];
      if (void 0 !== n) {
        var i = new Date(
          +r[3],
          n,
          +r[1],
          +(r[4] || 0),
          +(r[5] || 0),
          +(r[6] || 0),
        );
        if (!isNaN(i.getTime())) return i.getTime();
      }
    }
    return 0;
  }

  function pe(e) {
    w("dashTripCountLabel", e || "No trips");
    var t = u("#dashTodayTripList");
    if (t) {
      t.innerHTML = "";
      var r = document.createElement("li");
      ((r.className = "triprow"),
        (r.textContent = e || "No assigned trips for today or upcoming."),
        t.appendChild(r));
    }
  }

  function isSameDay(e) {
    if (!e) return !1;
    /* Same Safari date-parsing fix as g() above. Callers here already
       pass a me()-derived numeric timestamp (see fe() below), so only
       route raw strings through me() — calling me() a second time on a
       number that's already a timestamp would break it (Date.parse on
       a stringified number never matches). */
    var ts = "number" == typeof e ? e : me(e);
    if (!ts) return !1;
    var t = new Date(ts),
      r = new Date();
    return (
      t.getFullYear() === r.getFullYear() &&
      t.getMonth() === r.getMonth() &&
      t.getDate() === r.getDate()
    );
  }

  function fe(e) {
    var t = le(e, "tripId") || "—",
      r = le(e, "tripName") || "—",
      n = le(e, "route") || "—",
      i = le(e, "fromLocation") || "—",
      a = le(e, "toLocation") || "—",
      o = le(e, "startDateTime") || "—",
      s = le(e, "status") || "—",
      c = isSameDay(me(le(e, "startDateTime"))),
      tagLabel = c ? "Today's Assigned Trip" : "Upcoming Trip",
      l = document.createElement("li");
    ((c = "In Transit" === s || c),
      (tagLabel = "In Transit" === s ? "Active trip" : tagLabel));
    return (
      (n = tripRoute(e)),
      (l.className = "triprow " + ve(s)),
      l.setAttribute("data-trip-id", t),
      (l.innerHTML =
        '<div class="triprow__main"><span class="triprow__tag"></span><b class="triprow__id"></b><span class="triprow__route" data-name></span><span class="triprow__meta" data-route></span><span class="triprow__meta" data-locations></span><span class="triprow__meta" data-date></span></div><span class="triprow__status"></span><div class="triprow__actions">' +
        (c
          ? '<button type="button" class="triprow__view is-start" data-nav="vcheck" data-start-trip data-trip-id="' +
            t +
            '">Start Trip · ' +
            t +
            "</button>"
          : "") +
        '<button type="button" class="triprow__view" data-view-trip>View</button></div>'),
      (l.querySelector(".triprow__tag").textContent = tagLabel),
      (l.querySelector(".triprow__id").textContent = t),
      (l.querySelector("[data-name]").textContent = r),
      (l.querySelector("[data-route]").textContent = "Route: " + n),
      (l.querySelector("[data-locations]").textContent =
        "From: " + i + "  ·  To: " + a),
      (l.querySelector("[data-date]").textContent = "Start: " + o),
      (l.querySelector(".triprow__status").textContent = s),
      tripStartControl(l, s),
      l
    );
  }

  /* Compact row used only on the Today's trip main-page card: shows the
     tag ("Today's Assigned Trip" / "Upcoming Trip"), Trip ID, From, To and
     Start Date only — no Trip Name, Route or Status. The full-detail row
     (fe) is still used inside the "View More" popup. */
  function feCompact(e) {
    var activeTrip = "In Transit" === le(e, "status");
    var t = le(e, "tripId") || "—",
      i = le(e, "fromLocation") || "—",
      a = le(e, "toLocation") || "—",
      o = le(e, "startDateTime") || "—",
      c = isSameDay(me(le(e, "startDateTime"))),
      tagLabel = c ? "Today's Assigned Trip" : "Upcoming Trip",
      l = document.createElement("li");
    ((c = activeTrip || c), (tagLabel = activeTrip ? "Active trip" : tagLabel));
    return (
      (l.className = "triprow triprow--compact trip-highlight"),
      l.setAttribute("data-trip-id", t),
      (l.innerHTML =
        '<div class="trip-highlight__top"><span class="trip-highlight__tag"></span><div class="trip-highlight__actions">' +
        (c
          ? '<button type="button" class="trip-highlight__btn is-start" data-nav="vcheck" data-start-trip data-trip-id="' +
            t +
            '"><svg width="13" height="13" aria-hidden="true"><path d="M4 3l9 6-9 6V3z" fill="currentColor"/></svg><span>Start Trip · ' +
            t +
            "</span></button>"
          : "") +
        '<button type="button" class="trip-highlight__btn is-view" data-view-trip>View</button></div></div><div class="trip-highlight__body"><div class="trip-highlight__info"><b class="trip-highlight__id"></b><span class="trip-highlight__locations" data-locations></span><span class="trip-highlight__date"><svg width="13" height="13" aria-hidden="true"><use href="#i-calendar"/></svg><span data-date></span></span></div><svg class="trip-highlight__art" viewBox="0 0 140 80" aria-hidden="true" focusable="false"><path d="M12 62c22-6 38 2 58-8s40-18 58-4" fill="none" stroke="#9db8e6" stroke-width="2" stroke-dasharray="4 5"/><circle cx="14" cy="60" r="6" fill="#e8f0fe" stroke="#1E6FE8" stroke-width="2"/><circle cx="124" cy="52" r="6" fill="#e8f0fe" stroke="#1E6FE8" stroke-width="2"/></svg></div>'),
      (l.querySelector(".trip-highlight__tag").textContent = tagLabel),
      (l.querySelector(".trip-highlight__id").textContent = t),
      (l.querySelector("[data-locations]").innerHTML =
        '<svg width="12" height="12" aria-hidden="true"><use href="#i-pin"/></svg><b>From: ' +
        i +
        '</b> <svg width="11" height="11" aria-hidden="true"><use href="#i-arrow-right"/></svg> <svg width="12" height="12" aria-hidden="true"><use href="#i-pin"/></svg><b>To: ' +
        a +
        "</b>"),
      (l.querySelector("[data-date]").textContent = "Start: " + o),
      tripStartControl(l, activeTrip ? "In Transit" : ""),
      l
    );
  }

  /* `act` = the driver's in-transit trips (ID-verified by ke()); omitted →
     fall back to every In Transit row in `e`. */
  function he(e, act) {
    var activeTrips =
      act ||
      e
        .filter(function (e) {
          return "In Transit" === le(e, "status");
        })
        .slice()
        .sort(function (e, t) {
          return me(le(t, "startDateTime")) - me(le(e, "startDateTime"));
        });
    o.activeTripRecordId = activeTrips.length
      ? activeTrips[0].ID || activeTrips[0].id || null
      : null;
    var t = e
      .filter(function (e) {
        return (
          "Assigned" === le(e, "status") &&
          (function (e) {
            if (!e) return !1;
            var t = new Date();
            return (t.setHours(0, 0, 0, 0), e >= t.getTime());
          })(me(le(e, "startDateTime")))
        );
      })
      .slice()
      .sort(function (e, t) {
        return me(le(e, "startDateTime")) - me(le(t, "startDateTime"));
      });
    ((t = activeTrips.concat(t)),
      w(
        "dashTripCountLabel",
        t.length
          ? t.length + (1 === t.length ? " trip" : " trips")
          : "No trips",
      ),
      (ge = t));
    var r = u("#startTopLabel");
    r &&
      (r.textContent = t.length
        ? "Trip " + (le(t[0], "tripId") || "—") + " · ready"
        : "No trip assigned yet");
    (activeTrips.length &&
      r &&
      (r.textContent =
        "Trip " + (le(activeTrips[0], "tripId") || "—") + " · in transit"),
      t.forEach(function (e) {
        ye[le(e, "tripId") || "—"] = e;
      }));
    var n = u("#dashTodayTripList"),
      todayItem = null,
      upcomingItem = null;
    if (
      (t.length &&
        ((todayItem =
          activeTrips[0] ||
          t.filter(function (e) {
            return isSameDay(me(le(e, "startDateTime")));
          })[0] ||
          null),
        (upcomingItem =
          t.filter(function (e) {
            return e !== todayItem;
          })[0] || null)),
      n)
    )
      if (((n.innerHTML = ""), t.length)) {
        [todayItem, upcomingItem].filter(Boolean).forEach(function (e) {
          n.appendChild(feCompact(e));
        });
      } else {
        var i = document.createElement("li");
        ((i.className = "triprow"),
          (i.textContent = "No assigned trips for today or upcoming."),
          n.appendChild(i));
      }
    var vm = u("#btnTodayTripViewMore");
    vm && (vm.hidden = t.length <= 2);
    /* The "View More" popup lists the driver's other assigned trips only
       — the two already shown on the main Today's trip card (today's
       trip and the next upcoming one) are excluded so nothing repeats. */
    oe(
      t.filter(function (e) {
        return e !== todayItem && e !== upcomingItem;
      }),
      t.length,
      todayItem,
    );
    return t;
  }

  function ve(e) {
    var t = String(e || "").toLowerCase();
    return "completed" === t
      ? "is-completed"
      : "cancelled" === t
        ? "is-cancelled"
        : -1 !== ["dispatched", "in transit", "arrived"].indexOf(t)
          ? "is-active"
          : "is-scheduled";
  }
  var ye = {},
    ge = [];

  function be(e, t, r) {
    var ATT_ALLOWED_STATUSES = [
      "Planned",
      "In Transit",
      "Cancelled",
      "Completed",
    ];
    e = (e || []).filter(function (rec) {
      return -1 !== ATT_ALLOWED_STATUSES.indexOf(le(rec, "status"));
    });
    var n = e.filter(function (e) {
        return "Completed" === le(e, "status");
      }).length,
      i = e.filter(function (e) {
        return "Cancelled" === le(e, "status");
      }).length,
      a = e.length,
      o = a ? Math.round((n / a) * 100) : 0;
    (w("attDone", String(n)),
      w("attCancel", String(i)),
      w("attTotal", String(a)),
      w("attDone2", String(n)),
      w("attCancel2", String(i)),
      w("attTotal2", String(a)),
      w("attSub", o + "% attendance · all assigned trips"),
      w("tripAttMini", o + "%"),
      w("tripAttSub", n + " of " + a),
      w("dashAttDone", String(n)),
      w("dashAttCancel", String(i)),
      w("dashAttTotal", String(a)),
      w("dashAttSub", n + " of " + a),
      (re.attended = n),
      (re.cancelled = i),
      Te());
    var s = u("#panelAttendance");
    s && !s.hidden && De();
    var c = t || [],
      l = e
        .filter(function (e) {
          return (
            "Assigned" !== le(e, "status") && -1 === c.indexOf(le(e, "tripId"))
          );
        })
        .slice()
        .sort(function (e, t) {
          return me(le(t, "startDateTime")) - me(le(e, "startDateTime"));
        });
    l.forEach(function (e) {
      var t = le(e, "tripId") || "—";
      ye[t] = e;
    });
    var d3 = l
      .filter(function (e) {
        return "Completed" === le(e, "status");
      })
      .slice(0, 2);

    function buildTripRow(e) {
      var t = le(e, "tripId") || "—",
        r = le(e, "startDateTime") || "—",
        n = le(e, "status") || "—",
        i = document.createElement("li");
      return (
        (i.className = "triprow " + ve(n)),
        i.setAttribute("data-trip-id", t),
        (i.innerHTML =
          '<div class="triprow__main"><b class="triprow__id"></b><span class="triprow__meta"></span></div><span class="triprow__status"></span><button type="button" class="triprow__view" data-view-trip>View</button>'),
        (i.querySelector(".triprow__id").textContent = t),
        (i.querySelector(".triprow__meta").textContent = r),
        (i.querySelector(".triprow__status").textContent = n),
        i
      );
    }

    function renderTripList(e, data, emptyMsg) {
      if (e) {
        if (((e.innerHTML = ""), !data.length)) {
          var t = document.createElement("li");
          return (
            (t.className = "triprow"),
            (t.textContent = emptyMsg),
            void e.appendChild(t)
          );
        }
        data.forEach(function (t) {
          e.appendChild(buildTripRow(t));
        });
      }
    }
    (renderTripList(u("#dashAttList"), d3, "No completed trips yet."),
      renderTripList(
        u("#attList"),
        l,
        r || "No other trips assigned to this driver.",
      ));
    var allBfmRows = e.slice().sort(function (a, b) {
      return me(le(b, "startDateTime")) - me(le(a, "startDateTime"));
    });
    (renderLast2Trips(l), renderAllBfmLogTrips(allBfmRows));
  }

  /* ---------- "Driver BFM Log" card ----------
     Shows Driver Name/ID at the top and, below it, ONLY the last 3 trip
     records (most-recent-first — `l` above is already sorted that way) with
     exactly: Trip ID, Booking ID, Start Date, End Date, Total Working Hours,
     Customer Company Name. No other fields are added, per request. The
     "View All" button next to this list opens the panelBfmLogView popup,
     which shows every trip record via renderAllBfmLogTrips() below. */
  function buildBfmTripLi(e) {
    var li = document.createElement("li");
    li.className = "trip6-item";
    li.innerHTML =
      '<div class="trip6-hd"><b class="trip6-id"></b><button type="button" class="trip6-eye" data-bfm-trip-detail aria-label="View complete trip details" title="View trip details">👁</button></div><dl class="trip6-grid"><div><dt>Start Date</dt><dd class="trip6-start"></dd></div><div><dt>End Date</dt><dd class="trip6-end"></dd></div><div><dt>Customer Company Name</dt><dd class="trip6-cust"></dd></div><div><dt>Total Working Hours</dt><dd class="trip6-hrs"></dd></div></dl>';
    li.querySelector(".trip6-id").textContent = le(e, "tripId") || "—";
    li.querySelector(".trip6-start").textContent =
      le(e, "startDateTime") || "—";
    li.querySelector(".trip6-end").textContent = le(e, "endDateTime") || "—";
    li.querySelector(".trip6-hrs").textContent = le(e, "workingHours") || "—";
    var customerCell = li.querySelector(".trip6-cust");
    customerCell.textContent = "Loading…";
    resolveBfmTripCustomer(e)
      .then(function (customer) {
        customerCell.textContent = customer || "—";
      })
      .catch(function () {
        customerCell.textContent = le(e, "customerCompany") || "—";
      });
    li.querySelector("[data-bfm-trip-detail]").addEventListener(
      "click",
      function () {
        openBfmTripDetails(e);
      },
    );
    return li;
  }

  function renderLast2Trips(allTrips) {
    var host = u("#last6TripsList");
    if (!host) return;
    var rows = (allTrips || []).slice(0, 2);
    if (!rows.length)
      return void (host.innerHTML =
        '<li class="trip6-empty">No trip records yet.</li>');
    ((host.innerHTML = ""),
      rows.forEach(function (e) {
        host.appendChild(buildBfmTripLi(e));
      }));
  }

  /* ---------- Driver BFM Log "View All" popup ----------
     Renders every trip record for this driver (not just the last 3 shown
     on the card), most-recent-first — same row markup/fields as the card
     so the popup and the card stay visually consistent. */
  function renderAllBfmLogTrips(allTrips) {
    var host = u("#allBfmTripsList");
    if (!host) return;
    var rows = allTrips || [];
    if (!rows.length)
      return void (host.innerHTML =
        '<li class="trip6-empty">No trip records yet.</li>');
    ((host.innerHTML = ""),
      rows.forEach(function (e) {
        host.appendChild(buildBfmTripLi(e));
      }));
  }

  function openBfmTripDetails(rec) {
    var values = {
      bfdTripName: le(rec, "tripName"),
      bfdTripType: le(rec, "tripType"),
      bfdStatus: le(rec, "status"),
      bfdBookingDate: le(rec, "bookingDate"),
      bfdDeliveryMode: le(rec, "deliveryMode"),
      bfdVehicle: le(rec, "vehicle"),
      bfdVehicleCapacity: le(rec, "vehicleCapacity"),
      bfdPrimaryDriver: le(rec, "primaryDriver"),
      bfdSecondaryDriver: le(rec, "secondaryDriver"),
      bfdDriverId: le(rec, "driverId"),
      bfdCustomer: le(rec, "customerCompany"),
      bfdPickup: le(rec, "pickupLocation") || le(rec, "fromLocation"),
      bfdDelivery: le(rec, "deliveryLocation") || le(rec, "toLocation"),
      bfdDistance: le(rec, "estimatedDistance"),
      bfdDuration: le(rec, "tripDuration"),
      bfdQuantity: le(rec, "quantity"),
      bfdWeight: le(rec, "weight"),
      bfdLoadedWeight: le(rec, "totalLoadedWeight"),
      bfdTracking: le(rec, "trackingNumber"),
      bfdStartDate: le(rec, "startDateTime"),
      bfdCompletion: le(rec, "tripCompletion") || le(rec, "endDateTime"),
      bfdStartLocation: le(rec, "fromLocation"),
      bfdEndLocation: le(rec, "toLocation"),
      bfdStartTime: le(rec, "startDateTime"),
      bfdEndTime: le(rec, "endDateTime"),
    };
    Object.keys(values).forEach(function (id) {
      w(id, values[id] || "—");
    });
    w("bfdTitle", le(rec, "tripId") || "Trip details");
    (w("bfdCustomer", "Loading…"),
      er("panelBfmTripDetails", null),
      resolveBfmTripCustomer(rec)
        .then(function (customer) {
          /* Do not let a slower request overwrite a subsequently selected trip. */
          if (
            (u("#bfdTitle") || {}).textContent ===
            (le(rec, "tripId") || "Trip details")
          )
            w("bfdCustomer", customer || "—");
        })
        .catch(function () {
          w("bfdCustomer", le(rec, "customerCompany") || "—");
        }));
  }

  /* Customer is owned by the linked Booking, not by Trip_Dispatch. Resolve
     it from Booking.Customer for every BFM row, with a small per-booking
     cache so opening or rendering a record never changes its data mapping. */
  var BFM_BOOKING_CUSTOMER_CACHE = {};
  function resolveBfmTripCustomer(trip) {
    var keys = bookingIdsArray(trip)
        .map(function (v) {
          return String(v).trim();
        })
        .filter(Boolean),
      cacheKey = keys.slice().sort().join("|");
    if (!keys.length) return Promise.resolve(le(trip, "customerCompany") || "");
    if (
      Object.prototype.hasOwnProperty.call(BFM_BOOKING_CUSTOMER_CACHE, cacheKey)
    )
      return Promise.resolve(BFM_BOOKING_CUSTOMER_CACHE[cacheKey]);
    var wanted = keys.map(function (v) {
      return normKey(v);
    });
    function tryReport(index) {
      if (index >= BOOKING_REPORT_CANDIDATES.length) return Promise.resolve("");
      return kr({
        report_name: BOOKING_REPORT_CANDIDATES[index],
        field_config: "all",
        max_records: 500,
      })
        .then(function (res) {
          var rows = (res && res.data) || [],
            customers = rows
              .filter(function (row) {
                var refs = refListFromValue(
                    sr(row, BOOKING_FIELD_CANDIDATES.bookingId),
                  ),
                  candidates = [String(row.ID || row.id || "")]
                    .concat(refs.ids, refs.names)
                    .map(normKey);
                return wanted.some(function (key) {
                  return candidates.indexOf(key) !== -1;
                });
              })
              .map(function (row) {
                return lookupLabel(sr(row, BOOKING_FIELD_CANDIDATES.customer));
              })
              .filter(Boolean)
              .filter(function (value, index, values) {
                return values.indexOf(value) === index;
              });
          return customers.length
            ? (promoteBookingReportCandidate(index), customers.join(", "))
            : tryReport(index + 1);
        })
        .catch(function () {
          return tryReport(index + 1);
        });
    }
    return tryReport(0).then(function (customer) {
      BFM_BOOKING_CUSTOMER_CACHE[cacheKey] =
        customer || le(trip, "customerCompany") || "";
      return BFM_BOOKING_CUSTOMER_CACHE[cacheKey];
    });
  }

  function _e(e, t) {
    var r = ce.driverName || [];
    if (t >= r.length)
      return kr({
        report_name: se,
        field_config: "all",
        max_records: 200,
      }).then(function (e) {
        return (e && e.data) || [];
      });
    var n = r[t];
    return kr({
      report_name: se,
      criteria: "(" + n + ' == "' + e.replace(/"/g, '\\"') + '")',
      field_config: "all",
      max_records: 200,
    })
      .then(function (r) {
        var n = (r && r.data) || [];
        return n.length ? n : _e(e, t + 1);
      })
      .catch(function (r) {
        return (
          console.warn(gr, "Trip criteria on", n, "failed, trying next:", r),
          _e(e, t + 1)
        );
      });
  }

  function ke() {
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA)
      return (
        (ye = {}),
        pe("Preview mode — not connected to Zoho Creator"),
        be([], [], "Preview mode — not connected to Zoho Creator."),
        Promise.resolve()
      );
    if (!s.name || "Driver not found" === s.name)
      return (
        (ye = {}),
        pe("No matching driver found"),
        be([], [], "No matching driver found."),
        Promise.resolve()
      );
    var e = s.name.trim();
    return _e(e, 0)
      .then(function (t) {
        var r = t.filter(function (t) {
          return (function (e, t) {
            return (
              ue(le(e, "driverName"), t) || ue(le(e, "secondaryDriverName"), t)
            );
          })(t, e);
        });
        /* The driver's in-transit trip(s): matched by the Primary/Secondary
         Driver lookup ID; the name match above is only the fallback for a
         trip whose driver IDs are missing. A trip finished in this session
         is never treated as active, even if Creator is slow to flip it. */
        var activeTrips = t
          .filter(function (e) {
            if (
              "In Transit" !== le(e, "status") ||
              (e.ID || e.id) === o.completedTripRecordId
            )
              return !1;
            var t = de(e, "primaryDriver"),
              n = de(e, "secondaryDriverName");
            return s.recordId && (t || n)
              ? t === s.recordId || n === s.recordId
              : r.indexOf(e) > -1;
          })
          .sort(function (e, t) {
            return me(le(t, "startDateTime")) - me(le(e, "startDateTime"));
          });
        activeTrips.forEach(function (e) {
          r.indexOf(e) < 0 && r.push(e);
        });
        if (
          (console.log(
            gr,
            se,
            "exact Driver Name matches for",
            e,
            ":",
            r.length,
            "of",
            t.length,
            "| in-transit trips for this driver:",
            activeTrips.length,
          ),
          (ye = {}),
          !r.length)
        )
          return (
            pe("No trip assigned"),
            void be([], [], "No trips assigned to this driver.")
          );
        var displayedTrips = he(r, activeTrips);
        be(
          r,
          displayedTrips.map(function (e) {
            return le(e, "tripId");
          }),
        );
        if (!activeTrips.length) return null;
        activeTrips.length > 1 &&
          console.warn(
            gr,
            "multiple in-transit trips found; restoring the latest",
            activeTrips.map(function (e) {
              return le(e, "tripId");
            }),
          );
        var activeId = activeTrips[0].ID || activeTrips[0].id;
        return o.tripStarted && K.tripRecordId === activeId
          ? (console.log(
              gr,
              "restore: trip already active in this session — nothing to restore",
            ),
            null)
          : restoreActiveTrip(activeTrips[0]).then(function (resumed) {
              /* Already ended (every Start_Trip_in_Driver row has an End_Time): it
           must not show as an active trip on the Dashboard either. */
              resumed ||
                (he(r, []),
                console.log(
                  gr,
                  "restore: stale In Transit trip ignored",
                  le(activeTrips[0], "tripId"),
                ));
            });
      })
      .catch(function (e) {
        (console.error(gr, "loadDriverTripsAndRender failed:", e),
          (ye = {}),
          pe("Couldn't load trip"),
          be([], [], "Couldn't load trips for this driver."));
      });
  }

  /* ============================================================
     ACTIVE-TRIP RESTORE
     Creator is the source of truth: a Trip_Dispatch row whose
     Trip_Status is "In Transit" and whose Primary/Secondary Driver is the
     signed-in driver means that driver is mid-trip, whatever this
     browser remembers. restoreActiveTrip() rebuilds the in-memory trip
     state from that row (plus the driver's open Start_Trip_in_Driver
     record) and drops the driver back into the Trip view. It is
     READ-ONLY toward Creator: no addRecords / updateRecords /
     Driver_BFM_Notification rows are ever written while restoring.
     ============================================================ */
  function restoreLookupId(e) {
    var t =
      null == e
        ? ""
        : "object" == typeof e
          ? e.ID || e.id || e.zc_id || ""
          : String(e);
    /* Creator record IDs are long numeric strings; a plain display value
       ("SKY-EMP-006") is not an ID. */
    return /^\d{8,}$/.test(t) ? t : "";
  }

  function restoreLookupText(e) {
    return null == e
      ? ""
      : "string" == typeof e || "number" == typeof e
        ? String(e)
        : e.display_value || e.displayValue || e.url || e.value || "";
  }

  /* Is this Start_Trip_in_Driver / Log_a_break row the signed-in driver's? */
  function restoreIsMyRow(row) {
    var id = restoreLookupId(row.Driver_ID) || restoreLookupId(row.Driver_Name);
    return id
      ? id === s.recordId || id === Ut
      : ue(restoreLookupText(row.Driver_Name), s.name) ||
          ue(restoreLookupText(row.Driver_ID), s.id);
  }

  /* Reads one trip's rows (for the signed-in driver) from a Creator report
     that has a Trip_ID lookup. Criteria on a lookup can't be verified
     without a live Creator session, so the variants are tried in order
     until one returns rows: the quoted record ID (the pattern used
     everywhere else in this file), the unquoted numeric ID, then the
     display value (business Trip ID, like _e() does for Primary_Driver).
     Rows are filtered client-side (driver, End_Time) rather than with
     `End_Time == null`, so an unsupported time comparison can't hide them.
     A permission error is rethrown at once — retrying can't fix it. */
  function restoreFetchTripRows(report, tripRecordId, tripLabel) {
    var attempts = [
      '(Trip_ID == "' + escapeCriteria(tripRecordId) + '")',
      "(Trip_ID == " + escapeCriteria(tripRecordId) + ")",
    ];
    tripLabel &&
      attempts.push('(Trip_ID == "' + escapeCriteria(tripLabel) + '")');
    return (function next(i, lastErr) {
      if (i >= attempts.length) {
        if (lastErr) throw lastErr;
        return Promise.resolve([]);
      }
      console.log(gr, "restore: reading", report, "with criteria", attempts[i]);
      return kr({
        report_name: report,
        criteria: attempts[i],
        field_config: "all",
        max_records: 200,
      }).then(
        function (res) {
          var rows = ((res && res.data) || []).filter(restoreIsMyRow);
          return rows.length ? rows : next(i + 1, lastErr);
        },
        function (err) {
          /* Two-argument then: only kr()'s own rejection lands here, not an
           error from a deeper attempt. */
          var msg = "";
          try {
            msg = JSON.stringify(err);
          } catch (x) {
            msg = String(err);
          }
          console.warn(
            gr,
            "restore:",
            report,
            "criteria failed:",
            attempts[i],
            err,
          );
          if (/2898|"status"\s*:\s*403|permission denied/i.test(msg)) throw err;
          return next(i + 1, err);
        },
      );
    })(0, null);
  }

  /* Minutes of COMPLETED breaks. Computed from each row's Start_time and
     End_time, never Total_break_duration (its unit differs between the
     widget and the server workflows). */
  function completedBreakMinutes(rows) {
    return (rows || []).reduce(function (sum, row) {
      if (!row.Start_time || !row.End_time) return sum;
      var d = timeStrToMins(row.End_time) - timeStrToMins(row.Start_time);
      return sum + Math.round(d < 0 ? d + 1440 : d);
    }, 0);
  }

  /* Deferred until the boot loader has gone — R() toasts shown under it
     would expire unseen (the loader closes as soon as real data is ready,
     or at worst after FAILSAFE_MS — see near the top of this file). */
  function restoreToast(msg) {
    I
      ? R(msg)
      : (o.pendingToast = o.pendingToast ? o.pendingToast + " " + msg : msg);
  }

  /* No local snapshot (new device / storage cleared): rebuild the BFM
     counters from timestamps. Returns the labels of tiers already in
     breach so the caller can show ONE summary instead of per-tier alerts. */
  function rebuildBfmWithoutSnapshot(breakRows) {
    var elapsed = Math.max(0, Math.floor((Date.now() - o.startTs) / 6e4)),
      worked = Math.max(0, elapsed - completedBreakMinutes(breakRows)),
      fresh = [];
    ((o.onBreak = !1),
      (o.activeBfmRuleIndex = 0),
      (o.breakElapsedMins = 0),
      (o.restTargetMins = 0),
      (o.restCompleteNotified = !1),
      (o.restResolved = !1),
      (o.completedRestRuleIndex = null),
      (o.tierWorked = a.tiers.map(function (_, i) {
        return i === o.activeBfmRuleIndex ? worked : 0;
      })),
      (o.tierExtraMins = a.tiers.map(function () {
        return 0;
      })),
      (o.tierNotified = a.tiers.map(function (tier) {
        return 0 === a.tiers.indexOf(tier) && worked >= tier.maxWorkMins;
      })),
      (o.breakCount = breakRows ? breakRows.length : 0),
      (o.weekWorkedMins += worked));
    worked >= a.tiers[0].maxWorkMins && fresh.push(a.tiers[0].label);
    console.warn(
      gr,
      "restore: no local snapshot; rebuilt",
      worked,
      "worked minutes (",
      elapsed,
      "elapsed minus completed breaks) from",
      breakRows ? breakRows.length : "no",
      "break records",
    );
    return fresh;
  }

  /* Applies everything the restore knows onto `o`. Synchronous on purpose:
     nothing can run between "tripStarted" becoming true and the BFM
     counters being in place, so a bfmTick can't count on half-built state
     or overwrite the stored snapshot with it. Returns the labels of tiers
     that are in breach and were not already known to be. */
  function applyRestoredTrip(e, ts, startRow, snap, breakRows) {
    var startD = new Date(ts),
      endMins;
    ((o.startTs = ts),
      (o.startTime = p(startD.getHours()) + ":" + p(startD.getMinutes())),
      (endMins = (_(o.startTime) + a.maxWorkPerShift) % 1440),
      (o.endTime = p(Math.floor(endMins / 60)) + ":" + p(endMins % 60)),
      (o.startTripRecordId =
        (startRow && (startRow.ID || startRow.id)) || null),
      (o.startOdometer =
        (startRow && Number(startRow.Starting_Odometer_Reading)) ||
        Number(le(e, "startingOdometer")) ||
        0),
      (o.startLocation = startRow
        ? restoreLookupText(startRow.Live_Location)
        : ""),
      (o.startLocationUrl = startRow
        ? restoreLookupText(startRow.Live_Location_URL)
        : ""),
      (o.endLocation = le(e, "toLocation") || ""),
      (o.bfmDayKey = bfmDateKey(new Date())),
      (o.restAlertShown = !1),
      (o.restEscalated = !1));
    var fresh = snap
      ? restoreBfmSnapshot(snap)
      : rebuildBfmWithoutSnapshot(breakRows);
    (snap || restoreToast("Trip resumed. Break history may be incomplete."),
      (o.restoredTrip = !0),
      (o.tripStarted = !0));
    return fresh;
  }

  /* Puts the restored trip on screen, the same way submitStartTripPage
     does after a successful start (minus every Creator write). */
  function showRestoredTrip(fresh) {
    (w("tripStart", o.startTime),
      w("tripEnd", o.endTime),
      w("tripStartedAt", o.startTime),
      w("tripWindow", o.startTime + " – " + o.endTime),
      w("tripStartLoc", o.startLocation),
      w("kpiStatus", "IN TRANSIT"));
    var stickyEl = u("#stickyStart");
    (stickyEl &&
      ((stickyEl.textContent = "Open trip"),
      stickyEl.setAttribute("data-nav", "trip")),
      U ||
        ((U = !0),
        (function () {
          try {
            history.pushState(
              {
                skywayTripGuard: !0,
              },
              "",
            );
          } catch (e) {}
        })()),
      ee(),
      Z(),
      nr(),
      openBfmDayRecord(),
      W(),
      q(),
      P(),
      ir());
    /* Every tier already in breach was flagged as notified before P() ran,
       so nothing above fired a per-tier alert or wrote a Creator row; this
       is the single quiet summary. */
    (fresh &&
      fresh.length &&
      !o.onBreak &&
      pushBfmNotification(
        "amber",
        "Trip resumed — " +
          fresh.join(", ") +
          (1 === fresh.length ? " limit is" : " limits are") +
          " already reached. Take the required rest before driving on.",
      ),
      saveTripSnapshot(),
      Y("trip"),
      console.log(
        gr,
        "restore: trip view ready",
        K.tripId,
        "| start record",
        o.startTripRecordId || "not found",
        "| on break:",
        o.onBreak,
      ));
  }

  /* Resolves true when the trip was resumed, false when it turned out to be
     already ended (so the caller must not treat it as active). */
  function restoreActiveTrip(e) {
    var tripRecordId = e.ID || e.id,
      tripLabel = le(e, "tripId");
    console.log(gr, "restore: active trip found", tripLabel, tripRecordId);
    return restoreFetchTripRows(
      "Start_Trip_in_Driver1",
      tripRecordId,
      tripLabel,
    )
      .then(
        function (rows) {
          var open = rows
            .filter(function (row) {
              return !row.End_Time;
            })
            .sort(function (x, y) {
              return (
                me(
                  String(y.Date_field || "") + " " + String(y.Start_Time || ""),
                ) -
                me(
                  String(x.Date_field || "") + " " + String(x.Start_Time || ""),
                )
              );
            });
          console.log(
            gr,
            "restore: Start_Trip_in_Driver rows for this trip/driver:",
            rows.length,
            "| still open:",
            open.length,
          );
          return rows.length && !open.length
            ? {
                ended: !0,
              }
            : {
                row: open[0] || null,
              };
        },
        function (err) {
          console.warn(
            gr,
            "restore: could not read Start_Trip_in_Driver1 (the Driver profile needs View access to it) — resuming without the start record:",
            err,
          );
          return {
            row: null,
          };
        },
      )
      .then(function (found) {
        if (found.ended)
          return (
            console.warn(
              gr,
              "restore: every Start_Trip_in_Driver row for",
              tripLabel,
              "already has an End_Time — the trip was ended, so it is not resumed",
            ),
            !1
          );
        var startRow = found.row,
          ts = me(le(e, "startDateTime")),
          src = "Trip_Dispatch Start_Date_Time";
        !ts &&
          startRow &&
          ((ts = me(
            String(startRow.Date_field || "") +
              " " +
              String(startRow.Start_Time || ""),
          )),
          (src = "Start_Trip_in_Driver Date_field + Start_Time"));
        ts ||
          (console.warn(
            gr,
            "restore: no valid start timestamp found; falling back to now",
          ),
          restoreToast(
            "Saved start time could not be read — timing restarted from now.",
          ),
          (ts = Date.now()),
          (src = "current time (fallback)"));
        console.log(
          gr,
          "restore: trip started",
          new Date(ts).toString(),
          "— source:",
          src,
        );
        K.tripRecordId === tripRecordId || $(e);
        var snap = readTripSnapshot();
        console.log(
          gr,
          "restore: local BFM snapshot",
          snap ? "found" : "not found",
        );
        return (
          snap
            ? Promise.resolve(null)
            : restoreFetchTripRows(
                "Log_a_break2",
                tripRecordId,
                tripLabel,
              ).catch(function (err) {
                console.warn(
                  gr,
                  "restore: could not read Log_a_break2 — assuming no completed breaks:",
                  err,
                );
                return null;
              })
        ).then(function (breakRows) {
          showRestoredTrip(applyRestoredTrip(e, ts, startRow, snap, breakRows));
          return !0;
        });
      })
      .catch(function (err) {
        /* Never strand a driver who has a live trip on the Dashboard: fall
         back to the minimum needed to show the trip and its timer. */
        console.error(gr, "restore failed for active trip:", err);
        try {
          K.tripRecordId === tripRecordId || $(e);
          showRestoredTrip(
            o.tripStarted
              ? []
              : applyRestoredTrip(
                  e,
                  me(le(e, "startDateTime")) || Date.now(),
                  null,
                  null,
                  null,
                ),
          );
        } catch (err2) {
          console.error(gr, "restore fallback failed too:", err2);
        }
        restoreToast(
          "Trip is active. Some restored details could not be loaded.",
        );
        return !0;
      });
  }

  function we(e, t) {
    var r = u("#" + e),
      n = u("#" + t);
    if (r) {
      var i = re.total ? re.attended / re.total : 0;
      if (
        ((r.style.transition = "none"),
        (r.style.strokeDashoffset = 339),
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            ((r.style.transition =
              "stroke-dashoffset 1.1s cubic-bezier(.3,.8,.3,1)"),
              (r.style.strokeDashoffset = 339 * (1 - i)));
          });
        }),
        n)
      )
        var a = Math.round(100 * i),
          o = 0,
          s = setInterval(function () {
            ((o += Math.max(1, Math.round(a / 22))) >= a &&
              ((o = a), clearInterval(s)),
              (n.textContent = o + "%"));
          }, 40);
    }
  }

  function De() {
    we("attRing", "attPct");
  }

  function Te() {
    we("dashAttRing", "dashAttPct");
  }
  var Ce = null,
    Ie = {
      tyres: {
        label: "Tyres",
        fields: ["fTyrePress", "fTyreSpare", "fTyreCond"],
      },
      battery: {
        label: "Battery",
        fields: ["fBattCond", "fBattFunc"],
      },
      fuel: {
        label: "Fuel",
        fields: ["fVcFuelType", "fFuelPct", "fFuelOk"],
      },
      gps: {
        label: "GPS",
        fields: ["fGpsFixed", "fGpsId", "fGpsCond"],
      },
      health: {
        label: "Driver health",
        fields: ["fHealthDrive", "fHealthFatigue"],
      },
    },
    Se = {
      Pass: 0,
      Monitor: 1,
      Defect: 2,
    };

  function Ee(e) {
    for (var t = "Pass", r = 0; r < e.length; r++) {
      if (null === e[r]) return null;
      Se[e[r]] > Se[t] && (t = e[r]);
    }
    return t;
  }

  function Le(e) {
    return At(e) || null;
  }

  function Re(e) {
    var t = At(e);
    return "" === t ? null : "yes" === t ? "Pass" : "Defect";
  }

  function xe(e, t) {
    var r = At(e);
    return "" === r ? null : t[r] || "Defect";
  }

  function Ae() {
    var e,
      t,
      r,
      n = Object.keys(Ve),
      i = n.every(function (e) {
        return null !== Ve[e] || null !== qe[e];
      }),
      a = null;
    return (
      i &&
        ((a = "Pass"),
        n.forEach(function (e) {
          var t = Ge(e);
          Se[t] > Se[a] && (a = t);
        })),
      {
        tyres: Ee([
          a,
          null === Le("#inTyreCond")
            ? null
            : "Good" === At("#inTyreCond")
              ? "Pass"
              : "Average" === At("#inTyreCond")
                ? "Monitor"
                : "Defect",
        ]),
        battery: Ee([
          xe("#inBattCond", {
            Good: "Pass",
            Bad: "Defect",
            Change: "Defect",
          }),
          Re("#inBattFunc"),
        ]),
        fuel: Ee([
          null === Le("#inVcFuelType") ? null : "Pass",
          ((e = At("#inVcFuelLevel")),
          (t = 40),
          (r = 25),
          "" === e || null === e || isNaN(e)
            ? null
            : (e = Number(e)) < r
              ? "Defect"
              : e < t
                ? "Monitor"
                : "Pass"),
          Re("#inFuelOk"),
        ]),
        gps: Ee([
          Re("#inGpsFixed"),
          null === Le("#inGpsUnit") ? null : "Pass",
          xe("#inGpsCond", {
            Good: "Pass",
            Weak: "Monitor",
            Faulty: "Defect",
          }),
        ]),
        health: Ee([Re("#inHealthDrive"), Le("#inHealthFatigue")]),
      }
    );
  }
  var Pe = {
    tyres: !1,
    battery: !1,
    fuel: !1,
    gps: !1,
    health: !1,
  };

  function Ne() {
    var e = Ae(),
      t = 0,
      r = 0;
    Object.keys(Ie).forEach(function (n) {
      var i = e[n];
      ("Defect" === i && (r++, (Pe[n] = !1)), Pe[n] && t++);
      var a = document.querySelector('[data-pill="' + n + '"]');
      a &&
        ((a.textContent = null === i ? "Not checked" : i),
        (a.className =
          "checkpill" + (null === i ? "" : " is-" + i.toLowerCase())));
      var o = document.querySelector('[data-check="' + n + '"]');
      o &&
        (o.classList.remove("is-pass", "is-monitor", "is-defect"),
        i && o.classList.add("is-" + i.toLowerCase()));
      var s = document.querySelector('[data-check-card="' + n + '"]'),
        c = document.querySelector('[data-kpi-state="' + n + '"]');
      (c &&
        ((c.textContent = Pe[n] ? "Verified" : null === i ? "Not checked" : i),
        (c.className =
          "qa__state" +
          (Pe[n]
            ? " is-verified"
            : null === i
              ? ""
              : " is-" + i.toLowerCase()))),
        s &&
          (s.classList.remove(
            "is-pass",
            "is-monitor",
            "is-defect",
            "is-verified",
          ),
          i && s.classList.add("is-" + i.toLowerCase()),
          Pe[n] && s.classList.add("is-verified")));
    });
    var n = Object.keys(Ie).length;
    (w("vcPassed", t + " / " + n), w("vcDefects", String(r)));
    var i = u("#vcProgress");
    i && (i.style.width = (t / n) * 100 + "%");
    var a = t === n;
    w(
      "vcResult",
      a ? "Cleared to depart" : r ? "Defects raised" : "Incomplete",
    );
    var o = u("#btnStartTripCta");
    if (o) {
      o.disabled = !a;
      var s = K.tripId || X || "",
        c = o.querySelector("span");
      c &&
        (c.textContent =
          (a ? "Start Trip" : "Start Trip — " + t + "/" + n + " checks") +
          (s ? " · " + s : ""));
    }
    return e;
  }

  function Oe() {
    Y("vcheck");
  }
  var Me = {
      4: {
        /* Existing layout: do not alter its two axle positions. */
        axlePositions: [1.7, -1.5],
      },
      6: {
        /* Cab axle + tandem rear axles (three tyre pairs). */
        axlePositions: [1.7, -0.78, -1.72],
      },
      8: {
        /* Cab axle + three evenly-spaced trailer axles (four pairs). */
        axlePositions: [1.7, 0.38, -0.82, -1.9],
      },
      12: {
        /* Cab axle + five trailer axles (six pairs), matching the long
           multi-axle reference layout. */
        axlePositions: [1.7, 0.9, 0.1, -0.7, -1.5, -2.3],
      },
      16: {
        axlePositions: [1.7, 1.05, 0.4, -0.25, -0.9, -1.55, -2.2, -2.55],
      },
    },
    Fe = 4;

  function Be(e) {
    var t = Me[e] || Me[6],
      r = {};
    t.axlePositions.forEach(function (x, index) {
      /* Keep the original four-tyre keys (FL/FR/RL/RR) so existing
         Vehicle Check submissions remain compatible. Additional axles
         use stable R1/R2… keys and are independently tappable. */
      var isFirst = 0 === index,
        isFourTyreRear = 4 === Number(e) && 1 === index,
        leftKey = isFirst ? "fl" : isFourTyreRear ? "rl" : "r" + index + "l",
        rightKey = isFirst ? "fr" : isFourTyreRear ? "rr" : "r" + index + "r",
        label = isFirst ? "Front" : "Rear axle " + index;
      ((r[leftKey] = {
        x: x,
        z: 0.83,
        label: label + " left tyre",
      }),
        (r[rightKey] = {
          x: x,
          z: -0.83,
          label: label + " right tyre",
        }));
    });
    return r;
  }
  var He = {},
    Ve = {},
    qe = {},
    We = null;

  function Ue(e, t) {
    var r = Be(e),
      n = {},
      i = {},
      a = {};
    return (
      Object.keys(r).forEach(function (e) {
        ((n[e] = t && void 0 !== Ve[e] ? Ve[e] : null),
          (i[e] = t && void 0 !== qe[e] ? qe[e] : null),
          (a[e] = r[e].label));
      }),
      (Ve = n),
      (qe = i),
      (He = a),
      (Fe = e),
      r
    );
  }

  function Ze(e) {
    if (
      ((e = Number(e) || 6),
      Me[e] || (e = 6),
      e !== Fe || !Object.keys(Ve).length)
    ) {
      var t = Ue(e, !0);
      (!(function (e) {
        var t = document.querySelector(".veh3d__fallback-grid");
        if (!t) return;
        var r = Object.keys(e),
          n = r
            .map(function (e) {
              var t = e.toUpperCase();
              return (
                '<button type="button" class="tyre3d__tyre" data-tyre="' +
                e +
                '" aria-label="' +
                (He[e] || "Tyre") +
                ' pressure"><span class="tyre3d__ring"><svg viewBox="0 0 24 24"><use href="#i-tyre"/></svg></span><span class="tyre3d__pos">' +
                t +
                '</span><span class="tyre3d__badge" data-badge="' +
                e +
                '">Tap to add</span></button>'
              );
            })
            .join("");
        ((t.innerHTML = n), t.classList.toggle("is-wide", r.length > 4));
      })(t),
        (function (e) {
          if (!Je.ready || !window.THREE) return;
          var t = window.THREE;
          Je.truck &&
            (Je.scene.remove(Je.truck),
            (function (e) {
              if (!e) return;
              e.traverse(function (e) {
                (e.geometry && e.geometry.dispose(),
                  e.material &&
                    (Array.isArray(e.material)
                      ? e.material.forEach(function (e) {
                          e.dispose();
                        })
                      : e.material.dispose()));
              });
            })(Je.truck));
          ((Je.truck = it(t, e)), Je.scene.add(Je.truck), at());
        })(t),
        je());
    }
  }

  function Ge(e) {
    var t,
      r =
        null === (t = Ve[e]) || "" === t || isNaN(t)
          ? null
          : (t = Number(t)) >= 100 && t <= 120
            ? "Pass"
            : t >= 90 && t <= 130
              ? "Monitor"
              : "Defect";
    return "no" === qe[e]
      ? "Defect"
      : "yes" === qe[e] && null === r
        ? "Pass"
        : r;
  }

  function je() {
    var e = Object.keys(Ve),
      t = e.filter(function (e) {
        return null !== Ve[e] || null !== qe[e];
      }),
      r = null,
      n = -1,
      i = {
        Pass: 0,
        Monitor: 1,
        Defect: 2,
      };
    t.forEach(function (e) {
      var t = Ge(e);
      i[t] > n && ((n = i[t]), (r = Ve[e]));
    });
    var a = u("#inTyrePress");
    (a && (a.value = null === r ? (n >= 0 ? "0" : "") : r),
      e.forEach(function (e) {
        var t = document.querySelector('.tyre3d__tyre[data-tyre="' + e + '"]'),
          r = document.querySelector('[data-badge="' + e + '"]');
        if (t && r) {
          var n = Ve[e],
            i = Ge(e);
          (t.classList.remove("is-set", "is-monitor", "is-defect"),
            null === n && null === qe[e]
              ? (r.textContent = "Tap to add")
              : ((r.textContent =
                  null === n
                    ? "yes" === qe[e]
                      ? "OK"
                      : "Not OK"
                    : n + " psi"),
                "Pass" === i
                  ? t.classList.add("is-set")
                  : "Monitor" === i
                    ? t.classList.add("is-monitor")
                    : t.classList.add("is-defect")),
            pt(e, i));
        }
      }),
      w(
        "tyre3dSummary",
        t.length +
          " of " +
          e.length +
          " tyre positions recorded (" +
          Fe +
          " tyres total)",
      ),
      Ne());
  }

  function ze(e) {
    ((We = e), w("tyrePopupTitle", He[e] || "Tyre"));
    var t = u("#tyrePopupInput");
    t && (t.value = null === Ve[e] ? "" : Ve[e]);
    var r = document.querySelector('.yn-toggle[data-yn-target="tyrePopupOk"]');
    r &&
      m(".yn-btn", r).forEach(function (t) {
        t.classList.toggle(
          "is-active",
          t.getAttribute("data-yn-val") === qe[e],
        );
      });
    var n = u("#tyrePopupOk");
    (n && (n.value = qe[e] || ""),
      (u("#tyrePopup").hidden = !1),
      (u("#tyreScrim").hidden = !1),
      (document.body.style.overflow = "hidden"),
      t &&
        setTimeout(function () {
          t.focus();
        }, 60));
  }

  /* ---------- NEW: Trip details popup (Trip status / Stops completed /
     Driving time / Distance left) — opened from the trip timer or its
     round info button; keeps the Assigned Trip header clean. ---------- */
  function openTripInfoPopup() {
    var p = u("#tripInfoPopup"),
      s = u("#tripInfoScrim");
    (p && (p.hidden = !1),
      s && (s.hidden = !1),
      (document.body.style.overflow = "hidden"));
  }

  function closeTripInfoPopup() {
    var p = u("#tripInfoPopup"),
      s = u("#tripInfoScrim");
    (p && (p.hidden = !0),
      s && (s.hidden = !0),
      (document.body.style.overflow = ""));
  }

  function Ye() {
    ((u("#tyrePopup").hidden = !0),
      (u("#tyreScrim").hidden = !0),
      (document.body.style.overflow = ""),
      (We = null));
  }

  function Qe() {
    if (We) {
      var e = u("#tyrePopupInput") ? At("#tyrePopupInput") : "";
      Ve[We] = "" === e ? null : Number(e);
      var t = At("#tyrePopupOk");
      ((qe[We] = "" === t ? null : t), je(), Ye());
    }
  }
  Ue(4, !1);
  var Je = {
    ready: !1,
    failed: !1,
    renderer: null,
    scene: null,
    camera: null,
    truck: null,
    wheels: {},
    canvas: null,
    dragging: !1,
    moved: !1,
    lastX: 0,
    lastY: 0,
    /* Start from the side profile so every selected tyre sits visibly
       outside the vehicle body; drivers can still drag to inspect it. */
    rotY: 0,
    rotX: 0.18,
    baseDist: 9.6,
    idleSpin: !1,
  };
  var Xe = [
    "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
    "https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js",
    "https://unpkg.com/three@0.128.0/build/three.min.js",
  ];

  function Ke(e, t) {
    if (((t = t || 0), void 0 === window.THREE))
      if (t >= Xe.length) e(!1);
      else {
        var r = document.createElement("script");
        ((r.src = Xe[t]),
          (r.async = !0),
          (r.onload = function () {
            e(void 0 !== window.THREE);
          }),
          (r.onerror = function () {
            Ke(e, t + 1);
          }),
          document.head.appendChild(r));
      }
    else e(!0);
  }
  var $e = "Please select the vehicle's tyres and check the tyre condition.",
    et = null,
    tt = !1,
    rt = [
      /google\s*us\s*english/i,
      /microsoft\s*(aria|jenny|emma)/i,
      /samantha/i,
      /google\s*uk\s*english\s*female/i,
      /moira|tessa|karen|fiona|serena|kate|joanna|kimberly|ivy|susan|victoria/i,
      /zira/i,
    ];

  function nt() {
    var e = u("#veh3dCanvas"),
      t = u("#veh3dFallback");
    (e && (e.hidden = !0),
      t && (t.hidden = !1),
      w("veh3dSideLabel", "Tap a tyre"));
  }

  function it(e, t) {
    var r = new e.Group(),
      n = new e.MeshPhysicalMaterial({
        color: 1990616,
        roughness: 0.32,
        metalness: 0.55,
        clearcoat: 0.6,
        clearcoatRoughness: 0.22,
      }),
      i = new e.MeshPhysicalMaterial({
        color: 1194639,
        roughness: 0.35,
        metalness: 0.5,
        clearcoat: 0.5,
        clearcoatRoughness: 0.25,
      }),
      a = new e.MeshPhysicalMaterial({
        color: 794680,
        roughness: 0.08,
        metalness: 0.2,
        clearcoat: 1,
        transparent: !0,
        opacity: 0.92,
      }),
      o = new e.MeshPhysicalMaterial({
        color: 15856889,
        roughness: 0.55,
        metalness: 0.1,
        clearcoat: 0.25,
      }),
      s = new e.MeshStandardMaterial({
        color: 14147046,
        roughness: 0.6,
        metalness: 0.1,
      }),
      c = new e.MeshStandardMaterial({
        color: 2304314,
        roughness: 0.75,
        metalness: 0.35,
      }),
      l = new e.MeshStandardMaterial({
        color: 14146530,
        roughness: 0.15,
        metalness: 0.95,
      }),
      d = new e.MeshStandardMaterial({
        color: 16775133,
        emissive: 16773828,
        emissiveIntensity: 0.9,
        roughness: 0.3,
      }),
      u = new e.MeshStandardMaterial({
        color: 16751918,
        emissive: 16747008,
        emissiveIntensity: 0.7,
      }),
      m = new e.MeshStandardMaterial({
        color: 11740188,
        emissive: 8000526,
        emissiveIntensity: 0.55,
      }),
      p = new e.MeshStandardMaterial({
        color: 16757760,
        emissive: 16751872,
        emissiveIntensity: 0.85,
      });

    function f(t, n, i, a, o, s, c) {
      var l = new e.Mesh(new e.BoxGeometry(t, n, i), a);
      return (
        l.position.set(o, s, c),
        (l.castShadow = !0),
        (l.receiveShadow = !0),
        r.add(l),
        l
      );
    }
    f(4.9, 0.16, 1.46, c, -0.05, -0.32, 0);
    (f(4.9, 0.06, 0.08, c, -0.05, -0.25, 0.66),
      f(4.9, 0.06, 0.08, c, -0.05, -0.25, -0.66));
    (f(1.28, 1.62, 1.6, n, 1.78, 0.78, 0),
      f(1.16, 0.22, 1.5, n, 1.74, 1.7, 0),
      f(0.62, 1, 1.42, i, 2.55, 0.15, 0),
      f(0.6, 0.06, 1.3, n, 2.55, 0.68, 0));
    f(0.06, 0.62, 1.06, l, 2.87, 0.16, 0);
    f(0.14, 0.22, 1.5, l, 2.92, -0.2, 0);
    var h = new e.Mesh(new e.CylinderGeometry(0.09, 0.09, 0.06, 20), d);
    ((h.rotation.z = Math.PI / 2), h.position.set(2.9, 0.22, 0.55), r.add(h));
    var v = h.clone();
    ((v.position.z = -0.55), r.add(v));
    var y = new e.Mesh(new e.SphereGeometry(0.045, 12, 12), u);
    (y.position.set(2.9, 0.02, 0.62), r.add(y));
    var g = y.clone();
    ((g.position.z = -0.62),
      r.add(g),
      (f(0.06, 0.82, 1.36, a, 2.32, 1, 0).rotation.z = -0.06),
      f(0.75, 0.62, 0.05, a, 1.5, 1.08, 0.79),
      f(0.75, 0.62, 0.05, a, 1.5, 1.08, -0.79),
      f(0.5, 0.05, 1.5, i, 2.35, 1.46, 0),
      ["l", "r"].forEach(function (e) {
        var t = "l" === e ? 1 : -1;
        (f(0.28, 0.03, 0.03, l, 2.02, 1.12, 0.86 * t),
          f(0.05, 0.22, 0.16, l, 2.15, 1.1, 0.98 * t));
      }));
    for (var b = -2; b <= 2; b++) {
      var _ = new e.Mesh(new e.SphereGeometry(0.028, 8, 8), p);
      (_.position.set(2.28, 1.83, 0.26 * b), r.add(_));
    }
    var k = new e.Mesh(new e.CylinderGeometry(0.045, 0.045, 1.3, 14), l);
    (k.position.set(1.16, 1.15, 0.68), r.add(k));
    var w = new e.Mesh(new e.ConeGeometry(0.065, 0.1, 14), c);
    (w.position.set(1.16, 1.83, 0.68), r.add(w));
    var D = new e.Mesh(new e.CylinderGeometry(0.19, 0.19, 0.62, 18), l);
    ((D.rotation.z = Math.PI / 2),
      D.position.set(0.65, -0.05, 0.72),
      (D.castShadow = !0),
      r.add(D));
    var T = new e.Mesh(new e.TorusGeometry(0.2, 0.015, 8, 20), c);
    ((T.rotation.y = Math.PI / 2), T.position.set(0.44, -0.05, 0.72), r.add(T));
    var C = T.clone();
    ((C.position.x = 0.86), r.add(C));
    (f(2.9, 1.7, 1.62, o, -1.15, 0.75, 0),
      f(2.94, 0.06, 1.66, s, -1.15, 1.63, 0),
      f(2.98, 0.1, 1.7, c, -1.15, -0.34, 0));
    for (var I = -2.45; I <= 0.15; I += 0.29)
      (f(0.035, 1.6, 0.02, s, I, 0.75, 0.815),
        f(0.035, 1.6, 0.02, s, I, 0.75, -0.815));
    (f(2.9, 0.05, 0.02, l, -1.15, 0.05, 0.816),
      f(2.9, 0.05, 0.02, l, -1.15, 0.05, -0.816));
    (f(0.05, 0.22, 0.16, m, -2.58, 0.1, 0.55),
      f(0.05, 0.22, 0.16, m, -2.58, 0.1, -0.55));
    f(0.12, 0.14, 1.66, l, -2.62, -0.3, 0);
    var S = new e.CylinderGeometry(0.47, 0.47, 0.34, 28),
      E = new e.CylinderGeometry(0.23, 0.23, 0.36, 20),
      L = new e.CylinderGeometry(0.06, 0.06, 0.4, 12),
      R = {
        color: 1645602,
        roughness: 0.95,
        metalness: 0.03,
      };
    var x = {
      color: 5989490,
      roughness: 0.35,
      metalness: 0.2,
      emissive: 0,
    };
    return (
      (t = t || Be(6)),
      (Je.wheels = {}),
      Object.keys(t).forEach(function (n) {
        var a = t[n],
          o = new e.Group(),
          s = [],
          /* Keep each tyre on its real left/right side. The side profile now
           reads as the reference layouts (one tyre per axle); rotating the
           truck exposes the matching tyres on the opposite side. */
          visibleX = a.x,
          visibleZ = a.z;
        (a.dual
          ? [
              [-0.22, 0],
              [0.22, 0],
            ]
          : [[0, 0]]
        ).forEach(function (pair) {
          var dx = pair[0],
            dz = pair[1];
          var r = (function (t, r) {
            var n = new e.Group(),
              i = new e.Mesh(S, new e.MeshStandardMaterial(R));
            ((i.rotation.x = Math.PI / 2), (i.castShadow = !0), n.add(i));
            var a = new e.Mesh(E, l);
            ((a.rotation.x = Math.PI / 2), n.add(a));
            var o = new e.Mesh(L, l);
            ((o.rotation.x = Math.PI / 2), n.add(o));
            for (var s = 0; s < 6; s++) {
              var d = new e.Mesh(
                new e.CylinderGeometry(0.018, 0.018, 0.42, 6),
                c,
              );
              d.rotation.x = Math.PI / 2;
              var u = (s / 6) * Math.PI * 2;
              (d.position.set(0.13 * Math.cos(u), 0.13 * Math.sin(u), 0),
                n.add(d));
            }
            return (
              n.position.set(t, 0, r),
              {
                w: n,
                tyre: i,
              }
            );
          })(visibleX + dx, visibleZ + dz);
          o.add(r.w);
          var n = new e.Mesh(
            new e.TorusGeometry(0.49, 0.04, 10, 28),
            new e.MeshStandardMaterial(x),
          );
          ((n.rotation.x = Math.PI / 2), r.w.add(n), s.push(n));
        });
        var d = a.dual ? 0.82 : 0.53,
          u = new e.TorusGeometry(d, 0.045, 8, 20, Math.PI),
          m = new e.Mesh(u, i);
        (m.position.set(visibleX, 0, visibleZ),
          (m.castShadow = !0),
          r.add(m),
          o.position.set(0, 0, 0),
          (o.userData.tyre = n));
        var p = new e.Mesh(
          new e.CylinderGeometry(0.66, 0.66, a.dual ? 1.15 : 0.5, 16),
          new e.MeshBasicMaterial({
            visible: !1,
          }),
        );
        ((p.rotation.x = Math.PI / 2),
          p.position.set(visibleX, 0, visibleZ),
          (p.userData.tyre = n),
          o.add(p),
          r.add(o),
          (Je.wheels[n] = {
            group: o,
            rings: s,
            hit: p,
          }));
      }),
      (r.position.y = 0.5),
      r
    );
  }

  function at() {
    if (Je.ready) {
      ((Je.truck.rotation.y = Je.rotY), (Je.truck.rotation.x = 0));
      var e = Je.baseDist;
      (Je.camera.position.set(0, 1.95 + 1.7 * Je.rotX, e),
        Je.camera.lookAt(0, 0.68, 0),
        Je.renderer.render(Je.scene, Je.camera));
    }
  }
  var ot = null;

  function st() {
    if (Je.ready) {
      var e = u("#veh3dScene");
      if (e) {
        var t = e.clientWidth,
          r = e.clientHeight;
        t &&
          r &&
          (Je.renderer.setSize(t, r, !1),
          (Je.camera.aspect = t / r),
          Je.camera.updateProjectionMatrix(),
          at());
      }
    }
  }

  function ct(e) {
    var t = window.THREE,
      r = (function (e) {
        var t = Je.canvas.getBoundingClientRect();
        return {
          x: ((e.clientX - t.left) / t.width) * 2 - 1,
          y: (-(e.clientY - t.top) / t.height) * 2 + 1,
        };
      })(e),
      n = new t.Raycaster();
    n.setFromCamera(r, Je.camera);
    var i = Object.keys(Je.wheels).map(function (e) {
        return Je.wheels[e].hit;
      }),
      a = n.intersectObjects(i, !1);
    return a.length ? a[0].object.userData.tyre : null;
  }

  function lt(e) {
    ((Je.dragging = !0),
      (Je.moved = !1),
      (Je.lastX = e.clientX),
      (Je.lastY = e.clientY),
      (Je.idleSpin = !1),
      ot && clearTimeout(ot),
      (ot = setTimeout(function () {
        Je.idleSpin = !0;
      }, 2600)));
    var t = u("#veh3dViewer");
    if ((t && t.classList.add("is-dragging"), Je.canvas.setPointerCapture))
      try {
        Je.canvas.setPointerCapture(e.pointerId);
      } catch (e) {}
  }

  function dt(e) {
    if (Je.dragging) {
      var t = e.clientX - Je.lastX,
        r = e.clientY - Je.lastY;
      ((Math.abs(t) > 3 || Math.abs(r) > 3) && (Je.moved = !0),
        (Je.lastX = e.clientX),
        (Je.lastY = e.clientY),
        (Je.rotY += 0.012 * t),
        (Je.rotX = Math.max(-0.3, Math.min(0.75, Je.rotX + 0.006 * r))),
        at());
    }
  }

  function ut(e) {
    if (Je.dragging) {
      Je.dragging = !1;
      var t = u("#veh3dViewer");
      if ((t && t.classList.remove("is-dragging"), !Je.moved)) {
        var r = ct(e);
        r && ze(r);
      }
    }
  }

  function mt() {
    ((Je.rotY = 0), (Je.rotX = 0.18), at());
  }

  function pt(e, t) {
    var r = Je.wheels && Je.wheels[e];
    if (r) {
      var n =
        {
          Pass: 1023320,
          Monitor: 13072128,
          Defect: 13841707,
        }[t] || 5989490;
      ((r.rings || []).forEach(function (e) {
        (e.material.color.setHex(n),
          e.material.emissive.setHex(t ? n : 0),
          (e.material.emissiveIntensity = t ? 0.4 : 0));
      }),
        at());
    }
  }

  function ft() {
    var e = u("#veh3dViewer"),
      t = u("#veh3dCanvas");
    if (e && t)
      return (function () {
        try {
          var e = document.createElement("canvas");
          return !(
            !window.WebGLRenderingContext ||
            (!e.getContext("webgl") && !e.getContext("experimental-webgl"))
          );
        } catch (e) {
          return !1;
        }
      })()
        ? void Ke(function (e) {
            if (!e) return ((Je.failed = !0), void nt());
            !(function (e) {
              var t = window.THREE;
              try {
                ((Je.canvas = e),
                  (Je.renderer = new t.WebGLRenderer({
                    canvas: e,
                    antialias: !0,
                    alpha: !0,
                  })),
                  Je.renderer.setPixelRatio(
                    Math.min(window.devicePixelRatio || 1, 2),
                  ),
                  "shadowMap" in Je.renderer &&
                    ((Je.renderer.shadowMap.enabled = !0),
                    (Je.renderer.shadowMap.type = t.PCFSoftShadowMap)),
                  "outputEncoding" in Je.renderer &&
                    t.sRGBEncoding &&
                    (Je.renderer.outputEncoding = t.sRGBEncoding),
                  (Je.scene = new t.Scene()),
                  (Je.camera = new t.PerspectiveCamera(30, 1, 0.1, 100)),
                  Je.scene.add(new t.HemisphereLight(14477055, 3357002, 0.85)));
                var r = new t.DirectionalLight(16774366, 1.05);
                (r.position.set(3.4, 5, 2.6),
                  (r.castShadow = !0),
                  r.shadow.mapSize.set(1024, 1024),
                  (r.shadow.camera.left = -4.5),
                  (r.shadow.camera.right = 4.5),
                  (r.shadow.camera.top = 4.5),
                  (r.shadow.camera.bottom = -4.5),
                  (r.shadow.camera.near = 0.5),
                  (r.shadow.camera.far = 14),
                  (r.shadow.bias = -0.0025),
                  Je.scene.add(r));
                var n = new t.DirectionalLight(12375295, 0.4);
                (n.position.set(-4, 2.5, -3), Je.scene.add(n));
                var i = new t.DirectionalLight(16777215, 0.3);
                (i.position.set(-1, 1.5, 4),
                  Je.scene.add(i),
                  (Je.truck = it(t, Be(Fe))),
                  (Je.truck.rotation.x = 0),
                  Je.scene.add(Je.truck));
                var a = new t.Mesh(
                  new t.PlaneGeometry(30, 30),
                  new t.ShadowMaterial({
                    opacity: 0.28,
                  }),
                );
                ((a.rotation.x = -Math.PI / 2),
                  (a.position.y = 0.001),
                  (a.receiveShadow = !0),
                  Je.scene.add(a),
                  (Je.idleSpin = !0),
                  (Je.ready = !0),
                  st(),
                  at(),
                  (o = performance.now()),
                  requestAnimationFrame(function e(t) {
                    if (Je.ready) {
                      var r = Math.min(0.05, (t - o) / 1e3);
                      ((o = t),
                        !Je.dragging &&
                          Je.idleSpin &&
                          ((Je.rotY += 0.18 * r), at()),
                        requestAnimationFrame(e));
                    }
                  }));
              } catch (e) {
                return ((Je.failed = !0), void nt());
              }
              var o;
              (e.addEventListener("pointerdown", lt),
                window.addEventListener("pointermove", dt),
                window.addEventListener("pointerup", ut),
                window.addEventListener("pointercancel", ut));
              var s = u("#veh3dReset");
              s && s.addEventListener("click", mt);
              if ("undefined" != typeof ResizeObserver) {
                var c = new ResizeObserver(function () {
                    st();
                  }),
                  l = u("#veh3dScene");
                l && c.observe(l);
              } else
                (window.addEventListener("resize", st), setTimeout(st, 300));
            })(t);
          })
        : ((Je.failed = !0), void nt());
  }
  var ht = {
      Good: "Good — locked and tracking",
      Weak: "Weak — intermittent signal",
      Faulty: "Faulty — no signal / unit fault",
    },
    vt = {
      Pass: "Alert — fit to drive",
      Monitor: "Slightly tired — fit with breaks",
      Defect: "Fatigued — not fit to drive",
    };

  function yt(e) {
    return "yes" === e ? "Yes" : "no" === e ? "No" : "";
  }

  function cr2(v) {
    return null === v || void 0 === v || "" === v ? "" : String(v).trim();
  }

  function gt() {
    var e = Ae();
    if (
      ((Ce = {
        tyrePressure: Number(At("#inTyrePress")) || 0,
        tyrePressures: {
          fl: Ve.fl,
          fr: Ve.fr,
          rl: Ve.rl,
          rr: Ve.rr,
        },
        tyrePressureOk: {
          fl: qe.fl,
          fr: qe.fr,
          rl: qe.rl,
          rr: qe.rr,
        },
        spareTyres: Number(At("#inTyreSpare")) || 0,
        tyreCondition: At("#inTyreCond"),
        batteryCondition: At("#inBattCond"),
        batteryFunctional: At("#inBattFunc"),
        fuelType: At("#inVcFuelType"),
        fuelPercent: Number(At("#inVcFuelLevel")) || 0,
        fuelOkForTrip: At("#inFuelOk"),
        gpsFixed: At("#inGpsFixed"),
        gpsId: At("#inGpsUnit"),
        gpsCondition: At("#inGpsCond"),
        driverFitToDrive: At("#inHealthDrive"),
        fatigue: At("#inHealthFatigue"),
        fuelQuantity: At("#inVcFuelQty"),
        notes: At("#inVcNotes"),
        grades: e,
      }),
      window.ZOHO && ZOHO.CREATOR && ZOHO.CREATOR.DATA)
    )
      return K.tripRecordId && K.driverRecordId
        ? void ZOHO.CREATOR.DATA.addRecords({
            form_name: "Vehicle_check_in",
            payload: {
              data: {
                Trip_ID: cr2(K.tripRecordId || K.tripId),
                Driver: cr2(
                  K.driverRecordId ||
                    K.driverEmployeeRecordId ||
                    K.driverName ||
                    K.driverId ||
                    "",
                ),
                Trip_Name: cr2(K.tripRecordId || K.tripId),
                Vehicle: cr2(K.vehicleRecordId || K.vehicleName),
                Front_right_tyre: yt(Ce.tyrePressureOk.fr),
                Front_left_tyre: yt(Ce.tyrePressureOk.fl),
                Spare_tyres_taken_for_the_trip: String(Ce.spareTyres),
                Rear_right_tyre: yt(Ce.tyrePressureOk.rr),
                Rear_left_tyre: yt(Ce.tyrePressureOk.rl),
                Tyre_condition: Ce.tyreCondition,
                Battery_condition: Ce.batteryCondition,
                Battery_functionality: yt(Ce.batteryFunctional),
                Fuel_type: Ce.fuelType,
                Fuel_condition_for_trip: yt(Ce.fuelOkForTrip),
                Current_fuel_percentage: String(Ce.fuelPercent),
                GPS_ID: Ce.gpsId,
                GPS_condition: ht[Ce.gpsCondition] || Ce.gpsCondition,
                GPS_fixed_and_working: yt(Ce.gpsFixed),
                Driver_condition_for_driving: yt(Ce.driverFitToDrive),
                Select_level: vt[Ce.fatigue] || Ce.fatigue,
                Notes: [
                  Ce.notes,
                  Ce.fuelQuantity ? "Fuel quantity: " + Ce.fuelQuantity : "",
                ]
                  .filter(Boolean)
                  .join(" | "),
              },
            },
          }).catch(function (e) {
            (console.error(gr, "Vehicle_check_in save failed:", e),
              R("Couldn't save the vehicle check-in — please try again."));
          })
        : (console.error(
            gr,
            "Vehicle_check_in not saved — no active trip. Start a trip from Today's Trip first.",
          ),
          void R(
            "Start a trip first — this check-in isn't linked to a trip yet.",
          ));
  }

  function bt() {
    if (
      !Object.keys(Pe).every(function (e) {
        return Pe[e];
      })
    )
      return void R("Complete all 5 vehicle checks before starting the trip.");
    if (!K.tripRecordId || !K.driverRecordId)
      return void R(
        "Can't start — no assigned trip/driver is loaded yet. Please wait for the page to finish loading and try again.",
      );
    Y("starttrip");
  }

  /* ============================================================
     START TRIP PAGE
     Prefills Trip ID/Name (from the assigned trip), today's date,
     Driver ID/Driver Name (from the currently logged-in driver) and
     a default Start Time — all of these are read-only, disabled
     fields the driver cannot edit. Live Location + Live Location
     URL stay disabled and empty until the driver explicitly taps
     "Use my location" (handled by the delegated [data-geo] click
     handler below), at which point they're captured and disabled
     too. Nothing here writes to Zoho — see submitStartTripPage()
     below for the actual save.
     ============================================================ */
  function prefillStartTripPage() {
    var drIdEl = u("#inStDriverId");
    drIdEl && (drIdEl.value = s.id || "");
    var drNmEl = u("#inStDriverName");
    drNmEl && (drNmEl.value = s.name || "");
    var idEl = u("#inStTripId");
    idEl && ((idEl.value = K.tripId || X || ""), (idEl.disabled = !0));
    var nmEl = u("#inStTripName");
    nmEl &&
      ((nmEl.value = K.tripName || K.tripId || X || ""), (nmEl.disabled = !0));
    var dEl = u("#inStDate");
    dEl && ((dEl.value = k()), (dEl.disabled = !0));
    var stEl = u("#inStStartTime");
    if (stEl) {
      if (!stEl.value) {
        var now = new Date();
        stEl.value = p(now.getHours()) + ":" + p(now.getMinutes());
      }
      stEl.disabled = !0;
    }
    /* Live Location / Live Location URL are left enabled (and empty) here
       — they only get filled in, and then disabled, once the driver taps
       "Use my location" (see the [data-geo="start"] handler). If GPS
       capture fails, the "Couldn't get your location" message lets the
       driver fall back to entering it manually, so we don't lock these
       down pre-emptively. */
  }
  /* ------------------------------------------------------------
     Validates the Start Trip form, updates local trip state/timer,
     then writes one record to the "Start_Trip_in_Driver" Zoho
     Creator form. Field mapping matches that form's actual API
     names exactly: Driver_ID, Trip_ID, Date_field, Live_Location,
     Starting_Odometer_Reading, Driver_Name, Trip_Name, Start_Time,
     Live_Location_URL. Driver_ID/Driver_Name are resolved from the
     logged-in user's own Employee_Form record (never just the
     trip's Primary Driver lookup) so the record saved always
     reflects whoever actually tapped "Start Trip".
     ------------------------------------------------------------ */
  async function submitStartTripPage() {
    var errEl = u("#startTripErr");
    errEl.hidden = !0;
    /* One trip at a time: a driver with a trip in transit must never get a
       second Start_Trip_in_Driver record. */
    if (hasActiveTrip())
      return (
        console.warn(
          gr,
          "Start Trip blocked — a trip is already in progress:",
          o.activeTripRecordId || K.tripRecordId,
        ),
        (errEl.textContent = "Complete your active trip first."),
        void (errEl.hidden = !1)
      );
    var startTimeVal = At("#inStStartTime");
    if (!startTimeVal)
      return (
        (errEl.textContent = "Enter the start time."),
        void (errEl.hidden = !1)
      );
    var odoVal = At("#inStOdo");
    if (!odoVal)
      return (
        (errEl.textContent = "Enter the starting odometer reading."),
        void (errEl.hidden = !1)
      );
    if (!K.tripRecordId)
      return (
        (errEl.textContent =
          "Can't start — no assigned Trip_Dispatch1 record is loaded yet."),
        void (errEl.hidden = !1)
      );
    var tripLabel = K.tripId || X || "",
      odometerNum = Number(odoVal) || 0,
      startMinsVal = _(startTimeVal),
      endMinsVal = (startMinsVal + a.maxWorkPerShift) % 1440,
      endTimeVal = p(Math.floor(endMinsVal / 60)) + ":" + p(endMinsVal % 60),
      endLocationVal = (K.record && le(K.record, "toLocation")) || "",
      locVal = At("#inStartLoc"),
      urlVal = At("#inStartUrl");
    var submitBtn = u("#btnSubmitStartTrip");
    var stStartRecordId = null;
    submitBtn && (submitBtn.disabled = !0);
    try {
      if (window.ZOHO && ZOHO.CREATOR && ZOHO.CREATOR.DATA) {
        var stTodayD = new Date(),
          stZohoDate =
            p(stTodayD.getDate()) +
            "-" +
            h[stTodayD.getMonth()] +
            "-" +
            stTodayD.getFullYear(),
          stDriverEmpId = await resolveEmployeeFormId(),
          /* Never substitute the trip's assigned driver here: this record
             must always identify the user currently logged into the portal. */
          stDriverId = stDriverEmpId || K.driverEmployeeRecordId || s.recordId;
        if (!stDriverId)
          throw new Error(
            "No Employee_Form record could be resolved for the logged-in driver.",
          );
        var tsPayload = {
          /* Creator lookup fields require their record IDs, not the visible
             Trip ID / Driver ID labels shown in the widget. */
          Driver_ID: cr2(stDriverId),
          Driver_Name: cr2(stDriverId),
          Trip_ID: cr2(K.tripRecordId),
          Trip_Name: cr2(K.tripRecordId),
          Date_field: stZohoDate,
          Starting_Odometer_Reading: odometerNum,
          Start_Time: b(startTimeVal),
        };
        locVal && (tsPayload.Live_Location = locVal);
        urlVal &&
          (tsPayload.Live_Location_URL = {
            url: urlVal,
          });
        await ZOHO.CREATOR.DATA.addRecords({
          form_name: "Start_Trip_in_Driver",
          payload: {
            data: tsPayload,
          },
        }).then(function (stRes) {
          /* CRITICAL FIX: ZOHO.CREATOR.DATA.addRecords() resolves its promise
             even when Creator REJECTS the record (bad lookup ID, a mandatory
             field missing, a validation rule failing, etc.) — it only
             rejects on transport-level failures. Every other save in this
             file (see saveFuel above) checks response.code === 3000 for
             this reason; Start Trip never did, so a rejected record still
             fell through to the "Data Added Successfully!" success path
             below with nothing actually written to Zoho. */
          console.log(gr, "Start_Trip_in_Driver addRecords response:", stRes);
          var stCode =
            stRes &&
            (stRes.code ||
              (stRes.result && stRes.result[0] && stRes.result[0].code));
          if (void 0 !== stCode && 3e3 !== stCode)
            throw new Error(
              "Creator rejected the record (code " + stCode + "): " + _r(stRes),
            );
          stStartRecordId =
            (stRes && stRes.data && (stRes.data.ID || stRes.data.id)) ||
            (stRes &&
              stRes.result &&
              stRes.result[0] &&
              (stRes.result[0].ID || stRes.result[0].id)) ||
            null;
        });
        if (ZOHO.CREATOR.DATA.updateRecords)
          try {
            await ZOHO.CREATOR.DATA.updateRecords({
              form_name: se,
              id: K.tripRecordId,
              payload: {
                data: {
                  Starting_Odometer: odometerNum,
                },
              },
            });
          } catch (odometerErr) {
            /* The Start Trip record was saved successfully; keep the driver
             moving if the optional dispatch odometer update is rejected. */
            console.error(
              gr,
              "Could not update Trip_Dispatch1 odometer:",
              odometerErr,
            );
          }
      }
    } catch (saveErr) {
      console.error(gr, "Start_Trip_in_Driver save failed:", saveErr);
      errEl.textContent = "Couldn't save the trip start: " + _r(saveErr);
      errEl.hidden = !1;
      return;
    } finally {
      submitBtn && (submitBtn.disabled = !1);
    }
    ((o.startTime = startTimeVal),
      (o.startTs = me(
        (stZohoDate ||
          p(new Date().getDate()) +
            "-" +
            h[new Date().getMonth()] +
            "-" +
            new Date().getFullYear()) +
          " " +
          b(startTimeVal),
      )),
      (o.startTripRecordId = stStartRecordId),
      (o.activeTripRecordId = K.tripRecordId),
      (o.endTime = endTimeVal),
      (o.tripStarted = !0),
      (o.startLocation = locVal),
      (o.startLocationUrl = urlVal),
      (o.endLocation = endLocationVal),
      (o.startOdometer = odometerNum),
      (o.tierWorked = [0, 0, 0, 0, 0]),
      (o.tierExtraMins = [0, 0, 0, 0, 0]),
      (o.tierNotified = [!1, !1, !1, !1, !1]),
      (o.tierWarned = [!1, !1, !1, !1, !1]),
      (o.activeBfmRuleIndex = 0),
      (o.breakElapsedMins = 0),
      (o.onBreak = !1),
      (o.bfmDayKey = bfmDateKey(new Date())),
      w("tripStart", startTimeVal),
      w("tripEnd", endTimeVal),
      w("tripStartedAt", startTimeVal),
      w("tripWindow", startTimeVal + " – " + endTimeVal),
      w("tripStartLoc", locVal),
      w("kpiStatus", "IN TRANSIT"));
    var stickyEl = u("#stickyStart");
    (stickyEl &&
      ((stickyEl.textContent = "Open trip"),
      stickyEl.setAttribute("data-nav", "trip")),
      ee(),
      B(o.startTs),
      W(),
      saveTripSnapshot(),
      pushBfmNotification(
        "green",
        "Trip " +
          (tripLabel || "") +
          " started — BFM monitoring is now active for this trip.",
      ),
      U ||
        ((U = !0),
        (function () {
          try {
            history.pushState(
              {
                skywayTripGuard: !0,
              },
              "",
            );
          } catch (e) {}
        })()),
      M(),
      R(
        "Trip " +
          tripLabel +
          " started at " +
          startTimeVal +
          " — saved to Zoho Creator",
      ),
      Y("trip"),
      persistBfmOnResume());
  }

  /* ------------------------------------------------------------
     Ends the trip in Creator: writes End_Time on the driver's open
     Start_Trip_in_Driver record. The server workflow "Update the end time"
     (on edit of that form) then marks the Run Sheet, the Trip (Trip_Status
     and Journey_Status = Completed) and the bookings Delivered. Without
     this write Trip_Status stays "In Transit" and the restore-on-boot
     logic would keep resurrecting a finished trip.
     Throws on ANY failure — the caller keeps the driver in the trip.
     ------------------------------------------------------------ */
  async function endStartTripRecord() {
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA) return;
    if (!o.startTripRecordId) {
      console.warn(
        gr,
        "complete: no Start_Trip_in_Driver record ID in memory — looking it up",
      );
      var rows = await restoreFetchTripRows(
          "Start_Trip_in_Driver1",
          K.tripRecordId,
          K.tripId,
        ),
        open = rows
          .filter(function (row) {
            return !row.End_Time;
          })
          .sort(function (x, y) {
            return (
              me(
                String(y.Date_field || "") + " " + String(y.Start_Time || ""),
              ) -
              me(String(x.Date_field || "") + " " + String(x.Start_Time || ""))
            );
          })[0];
      if (!open)
        throw new Error(
          "No open Start_Trip_in_Driver record was found for this trip.",
        );
      o.startTripRecordId = open.ID || open.id;
    }
    var now = new Date(),
      endTime =
        p(now.getHours()) +
        ":" +
        p(now.getMinutes()) +
        ":" +
        p(now.getSeconds()),
      payload = {
        data: {
          End_Time: endTime,
        },
      },
      DATA = ZOHO.CREATOR.DATA;
    console.log(
      gr,
      "complete: setting End_Time",
      endTime,
      "on Start_Trip_in_Driver",
      o.startTripRecordId,
    );
    /* SDK 2.0 updates a single record with updateRecordById; updateRecords is
       criteria-based, so it is only the fallback. */
    var res = await (DATA.updateRecordById
      ? DATA.updateRecordById({
          report_name: "Start_Trip_in_Driver1",
          id: o.startTripRecordId,
          payload: payload,
        })
      : DATA.updateRecords({
          report_name: "Start_Trip_in_Driver1",
          criteria: '(ID == "' + escapeCriteria(o.startTripRecordId) + '")',
          payload: payload,
        }));
    console.log(gr, "Start_Trip_in_Driver End_Time update response:", res);
    var code =
      res && (res.code || (res.result && res.result[0] && res.result[0].code));
    if (3e3 !== code)
      throw new Error(
        "Creator did not confirm the update (code " + code + "): " + _r(res),
      );
  }

  function _t() {
    var e = u("#checkInErr");
    e.hidden = !0;
    var t = u("#inHub").value,
      r = u("#inCheckInTime").value;
    if (!t)
      return (
        (e.textContent = "Select the hub you're checking in to."),
        void (e.hidden = !1)
      );
    if (!r)
      return (
        (e.textContent = "Enter your check-in time."),
        void (e.hidden = !1)
      );
    syncSelectedBookingIdsFromChecklist();
    if (BOOKING_ID_OPTIONS.length && !c.bookingIds.length)
      return (
        (e.textContent = "Select at least one Booking ID for this check-in."),
        void (e.hidden = !1)
      );
    var bookingIds = c.bookingIds;
    return (
      (c = {
        hub: t,
        date: u("#inCheckDate").value,
        inTime: r,
        outTime: u("#inCheckOutTime").value,
        bookingIds: bookingIds,
      }),
      R("Checked in at " + t + " — opening POD"),
      void Y("pod")
    );
  }

  function kt() {
    if (!c.hub) {
      var e = u("#inHub").value;
      if (!e) return void R("Select a hub and save your check-in first.");
      ((c.hub = e), (c.date = u("#inCheckDate").value || k()));
    }
    Y("pod");
  }
  /* ============================================================
     HUB CHECK-IN / CHECK-OUT — SAVE (POD)
     Saves the check-in/POD record to "Hub_Check_in_Check_Out1",
     mapping the selected Hub Name (chosen from the dropdown built
     by Dr() below) to its real Locations record ID via
     HUB_NAME_TO_ID, plus every other field entered on the page.
     ============================================================ */
  /* ---------- NEW: POD result page ----------
     Shared by both "Save POD" flows (per-hub check-in POD via wt(), and
     the Dispatch & POD per-Booking flow via savePodBooking()). Fills the
     read-only summary page shown right after a POD is saved, then lets
     the driver download a copy — purely additive, doesn't touch any of
     the existing save/data-mapping logic above it. */
  function populatePodResultPage(cfg) {
    cfg = cfg || {};
    /* Fresh save state for every popup (see POD_RESULT_META). */
    POD_RESULT_META = podBuildResultMeta(cfg, new Date());
    podResetCompletedStamp();
    var now = new Date(),
      dateStr =
        cfg.date ||
        now.toLocaleDateString("en-AU", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });
    (w("podResultDate", dateStr),
      w("podResultDriverName", cfg.driverName || s.name || "—"),
      w("podResultDriverId", cfg.driverId || s.id || "—"),
      w("podResultTripId", cfg.tripId || K.tripId || "—"),
      w("podResultAssignedTripId", K.tripId || cfg.tripId || "—"),
      w("podResultBookingId", cfg.bookingId || "—"),
      w("podResultStatus", cfg.status || "—"),
      w("podResultNote", cfg.note || "—"),
      w(
        "podResultReceivedAt",
        cfg.receivedAt ||
          now.toLocaleString("en-AU", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
      ));
    /* ---------- Vehicle / Customer / Pickup / Delivery ----------
       Sourced from the corresponding Trip / Booking_Shipments1
       records (see K.vehicleName and BOOKING_FIELD_CANDIDATES),
       never guessed — cfg carries "—" when a flow has no single
       Booking to resolve these against (e.g. the multi-booking hub
       check-in flow). The old, incorrect binding that put the
       driver's checked-in Hub name into "Delivery Location" has been
       removed; Delivery Location now comes only from the Booking. */
    (w("podResultCustomerName", cfg.customerName || "—"),
      w("podResultCompanyName", cfg.companyName || "—"),
      w("podResultVehicleNo", cfg.vehicleNo || K.vehicleName || "—"),
      w(
        "podResultShipperCompany",
        cfg.shipperCompany || cfg.companyName || "—",
      ),
      w("podResultPickupLocation", cfg.pickupLocation || "—"),
      w("podResultPickupAddress", cfg.pickupAddress || "—"),
      w(
        "podResultCustomerCompany",
        cfg.customerCompany || cfg.companyName || "—",
      ),
      w("podResultDeliveryLocation", cfg.deliveryLocation || "—"),
      w("podResultDeliveryAddress", cfg.deliveryAddress || "—"),
      w("podResultWeight", cfg.weight || "—"));
    var receivedByEl = u("#podResultReceivedByName");
    receivedByEl && (receivedByEl.value = cfg.receivedByName || "");
    var body = u("#podResultItemList");
    if (body) {
      var items = cfg.items || [];
      body.innerHTML = items.length
        ? items
            .map(function (it, idx) {
              return (
                "<tr><td>" +
                (idx + 1) +
                '</td><td class="item-name">' +
                (it.name || "—") +
                "</td><td>" +
                (it.qty || 0) +
                "</td><td>" +
                (it.receivedQty || 0) +
                "</td><td>" +
                (it.pendingQty || 0) +
                "</td><td>" +
                podPriceLabel(it.price) +
                "</td></tr>"
              );
            })
            .join("")
        : '<tr><td colspan="6" style="text-align:center;color:#8b93a7">No items recorded for this delivery.</td></tr>';
    }
    w("podResultOrderTotal", podOrderTotalLabel(cfg.items || []));
    RECEIVER_SIGNATURE_DATA = cfg.signature || null;
    /* BUG FIX: #podResultSignatureImg exists only to feed the
       PDF/print export (the live signature pad below is excluded
       from that export via data-pdf-exclude, so the export needs a
       plain <img> standing in for it). It must stay hidden on screen
       at all times — the earlier code unhid it whenever a signature
       existed, which rendered it stacked directly on top of the
       drawing pad (visible in the reported screenshot as two
       signatures). Only its "src" is kept in sync here; visibility
       is always hidden. */
    var sigImg = u("#podResultSignatureImg");
    sigImg &&
      (cfg.signature
        ? (sigImg.src = cfg.signature)
        : sigImg.removeAttribute("src"),
      (sigImg.hidden = !0));
    podResultSigPad.hasInk = false;
    var wrap = u("#podResultSigPadWrap");
    wrap && wrap.classList.remove("has-signature");
    /* Safari can retain an old layout for a hidden fixed modal until its
       next paint. Force a paint after replacing the POD rows so a newly
       saved item is visible on iPhone just as it is on Android/desktop. */
    var podView = u("#viewPodResult"),
      podModal = u("#podResultModalBox");
    podView &&
      requestAnimationFrame(function () {
        void podView.offsetHeight;
        podModal && (podModal.scrollTop = 0);
      });
  }

  function showPodResultView() {
    Y("podresult");
    var podView = u("#viewPodResult"),
      podModal = u("#podResultModalBox");
    if (!podView) return;
    /* Reassert the semantic state because older iOS webviews occasionally
       keep a previously-hidden view out of the composited fixed layer. */
    ((podView.hidden = !1),
      podView.setAttribute("aria-hidden", "false"),
      void podView.offsetHeight);
    ((podView.scrollTop = 0), podModal && (podModal.scrollTop = 0));
    requestAnimationFrame(function () {
      (initPodResultSignaturePad(), podShowCompletedStamp());
    });
  }

  /* ---------- Receiver signature — manual signature pad ----------
     Replaces the old "Upload signature" file input: the driver draws
     the receiver's signature directly on the POD Saved summary page,
     the same draw-to-sign interaction already used on the POD entry
     page (podSignaturePad), just on its own canvas/state here. Any
     signature already captured on the POD entry page is preloaded
     onto this canvas so it's visible immediately and can still be
     redrawn if it needs correcting. Drawing updates
     RECEIVER_SIGNATURE_DATA and the "src" of the hidden
     #podResultSignatureImg (never its visibility — see the
     BUG FIX note above); downloadPodResult()'s onclone step is what
     makes that image visible again, and only inside the exported
     snapshot, never on screen. */
  var RECEIVER_SIGNATURE_DATA = null;
  var podResultSigPad = {
    canvas: null,
    ctx: null,
    drawing: false,
    hasInk: false,
    lastX: 0,
    lastY: 0,
  };

  function podResultSigPadPointerPos(e) {
    var r = podResultSigPad.canvas.getBoundingClientRect();
    return {
      x: e.clientX - r.left,
      y: e.clientY - r.top,
    };
  }

  function podResultSigPadDown(e) {
    podResultSigPad.drawing = true;
    var p = podResultSigPadPointerPos(e);
    ((podResultSigPad.lastX = p.x), (podResultSigPad.lastY = p.y));
    podResultSigPad.canvas.setPointerCapture &&
      podResultSigPad.canvas.setPointerCapture(e.pointerId);
  }

  function podResultSigPadMove(e) {
    if (!podResultSigPad.drawing) return;
    var p = podResultSigPadPointerPos(e),
      ctx = podResultSigPad.ctx;
    (ctx.beginPath(),
      ctx.moveTo(podResultSigPad.lastX, podResultSigPad.lastY),
      ctx.lineTo(p.x, p.y),
      ctx.stroke(),
      (podResultSigPad.lastX = p.x),
      (podResultSigPad.lastY = p.y));
    if (!podResultSigPad.hasInk) {
      podResultSigPad.hasInk = true;
      var wrap = u("#podResultSigPadWrap");
      wrap && wrap.classList.add("has-signature");
    }
  }

  function podResultSigPadCommit() {
    if (!podResultSigPad.canvas) return;
    if (!podResultSigPad.hasInk) return void (RECEIVER_SIGNATURE_DATA = null);
    RECEIVER_SIGNATURE_DATA = podResultSigPad.canvas.toDataURL("image/png");
    var sigImg = u("#podResultSignatureImg");
    sigImg && (sigImg.src = RECEIVER_SIGNATURE_DATA);
  }

  function podResultSigPadUp() {
    ((podResultSigPad.drawing = false), podResultSigPadCommit());
  }

  function podResultSigPadClear() {
    var c = podResultSigPad.canvas;
    if (!c) return;
    var ctx = podResultSigPad.ctx,
      ratio = window.devicePixelRatio || 1;
    (ctx.clearRect(0, 0, c.width / ratio, c.height / ratio),
      (podResultSigPad.hasInk = false));
    var wrap = u("#podResultSigPadWrap");
    wrap && wrap.classList.remove("has-signature");
    RECEIVER_SIGNATURE_DATA = null;
    var sigImg = u("#podResultSignatureImg");
    sigImg && ((sigImg.hidden = !0), sigImg.removeAttribute("src"));
  }

  function podResultSigPadResize() {
    var c = podResultSigPad.canvas;
    if (!c) return;
    var ratio = window.devicePixelRatio || 1,
      w2 = c.clientWidth || 600,
      h2 = c.clientHeight || 140,
      savedData = podResultSigPad.hasInk ? c.toDataURL() : null;
    ((c.width = w2 * ratio), (c.height = h2 * ratio));
    var ctx = c.getContext("2d");
    (ctx.scale(ratio, ratio),
      (ctx.lineWidth = 2),
      (ctx.lineCap = "round"),
      (ctx.lineJoin = "round"),
      (ctx.strokeStyle = "#0F2748"),
      (podResultSigPad.ctx = ctx));
    savedData && podResultSigPadLoad(savedData, true);
  }

  function podResultSigPadLoad(dataUrl, isResizeRedraw) {
    if (!podResultSigPad.canvas || !dataUrl) return;
    var img = new Image();
    ((img.onload = function () {
      var c = podResultSigPad.canvas,
        ratio = window.devicePixelRatio || 1,
        w2 = c.width / ratio,
        h2 = c.height / ratio,
        ctx = podResultSigPad.ctx;
      if (!ctx) return;
      /* Fit the loaded signature into the pad without distortion. */
      var scale = Math.min(w2 / img.width, h2 / img.height, 1),
        dw = img.width * scale,
        dh = img.height * scale,
        dx = (w2 - dw) / 2,
        dy = (h2 - dh) / 2;
      (ctx.clearRect(0, 0, w2, h2), ctx.drawImage(img, dx, dy, dw, dh));
      podResultSigPad.hasInk = true;
      var wrap = u("#podResultSigPadWrap");
      wrap && wrap.classList.add("has-signature");
      isResizeRedraw || podResultSigPadCommit();
    }),
      (img.src = dataUrl));
  }

  function initPodResultSignaturePad() {
    var c = u("#podResultSignaturePad");
    if (!c) return;
    if (podResultSigPad.canvas !== c) {
      ((podResultSigPad.canvas = c), (podResultSigPad.hasInk = false));
      (c.addEventListener("pointerdown", podResultSigPadDown),
        c.addEventListener("pointermove", podResultSigPadMove),
        window.addEventListener("pointerup", podResultSigPadUp));
    }
    (podResultSigPadResize(),
      !podResultSigPad.hasInk &&
        RECEIVER_SIGNATURE_DATA &&
        podResultSigPadLoad(RECEIVER_SIGNATURE_DATA, true));
  }

  /* ---------- NEW: real PDF export for the POD Saved page ----------
     Renders the exact #podResultDoc sheet (same layout/CSS/values the
     driver already sees) to a canvas via html2canvas, then drops that
     image into a single A4 jsPDF page — no server round-trip, no
     change to the on-screen popup markup. Both libraries are pulled
     from the same trusted CDN this widget already loads Three.js
     from (see Xe/Ke above); if either fails to load, this falls back
     to the previous "download an HTML copy" behaviour so a driver in
     a bad network spot is never left with a dead Download button. */
  var PDF_LIBS = {
    html2canvas:
      "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
    jspdf:
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  };

  function loadScriptOnce(src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + src + '"]');
      if (existing)
        return void (existing.getAttribute("data-loaded") === "1"
          ? resolve()
          : existing.addEventListener("load", function () {
              resolve();
            }));
      var el = document.createElement("script");
      ((el.src = src),
        (el.async = !0),
        (el.onload = function () {
          (el.setAttribute("data-loaded", "1"), resolve());
        }),
        (el.onerror = function () {
          reject(new Error("Failed to load " + src));
        }),
        document.head.appendChild(el));
    });
  }

  function ensurePdfLibs() {
    var need = [];
    window.html2canvas || need.push(loadScriptOnce(PDF_LIBS.html2canvas));
    (window.jspdf && window.jspdf.jsPDF) ||
      need.push(loadScriptOnce(PDF_LIBS.jspdf));
    return need.length ? Promise.all(need) : Promise.resolve();
  }

  function downloadPodResultAsHtmlFallback(doc, fileSafeId) {
    /* The live #podResultDoc keeps #podResultSignatureImg hidden on
       screen (the visible signature is the drawing pad, excluded from
       export via data-pdf-exclude) — so for this exported copy, clone
       the doc and unhide the image only in the clone, leaving the
       on-screen page untouched. */
    var exportClone = doc.cloneNode(!0),
      cloneSigImg = exportClone.querySelector("#podResultSignatureImg");
    cloneSigImg && (cloneSigImg.hidden = !1);
    var html = exportClone.outerHTML,
      page =
        "<!doctype html><html><head><meta charset='utf-8'><title>Proof of Delivery — " +
        fileSafeId +
        "</title><style>*{box-sizing:border-box}@page{size:A4;margin:0}body{font-family:'Segoe UI',Arial,sans-serif;background:#f2f4f7;margin:0;padding:20px;color:#1a1a1a}.poddoc-sheet{width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:12mm 15mm;border-radius:4px;box-shadow:0 0 8px rgba(0,0,0,.15)}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px}.logo-block{display:flex;flex-direction:column}.logo-row{display:flex;align-items:center;gap:8px}.logo-name{font-size:26px;font-weight:800;color:#f7941d;letter-spacing:1px}.logo-name .sky{color:#1c3f94}.logo-sub{font-size:20px;font-weight:700;color:#1c3f94;margin-top:-6px}.arrow{width:0;height:0;border-top:12px solid transparent;border-bottom:12px solid transparent;border-left:20px solid #1c3f94;margin-left:-4px}.arrow.orange{border-left-color:#f7941d;margin-left:-14px}.tagline{font-size:11px;letter-spacing:3px;color:#555;margin-top:6px}.title-block{text-align:right}.title-block h1{margin:0;font-size:32px;color:#14224e;letter-spacing:1px}.title-block .sub{font-size:12px;letter-spacing:3px;color:#8b93a7;margin-top:2px}.date-line{text-align:right;margin:10px 0 14px;font-weight:700;font-size:14px}.date-line .field-val{border:none;border-bottom:1px solid #999;min-width:180px;font-size:14px;margin-left:8px;padding:2px 4px;font-weight:700;display:inline-block}.section-title{background:#cfe2f3;color:#14224e;font-weight:700;font-size:13px;letter-spacing:.5px;padding:6px 12px;margin-top:12px;margin-bottom:8px;border-radius:2px}.two-col{display:flex;gap:30px;width:100%;min-width:0}.col{flex:1;min-width:0}.field-row{display:flex;align-items:baseline;margin-bottom:6px;font-size:12.5px;min-width:0}.field-label{min-width:170px;color:#222;flex-shrink:0}.field-colon{margin:0 8px;flex-shrink:0}.field-val{flex:1;min-width:0;border:none;border-bottom:1px solid #bbb;font-size:12px;padding:1px 4px;font-weight:600}table.order-table{width:100%;border-collapse:collapse;margin-bottom:6px}table.order-table th{background:#f3f5f8;border:1px solid #cfd4dc;padding:6px;font-size:12px;text-align:center;color:#14224e}table.order-table td{border:1px solid #cfd4dc;padding:4px 6px;text-align:center;height:24px;font-size:12px}table.order-table td.item-name{text-align:left}.order-total-row td{text-align:right;font-weight:700;padding:10px 12px}.signoff-cols{display:flex;justify-content:space-between;gap:25px;margin-top:10px;width:100%;min-width:0}.poddoc-signbox{min-height:60px;display:flex;align-items:center;padding:4px}.poddoc-signbox img{max-height:58px;max-width:100%}[data-pdf-exclude]{display:none!important}@media print{body{background:#fff;padding:0;margin:0}.poddoc-sheet{box-shadow:none;width:210mm;min-height:297mm;margin:0;padding:12mm 15mm}}</style></head><body>" +
        html +
        "</body></html>";
    try {
      var blob = new Blob([page], {
          type: "text/html",
        }),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      ((a.href = url),
        (a.download = "Proof_of_Delivery_" + fileSafeId + ".html"),
        document.body.appendChild(a),
        a.click(),
        a.remove(),
        setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 4e3),
        R("PDF export unavailable offline — downloaded an HTML copy instead."));
    } catch (err) {
      (console.error(gr, "POD download fallback failed:", err), window.print());
    }
  }

  /* ---------- POD_PDF form — save the POD Saved record to Zoho Creator ----------
     Everything shown on the POD Saved popup gets written to the
     POD_PDF form (see the form definition supplied for this widget)
     via its report, POD_PDF1 — confirmed report link name — including
     uploading the generated PDF into POD_File_upload and the
     receiver's drawn signature into Received_by_signature. */
  var POD_PDF_REPORT_NAME = "POD_PDF1";

  function dataUrlToFile(dataUrl, filename) {
    if (!dataUrl) return null;
    var parts = String(dataUrl).split(","),
      meta = parts[0] || "",
      b64 = parts[1] || "",
      mimeMatch = /data:([^;]+);base64/.exec(meta),
      mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
    try {
      var bin = atob(b64),
        len = bin.length,
        arr = new Uint8Array(len);
      for (var i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
      return new File([arr], filename, {
        type: mime,
      });
    } catch (err) {
      return (console.error(gr, "dataUrlToFile() failed:", err), null);
    }
  }

  /* Reads the exact text currently shown on the POD Saved popup for a
     given field, so what gets saved to Zoho Creator always matches
     what the driver sees — not a separately-tracked copy of the data
     that could drift out of sync. Treats the placeholder "—" as
     empty so blank fields aren't saved as a literal dash. */
  function podResultDomValue(id) {
    var el = u("#" + id);
    if (!el) return "";
    var v = "INPUT" === el.tagName ? el.value : el.textContent;
    return ((v = (v || "").trim()), "—" === v ? "" : v);
  }

  /* ---------- POD Saved popup -> Zoho Creator (POD_PDF + ORDER_DETAILS) ----------
     POD_RESULT_META carries what the payload builder can't safely read back
     from the popup's display text:
       - Zoho-formatted date / date-time strings (the popup shows e.g.
         "Saturday 19 September 2026", which Creator rejects for a Date
         field and would fail the WHOLE add),
       - the item rows for the ORDER_DETAILS subform,
       - save progress, so pressing Save again after a partial failure
         never creates a duplicate POD_PDF record or duplicate item rows.
     It is rebuilt every time the popup is populated. */
  var POD_RESULT_META = {
    dateZoho: "",
    receivedAtZoho: "",
    items: [],
    savedRecordId: null,
    itemRowsSaved: 0,
    signatureUploaded: false,
    pdfUploaded: false,
  };

  function podZohoDate(d) {
    return p(d.getDate()) + "-" + h[d.getMonth()] + "-" + d.getFullYear();
  }

  function podZohoDateTime(d) {
    return (
      podZohoDate(d) +
      " " +
      p(d.getHours()) +
      ":" +
      p(d.getMinutes()) +
      ":" +
      p(d.getSeconds())
    );
  }

  function podBuildResultMeta(cfg, now) {
    cfg = cfg || {};
    var cfgDate = String(cfg.date || "").trim();
    return {
      /* wt() already passes "dd-MMM-yyyy"; the dispatch flow passes the
         long display date, so fall back to today in Zoho's format. */
      dateZoho: /^\d{2}-[A-Za-z]{3}-\d{4}$/.test(cfgDate)
        ? cfgDate
        : podZohoDate(now),
      receivedAtZoho: podZohoDateTime(now),
      items: (cfg.items || []).map(function (it) {
        return {
          name: it.name,
          qty: it.qty,
          receivedQty: it.receivedQty,
          pendingQty: it.pendingQty,
          price: it.price,
        };
      }),
      savedRecordId: null,
      itemRowsSaved: 0,
      signatureUploaded: false,
      pdfUploaded: false,
    };
  }

  function podPriceLabel(val) {
    return null == val || "" === val || isNaN(Number(val))
      ? "—"
      : Number(val).toFixed(2);
  }

  /* Order total = sum of price x total qty, only when at least one item
     actually has a price; otherwise the placeholder is kept. */
  function podOrderTotalLabel(items) {
    var any = !1,
      total = 0;
    (items || []).forEach(function (it) {
      null == it.price ||
        isNaN(Number(it.price)) ||
        ((any = !0), (total += Number(it.price) * (Number(it.qty) || 0)));
    });
    return any ? total.toFixed(2) : "—";
  }

  function buildPodPdfPayload() {
    var payload = {},
      textFieldMap = {
        Company_Name: "podResultCompanyName",
        Vehicle_No: "podResultVehicleNo",
        /* Customer_Name is no longer shown on the POD Saved popup
           (removed per an earlier request) — left mapped here in
           case the DOM element still exists elsewhere; otherwise
           podResultDomValue() safely returns "". */
        Customer_Name: "podResultCustomerName",
        Driver_Name: "podResultDriverName",
        /* The "Trip ID" row was removed from the popup; "Assigned
           Trip ID" is now the only trip identifier shown, and it
           maps into the form's Trip_ID field. */
        Trip_ID: "podResultAssignedTripId",
        Booking_ID: "podResultBookingId",
        Shipper_Company: "podResultShipperCompany",
        Pickup_Location: "podResultPickupLocation",
        Customer_Company_Recipient: "podResultCustomerCompany",
        Delivery_Location: "podResultDeliveryLocation",
        Delivery_Status: "podResultStatus",
        Delivery_Note: "podResultNote",
        Received_by_print_name: "podResultReceivedByName",
      };
    Object.keys(textFieldMap).forEach(function (formField) {
      var v = podResultDomValue(textFieldMap[formField]);
      v && (payload[formField] = v);
    });
    /* Weight is a Decimal field: a non-numeric string (e.g. "12 kg") makes
       Creator reject the whole record, so only a real number is sent. */
    var weightTxt = podResultDomValue("podResultWeight");
    if (weightTxt) {
      var weightNum = parseFloat(String(weightTxt).replace(/,/g, ""));
      isNaN(weightNum) || (payload.Weight = weightNum);
    }
    /* Date_field1 is a Date field and Date_and_Time_Received a Date-Time
       field — Creator only accepts "dd-MMM-yyyy" / "dd-MMM-yyyy HH:mm:ss",
       not the human-readable text shown on the popup. */
    POD_RESULT_META.dateZoho &&
      (payload.Date_field1 = POD_RESULT_META.dateZoho);
    POD_RESULT_META.receivedAtZoho &&
      (payload.Date_and_Time_Received = POD_RESULT_META.receivedAtZoho);
    /* Driver ID must always be the logged-in driver's own ID, taken
       directly from the session rather than trusting the DOM text
       (which is normally the same value, but this guarantees it). */
    payload.Driver_ID = String(
      (s && s.id) || podResultDomValue("podResultDriverId") || "",
    );
    payload.Driver_ID || delete payload.Driver_ID;
    return payload;
  }

  /* One ORDER_DETAILS row per item on the popup's Order Details table:
     Item_Name, Total_Qty, Received_Qty, Pending_Qty and — only when the
     item has a price — Price and Order_Total_AUD (price x Total Qty). */
  function buildOrderDetailsRows() {
    return (POD_RESULT_META.items || []).map(function (it, idx) {
      var name = String(null == it.name ? "" : it.name).trim(),
        total = Number(it.qty),
        recv = Number(it.receivedQty),
        pend = Number(it.pendingQty),
        row = {};
      total = isFinite(total) ? total : 0;
      recv = isFinite(recv) ? recv : 0;
      pend = isFinite(pend) ? pend : Math.max(0, total - recv);
      row.Item_Name = name && "—" !== name ? name : "Item " + (idx + 1);
      row.Total_Qty = total;
      row.Received_Qty = recv;
      row.Pending_Qty = pend;
      if (null != it.price && "" !== it.price && isFinite(Number(it.price))) {
        row.Price = Number(it.price);
        row.Order_Total_AUD = Math.round(Number(it.price) * total * 100) / 100;
      }
      return row;
    });
  }

  /* Creator answers HTTP 200 with a non-3000 code for validation errors,
     and rejects (status/responseText) for HTTP errors. Normalise the
     first kind into a thrown Error so both take the same path. */
  function podCreatorResponseError(res) {
    if (!res) return "";
    var code = res.code;
    void 0 === code &&
      res.result &&
      res.result[0] &&
      (code = res.result[0].code);
    if (void 0 === code || 3e3 === code) return "";
    var first = (res.result && res.result[0]) || {},
      detail = res.message || first.message || "";
    var errObj = res.error || first.error;
    if (errObj)
      try {
        detail += (detail ? " " : "") + JSON.stringify(errObj);
      } catch (x) {}
    return (
      "Creator rejected the record (code " +
      code +
      (detail ? ": " + detail : "") +
      ")"
    );
  }

  function podRecordId(res) {
    var d =
      res && (res.data || (res.result && res.result[0] && res.result[0].data));
    return (d && (d.ID || d.id)) || null;
  }

  function podAddRecord(formName, data) {
    return ZOHO.CREATOR.DATA.addRecords({
      form_name: formName,
      payload: {
        data: data,
      },
    }).then(function (res) {
      var bad = podCreatorResponseError(res);
      if (bad) {
        var er = new Error(formName + ": " + bad);
        er.creatorResponse = res;
        throw er;
      }
      return res;
    });
  }

  function podIsPermissionError(err) {
    var raw = "";
    try {
      raw = "string" == typeof err ? err : JSON.stringify(err);
    } catch (x) {
      raw = String(err);
    }
    if (err && err.message) raw += " " + err.message;
    return (
      /"?status"?\s*[:=]\s*403/.test(raw) ||
      /\b289[5-9]\b/.test(raw) ||
      /permission denied/i.test(raw)
    );
  }

  function podSaveErrorMessage(err) {
    if (podIsPermissionError(err))
      return (
        "Zoho Creator refused the save (HTTP 403 / code 2899 — " +
        '"Permission denied to add record(s)"). This is a Creator permission setting, not something ' +
        "this dashboard's code can override: give the portal profile this driver logs in with Add + View " +
        "permission on the POD_PDF and ORDER_DETAILS forms (and View + Edit on the POD_PDF1 and " +
        "ORDER_DETAILS_Report reports), then press Save again."
      );
    return _r(err);
  }

  /* Adds ORDER_DETAILS rows one by one, linked to the POD_PDF record through
     the subform's Booking_ID lookup. Only used as the fallback when the
     nested add below is rejected. Resumes from meta.itemRowsSaved so a retry
     never duplicates rows that already went in. */
  function podAddOrderDetailsRows(parentId, rows) {
    var meta = POD_RESULT_META;
    return rows.reduce(function (chain, row, idx) {
      return idx < meta.itemRowsSaved
        ? chain
        : chain.then(function () {
            var data = {};
            Object.keys(row).forEach(function (k) {
              data[k] = row[k];
            });
            data.Booking_ID = parentId;
            return podAddRecord("ORDER_DETAILS", data)
              .then(function () {
                meta.itemRowsSaved = idx + 1;
              })
              .catch(function (err) {
                console.error(
                  gr,
                  "ORDER_DETAILS item " +
                    (idx + 1) +
                    " of " +
                    rows.length +
                    " failed to save:",
                  err,
                );
                throw err;
              });
          });
    }, Promise.resolve());
  }

  function podUploadOne(recordId, fieldName, file) {
    return ZOHO.CREATOR.FILE.uploadFile({
      report_name: POD_PDF_REPORT_NAME,
      id: recordId,
      field_name: fieldName,
      file: file,
    }).then(function (res) {
      var bad = podCreatorResponseError(res);
      if (bad) throw new Error(bad);
      return res;
    });
  }

  /* Friendly explanation for HTTP 403 / code 2897 on an attachment upload.
     Attaching a file to an existing record is an UPDATE in Zoho Creator's
     permission model, so a portal profile that may Add a POD_PDF record
     (which is why the POD and its items save fine) can still be refused
     here. This is a Creator permission setting, not something widget code
     can override, so the message tells the driver/admin exactly what to
     change. */
  function podAttachPermissionMessage(labels) {
    return (
      "Zoho Creator saved the POD, but refused to attach the " +
      labels.join(" and ") +
      ' (HTTP 403 / code 2897 \u2014 "Permission denied to update record(s)"). Attaching a file counts as ' +
      "editing the record, so the portal profile this driver signs in with needs Edit permission on the " +
      POD_PDF_REPORT_NAME +
      " report, and the POD_File_upload and Received_by_signature fields must be " +
      "editable for that profile. Everything else on the POD is saved; once an admin enables that, press " +
      "Save to retry the attachment (or use Download to keep a copy of the PDF)."
    );
  }

  /* Attaches the receiver's drawn signature and the generated PDF to the
     saved POD_PDF record. Never throws — failures come back as warnings so
     the caller can tell the driver and let them retry just the attachments.

     The uploads run ONE AT A TIME (signature, then PDF), not in parallel:
     two simultaneous writes to the same record are unreliable on iPhone
     Safari / in-app webviews, and if the first upload is refused for
     permission the second would be refused for the same reason, so it is
     skipped and reported once instead of twice. */
  function podUploadAttachments(recordId, pdfBlob, fileSafeId) {
    var meta = POD_RESULT_META,
      warnings = [],
      jobs = [],
      needSig = !!RECEIVER_SIGNATURE_DATA && !meta.signatureUploaded,
      needPdf = !!pdfBlob && !meta.pdfUploaded;
    if (!needSig && !needPdf) return Promise.resolve(warnings);
    if (!window.ZOHO.CREATOR.FILE || !ZOHO.CREATOR.FILE.uploadFile)
      return (
        console.error(
          gr,
          "ZOHO.CREATOR.FILE.uploadFile is not available — signature/PDF not uploaded.",
        ),
        Promise.resolve([
          "The file upload API isn't available, so the signature/PDF were not attached.",
        ])
      );
    if (needSig) {
      var sigFile = dataUrlToFile(
        RECEIVER_SIGNATURE_DATA,
        "Signature_" + fileSafeId + ".png",
      );
      sigFile &&
        jobs.push({
          label: "signature",
          field: "Received_by_signature",
          file: sigFile,
          ok: !1,
          onDone: function () {
            meta.signatureUploaded = !0;
          },
        });
    }
    if (needPdf) {
      var pdfFile = new File(
        [pdfBlob],
        "Proof_of_Delivery_" + fileSafeId + ".pdf",
        {
          type: "application/pdf",
        },
      );
      jobs.push({
        label: "PDF",
        field: "POD_File_upload",
        file: pdfFile,
        ok: !1,
        onDone: function () {
          meta.pdfUploaded = !0;
        },
      });
    }
    var denied = !1;
    return jobs
      .reduce(function (chain, job) {
        return chain.then(function () {
          if (denied) return;
          return podUploadOne(recordId, job.field, job.file)
            .then(function () {
              ((job.ok = !0), job.onDone());
            })
            .catch(function (err) {
              console.error(
                gr,
                "POD_PDF " + job.label + " upload failed:",
                err,
              );
              podIsPermissionError(err)
                ? (denied = !0)
                : warnings.push(
                    "The " +
                      job.label +
                      " could not be attached (" +
                      _r(err) +
                      ").",
                  );
            });
        });
      }, Promise.resolve())
      .then(function () {
        if (denied)
          warnings.unshift(
            podAttachPermissionMessage(
              jobs
                .filter(function (j) {
                  return !j.ok;
                })
                .map(function (j) {
                  return j.label;
                }),
            ),
          );
        return warnings;
      });
  }

  /* Saves the POD_PDF record together with its ORDER_DETAILS subform rows,
     then attaches the signature and PDF (Zoho Creator attaches files to an
     existing record, not inline with addRecords).

     Unlike the old version, failures are NOT swallowed: a rejected add
     (e.g. HTTP 403 "Permission denied to add record(s)") rejects this
     promise, so the caller shows the error instead of a false "POD saved"
     toast. Resolves to { id, warnings } — warnings are attachment problems
     on a record that DID save. pdfBlob is optional. */
  function savePodPdfToZohoCreator(pdfBlob, fileSafeId) {
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA)
      return Promise.resolve({
        preview: !0,
        warnings: [],
      });
    var meta = POD_RESULT_META,
      rows = buildOrderDetailsRows(),
      ensureParent;
    if (meta.savedRecordId) ensureParent = Promise.resolve(meta.savedRecordId);
    else {
      var payload = buildPodPdfPayload(),
        withItems = {};
      Object.keys(payload).forEach(function (k) {
        withItems[k] = payload[k];
      });
      rows.length && (withItems.ORDER_DETAILS = rows);

      var takeId = function (res, itemsAlreadySaved) {
        var id = podRecordId(res);
        if (!id)
          throw new Error(
            "The POD_PDF record was saved but Zoho returned no record ID, so the items, signature and PDF could not be linked to it.",
          );
        meta.savedRecordId = id;
        meta.itemRowsSaved = itemsAlreadySaved ? rows.length : 0;
        return id;
      };
      /* Preferred path: the items go in the same request as the parent,
         as the ORDER_DETAILS subform (Creator's documented way to add a
         parent with its subform rows, all-or-nothing). */
      ensureParent = podAddRecord("POD_PDF", withItems).then(
        function (res) {
          return takeId(res, !0);
        },
        function (err) {
          if (!rows.length || podIsPermissionError(err)) throw err;
          console.warn(
            gr,
            "POD_PDF add with nested ORDER_DETAILS rows was rejected — retrying with the parent alone, then adding the item rows one by one:",
            err,
          );
          return podAddRecord("POD_PDF", payload).then(function (res) {
            return takeId(res, !1);
          });
        },
      );
    }
    return ensureParent.then(function (id) {
      var itemsDone =
        rows.length && meta.itemRowsSaved < rows.length
          ? podAddOrderDetailsRows(id, rows)
          : Promise.resolve();
      return itemsDone
        .then(function () {
          return podUploadAttachments(id, pdfBlob, fileSafeId);
        })
        .then(function (warnings) {
          return {
            id: id,
            warnings: warnings,
          };
        });
    });
  }

  /* Builds the jsPDF document for #podResultDoc (shared by the
     Download button and the Save button below, so the two PDFs are
     always generated the exact same way). Resolves to the jsPDF
     instance — callers decide whether to pdf.save() it locally,
     pdf.output("blob") it for upload, or both. */
  /* PDF_RENDER_WIDTH_PX — fixed clone-viewport width used only while
     html2canvas rasterises #podResultDoc, on every device. Without this,
     html2canvas sizes its off-screen clone to the *real* window's width,
     so on a phone (<720px) the ".poddoc-sheet" mobile media query fires
     inside the clone too — collapsing the two-column layout and wrapping
     every field's label/value, which is what made the exported PDF (and
     the on-screen preview) look broken on mobile even though the exact
     same markup produced a clean A4 layout on a laptop. Forcing the
     clone to a desktop-width viewport (well above the 720px breakpoint)
     makes the captured layout — and therefore the PDF — identical on
     mobile, tablet and laptop. */
  var PDF_RENDER_WIDTH_PX = 900;

  function buildPodPdf(doc, opts) {
    return ensurePdfLibs()
      .then(function () {
        return podPreloadStamp(opts);
      })
      .then(function () {
        if (!window.html2canvas || !window.jspdf || !window.jspdf.jsPDF)
          throw new Error("PDF libraries unavailable after load");
        /* iOS Safari refuses canvases above ~16.7 million pixels (the render
         silently fails and the PDF is skipped), so the scale is lowered
         for a long POD instead of always using 2x. */
        var estH = Math.max(doc.scrollHeight, 1200),
          /* WebKit also has a maximum canvas SIDE length (not just a total
           pixel limit). Respect both limits so long PODs export on iPhone
           instead of silently producing a blank/cut-off PDF. */
          pixelSafeScale = Math.sqrt(12e6 / (PDF_RENDER_WIDTH_PX * estH)),
          sideSafeScale = 4096 / Math.max(PDF_RENDER_WIDTH_PX, estH),
          renderScale = Math.max(
            0.35,
            Math.min(2, pixelSafeScale, sideSafeScale),
          );
        return window.html2canvas(doc, {
          scale: renderScale,
          useCORS: !0,
          backgroundColor: "#ffffff",
          windowWidth: PDF_RENDER_WIDTH_PX,
          windowHeight: Math.max(doc.scrollHeight, window.innerHeight || 0),
          scrollX: 0,
          scrollY: 0,
          ignoreElements: function (el) {
            return el.hasAttribute && el.hasAttribute("data-pdf-exclude");
          },
          onclone: function (clonedDoc) {
            /* #podResultSignatureImg stays hidden on screen (the pad
             canvas is the visible control); unhide it only in the
             clone html2canvas renders, so the exported PDF/PNG shows
             the actual signature instead of nothing. */
            var cloneSigImg = clonedDoc.getElementById("podResultSignatureImg");
            cloneSigImg && (cloneSigImg.hidden = !1);
            /* POD Completed stamp: forced on when saving (opts.stamp), otherwise
             left exactly as on screen. Animation is cancelled so the capture
             never grabs a half-faded frame. */
            var cloneStamp = clonedDoc.getElementById("podResultStamp");
            cloneStamp &&
              (opts &&
                opts.stamp &&
                ((cloneStamp.src = POD_STAMP_SRC), (cloneStamp.hidden = !1)),
              cloneStamp.classList.remove("is-slam"),
              (cloneStamp.style.animation = "none"));
            /* Belt-and-braces on top of windowWidth above: pin the cloned
             sheet itself to the desktop A4 width and force the desktop
             (row) arrangement for the two-column and sign-off blocks,
             so the capture can never fall back to the mobile stacked
             layout even if a host page overrides the iframe width. */
            var clonedSheet = clonedDoc.querySelector(".poddoc-sheet");
            clonedSheet &&
              ((clonedSheet.style.width = "210mm"),
              (clonedSheet.style.minWidth = "210mm"));
            var wideBlocks = clonedDoc.querySelectorAll(
              ".poddoc-sheet .two-col, .poddoc-sheet .signoff-cols",
            );
            for (var i = 0; i < wideBlocks.length; i++)
              wideBlocks[i].style.flexDirection = "row";
          },
        });
      })
      .then(function (canvas) {
        var jsPDF = window.jspdf.jsPDF,
          pdf = new jsPDF({
            unit: "mm",
            format: "a4",
            orientation: "portrait",
          }),
          pageW = pdf.internal.pageSize.getWidth(),
          pageH = pdf.internal.pageSize.getHeight(),
          imgW = pageW,
          imgH = (canvas.height * imgW) / canvas.width,
          /* JPEG (white background is already opaque) keeps the PDF a
           fraction of the size of PNG, so it uploads reliably on mobile data. */
          imgData = canvas.toDataURL("image/jpeg", 0.92);
        if (imgH <= pageH) pdf.addImage(imgData, "JPEG", 0, 0, imgW, imgH);
        else {
          /* Content is taller than one A4 page: slice the tall canvas
           into page-height chunks and add one PDF page per chunk, so
           nothing is cropped or scaled off the page. */
          var pxPerMm = canvas.width / imgW,
            pageHeightPx = Math.floor(pageH * pxPerMm),
            rendered = 0,
            first = !0;
          while (rendered < canvas.height) {
            var sliceH = Math.min(pageHeightPx, canvas.height - rendered),
              sliceCanvas = document.createElement("canvas");
            ((sliceCanvas.width = canvas.width), (sliceCanvas.height = sliceH));
            sliceCanvas
              .getContext("2d")
              .drawImage(
                canvas,
                0,
                rendered,
                canvas.width,
                sliceH,
                0,
                0,
                canvas.width,
                sliceH,
              );
            var sliceData = sliceCanvas.toDataURL("image/jpeg", 0.92),
              sliceImgH = sliceH / pxPerMm;
            (first || pdf.addPage(),
              (first = !1),
              pdf.addImage(sliceData, "JPEG", 0, 0, imgW, sliceImgH),
              (rendered += sliceH));
          }
        }
        return pdf;
      });
  }

  /* ---------- POD Completed stamp ----------
     Placed dead-centre of the POD sheet (#podResultStamp). It is switched on
     inside the export clone while saving, so the PDF stored in
     POD_File_upload carries it, and shown on screen (with a short stamp
     animation) once the save succeeds. */
  var POD_STAMP_SRC =
    "data:image/png;base64,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";

  function podPreloadStamp(opts) {
    return opts && opts.stamp
      ? new Promise(function (resolve) {
          var im = new Image();
          ((im.onload = im.onerror =
            function () {
              resolve();
            }),
            (im.src = POD_STAMP_SRC));
        })
      : Promise.resolve();
  }

  function podShowCompletedStamp() {
    var st = u("#podResultStamp");
    st &&
      (st.getAttribute("src") || (st.src = POD_STAMP_SRC),
      (st.hidden = !1),
      st.classList.remove("is-slam"),
      void st.offsetWidth,
      st.classList.add("is-slam"));
  }

  function podResetCompletedStamp() {
    var st = u("#podResultStamp");
    st && ((st.hidden = !0), st.classList.remove("is-slam"));
  }

  function podResultFileSafeId() {
    return String(
      u("#podResultAssignedTripId")
        ? u("#podResultAssignedTripId").textContent
        : "POD",
    ).replace(/[^a-z0-9]+/gi, "_");
  }

  function downloadPodResult() {
    var doc = u("#podResultDoc");
    if (!doc) return;
    var fileSafeId = podResultFileSafeId(),
      btn = u("#btnDownloadPod"),
      btnLabel = btn && btn.querySelector("span");
    btn && (btn.disabled = !0);
    btnLabel && (btnLabel.textContent = "Preparing…");
    buildPodPdf(doc)
      .then(function (pdf) {
        return downloadPodPdfFile(
          pdf,
          "Proof_of_Delivery_" + fileSafeId + ".pdf",
        );
      })
      .then(function () {
        R("Proof of Delivery downloaded as a PDF.");
      })
      .catch(function (err) {
        (console.error(
          gr,
          "POD PDF export failed, falling back to HTML download:",
          err,
        ),
          downloadPodResultAsHtmlFallback(doc, fileSafeId));
      })
      .finally(function () {
        (btn && (btn.disabled = !1),
          btnLabel && (btnLabel.textContent = "Download"));
      });
  }

  function isAppleMobile() {
    var ua = navigator.userAgent || "";
    return (
      /iP(ad|hone|od)/.test(ua) ||
      ("MacIntel" === navigator.platform && navigator.maxTouchPoints > 1)
    );
  }

  /* jsPDF.save() relies on the HTML download attribute, which iPhone Safari
     may ignore. Prefer the native Share sheet there (Files, Save to Files,
     AirDrop), then fall back to opening the PDF blob in Safari's viewer. */
  function downloadPodPdfFile(pdf, filename) {
    var blob = pdf.output("blob"),
      file =
        "undefined" != typeof File
          ? new File([blob], filename, {
              type: "application/pdf",
            })
          : null;
    if (isAppleMobile()) {
      if (
        file &&
        navigator.share &&
        (!navigator.canShare ||
          navigator.canShare({
            files: [file],
          }))
      )
        return navigator
          .share({
            files: [file],
            title: "Proof of Delivery",
          })
          .catch(function (err) {
            /* Cancelling the sheet is not an export failure. */
            if (err && "AbortError" === err.name) return;
            throw err;
          });
      var url = URL.createObjectURL(blob),
        opened = window.open(url, "_blank");
      (opened || (window.location.href = url),
        setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 6e4));
      return Promise.resolve();
    }
    pdf.save(filename);
    return Promise.resolve();
  }

  /* Save button — bottom-center of the POD Saved popup. Separate from
     Download: this is what actually writes the record to Zoho
     Creator (POD_PDF1) with its ORDER_DETAILS item rows, attaching the
     same generated PDF and the receiver's drawn signature. Download
     only produces a local file and never touches Zoho Creator.

     The popup only closes (and the app only returns to the Assigned Trip
     page) when the save genuinely succeeded. On any failure the reason is
     shown under the Save button and the popup stays open so the driver can
     press Save again — a retry resumes where it stopped and never creates
     a duplicate record. */
  function saveDeliveryRecordToZoho() {
    var doc = u("#podResultDoc"),
      errEl = u("#podSaveErr");
    errEl && (errEl.hidden = !0);
    if (!doc) return;
    var fileSafeId = podResultFileSafeId(),
      btn = u("#btnSavePodPdf");
    if (btn && btn.disabled) return;
    btn && ((btn.disabled = !0), (btn.textContent = "Saving…"));
    var pdfFailed = !1;

    function done(msg, isError, noStamp) {
      btn && ((btn.disabled = !1), (btn.textContent = "Save"));
      if (isError)
        return void (errEl && ((errEl.textContent = msg), (errEl.hidden = !1)));
      R(msg);
      /* Give the driver a moment to see the confirmation toast
         before the popup closes and the app returns to the
         Assigned Trip page — an instant jump away would make the
         save feel like it never happened. */
      noStamp || podShowCompletedStamp();
      setTimeout(
        function () {
          Y("trip");
        },
        noStamp ? 900 : 2e3,
      );
    }
    /* The PDF is best-effort: if it can't be rendered the record's fields,
       item rows and signature are still saved. It is skipped when an
       earlier attempt already attached it. */
    (POD_RESULT_META.pdfUploaded
      ? Promise.resolve(null)
      : buildPodPdf(doc, {
          stamp: !0,
        })
          .then(function (pdf) {
            return pdf.output("blob");
          })
          .catch(function (err) {
            pdfFailed = !0;
            console.error(
              gr,
              "buildPodPdf() failed before POD_PDF save, saving without the PDF:",
              err,
            );
            return null;
          })
    )
      .then(function (blob) {
        return savePodPdfToZohoCreator(blob, fileSafeId);
      })
      .then(function (result) {
        if (result && result.preview)
          return done("Preview mode — POD not saved", !1, !0);
        /* Update the Trip details "POD Completion" KPI right away, then
         reconcile it with Creator in the background. */
        podKpiMarkCompleted(
          podKpiSplitIds(podResultDomValue("podResultBookingId")),
        );
        refreshPodCompletionKpi();
        (refreshStopsCompletedFromCreator(), scorePodOutcome(result.id));
        if (result.warnings && result.warnings.length)
          return done(
            "The POD and its items were saved to Zoho Creator, but: " +
              result.warnings.join(" ") +
              " Press Save to retry the attachment.",
            !0,
          );
        done(
          pdfFailed
            ? "POD saved to Zoho Creator (without the PDF attachment)."
            : "POD saved to Zoho Creator.",
        );
      })
      .catch(function (err) {
        console.error(gr, "saveDeliveryRecordToZoho() failed:", err);
        done(
          "Couldn't save the POD to Zoho Creator: " + podSaveErrorMessage(err),
          !0,
        );
      });
  }

  async function wt() {
    var e = u("#podErr");
    e.hidden = !0;
    var t = u("#inPodStatus"),
      r = t ? t.value : "";
    if (!r)
      return (
        u("#fPodStatus") && u("#fPodStatus").classList.add("is-bad"),
        (e.textContent = "Select a POD status from the dropdown."),
        void (e.hidden = !1)
      );
    u("#fPodStatus") && u("#fPodStatus").classList.remove("is-bad");
    var n = c.hub;
    if (!n)
      return (
        (e.textContent = "No hub selected — go back to check-in."),
        void (e.hidden = !1)
      );
    if (!K.tripRecordId)
      return (
        console.error(gr, "no active trip", K),
        (e.textContent =
          "Start a trip first — this check-in isn't linked to a trip yet."),
        void (e.hidden = !1)
      );
    var i = CURRENT_POD_ITEMS.map(function (e) {
        var t = document.querySelector('[data-pid="' + e.id + '"]'),
          r = document.querySelector('[data-recv="' + e.id + '"]'),
          receivedQty = (r && Number(r.value)) || 0,
          pendingQty = Math.max(0, (Number(e.qty) || 0) - receivedQty);
        return {
          id: e.id,
          name: e.name,
          delivered: !!t && t.checked,
          qty: Number(e.qty) || 0,
          price: e.price,
          receivedQty: receivedQty,
          pendingQty: pendingQty,
        };
      }),
      sig = At("#inPodSignatureData"),
      deliveredCount = i.filter(function (e) {
        return e.delivered;
      }).length;
    (l.unshift({
      hub: n,
      date: c.date || k(),
      status: r,
      items: i,
      notes: u("#podNotes").value.trim(),
      signature: sig,
      savedAt: new Date().toLocaleTimeString("en-AU", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }),
      Dt(),
      updateStopsCompletedKpi());
    var empId = await resolveEmployeeFormId(),
      todayD = new Date(),
      zohoDate =
        p(todayD.getDate()) +
        "-" +
        h[todayD.getMonth()] +
        "-" +
        todayD.getFullYear(),
      itemSummary = i.length
        ? "Items: " +
          deliveredCount +
          " of " +
          i.length +
          " delivered (" +
          i
            .map(function (e) {
              return (
                e.name +
                " x" +
                e.receivedQty +
                (e.pendingQty ? " (pending " + e.pendingQty + ")" : "")
              );
            })
            .join(", ") +
          ")"
        : "",
      notesParts = [u("#podNotes").value.trim(), itemSummary].filter(Boolean),
      PODSTATUS_MAP = {
        Delivered: "Delivered",
        Revised: "Revised",
        "Partially Received": "Partially received",
        Cancelled: "Cancelled",
      },
      payload = {
        Trip_ID: cr2(K.tripRecordId || K.tripId),
        Trip_Name: cr2(K.tripRecordId || K.tripId),
        Driver_ID: cr2(
          empId || K.driverRecordId || K.driverEmployeeRecordId || "",
        ),
        Driver_Name: cr2(
          empId || K.driverRecordId || K.driverEmployeeRecordId || "",
        ),
        Date_field: zohoDate,
        Delivery_Status: PODSTATUS_MAP[r] || r,
        Notes: notesParts.join(" | "),
      };
    (c.inTime && (payload.Check_in_Time = b(c.inTime)),
      c.outTime && (payload.Check_Out_Time = b(c.outTime)));
    /* Booking_ID is now a Multi-Select lookup on Hub_Check_in_Check_Out1
       (one Trip can cover several Bookings), so Creator expects an array
       of {ID: "..."} references rather than a single value. Only IDs
       with a real Booking_Shipments record ID are sent — a selection
       that only ever resolved to a display label (no record found) is
       left out rather than sent as a bad reference. */
    var bookingIdRefs = (c.bookingIds || [])
      .filter(function (bk) {
        return bk && bk.id;
      })
      .map(function (bk) {
        return {
          ID: bk.id,
        };
      });
    bookingIdRefs.length
      ? (payload.Booking_ID = bookingIdRefs)
      : console.warn(
          gr,
          "Hub_Check_in_Check_Out1 saved without Booking_ID — no Booking selected or no matching record id found",
          c.bookingIds,
        );
    var podHubNameId = HUB_NAME_TO_ID[n] || null;
    podHubNameId
      ? (payload.Hub_Name = podHubNameId)
      : console.warn(
          gr,
          "Hub_Check_in_Check_Out1 saved without Hub_Name — no matching Locations record id found for",
          n,
        );
    var podTripIdVal = payload.Trip_ID;
    var hubCheckinId = null;
    if (window.ZOHO && ZOHO.CREATOR && ZOHO.CREATOR.DATA) {
      var hubRes = await ZOHO.CREATOR.DATA.addRecords({
        form_name: "Hub_Check_in_Check_Out1",
        payload: {
          data: payload,
        },
      }).catch(function (t) {
        (console.error(gr, "Hub_Check_in_Check_Out1 save failed:", t),
          (e.textContent = "Couldn't save: " + _r(t)),
          (e.hidden = !1));
      });
      hubCheckinId =
        (hubRes && hubRes.data && (hubRes.data.ID || hubRes.data.id)) || null;
      var deliveredItems = i.filter(function (x) {
        return x.delivered && x.qty > 0;
      });
      if (deliveredItems.length) {
        var podIdsRaw = [];
        for (
          var podItemIdx = 0;
          podItemIdx < deliveredItems.length;
          podItemIdx++
        ) {
          var item = deliveredItems[podItemIdx];
          var podPayload = {
            Item: cr2(item.id),
            Quantity: item.qty,
            Received_Qty: item.receivedQty,
            Pending_Qty: item.pendingQty,
          };
          /* Per the POD form schema, each POD item record is saved
             against the specific Trip_ID and Hub_Name it belongs to —
             not just linked indirectly through the parent
             Hub_Check_in_Check_Out1 record. */
          (podTripIdVal && (podPayload.Trip_ID = podTripIdVal),
            podHubNameId && (podPayload.Hub_Name = podHubNameId),
            sig && (podPayload.Receiver_Signature = sig));
          var podSaveRes = await ZOHO.CREATOR.DATA.addRecords({
            form_name: "POD",
            payload: {
              data: podPayload,
            },
          })
            .then(function (res) {
              return (res && res.data && (res.data.ID || res.data.id)) || null;
            })
            .catch(function (err) {
              return (console.error(gr, "POD item save failed:", err), null);
            });
          podIdsRaw.push(podSaveRes);
        }
        var podIds = podIdsRaw.filter(Boolean);
        if (podIds.length && hubCheckinId && ZOHO.CREATOR.DATA.updateRecords) {
          var podLink = podIds.map(function (pid) {
            return {
              ID: pid,
            };
          });
          ZOHO.CREATOR.DATA.updateRecords({
            form_name: "Hub_Check_in_Check_Out1",
            id: hubCheckinId,
            payload: {
              data: {
                POD: podLink,
              },
            },
          }).catch(function (err) {
            console.error(
              gr,
              "Could not link POD records to Hub_Check_in_Check_Out1:",
              err,
            );
          });
        }
      }
    }
    (R("POD saved for " + n + " — " + r),
      populatePodResultPage({
        date: zohoDate,
        driverName: s.name,
        driverId: empId || s.id,
        tripId: podTripIdVal,
        bookingId:
          (c.bookingIds || [])
            .map(function (bk) {
              return bk.name || bk.id;
            })
            .join(", ") || null,
        /* This is the hub check-in flow, which can cover several
         Bookings at once — there's no single Booking record to pull a
         Customer/Pickup/Delivery/Weight from here, so those are left
         as "—" rather than guessed. Vehicle still comes from the
         current Trip record. */
        vehicleNo: K.vehicleName,
        deliveryLocation: n,
        status: PODSTATUS_MAP[r] || r,
        note: u("#podNotes").value.trim(),
        signature: sig,
        items: i.map(function (it) {
          return {
            name: it.name,
            qty: it.qty,
            receivedQty: it.receivedQty,
            pendingQty: it.pendingQty,
            price: it.price,
            status: it.delivered ? "Delivered" : "Pending",
            note: "—",
          };
        }),
      }),
      (u("#podNotes").value = ""),
      sigPadClear(),
      t && (t.value = ""),
      showPodResultView());
    var a = Q.findIndex(function (e) {
      return "next" === e.status;
    });
    (a >= 0 && (J = a),
      ie(),
      setTimeout(function () {
        var e = u("#hubDetail");
        e &&
          e.closest(".card") &&
          e.closest(".card").scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }, 120),
      (function () {
        var e = u("#hubDetail");
        if (e) {
          var t = e.closest(".card") || e;
          setTimeout(function () {
            (t.scrollIntoView({
              behavior: "smooth",
              block: "start",
            }),
              t.classList.remove("is-flash"),
              t.offsetWidth,
              t.classList.add("is-flash"));
          }, 60);
        }
      })());
  }

  function Dt() {
    var e = u("#podReportList");
    e &&
      (l.length
        ? (e.innerHTML = l
            .map(function (e) {
              var t =
                  "Cancelled" === e.status
                    ? "red"
                    : "Partially Received" === e.status
                      ? "amber"
                      : "green",
                r = e.items.filter(function (e) {
                  return e.delivered;
                }).length;
              return (
                '<li class="pod-report"><i class="status-dot ' +
                t +
                '" style="margin-top:5px"></i><div><p><b>' +
                e.hub +
                "</b> — " +
                e.status +
                "</p><time>" +
                r +
                " of " +
                e.items.length +
                " items delivered · " +
                e.date +
                " · " +
                e.savedAt +
                "</time></div></li>"
              );
            })
            .join(""))
        : (e.innerHTML =
            '<li class="pod-report pod-report--empty">No POD reports saved yet. Check in at a hub to get started.</li>'));
  }
  var Tt = [];
  var Ct = null;

  function It() {
    var e = new Date(),
      t = u("#inFuelDate"),
      r = u("#inFuelTime");
    (t &&
      (t.value = e.toLocaleDateString("en-AU", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })),
      r &&
        (r.value = e.toLocaleTimeString("en-AU", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })));
  }

  function St() {
    var e = Number((u("#inFuelQty") || {}).value) || 0,
      t = Number((u("#inFuelCost") || {}).value) || 0,
      r = u("#inFuelTotal");
    r && (r.value = e && t ? (e * t).toFixed(2) : "");
  }

  function Et(e) {
    var t = Rt(e);
    return t
      ? {
          url: t,
        }
      : null;
  }
  async function Lt() {
    console.groupCollapsed(gr, "saveFuel()");
    try {
      console.log(" First Block Passed");
      var e = u("#fuelErr");
      if (
        ((e.hidden = !0),
        xt([
          "fFuelCurrentLoc",
          "fFuelUrl",
          "fFuelType",
          "fFuelQty",
          "fFuelCost",
          "fFuelOdo",
        ]),
        !Pt(
          [
            [
              "#inFuelCurrentLoc",
              "fFuelCurrentLoc",
              "Enter your current location.",
            ],
            [
              "#inFuelUrl",
              "fFuelUrl",
              "Enter or capture your live location URL.",
            ],
            ["#inFuelType", "fFuelType", "Select the fuel type."],
            ["#inFuelQty", "fFuelQty", "Enter the fuel quantity in litres."],
            ["#inFuelCost", "fFuelCost", "Enter the cost per unit."],
            ["#inFuelOdo", "fFuelOdo", "Enter the current mileage."],
          ],
          e,
        ))
      )
        return void console.warn(gr, "blocked: missing required field");
      var t = Number(At("#inFuelQty")),
        r = Number(At("#inFuelCost"));
      if (!(t > 0))
        return (
          u("#fFuelQty").classList.add("is-bad"),
          (e.textContent = "Fuel quantity must be greater than zero."),
          void (e.hidden = !1)
        );
      if (!(r > 0))
        return (
          u("#fFuelCost").classList.add("is-bad"),
          (e.textContent = "Cost per unit must be greater than zero."),
          void (e.hidden = !1)
        );
      if (
        (console.log(" Second Block Passed"),
        !K.tripRecordId || !K.driverRecordId)
      )
        return (
          console.error(gr, "no active trip", K),
          (e.textContent =
            "Start a trip first — this fuel entry isn't linked to a trip yet."),
          void (e.hidden = !1)
        );
      console.log(" 3rd Block Passed");
      var n = await Vt(),
        i = new Date(),
        a = {
          currentLocation: At("#inFuelCurrentLoc"),
          liveLocationUrl: Rt(At("#inFuelUrl")),
          stationName: At("#inFuelStation"),
          fuelType: At("#inFuelType"),
          litres: t,
          costPerUnit: r,
          totalCost: Number((t * r).toFixed(2)),
          mileage: Number(At("#inFuelOdo")) || 0,
          fuelDateTime: v(i),
          savedAt: i.toLocaleTimeString("en-AU", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
        o = {
          Trip_ID: K.tripRecordId,
          Vehicle: K.vehicleRecordId || K.vehicleName,
          Driver_Name: n || K.driverEmployeeRecordId || K.driverRecordId || "",
          Fuel_Entry_Date_Time: a.fuelDateTime,
          Fuel_Station: a.stationName,
          Current_location: a.currentLocation,
          Fuel_Type: a.fuelType,
          Fuel_Quantity_L_kWh: a.litres,
          Cost_Per_Unit: a.costPerUnit,
          Total_Fuel_Cost: a.totalCost,
          /* Zoho Creator field API name for "Current Odometer" on the
             Fuel_Entry form. Previously sent as "Odometer_Reading", which
             is not a real field on this form, so Creator silently
             dropped the value while every other field saved fine. */
          Current_Odometer: a.mileage,
        };
      if (
        (console.log(" 4th Block Passed"),
        a.liveLocationUrl && (o.Live_Location_URL = Et(a.liveLocationUrl)),
        console.log(gr, "ACTIVE_TRIP:", K),
        console.table(o),
        !window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA)
      )
        return (
          console.warn(gr, "preview mode — not writing to Creator"),
          Tt.unshift(a),
          void R("Preview mode — fuel entry not saved to Creator")
        );
      var s,
        c = u("#btnSaveFuel");
      c && (c.disabled = !0);
      try {
        s = await ZOHO.CREATOR.DATA.addRecords({
          form_name: "Fuel_Entry",
          payload: {
            data: o,
          },
        });
      } finally {
        c && (c.disabled = !1);
      }
      console.log(gr, "addRecords response:", s);
      var l = s && (s.code || (s.result && s.result[0] && s.result[0].code));
      if (3e3 !== l && void 0 !== l)
        return (
          console.error(gr, "Creator rejected the record. code:", l, s),
          (e.textContent = "Couldn't save: " + _r(s)),
          void (e.hidden = !1)
        );
      (console.log(gr, "saved. record id:", s && s.data && s.data.ID),
        Tt.unshift(a),
        [
          "#inFuelCurrentLoc",
          "#inFuelUrl",
          "#inFuelStation",
          "#inFuelType",
          "#inFuelQty",
          "#inFuelCost",
          "#inFuelTotal",
          "#inFuelOdo",
        ].forEach(function (e) {
          var t = u(e);
          t && (t.value = "");
        }),
        R(
          "Fuel Entry Added Successfully — " +
            t.toFixed(2) +
            " L for $" +
            a.totalCost.toFixed(2),
        ),
        Y("trip"));
    } catch (e) {
      console.error(gr, "saveFuel failed:", e, _r(e));
      var d = u("#fuelErr");
      (d &&
        ((d.textContent = "Couldn't save the fuel entry: " + _r(e)),
        (d.hidden = !1)),
        R("Couldn't save the fuel entry — check the console."));
    } finally {
      console.groupEnd();
    }
  }

  function Rt(e) {
    var t = (e || "").trim();
    return t
      ? (/^https?:\/\//i.test(t) || (t = "https://" + t.replace(/^\/+/, "")), t)
      : "";
  }

  function xt(e) {
    e.forEach(function (e) {
      var t = document.getElementById(e);
      t && t.classList.remove("is-bad");
    });
  }

  function At(e) {
    var t = u(e);
    return t ? String(t.value).trim() : "";
  }

  function Pt(e, t) {
    for (var r = 0; r < e.length; r++)
      if (!At(e[r][0])) {
        var n = document.getElementById(e[r][1]);
        return (
          n && n.classList.add("is-bad"),
          (t.textContent = e[r][2]),
          (t.hidden = !1),
          !1
        );
      }
    return !0;
  }

  function Nt() {
    var e = new Date();
    return e.getFullYear() + "-" + p(e.getMonth() + 1) + "-" + p(e.getDate());
  }

  function Ot() {
    var e = new Date();
    return p(e.getHours()) + ":" + p(e.getMinutes());
  }

  function Mt(e, t) {
    window.ZOHO &&
      ZOHO.CREATOR &&
      ZOHO.CREATOR.DATA &&
      (void 0 === t.Trip_ID && (t.Trip_ID = K.tripId || X || ""),
      void 0 === t.Vehicle && (t.Vehicle = K.vehicleName || ""),
      void 0 === t.Driver && (t.Driver = K.driverName || s.name || ""),
      void 0 === t.Driver_ID && (t.Driver_ID = K.driverId || s.id || ""),
      ZOHO.CREATOR.DATA.addRecords({
        form_name: e,
        payload: {
          data: t,
        },
      }).catch(function () {}));
  }
  async function saveBfmSummary() {
    var totalHrs = +(o.workedMins / 60).toFixed(2),
      maxHrs = +(a.maxWorkPerShift / 60).toFixed(2),
      restHrs = Math.max(0, +(totalHrs - maxHrs).toFixed(2)),
      msg =
        "Work period logged — " +
        totalHrs +
        "h worked (limit " +
        maxHrs +
        "h). Rest required: " +
        restHrs +
        "h.";
    /* This end-of-trip summary is recorded to Driver_BFM_Notification below
       for audit/reporting purposes, but is no longer surfaced to the driver
       as an in-app notification/toast (per request — it was confusing when
       shown for very short work periods). */
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA)
      return void console.warn(
        gr,
        "preview mode — Driver_BFM_Notification not saved",
      );
    try {
      var empId = await resolveEmployeeFormId(),
        driverRef = cr2(
          empId || K.driverRecordId || K.driverEmployeeRecordId || "",
        ),
        tripRef = cr2(K.tripRecordId || K.tripId || ""),
        nowD = new Date(),
        zohoDate =
          p(nowD.getDate()) +
          "-" +
          h[nowD.getMonth()] +
          "-" +
          nowD.getFullYear(),
        endTimeVal =
          p(nowD.getHours()) +
          ":" +
          p(nowD.getMinutes()) +
          ":" +
          p(nowD.getSeconds()),
        payload = {
          Trip_ID: tripRef,
          Trip_Name: tripRef,
          Driver_ID: driverRef,
          Driver_Name: driverRef,
          Date_field: zohoDate,
          Start_Time: b(o.startTime),
          End_Time: endTimeVal,
          Break_Hours: restHrs,
          Notification: msg,
        };
      o.startLocation && (payload.Live_Location = o.startLocation);
      var urlObj = Et(o.startLocationUrl);
      urlObj && (payload.Live_Location_URL = urlObj);
      await ZOHO.CREATOR.DATA.addRecords({
        form_name: "Driver_BFM_Notification",
        payload: {
          data: payload,
        },
      });
    } catch (err) {
      console.error(gr, "Driver_BFM_Notification save failed:", err);
    }
  }
  var Ft = [];

  function Bt() {
    var e = At("#inIncTime"),
      t = At("#inIncEndTime"),
      r = u("#inIncDur");
    if (r && e && t) {
      var n = _(e),
        i = _(t);
      if (null != n && null != i) {
        var a = i - n;
        (a < 0 && (a += 1440), (r.value = (a / 60).toFixed(2)));
      }
    }
  }
  var Ht = null;

  function Vt() {
    if (Ht) return Promise.resolve(Ht);
    var e = (s.email || "").trim(),
      t = K.driverEmployeeRecordId || K.driverRecordId || null;
    if (!e) return Promise.resolve(t);
    var n = ["Driver_Details", "All_Driver_Details", "Drivers", "Driver"];
    return (function i(a) {
      return a >= n.length
        ? (console.warn(
            gr,
            "resolveDriverDetailsRecordId: no report candidate matched by email — falling back to cached ID",
            t,
          ),
          t)
        : kr({
            report_name: n[a],
            criteria: "(" + r + ' == "' + e.replace(/"/g, '\\"') + '")',
            field_config: "all",
            max_records: 200,
          })
            .then(function (e) {
              var t = (e && e.data) || [];
              if (t.length) {
                var r = t[0].ID || t[0].id;
                return (
                  console.log(
                    gr,
                    "resolveDriverDetailsRecordId: matched via report",
                    n[a],
                    "-> ID",
                    r,
                  ),
                  (Ht = r),
                  r
                );
              }
              return i(a + 1);
            })
            .catch(function (e) {
              return (
                console.warn(
                  gr,
                  "resolveDriverDetailsRecordId: report",
                  n[a],
                  "failed:",
                  e,
                ),
                i(a + 1)
              );
            });
    })(0);
  }
  async function qt() {
    console.groupCollapsed(gr, "saveIncident()");
    try {
      var e = u("#incErr");
      if (
        ((e.hidden = !0),
        xt([
          "fIncName",
          "fIncPlace",
          "fIncLoc",
          "fIncUrl",
          "fIncDate",
          "fIncTime",
          "fIncTrip",
          "fIncRepairs",
          "fIncParts",
          "fIncAltVeh",
          "fIncEndTime",
          "fIncDur",
        ]),
        !Pt(
          [
            ["#inIncName", "fIncName", "Enter a name for this accident."],
            ["#inIncPlace", "fIncPlace", "Enter the accident place."],
            ["#inIncLoc", "fIncLoc", "Enter your live location."],
            [
              "#inIncUrl",
              "fIncUrl",
              "Enter or capture your live location URL.",
            ],
            ["#inIncDate", "fIncDate", "Enter the date of the accident."],
            ["#inIncTime", "fIncTime", "Enter the start time of the accident."],
            ["#inIncTrip", "fIncTrip", "Select the trip status."],
            [
              "#inIncRepairs",
              "fIncRepairs",
              "Select whether vehicle repairs are needed.",
            ],
            [
              "#inIncParts",
              "fIncParts",
              "Select whether vehicle parts are damaged.",
            ],
            [
              "#inIncAltVeh",
              "fIncAltVeh",
              "Select whether an alternative vehicle is required.",
            ],
            [
              "#inIncDur",
              "fIncDur",
              "Enter the total accident duration in hours.",
            ],
          ],
          e,
        ))
      )
        return void console.warn(gr, "blocked: missing required field");
      var t = Number(At("#inIncDur"));
      if (t < 0)
        return (
          u("#fIncDur").classList.add("is-bad"),
          (e.textContent = "Duration can't be negative."),
          void (e.hidden = !1)
        );
      if (!K.tripRecordId || (!K.driverEmployeeRecordId && !K.driverRecordId))
        return (
          console.error(gr, "no active trip", K),
          (e.textContent =
            "Start a trip first — this accident report isn't linked to a trip yet."),
          void (e.hidden = !1)
        );
      var r = {
          name: At("#inIncName"),
          place: At("#inIncPlace"),
          liveLocation: At("#inIncLoc"),
          liveLocationUrl: Rt(At("#inIncUrl")),
          date: At("#inIncDate"),
          time: At("#inIncTime"),
          endTime: At("#inIncEndTime"),
          tripStatus: At("#inIncTrip"),
          repairs: At("#inIncRepairs"),
          parts: At("#inIncParts"),
          altVehicleRequired: At("#inIncAltVeh"),
          durationHours: t,
        },
        n = await Vt(),
        i = {
          Trip_ID: K.tripRecordId,
          Driver_Name: n || K.driverEmployeeRecordId || K.driverRecordId,
          Accident_Name: r.name,
          Accident_Place: r.place,
          Live_location: r.liveLocation,
          Date_field: y(r.date),
          Start_Time: b(r.time),
          Trip_Status: r.tripStatus,
          Vehicle_Repairs: yt(r.repairs),
          Vehicle_Parts_Damaged: yt(r.parts),
          Alternative_Vehicle_Required: yt(r.altVehicleRequired),
          Total_accident_duration_hours: r.durationHours,
        };
      if (
        (r.endTime && (i.End_Time = b(r.endTime)),
        r.liveLocationUrl && (i.Live_Location_URL = Et(r.liveLocationUrl)),
        console.log(gr, "ACTIVE_TRIP:", K),
        console.table(i),
        !window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA)
      )
        return (
          console.warn(gr, "preview mode — not writing to Creator"),
          Ft.unshift(r),
          void R("Preview mode — accident report not saved to Creator")
        );
      var a,
        o = u("#btnSaveIncident");
      o && (o.disabled = !0);
      try {
        a = await ZOHO.CREATOR.DATA.addRecords({
          form_name: "Report_An_Accident",
          payload: {
            data: i,
          },
        });
      } finally {
        o && (o.disabled = !1);
      }
      console.log(gr, "addRecords response:", a);
      var s = a && (a.code || (a.result && a.result[0] && a.result[0].code));
      if (3e3 !== s && void 0 !== s)
        return (
          console.error(gr, "Creator rejected the record. code:", s, a),
          (e.textContent = "Couldn't save: " + _r(a)),
          void (e.hidden = !1)
        );
      (console.log(gr, "saved. record id:", a && a.data && a.data.ID),
        Ft.unshift(r),
        scoreAccident(r.name, a && a.data && a.data.ID),
        [
          "#inIncName",
          "#inIncPlace",
          "#inIncLoc",
          "#inIncUrl",
          "#inIncDate",
          "#inIncTime",
          "#inIncTrip",
          "#inIncRepairs",
          "#inIncParts",
          "#inIncAltVeh",
          "#inIncEndTime",
          "#inIncDur",
        ].forEach(function (e) {
          var t = u(e);
          t && (t.value = "");
        }),
        m("#viewIncident .yn-btn").forEach(function (e) {
          e.classList.remove("is-active");
        }),
        R("Accident report saved — " + r.name),
        Y("trip"));
    } catch (e) {
      console.error(gr, "saveIncident failed:", e, _r(e));
      var c = u("#incErr");
      (c &&
        ((c.textContent = "Couldn't save the accident report: " + _r(e)),
        (c.hidden = !1)),
        R("Couldn't save the accident report — check the console."));
    } finally {
      console.groupEnd();
    }
  }
  var Wt = [],
    Ut = null;

  /* ============================================================
     LOGGED-IN DRIVER RESOLUTION
     Looks up the current portal user's own Employee_Form record by
     their login email, caching the result. Used by every save that
     must be tied to whoever is actually logged in (Start Trip, POD,
     Break Log) rather than a trip's own driver-lookup field.
     ============================================================ */
  function resolveEmployeeFormId() {
    if (Ut) return Promise.resolve(Ut);
    /* Employee_Form / All_Employee_Form / Employees / Employee — live Zoho
       responses confirm none of these reports exist in this app (each
       comes back "No report named X found", code 2894). Every call here
       used to burn 4 guaranteed-to-fail requests before falling back to
       the driver record ID that wr() already resolved via the working
       "Driver" report during boot — so just use that ID directly. */
    var t = s.recordId || K.driverEmployeeRecordId || null;
    return Promise.resolve((Ut = t));
  }
  async function Zt() {
    var e = u("#vehErr");
    if (
      ((e.hidden = !0),
      xt([
        "fVehName",
        "fVehLoc",
        "fVehWhen",
        "fVehStatus",
        "fVehContinue",
        "fVehAltVeh",
        "fVehDamages",
      ]),
      Pt(
        [
          ["#inVehName", "fVehName", "Enter the incident name."],
          ["#inVehLoc", "fVehLoc", "Enter the live location."],
          ["#inVehWhen", "fVehWhen", "Enter the incident date and time."],
          ["#inVehStatus", "fVehStatus", "Select a status."],
          [
            "#inVehContinue",
            "fVehContinue",
            "Select whether the driver can continue to drive.",
          ],
          [
            "#inVehAltVeh",
            "fVehAltVeh",
            "Select whether an alternative vehicle is required.",
          ],
          ["#inVehDamages", "fVehDamages", "Describe the damages."],
        ],
        e,
      ))
    ) {
      if (!K.tripRecordId)
        return (
          console.error(gr, "no active trip", K),
          (e.textContent =
            "Start a trip first — this vehicle issue isn't linked to a trip yet."),
          void (e.hidden = !1)
        );
      var t = {
        name: At("#inVehName"),
        location: At("#inVehLoc"),
        when: At("#inVehWhen"),
        status: At("#inVehStatus"),
        continueToDrive: At("#inVehContinue"),
        altVehicleRequired: At("#inVehAltVeh"),
        liveUrl: At("#inVehUrl"),
        damages: At("#inVehDamages"),
        notes: At("#inVehNotes"),
      };
      Wt.unshift(t);
      var n = await resolveEmployeeFormId();
      if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA)
        return (
          [
            "#inVehName",
            "#inVehLoc",
            "#inVehWhen",
            "#inVehNotes",
            "#inVehStatus",
            "#inVehContinue",
            "#inVehAltVeh",
            "#inVehUrl",
            "#inVehDamages",
          ].forEach(function (e) {
            var t = u(e);
            t && (t.value = "");
          }),
          m("#viewVehicleIssue .yn-btn").forEach(function (e) {
            e.classList.remove("is-active");
          }),
          R("Vehicle issue saved — " + t.name),
          void Y("trip")
        );
      var i = {
        Trip: K.tripRecordId,
        Vehicle: K.vehicleRecordId || K.vehicleName,
        Driver_Name: n,
        Driver_ID: n,
        Incident_Name: t.name,
        Live_Location: t.location,
        Incident_Date_Time: g(t.when),
        Status: t.status,
        Continue_to_Drive: yt(t.continueToDrive),
        Alternative_vehicle_required: yt(t.altVehicleRequired),
        Damage: t.damages,
        Notes: t.notes,
      };
      (t.liveUrl && (i.Live_location_URL = Et(t.liveUrl)),
        ZOHO.CREATOR.DATA.addRecords({
          form_name: "Vehicle_Issue",
          payload: {
            data: i,
          },
        })
          .then(function () {
            ([
              "#inVehName",
              "#inVehLoc",
              "#inVehWhen",
              "#inVehNotes",
              "#inVehStatus",
              "#inVehContinue",
              "#inVehAltVeh",
              "#inVehUrl",
              "#inVehDamages",
            ].forEach(function (e) {
              var t = u(e);
              t && (t.value = "");
            }),
              m("#viewVehicleIssue .yn-btn").forEach(function (e) {
                e.classList.remove("is-active");
              }),
              R("Vehicle issue saved — " + t.name),
              Y("trip"));
          })
          .catch(function (t) {
            (console.error(gr, "Vehicle_Issue save failed:", t),
              (e.textContent = "Couldn't save: " + _r(t)),
              (e.hidden = !1));
          }));
    }
  }

  /* ============================================================
     EXPENSE ENTRY — Expense Type dropdown
     #inExpType was a hardcoded list of free-text options, but
     Expense_Entry.Expense_Type is a Lookup to the Expense_Type form
     (values = Expense_Type.ID, displayformat = [Expense_Type]) — a
     real Zoho record ID has to be sent, not arbitrary text. This loads
     the Expense_Type report (report name confirmed as
     "All_Expense_Types") and rebuilds the dropdown with each option's
     value set to its record ID and its text set to the record's
     Expense_Type field value (e.g. "Driver Expense", "Toll Expense",
     "Trip Expense", "Vehicle Expense" — matching the same values shown
     in the native Zoho Creator Add_Expense_Entry form's Expense Type
     dropdown).

     Label lookup tries a few likely API/link names for the field
     first (Zoho sometimes renames a field that collides with its own
     form name, e.g. Expense_Type -> Expense_Type1), then falls back
     to using whatever non-system text field is present on the record
     so the dropdown still populates even if the exact field name
     differs from what's documented here.
     ============================================================ */
  function Xr() {
    var sel = u("#inExpType");
    if (!sel) return Promise.resolve();
    if ("1" === sel.dataset.loaded) return Promise.resolve();
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA)
      return Promise.resolve();
    var reports = [e.expenseTypes]
      .concat(e.expenseTypesFallbacks || [])
      .filter(function (v, i, arr) {
        return v && arr.indexOf(v) === i;
      });
    var SYSTEM_KEYS = [
      "ID",
      "id",
      "Added_Time",
      "Added_User",
      "Modified_Time",
      "Modified_User",
      "ZC_Modified_Time",
      "ZC_Added_Time",
    ];

    function fallbackLabel(rec) {
      for (var k in rec) {
        if (
          SYSTEM_KEYS.indexOf(k) === -1 &&
          "string" === typeof rec[k] &&
          rec[k].trim()
        )
          return rec[k].trim();
      }
      return "";
    }
    return (function tryReport(n) {
      if (n >= reports.length)
        return void console.error(
          gr,
          "Could not read an Expense_Type report for the Expense Type dropdown (tried: " +
            reports.join(", ") +
            ").",
        );
      return kr({
        report_name: reports[n],
        field_config: "all",
        max_records: 200,
      })
        .then(function (res) {
          var rows = (res && res.data) || [];
          console.log(
            gr,
            "Expense_Type rows from",
            reports[n],
            "-",
            rows.length,
            "row(s)",
            rows[0] || null,
          );
          if (!rows.length && n + 1 < reports.length) return tryReport(n + 1);
          var prev = sel.value,
            ids = [],
            options = [];
          (rows.forEach(function (rec) {
            var label =
                cr(sr(rec, ["Expense_Type", "Expense_Type1", "Name"])) ||
                fallbackLabel(rec),
              id = rec.ID || rec.id || "";
            label &&
              id &&
              options.push({
                id: id,
                label: label,
              });
          }),
            /* The Expense_Type picklist is defined with sortorder =
           ascending in Zoho Creator, but that only governs Creator's
           own UI — the API returns rows in report order, so sort here
           to match what the driver expects to see. */
            options.sort(function (a, b) {
              return a.label.localeCompare(b.label);
            }),
            (sel.innerHTML = options.length
              ? '<option value="" selected hidden disabled></option>'
              : '<option value="">No expense types found</option>'),
            options.forEach(function (o) {
              var opt = document.createElement("option");
              ((opt.value = o.id),
                (opt.textContent = o.label),
                sel.appendChild(opt),
                ids.push(o.id));
            }),
            prev && -1 !== ids.indexOf(prev) && (sel.value = prev),
            options.length && (sel.dataset.loaded = "1"));
        })
        .catch(function (err) {
          return (
            console.error(
              gr,
              "getRecords on",
              reports[n],
              "(Expense_Type) failed:",
              err,
            ),
            tryReport(n + 1)
          );
        });
    })(0);
  }

  /* ============================================================
     EXPENSE ENTRY — SAVE
     Saves a driver expense to the "Expense_Entry" form. Field API
     names below now match the real Expense_Entry form export: Trip
     (not Trip_ID), Driver (not Driver_ID), a must-have Vehicle lookup,
     Expense_Type as a Lookup record ID (see Xr() above), Payment_Method
     as one of the form's exact static values, Transaction_Reference,
     and Description (not Note). The form has no Current_Location /
     Current_Location_URL fields, so that optional context is folded
     into Description instead of being silently dropped.
     The receipt file is uploaded separately via ZOHO.CREATOR.FILE.
     uploadFile() after the record is created, since a file field
     needs an existing record id to attach to.
     ============================================================ */
  function zohoDateFromInput(v) {
    if (!v) return "";
    var parts = String(v).split("-");
    if (3 !== parts.length) return "";
    var y = parts[0],
      mo = Number(parts[1]) - 1,
      d = Number(parts[2]);
    return isNaN(mo) || isNaN(d) || !h[mo] ? "" : p(d) + "-" + h[mo] + "-" + y;
  }

  function clearExpenseForm() {
    [
      "#inExpDate",
      "#inExpType",
      "#inExpAmount",
      "#inExpPayment",
      "#inExpTransRef",
      "#inExpNote",
      "#inExpLoc",
      "#inExpUrl",
    ].forEach(function (sel) {
      var el = u(sel);
      el && (el.value = "");
    });
    var f = u("#inExpReceipt");
    f && (f.value = "");
  }

  async function submitExpenseEntry() {
    var e = u("#expErr");
    if (
      ((e.hidden = !0),
      xt(["fExpDate", "fExpType", "fExpAmount", "fExpPayment"]),
      Pt(
        [
          ["#inExpDate", "fExpDate", "Enter the expense date."],
          ["#inExpType", "fExpType", "Select an expense type."],
          ["#inExpAmount", "fExpAmount", "Enter the amount."],
          ["#inExpPayment", "fExpPayment", "Select a payment method."],
        ],
        e,
      ))
    ) {
      if (!K.tripRecordId)
        return (
          console.error(gr, "no active trip", K),
          (e.textContent =
            "Start a trip first — this expense isn't linked to a trip yet."),
          void (e.hidden = !1)
        );
      if (!K.vehicleRecordId)
        return (
          console.error(gr, "no vehicle on active trip", K),
          (e.textContent =
            "No vehicle found on this trip — the Expense Entry form requires one."),
          void (e.hidden = !1)
        );
      var t = {
          date: At("#inExpDate"),
          type: At("#inExpType"),
          amount: At("#inExpAmount"),
          payment: At("#inExpPayment"),
          transRef: At("#inExpTransRef"),
          note: At("#inExpNote"),
          loc: At("#inExpLoc"),
          url: At("#inExpUrl"),
        },
        n = await resolveEmployeeFormId(),
        descParts = [t.note].filter(Boolean),
        i = {
          Trip: K.tripRecordId,
          Driver: n || K.driverRecordId || K.driverEmployeeRecordId || "",
          Vehicle: K.vehicleRecordId,
          Expense_Date: zohoDateFromInput(t.date),
          Expense_Type: t.type,
          Amount: t.amount,
          Payment_Method: t.payment,
          Description: descParts.join(" | "),
        };
      /* Live_Location / Live_Location_URL are real fields on the Expense_Entry
         Zoho form (see form export), so send them as their own fields instead
         of folding them into Description — that's what was silently dropping
         them from the saved record. Live_Location_URL is a url-type field, so
         it must be sent as {url: ...} just like Start Trip does above. */
      t.loc && (i.Live_Location = t.loc);
      t.url &&
        (i.Live_Location_URL = {
          url: t.url,
        });
      if (
        (t.transRef && (i.Transaction_Reference = t.transRef),
        !window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA)
      )
        return (
          clearExpenseForm(),
          R("Expense entry saved — " + t.type),
          void Y("trip")
        );
      ZOHO.CREATOR.DATA.addRecords({
        form_name: "Expense_Entry",
        payload: {
          data: i,
        },
      })
        .then(function (res) {
          /* Same fix as Start Trip / Fuel Entry: addRecords() resolves even
           when Creator rejects the record, so the response code must be
           checked explicitly or a rejected save still looks like success. */
          console.log(gr, "Expense_Entry addRecords response:", res);
          var expCode =
            res &&
            (res.code || (res.result && res.result[0] && res.result[0].code));
          if (void 0 !== expCode && 3e3 !== expCode) {
            console.error(
              gr,
              "Creator rejected the Expense_Entry record. code:",
              expCode,
              res,
            );
            ((e.textContent = "Couldn't save: " + _r(res)), (e.hidden = !1));
            return;
          }
          var newId = (res && res.data && (res.data.ID || res.data.id)) || null,
            fi = u("#inExpReceipt"),
            file = fi && fi.files && fi.files[0];
          if (!newId || !file)
            return (
              clearExpenseForm(),
              R("Expense entry saved — " + t.type),
              void Y("trip")
            );
          if (!window.ZOHO.CREATOR.FILE || !ZOHO.CREATOR.FILE.uploadFile) {
            console.error(
              gr,
              "ZOHO.CREATOR.FILE.uploadFile is not available — Receipt was not uploaded.",
            );
            (clearExpenseForm(),
              R("Expense entry saved, but the receipt could not be uploaded."),
              Y("trip"));
            return;
          }
          /* IMPORTANT: report_name must be the RECORD/REPORT link name that the
           Expense_Entry FORM writes into (Zoho auto-generates one, commonly
           "All_Expense_Entry" unless it was renamed) — it is NOT always the
           same as the form's own link name used above for addRecords. If the
           Receipt still doesn't attach, open the Expense_Entry form in
           Zoho Creator, check the report it submits to, and update the
           report_name value below to match exactly. */
          ZOHO.CREATOR.FILE.uploadFile({
            report_name: "All_Expense_Entry",
            id: newId,
            field_name: "Receipt",
            file: file,
          })
            .then(function () {
              (clearExpenseForm(),
                R("Expense entry saved — " + t.type),
                Y("trip"));
            })
            .catch(function (err) {
              console.error(gr, "Expense receipt upload failed:", err);
              (clearExpenseForm(),
                R(
                  "Expense entry saved, but the receipt upload failed: " +
                    _r(err),
                ),
                Y("trip"));
            });
        })
        .catch(function (t) {
          (console.error(gr, "Expense_Entry save failed:", t),
            (e.textContent = "Couldn't save: " + _r(t)),
            (e.hidden = !1));
        });
    }
  }
  var Gt = [];

  function jt() {
    var e = _(At("#inBrkStart")),
      t = _(At("#inBrkEnd"));
    return null !== e && null !== t && At("#inBrkStart") && At("#inBrkEnd")
      ? t >= e
        ? t - e
        : t + 1440 - e
      : null;
  }

  function br2() {
    w("brkCountLabel", "Break #" + (o.breakCount + 1) + " for this trip");
  }

  function zt() {
    var e = jt();
    (w("brkLength", null === e ? "—" : f(e)),
      w("brkRequired", a.restBlock + " min"),
      w(
        "brkStatus",
        null === e
          ? "—"
          : e >= a.restBlock
            ? "Qualifies as a rest block"
            : "Shorter than required",
      ));
  }
  async function Yt() {
    var e = u("#brkErr");
    if (
      ((e.hidden = !0),
      xt(["fBrkDate", "fBrkStart", "fBrkEnd", "fBrkLoc"]),
      Pt(
        [
          ["#inBrkStart", "fBrkStart", "Enter your break start time."],
          ["#inBrkEnd", "fBrkEnd", "Enter your break end time."],
          ["#inBrkLoc", "fBrkLoc", "Enter your live location."],
        ],
        e,
      ))
    ) {
      var t = jt();
      if (0 === t)
        return (
          u("#fBrkEnd").classList.add("is-bad"),
          (e.textContent = "End time cannot match the start time."),
          void (e.hidden = !1)
        );
      if (!K.tripRecordId)
        return (
          console.error(gr, "no active trip", K),
          (e.textContent =
            "Start a trip first — this break isn't linked to a trip yet."),
          void (e.hidden = !1)
        );
      var breakNo = o.breakCount + 1,
        statusTxt =
          (t >= a.restBlock
            ? "Qualifies as a rest block"
            : "Shorter than required") +
          " — Break #" +
          breakNo,
        r = {
          date: At("#inBrkDate") || k(),
          tripName: At("#inBrkTripName"),
          tripId: At("#inBrkTripId"),
          start: At("#inBrkStart"),
          end: At("#inBrkEnd"),
          location: At("#inBrkLoc"),
          liveUrl: Rt(At("#inBrkUrl")),
          minutes: t,
          breakNo: breakNo,
          status: statusTxt,
        };
      Gt.unshift(r);
      var todayD = new Date(),
        zohoDate =
          p(todayD.getDate()) +
          "-" +
          h[todayD.getMonth()] +
          "-" +
          todayD.getFullYear(),
        empId = await resolveEmployeeFormId(),
        payload = {
          Current_date: zohoDate,
          Trip_ID: cr2(K.tripRecordId || K.tripId),
          Trip_Name: cr2(K.tripRecordId || K.tripId),
          Driver_ID: cr2(
            empId || K.driverRecordId || K.driverEmployeeRecordId || "",
          ),
          Driver_Name: cr2(
            empId || K.driverRecordId || K.driverEmployeeRecordId || "",
          ),
          Start_time: b(r.start),
          End_time: b(r.end),
          Live_location: r.location,
          Total_break_duration: r.minutes,
          Required_Block: a.restBlock,
          Status: r.status,
        };
      (r.liveUrl &&
        (payload.Live_Location_URL = {
          url: r.liveUrl,
        }),
        window.ZOHO &&
          ZOHO.CREATOR &&
          ZOHO.CREATOR.DATA &&
          (await ZOHO.CREATOR.DATA.addRecords({
            form_name: "Log_a_break",
            payload: {
              data: payload,
            },
          }).catch(function (t) {
            (console.error(gr, "Log_a_break save failed:", t),
              (e.textContent = "Couldn't save: " + _r(t)),
              (e.hidden = !1));
          })),
        (o.breakCount = breakNo),
        t >= a.restBlock &&
          ((o.sinceRestMins = 0),
          (o.restAlertShown = !1),
          (o.restEscalated = !1),
          F()),
        (o.restTakenMins += t),
        P(),
        ir(),
        ["#inBrkStart", "#inBrkEnd", "#inBrkLoc", "#inBrkUrl"].forEach(
          function (e) {
            var t = u(e);
            t && (t.value = "");
          },
        ),
        zt(),
        br2(),
        R("Break #" + breakNo + " saved — " + f(t) + " logged"),
        Y("trip"));
    }
  }
  var Qt = null;

  function Jt(e) {
    0;
    var t = document.getElementById("mapHubFilter");
    (t && t.value !== (e || "") && (t.value = e || ""),
      m(".mhub").forEach(function (t) {
        t.classList.toggle(
          "is-active",
          !!e && t.getAttribute("data-hub") === e,
        );
      }));
    var r = document.getElementById("mapHubInfo");
    if (r)
      if (e) {
        var n = Q.filter(function (t) {
          return t.name === e;
        })[0];
        if (n) {
          (w("mapHubInfoBadge", "Stop #" + n.no),
            w("mapHubInfoName", n.name),
            w("mapHubInfoLoc", n.location));
          var i = document.getElementById("mapHubInfoStatus");
          (i &&
            ((i.textContent = ne(n.status)),
            (i.className = "hubstatus is-" + n.status)),
            (r.hidden = !1));
        } else r.hidden = !0;
      } else r.hidden = !0;
  }
  var Xt = 486 / 874,
    Kt = 0;

  function $t() {
    Qt && (clearInterval(Qt), (Qt = null));
  }

  function er(e, t) {
    (tr(),
      (document.getElementById(e).hidden = !1),
      (u("#scrim").hidden = !1),
      t &&
        (t.classList.add("is-open"), t.setAttribute("aria-expanded", "true")),
      (document.body.style.overflow = "hidden"));
  }

  function tr() {
    (m(".panel").forEach(function (e) {
      e.hidden = !0;
    }),
      (u("#scrim").hidden = !0),
      m(".avbtn").forEach(function (e) {
        (e.classList.remove("is-open"),
          e.setAttribute("aria-expanded", "false"));
      }),
      m("[data-panel]").forEach(function (e) {
        e.classList.remove("is-open");
      }),
      (document.body.style.overflow = ""));
  }

  function rr() {
    m("[data-fill]").forEach(function (e, t) {
      var r = Math.max(
        0,
        Math.min(100, Number(e.getAttribute("data-fill")) || 0),
      );
      ((e.style.width = "0"),
        setTimeout(
          function () {
            e.style.width = r + "%";
          },
          90 + 55 * t,
        ));
    });
  }

  /* ============================================================
     DRIVER SCORE + BFM LOG + REST-ENDING WARNING
     Score = 100 minus every deduction from the last a.scoreWindowDays
     days. Deductions come from real driver-flow events: BFM short rest /
     overage (fatigue), accident reports (safety), partial / cancelled
     PODs (delivery). History is kept per driver in localStorage.
     ============================================================ */
  var SCORE_STORE = {
      prefix: "skyway.driverScore.",
      key: "",
      events: [],
      cap: 400,
    },
    BFM_LOG_STORE = {
      prefix: "skyway.bfmLog.",
      key: "",
      events: [],
      cap: 500,
    },
    REST_WARN_TIMER = null,
    REST_COMPLETE_TIMER = null;

  function evStorePrune(st) {
    var cut = Date.now() - a.scoreWindowDays * 864e5;
    st.events = st.events
      .filter(function (ev) {
        return ev && ev.ts >= cut;
      })
      .sort(function (x, y) {
        return y.ts - x.ts;
      })
      .slice(0, st.cap);
  }

  function evStoreSave(st) {
    if (!st.key) return;
    try {
      localStorage.setItem(st.key, JSON.stringify(st.events));
    } catch (err) {
      console.warn(gr, "score/log history could not be saved:", err);
    }
  }

  function evStoreSync(st) {
    var k = s.recordId ? st.prefix + s.recordId : "";
    if (!k) return !1;
    if (st.key === k) return !0;
    var stored = [];
    try {
      stored = JSON.parse(localStorage.getItem(k) || "[]") || [];
    } catch (err) {
      stored = [];
    }
    var seen = {},
      merged = [];
    st.events.concat(stored).forEach(function (ev) {
      ev && ev.id && !seen[ev.id] && ((seen[ev.id] = !0), merged.push(ev));
    });
    ((st.key = k), (st.events = merged), evStorePrune(st), evStoreSave(st));
    return !0;
  }

  function evStoreAdd(st, ev) {
    evStoreSync(st);
    if (
      ev.k &&
      st.events.some(function (x) {
        return x.k === ev.k;
      })
    )
      return !1;
    ((ev.id = Date.now() + "-" + Math.random().toString(36).slice(2, 7)),
      (ev.ts = Date.now()),
      st.events.unshift(ev),
      evStorePrune(st),
      evStoreSave(st));
    return !0;
  }

  function logStamp(ts) {
    var d2 = new Date(ts);
    return (
      p(d2.getDate()) +
      " " +
      h[d2.getMonth()] +
      " " +
      p(d2.getHours()) +
      ":" +
      p(d2.getMinutes())
    );
  }

  function scoreCalc() {
    var cats = {
        fatigue: 0,
        safety: 0,
        delivery: 0,
      },
      total = 0;
    SCORE_STORE.events.forEach(function (ev) {
      var pts = Number(ev.pts) || 0;
      ((cats[ev.cat] = (cats[ev.cat] || 0) + pts), (total += pts));
    });
    return {
      score: Math.max(0, Math.round(100 - total)),
      cats: cats,
      events: SCORE_STORE.events,
    };
  }

  function scoreBand(v) {
    return v >= 90
      ? {
          label: "Excellent",
          color: "#0F9D58",
        }
      : v >= 75
        ? {
            label: "Good",
            color: "#0F9D58",
          }
        : v >= 60
          ? {
              label: "Fair",
              color: "#C77700",
            }
          : {
              label: "Needs improvement",
              color: "#D3352B",
            };
  }

  function scoreSetBar(id, valId, val) {
    var bar = u("#" + id),
      shown = null == val ? "\u2014" : String(val);
    w(valId, shown);
    if (!bar) return;
    bar.setAttribute("data-fill", null == val ? 0 : val);
    bar.className =
      null == val || val >= 85 ? "green" : val >= 70 ? "amber" : "red";
  }

  function scoreRenderPanel() {
    try {
      var ready = evStoreSync(SCORE_STORE);
      ready && evStorePrune(SCORE_STORE);
      var res = scoreCalc(),
        band = scoreBand(res.score);
      s.score = ready ? res.score : 0;
      (w("scoreMini", ready ? res.score : "\u2014"),
        w("scoreBig", ready ? res.score : "\u2014"),
        w("scoreBand", ready ? band.label : "\u2014"),
        w("scoreBandMini", ready ? band.label : "\u2014"));
      ["#scoreRing", "#scoreArc"].forEach(function (sel) {
        var el = u(sel);
        el && el.setAttribute("stroke", ready ? band.color : "#E3E8F0");
      });
      var n = res.events.length;
      w(
        "scoreSub",
        ready
          ? (n
              ? n + (1 === n ? " deduction" : " deductions")
              : "No deductions") +
              " in the last " +
              a.scoreWindowDays +
              " days"
          : "Loading your score\u2026",
      );
      var pct = function (c) {
        return ready ? Math.max(0, 100 - res.cats[c]) : null;
      };
      (scoreSetBar("scoreBarSafety", "scoreValSafety", pct("safety")),
        scoreSetBar("scoreBarDelivery", "scoreValDelivery", pct("delivery")),
        scoreSetBar("scoreBarFatigue", "scoreValFatigue", pct("fatigue")),
        scoreSetBar("scoreBarFuel", "scoreValFuel", null),
        scoreSetBar("scoreBarVehicle", "scoreValVehicle", null));
      var rules = u("#scoreRules");
      if (rules) {
        rules.innerHTML = "";
        [
          ["Rest shorter than a BFM tier requires", a.scorePerShortRest],
          [
            "Every " + a.overageBlockMins + " min driven past a BFM limit",
            a.scorePerOverageBlock,
          ],
          ["Accident reported", a.scorePerAccident],
          ["Partially received delivery", a.scorePerPartialDelivery],
          ["Cancelled delivery", a.scorePerCancelledDelivery],
        ].forEach(function (r2) {
          var li = document.createElement("li"),
            sp = document.createElement("span"),
            bb = document.createElement("b");
          ((sp.textContent = r2[0]),
            (bb.textContent = "\u2212" + r2[1]),
            li.appendChild(sp),
            li.appendChild(bb),
            rules.appendChild(li));
        });
        var note = document.createElement("li");
        ((note.textContent =
          "Deductions drop off after " +
          a.scoreWindowDays +
          " days. Fuel efficiency and vehicle care aren't scored yet."),
          rules.appendChild(note));
      }
      var ded = u("#scoreDeductions");
      if (ded) {
        ded.innerHTML = "";
        res.events.slice(0, 8).forEach(function (ev) {
          var li = document.createElement("li"),
            pt = document.createElement("span"),
            box = document.createElement("div"),
            tx = document.createElement("p"),
            tm = document.createElement("time");
          ((pt.className = "scoreded__pts"),
            (pt.textContent = "\u2212" + ev.pts),
            (tx.textContent = ev.text || ""),
            (tm.textContent = logStamp(ev.ts)),
            box.appendChild(tx),
            box.appendChild(tm),
            li.appendChild(pt),
            li.appendChild(box),
            ded.appendChild(li));
        });
        if (!res.events.length) {
          var none = document.createElement("li");
          ((none.className = "scoreded__none"),
            (none.textContent = "Nothing deducted."),
            ded.appendChild(none));
        }
      }
    } catch (err) {
      console.warn(gr, "scoreRenderPanel failed:", err);
    }
  }

  function scoreRefresh() {
    nr();
    var panel = u("#panelScore");
    panel && !panel.hidden && rr();
  }

  function scoreAdd(cat, pts, text, dedupeKey) {
    if (!(pts > 0)) return;
    try {
      evStoreAdd(SCORE_STORE, {
        cat: cat,
        pts: pts,
        text: text,
        trip: (K && K.tripId) || X || "",
        k: dedupeKey || "",
      });
    } catch (err) {
      console.warn(gr, "scoreAdd failed:", err);
    }
    scoreRefresh();
  }

  function scoreAccident(name, recordId) {
    scoreAdd(
      "safety",
      a.scorePerAccident,
      "Accident reported: " + (name || "accident"),
      "acc:" + (recordId || Date.now()),
    );
  }

  /* Called once a POD has been saved to Creator (both the hub flow and the
     dispatch flow end in the same POD Saved popup). */
  function scorePodOutcome(recordId) {
    var st = String(podResultDomValue("podResultStatus") || "").toLowerCase();
    if (!recordId) return;
    if (-1 !== st.indexOf("partial"))
      scoreAdd(
        "delivery",
        a.scorePerPartialDelivery,
        "Partially received delivery",
        "pod:" + recordId,
      );
    else if (-1 !== st.indexOf("cancel"))
      scoreAdd(
        "delivery",
        a.scorePerCancelledDelivery,
        "Cancelled delivery",
        "pod:" + recordId,
      );
  }

  function bfmLogAdd(type, tier, text, pts, tone) {
    try {
      evStoreAdd(BFM_LOG_STORE, {
        type: type,
        tier: tier,
        text: text,
        pts: Number(pts) || 0,
        tone: tone || "amber",
        trip: (K && K.tripId) || X || "",
      });
      var panel = u("#panelBfmLogs");
      panel && !panel.hidden && bfmLogsRender();
    } catch (err) {
      console.warn(gr, "bfmLogAdd failed:", err);
    }
  }

  function bfmLogsRender() {
    (w("bfmLogDriverId", (s && s.id) || "—"),
      w("bfmLogTripId", (K && K.tripId) || X || "—"));
    (evStoreSync(BFM_LOG_STORE), evStorePrune(BFM_LOG_STORE));
    var events = BFM_LOG_STORE.events,
      limits = 0,
      shortRests = 0,
      pts = 0;
    (events.forEach(function (ev) {
      ("Limit reached" === ev.type && limits++,
        "Insufficient rest" === ev.type && shortRests++,
        (pts += Number(ev.pts) || 0));
    }),
      w("bfmLogLimits", String(limits)),
      w("bfmLogShort", String(shortRests)),
      w("bfmLogPts", String(pts)));
    var host = u("#bfmLogList");
    if (!host) return;
    host.innerHTML = "";
    if (!events.length) {
      var empty = document.createElement("li");
      return (
        (empty.className = "bfmlog__empty"),
        (empty.textContent = "No BFM events recorded yet."),
        void host.appendChild(empty)
      );
    }
    var lastDay = "";
    events.forEach(function (ev) {
      var d2 = new Date(ev.ts),
        day = p(d2.getDate()) + " " + h[d2.getMonth()] + " " + d2.getFullYear();
      if (day !== lastDay) {
        lastDay = day;
        var hd = document.createElement("li");
        ((hd.className = "bfmlog__day"),
          (hd.textContent = day),
          host.appendChild(hd));
      }
      var li = document.createElement("li"),
        box = document.createElement("div"),
        ttl = document.createElement("b"),
        tx = document.createElement("p"),
        tm = document.createElement("time");
      ((li.className = "bfmlog__item " + (ev.tone || "amber")),
        (ttl.textContent =
          ev.type + (ev.tier && "BFM" !== ev.tier ? " \u00b7 " + ev.tier : "")),
        (tx.textContent = ev.text || ""),
        (tm.textContent =
          logStamp(ev.ts) + (ev.trip ? " \u00b7 " + ev.trip : "")),
        box.appendChild(ttl),
        box.appendChild(tx),
        box.appendChild(tm),
        li.appendChild(box));
      if (ev.pts) {
        var pt = document.createElement("span");
        ((pt.className = "bfmlog__pts"),
          (pt.textContent = "\u2212" + ev.pts),
          li.appendChild(pt));
      }
      host.appendChild(li);
    });
  }

  function openBfmLogsPanel() {
    (bfmLogsRender(), er("panelBfmLogs", null));
  }

  /* ---------- rest ends in 2 minutes ---------- */
  function clearRestWarnTimer() {
    (REST_WARN_TIMER &&
      (clearTimeout(REST_WARN_TIMER), (REST_WARN_TIMER = null)),
      REST_COMPLETE_TIMER &&
        (clearTimeout(REST_COMPLETE_TIMER), (REST_COMPLETE_TIMER = null)));
  }

  function armRestWarnTimer() {
    clearRestWarnTimer();
    if (
      !o.onBreak ||
      !o.restTargetMins ||
      o.restWarnNotified ||
      !o.breakStartTs
    )
      return;
    var target =
      o.restTargetMins || a.tiers[o.activeBfmRuleIndex || 0].restMins;
    if (target <= a.restWarnMins) return;
    var delay = o.breakStartTs + (target - a.restWarnMins) * 6e4 - Date.now();
    delay > 0 && (REST_WARN_TIMER = setTimeout(maybeNotifyRestEnding, delay));
  }

  function armRestCompleteTimer() {
    if (
      !o.onBreak ||
      !o.restTargetMins ||
      o.restCompleteNotified ||
      !o.breakStartTs
    )
      return;
    var target =
        o.restTargetMins || a.tiers[o.activeBfmRuleIndex || 0].restMins,
      delay = o.breakStartTs + target * 6e4 - Date.now();
    if (delay <= 0)
      return void (
        !o.restCompleteNotified &&
        ((o.restCompleteNotified = !0), notifyRestComplete())
      );
    REST_COMPLETE_TIMER = setTimeout(function () {
      o.tripStarted &&
        o.onBreak &&
        !o.restCompleteNotified &&
        ((o.restCompleteNotified = !0),
        notifyRestComplete(),
        saveTripSnapshot());
    }, delay);
  }

  function maybeNotifyRestEnding() {
    if (!o.tripStarted || !o.onBreak || o.restWarnNotified) return;
    var target =
      o.restTargetMins || a.tiers[o.activeBfmRuleIndex || 0].restMins;
    if (target <= a.restWarnMins) return;
    var remainingMs = o.breakStartTs
      ? o.breakStartTs + 6e4 * target - Date.now()
      : 6e4 * (target - o.breakElapsedMins);
    if (remainingMs <= 0 || remainingMs > 6e4 * a.restWarnMins + 1500) return;
    ((o.restWarnNotified = !0),
      clearRestWarnTimer(),
      notifyRestEndingSoon(a.restWarnMins),
      saveTripSnapshot());
  }

  function notifyRestEndingSoon(mins) {
    var msg =
      "Your rest time will be completed in " +
      mins +
      (1 === mins ? " minute." : " minutes.");
    (pushBfmNotification("amber", msg),
      O(),
      bfmLogAdd("Rest ending soon", "BFM", msg, 0, "amber"));
    try {
      navigator.vibrate && navigator.vibrate([200, 100, 200]);
    } catch (err) {}
    var toast = document.createElement("div");
    ((toast.className = "rest-alert"),
      toast.setAttribute("role", "alert"),
      (toast.style.borderLeftColor = "#C77700"),
      (toast.style.borderColor = "rgba(199,119,0,.3)"),
      (toast.innerHTML =
        '<svg width="20" height="20" style="flex:none;color:#C77700;margin-top:1px"><use href="#i-clock"/></svg><div style="flex:1"><b></b><p></p></div><button class="xbtn" aria-label="Dismiss">\u2715</button>'),
      (toast.querySelector("b").textContent = "Rest ending soon"),
      (toast.querySelector("p").textContent = msg),
      toast.querySelector("button").addEventListener("click", function () {
        toast.remove();
      }),
      document.body.appendChild(toast),
      setTimeout(function () {
        toast.parentNode && toast.remove();
      }, 2e4));
  }

  function nr() {
    var e = 2 * Math.PI * 50,
      t = 2 * Math.PI * 14,
      r = u("#scoreRing"),
      n = u("#scoreArc");
    (r &&
      setTimeout(function () {
        r.style.strokeDashoffset = e * (1 - s.score / 100);
      }, 250),
      n &&
        (n.setAttribute("stroke-dasharray", t),
        setTimeout(function () {
          ((n.style.transition = "stroke-dashoffset 1s ease"),
            (n.style.strokeDashoffset = t * (1 - s.score / 100)));
        }, 350)),
      w("scoreMini", s.score),
      w("scoreBig", s.score),
      scoreRenderPanel());
  }

  /* ---------- REPLACES ir() ----------
     Drops the four hardcoded demo alerts (service due, "POD submitted —
     Stop #8", "Route updated by Dispatch", "Medical cert expires in 28
     days) AND the synthesized "Rest block due" status line, which used to
     be re-timestamped as "new Date" on every render (always showing "Just
     now" regardless of whether anything actually happened). The live rest
     countdown is already shown in its own BFM widget (bfmCountdown /
     tripBfmRestText, etc.) — it doesn't belong in the alert history too.
     Shows ONLY real, system-generated pushBfmNotification() entries (Lr). */
  function ir() {
    var t = Lr.slice().sort(function (e, t) {
      return t.ts - e.ts;
    });
    var host = u("#alertList");
    host &&
      (host.innerHTML = t.length
        ? t
            .map(function (e) {
              return (
                '<li class="alert ' +
                e.tone +
                '"><i class="status-dot ' +
                e.tone +
                '" style="margin-top:5px"></i><div><p>' +
                e.text +
                "</p><time>" +
                relTime(e.ts) +
                "</time></div></li>"
              );
            })
            .join("")
        : '<li class="alert-empty">No alerts right now.</li>');
  }

  /* ---------- NEW: Stops completed KPI ----------
     total     = number of hubs/locations on the assigned Booking (Q, built by
                 rebuildHubPipelineFromBooking()).
     completed = hubs marked "done" in the pipeline, hubs that already have a
                 Delivered / Partially Received POD saved this session (l),
                 OR hubs with such a POD already saved in Zoho Creator for
                 this trip (STOP_REMOTE_DONE — so the count survives a reload).
     remaining = total - completed.
     Shown in the Trip details KPI card and in the summary strip on the
     "Hubs & stops" card. */
  var STOP_REMOTE_DONE = {};

  function stopCounts() {
    var deliveredHubs = {};
    l.forEach(function (rep) {
      ("Delivered" === rep.status || "Partially Received" === rep.status) &&
        (deliveredHubs[rep.hub] = !0);
    });
    var total = Q.length,
      completed = Q.filter(function (hub) {
        return (
          "done" === hub.status ||
          deliveredHubs[hub.name] ||
          STOP_REMOTE_DONE[normKey(hub.name)]
        );
      }).length;
    return {
      total: total,
      completed: completed,
      remaining: Math.max(0, total - completed),
    };
  }

  function updateStopsCompletedKpi() {
    var c = stopCounts(),
      total = c.total,
      completed = c.completed,
      valEl =
        u("#stopsKpiVal") ||
        document.querySelector('[data-action="deliveries"] .kpi__val'),
      subEl =
        u("#stopsKpiSub") ||
        document.querySelector('[data-action="deliveries"] .kpi__sub'),
      barEl = u("#stopsKpiBar");
    (w("stopsAvail", total ? String(total) : "\u2014"),
      w("stopsDone", total ? String(completed) : "\u2014"),
      w("stopsLeft", total ? String(c.remaining) : "\u2014"));
    if (!total) {
      valEl && (valEl.innerHTML = "\u2014 <small>/ \u2014</small>");
      subEl &&
        (subEl.textContent = K.tripRecordId
          ? "No stops found for this trip yet"
          : "Start a trip to see its stops");
      return void (barEl && (barEl.style.width = "0%"));
    }
    valEl && (valEl.innerHTML = completed + " <small>/ " + total + "</small>");
    barEl && (barEl.style.width = Math.round((100 * completed) / total) + "%");
    if (subEl) {
      var nextHub = Q.filter(function (hub) {
          return "next" === hub.status;
        })[0],
        line1 =
          total +
          (1 === total ? " stop" : " stops") +
          " available \u00b7 " +
          completed +
          " completed \u00b7 " +
          c.remaining +
          " remaining";
      subEl.textContent = "";
      subEl.appendChild(document.createTextNode(line1));
      var line2 = nextHub
        ? "Next: " + nextHub.name
        : completed === total
          ? "All stops complete"
          : "";
      if (line2) {
        subEl.appendChild(document.createElement("br"));
        subEl.appendChild(document.createTextNode(line2));
      }
    }
  }

  /* Reads this trip's saved PODs from Creator (POD_PDF1) so hubs delivered
     before a reload / on another device still count as completed. Failure is
     non-fatal: the in-session count keeps working. */
  function refreshStopsCompletedFromCreator() {
    if (
      !window.ZOHO ||
      !ZOHO.CREATOR ||
      !ZOHO.CREATOR.DATA ||
      !(K.tripRecordId || K.tripId)
    )
      return Promise.resolve();
    var parts = [];
    K.tripId && parts.push('Trip_ID == "' + escapeCriteria(K.tripId) + '"');
    K.tripRecordId &&
      K.tripRecordId !== K.tripId &&
      parts.push('Trip_ID == "' + escapeCriteria(K.tripRecordId) + '"');
    return kr({
      report_name: POD_PDF_REPORT_NAME,
      criteria: "(" + parts.join(" || ") + ")",
      field_config: "all",
      max_records: 1000,
    })
      .then(function (res) {
        var set = {};
        ((res && res.data) || []).forEach(function (row) {
          var st = String(cr(row.Delivery_Status) || "")
            .trim()
            .toLowerCase();
          if ("delivered" !== st && "partially received" !== st) return;
          var loc = normKey(cr(row.Delivery_Location));
          loc && (set[loc] = !0);
        });
        ((STOP_REMOTE_DONE = set), updateStopsCompletedKpi());
      })
      .catch(function (err) {
        console.warn(
          gr,
          "Stops completed: could not read " + POD_PDF_REPORT_NAME + ":",
          err,
        );
      });
  }

  function ar(e) {
    return String(e || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function or(e, t) {
    if (!e) return null;
    for (var r = 0; r < t.length; r++) {
      var n = t[r];
      if (n && void 0 !== e[n] && null !== e[n] && "" !== e[n]) return n;
    }
    for (
      var i = t.filter(Boolean).map(ar), a = Object.keys(e), o = 0;
      o < a.length;
      o++
    )
      if (-1 !== i.indexOf(ar(a[o]))) {
        var s = e[a[o]];
        if (null != s && "" !== s) return a[o];
      }
    return null;
  }

  function sr(e, t) {
    var r = or(e, t);
    return r ? e[r] : "";
  }

  function cr(e) {
    return null == e
      ? ""
      : "string" == typeof e || "number" == typeof e
        ? String(e)
        : e.display_value || e.zc_display_value || e.ID || "";
  }

  function lr(e) {
    return e
      ? "string" == typeof e
        ? e
        : e.display_value ||
          [e.prefix, e.first_name, e.last_name, e.suffix]
            .filter(Boolean)
            .join(" ")
      : "";
  }

  function dr(e) {
    return e
      ? "string" == typeof e
        ? e
        : e.display_value ||
          [e.district_city, e.state_province].filter(Boolean).join(" ")
      : "";
  }

  function ur(e) {
    var t = (function (e) {
      if (!e) return null;
      var t = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})/.exec(e);
      if (t) {
        var r = {
          Jan: 0,
          Feb: 1,
          Mar: 2,
          Apr: 3,
          May: 4,
          Jun: 5,
          Jul: 6,
          Aug: 7,
          Sep: 8,
          Oct: 9,
          Nov: 10,
          Dec: 11,
        }[t[2]];
        if (void 0 !== r) return new Date(Number(t[3]), r, Number(t[1]));
      }
      var n = new Date(e);
      return isNaN(n) ? null : n;
    })(e);
    return t ? Math.round((t - new Date()) / 864e5) : null;
  }

  function mr(e, t, r, n) {
    var i = document.getElementById(e),
      a = document.getElementById(t);
    if ((a && (a.textContent = n || "--"), !r || !i)) return;
    /* PHOTO FIX: some Zoho Creator image-field shapes come back as an object
       (e.g. {url:...} / {display_value:...} / {filepath:...}) rather than a
       plain string — passing that object straight to ZOHO.CREATOR.UTIL
       .setImageData()/img.src (both of which expect a string) silently
       failed and left the avatar stuck on initials. Unwrap it here first. */
    r = profilePictureValue(r);
    if (!r) return;

    /* A usable photo source takes precedence over initials from the moment
       it is requested. The initials return only when the image actually
       fails, so there is no placeholder flash for an uploaded picture. */
    a && (a.hidden = !0);

    function done() {
      ((i.hidden = !1), a && (a.hidden = !0));
    }

    function fail() {
      ((i.hidden = !0), a && (a.hidden = !1));
    }
    /* PROFILE PICTURE FIX: ZOHO.CREATOR.UTIL.setImageData() sets the <img> src
       itself and (depending on SDK version) returns a promise or nothing — it
       never reliably calls a callback, so the old "done" callback never ran and
       the avatar stayed hidden behind the initials. Listen to the image's own
       load/error events instead, which works for every SDK behaviour, on
       iPhone, Android, tablet and desktop alike. */
    var settled = !1,
      timer = null;

    function cleanup() {
      (i.removeEventListener("load", onLoad),
        i.removeEventListener("error", bad),
        clearTimeout(timer));
    }

    function ok() {
      settled || ((settled = !0), cleanup(), done());
    }

    function bad() {
      settled || ((settled = !0), cleanup(), fail());
    }

    function onLoad() {
      i.naturalWidth ? ok() : bad();
    }
    (i.addEventListener("load", onLoad),
      i.addEventListener("error", bad),
      (timer = setTimeout(function () {
        i.getAttribute("src") && i.complete && i.naturalWidth ? ok() : bad();
      }, 12e3)));
    if (
      window.ZOHO &&
      ZOHO.CREATOR &&
      ZOHO.CREATOR.UTIL &&
      ZOHO.CREATOR.UTIL.setImageData
    ) {
      try {
        /* Creator SDK builds differ: older mobile webviews invoke the
           callback while newer ones resolve a Promise (and both still fire
           the native image load event). Supporting all three prevents the
           initials fallback from remaining visible on iOS or Android. */
        var call = ZOHO.CREATOR.UTIL.setImageData(i, r, ok);
        call &&
          call.then &&
          call.then(
            function () {
              i.getAttribute("src") && i.complete && i.naturalWidth && ok();
            },
            function (err) {
              (console.warn(gr, "Profile picture could not be loaded:", err),
                bad());
            },
          );
      } catch (err) {
        (console.warn(gr, "Profile picture could not be loaded:", err), bad());
      }
    } else i.src = r;
  }

  function pr() {
    var e = u("#docViewerPopup"),
      t = u("#docViewerScrim");
    (e && (e.hidden = !0),
      t && (t.hidden = !0),
      (document.body.style.overflow = ""));
    var r = u("#docViewerFrame");
    r && (r.src = "about:blank");
  }

  function fr(e, t, r, n) {
    var i,
      a = document.getElementById(t),
      o = document.getElementById(r),
      s = document.getElementById(n);

    function c(e) {
      (o && (o.textContent = "On file"),
        a && a.classList.remove("is-missing"),
        s && ((s.href = e), s.removeAttribute("aria-disabled")));
    }
    if (!e)
      return (
        o && (o.textContent = i || "Not on file"),
        a && a.classList.add("is-missing"),
        void (
          s &&
          (s.setAttribute("aria-disabled", "true"), s.removeAttribute("href"))
        )
      );
    if (
      (o && (o.textContent = "Loading…"),
      window.ZOHO &&
        ZOHO.CREATOR &&
        ZOHO.CREATOR.UTIL &&
        ZOHO.CREATOR.UTIL.setImageData)
    ) {
      var l = document.createElement("img");
      ((l.hidden = !0),
        document.body.appendChild(l),
        ZOHO.CREATOR.UTIL.setImageData(l, e, function () {
          (c(l.src), l.remove());
        }));
    } else c(e);
  }

  function hr() {
    (w("docsDriverName", s.name || "—"), w("docsDriverId", s.id || "—"));
    var e = document.getElementById("docsLookupNote"),
      t = document.getElementById("docsLookupNoteText");
    (s.loaded
      ? e && (e.hidden = !0)
      : (t &&
          (t.textContent =
            "Couldn't identify your driver record yet — documents will appear once it loads."),
        e && (e.hidden = !1)),
      fr(
        s.medicalCertificatePath,
        "docCardMedical",
        "docStatusMedical",
        "docLinkMedical",
      ),
      fr(
        s.licenceDocumentPath,
        "docCardLicence",
        "docStatusLicence",
        "docLinkLicence",
      ),
      fr(s.rightToWorkDocumentPath, "docCardRtw", "docStatusRtw", "docLinkRtw"),
      fr(
        s.identityDocumentCopyPath,
        "docCardIdentity",
        "docStatusIdentity",
        "docLinkIdentity",
      ),
      w("driverDocsPopupName", s.name || "—"),
      w("driverDocsPopupId", s.id || "—"));
    var dp = document.getElementById("driverDocsPopupNote"),
      dpt = document.getElementById("driverDocsPopupNoteText");
    (s.loaded
      ? dp && (dp.hidden = !0)
      : (dpt &&
          (dpt.textContent =
            "Couldn't identify your driver record yet — documents will appear once it loads."),
        dp && (dp.hidden = !1)),
      fr(
        s.medicalCertificatePath,
        "docCardMedicalDP",
        "docStatusMedicalDP",
        "docLinkMedicalDP",
      ),
      fr(
        s.licenceDocumentPath,
        "docCardLicenceDP",
        "docStatusLicenceDP",
        "docLinkLicenceDP",
      ),
      fr(
        s.rightToWorkDocumentPath,
        "docCardRtwDP",
        "docStatusRtwDP",
        "docLinkRtwDP",
      ),
      fr(
        s.identityDocumentCopyPath,
        "docCardIdentityDP",
        "docStatusIdentityDP",
        "docLinkIdentityDP",
      ));
  }

  function openDriverDocsPopup() {
    (hr(),
      (u("#driverDocsPopup").hidden = !1),
      (u("#driverDocsScrim").hidden = !1),
      (document.body.style.overflow = "hidden"));
  }

  function closeDriverDocsPopup() {
    ((u("#driverDocsPopup").hidden = !0),
      (u("#driverDocsScrim").hidden = !0),
      (document.body.style.overflow = ""));
  }

  /* ---------- REPLACES vr() ----------
     The BFM_Monitoring form/report no longer exists in this Zoho
     Creator app, so this seeds the in-memory BFM counters from the
     hardcoded defaults in `a` directly, with no server lookup. */
  function vr() {
    /* BFM_Monitoring report/form no longer exists in this Zoho Creator
       app, so this simply seeds the in-memory BFM counters from the
       local defaults instead of attempting a lookup. */
    ((ACTIVE_BFM_RECORD.id = null),
      (ACTIVE_BFM_RECORD.workMins = 0),
      (ACTIVE_BFM_RECORD.maxMins = a.maxWorkPerShift),
      (a.source = "Default BFM values"));
    return Promise.resolve().then(function () {
      (P(), ir());
    });
  }

  function yr() {
    var e,
      t,
      r =
        ((e = s.name),
        (t = String(e || "")
          .trim()
          .split(/\s+/)
          .filter(Boolean)).length
          ? (t[0][0] + (t[1] ? t[1][0] : "")).toUpperCase()
          : "--");
    (w("hdrDriverId", s.id),
      w(
        "hdrDriverName",
        (function (e) {
          var t = String(e || "")
            .trim()
            .split(/\s+/)
            .filter(Boolean);
          return t.length
            ? t.length > 1
              ? t[0] + " " + t[1][0] + "."
              : t[0]
            : "—";
        })(s.name),
      ),
      w("panelDriverName", s.name),
      w("panelDriverSub", s.id + (s.department ? " · " + s.department : "")),
      w("tripDriverLabel", s.name + " (" + s.id + ")"),
      w("tripsDriverName", s.name),
      w("drvSummaryName", s.name || "—"),
      w("drvSummaryId", s.id || "—"),
      mr("hdrAvatarImg", "hdrAvatarInitials", s.photoPath, r),
      mr(
        "panelAvatarImg",
        "panelAvatarInitials",
        s.photoPath,
        r,
      ) /* hr() intentionally NOT called here — it eagerly
        downloads all 4 document files (licence, medical, RTW, ID) twice each just to show an "On
        file" badge, which was stalling every boot behind multi-MB HEIC downloads. openDriverDocsPopup()
        already calls hr() on demand when the driver actually opens the Documents panel. */,
      w("panelEmployeeId", s.id || "—"),
      w("panelName", s.name || "—"),
      w("panelGender", s.gender || "—"),
      w("panelDob", s.dob || "—"),
      w("panelMobile", s.mobile || "—"),
      w("panelEmail", s.email || "—"),
      w("panelAddress", s.address || "—"),
      w("panelEmploymentType", s.employmentType || "—"),
      w("panelStarted", s.started || "—"),
      w("panelDepartment", s.department || "—"),
      w("panelDesignation", s.designation || "—"),
      w("panelIdentityDocType", s.identityDocType || "—"),
      w("panelIdentityDocNumber", s.identityDocNumber || "—"),
      w("panelVisaExpiry", s.visaExpiryDate || "—"),
      w("panelLicenceNo", s.licenceNo || s.licenceNumber || "—"),
      w("panelLicenceType", s.licenceType || "—"),
      w("panelLicenceClass", s.licenceClass || "—"),
      w("panelLicenceIssueDate", s.licenceIssueDate || "—"),
      w("panelLicenceExpiry", s.licenceExpiry || "—"),
      w("panelLicenceStatus", s.licenceStatus || "—"),
      w("panelBfmModule", s.fatigueModule || a.module || "—"),
      w("panelHeavyVehicleExperience", s.heavyVehicleExperience || "—"),
      w("panelMedicalFitnessStatus", s.medicalFitnessStatus || "—"),
      w("panelMedicalCertExpiry", s.medicalCertExpiry || "—"));
    var n = s.experience,
      i = "" !== n && !isNaN(Number(n));
    (w("panelExperience", n ? (i ? n + " years" : String(n)) : "—"),
      w("panelLastCheckup", s.lastCheckupDate || "—"));
    var a2 = document.getElementById("panelDocWarn"),
      o = document.getElementById("panelDocWarnText"),
      c = ur(s.licenceExpiry);
    a2 &&
      o &&
      (null !== c && c <= 30
        ? ((o.textContent =
            c < 0
              ? "Licence expired " + Math.abs(c) + " days ago"
              : "Licence expires in " + c + " days"),
          (a2.hidden = !1))
        : (a2.hidden = !0));
  }
  var gr = "[Driver Dashboard]";

  function br(e) {
    return String(e || "")
      .trim()
      .toLowerCase();
  }

  function _r(e) {
    if (!e) return "Unknown error.";
    if ("string" == typeof e) return e;
    if (e.message) return e.message;
    if (e.data && e.data.message) return e.data.message;
    if (Array.isArray(e.data) && e.data[0] && e.data[0].message)
      return e.data[0].message;
    try {
      var t = JSON.stringify(e);
      return t && "{}" !== t ? t : "Unknown error.";
    } catch (t) {
      return String(e);
    }
  }
  async function kr(e) {
    return (
      console.log("Get records Params:", e),
      ZOHO.CREATOR.DATA.getRecords(e).catch(function (e) {
        if (
          (function (e) {
            var t = "";
            try {
              t = JSON.stringify(e);
            } catch (r) {
              t = String(e);
            }
            return /9280/.test(t) || /no records found/i.test(t);
          })(e)
        )
          return {
            data: [],
          };
        throw e;
      })
    );
  }

  function wr(t) {
    var n = br(t),
      a = [e.employees]
        .concat(e.employeesFallbacks || [])
        .filter(function (e, t, r) {
          return e && r.indexOf(e) === t;
        }),
      o = [],
      s = null;
    return (function c(l) {
      if (l >= a.length) {
        if (
          s &&
          (function (e) {
            var t = "";
            try {
              t = JSON.stringify(e);
            } catch (r) {
              t = String(e);
            }
            return (
              /"?status"?\s*[:=]\s*403/.test(t) ||
              /2898/.test(t) ||
              /permission denied/i.test(t)
            );
          })(s)
        )
          throw new Error(
            'Zoho denied access to the Driver report (HTTP 403 / code 2898 — "Permission denied to view record(s)"). This is a Zoho Creator sharing setting, not something this dashboard\'s code can fix on its own. To resolve it: 1) In Zoho Creator, open this app → Settings → Portal (or Users, depending on your plan). 2) Find the report named ' +
              (o.length
                ? '"' + o.join('", "') + '"'
                : '"' + e.employees + '"') +
              " (whichever your Driver Form report is called) and confirm it is explicitly shared with the Client Portal role/profile this driver logs in as, with at least View permission. 3) Also confirm the underlying Driver Form itself is shared with that same portal role — a shared report on an unshared form still returns this error. This same query already works for admin users, which is expected: portal users are permission-scoped separately.",
          );
        throw new Error(
          "Could not read " +
            (o.length
              ? 'the report(s) "' + o.join('", "') + '"'
              : "the Driver report") +
            " (" +
            (s && s.message ? s.message : JSON.stringify(s)) +
            ").",
        );
      }
      var d = a[l];
      return (
        o.push(d),
        (function (e, t, n) {
          var a = "(" + r + ' == "' + t.trim() + '")';
          return (
            console.log("exactCriteria:", a),
            console.log(gr, "Trying report:", e, "| criteria:", a),
            kr({
              report_name: e,
              criteria: `(${r} == "${t.trim()}")`,
              field_config: "all",
              max_records: 200,
            }).then(function (t) {
              var r = (t && t.data) || [];
              return (
                console.log(gr, e, "exact-match rows:", r.length),
                r.length
                  ? r[0]
                  : (console.warn(
                      gr,
                      e,
                      "— no exact match, retrying with a case/whitespace-insensitive scan.",
                    ),
                    kr({
                      report_name: e,
                      field_config: "all",
                      max_records: 200,
                    }).then(function (t) {
                      var r = (t && t.data) || [],
                        a = r.filter(function (e) {
                          return br(sr(e, i.email)) === n;
                        });
                      return (
                        console.log(
                          gr,
                          e,
                          "fallback scan matched",
                          a.length,
                          "of",
                          r.length,
                          "records",
                        ),
                        a.length > 1 &&
                          console.warn(
                            gr,
                            "Multiple records in",
                            e,
                            "share this email — using the first:",
                            a,
                          ),
                        !a.length &&
                          r.length &&
                          console.log(
                            gr,
                            "Emails seen in",
                            e,
                            "for comparison:",
                            r.map(function (e) {
                              return sr(e, i.email);
                            }),
                          ),
                        a[0] || null
                      );
                    }))
              );
            })
          );
        })(d, t, n).catch(function (e) {
          return (
            console.error(gr, "getRecords on", d, "failed:", e),
            (s = e),
            c(l + 1)
          );
        })
      );
    })(0);
  }

  /* ==========================================================================
     HUB / BOOKING / POD RESOLUTION  — CORRECTED

     Verified against the Zoho Creator app export (Skyway Logistics .ds):

       Trip_Dispatch.Booking_ID   picklist -> Booking_Shipments.ID,
                                  displayformat = [Booking_ID]   ("BK-010")
       Booking_Shipments.Booking_ID          text                ("BK-010")
       Booking_Shipments.Shipment_Items      grid  -> Shipment_Items.ID,
                                             bidirectional = Booking_Shipments
       Shipment_Items.Item                   text
       Shipment_Items.Quantity               decimal
       Shipment_Items.Hub_Name    picklist -> Locations.ID,
                                  displayformat = [Hub_Name]
       Shipment_Items.Booking_Shipments
                                  picklist -> Booking_Shipments.ID,
                                  displayformat = [ID]
       Locations.Hub_Name / Hub_ID / Latitude / Longitude / Hub_Location

     Report (not form) names, which is what the Data API needs:
       Booking_Shipments  ->  report "Shipment_Booking"
       Shipment_Items     ->  report "All_Shipment_Items"
       Locations          ->  report "Locations2"
       Trip_Dispatch      ->  report "Trip_Dispatch1"

     WHY THE HUB DROPDOWN SAID "No hubs found for this Trip/Booking"
     ---------------------------------------------------------------
     1. WRONG REPORT NAMES. The old candidate lists led with
        "Booking_Shipments" and "Shipment_Items1" — those are FORM names.
        The reports are "Shipment_Booking" and "All_Shipment_Items", so
        every early getRecords threw before anything usable came back.
     2. THE SUBFORM CANNOT BE USED. On the Shipment_Booking report the
        Shipment_Items column is defined as a concatenated formula
        (Item + " " + Quantity + " " + Package_Type). The Data API returns
        that as a display string, not as row objects — and it does not
        even contain Hub_Name. Reading hubs off the parent booking record
        was therefore never going to work. The Shipment_Items report is
        now the primary source; the subform is only a bonus if a future
        report exposes it as real rows.
     3. IDs ONLY. Hub values were collected with rawLookupId() alone, so a
        Hub_Name that came back as a display label was discarded and the
        hub set ended up empty. IDs *and* names are now both collected and
        either can match a Locations row.
     4. EMPTY RESULT WAS CACHED FOREVER. TRIP_HUB_ID_CACHE stored [], so
        one early miss (before the trip finished loading) poisoned every
        later call. Empty results are no longer cached, and the cache is
        cleared whenever a new trip is set.
     5. COUNT vs POD DISAGREED. updateHubItemCount() used the subform-only
        path while the POD page used another. Both now share one pipeline.

     DIAGNOSTICS: run  skywayHubDebug()  in the browser console.
     ========================================================================== */

  var HUB_NAME_TO_ID = {};
  var CURRENT_POD_ITEMS = [];
  var CURRENT_POD_LOADING = false;

  /* Live Zoho responses confirm "Shipment_Booking", "All_Shipment_Booking",
     "Bookings" and "All_Bookings" don't exist in this app at all ("No
     report named X found", code 2894) — trimmed out, they could only ever
     waste a request. "Booking_Shipments1" is the report that actually
     returns data. "Booking_Shipments" DOES exist (code 2898 "Permission
     denied", not 2894) but this portal role can't read it — kept as a
     fallback since a sharing-settings change (not a code change) could fix
     that. Whichever name wins a lookup is promoted to the front so the
     other three call sites below stop re-discovering it from scratch. */
  var BOOKING_REPORT_CANDIDATES = ["Booking_Shipments1", "Booking_Shipments"];
  /* Moves a candidate that just proved itself to index 0 so every other
     BOOKING_REPORT_CANDIDATES lookup in this session goes straight to it
     instead of re-trying the known-dead names first. */
  function promoteBookingReportCandidate(index) {
    if (index > 0 && index < BOOKING_REPORT_CANDIDATES.length) {
      var winner = BOOKING_REPORT_CANDIDATES.splice(index, 1)[0];
      BOOKING_REPORT_CANDIDATES.unshift(winner);
    }
  }
  var BOOKING_FIELD_CANDIDATES = {
    bookingId: [
      "Booking_ID",
      "Booking",
      "Booking_Id",
      "BookingID",
      "Booking_No",
      "Booking_Number",
    ],
    /* Booking_Shipments.Assigned_Hub is a single lookup to Locations — it
       is only the booking's PRIMARY hub, so it is used solely as a
       last-resort fallback when no item row carries a hub. */
    assignedHub: ["Assigned_Hub"],
    pickupLocation: ["Pickup_Location"],
    deliveryLocation: ["Delivery_Location"],
    route: ["Route"],
    customer: [
      "Customer",
      "Customer_Company_Name",
      "Customer_Name",
      "Company_Name",
    ],
    weight: ["Weight", "Total_Weight", "Total_loaded_Weight"],
    shipmentItems: [
      "Shipment_Items",
      "Shipment_Items1",
      "Shipment_Item",
      "Items",
    ],
  };
  var SHIPMENT_ITEM_FIELD_CANDIDATES = {
    /* "Item" is the real field (displayname " Item"); the rest are
       fallbacks. Item_Name is listed first only so a renamed field still
       wins over the generic "Name". */
    name: [
      "Item_Name",
      "Item",
      "Product_Name",
      "Item_Description",
      "Product",
      "Name",
      "Description",
    ],
    /* "Total_Qty" added per the reference screenshot supplied — some
       reports use this exact field name instead of "Quantity". */
    qty: [
      "Quantity",
      "Qty",
      "Total_Qty",
      "Item_Quantity",
      "Units",
      "No_of_Units",
      "Total_Quantity",
    ],
    /* Optional unit price — only used when a Shipment_Items row actually
       carries one; never guessed. Feeds ORDER_DETAILS.Price. */
    price: ["Price", "Unit_Price", "Price_AUD", "Item_Price"],
    /* Shipment_Items.Booking_Shipments — the other end of the
       bidirectional link. Its displayformat is [ID], so its display value
       IS the booking's record ID. */
    bookingLink: [
      "Booking_Shipments",
      "Booking_ID",
      "Booking",
      "Shipment_Booking",
      "Booking_Shipment",
    ],
  };
  var SHIPMENT_ITEM_REPORT_CANDIDATES = [
    "All_Shipment_Items",
    "Shipment_Items1",
    "Shipment_Items",
    "Shipment_Items_Report",
  ];
  /* Shipment_Items.Hub_Name is the real hub field. Anything else is still
     picked up by the /hub/i key scan in hubRefsFromRow(). */
  var SHIPMENT_ITEM_HUB_FIELD = [
    "Hub_Name",
    "Delivery_Hub",
    "Hub",
    "Assigned_Hub",
    "Destination_Hub",
    "Drop_Hub",
  ];

  /* Issue #3 fix: on this app, the Trip_Dispatch1 record itself carries an
     "Assigned Bookings" related list (see the screenshot supplied) with
     Trip ID / Booking / Pickup Location / Delivery Location / Weight /
     Expected Delivery / Amount columns for every Booking on that trip —
     it's a subform field living directly on the Trip record, not a
     separate report. Reading it straight off K.record (already fetched
     with field_config: "all") is both correct AND avoids an extra round
     trip to Booking_Shipments; the code below tries this route FIRST and
     only falls back to the older Booking_Shipments report lookup if the
     Trip record doesn't expose it (e.g. because it was renamed). */
  var TRIP_ASSIGNED_BOOKINGS_SUBFORM_CANDIDATES = [
    "Assigned_Bookings",
    "Assigned_Booking_Details",
    "Booking_Details",
    "Trip_Bookings",
    "Bookings",
    "Booking_Items",
  ];

  function assignedBookingsFromTripRecord() {
    var rec = K.record;
    if (!rec) return null;
    for (var i = 0; i < TRIP_ASSIGNED_BOOKINGS_SUBFORM_CANDIDATES.length; i++) {
      var raw = rec[TRIP_ASSIGNED_BOOKINGS_SUBFORM_CANDIDATES[i]];
      if (Array.isArray(raw) && raw.length) return raw;
      if (raw && Array.isArray(raw.data) && raw.data.length) return raw.data;
    }
    return null;
  }

  /* ---------- lookup-value helpers ---------- */

  function rawLookupId(v) {
    if (null == v) return "";
    if (Array.isArray(v)) v = v[0];
    return null == v
      ? ""
      : "string" == typeof v || "number" == typeof v
        ? String(v).trim()
        : String(v.ID || v.zc_id || v.id || "").trim();
  }

  function lookupLabel(v) {
    if (Array.isArray(v)) return v.map(lookupLabel).filter(Boolean).join(", ");
    return cr(v);
  }

  function normKey(v) {
    return String(null == v ? "" : v)
      .trim()
      .toLowerCase();
  }

  /* Splits any lookup value (string, number, {ID,display_value}, or an
     array of those) into the record IDs and the display labels it
     carries. Either side can be empty — the case the old ID-only code
     mishandled. */
  function refListFromValue(v) {
    var ids = [],
      names = [],
      arr = Array.isArray(v) ? v : null == v ? [] : [v];
    arr.forEach(function (x) {
      if (null == x || "" === x) return;
      if ("string" == typeof x || "number" == typeof x) {
        var sVal = String(x).trim();
        if (!sVal) return;
        /* Creator record IDs are long numeric strings; everything else is
           treated as a display label. */
        if (/^\d{8,}$/.test(sVal)) {
          -1 === ids.indexOf(sVal) && ids.push(sVal);
        } else -1 === names.indexOf(sVal) && names.push(sVal);
        return;
      }
      if ("object" == typeof x) {
        var id = String(x.ID || x.zc_id || x.id || "").trim();
        id && -1 === ids.indexOf(id) && ids.push(id);
        var lb = String(
          x.display_value || x.zc_display_value || x.Name || "",
        ).trim();
        lb && -1 === names.indexOf(lb) && names.push(lb);
      }
    });
    return {
      ids: ids,
      names: names,
    };
  }

  /* Every hub reference carried by one Shipment_Items row. */
  function hubRefsFromRow(row) {
    if (!row)
      return {
        ids: [],
        names: [],
      };
    var key = or(row, SHIPMENT_ITEM_HUB_FIELD),
      out = key
        ? refListFromValue(row[key])
        : {
            ids: [],
            names: [],
          };
    if (!out.ids.length && !out.names.length)
      Object.keys(row).forEach(function (k) {
        if (!/hub/i.test(k)) return;
        var extra = refListFromValue(row[k]);
        extra.ids.forEach(function (id) {
          -1 === out.ids.indexOf(id) && out.ids.push(id);
        });
        extra.names.forEach(function (nm) {
          -1 === out.names.indexOf(nm) && out.names.push(nm);
        });
      });
    return out;
  }

  function idListOf(raw) {
    if (null == raw) return [];
    var arr = Array.isArray(raw) ? raw : [raw];
    return arr
      .map(function (v) {
        return null == v
          ? ""
          : "string" == typeof v || "number" == typeof v
            ? String(v).trim()
            : String(v.ID || v.zc_id || v.id || "").trim();
      })
      .filter(Boolean);
  }

  function escapeCriteria(v) {
    return String(v == null ? "" : v).replace(/"/g, '\\"');
  }

  /* ---------- Trip -> Booking ---------- */

  /* Every key that could identify this trip's booking: the lookup's
     record ID and its visible Booking ID label ("BK-010"), because Zoho
     returns one, the other, or both depending on the report. */
  function getTripBookingIds() {
    var tripRec = K.record,
      refs = refListFromValue(
        tripRec ? sr(tripRec, ce.assignedBookings) : null,
      ),
      keys = [];
    refs.ids.concat(refs.names).forEach(function (key) {
      key = String(key || "").trim();
      key && -1 === keys.indexOf(key) && keys.push(key);
    });
    /* Last resort: scan the trip record for any booking-ish field. */
    if (!keys.length && tripRec)
      Object.keys(tripRec).forEach(function (k) {
        if (!/booking/i.test(k) || /date/i.test(k)) return;
        var extra = refListFromValue(tripRec[k]);
        extra.ids.concat(extra.names).forEach(function (key) {
          key = String(key || "").trim();
          key && -1 === keys.indexOf(key) && keys.push(key);
        });
      });
    return keys;
  }

  var BOOKING_CACHE = {
    key: null,
    rows: null,
  };

  /* Resolves the Booking_Shipments record(s) linked to the active trip.
     Tries a server-side criteria match on Booking_ID first (cheap), then
     falls back to a full scan matched on record ID or Booking ID label. */
  function fetchActiveTripShipmentBookings() {
    /* Preferred path: read the "Assigned Bookings" subform directly off
       the already-loaded Trip_Dispatch1 record — see
       assignedBookingsFromTripRecord() above for why. */
    var subformRows = assignedBookingsFromTripRecord();
    if (subformRows && subformRows.length)
      return (
        console.log(
          gr,
          "[hub-debug] using Assigned Bookings subform straight off the Trip_Dispatch1 record:",
          subformRows,
        ),
        Promise.resolve(subformRows)
      );
    var bookingIds = getTripBookingIds();
    console.log(gr, "[hub-debug] getTripBookingIds() ->", bookingIds);
    if (!bookingIds.length)
      return (
        console.warn(
          gr,
          "[hub-debug] no Booking ID resolved off the Trip_Dispatch record — check ce.assignedBookings",
        ),
        Promise.resolve([])
      );
    var cacheKey = bookingIds.join("|");
    if (
      BOOKING_CACHE.key === cacheKey &&
      BOOKING_CACHE.rows &&
      BOOKING_CACHE.rows.length
    )
      return Promise.resolve(BOOKING_CACHE.rows);
    var wanted = bookingIds.map(normKey),
      /* Only the non-numeric keys are usable as a Booking_ID criteria
         value — the numeric one is the record ID. */
      labels = bookingIds.filter(function (v) {
        return !/^\d{8,}$/.test(String(v));
      });

    function remember(rows, index) {
      return (
        rows &&
          rows.length &&
          ((BOOKING_CACHE.key = cacheKey),
          (BOOKING_CACHE.rows = rows),
          promoteBookingReportCandidate(index)),
        rows
      );
    }

    return (function tryReport(index) {
      if (index >= BOOKING_REPORT_CANDIDATES.length)
        return (
          console.warn(
            gr,
            "[hub-debug] no booking report matched",
            bookingIds,
            "- tried:",
            BOOKING_REPORT_CANDIDATES,
          ),
          Promise.resolve([])
        );
      var reportName = BOOKING_REPORT_CANDIDATES[index],
        params = {
          report_name: reportName,
          field_config: "all",
          max_records: 200,
        };
      if (labels.length)
        params.criteria =
          "(" +
          labels
            .map(function (v) {
              return 'Booking_ID == "' + escapeCriteria(v) + '"';
            })
            .join(" || ") +
          ")";
      return kr(params)
        .then(function (res) {
          var rows = (res && res.data) || [];
          if (rows.length)
            return (
              console.log(
                gr,
                "[hub-debug] booking report",
                reportName,
                "criteria match ->",
                rows.length,
                "row(s)",
              ),
              remember(rows, index)
            );
          /* Criteria found nothing (or wasn't usable) — scan the report. */
          return kr({
            report_name: reportName,
            field_config: "all",
            max_records: 200,
          }).then(function (res2) {
            var allRows = (res2 && res2.data) || [];
            console.log(
              gr,
              "[hub-debug] booking report",
              reportName,
              "scan returned",
              allRows.length,
              "row(s)",
            );
            var matches = allRows.filter(function (record) {
              var refs = refListFromValue(
                  sr(record, BOOKING_FIELD_CANDIDATES.bookingId),
                ),
                candidates = [String(record.ID || record.id || "")]
                  .concat(refs.ids)
                  .concat(refs.names)
                  .map(normKey);
              return wanted.some(function (k) {
                return -1 !== candidates.indexOf(k);
              });
            });
            if (!matches.length && allRows.length)
              console.log(
                gr,
                "[hub-debug] no match in",
                reportName,
                "— Booking IDs seen:",
                allRows.slice(0, 20).map(function (rec) {
                  return (
                    lookupLabel(sr(rec, BOOKING_FIELD_CANDIDATES.bookingId)) ||
                    rec.ID
                  );
                }),
              );
            return matches.length
              ? remember(matches, index)
              : tryReport(index + 1);
          });
        })
        .catch(function (err) {
          return (
            console.warn(
              gr,
              "[hub-debug] getRecords on booking report",
              reportName,
              "threw (likely not a report name in this app):",
              err,
            ),
            tryReport(index + 1)
          );
        });
    })(0);
  }

  /* ---------- Booking -> Shipment Items ---------- */

  /* The Shipment_Items grid on the Shipment_Booking report is a
     concatenated formula string, so this normally yields nothing. It is
     kept for apps whose report exposes the grid as real rows. */
  function subformRowsFromBooking(booking) {
    if (!booking) return [];
    var key = or(booking, BOOKING_FIELD_CANDIDATES.shipmentItems),
      raw = key ? booking[key] : null,
      rows = Array.isArray(raw)
        ? raw
        : raw && "object" == typeof raw
          ? [raw]
          : [];
    if (
      rows.length &&
      "object" == typeof rows[0] &&
      (or(rows[0], SHIPMENT_ITEM_FIELD_CANDIDATES.name) ||
        or(rows[0], SHIPMENT_ITEM_FIELD_CANDIDATES.qty))
    )
      return rows;
    var found = [];
    Object.keys(booking).forEach(function (k) {
      var v = booking[k];
      if (!Array.isArray(v) || !v.length || "object" != typeof v[0]) return;
      if (
        or(v[0], SHIPMENT_ITEM_FIELD_CANDIDATES.name) ||
        or(v[0], SHIPMENT_ITEM_FIELD_CANDIDATES.qty)
      ) {
        console.log(
          gr,
          "[hub-debug] auto-detected a Shipment_Items grid under field",
          k,
        );
        found = found.concat(v);
      }
    });
    return found;
  }

  function shipmentItemsFromBookings(bookings) {
    return (bookings || []).reduce(function (items, booking) {
      return items.concat(subformRowsFromBooking(booking));
    }, []);
  }

  /* True when this Shipment_Items row belongs to one of these bookings —
     matched on the back-link's record ID or its label. */
  function rowLinksToBooking(row, bookingKeys) {
    var key = or(row, SHIPMENT_ITEM_FIELD_CANDIDATES.bookingLink),
      values = key ? [row[key]] : [];
    if (!values.length)
      Object.keys(row).forEach(function (k) {
        /booking/i.test(k) && !/date/i.test(k) && values.push(row[k]);
      });
    var candidates = [];
    values.forEach(function (v) {
      var refs = refListFromValue(v);
      refs.ids.concat(refs.names).forEach(function (x) {
        candidates.push(normKey(x));
      });
    });
    return bookingKeys.some(function (k) {
      return -1 !== candidates.indexOf(k);
    });
  }

  var ITEM_CACHE = {
    key: null,
    rows: null,
  };

  /* Primary source for hubs AND for POD items. Queries the Shipment_Items
     report and keeps the rows linked to this trip's booking(s); falls
     back to the booking's own grid if a report ever exposes real rows. */
  function fetchShipmentItemsForBookings(bookings) {
    bookings = bookings || [];
    if (!bookings.length) return Promise.resolve([]);
    var bookingRecordIds = bookings
        .map(function (b) {
          return String(b.ID || b.id || "").trim();
        })
        .filter(Boolean),
      bookingKeys = [];
    bookingRecordIds.forEach(function (id) {
      bookingKeys.push(normKey(id));
    });
    bookings.forEach(function (b) {
      var refs = refListFromValue(sr(b, BOOKING_FIELD_CANDIDATES.bookingId));
      refs.ids.concat(refs.names).forEach(function (x) {
        x && bookingKeys.push(normKey(x));
      });
    });
    var cacheKey = bookingKeys.join("|");
    if (
      ITEM_CACHE.key === cacheKey &&
      ITEM_CACHE.rows &&
      ITEM_CACHE.rows.length
    )
      return Promise.resolve(ITEM_CACHE.rows);

    function remember(rows) {
      return (
        rows &&
          rows.length &&
          ((ITEM_CACHE.key = cacheKey), (ITEM_CACHE.rows = rows)),
        rows
      );
    }

    function tryReport(index) {
      if (index >= SHIPMENT_ITEM_REPORT_CANDIDATES.length) {
        /* Nothing from any report — last chance is the parent grid. */
        var embedded = shipmentItemsFromBookings(bookings);
        return (
          console.warn(
            gr,
            "[hub-debug] no Shipment_Items report returned matching rows — tried:",
            SHIPMENT_ITEM_REPORT_CANDIDATES,
            "| grid fallback gave",
            embedded.length,
            "row(s)",
          ),
          Promise.resolve(remember(embedded))
        );
      }
      var reportName = SHIPMENT_ITEM_REPORT_CANDIDATES[index],
        params = {
          report_name: reportName,
          field_config: "all",
          max_records: 500,
        };
      /* Shipment_Items.Booking_Shipments is a lookup, so it is queried by
         the parent record ID. */
      if (bookingRecordIds.length)
        params.criteria =
          "(" +
          bookingRecordIds
            .map(function (id) {
              return "Booking_Shipments == " + id;
            })
            .join(" || ") +
          ")";
      return kr(params)
        .then(function (res) {
          var rows = (res && res.data) || [];
          if (rows.length)
            return (
              console.log(
                gr,
                "[hub-debug] item report",
                reportName,
                "criteria match ->",
                rows.length,
                "row(s)",
              ),
              remember(rows)
            );
          return kr({
            report_name: reportName,
            field_config: "all",
            max_records: 500,
          }).then(function (res2) {
            var allRows = (res2 && res2.data) || [];
            console.log(
              gr,
              "[hub-debug] item report",
              reportName,
              "scan returned",
              allRows.length,
              "row(s)",
            );
            var matches = allRows.filter(function (item) {
              return rowLinksToBooking(item, bookingKeys);
            });
            console.log(
              gr,
              "[hub-debug] item report",
              reportName,
              "matched",
              matches.length,
              "row(s) for booking keys",
              bookingKeys,
            );
            return matches.length ? remember(matches) : tryReport(index + 1);
          });
        })
        .catch(function (err) {
          return (
            console.warn(
              gr,
              "[hub-debug] getRecords on item report",
              reportName,
              "threw (likely not a report name in this app):",
              err,
            ),
            tryReport(index + 1)
          );
        });
    }
    return tryReport(0);
  }

  /* ---------- hub matching + item mapping ---------- */

  function shipmentItemMatchesHub(item, hubName) {
    var refs = hubRefsFromRow(item),
      selectedHubId = HUB_NAME_TO_ID[hubName] || "";
    /* Primary: match on the Locations record ID — immune to label drift
       (whitespace, casing, or a disambiguation suffix). */
    if (
      selectedHubId &&
      -1 !== refs.ids.map(String).indexOf(String(selectedHubId))
    )
      return !0;
    /* Fallback: normalized label match, for rows that carry only the
       hub's display value or before HUB_NAME_TO_ID is populated. */
    var wanted = normKey(hubName);
    if (!wanted) return !1;
    return refs.names.some(function (nm) {
      return normKey(nm) === wanted;
    });
  }

  /* ------------------------------------------------------------
     Item Name resolution fix.
     Shipment_Items.Item is a lookup to the Items module, but the Items
     module's own "display value" is configured to be the record ID, so
     the API hands back the raw numeric ID (e.g. "37288000000095013")
     instead of the item's name — that's what was showing on the POD
     pages. ITEM_ID_TO_NAME resolves that ID to the real name by reading
     it straight from the Items report, the same pattern already used
     for HUB_NAME_TO_ID above. Additive only: if the lookup can't be
     resolved for any reason, the original ID is shown exactly as
     before, so nothing regresses.
     ------------------------------------------------------------ */
  var ITEM_ID_TO_NAME = {};
  var ITEM_NAMES_LOAD_PROMISE = null;
  var ITEM_REPORT_CANDIDATES = [
    "Items",
    "All_Items",
    "Item",
    "All_Item",
    "Products",
    "All_Products",
    "Item_Master",
    "All_Item_Master",
  ];
  var ITEM_NAME_FIELD_CANDIDATES = [
    "Item_Name",
    "Name",
    "Product_Name",
    "Title",
    "Item_Description",
    "Description",
  ];

  function looksLikeRawRecordId(v) {
    return /^\d{6,}$/.test(String(null == v ? "" : v).trim());
  }

  function ensureItemNamesLoaded() {
    if (ITEM_NAMES_LOAD_PROMISE) return ITEM_NAMES_LOAD_PROMISE;
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA)
      return (ITEM_NAMES_LOAD_PROMISE = Promise.resolve());
    return (ITEM_NAMES_LOAD_PROMISE = (function tryReport(n) {
      if (n >= ITEM_REPORT_CANDIDATES.length) return Promise.resolve();
      return kr({
        report_name: ITEM_REPORT_CANDIDATES[n],
        field_config: "all",
        max_records: 1000,
      })
        .then(function (res) {
          var rows = (res && res.data) || [];
          if (!rows.length) return tryReport(n + 1);
          (rows.forEach(function (rec) {
            var id = rec.ID || rec.id;
            if (!id) return;
            var nm = cr(sr(rec, ITEM_NAME_FIELD_CANDIDATES));
            nm && !looksLikeRawRecordId(nm) && (ITEM_ID_TO_NAME[id] = nm);
          }),
            console.log(
              gr,
              "Item names resolved via",
              ITEM_REPORT_CANDIDATES[n],
              "-",
              Object.keys(ITEM_ID_TO_NAME).length,
              "item(s)",
            ));
        })
        .catch(function (err) {
          return (
            console.warn(
              gr,
              "[item-name] getRecords on item report",
              ITEM_REPORT_CANDIDATES[n],
              "threw (likely not a report name in this app):",
              err,
            ),
            tryReport(n + 1)
          );
        });
    })(0));
  }

  function resolveItemName(raw) {
    var val = cr(raw) || "Item";
    return looksLikeRawRecordId(val) && ITEM_ID_TO_NAME[val]
      ? ITEM_ID_TO_NAME[val]
      : val;
  }

  function mapOneShipmentItem(item, index) {
    var qty = Number(sr(item, SHIPMENT_ITEM_FIELD_CANDIDATES.qty)) || 0,
      priceRaw = cr(sr(item, SHIPMENT_ITEM_FIELD_CANDIDATES.price)),
      priceNum =
        "" === priceRaw
          ? NaN
          : parseFloat(String(priceRaw).replace(/[^0-9.\-]/g, ""));
    return {
      id: item.ID || item.id || "shipment-item-" + index,
      price: isNaN(priceNum) ? null : priceNum,
      /* Item: Shipment_Items.Item, resolved to its real name where
         possible (see resolveItemName / ITEM_ID_TO_NAME above). */
      name: resolveItemName(sr(item, SHIPMENT_ITEM_FIELD_CANDIDATES.name)),
      /* Quantity: Shipment_Items.Quantity, exactly as booked. */
      qty: qty,
      /* Received quantity defaults to the full Quantity; the driver can
         edit it down on the POD page for a partial delivery. */
      receivedQty: qty,
      /* Pending = Quantity − Received, kept in sync as the driver edits
         (see renderPodItemsUI / recalcPodItemPending). */
      pendingQty: 0,
    };
  }

  function mapShipmentSubformItems(rows, hubName) {
    var seen = {};
    return (rows || []).reduce(function (items, item, index) {
      if (!shipmentItemMatchesHub(item, hubName)) return items;
      var mapped = mapOneShipmentItem(item, index),
        key = mapped.id || mapped.name + "|" + mapped.qty;
      return seen[key] ? items : ((seen[key] = !0), items.push(mapped), items);
    }, []);
  }

  /* True when NO row carries any hub reference. Hub filtering is then
     impossible, and every item of the booking belongs to the hub the
     driver picked. */
  function rowsHaveNoHubInfo(rows) {
    return !(rows || []).some(function (r) {
      var refs = hubRefsFromRow(r);
      return refs.ids.length || refs.names.length;
    });
  }

  /* ---------- signature pad (unchanged) ---------- */

  var sigPad = {
    canvas: null,
    ctx: null,
    drawing: false,
    hasInk: false,
    lastX: 0,
    lastY: 0,
  };

  function sigPadResize() {
    var c = sigPad.canvas;
    if (!c) return;
    var wrap = c.parentElement,
      w = wrap ? wrap.clientWidth : c.width,
      ratio = window.devicePixelRatio || 1;
    if (!w) return;
    var savedData = sigPad.hasInk ? c.toDataURL() : null;
    ((c.width = Math.max(1, Math.round(w * ratio))),
      (c.height = Math.max(1, Math.round(180 * ratio))),
      (c.style.width = w + "px"),
      (c.style.height = "180px"));
    var ctx = c.getContext("2d");
    (ctx.scale(ratio, ratio),
      (ctx.lineWidth = 2.2),
      (ctx.lineCap = "round"),
      (ctx.lineJoin = "round"),
      (ctx.strokeStyle = "#0F2748"),
      (sigPad.ctx = ctx));
    if (savedData) {
      var img = new Image();
      ((img.onload = function () {
        ctx.drawImage(img, 0, 0, w, 180);
      }),
        (img.src = savedData));
    }
  }

  function sigPadPointerPos(e) {
    var r = sigPad.canvas.getBoundingClientRect();
    return {
      x: e.clientX - r.left,
      y: e.clientY - r.top,
    };
  }

  function sigPadDown(e) {
    sigPad.drawing = true;
    var p = sigPadPointerPos(e);
    ((sigPad.lastX = p.x), (sigPad.lastY = p.y));
    try {
      sigPad.canvas.setPointerCapture(e.pointerId);
    } catch (err) {}
  }

  function sigPadMove(e) {
    if (!sigPad.drawing) return;
    var p = sigPadPointerPos(e),
      ctx = sigPad.ctx;
    (ctx.beginPath(),
      ctx.moveTo(sigPad.lastX, sigPad.lastY),
      ctx.lineTo(p.x, p.y),
      ctx.stroke(),
      (sigPad.lastX = p.x),
      (sigPad.lastY = p.y));
    if (!sigPad.hasInk) {
      sigPad.hasInk = true;
      var wrap = u("#sigPadWrap");
      wrap && wrap.classList.add("has-signature");
    }
  }

  function sigPadUp() {
    sigPad.drawing = false;
    var h = u("#inPodSignatureData");
    h && (h.value = sigPad.hasInk ? sigPad.canvas.toDataURL("image/png") : "");
  }

  function sigPadClear() {
    var c = sigPad.canvas;
    if (!c) return;
    var ctx = sigPad.ctx,
      ratio = window.devicePixelRatio || 1;
    (ctx.clearRect(0, 0, c.width / ratio, c.height / ratio),
      (sigPad.hasInk = false));
    var wrap = u("#sigPadWrap");
    wrap && wrap.classList.remove("has-signature");
    var h = u("#inPodSignatureData");
    h && (h.value = "");
  }

  function initPodSignaturePad() {
    var c = u("#podSignaturePad");
    if (!c) return;
    if (sigPad.canvas !== c) {
      ((sigPad.canvas = c), (sigPad.hasInk = false));
      (c.addEventListener("pointerdown", sigPadDown),
        c.addEventListener("pointermove", sigPadMove),
        window.addEventListener("pointerup", sigPadUp));
    }
    sigPadResize();
  }

  /* ---------- POD item list UI (unchanged) ---------- */

  function recalcPodItemPending(id) {
    var recvEl = document.querySelector('[data-recv="' + id + '"]'),
      pendEl = document.querySelector('[data-pending="' + id + '"]'),
      item = CURRENT_POD_ITEMS.filter(function (p) {
        return String(p.id) === String(id);
      })[0];
    if (!recvEl || !pendEl || !item) return;
    var recv = Math.max(0, Number(recvEl.value) || 0),
      pending = Math.max(0, (Number(item.qty) || 0) - recv);
    ((item.receivedQty = recv),
      (item.pendingQty = pending),
      (pendEl.textContent = String(pending)));
  }

  function renderPodItemsUI() {
    var host = u("#podItemList"),
      summaryEl = u("#podSummaryLine");
    if (host) {
      if (CURRENT_POD_LOADING)
        return (
          summaryEl && (summaryEl.hidden = !0),
          void (host.innerHTML =
            '<li class="pod-item pod-item--empty">Loading items…</li>')
        );
      if (!CURRENT_POD_ITEMS.length)
        return (
          summaryEl && (summaryEl.hidden = !0),
          void (host.innerHTML =
            '<li class="pod-item pod-item--empty">No items found for this booking/trip at this hub.</li>')
        );
      if (summaryEl) {
        var totalQty = CURRENT_POD_ITEMS.reduce(function (sum, p) {
          return sum + (Number(p.qty) || 0);
        }, 0);
        ((summaryEl.hidden = !1),
          (summaryEl.innerHTML =
            "<span>" +
            CURRENT_POD_ITEMS.length +
            " item" +
            (1 === CURRENT_POD_ITEMS.length ? "" : "s") +
            " to deliver</span><span>" +
            totalQty +
            " total quantity</span>"));
      }
      ((host.innerHTML = CURRENT_POD_ITEMS.map(function (p) {
        return (
          '<li class="pod-item"><label class="pod-item__check"><input type="checkbox" data-pid="' +
          p.id +
          '" checked><span>' +
          p.name +
          '</span></label><div class="pod-item__qty"><span>Quantity</span><span class="pod-item__qty-val">' +
          p.qty +
          '</span></div><div class="pod-item__qty"><span>Received qty</span><input type="number" min="0" max="' +
          p.qty +
          '" data-recv="' +
          p.id +
          '" value="' +
          p.receivedQty +
          '"></div><div class="pod-item__qty"><span>Pending qty</span><span class="pod-item__qty-val" data-pending="' +
          p.id +
          '">' +
          p.pendingQty +
          "</span></div></li>"
        );
      }).join("")),
        host.querySelectorAll("[data-recv]").forEach(function (el) {
          el.addEventListener("input", function () {
            recalcPodItemPending(el.getAttribute("data-recv"));
          });
        }),
        CURRENT_POD_ITEMS.forEach(function (p) {
          recalcPodItemPending(p.id);
        }));
    }
  }

  /* ---------- Locations helpers + Leaflet trip map ---------- */

  var LOC_LAT_FIELDS = ["Hub_Location.latitude", "Latitude"];
  var LOC_LNG_FIELDS = ["Hub_Location.longitude", "Longitude"];
  var LOC_ADDR_FIELDS = ["Hub_Location"];

  function locNumField(rec, candidates) {
    for (var i = 0; i < candidates.length; i++) {
      var key = candidates[i],
        v;
      if (-1 !== key.indexOf(".")) {
        var parts = key.split("."),
          base = rec[parts[0]];
        v = base && typeof base == "object" ? base[parts[1]] : void 0;
      } else v = rec[key];
      if (v !== void 0 && v !== null && "" !== v) {
        var n = Number(v);
        if (!isNaN(n) && 0 !== n) return n;
      }
    }
    return null;
  }
  var tripMapState = {
    map: null,
    markers: [],
    loadedForTrip: null,
    hubs: [],
  };

  /* ------------------------------------------------------------
     Resolves the Hubs that belong to this Trip's Booking. Each
     Shipment_Items row points at its own Hub_Name, so the unique hub set
     is aggregated across every item row of the booking —
     Booking.Assigned_Hub alone would only ever yield one hub.

     Returns {ids:[], names:[]}: BOTH are collected, because a Zoho lookup
     may arrive as a record ID, as a display label, or as both. Resolves
     to null when there is no trip/booking context yet, so callers can
     tell "not loaded" from "no hubs".
     ------------------------------------------------------------ */
  var TRIP_HUB_ID_CACHE = {
    tripRecordId: null,
    refs: null,
  };

  function resetTripHubCache() {
    ((TRIP_HUB_ID_CACHE.tripRecordId = null),
      (TRIP_HUB_ID_CACHE.refs = null),
      (BOOKING_CACHE.key = null),
      (BOOKING_CACHE.rows = null),
      (ITEM_CACHE.key = null),
      (ITEM_CACHE.rows = null),
      (HUB_PIPELINE_LOADED_FOR = null));
  }

  function resolveTripHubRefs(forceRefresh) {
    var bookingIds = getTripBookingIds();
    if (!bookingIds.length) return Promise.resolve(null);
    var currentTripKey = K.tripRecordId || K.tripId || "";
    if (
      !forceRefresh &&
      TRIP_HUB_ID_CACHE.tripRecordId === currentTripKey &&
      TRIP_HUB_ID_CACHE.refs &&
      (TRIP_HUB_ID_CACHE.refs.ids.length || TRIP_HUB_ID_CACHE.refs.names.length)
    )
      return Promise.resolve(TRIP_HUB_ID_CACHE.refs);
    return fetchActiveTripShipmentBookings().then(function (bookings) {
      return fetchShipmentItemsForBookings(bookings).then(function (items) {
        var ids = [],
          names = [];
        items.forEach(function (rec) {
          var refs = hubRefsFromRow(rec);
          refs.ids.forEach(function (id) {
            -1 === ids.indexOf(id) && ids.push(id);
          });
          refs.names.forEach(function (nm) {
            -1 === names.indexOf(nm) && names.push(nm);
          });
        });
        /* Fallback: the booking's own Assigned_Hub, for bookings whose
           items carry no hub of their own. */
        if (!ids.length && !names.length)
          bookings.forEach(function (b) {
            var refs = refListFromValue(
              sr(b, BOOKING_FIELD_CANDIDATES.assignedHub),
            );
            refs.ids.forEach(function (id) {
              -1 === ids.indexOf(id) && ids.push(id);
            });
            refs.names.forEach(function (nm) {
              -1 === names.indexOf(nm) && names.push(nm);
            });
          });
        var out = {
          ids: ids,
          names: names,
        };
        console.log(gr, "[hub-debug] resolveTripHubRefs ->", out);
        /* Never cache an empty result: a transient miss must not poison
           every later lookup for this trip. */
        if (ids.length || names.length)
          ((TRIP_HUB_ID_CACHE.tripRecordId = currentTripKey),
            (TRIP_HUB_ID_CACHE.refs = out));
        return out;
      });
    });
  }

  /* Back-compat shim for anything expecting a plain ID array. */
  function resolveTripHubIds(forceRefresh) {
    return resolveTripHubRefs(forceRefresh).then(function (refs) {
      return refs ? refs.ids : null;
    });
  }

  function locationMatchesHubRefs(rec, refs) {
    if (!refs) return !0;
    var recId = String(rec.ID || rec.id || "");
    if (recId && -1 !== refs.ids.map(String).indexOf(recId)) return !0;
    var nm = normKey(cr(sr(rec, t)));
    return (
      !!nm &&
      refs.names.some(function (x) {
        return normKey(x) === nm;
      })
    );
  }

  var HUB_PIPELINE_LOADED_FOR = null;

  /* ------------------------------------------------------------
     Replaces the "Hubs & stops" pipeline's placeholder demo stops
     with the real hub list for this Trip's Booking (the same
     Booking -> Shipment_Items -> Hub_Name resolution already used
     for the Live Trip Map filter). Distance/ETA/delivery-breakdown
     aren't available from that source, so they're left blank rather
     than inventing plausible-looking numbers.
     ------------------------------------------------------------ */
  function rebuildHubPipelineFromBooking() {
    var currentTripKey = K.tripRecordId || K.tripId || "";
    if (!currentTripKey || HUB_PIPELINE_LOADED_FOR === currentTripKey)
      return Promise.resolve();
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA)
      return Promise.resolve();
    return resolveTripHubRefs()
      .then(function (refs) {
        if (!refs || (!refs.ids.length && !refs.names.length)) return;
        var names = refs.names.length ? refs.names : refs.ids.map(String);
        ((Q = names.map(function (nm, i) {
          return {
            no: i + 1,
            name: nm,
            location: "",
            distance: "—",
            eta: "—",
            status: "upcoming",
            delivery: [],
          };
        })),
          (J = 0),
          (HUB_PIPELINE_LOADED_FOR = currentTripKey),
          ie(),
          updateStopsCompletedKpi(),
          refreshStopsCompletedFromCreator());
      })
      .catch(function (err) {
        console.warn(gr, "rebuildHubPipelineFromBooking failed:", err);
      });
  }

  /* Every hub NAME tied to this trip's booking/shipment items, regardless
     of whether a matching Locations row (and lat/lng) is ever found. The
     map-hub filter is built from this list — a hub that hasn't been
     geocoded yet should still show up as a filter option, it just won't
     get a marker. */
  function fetchTripHubLocations() {
    return resolveTripHubRefs().then(function (refs) {
      if (!refs || (!refs.ids.length && !refs.names.length)) return [];
      /* Start from the names/ids we already know belong to this trip, so
         the filter list is correct even if the Locations lookup below
         fails entirely (wrong report name, no network, etc). */
      var byKey = {},
        order = [];

      function upsert(key, patch) {
        var norm = normKey(key);
        if (!norm) return;
        if (!byKey[norm])
          ((byKey[norm] = {
            id: "",
            name: key,
            lat: null,
            lng: null,
            address: "",
            _norm: norm,
          }),
            order.push(norm));
        Object.keys(patch || {}).forEach(function (k) {
          null != patch[k] && "" !== patch[k] && (byKey[norm][k] = patch[k]);
        });
      }
      refs.names.forEach(function (nm) {
        upsert(nm, {
          name: nm,
        });
      });
      var locCandidates = [e.locations]
        .concat(e.locationsFallbacks || [])
        .filter(function (v, i, arr) {
          return v && arr.indexOf(v) === i;
        });
      return (function tryLoc(idx) {
        if (idx >= locCandidates.length)
          return Object.keys(byKey)
            .map(function (k) {
              return byKey[k];
            })
            .filter(function (h) {
              return h.name;
            });
        return kr({
          report_name: locCandidates[idx],
          field_config: "all",
          max_records: 200,
        })
          .then(function (res) {
            var rows2 = (res && res.data) || [],
              matched = rows2.filter(function (rec) {
                return locationMatchesHubRefs(rec, refs);
              });
            if (!matched.length && idx + 1 < locCandidates.length)
              return tryLoc(idx + 1);
            matched.forEach(function (rec) {
              var nm = cr(sr(rec, t)) || "Hub",
                lat = locNumField(rec, LOC_LAT_FIELDS),
                lng = locNumField(rec, LOC_LNG_FIELDS),
                addrRaw = rec.Hub_Location,
                addr =
                  addrRaw && typeof addrRaw == "object"
                    ? [
                        addrRaw.address_line_1,
                        addrRaw.address_line_2,
                        addrRaw.district_city,
                        addrRaw.state_province,
                      ]
                        .filter(Boolean)
                        .join(", ")
                    : "";
              upsert(nm, {
                id: rec.ID || rec.id || "",
                name: nm,
                lat: lat,
                lng: lng,
                address: addr,
              });
            });
            /* Keep the hub NAMES even when no Locations row matched — only
             the marker/coordinates are optional, the filter entry is not. */
            return order
              .map(function (k) {
                return byKey[k];
              })
              .filter(function (h) {
                return h.name;
              });
          })
          .catch(function (err) {
            return (
              console.warn(
                gr,
                "getRecords on",
                locCandidates[idx],
                "(Locations, trip map) failed:",
                err,
              ),
              tryLoc(idx + 1)
            );
          });
      })(0);
    });
  }

  function ensureTripMapInit() {
    if (tripMapState.map) return tripMapState.map;
    var el = u("#tripMapOSM");
    /* BUG FIX: `L` inside this file is the page-loader helper (function L()
       near the top), which shadows the Leaflet global — that is what threw
       "L.map is not a function". Leaflet must be read from window.L. */
    if (!el || !window.L || typeof window.L.map != "function") return null;
    var map = window.L.map(el, {
      scrollWheelZoom: false,
    }).setView([-25.2744, 133.7751], 4);
    /* Flat, uncluttered basemap (cream landmasses / light blue ocean, no
       roads or place labels) — matches the reference design instead of
       the busier default OSM raster style. */
    return (
      window.L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
        {
          attribution: "© OpenStreetMap contributors © CARTO",
          subdomains: "abcd",
          maxZoom: 20,
        },
      ).addTo(map),
      (tripMapState.map = map),
      map
    );
  }

  function selectMapHubOSM(name) {
    var hub = tripMapState.hubs.filter(function (h) {
        return h.name === name;
      })[0],
      panel = u("#mapHubInfo"),
      filt = u("#mapHubFilter");
    if (filt && filt.value !== (name || "")) filt.value = name || "";
    if (!hub) return void (panel && (panel.hidden = !0));
    var hasCoords = null != hub.lat && null != hub.lng;
    panel &&
      (w("mapHubInfoBadge", "Hub"),
      w("mapHubInfoName", hub.name),
      w(
        "mapHubInfoLoc",
        hub.address ||
          (hasCoords
            ? hub.lat.toFixed(5) + ", " + hub.lng.toFixed(5)
            : "Location coordinates not available"),
      ),
      (panel.hidden = !1));
    var m = tripMapState.markers.filter(function (mk) {
      return mk._hubName === name;
    })[0];
    m &&
      tripMapState.map &&
      (tripMapState.map.setView(m.getLatLng(), 13), m.openPopup());
  }

  /* Fills the "Filter by hub" dropdown and the hub-count chip from the
     Trip/Booking hub list. This runs independently of whether the Leaflet
     map itself is ready — the hub names come from Zoho data, not from the
     map library, so a slow/blocked map tile CDN must never leave the
     filter empty. */
  function renderTripMapHubList(hubs) {
    tripMapState.hubs = hubs;
    var chip = u("#mapHubCountText"),
      filt = u("#mapHubFilter"),
      mapped = hubs.filter(function (h) {
        return null != h.lat && null != h.lng;
      });
    if (!hubs.length) {
      chip && (chip.textContent = "No hubs found for this trip");
      filt && (filt.innerHTML = '<option value="">All hubs</option>');
      return;
    }
    chip &&
      (chip.textContent =
        hubs.length +
        " hub" +
        (1 === hubs.length ? "" : "s") +
        " on this trip" +
        (mapped.length < hubs.length ? " (" + mapped.length + " mapped)" : ""));
    var prevValue = filt && filt.value;
    filt &&
      ((filt.innerHTML = '<option value="">All hubs</option>'),
      hubs.forEach(function (h) {
        var opt = document.createElement("option");
        ((opt.value = h.name),
          (opt.textContent = h.name),
          filt.appendChild(opt));
      }),
      hubs.some(function (h) {
        return h.name === prevValue;
      }) && (filt.value = prevValue),
      (filt.onchange = function () {
        var v = filt.value;
        if (v) return void selectMapHubOSM(v);
        u("#mapHubInfo") && (u("#mapHubInfo").hidden = !0);
        var map = tripMapState.map,
          bounds = mapped.map(function (h) {
            return [h.lat, h.lng];
          });
        map &&
          bounds.length &&
          map.fitBounds(bounds, {
            padding: [36, 36],
            maxZoom: 13,
          });
      }));
  }

  /* Draws markers for whichever hubs currently have coordinates. Safe to
     call repeatedly (e.g. once the map library finishes loading after the
     hub list already rendered) — it just redraws the marker layer. */
  function renderTripMapMarkers() {
    var map = tripMapState.map,
      emptyEl = u("#tripMapEmpty"),
      hubs = tripMapState.hubs || [];
    if (
      (tripMapState.markers.forEach(function (m) {
        map && map.removeLayer(m);
      }),
      (tripMapState.markers = []),
      !map)
    )
      return;
    var mapped = hubs.filter(function (h) {
      return null != h.lat && null != h.lng;
    });
    if (!hubs.length) return void (emptyEl && (emptyEl.hidden = !1));
    if (!mapped.length)
      return void (
        emptyEl &&
        ((emptyEl.hidden = !1),
        (emptyEl.textContent =
          "No hub coordinates available to plot for this trip yet."))
      );
    emptyEl && (emptyEl.hidden = !0);
    var bounds = [];
    (mapped.forEach(function (h) {
      var marker = window.L.marker([h.lat, h.lng])
        .addTo(map)
        .bindPopup(
          "<b>" + h.name + "</b>" + (h.address ? "<br>" + h.address : ""),
        );
      ((marker._hubName = h.name),
        marker.on("click", function () {
          selectMapHubOSM(h.name);
        }),
        tripMapState.markers.push(marker),
        bounds.push([h.lat, h.lng]));
    }),
      bounds.length &&
        map.fitBounds(bounds, {
          padding: [36, 36],
          maxZoom: 13,
        }));
  }

  function renderTripMapHubs(hubs) {
    (renderTripMapHubList(hubs), renderTripMapMarkers());
  }

  /* Bounded retry for the Leaflet library/tiles — a blocked or slow CDN
     must not spin forever with the map area silently blank. After
     ~8s it surfaces a message instead of retrying quietly. */
  var TRIP_MAP_INIT_TRIES = 0;

  function initTripMapWhenReady() {
    if (tripMapState.map) return void renderTripMapMarkers();
    if (!window.L || typeof window.L.map != "function") {
      if (++TRIP_MAP_INIT_TRIES > 26) {
        var emptyEl = u("#tripMapEmpty");
        return void (
          emptyEl &&
          ((emptyEl.hidden = !1),
          (emptyEl.textContent =
            "Map couldn't load — check your connection and reopen this page."))
        );
      }
      return void setTimeout(initTripMapWhenReady, 300);
    }
    TRIP_MAP_INIT_TRIES = 0;
    var map = ensureTripMapInit();
    map &&
      (setTimeout(function () {
        (map.invalidateSize(), renderTripMapMarkers());
      }, 60),
      renderTripMapMarkers());
  }

  function loadTripMapOSM() {
    /* Map tiles and hub data are independent: kick off both, neither one
       blocks the other. A slow tile CDN must not leave the hub filter
       stuck on "Loading hubs…" forever, and missing hub data must not
       keep the tiles from rendering. */
    initTripMapWhenReady();
    var currentTripId = K.tripRecordId || K.tripId || "";
    if (
      tripMapState.loadedForTrip === currentTripId &&
      tripMapState.hubs.length
    )
      return void renderTripMapHubs(tripMapState.hubs);
    tripMapState.loadedForTrip = currentTripId;
    var chip = u("#mapHubCountText");
    chip && (chip.textContent = "Loading hubs…");
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA)
      return void renderTripMapHubs([]);
    fetchTripHubLocations()
      .then(function (hubs) {
        renderTripMapHubs(hubs);
      })
      .catch(function (err) {
        (console.error(gr, "loadTripMapOSM failed:", err),
          renderTripMapHubs([]));
      });
  }

  /* ------------------------------------------------------------
     Shows "Trip ID: … · Booking ID: …" at the top of Hub Check-In /
     Check-Out and POD. Once the driver has picked Booking IDs in the
     checklist below, the chip reflects that selection; until then it
     falls back to every Booking ID resolved off the Trip record so the
     page never shows a blank dash while options are still loading.
     ------------------------------------------------------------ */
  function updateBookingIdChip() {
    var label = "";
    if (c.bookingIds && c.bookingIds.length)
      label = c.bookingIds
        .map(function (b) {
          return b.label;
        })
        .filter(Boolean)
        .join(", ");
    else if (BOOKING_ID_OPTIONS.length)
      label = BOOKING_ID_OPTIONS.map(function (o) {
        return o.label;
      })
        .filter(Boolean)
        .join(", ");
    else if (K.record) {
      /* getTripBookingIds() is used here instead of le(K.record,
         "assignedBookings") because it has an extra last-resort scan
         (any field whose name contains "booking") that le() doesn't —
         so if Zoho ever returns the Booking_ID multi-select under a
         slightly different key, or the exact-key lookup otherwise
         misses, the chip still finds it instead of showing "—". */
      var keys = getTripBookingIds();
      (console.log(
        gr,
        "[booking-debug] updateBookingIdChip() fallback keys:",
        keys,
      ),
        (label = keys.join(", ")));
    }
    var tripLabel = K.tripId || "—";
    label = label || "—";
    var a = u("#checkinBookingIdChip");
    a && (a.textContent = "Trip ID: " + tripLabel + " · Booking ID: " + label);
    var b = u("#podBookingIdChip");
    b && (b.textContent = "Trip ID: " + tripLabel + " · Booking ID: " + label);
  }

  /* ------------------------------------------------------------
     BOOKING ID CHECKLIST (Hub Check-In / Check-Out)
     Booking_ID moved from a single Lookup to a Multi-Select, since one
     Trip can now cover several Bookings. BOOKING_ID_OPTIONS holds every
     Booking record {id, label} resolved off the active Trip (reusing
     the same BOOKING_CACHE-backed lookup the hub pipeline already uses,
     via fetchActiveTripShipmentBookings()); the checklist in
     #bookingIdList lets the driver choose which of them this check-in
     covers, and c.bookingIds tracks the current selection.
     ------------------------------------------------------------ */
  var BOOKING_ID_OPTIONS = [];

  function bookingOptionKey(o) {
    return String((o && (o.id || o.label)) || "");
  }

  function renderBookingIdChecklist() {
    var host = u("#bookingIdList");
    if (!host) return;
    if (!BOOKING_ID_OPTIONS.length)
      return void (host.innerHTML =
        '<li class="booking-item booking-item--empty">No Booking IDs found for this Trip.</li>');
    /* Nothing chosen yet (e.g. first load for this trip) -> default to
       every Booking ID selected, since most trips cover all of them. */
    var selectedKeys =
      c.bookingIds && c.bookingIds.length
        ? c.bookingIds.map(function (b) {
            return String(b.id || b.label || "");
          })
        : null;
    ((host.innerHTML = BOOKING_ID_OPTIONS.map(function (o) {
      var key = bookingOptionKey(o),
        checked = selectedKeys ? -1 !== selectedKeys.indexOf(key) : !0;
      return (
        '<li class="booking-item"><label class="booking-item__check"><input type="checkbox" data-bid="' +
        String(o.id || "").replace(/"/g, "&quot;") +
        '" data-blabel="' +
        String(o.label || "").replace(/"/g, "&quot;") +
        '"' +
        (checked ? " checked" : "") +
        "> <span>" +
        String(o.label || "") +
        "</span></label></li>"
      );
    }).join("")),
      selectedKeys || syncSelectedBookingIdsFromChecklist());
  }

  /* Reads the checked boxes in #bookingIdList into c.bookingIds and
     refreshes the "Booking ID: …" chip to match. Bound to the
     checklist's (bubbling) change event, so it fires on every tick. */
  function syncSelectedBookingIdsFromChecklist() {
    var host = u("#bookingIdList");
    ((c.bookingIds = host
      ? Array.prototype.slice
          .call(host.querySelectorAll('input[type="checkbox"]:checked'))
          .map(function (cb) {
            return {
              id: cb.getAttribute("data-bid") || "",
              label: cb.getAttribute("data-blabel") || "",
            };
          })
      : []),
      updateBookingIdChip());
  }

  /* Drops the cached checklist so a new trip doesn't show the previous
     trip's Booking IDs while the fresh list is still loading. */
  function resetBookingIdSelection() {
    ((BOOKING_ID_OPTIONS = []), (c.bookingIds = []));
  }

  /* Loads the Booking record(s) linked to the active Trip and (re)builds
     the checklist. Mirrors Dr() (Hub Name dropdown) — same
     fetchActiveTripShipmentBookings() source, so the Booking IDs offered
     here always match what the Hub pipeline is using. */
  function Fr() {
    var host = u("#bookingIdList");
    if (!host) return Promise.resolve();
    if (!K.tripRecordId)
      return (
        (BOOKING_ID_OPTIONS = []),
        (host.innerHTML =
          '<li class="booking-item booking-item--empty">Start a trip to load Booking IDs.</li>'),
        Promise.resolve()
      );
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA)
      return Promise.resolve();
    host.innerHTML =
      '<li class="booking-item booking-item--empty">Loading Booking IDs…</li>';
    return fetchActiveTripShipmentBookings()
      .then(function (bookings) {
        var seen = {};
        ((BOOKING_ID_OPTIONS = (bookings || [])
          .map(function (b) {
            var label =
              lookupLabel(sr(b, BOOKING_FIELD_CANDIDATES.bookingId)) ||
              b.ID ||
              b.id ||
              "";
            label = String(label).trim();
            return label
              ? {
                  id: b.ID || b.id || null,
                  label: label,
                }
              : null;
          })
          .filter(function (o) {
            return o && !seen[o.label] && (seen[o.label] = !0);
          })),
          console.log(
            gr,
            "[booking-debug] Booking ID checklist options:",
            BOOKING_ID_OPTIONS,
          ),
          renderBookingIdChecklist());
      })
      .catch(function (err) {
        (console.error(gr, "Fr() (Booking ID checklist) failed:", err),
          (host.innerHTML =
            '<li class="booking-item booking-item--empty">Could not load Booking IDs for this Trip.</li>'));
      });
  }
  /* ------------------------------------------------------------
     Shows how many Shipment Items are assigned to the selected Hub for
     THIS Trip + Booking, under the Hub Name dropdown. Uses the same
     pipeline as the POD page, so the count and the POD list can never
     disagree.
     ------------------------------------------------------------ */
  function updateHubItemCount(hubName) {
    var el = u("#hubItemCount");
    if (!el) return;
    if (!hubName) return void (el.hidden = !0);
    ((el.hidden = !1), (el.textContent = "Checking items for this hub…"));
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA)
      return void (el.textContent = "");
    return fetchActiveTripShipmentBookings()
      .then(function (bookings) {
        return fetchShipmentItemsForBookings(bookings).then(function (rows) {
          var count = rowsHaveNoHubInfo(rows)
            ? rows.length
            : mapShipmentSubformItems(rows, hubName).length;
          ((el.hidden = !1),
            (el.textContent =
              count +
              " shipment item" +
              (1 === count ? "" : "s") +
              " assigned to this hub"));
        });
      })
      .catch(function (err) {
        console.error(gr, "Hub shipment item count lookup failed:", err);
        el.textContent = "Couldn't load the item count for this hub.";
      });
  }

  /* ------------------------------------------------------------
     POD items for the selected hub: Item + Quantity, read from the
     Shipment Items of this Trip's Booking and filtered by the selected
     Hub. Never falls back to a hub-only lookup — that could expose
     another trip's shipment.
     ------------------------------------------------------------ */
  function loadPodItemsForHub(hubName) {
    /* Always prefer the live dropdown value, so POD never filters against
       a stale c.hub if the driver changed the selection. */
    var liveHubEl = u("#inHub");
    hubName = (liveHubEl && liveHubEl.value) || hubName;
    ((CURRENT_POD_LOADING = true), renderPodItemsUI());
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA)
      return (
        (CURRENT_POD_ITEMS = (d[hubName] || []).map(function (p) {
          return {
            id: p.id,
            name: p.name,
            qty: p.qty,
            receivedQty: p.qty,
            pendingQty: 0,
          };
        })),
        (CURRENT_POD_LOADING = false),
        void renderPodItemsUI()
      );

    function finish(items, source) {
      (console.log(
        gr,
        "POD items resolved via",
        source,
        "-",
        items.length,
        "item(s)",
      ),
        (CURRENT_POD_LOADING = false),
        (CURRENT_POD_ITEMS = items),
        renderPodItemsUI());
    }

    if (!K.record || !(K.tripId || K.tripRecordId))
      return finish([], "no active Trip_Dispatch record");
    if (!getTripBookingIds().length)
      return finish([], "no Booking ID linked to this Trip ID");
    if (!hubName) return finish([], "no hub selected");

    return fetchActiveTripShipmentBookings()
      .then(function (bookings) {
        return Promise.all([
          ensureItemNamesLoaded(),
          fetchShipmentItemsForBookings(bookings),
        ]).then(function (res) {
          var rows = res[1];
          /* When no row carries hub information at all, hub filtering is
           impossible — every item of this booking belongs here. */
          if (rowsHaveNoHubInfo(rows)) {
            console.warn(
              gr,
              "[hub-debug] no hub field on any Shipment_Items row — showing every item of this booking",
            );
            return finish(
              rows.map(mapOneShipmentItem),
              "Trip + Booking Shipment Items (no hub field on rows)",
            );
          }
          finish(
            mapShipmentSubformItems(rows, hubName),
            "Trip_Dispatch + Booking + Shipment_Items.Hub_Name",
          );
        });
      })
      .catch(function (err) {
        console.error(gr, "POD Shipment_Items lookup failed:", err);
        finish([], "Shipment_Items lookup failed");
      });
  }

  /* ------------------------------------------------------------
     NEW: Dispatch & POD (per-Booking flow)
     Separate from the hub-based Hub Check-In/Create POD flow above —
     this lets the driver pick ONE Booking ID for the active Trip, see
     its Customer/Pickup/Delivery/Weight, and go straight to a POD page
     listing only that Booking's Shipment Items (Item, Qty, Received Qty,
     Pending Qty, Delivery Status, Delivery Note). Existing hub-based POD
     (viewPod / loadPodItemsForHub / Hub_Check_in_Check_Out1) is untouched.
     ------------------------------------------------------------ */
  var DISPATCH_BOOKING_OPTIONS = [];
  var DISPATCH_SELECTED_BOOKING = null;
  var DISPATCH_POD_ITEMS = [];
  /* Record ID of the Dispatch_POD record created when the Booking
     Details are submitted; the POD subform (Proof_of_Delivery2) rows
     are linked back to it via the bidirectional "Dispatch_POD" field. */
  var DISPATCH_POD_RECORD_ID = null;

  /* Fills the "Bookings on this trip" summary card at the top of the
     Dispatch & POD page: how many bookings are on the selected Trip ID,
     and the (de-duplicated) Company Names across those bookings. */
  function renderDispatchTripBookingsSummary(bookings) {
    w(
      "dispatchTripBookingsCount",
      bookings.length + (1 === bookings.length ? " booking" : " bookings"),
    );
    var namesEl = u("#dispatchTripCompanyNames");
    if (!namesEl) return;
    if (!bookings.length)
      return void (namesEl.textContent = "No bookings found for this trip.");
    var seen = {},
      names = [];
    bookings.forEach(function (b) {
      var nm = lookupLabel(sr(b, BOOKING_FIELD_CANDIDATES.customer));
      nm && !seen[nm] && ((seen[nm] = !0), names.push(nm));
    });
    namesEl.textContent = names.length
      ? names.join(", ")
      : "No company name found on these bookings.";
  }

  function populateDispatchBookingDropdown() {
    var sel = u("#inDispatchBookingId");
    if (!sel) return;
    [
      "#inDispatchCustomer",
      "#inDispatchWeight",
      "#inDispatchPickup",
      "#inDispatchDelivery",
    ].forEach(function (id) {
      var el = u(id);
      el && (el.value = "");
    });
    w("dispatchTripBookingsCount", "—");
    var namesEl0 = u("#dispatchTripCompanyNames");
    namesEl0 &&
      (namesEl0.textContent = "Select a trip to see the bookings on it.");
    if (!K.tripRecordId)
      return void (sel.innerHTML =
        '<option value="" selected hidden disabled>Start a trip to load Booking IDs…</option>');
    sel.innerHTML =
      '<option value="" selected hidden disabled>Loading Booking IDs…</option>';
    w("dispatchTripBookingsCount", "Loading…");
    namesEl0 && (namesEl0.textContent = "Loading…");
    fetchActiveTripShipmentBookings()
      .then(function (bookings) {
        DISPATCH_BOOKING_OPTIONS = bookings || [];
        renderDispatchTripBookingsSummary(DISPATCH_BOOKING_OPTIONS);
        if (!DISPATCH_BOOKING_OPTIONS.length)
          return void (sel.innerHTML =
            '<option value="" selected hidden disabled>No Booking IDs found for this Trip.</option>');
        var labels = DISPATCH_BOOKING_OPTIONS.map(function (b, i) {
          return (
            lookupLabel(sr(b, BOOKING_FIELD_CANDIDATES.bookingId)) ||
            b.ID ||
            b.id ||
            "Booking " + (i + 1)
          );
        });
        /* Booking IDs whose POD is already saved (see POD_PDF1) still
         show in the list — the driver needs to see every Booking ID
         on this Trip — but are rendered disabled so a completed
         delivery can't be re-selected and re-submitted. Only Booking
         IDs with no matching POD_PDF1 record stay selectable. */
        renderDispatchBookingOptions(sel, labels, {});
        fetchCompletedPodBookingIds(labels)
          .then(function (completedSet) {
            renderDispatchBookingOptions(sel, labels, completedSet);
          })
          .catch(function (err) {
            console.error(gr, "fetchCompletedPodBookingIds() failed:", err);
          });
      })
      .catch(function (err) {
        (console.error(gr, "populateDispatchBookingDropdown() failed:", err),
          (sel.innerHTML =
            '<option value="" selected hidden disabled>Could not load Booking IDs.</option>'),
          w("dispatchTripBookingsCount", "—"),
          namesEl0 &&
            (namesEl0.textContent = "Could not load bookings for this trip."));
      });
  }

  /* Renders the Booking ID <select> options, disabling (but still
     showing) any Booking ID present in completedSet. Kept as its own
     function so populateDispatchBookingDropdown() can render once
     immediately (nothing disabled yet, while the completed-lookup is
     still in flight) and again once that lookup resolves, without
     duplicating the option-building markup. */
  function renderDispatchBookingOptions(sel, labels, completedSet) {
    sel.innerHTML =
      '<option value="" selected hidden disabled>Select a Booking ID…</option>' +
      labels
        .map(function (label, i) {
          var isCompleted = !!completedSet[label],
            safeLabel = String(label).replace(/</g, "&lt;");
          return (
            '<option value="' +
            i +
            '"' +
            (isCompleted ? " disabled" : "") +
            ">" +
            safeLabel +
            (isCompleted ? " (POD completed)" : "") +
            "</option>"
          );
        })
        .join("");
  }

  /* Looks up which of these Booking IDs already have a saved POD_PDF1
     record (Booking_ID field) — see the POD_PDF form's field
     definition — so populateDispatchBookingDropdown() can disable
     them instead of leaving every Booking ID selectable forever. */
  function fetchCompletedPodBookingIds(bookingIds) {
    var ids = (bookingIds || []).filter(Boolean);
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA || !ids.length)
      return Promise.resolve({});
    var criteria =
      "(" +
      ids
        .map(function (id) {
          return 'Booking_ID == "' + escapeCriteria(id) + '"';
        })
        .join(" || ") +
      ")";
    return kr({
      report_name: "POD_PDF1",
      criteria: criteria,
      field_config: "all",
      max_records: 1000,
    })
      .then(function (res) {
        var set = {};
        return (
          ((res && res.data) || []).forEach(function (row) {
            var bid = String(row.Booking_ID || "").trim();
            bid && (set[bid] = !0);
          }),
          set
        );
      })
      .catch(function (err) {
        return (
          console.error(
            gr,
            "fetchCompletedPodBookingIds() report query failed:",
            err,
          ),
          {}
        );
      });
  }

  /* ---------- POD Completion KPI (Trip details card) ----------
     Total PODs     = Bookings assigned to the active Trip (the same list
                      the Dispatch & POD "Booking ID" dropdown uses — one
                      POD is expected per Booking).
     Completed PODs = those Bookings that already have a saved POD_PDF
                      record (POD_PDF1 report). This is the same test the
                      dropdown uses to mark a Booking "(POD completed)".
     Refreshed when the trip loads and right after every successful POD
     save (optimistically first, then reconciled with Creator). */
  var POD_KPI = {
    tripKey: "",
    labels: [],
    done: {},
    local: {},
    loading: !1,
    seq: 0,
  };

  function podKpiSplitIds(v) {
    return String(null == v ? "" : v)
      .split(/[,;]+/)
      .map(function (x) {
        return x.trim();
      })
      .filter(Boolean);
  }

  function renderPodCompletionKpi() {
    var valEl = u("#podKpiVal"),
      subEl = u("#podKpiSub"),
      barEl = u("#podKpiBar");
    if (!valEl) return;
    var total = POD_KPI.labels.length;
    if (!total) {
      valEl.innerHTML = "— <small>/ — Completed</small>";
      subEl &&
        (subEl.textContent = POD_KPI.loading
          ? "Loading…"
          : K.tripRecordId
            ? "No PODs assigned to this trip yet"
            : "Start a trip to track its PODs");
      barEl && (barEl.style.width = "0%");
      return;
    }
    var completed = POD_KPI.labels.filter(function (label) {
      return POD_KPI.done[label] || POD_KPI.local[label];
    }).length;
    valEl.innerHTML = completed + " <small>/ " + total + " Completed</small>";
    subEl &&
      (subEl.textContent =
        "Total PODs: " +
        total +
        " · Completed: " +
        completed +
        " · Pending: " +
        (total - completed));
    barEl && (barEl.style.width = Math.round((100 * completed) / total) + "%");
  }

  /* Booking IDs (as shown on the popup, possibly several comma-separated
     from the hub check-in flow) that were just saved. */
  function podKpiMarkCompleted(ids) {
    (ids || []).forEach(function (id) {
      POD_KPI.local[id] = !0;
    });
    renderPodCompletionKpi();
  }

  /* Which of these Booking IDs already have a saved POD_PDF record.
     Matches on Booking_ID, plus this Trip's own POD_PDF rows (a hub
     check-in POD stores several Booking IDs comma-separated in one
     Booking_ID text field, so those are split before comparing).
     Resolves to null (not {}) when the lookup itself fails, so a
     transient error never wipes a count that was already known. */
  function fetchTripCompletedPodBookingIds(labels) {
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA || !labels.length)
      return Promise.resolve(null);
    var parts = labels.map(function (l) {
      return 'Booking_ID == "' + escapeCriteria(l) + '"';
    });
    K.tripId && parts.push('Trip_ID == "' + escapeCriteria(K.tripId) + '"');
    return kr({
      report_name: POD_PDF_REPORT_NAME,
      criteria: "(" + parts.join(" || ") + ")",
      field_config: "all",
      max_records: 1000,
    })
      .then(function (res) {
        var wanted = {},
          set = {};
        labels.forEach(function (l) {
          wanted[l] = !0;
        });
        ((res && res.data) || []).forEach(function (row) {
          podKpiSplitIds(cr(row.Booking_ID)).forEach(function (id) {
            wanted[id] && (set[id] = !0);
          });
        });
        return set;
      })
      .catch(function (err) {
        console.warn(
          gr,
          "POD Completion KPI: could not read " + POD_PDF_REPORT_NAME + ":",
          err,
        );
        return null;
      });
  }

  function refreshPodCompletionKpi() {
    if (!u("#podKpiVal")) return Promise.resolve();
    var tripKey = K.tripRecordId || K.tripId || "";
    if (POD_KPI.tripKey !== tripKey)
      POD_KPI = {
        tripKey: tripKey,
        labels: [],
        done: {},
        local: {},
        loading: !1,
        seq: POD_KPI.seq,
      };
    if (!tripKey) return (renderPodCompletionKpi(), Promise.resolve());
    var seq = ++POD_KPI.seq;
    POD_KPI.loading = !0;
    renderPodCompletionKpi();
    return fetchActiveTripShipmentBookings()
      .then(function (bookings) {
        if (seq !== POD_KPI.seq) return;
        var seen = {},
          labels = [];
        (bookings || []).forEach(function (b) {
          var label = String(
            lookupLabel(sr(b, BOOKING_FIELD_CANDIDATES.bookingId)) ||
              b.ID ||
              b.id ||
              "",
          ).trim();
          label && !seen[label] && ((seen[label] = !0), labels.push(label));
        });
        POD_KPI.labels = labels;
        POD_KPI.loading = !1;
        renderPodCompletionKpi();
        return fetchTripCompletedPodBookingIds(labels).then(function (set) {
          if (seq !== POD_KPI.seq) return;
          set && (POD_KPI.done = set);
          renderPodCompletionKpi();
        });
      })
      .catch(function (err) {
        POD_KPI.loading = !1;
        console.error(gr, "refreshPodCompletionKpi() failed:", err);
        renderPodCompletionKpi();
      });
  }

  function onDispatchBookingSelected() {
    var sel = u("#inDispatchBookingId"),
      idx = sel && sel.value;
    DISPATCH_POD_RECORD_ID = null;
    if (!sel || "" === idx || null == idx)
      return void (DISPATCH_SELECTED_BOOKING = null);
    var booking = DISPATCH_BOOKING_OPTIONS[Number(idx)];
    DISPATCH_SELECTED_BOOKING = booking || null;
    if (!booking) return;
    /* BUG FIX: these four are <input> fields, not text elements — w()
       sets .textContent, which an <input> never renders (it displays
       .value). That's why the fetched Customer/Weight/Pickup/Delivery
       never visibly appeared even though the lookup itself was working.
       Set .value directly instead, the same way populateDispatchBooking-
       Dropdown() already clears these fields. */
    var custEl = u("#inDispatchCustomer"),
      weightEl = u("#inDispatchWeight"),
      pickupEl = u("#inDispatchPickup"),
      deliveryEl = u("#inDispatchDelivery"),
      customerName = lookupLabel(
        sr(booking, BOOKING_FIELD_CANDIDATES.customer),
      );
    custEl && (custEl.value = customerName || "—");
    weightEl &&
      (weightEl.value =
        cr(sr(booking, BOOKING_FIELD_CANDIDATES.weight)) || "—");
    pickupEl &&
      (pickupEl.value =
        lookupLabel(sr(booking, BOOKING_FIELD_CANDIDATES.pickupLocation)) ||
        "—");
    deliveryEl &&
      (deliveryEl.value =
        lookupLabel(sr(booking, BOOKING_FIELD_CANDIDATES.deliveryLocation)) ||
        "—");
    /* The Trip_Dispatch1 "Assigned Bookings" subform row (see
       assignedBookingsFromTripRecord()) doesn't carry the Customer
       Company Name directly — only the linked Booking record does — so
       if it came back blank, look that record up once and fill it in
       when it resolves. */
    if (!customerName) {
      var bookingRef = sr(booking, BOOKING_FIELD_CANDIDATES.bookingId);
      resolveBookingCustomerName(bookingRef)
        .then(function (nm) {
          custEl &&
            DISPATCH_SELECTED_BOOKING === booking &&
            nm &&
            (custEl.value = nm);
        })
        .catch(function (err) {
          console.error(gr, "resolveBookingCustomerName() failed:", err);
        });
    }
  }

  /* Looks up the Customer/Company Name from the standalone booking report
     (BOOKING_REPORT_CANDIDATES) by Booking ID/record ID, for cases where
     the Trip_Dispatch1 "Assigned Bookings" subform row doesn't carry the
     customer name itself. */
  function resolveBookingCustomerName(bookingRef) {
    var key = rawLookupId(bookingRef) || String(bookingRef || "").trim();
    if (!key) return Promise.resolve("");
    var escaped = escapeCriteria(key);

    function tryReport(index) {
      if (index >= BOOKING_REPORT_CANDIDATES.length) return Promise.resolve("");
      var reportName = BOOKING_REPORT_CANDIDATES[index];
      return kr({
        report_name: reportName,
        criteria:
          '(ID == "' + escaped + '" || Booking_ID == "' + escaped + '")',
        field_config: "all",
        max_records: 200,
      })
        .then(function (res) {
          var row = res && res.data && res.data[0];
          var nm =
            row && lookupLabel(sr(row, BOOKING_FIELD_CANDIDATES.customer));
          return nm
            ? (promoteBookingReportCandidate(index), nm)
            : tryReport(index + 1);
        })
        .catch(function () {
          return tryReport(index + 1);
        });
    }
    return tryReport(0);
  }

  /* Submitting the Booking Details creates the parent Dispatch_POD
     record (Booking_ID, Driver_ID, Customer_Company_Name,
     Pickup_Location, Trip_ID, Driver_Name, Weight, Delivery_Location —
     matching the Dispatch_POD form fields exactly) and only then moves
     the driver on to the POD page. The new record's ID is kept in
     DISPATCH_POD_RECORD_ID so the POD items saved next can be linked
     back to it via the form's bidirectional "Dispatch_POD" field on
     Proof_of_Delivery2. */
  async function submitDispatchToPod() {
    var errEl = u("#dispatchErr");
    if ((errEl && (errEl.hidden = !0), !DISPATCH_SELECTED_BOOKING))
      return (
        errEl &&
          ((errEl.textContent = "Select a Booking ID first."),
          (errEl.hidden = !1)),
        void 0
      );
    var booking = DISPATCH_SELECTED_BOOKING,
      bookingRefId = booking.ID || booking.id || null,
      custEl = u("#inDispatchCustomer"),
      weightEl = u("#inDispatchWeight"),
      pickupEl = u("#inDispatchPickup"),
      deliveryEl = u("#inDispatchDelivery"),
      btn = u("#btnCreatePodFromDispatch");
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA)
      return ((DISPATCH_POD_RECORD_ID = null), void Y("podbooking"));
    btn && (btn.disabled = !0);
    try {
      var empId = await resolveEmployeeFormId(),
        payload = {};
      (bookingRefId && (payload.Booking_ID = cr2(bookingRefId)),
        K.tripRecordId && (payload.Trip_ID = cr2(K.tripRecordId)),
        empId &&
          ((payload.Driver_ID = cr2(empId)),
          (payload.Driver_Name = cr2(empId))));
      var customerVal = custEl && custEl.value,
        weightVal = weightEl && weightEl.value,
        pickupVal = pickupEl && pickupEl.value,
        deliveryVal = deliveryEl && deliveryEl.value;
      (customerVal &&
        "—" !== customerVal &&
        (payload.Customer_Company_Name = customerVal),
        weightVal &&
          "—" !== weightVal &&
          (payload.Weight = Number(weightVal) || weightVal),
        pickupVal && "—" !== pickupVal && (payload.Pickup_Location = pickupVal),
        deliveryVal &&
          "—" !== deliveryVal &&
          (payload.Delivery_Location = deliveryVal));
      var res = await ZOHO.CREATOR.DATA.addRecords({
        form_name: "Dispatch_POD",
        payload: {
          data: payload,
        },
      });
      ((DISPATCH_POD_RECORD_ID =
        (res && res.data && (res.data.ID || res.data.id)) || null),
        Y("podbooking"));
    } catch (err) {
      (console.error(gr, "Dispatch_POD save failed:", err),
        errEl &&
          ((errEl.textContent = "Couldn't save Booking Details: " + _r(err)),
          (errEl.hidden = !1)));
    } finally {
      btn && (btn.disabled = !1);
    }
  }

  function recalcPodBkPending(i) {
    var item = DISPATCH_POD_ITEMS[i];
    if (!item) return;
    item.pendingQty = Math.max(
      0,
      (Number(item.qty) || 0) - (Number(item.receivedQty) || 0),
    );
    var pendEl = u('[data-podbk-pending="' + i + '"]');
    pendEl && (pendEl.textContent = item.pendingQty);
  }

  function renderPodBkItemsUI() {
    var host = u("#podBkItemList"),
      countEl = u("#podBkItemCount");
    if (!host) return;
    var booking = DISPATCH_SELECTED_BOOKING,
      bkLabel = booking
        ? lookupLabel(sr(booking, BOOKING_FIELD_CANDIDATES.bookingId)) ||
          booking.ID ||
          booking.id ||
          "—"
        : "—";
    w("podBkBookingIdChip", "Booking ID: " + bkLabel);
    if (!DISPATCH_POD_ITEMS.length)
      return (
        countEl && (countEl.textContent = ""),
        void (host.innerHTML =
          '<div class="podbk-row podbk-row--empty">No Shipment Items found for this Booking.</div>')
      );
    (countEl &&
      (countEl.textContent =
        DISPATCH_POD_ITEMS.length +
        " item" +
        (1 === DISPATCH_POD_ITEMS.length ? "" : "s")),
      (host.innerHTML = DISPATCH_POD_ITEMS.map(function (item, i) {
        return (
          '<div class="podbk-row"><span>' +
          String(item.name).replace(/</g, "&lt;") +
          "</span><span>" +
          item.qty +
          '</span><input type="number" min="0" data-podbk-received="' +
          i +
          '" value="' +
          item.receivedQty +
          '"><span data-podbk-pending="' +
          i +
          '">' +
          item.pendingQty +
          "</span></div>"
        );
      }).join("")),
      Array.prototype.slice
        .call(host.querySelectorAll("[data-podbk-received]"))
        .forEach(function (el) {
          el.addEventListener("input", function () {
            var i = Number(el.getAttribute("data-podbk-received"));
            ((DISPATCH_POD_ITEMS[i].receivedQty = Number(el.value) || 0),
              recalcPodBkPending(i));
          });
        }));
  }

  function loadPodItemsForDispatchBooking() {
    var booking = DISPATCH_SELECTED_BOOKING,
      statusEl = u("#inPodBkStatus"),
      noteEl = u("#podBkNote");
    /* Delivery Status/Note are now a single overall pair for the
       whole booking (not per item) — reset them each time a
       different booking's items load, so a value entered for one
       booking never carries over and gets saved against another. */
    (statusEl && (statusEl.value = ""), noteEl && (noteEl.value = ""));
    if (!booking) return ((DISPATCH_POD_ITEMS = []), void renderPodBkItemsUI());
    w("podBkItemCount", "Loading…");
    return Promise.all([
      ensureItemNamesLoaded(),
      fetchShipmentItemsForBookings([booking]),
    ])
      .then(function (res) {
        var rows = res[1];
        ((DISPATCH_POD_ITEMS = (rows || []).map(function (row, i) {
          return mapOneShipmentItem(row, i);
        })),
          renderPodBkItemsUI());
      })
      .catch(function (err) {
        (console.error(gr, "loadPodItemsForDispatchBooking() failed:", err),
          (DISPATCH_POD_ITEMS = []),
          renderPodBkItemsUI());
      });
  }

  async function savePodBooking() {
    var errEl = u("#podBkErr");
    if (
      (errEl && (errEl.hidden = !0),
      !DISPATCH_SELECTED_BOOKING || !DISPATCH_POD_ITEMS.length)
    )
      return (
        errEl &&
        ((errEl.textContent = "No items to save for this Booking."),
        (errEl.hidden = !1))
      );
    var statusEl = u("#inPodBkStatus"),
      overallStatus = statusEl ? statusEl.value : "";
    if (!overallStatus)
      return (
        u("#fPodBkStatus") && u("#fPodBkStatus").classList.add("is-bad"),
        errEl &&
          ((errEl.textContent = "Select a Delivery Status."),
          (errEl.hidden = !1))
      );
    u("#fPodBkStatus") && u("#fPodBkStatus").classList.remove("is-bad");
    var overallNote = (u("#podBkNote") ? u("#podBkNote").value : "").trim();
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA)
      return R("Preview mode — POD not saved");
    if (!DISPATCH_POD_RECORD_ID)
      return (
        errEl &&
        ((errEl.textContent =
          "Booking Details weren't saved — go back and submit the Booking Details again."),
        (errEl.hidden = !1))
      );
    var booking = DISPATCH_SELECTED_BOOKING,
      bookingRefId = booking.ID || booking.id || null,
      empId = await resolveEmployeeFormId(),
      saveBtn = u("#btnSavePodBooking");
    saveBtn && (saveBtn.disabled = !0);
    try {
      for (
        var dispatchPodIdx = 0;
        dispatchPodIdx < DISPATCH_POD_ITEMS.length;
        dispatchPodIdx++
      ) {
        var item = DISPATCH_POD_ITEMS[dispatchPodIdx];
        var payload = {
          Dispatch_POD: cr2(DISPATCH_POD_RECORD_ID),
          Item: cr2(item.id),
          Quantity: item.qty,
          Received_Qty: item.receivedQty,
          Pending_Qty: item.pendingQty,
          /* Delivery Status/Note are now entered once for the whole
             booking (see the fields below the item table) instead of
             per item — the same overall value is written against
             every Proof_of_Delivery2 item row. */
          Delivery_Status: overallStatus,
          Delivery_Note: overallNote,
        };
        (bookingRefId && (payload.Booking_ID = cr2(bookingRefId)),
          K.tripRecordId && (payload.Trip_ID = K.tripRecordId),
          empId && (payload.Driver_ID = cr2(empId)));
        await ZOHO.CREATOR.DATA.addRecords({
          form_name: "Proof_of_Delivery2",
          payload: {
            data: payload,
          },
        }).catch(function (err) {
          return (
            console.error(
              gr,
              "Proof_of_Delivery2 (Dispatch flow) item save failed:",
              err,
            ),
            null
          );
        });
      }
      /* Customer Company Name comes from the Customer field on the
         Booking_Shipments1 record; Vehicle from the current Trip
         record (K.vehicleName, resolved via Trip_Dispatch1.Vehicle —
         see ce.vehicle above); Pickup/Delivery Location and Weight
         from the same Booking record. All from data this flow already
         fetched — nothing here is guessed. */
      var podCustomerCompany = lookupLabel(
          sr(booking, BOOKING_FIELD_CANDIDATES.customer),
        ),
        podPickupLocation = lookupLabel(
          sr(booking, BOOKING_FIELD_CANDIDATES.pickupLocation),
        ),
        podDeliveryLocation = lookupLabel(
          sr(booking, BOOKING_FIELD_CANDIDATES.deliveryLocation),
        ),
        podWeight = cr(sr(booking, BOOKING_FIELD_CANDIDATES.weight));
      (R(
        "POD saved for Booking " +
          (lookupLabel(sr(booking, BOOKING_FIELD_CANDIDATES.bookingId)) ||
            bookingRefId),
      ),
        populatePodResultPage({
          date: k(),
          driverName: s.name,
          driverId: empId || s.id,
          tripId: K.tripRecordId || K.tripId,
          bookingId:
            lookupLabel(sr(booking, BOOKING_FIELD_CANDIDATES.bookingId)) ||
            bookingRefId,
          vehicleNo: K.vehicleName,
          companyName: podCustomerCompany,
          customerCompany: podCustomerCompany,
          shipperCompany: podCustomerCompany,
          pickupLocation: podPickupLocation,
          deliveryLocation: podDeliveryLocation,
          weight: podWeight,
          status: overallStatus,
          note: overallNote || "—",
          signature: null,
          items: DISPATCH_POD_ITEMS.map(function (it) {
            return {
              name: it.name,
              qty: it.qty,
              receivedQty: it.receivedQty,
              pendingQty: it.pendingQty,
              price: it.price,
            };
          }),
        }),
        (DISPATCH_POD_RECORD_ID = null),
        showPodResultView());
    } finally {
      saveBtn && (saveBtn.disabled = !1);
    }
  }

  /* ------------------------------------------------------------
     Populates the Hub Name <select> on Hub Check-In / Check-Out from the
     Locations report, filtered to the hubs that belong to this Trip's
     Booking — the same source of truth as the Live Trip Map filter.

     Matching is by Locations record ID OR by hub name, so a hub still
     appears when Zoho returns only the display label. If hub resolution
     comes back empty, every hub is listed with a console warning rather
     than leaving the driver with a dead dropdown.
     ------------------------------------------------------------ */
  function Dr() {
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA)
      return Promise.resolve();
    var reports = [e.locations]
      .concat(e.locationsFallbacks || [])
      .filter(function (v, i, arr) {
        return v && arr.indexOf(v) === i;
      });
    return resolveTripHubRefs().then(function (hubRefs) {
      var hasRefs = !!(hubRefs && (hubRefs.ids.length || hubRefs.names.length));
      if (hubRefs && !hasRefs)
        console.warn(
          gr,
          "[hub-debug] hub resolution returned nothing for this Trip/Booking — listing all hubs. Run skywayHubDebug() to see why.",
        );
      return (function tryLoc(n) {
        if (n >= reports.length)
          return void console.error(
            gr,
            "Could not read a Locations report for Hub Name (tried: " +
              reports.join(", ") +
              ").",
          );
        return kr({
          report_name: reports[n],
          field_config: "all",
          max_records: 200,
        })
          .then(function (res) {
            var allRows = (res && res.data) || [],
              sel = u("#inHub");
            if (!sel) return;
            var rows = hasRefs
              ? allRows.filter(function (rec) {
                  return locationMatchesHubRefs(rec, hubRefs);
                })
              : allRows;
            if (hasRefs && !rows.length && n + 1 < reports.length)
              return tryLoc(n + 1);
            HUB_NAME_TO_ID = {};
            var names = [];
            rows.forEach(function (rec) {
              var nm = cr(sr(rec, t));
              nm &&
                void 0 === HUB_NAME_TO_ID[nm] &&
                ((HUB_NAME_TO_ID[nm] = rec.ID || rec.id || null),
                names.push(nm));
            });
            /* Hub names present on the items but missing from Locations are
             still offered, so the driver is never blocked. */
            if (hasRefs)
              hubRefs.names.forEach(function (nm) {
                nm = String(nm).trim();
                nm &&
                  void 0 === HUB_NAME_TO_ID[nm] &&
                  ((HUB_NAME_TO_ID[nm] = null), names.push(nm));
              });
            console.log(gr, "[hub-debug] hub dropdown options:", names);
            var prev = sel.value;
            sel.innerHTML = names.length
              ? '<option value="" selected hidden disabled></option>'
              : '<option value="">No hubs found for this Trip/Booking</option>';
            names.forEach(function (nm) {
              var opt = document.createElement("option");
              ((opt.value = nm), (opt.textContent = nm), sel.appendChild(opt));
            });
            prev && -1 !== names.indexOf(prev) && (sel.value = prev);
          })
          .catch(function (err) {
            return (
              console.error(
                gr,
                "getRecords on",
                reports[n],
                "(Locations) failed:",
                err,
              ),
              tryLoc(n + 1)
            );
          });
      })(0);
    });
  }

  /* ------------------------------------------------------------
     Console diagnostic. Run  skywayHubDebug()  in the browser console to
     print the real Zoho field names on this trip's booking and item
     records — use it to extend the *_CANDIDATES lists above if a hub
     still doesn't appear.
     ------------------------------------------------------------ */
  window.skywayHubDebug = function () {
    console.group("[Skyway hub debug]");
    console.log("Trip record:", K.record);
    console.log("Trip booking keys:", getTripBookingIds());
    return fetchActiveTripShipmentBookings()
      .then(function (bookings) {
        console.log("Matched booking record(s):", bookings);
        bookings.forEach(function (b) {
          console.log("Booking field names:", Object.keys(b));
        });
        return fetchShipmentItemsForBookings(bookings).then(function (rows) {
          console.log("Shipment item row(s):", rows);
          rows.slice(0, 5).forEach(function (r, i) {
            console.log(
              "Item " + i + " field names:",
              Object.keys(r),
              "| hub refs:",
              hubRefsFromRow(r),
              "| Item:",
              cr(sr(r, SHIPMENT_ITEM_FIELD_CANDIDATES.name)),
              "| Quantity:",
              sr(r, SHIPMENT_ITEM_FIELD_CANDIDATES.qty),
            );
          });
          console.log("HUB_NAME_TO_ID:", HUB_NAME_TO_ID);
          console.groupEnd();
          return {
            bookings: bookings,
            items: rows,
          };
        });
      })
      .catch(function (err) {
        (console.error("skywayHubDebug failed:", err), console.groupEnd());
      });
  };

  /* ---------- Driver profile photo — Employees2.Profile Picture ----------
     Per requirement, the driver's profile photo must come from the
     `Profile Picture` field on the `Employees2` report specifically
     (not the Drivers/Driver report used for the rest of the profile).
     Looked up by the logged-in driver's email, same matching pattern as
     wr()/resolveEmployeeFormId() above. Tries a couple of likely report
     name variants in case the report was renamed, and — like the
     Drivers-report photo lookup — falls back to scanning every field on
     the matched record for anything that looks like an image field if
     none of the known Profile Picture candidates matched. Never throws:
     any failure just leaves the existing photoPath (if any) in place. */
  var EMPLOYEES2_REPORT_CANDIDATES = [
    "Employees2",
    "Employees_2",
    "Employees",
    "All_Employees",
    "Employee2",
  ];

  /* Creator image fields vary by report and SDK version: a value can be a
     URL/path string, an upload object, or a one-item array. Normalize that
     shape before handing it to the image renderer. */
  function profilePictureValue(value) {
    if (!value) return "";
    if (Array.isArray(value)) return profilePictureValue(value[0]);
    if ("object" != typeof value) return String(value);
    var keys = [
      "url",
      "downloadUrl",
      "download_url",
      "filepath",
      "file_path",
      "display_value",
      "value",
      "link",
      "image_url",
    ];
    for (var idx = 0; idx < keys.length; idx++)
      if (value[keys[idx]]) return profilePictureValue(value[keys[idx]]);
    return "";
  }

  function employees2PhotoFromRecord(rec) {
    var photo = profilePictureValue(sr(rec, i.photo));
    if (photo) return photo;
    var keys = Object.keys(rec),
      rx = /photo|picture|image|avatar/i;
    for (var k = 0; k < keys.length; k++)
      if (rx.test(keys[k]) && null != rec[keys[k]] && "" !== rec[keys[k]]) {
        photo = profilePictureValue(rec[keys[k]]);
        if (photo) return photo;
      }
    return "";
  }

  function fetchDriverPhotoFromEmployees2(email, employeeId, recordId) {
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA)
      return Promise.resolve("");
    var trimmedEmail = String(email || "").trim(),
      trimmedEmployeeId = String(employeeId || "").trim(),
      trimmedRecordId = String(recordId || "").trim();
    if (!trimmedEmail && !trimmedEmployeeId && !trimmedRecordId)
      return Promise.resolve("");
    function isCurrentDriver(rec) {
      return !!(
        (trimmedEmail && br(sr(rec, i.email)) === br(trimmedEmail)) ||
        (trimmedEmployeeId && br(sr(rec, i.id)) === br(trimmedEmployeeId)) ||
        (trimmedRecordId && br(rec.ID || rec.id) === br(trimmedRecordId))
      );
    }
    return (function tryReport(idx) {
      if (idx >= EMPLOYEES2_REPORT_CANDIDATES.length)
        return Promise.resolve("");
      var reportName = EMPLOYEES2_REPORT_CANDIDATES[idx];
      return kr({
        report_name: reportName,
        criteria: "(" + r + ' == "' + trimmedEmail.replace(/"/g, '\\"') + '")',
        field_config: "all",
        max_records: 200,
      })
        .then(function (res) {
          var rows = (res && res.data) || [];
          if (!rows.length)
            return kr({
              report_name: reportName,
              field_config: "all",
              max_records: 200,
            })
              .then(function (res2) {
                var all = (res2 && res2.data) || [],
                  matched = all.filter(function (rec) {
                    return isCurrentDriver(rec);
                  });
                if (!matched.length) return tryReport(idx + 1);
                var photo = employees2PhotoFromRecord(matched[0]);
                return photo
                  ? (console.log(
                      gr,
                      "Employees2 photo resolved (scan match) from report",
                      reportName,
                    ),
                    photo)
                  : tryReport(idx + 1);
              })
              .catch(function () {
                return tryReport(idx + 1);
              });
          var matchedRow = rows.filter(isCurrentDriver)[0] || rows[0],
            photo = employees2PhotoFromRecord(matchedRow);
          return photo
            ? (console.log(
                gr,
                "Employees2 photo resolved from report",
                reportName,
              ),
              photo)
            : tryReport(idx + 1);
        })
        .catch(function (err) {
          return (
            console.warn(
              gr,
              "Employees2 photo lookup failed on report",
              reportName,
              err,
            ),
            tryReport(idx + 1)
          );
        });
    })(0);
  }

  function Tr() {
    if (!window.ZOHO || !ZOHO.CREATOR)
      return ((a.source = "Default BFM values (preview)"), yr(), void L());
    Dr();
    var e = "";
    (ZOHO.CREATOR.UTIL.getQueryParams
      ? ZOHO.CREATOR.UTIL.getQueryParams().catch(function () {
          return {};
        })
      : Promise.resolve({})
    )
      .then(function (e) {
        return (e = e || {}).driverEmail
          ? (console.log(
              gr,
              "email source: URL param ?driverEmail=",
              e.driverEmail,
            ),
            e.driverEmail)
          : (ZOHO.CREATOR.UTIL.getWidgetParams
              ? ZOHO.CREATOR.UTIL.getWidgetParams().catch(function () {
                  return {};
                })
              : Promise.resolve({})
            ).then(function (e) {
              var t = e && (e.Driver_Email || e.driverEmail);
              return t
                ? (console.log(gr, "email source: widget parameter", t), t)
                : ZOHO.CREATOR.UTIL.getInitParams().then(function (e) {
                    console.log(gr, "getInitParams() ->", e);
                    var t = e && e.loginUser;
                    if (!t)
                      throw new Error(
                        "getInitParams() returned no loginUser. In a Customer Portal this can happen depending on how the widget page is embedded — pass the portal user's email in explicitly instead: add a query param to this widget's page URL (e.g. via a Deluge on-load script using zoho.loginuserid) and read it here as ?driverEmail=...",
                      );
                    return (
                      console.log(
                        gr,
                        "email source: getInitParams().loginUser",
                        t,
                      ),
                      t
                    );
                  });
            });
      })
      .then(function (t) {
        return wr((e = t.trim()));
      })
      .then(function (t) {
        if (!t)
          throw new Error(
            'No Driver form record has Email == "' +
              e +
              "\". Check that record's Email field for typos, extra spaces, or a different case than the portal login.",
          );
        var r;
        ((r = document.getElementById("driverLookupError")) && (r.hidden = !0),
          (function (e) {
            var t = [];

            function r(r, n) {
              var a = or(e, i[r] || []),
                o = a ? e[a] : "",
                s = n ? n(o) : o || "";
              return (
                t.push({
                  field: r,
                  matchedApiName: a || "NOT FOUND",
                  value: s,
                }),
                s
              );
            }
            ((s.recordId = e.ID || e.id || null),
              (s.id = r("id") || s.id),
              (s.name = r("name", lr) || s.name),
              (s.gender = r("gender", cr)),
              (s.email = r("email") || s.email),
              (s.mobile = r("mobile")),
              (s.altMobile = r("altMobile")),
              (s.dob = r("dob")),
              (s.photoPath =
                r("photo") ||
                /* PHOTO FIX: none of the known Profile_Photo/Photo/Driver_Photo-style
             candidates above matched a field on this Driver record — instead of
             giving up (which is what silently left the avatar as initials-only),
             scan every field on the record for one that looks like an image field
             by name (contains "photo"/"picture"/"image"/"avatar") and has a value,
             so a differently-named field in this Zoho form still gets picked up. */
                (function () {
                  var keys = Object.keys(e),
                    rx = /photo|picture|image|avatar/i;
                  for (var i2 = 0; i2 < keys.length; i2++)
                    if (
                      rx.test(keys[i2]) &&
                      null != e[keys[i2]] &&
                      "" !== e[keys[i2]]
                    )
                      return e[keys[i2]];
                  return "";
                })()),
              (s.address = r("address", dr)),
              (s.employmentType = r("employmentType")),
              (s.started = r("joiningDate")),
              (s.department = r("department", cr)),
              (s.designation = r("designation", cr)),
              (s.licenceNo = r("licenceNo")),
              (s.licenceNumber = r("licenceNumber")),
              (s.licenceIssueDate = r("licenceIssueDate")),
              (s.licenceType = r("licenceType", cr)),
              (s.licenceClass = r("licenceClass", cr) || s.licenceType),
              (s.licenceExpiry = r("licenceExpiry")),
              (s.licenceStatus = r("licenceStatus", cr)),
              (s.licenceDocumentPath = r("licenceDocument")),
              (s.licenceCopyPath = r("licenceCopy")),
              (s.vehicleName = r("vehicleName", cr)),
              (s.vehicleAssigned = s.vehicleName),
              (s.passportNumber = r("passportNumber")),
              (s.passportCopyPath = r("passportCopy")),
              (s.identityDocType = r("identityDocType", cr)),
              (s.identityDocNumber = r("identityDocNumber")),
              (s.experience = r("experience")),
              (s.heavyVehicleExperience = r("heavyVehicleExperience", cr)),
              (s.lastCheckupDate = r("lastCheckupDate")),
              (s.medicalFitnessStatus = r("medicalFitnessStatus", cr)),
              (s.medicalCertExpiry = r("medicalCertExpiry")),
              (s.fatigueModule = r("fatigueModule", cr)),
              (s.documentsPath = r("documents")),
              (s.remark = r("remark")),
              (s.visaStatus = r("visaStatus", cr)),
              (s.visaExpiryDate = r("visaExpiryDate")),
              (s.expiryDate = r("expiryDate")),
              (s.medicalCertificatePath = r("medicalCertificate")),
              (s.rightToWorkDocumentPath = r("rightToWorkDocument")),
              (s.identityDocumentCopyPath = r("identityDocumentCopy")),
              (s.bfmAccreditation = (n && e[n]) || ""),
              (s.loaded = !0),
              console.log(gr, "Field mapping report:"),
              console.table ? console.table(t) : console.log(t),
              console.log(
                gr,
                "Raw record returned by Zoho (all keys as-received):",
                e,
              ));
          })(t));
      })
      .then(function () {
        /* Employees2 profile-photo lookup DISABLED: live Zoho responses
         confirm none of EMPLOYEES2_REPORT_CANDIDATES exist in this app —
         every one comes back "No report named X found" (code 2894), not a
         near-miss. Calling this was 5 guaranteed-to-fail requests on every
         boot for a feature that cannot work as configured. The Drivers-
         report value already set on s.photoPath is used as-is instead.
         If a report matching this description is ever added in Zoho
         Creator, put its real name in EMPLOYEES2_REPORT_CANDIDATES and
         restore the fetchDriverPhotoFromEmployees2(e, s.id, s.recordId)
         call that used to run here. */
      })
      .then(function () {
        (yr(),
          vr(),
          scoreRefresh(),
          ke()
            .then(function () {
              L();
            })
            .catch(function (e) {
              (console.error(gr, "restore/load chain failed:", e), L());
            }));
      })
      .catch(function (t) {
        var r, n, i;
        (console.error(gr, "Driver profile load failed:", t),
          (s.loaded = !1),
          (s.name = "Driver not found"),
          (s.id = "—"),
          yr(),
          (r =
            (e ? "Signed in as " + e + ". " : "") +
            (t && t.message
              ? t.message
              : "Could not load this driver's profile.")),
          (n = document.getElementById("driverLookupError")),
          (i = document.getElementById("driverLookupErrorText")) &&
            (i.textContent = r),
          n && (n.hidden = !1),
          pe("No matching driver found"),
          be([], [], "No matching driver found."),
          (a.source = "Default BFM values (driver lookup failed)"),
          P(),
          L());
      });
  }
  var Cr = {
    contact: {
      type: "form",
      link: "Contact_Control",
    },
    alerts: {
      type: "report",
      link: e.alerts,
    },
    "view-stop": {
      type: "report",
      link: "Trip_Stops",
    },
    "score-report": {
      type: "report",
      link: "Driver_Scorecard",
    },
    trip: {
      type: "report",
      link: e.trips,
    },
    deliveries: {
      type: "report",
      link: "Trip_Stops",
    },
    duty: {
      type: "report",
      link: e.duty,
    },
    route: {
      type: "report",
      link: e.trips,
    },
    fuel: {
      type: "report",
      link: "Fuel_Entries",
    },
  };
  var Ir = !1;
  document.addEventListener("DOMContentLoaded", function () {
    try {
      if (Ir) return;
      ((Ir = !0),
        (function () {
          function e(e, t, r) {
            var n = u(e);
            n && n.addEventListener(t, r);
          }

          function t(t) {
            e(t, "click", function (e) {
              var t = e.target.closest("[data-view-trip]");
              if (t) {
                var r = t.closest("[data-trip-id]");
                if (r) {
                  var n = ye[r.getAttribute("data-trip-id")];
                  n &&
                    (function (e) {
                      if (e) {
                        var t = le(e, "tripId") || "—",
                          r = le(e, "status") || "—",
                          n = ve(r);
                        (w("tdTripId", t),
                          w("tdTripIdRow", t),
                          w("tdTripType", le(e, "tripType") || "—"),
                          w("tdTripStatus", r),
                          w("tdTripStatusRow", r),
                          w("tdRoute", tripRoute(e)),
                          w("tdBookingDate", le(e, "bookingDate") || "—"),
                          w(
                            "tdPlannedDelivery",
                            le(e, "plannedDelivery") || "—",
                          ),
                          w("tdVehicle", le(e, "vehicle") || "—"),
                          w(
                            "tdVehicleCapacity",
                            le(e, "vehicleCapacity") || "—",
                          ),
                          w("tdSupervisor", le(e, "supervisor") || "—"),
                          w("tdPrimaryDriver", le(e, "primaryDriver") || "—"),
                          w(
                            "tdVehicleInspectionStatus",
                            le(e, "vehicleInspectionStatus") || "—",
                          ),
                          w("tdFromLocation", le(e, "fromLocation") || "—"),
                          w("tdToLocation", le(e, "toLocation") || "—"),
                          w("tdPickupLocation", le(e, "pickupLocation") || "—"),
                          w(
                            "tdDeliveryLocation",
                            le(e, "deliveryLocation") || "—",
                          ),
                          w(
                            "tdEstimatedDistance",
                            le(e, "estimatedDistance") || "—",
                          ),
                          w("tdTripDuration", le(e, "tripDuration") || "—"),
                          w("tdQuantity", le(e, "quantity") || "—"),
                          w("tdWeight", le(e, "weight") || "—"),
                          w(
                            "tdExpectedDelivery",
                            le(e, "expectedDelivery") || "—",
                          ));
                        var i = u("#tdTripStatus");
                        (i && (i.className = "hubstatus " + n),
                          er("panelTripDetails", null));
                      }
                    })(n);
                }
              }
            });
          }
          (w("hdrDate", k()),
            w("hdrDriverId", s.id),
            document.addEventListener("click", function (e) {
              var t = e.target.closest("[data-nav]");
              if (t) {
                var r = t.getAttribute("data-nav");
                /* A Start Trip button while a trip is already in progress:
                     refuse before $() swaps the active trip out from under it. */
                if (
                  (t.hasAttribute("data-start-trip") ||
                    "btnStartTop" === t.id) &&
                  hasActiveTrip()
                )
                  return void R("Complete your active trip first");
                if (t.hasAttribute("data-start-trip")) {
                  var n = t.getAttribute("data-trip-id"),
                    i = n ? ye[n] : null;
                  i ? $(i) : n && (X = n);
                }
                if ("btnStartTop" === t.id) {
                  if (!ge.length)
                    return void R("No trip assigned yet — nothing to start.");
                  $(ge[0]);
                }
                return ("break" === r && G(), void Y(r));
              }
              var a = e.target.closest("[data-panel]");
              if (a) {
                var o = a.getAttribute("data-panel");
                return (
                  er(o, null),
                  rr(),
                  void ("panelAttendance" === o && De())
                );
              }
              var c = e.target.closest("[data-geo]");
              if (c)
                !(function (e) {
                  var t = {
                    veh: {
                      url: "#inVehUrl",
                      loc: "#inVehLoc",
                    },
                    brk: {
                      url: "#inBrkUrl",
                      loc: "#inBrkLoc",
                    },
                    start: {
                      url: "#inStartUrl",
                      loc: "#inStartLoc",
                    },
                    fuel: {
                      url: "#inFuelUrl",
                      loc: "#inFuelCurrentLoc",
                    },
                    inc: {
                      url: "#inIncUrl",
                      loc: "#inIncLoc",
                    },
                    exp: {
                      url: "#inExpUrl",
                      loc: "#inExpLoc",
                    },
                  }[e];
                  if (t) {
                    var r = t.url,
                      n = t.loc;
                    navigator.geolocation
                      ? (R("Getting your location…"),
                        navigator.geolocation.getCurrentPosition(
                          function (e) {
                            var t = e.coords.latitude.toFixed(6),
                              i = e.coords.longitude.toFixed(6),
                              a = u(r);
                            a &&
                              ((a.value =
                                "https://maps.google.com/?q=" + t + "," + i),
                              "start" === c.getAttribute("data-geo") &&
                                (a.disabled = !0));
                            var o = u(n);
                            (o &&
                              !o.value &&
                              ((o.value = t + ", " + i),
                              "start" === c.getAttribute("data-geo") &&
                                (o.disabled = !0)),
                              R("Location captured"));
                          },
                          function () {
                            R(
                              "Couldn't get your location — enter it manually.",
                            );
                          },
                          {
                            timeout: 1e4,
                          },
                        ))
                      : R("Location isn't available on this device.");
                  }
                })(c.getAttribute("data-geo"));
              else {
                var l = e.target.closest("[data-action]");
                if (l) {
                  var d = l.getAttribute("data-action");
                  if ("alerts" === d)
                    return (ir(), er("panelAlerts", null), void F());
                  var m = Cr[d];
                  if (
                    m &&
                    (function (e) {
                      if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.UTIL)
                        return !1;
                      try {
                        var t =
                          "?Driver_ID=" +
                          encodeURIComponent(s.id) +
                          "&Trip_ID=" +
                          encodeURIComponent(K.tripId || X || "");
                        return (
                          ZOHO.CREATOR.UTIL.navigateParentURL({
                            action: "open",
                            url:
                              ("form" === e.type ? "#Form:" : "#Report:") +
                              e.link +
                              t,
                            window: "new",
                          }),
                          !0
                        );
                      } catch (e) {
                        return !1;
                      }
                    })(m)
                  )
                    return;
                  R(
                    l.textContent.trim() +
                      " — connect this to a Creator form to go live.",
                  );
                }
              }
            }),
            u("#btnDriver").addEventListener("click", function () {
              er("panelDriver", this);
            }),
            u("#btnTripAttended").addEventListener("click", function () {
              (er("panelAttendance", this), De());
            }),
            u("#btnScore").addEventListener("click", function () {
              (er("panelScore", this), rr(), nr());
            }),
            e("#btnBfmLogs", "click", openBfmLogsPanel),
            e("#btnBfmLogsBack", "click", function () {
              (er("panelScore", u("#btnScore")), rr(), nr());
            }),
            u("#scrim").addEventListener("click", tr),
            m("[data-close]").forEach(function (e) {
              e.addEventListener("click", tr);
            }),
            document.addEventListener("keydown", function (e) {
              "Escape" === e.key &&
                (tr(),
                u("#tyrePopup").hidden || Ye(),
                u("#docViewerPopup").hidden || pr(),
                u("#driverDocsPopup").hidden || closeDriverDocsPopup(),
                u("#tripInfoPopup").hidden || closeTripInfoPopup());
            }),
            e("#btnTripInfo", "click", function (e) {
              (e.stopPropagation(), openTripInfoPopup());
            }),
            e("#tripTimerBox", "click", openTripInfoPopup),
            e("#btnTripSummary", "click", openTripInfoPopup),
            e("#tripInfoClose", "click", closeTripInfoPopup),
            e("#tripInfoScrim", "click", closeTripInfoPopup),
            e("#btnDownloadPod", "click", downloadPodResult),
            e("#btnSavePodPdf", "click", saveDeliveryRecordToZoho),
            t("#dashAttList"),
            t("#attList"),
            t("#dashTodayTripList"),
            t("#tripList"),
            e("#btnAttSummary", "click", function () {
              (er("panelAttendance", null), De());
            }),
            e("#btnAttViewMore", "click", function () {
              (er("panelAttendance", null), De());
            }),
            e("#btnStartTripCta", "click", bt),
            e("#btnSubmitStartTrip", "click", submitStartTripPage),
            e("#btnSaveVcheck", "click", gt),
            e("#veh3dFallback", "click", function (e) {
              var t = e.target.closest(".tyre3d__tyre");
              t && ze(t.getAttribute("data-tyre"));
            }),
            e("#tyrePopupSave", "click", Qe),
            e("#tyrePopupClose", "click", Ye),
            e("#tyreScrim", "click", Ye),
            e("#tyrePopupInput", "keydown", function (e) {
              "Enter" === e.key && Qe();
            }),
            e("#tyreCountFilter", "change", function (e) {
              Ze(e.target.value);
            }),
            e("#btnClearPodResultSignature", "click", podResultSigPadClear),
            e("#btnPanelViewDocs", "click", function () {
              (tr(), openDriverDocsPopup());
            }),
            e("#driverDocsPopupClose", "click", closeDriverDocsPopup),
            e("#driverDocsScrim", "click", closeDriverDocsPopup),
            e("#driverDocsPopup", "click", function (e) {
              var t = e.target.closest(".doccard__open");
              if (t && "true" !== t.getAttribute("aria-disabled")) {
                e.preventDefault();
                var r = t.closest(".doccard"),
                  n = r && r.querySelector(".doccard__body b");
                !(function (e, t) {
                  if (t) {
                    (closeDriverDocsPopup(),
                      w("docViewerTitle", e || "Document"));
                    var r = u("#docViewerLoading");
                    r && (r.hidden = !1);
                    var n = u("#docViewerFrame");
                    n &&
                      ((n.onload = function () {
                        r && (r.hidden = !0);
                      }),
                      (n.src = t));
                    var i = u("#docViewerDownload");
                    i &&
                      ((i.href = t),
                      i.setAttribute(
                        "download",
                        (function (e) {
                          return (
                            ((e || "document")
                              .trim()
                              .toLowerCase()
                              .replace(/[^a-z0-9]+/g, "-")
                              .replace(/(^-|-$)/g, "") || "document") + ".pdf"
                          );
                        })(e),
                      ));
                    var a = u("#docViewerOpenTab");
                    (a && (a.href = t),
                      (u("#docViewerPopup").hidden = !1),
                      (u("#docViewerScrim").hidden = !1),
                      (document.body.style.overflow = "hidden"));
                  }
                })(n ? n.textContent : "Document", t.getAttribute("href"));
              }
            }),
            e("#docsGrid", "click", function (e) {
              var t = e.target.closest(".doccard__open");
              if (t && "true" !== t.getAttribute("aria-disabled")) {
                e.preventDefault();
                var r = t.closest(".doccard"),
                  n = r && r.querySelector(".doccard__body b");
                !(function (e, t) {
                  if (t) {
                    w("docViewerTitle", e || "Document");
                    var r = u("#docViewerLoading");
                    r && (r.hidden = !1);
                    var n = u("#docViewerFrame");
                    n &&
                      ((n.onload = function () {
                        r && (r.hidden = !0);
                      }),
                      (n.src = t));
                    var i = u("#docViewerDownload");
                    i &&
                      ((i.href = t),
                      i.setAttribute(
                        "download",
                        (function (e) {
                          return (
                            ((e || "document")
                              .trim()
                              .toLowerCase()
                              .replace(/[^a-z0-9]+/g, "-")
                              .replace(/(^-|-$)/g, "") || "document") + ".pdf"
                          );
                        })(e),
                      ));
                    var a = u("#docViewerOpenTab");
                    (a && (a.href = t),
                      (u("#docViewerPopup").hidden = !1),
                      (u("#docViewerScrim").hidden = !1),
                      (document.body.style.overflow = "hidden"));
                  }
                })(n ? n.textContent : "Document", t.getAttribute("href"));
              }
            }),
            e("#docViewerClose", "click", pr),
            e("#docViewerScrim", "click", pr),
            je(),
            ft(),
            m(".yn-toggle").forEach(function (e) {
              if (!e.dataset.ynWired) {
                e.dataset.ynWired = "1";
                var t = document.getElementById(
                  e.getAttribute("data-yn-target"),
                );
                m(".yn-btn", e).forEach(function (r) {
                  r.addEventListener("click", function () {
                    (m(".yn-btn", e).forEach(function (e) {
                      e.classList.remove("is-active");
                    }),
                      r.classList.add("is-active"),
                      t &&
                        ((t.value = r.getAttribute("data-yn-val")),
                        t.dispatchEvent(
                          new Event("change", {
                            bubbles: !0,
                          }),
                        )));
                  });
                });
              }
            }),
            m("[data-check-verify]").forEach(function (e) {
              e.addEventListener("click", function () {
                !(function (e) {
                  var t = document.querySelector('[data-err="' + e + '"]');
                  (xt(Ie[e].fields), t && (t.hidden = !0));
                  var r = Ae()[e];
                  null === r
                    ? (Ie[e].fields.forEach(function (e) {
                        var t = document.getElementById(e),
                          r = t && t.querySelector("input, select");
                        t &&
                          r &&
                          !String(r.value).trim() &&
                          t.classList.add("is-bad");
                      }),
                      t &&
                        ((t.textContent =
                          "Complete every field in this check before verifying."),
                        (t.hidden = !1)),
                      Ne())
                    : "Defect" === r
                      ? (t &&
                          ((t.textContent =
                            "This check has failed. Raise a vehicle issue — the trip can't start with an open defect."),
                          (t.hidden = !1)),
                        Ne())
                      : ((Pe[e] = !0),
                        Ne(),
                        Oe(),
                        R(
                          Ie[e].label +
                            " verified" +
                            ("Monitor" === r ? " — flagged to monitor" : ""),
                        ),
                        Object.keys(Pe).every(function (e) {
                          return Pe[e];
                        }) &&
                          (gt(),
                          R("All checks verified — VH-208 cleared to depart")));
                })(e.getAttribute("data-check-verify"));
              });
            }),
            m("[data-check-close]").forEach(function (e) {
              e.addEventListener("click", function () {
                Oe();
              });
            }),
            e("#hubPrev", "click", function () {
              ae(-1);
            }),
            e("#hubNext", "click", function () {
              ae(1);
            }),
            e("#btnHubPod", "click", function () {
              var e = Q[J];
              ((c.hub = e.name),
                (c.date = c.date || k()),
                u("#inHub") && (u("#inHub").value = e.name),
                Y("pod"));
            }),
            ie(),
            oe(),
            [
              "attDone",
              "attCancel",
              "attTotal",
              "attDone2",
              "attCancel2",
              "attTotal2",
              "dashAttDone",
              "dashAttCancel",
              "dashAttTotal",
            ].forEach(function (e) {
              w(e, "—");
            }),
            w("attSub", "Loading…"),
            w("tripAttMini", "—"),
            w("tripAttSub", "Loading…"),
            w("dashAttSub", "Loading…"),
            [u("#attList"), u("#dashAttList")].forEach(function (e) {
              if (e) {
                e.innerHTML = "";
                var t = document.createElement("li");
                ((t.className = "triprow"),
                  (t.textContent = "Loading trips…"),
                  e.appendChild(t));
              }
            }),
            (function () {
              w("dashTripCountLabel", "Loading…");
              [u("#dashTodayTripList"), u("#tripList")].forEach(function (e) {
                if (e) {
                  e.innerHTML = "";
                  var t = document.createElement("li");
                  ((t.className = "triprow"),
                    (t.textContent = "Loading trips…"),
                    e.appendChild(t));
                }
              });
            })(),
            Te(),
            m(".checkcard input, .checkcard select").forEach(function (e) {
              (e.addEventListener("input", Ne),
                e.addEventListener("change", Ne));
            }),
            m(".checkcard .yn-btn").forEach(function (e) {
              e.addEventListener("click", function () {
                setTimeout(Ne, 0);
              });
            }),
            e("#btnSaveCheckIn", "click", _t),
            e("#btnGoToPod", "click", kt),
            e("#btnSavePod", "click", wt),
            e("#btnClearSignature", "click", sigPadClear),
            e("#inHub", "change", function () {
              updateHubItemCount(u("#inHub").value);
            }),
            e("#bookingIdList", "change", syncSelectedBookingIdsFromChecklist),
            window.addEventListener("resize", function () {
              (sigPad.canvas && sigPadResize(),
                podResultSigPad.canvas && podResultSigPadResize());
            }),
            e("#btnSaveFuel", "click", Lt),
            e("#inFuelQty", "input", St),
            e("#inFuelCost", "input", St),
            e("#inIncTime", "input", Bt),
            e("#inIncEndTime", "input", Bt),
            e("#btnSaveIncident", "click", qt),
            e("#btnSaveVehicle", "click", Zt),
            e("#btnSaveExpense", "click", submitExpenseEntry),
            e("#inDispatchBookingId", "change", onDispatchBookingSelected),
            e("#btnCreatePodFromDispatch", "click", submitDispatchToPod),
            e("#btnSavePodBooking", "click", savePodBooking),
            e("#btnSaveBreak", "click", Yt),
            e("#btnContinueDriving", "click", j),
            e("#btnStopTimer", "click", G),
            e("#inBrkStart", "input", zt),
            e("#inBrkEnd", "input", zt),
            Dt(),
            e("#btnComplete", "click", function () {
              Y("tripfeedback");
            }),
            e("#btnSubmitTripFeedback", "click", async function () {
              var e = u("#tfbErr");
              ((e.hidden = !0), xt(["fTfbFeedback"]));
              var t = At("#inTfbFeedback");
              if (!t)
                return (
                  u("#fTfbFeedback").classList.add("is-bad"),
                  (e.textContent = "Enter some feedback before submitting."),
                  void (e.hidden = !1)
                );
              /* End the trip in Creator FIRST. Only when that is confirmed do the
                 feedback / BFM summary below run, so a failed attempt can be
                 retried without duplicating anything, and the driver stays in
                 the trip until Creator has really closed it. */
              var doneBtn = u("#btnSubmitTripFeedback");
              doneBtn && (doneBtn.disabled = !0);
              try {
                await endStartTripRecord();
              } catch (endErr) {
                console.error(gr, "Could not end the trip in Creator:", endErr);
                e.textContent =
                  "Couldn't complete the trip in Zoho Creator: " +
                  _r(endErr) +
                  " You are still on this trip — check your connection and press Submit again.";
                ((e.hidden = !1), doneBtn && (doneBtn.disabled = !1));
                return;
              }
              doneBtn && (doneBtn.disabled = !1);
              (clearTripSnapshot(),
                (o.completedTripRecordId = K.tripRecordId),
                (o.activeTripRecordId = null),
                (o.startTripRecordId = null),
                (o.restoredTrip = !1));
              (Mt("Trip_Feedback", {
                Trip_ID: At("#inTfbTripId"),
                Trip_Name: At("#inTfbTripName"),
                Trip_Feedback: t,
              }),
                saveBfmSummary(),
                R(
                  "Trip " + (K.tripId || X) + " completed — feedback submitted",
                ),
                (o.tripStarted = !1),
                (o.breakCount = 0),
                (u("#inTfbFeedback").value = ""),
                H(),
                V && (clearInterval(V), (V = null)),
                w("tripTimerVal", "00:00:00"),
                (U = !1),
                Y("dash"),
                /* Reload the driver's trips so the Dashboard shows the updated attendance
                   and no longer offers the finished trip as "Resume trip". */
                ke());
            }),
            P(),
            ir(),
            rr(),
            nr(),
            (r =
              window.matchMedia &&
              window.matchMedia("(prefers-reduced-motion: reduce)").matches),
            (n =
              window.matchMedia &&
              window.matchMedia("(hover: hover) and (pointer: fine)").matches),
            m(".kpi").forEach(function (e) {
              (n &&
                !r &&
                (e.addEventListener("mousemove", function (t) {
                  var r = e.getBoundingClientRect(),
                    n = (t.clientX - r.left) / r.width - 0.5,
                    i = (t.clientY - r.top) / r.height - 0.5;
                  e.style.transform =
                    "translateY(-6px) scale(1.018) rotateX(" +
                    (7 * -i).toFixed(2) +
                    "deg) rotateY(" +
                    (8 * n).toFixed(2) +
                    "deg)";
                }),
                e.addEventListener("mouseleave", function () {
                  e.style.transform = "";
                })),
                e.addEventListener("pointerdown", function () {
                  e.classList.add("is-lit");
                }),
                ["pointerup", "pointercancel", "pointerleave", "blur"].forEach(
                  function (t) {
                    e.addEventListener(t, function () {
                      setTimeout(function () {
                        e.classList.remove("is-lit");
                      }, 260);
                    });
                  },
                ));
            }),
            Tr(),
            setInterval(bfmTick, 6e4));
          var r, n;
        })());
    } catch (e) {
      (console.error("Dashboard boot error:", e), L());
    }
  });
})();
