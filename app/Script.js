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
! function() {
  "use strict";
  var e = {
      trips: "All_Trips",
      duty: "All_Duty_Logs",
      alerts: "All_Alerts",
      employees: "Drivers",
      employeesFallbacks: ["Driver"],
      locations: "Locations2",
      locationsFallbacks: ["Locations", "All_Locations"],
      expenseTypes: "All_Expense_Types",
      expenseTypesFallbacks: ["All_Expense_Type", "Expense_Type", "Expense_Types"]
    },
    t = ["Hub_Name", "Name"],
    r = "Email",
    n = null,
    i = {
      id: ["Driver_ID", "Driver_ID", "DriverID", "Driver_Id", "Employee_ID"],
      email: [r, "Email", "Email_Address", "Driver_Email", "Login_Email"],
      name: ["Name", "Name", "Driver_Name", "Full_Name"],
      gender: ["Gender", "Gender", "Sex"],
      mobile: ["Mobile_Number", "Mobile_Number", "Mobile_No", "Mobile", "Phone_No", "Phone"],
      altMobile: ["Al", "Al", "Alternative_Mobile", "Alternate_Mobile_No", "Alt_Mobile_No"],
      dob: ["Date_of_Birth", "Date_of_Birth", "DOB", "Birth_Date"],
      photo: ["Profile_Photo", "Profile_Photo", "Profile_Picture", "Photo", "Driver_Photo",
        "Employee_Photo", "Driver_Image", "Employee_Image", "Image", "Upload_Photo",
        "Photo_Upload", "Avatar", "Picture", "Driver_Picture"
      ],
      address: ["Address", "Address"],
      employmentType: ["Employment_Type", "Employment_Type", "Employee_Type"],
      joiningDate: ["Joining_Date", "Joining_Date", "Date_of_Joining", "DOJ"],
      department: ["Department", "Department", "Dept"],
      designation: ["Designation", "Designation", "Job_Title", "Role"],
      licenceNo: ["Licence_NO", "Licence_NO", "Licence_No", "License_No"],
      licenceNumber: ["Licence_Number", "Licence_Number", "License_Number"],
      licenceIssueDate: ["Licence_Issue_Date", "Licence_Issue_Date", "License_Issue_Date"],
      licenceType: ["Licence_Type", "Licence_Type", "License_Type"],
      licenceClass: ["Licence_Class", "Licence_Class", "License_Class"],
      licenceExpiry: ["Licence_Expiry_Date", "Licence_Expiry_Date", "License_Expiry_Date"],
      licenceStatus: ["Licence_Status", "Licence_Status", "License_Status"],
      licenceDocument: ["Licence_Document", "Licence_Document", "License_Document"],
      licenceCopy: ["Licence_Copy", "Licence_Copy", "License_Copy"],
      vehicleName: ["Vehicle_Name", "Vehicle_Name", "Vehicle_Type", "Vehicle_Registration_No"],
      passportNumber: ["Passport_Number", "Passport_Number"],
      passportCopy: ["Passport_Copy", "Passport_Copy"],
      identityDocType: ["Identity_Document_Type", "Identity_Document_Type", "ID_Type", "Identity_Type"],
      identityDocNumber: ["Identity_Document_Number", "Identity_Document_Number", "ID_Number", "Identity_Number"],
      experience: ["Experience_Years", "Experience_Years", "Driving_Experience", "Experience"],
      heavyVehicleExperience: ["Heavy_Vehicle_Experience", "Heavy_Vehicle_Experience", "HV_Experience"],
      lastCheckupDate: ["Last_Checkup_Date", "Last_Checkup_Date", "Last_Medical_Checkup_Date"],
      medicalFitnessStatus: ["Medical_Fitness_Status", "Medical_Fitness_Status", "Fitness_Status"],
      medicalCertExpiry: ["Medical_Certificate_Expiry_Date", "Medical_Certificate_Expiry_Date", "Medical_Expiry_Date"],
      fatigueModule: ["Fatigue_Module", "Fatigue_Module", "BFM_Module"],
      documents: ["Documents", "Documents"],
      remark: ["Remark", "Remark", "Remarks"],
      visaStatus: ["Visa_Right_to_Work_Status", "Visa_Right_to_Work_Status", "Visa_Status"],
      visaExpiryDate: ["Visa_Expiry_Date", "Visa_Expiry_Date", "Visa_Work_Permit_Expiry_Date"],
      expiryDate: ["Expiry_Date", "Expiry_Date"],
      medicalCertificate: ["Medical_Certificate", "Medical_Certificate"],
      rightToWorkDocument: ["Right_to_Work_Document", "Right_to_Work_Document"],
      identityDocumentCopy: ["Identity_Document_Copy", "Identity_Document_Copy"]
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
      tiers: [{
        key: "t0",
        label: "20 Minute",
        windowMins: 20,
        maxWorkMins: 15,
        restMins: 5,
        restLabel: "5 min rest"
      }, {
        key: "t1",
        label: "6¼ Hour",
        windowMins: 375,
        maxWorkMins: 360,
        restMins: 15,
        restLabel: "15 min continuous rest"
      }, {
        key: "t2",
        label: "9 Hour",
        windowMins: 540,
        maxWorkMins: 510,
        restMins: 30,
        restLabel: "30 min rest"
      }, {
        key: "t3",
        label: "12 Hour",
        windowMins: 720,
        maxWorkMins: 660,
        restMins: 60,
        restLabel: "60 min rest"
      }, {
        key: "t4",
        label: "24 Hour",
        windowMins: 1440,
        maxWorkMins: 840,
        restMins: 420,
        restLabel: "7 hr continuous stationary rest"
      }],
      /* Legacy aliases kept so the rest of the app (Log-a-break page,
         estimated end-time calc, BFM_Monitoring persistence, etc.) that
         reads a.maxWorkPerShift / a.restBlock / a.minRestPerShift /
         a.maxContinuousWork keeps working unchanged — they now simply
         mirror the matching tier from the table above instead of being
         separately hardcoded. */
      get maxContinuousWork() {
        return this.tiers[0].maxWorkMins
      },
      get restBlock() {
        return this.tiers[0].restMins
      },
      get maxWorkPerShift() {
        return this.tiers[4].maxWorkMins
      },
      get minRestPerShift() {
        return this.tiers[4].restMins
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
      source: "Default BFM values"
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
      breakElapsedMins: 0,
      /* Rest-complete auto-notification (Issue #4): restTargetMins is the
         rest duration owed for the current break (set when the break
         starts — see G()); restCompleteNotified guards against firing the
         "rest hours complete" alert/email more than once per break. */
      restTargetMins: 0,
      restCompleteNotified: !1,
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
        return this.tierWorked[4]
      },
      set workedMins(v) {
        this.tierWorked[4] = v
      },
      get sinceRestMins() {
        return this.tierWorked[0]
      },
      set sinceRestMins(v) {
        this.tierWorked[0] = v
      },
      weekWorkedMins: 2460,
      restTakenMins: 45
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
      loaded: !1
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
      bookingIds: []
    },
    l = [],
    d = {
      "Melbourne Distribution Hub": [{
        id: "P1",
        name: "Pallet — Grocery mixed cartons",
        qty: 12
      }, {
        id: "P2",
        name: "Pallet — Chilled dairy",
        qty: 6
      }, {
        id: "P3",
        name: "Carton — Beverages",
        qty: 20
      }, {
        id: "P4",
        name: "Pallet — Household goods",
        qty: 8
      }],
      "Sydney Depot": [{
        id: "P5",
        name: "Pallet — Grocery mixed cartons",
        qty: 10
      }, {
        id: "P6",
        name: "Carton — Personal care",
        qty: 15
      }],
      "Eastern Creek Hub": [{
        id: "P7",
        name: "Pallet — Frozen goods",
        qty: 9
      }, {
        id: "P8",
        name: "Carton — Confectionery",
        qty: 18
      }],
      "Albury Transfer Hub": [{
        id: "P9",
        name: "Pallet — Grocery mixed cartons",
        qty: 7
      }, {
        id: "P10",
        name: "Carton — Beverages",
        qty: 11
      }],
      "Goulburn Hub": [{
        id: "P11",
        name: "Pallet — Grocery mixed cartons",
        qty: 6
      }, {
        id: "P12",
        name: "Carton — Bakery goods",
        qty: 14
      }],
      "Gundagai Hub": [{
        id: "P13",
        name: "Pallet — Chilled dairy",
        qty: 4
      }, {
        id: "P14",
        name: "Carton — Beverages",
        qty: 9
      }],
      "Albury Hub": [{
        id: "P15",
        name: "Pallet — Household goods",
        qty: 5
      }, {
        id: "P16",
        name: "Carton — Personal care",
        qty: 12
      }],
      "Seymour Hub": [{
        id: "P17",
        name: "Pallet — Grocery mixed cartons",
        qty: 7
      }, {
        id: "P18",
        name: "Pallet — Frozen goods",
        qty: 3
      }],
      "Craigieburn Hub": [{
        id: "P19",
        name: "Carton — Confectionery",
        qty: 16
      }, {
        id: "P20",
        name: "Pallet — Household goods",
        qty: 5
      }],
      "Broadmeadows Hub": [{
        id: "P21",
        name: "Carton — Beverages",
        qty: 10
      }, {
        id: "P22",
        name: "Pallet — Grocery mixed cartons",
        qty: 3
      }]
    };

  function u(e, t) {
    return (t || document).querySelector(e)
  }

  function m(e, t) {
    return Array.prototype.slice.call((t || document).querySelectorAll(e))
  }

  function p(e) {
    return String(Math.floor(e)).padStart(2, "0")
  }

  function f(e) {
    return p((e = Math.max(0, Math.round(e))) / 60) + ":" + p(e % 60)
  }
  var h = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function v(e) {
    return p(e.getDate()) + "-" + h[e.getMonth()] + "-" + e.getFullYear() + " " + p(e.getHours()) +
      ":" + p(e.getMinutes()) + ":" + p(e.getSeconds())
  }

  function y(e) {
    if (!e) return "";
    var t = e.split("-");
    if (3 !== t.length) return e;
    var r = Number(t[0]),
      n = Number(t[1]) - 1,
      i = Number(t[2]);
    return r && !isNaN(n) && i ? p(i) + "-" + h[n] + "-" + r : e
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
    return isNaN(t.getTime()) ? "" : v(t)
  }

  function b(e) {
    if (!e) return "";
    var t = e.split(":");
    return p(Number(t[0]) || 0) + ":" + p(Number(t[1]) || 0) + ":" + p(Number(t[2]) || 0)
  }

  function _(e) {
    if (!e) return null;
    var t = e.split(":");
    return 60 * Number(t[0]) + Number(t[1])
  }

  function k() {
    return (new Date).toLocaleDateString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    })
  }

  function w(e, t) {
    var r = document.getElementById(e);
    r && (r.textContent = t)
  }

  var LOADER_STAGE_TEXT = ["Dispatching…", "On the move…", "Approaching destination…",
    "Delivery successful"
  ];

  function loaderApplyStage(percent) {
    var scene = document.getElementById("pageLoader");
    if (!scene) return;
    var stage = percent < 33.33 ? 0 : percent < 66.66 ? 1 : 2;
    scene.classList.toggle("is-stage-1", stage >= 1);
    scene.classList.toggle("is-stage-2", stage >= 2 && percent < 100);
    scene.classList.toggle("is-stage-3", percent >= 100);
    var stripe = document.getElementById("loaderTrailerStripe");
    stripe && (stripe.setAttribute("fill", percent < 33.33 ? "#0ea5e9" : percent < 66.66 ?
      "#a855f7" : "#10b981"))
  }

  function loaderApplyNodes(percent) {
    var thresholds = [0, 33.33, 66.66, 100];
    for (var i = 0; i < thresholds.length; i++) {
      var node = document.getElementById("loaderNode" + i);
      if (!node) continue;
      if (percent >= thresholds[i] && percent <= thresholds[i] + 3) node.classList.add(
        "is-active");
      else node.classList.remove("is-active");
      if (percent > thresholds[i] + 3 || 100 === percent && i < 3) node.classList.add("is-done"),
        node.classList.remove("is-active");
      else if (percent < thresholds[i]) node.classList.remove("is-done")
    }
  }

  function loaderApplyStatusText(percent) {
    var el = document.getElementById("loaderStatusText"),
      txt = percent >= 100 ? LOADER_STAGE_TEXT[3] : percent >= 66.66 ? LOADER_STAGE_TEXT[2] :
      percent >= 33.33 ? LOADER_STAGE_TEXT[1] : LOADER_STAGE_TEXT[0];
    el && el.textContent !== txt && (el.textContent = txt)
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
      span.style.setProperty("--cx", (Math.cos(angle) * velocity).toFixed(1) + "px");
      span.style.setProperty("--cy", (Math.sin(angle) * velocity).toFixed(1) + "px");
      span.style.animationDelay = (Math.random() * .2).toFixed(2) + "s";
      fx.appendChild(span)
    }
  }

  function D(e) {
    e = Math.max(0, Math.min(100, Math.round(e)));
    var t = document.getElementById("loaderProgressFill"),
      r = document.getElementById("loaderProgressPct"),
      n = document.getElementById("loaderProgress"),
      truck = document.getElementById("loaderTruck");
    t && (t.style.width = e + "%"), r && (r.textContent = e + "%"), n && n.setAttribute(
      "aria-valuenow", String(e)), truck && (truck.style.left = e + "%");
    loaderApplyStage(e), loaderApplyNodes(e), loaderApplyStatusText(e)
  }
  var T = 20000, /* Loader runtime, per request: 20 seconds only. */
    C = Date.now(),
    I = !1,
    S = setInterval(function() {
      I || D(Math.min(100, (Date.now() - C) / T * 100))
    }, 50);

  function E() {
    if (!I) {
      I = !0, clearInterval(S), D(100), loaderLaunchConfetti();
      var e = document.getElementById("pageLoader");
      e && e.classList.add("is-complete");
      setTimeout(function() {
        e && !e.classList.contains("is-hidden") && (e.classList.add("is-hidden"), setTimeout(
          function() {
            e.parentNode && e.remove()
          }, 600));
        try {
          Y(o.restoredTrip || o.tripStarted ? "trip" : "dash")
        } catch (e) {}
        o.pendingToast && (R(o.pendingToast), o.pendingToast = "")
      }, 80)
    }
  }

  function L() {
    var e = T - (Date.now() - C);
    e > 0 ? setTimeout(E, e) : E()
  }

  function R(e) {
    var t = document.createElement("div");
    t.textContent = e, t.style.cssText =
      "position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:99;background:#0F2748;color:#fff;padding:12px 18px;border-radius:10px;font-size:13px;font-weight:600;box-shadow:0 10px 28px rgba(15,39,72,.28);max-width:88vw;text-align:center",
      document.body.appendChild(t), setTimeout(function() {
        t.remove()
      }, 2400)
  }

  function x() {
    var tiers = a.tiers.map(function(tier, i) {
        var used = o.tierWorked[i],
          left = tier.maxWorkMins - used,
          breached = used >= tier.maxWorkMins,
          status = breached ? "breach" : left <= a.warnBefore ? "warn" : "ok";
        return {
          index: i,
          key: tier.key,
          label: tier.label,
          used: used,
          max: tier.maxWorkMins,
          left: left,
          restMins: tier.restMins,
          restLabel: tier.restLabel,
          breached: breached,
          status: status,
          note: "Rest required: " + tier.restLabel
        }
      }),
      breachedTiers = tiers.filter(function(t) {
        return t.breached
      }),
      warnTiers = tiers.filter(function(t) {
        return "warn" === t.status
      }),
      overall = breachedTiers.length ? "breach" : warnTiers.length ? "warn" : "ok",
      /* The soonest tier to breach drives the countdown shown in the hero
         (or, once something is already breached, the largest outstanding
         rest requirement among breached tiers). */
      soonest = tiers.slice().sort(function(x, y) {
        return x.left - y.left
      })[0],
      restRequired = breachedTiers.length ? Math.max.apply(null, breachedTiers.map(function(t) {
        return t.restMins
      })) : 0,
      restReason = breachedTiers.length ? breachedTiers.map(function(t) {
        return t.label + " limit reached"
      }).join(" · ") + " — rest required before driving on." : "";
    return {
      status: overall,
      untilRest: soonest ? soonest.left : 0,
      restRequired: restRequired,
      restReason: restReason,
      breachedTiers: breachedTiers,
      shiftLeft: tiers[4].left,
      weekLeft: a.maxWorkPerWeek - o.weekWorkedMins,
      rules: tiers
    }
  }

  function A(e, t) {
    var r = document.getElementById(e);
    r && (r.innerHTML = t.rules.map(function(e) {
      var t = Math.min(100, e.used / e.max * 100),
        r = "breach" === e.status ? "red" : "warn" === e.status ? "amber" : "green";
      return '<div class="bfm__rule bfm__rule--' + e.status + '"><span>' + e.label +
        " work <b>" + f(e.used) + " / " + f(e.max) + '</b></span><div class="bar"><i class="' +
        r + '" style="width:' + t + '%"></i></div><em>' + e.note + "</em></div>"
    }).join(""))
  }


  function P() {
    var e = x(),
      t = {
        ok: "Compliant",
        warn: "Rest due soon",
        breach: "Rest required now"
      } [e.status],
      r = {
        ok: "Working within your configured BFM limits.",
        warn: "Plan to pull over — a rest block is due shortly.",
        breach: "You have reached a configured limit. Stop and rest before driving on."
      } [e.status],
      n = u("#bfmHero");
    n && (n.className = "bfm__hero bfm-" + e.status), w("bfmState", t), w("bfmStateSub", r), w(
      "bfmCountdown", e.untilRest > 0 ? f(e.untilRest) : f(e.restRequired)), w("bfmCountLabel", e
      .untilRest > 0 ? "Until rest due" : "Rest required"), A("bfmRules", e);
    var i = u("#bfmRest");
    i && (i.className = "bfm__rest " + e.status, w("bfmRestText", e.restRequired ? e.restReason +
        " Required rest: " + f(e.restRequired) + "." :
        "No rest owing right now. Next rest block due in " + f(e.untilRest) + ".")), w("bfmMeta",
        a.module + " · " + a.tiers.length +
        "-tier Standard BFM table · warn threshold " + a.warnBefore + " min"), w("bfmSource", a
        .source), w("panelBfmModule", a.module);
    var c = u("#tripBfmHero");
    c && (c.className = "bfm__hero bfm-" + e.status), w("tripBfmState", t), w("tripBfmStateSub", r),
      w("tripBfmCountdown", e.untilRest > 0 ? f(e.untilRest) : f(e.restRequired)), w("tripBfmSrc", a
        .source), A("tripBfmRules", e);
    var l = u("#tripBfmRest");
    l && (l.className = "bfm__rest " + e.status, w("tripBfmRestText", e.restRequired ? e
        .restReason + " Required rest: " + f(e.restRequired) + "." :
        "No rest owing right now. Next rest block due in " + f(e.untilRest) + ".")), w("tripBfm", t
        .toUpperCase()), w("tripBfmSub", e.untilRest > 0 ? "Rest due in " + f(e.untilRest) :
        "Rest " + f(e.restRequired) + " required"), w("kpiDuty", f(o.workedMins)), w("kpiDutySub",
        f(Math.max(0, e.shiftLeft)) + " left"), w("tripDriving", f(o.workedMins));
    /* Fire the "rest required" alert once per tier per breach — re-armed
       automatically once that tier is reset by a qualifying rest (see
       resolveRestOnResume()). Each newly-breached tier also opens/updates
       its BFM_Monitoring history row via persistBfmTierEvent(). */
    return e.breachedTiers.forEach(function(tier) {
      if (!o.tierNotified[tier.index]) {
        o.tierNotified[tier.index] = !0;
        var msg = tier.label + " work limit reached (" + f(tier.max) +
          ") — stop and take " + tier.restLabel + " before driving on.";
        pushBfmNotification("red", msg), persistBfmTierEvent(tier.index, "Limit reached", 0, 0,
          msg);
        var toast = document.createElement("div");
        toast.className = "rest-alert", toast.setAttribute("role", "alert"), toast.innerHTML =
          '<svg width="20" height="20" style="flex:none;color:#D3352B;margin-top:1px"><use href="#i-alert"/></svg><div style=\'flex:1\'><b>Rest required — ' +
          tier.label + '</b><p>' + msg +
          '</p></div><button class="xbtn" aria-label="Dismiss">✕</button>', toast.querySelector(
            "button").addEventListener("click", function() {
            toast.remove()
          }), document.body.appendChild(toast), setTimeout(function() {
            toast.parentNode && toast.remove()
          }, 15e3)
      }
    }), e
  }
  setTimeout(E, T);

  var N = null;

  function O() {
    try {
      var e = (N = N || new(window.AudioContext || window.webkitAudioContext)).currentTime;
      [880, 660].forEach(function(t, r) {
        var n = N.createOscillator(),
          i = N.createGain();
        n.type = "sine", n.frequency.setValueAtTime(t, e + .16 * r), i.gain.setValueAtTime(1e-4,
            e + .16 * r), i.gain.exponentialRampToValueAtTime(.22, e + .16 * r + .02), i.gain
          .exponentialRampToValueAtTime(1e-4, e + .16 * r + .15), n.connect(i).connect(N
            .destination), n.start(e + .16 * r), n.stop(e + .16 * r + .16)
      })
    } catch (e) {}
  }

  function M() {
    o.notificationCount += 1;
    var e = u("#bellDot"),
      t = u("#bellCount");
    t && (t.hidden = !1, t.textContent = o.notificationCount > 9 ? "9+" : String(o
      .notificationCount)), e && (e.hidden = !0)
  }

  function F() {
    o.notificationCount = 0;
    var e = u("#bellCount");
    e && (e.hidden = !0)
  }
  var Lr = [];

  function pushBfmNotification(tone, text) {
    Lr.unshift({
      tone: tone,
      text: text,
      ts: new Date
    }), M(), "red" === tone && O(), ir()
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
    var breachedRestMins = [];
    a.tiers.forEach(function(tier, i) {
      o.tierWorked[i] >= tier.maxWorkMins && breachedRestMins.push(tier.restMins)
    });
    return breachedRestMins.length ? Math.max.apply(null, breachedRestMins) : a.tiers[0]
      .restMins
  }

  function sendRestCompleteEmail(message) {
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA || !ZOHO.CREATOR.DATA.invokeCustomApi)
      return console.warn(gr,
        "ZOHO.CREATOR.DATA.invokeCustomApi is unavailable — the rest-complete email was not sent. A browser widget cannot send email directly; it must call a Zoho Creator Custom API whose Deluge script runs a sendmail task."
        ), Promise.resolve();
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
        message: message
      }
    }).catch(function(err) {
      console.error(gr, "Rest-complete email Custom API call failed:", err)
    })
  }

  function notifyRestComplete() {
    var msg = "Start Driving — Your Rest Time Is Finished.";
    clearRestWarnTimer(), bfmLogAdd("Rest complete", "BFM", msg, 0, "green"),
      pushBfmNotification("green", msg), sendRestCompleteEmail(msg)
  }

  function todayAt(h, m) {
    var d = new Date;
    return d.setHours(h, m, 0, 0), d
  }

  function relTime(ts) {
    var mins = Math.round((Date.now() - ts.getTime()) / 6e4);
    if (mins < 1) return "Just now";
    if (mins < 60) return mins + " min ago";
    var hrs = Math.round(mins / 60);
    return hrs < 24 ? hrs + "h ago" : p(ts.getDate()) + "/" + p(ts.getMonth() + 1) + " " + p(ts
      .getHours()) + ":" + p(ts.getMinutes())
  }

  /* ---------- NEW: BFM activity/history logger ----------
     Writes one row per tier event (limit reached, insufficient rest,
     rest satisfied, continuing overage) to Driver_BFM_Notification,
     keyed by Trip_ID + Driver_ID + Date_field so history stays attached
     to the trip/driver and survives the trip spanning multiple days. */
  async function persistBfmTierEvent(tierIndex, eventType, minutes, scoreDelta, message) {
    bfmLogAdd(eventType, a.tiers[tierIndex] ? a.tiers[tierIndex].label : "BFM", message, scoreDelta,
      "Rest completed" === eventType || "Day rollover" === eventType ? "green" :
      "Overage" === eventType || "Insufficient rest" === eventType || "Limit reached" ===
      eventType ? "red" : "amber");
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA) return;
    try {
      var tier = a.tiers[tierIndex],
        empId = await resolveEmployeeFormId(),
        nowD = new Date,
        payload = {
          Trip_ID: cr2(K.tripRecordId || K.tripId || ""),
          Trip_Name: cr2(K.tripRecordId || K.tripId || ""),
          Driver_ID: cr2(empId || K.driverRecordId || K.driverEmployeeRecordId || s.recordId ||
            ""),
          Driver_Name: cr2(empId || K.driverRecordId || K.driverEmployeeRecordId || s
            .recordId || ""),
          Date_field: p(nowD.getDate()) + "-" + h[nowD.getMonth()] + "-" + nowD.getFullYear(),
          Start_Time: b(p(nowD.getHours()) + ":" + p(nowD.getMinutes())),
          Break_Hours: +(minutes / 60).toFixed(2),
          Notification: "[" + (tier ? tier.label : "BFM") + " · " + eventType + "] " + message +
            (scoreDelta ? " (score " + (scoreDelta > 0 ? "-" : "+") + Math.abs(scoreDelta) +
              ")" : "")
        };
      await ZOHO.CREATOR.DATA.addRecords({
        form_name: "Driver_BFM_Notification",
        payload: {
          data: payload
        }
      })
    } catch (err) {
      console.error(gr, "persistBfmTierEvent failed:", err)
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
    var restMinsTaken = o.breakElapsedMins;
    bfmLogAdd("Break ended", "BFM", "Break ended after " + f(restMinsTaken) + " of rest.", 0,
      "green");
    a.tiers.forEach(function(tier, i) {
      var wasBreached = o.tierWorked[i] >= tier.maxWorkMins;
      if (restMinsTaken >= tier.restMins) {
        var hadWork = o.tierWorked[i] > 0;
        o.tierWorked[i] = 0, o.tierExtraMins[i] = 0, o.tierNotified[i] = !1, wasBreached &&
          hadWork && persistBfmTierEvent(i, "Rest completed", restMinsTaken, 0, tier.label +
            " satisfied — " + f(restMinsTaken) + " rest logged (required " + tier.restLabel +
            ").")
      } else if (wasBreached) {
        var shortfallMins = tier.restMins - restMinsTaken;
        scoreAdd("fatigue", a.scorePerShortRest, tier.label + ": rest short by " + f(shortfallMins) +
          " (" + tier.restLabel + " required)"), pushBfmNotification("red",
          tier.label +
          ": rest taken was short by " + f(shortfallMins) +
          " — driver score reduced by " + a.scorePerShortRest + "."), persistBfmTierEvent(i,
          "Insufficient rest", restMinsTaken, a.scorePerShortRest, tier.label +
          " required " + tier.restLabel + " but only " + f(restMinsTaken) +
          " was taken (short by " + f(shortfallMins) + ").")
      }
    }), o.breakElapsedMins = 0
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
    return p(d.getDate()) + "-" + h[d.getMonth()] + "-" + d.getFullYear()
  }

  async function rolloverBfmDay() {
    await persistBfmOnPause();
    var newDayKey = bfmDateKey(new Date()),
      msg = "New day (" + newDayKey +
      ") started for this trip — BFM work and rest limits have reset and monitoring continues.";
    o.tierWorked = [0, 0, 0, 0, 0], o.tierExtraMins = [0, 0, 0, 0, 0], o.tierNotified = [!1, !1, !1, !1,
      !1
    ], o.bfmDayKey = newDayKey, pushBfmNotification("green", msg), persistBfmTierEvent(null,
      "Day rollover", 0, 0, msg), await openBfmDayRecord()
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
      var todayKey = bfmDateKey(new Date());
      if (o.bfmDayKey && o.bfmDayKey !== todayKey) return void rolloverBfmDay().then(function() {
        P(), ir()
      });
      if (o.onBreak) {
        o.breakElapsedMins += 1;
        maybeNotifyRestEnding();
        var restTarget = o.restTargetMins || a.tiers[0].restMins;
        !o.restCompleteNotified && o.breakElapsedMins >= restTarget && (o.restCompleteNotified =
          !0, notifyRestComplete())
      } else {
        a.tiers.forEach(function(tier, i) {
          o.tierWorked[i] += 1;
          if (o.tierWorked[i] > tier.maxWorkMins) {
            o.tierExtraMins[i] += 1;
            if (0 === o.tierExtraMins[i] % a.overageBlockMins) {
              scoreAdd("fatigue", a.scorePerOverageBlock, tier.label + ": " + f(o
                .tierExtraMins[i]) + " driven past the limit");
              var msg = tier.label + ": " + f(o.tierExtraMins[i]) +
                " driven past the limit with no qualifying rest — score reduced by " + a
                .scorePerOverageBlock + ".";
              pushBfmNotification("red", msg), persistBfmTierEvent(i, "Overage", o
                .tierExtraMins[i], a.scorePerOverageBlock, msg)
            }
          }
        }), o.weekWorkedMins += 1
      }
    }
    o.tripStarted && saveTripSnapshot(), P(), ir()
  }

  function B(e) {
    var t = "number" == typeof e ? e : o.startTs || 0,
      r = t ? Math.max(0, Math.floor((Date.now() - t) / 6e4)) : null;
    if (null === r) {
      var n = _(e);
      if (null === n) return;
      var i = new Date;
      r = 60 * i.getHours() + i.getMinutes() - n, r < 0 && (r += 1440)
    }
    o.tierWorked = a.tiers.map(function() {
      return r
    }), o.weekWorkedMins += r, o.restAlertShown = !1, o.restEscalated = !1, F(), P(), ir()
  }

  function H() {
    o.restAlertShown = !1, o.restEscalated = !1
  }
  var V = null;

  function q() {
    if (o.tripStarted && o.startTs) {
      var e = Math.max(0, Math.floor((Date.now() - o.startTs) / 1e3));
      w("tripTimerVal", p(Math.floor(e / 3600)) + ":" + p(Math.floor(e % 3600 / 60)) + ":" + p(e %
        60))
    }
  }

  function W() {
    V || (q(), V = setInterval(q, 1e3))
  }

  function tripSnapshotKey() {
    return K && K.tripRecordId && s.recordId ? "skyway.trip." + K.tripRecordId + "." + s.recordId : ""
  }

  function saveTripSnapshot() {
    if (!o.tripStarted) return;
    var e = tripSnapshotKey();
    if (!e) return;
    try {
      localStorage.setItem(e, JSON.stringify({
        startTs: o.startTs,
        onBreak: o.onBreak,
        breakStartTs: o.onBreak ? o.breakStartTs || Date.now() - 6e4 * (o.breakElapsedMins || 0) : 0,
        restWarnNotified: !!o.restWarnNotified,
        breakElapsedMins: o.breakElapsedMins || 0,
        restTargetMins: o.restTargetMins || 0,
        restCompleteNotified: !!o.restCompleteNotified,
        tierWorked: o.tierWorked || [],
        tierExtraMins: o.tierExtraMins || [],
        tierNotified: o.tierNotified || [],
        breakCount: o.breakCount || 0,
        weekWorkedMins: o.weekWorkedMins || 0,
        score: s.score,
        savedAt: Date.now()
      }))
    } catch (e) {
      console.warn(gr, "trip snapshot could not be saved:", e)
    }
  }

  function readTripSnapshot() {
    var e = tripSnapshotKey();
    if (!e) return null;
    try {
      var t = JSON.parse(localStorage.getItem(e) || "null");
      return t && t.startTs && t.savedAt ? t : null
    } catch (e) {
      return console.warn(gr, "trip snapshot could not be read:", e), null
    }
  }

  function clearTripSnapshot() {
    var e = tripSnapshotKey();
    if (!e) return;
    try {
      localStorage.removeItem(e)
    } catch (e) {
      console.warn(gr, "trip snapshot could not be cleared:", e)
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
      num = function(v) {
        return Math.max(0, Number(v) || 0)
      },
      fresh = [];
    o.onBreak = !!e.onBreak, o.breakElapsedMins = num(e.breakElapsedMins), o.restTargetMins = num(e
        .restTargetMins), o.restCompleteNotified = !!e.restCompleteNotified, o.tierWorked = a.tiers
      .map(function(t, i) {
        return num(e.tierWorked && e.tierWorked[i])
      }), o.tierExtraMins = a.tiers.map(function(t, i) {
        return num(e.tierExtraMins && e.tierExtraMins[i])
      }), o.tierNotified = a.tiers.map(function(t, i) {
        return !!(e.tierNotified && e.tierNotified[i])
      }), o.breakCount = num(e.breakCount), o.weekWorkedMins = num(e.weekWorkedMins), o
      .restWarnNotified = !!e.restWarnNotified, o.breakStartTs = o.onBreak ? Number(e
        .breakStartTs) || Date.now() - 6e4 * num(e.breakElapsedMins) : 0;
    /* Still on break: the break kept running while the widget was closed. */
    if (o.onBreak) o.breakElapsedMins += gap, o.restTargetMins && o.breakElapsedMins >= o
      .restTargetMins && (o.restCompleteNotified = !0);
    else o.tierWorked = o.tierWorked.map(function(v) {
      return Math.min(cap, v + gap)
    }), o.weekWorkedMins += gap;
    /* Breaches that happened (or were already alerted) before this restore
       must never raise alerts or Creator rows again: mark them notified
       BEFORE the first P() runs. tierExtraMins is deliberately left alone,
       so overage penalties only accrue for minutes counted live from now
       on, not for time that passed while the widget was closed. */
    armRestWarnTimer();
    a.tiers.forEach(function(tier, i) {
      o.tierWorked[i] >= tier.maxWorkMins && (o.tierNotified[i] || fresh.push(tier.label), o
        .tierNotified[i] = !0)
    }), console.log(gr, "restore: BFM snapshot applied; fast-forwarded", gap, "min", o.onBreak ?
      "(on break)" : "");
    return fresh
  }
  var U = !1;

  function Z() {
    var e = u("#btnStopTimer"),
      t = u("#btnContinueDriving");
    e && (e.hidden = !!o.onBreak), t && (t.hidden = !o.onBreak)
  }

  /* ---------- NEW: time-field helpers ----------
     Zoho `time` fields come back as "HH:MM:SS" strings, not numbers. */
  function timeStrToMins(t) {
    if (!t) return 0;
    var parts = String(t).split(":");
    var hh = Number(parts[0]) || 0,
      mm = Number(parts[1]) || 0,
      ss = Number(parts[2]) || 0;
    return hh * 60 + mm + ss / 60
  }

  function minsToTimeStr(mins) {
    mins = Math.max(0, Math.round(mins));
    var hh = Math.floor(mins / 60),
      mm = mins % 60;
    return p(hh) + ":" + p(mm) + ":00"
  }

  /* Tracks the current local work period (in-memory only — the
     BFM_Monitoring form/report no longer exists in this Zoho Creator
     app, so none of this is persisted server-side). */
  var ACTIVE_BFM_RECORD = {
    id: null,
    workMins: 0,
    maxMins: null
  };

  /* ---------- closes out the open work period on pause/stop ---------- */
  async function persistBfmOnPause() {
    /* BFM_Monitoring form no longer exists in this Zoho Creator app, so
       this only updates the local work-period counters used elsewhere
       in the fatigue-monitoring UI; nothing is persisted to Zoho. */
    var maxMins = ACTIVE_BFM_RECORD.maxMins || a.maxWorkPerShift,
      workMins = o.workedMins;
    ACTIVE_BFM_RECORD.workMins = workMins, ACTIVE_BFM_RECORD.maxMins = maxMins
  }

  /* ---------- NEW: opens a fresh work period on resume ----------
     The just-closed period already has its End_Time saved by
     persistBfmOnPause(); this starts the next one. Also resolves the
     rest just taken against every tier's own requirement (see
     resolveRestOnResume() above) before the new period opens. */
  async function persistBfmOnResume() {
    resolveRestOnResume(), await openBfmDayRecord()
  }

  /* ---------- opens a fresh local work period for "today" ----------
     Shared by persistBfmOnResume() (after resolving whatever rest was
     just taken) and rolloverBfmDay() (after a plain midnight rollover,
     where there's no rest to resolve — the driver may still be mid-shift
     when the day turns over). Local-only; nothing is persisted to
     Zoho. */
  async function openBfmDayRecord() {
    ACTIVE_BFM_RECORD.id = null, ACTIVE_BFM_RECORD.workMins = 0, ACTIVE_BFM_RECORD.maxMins = a
      .maxWorkPerShift
  }

  function G() {
    o.tripStarted && (o.onBreak = !0, o.breakElapsedMins = 0, o.restTargetMins =
      computeRestTargetMins(), o.restCompleteNotified = !1, o.restWarnNotified = !1, o
      .breakStartTs = Date.now(), armRestWarnTimer(), bfmLogAdd("Break started", "BFM",
        "Break started \u2014 required rest: " + f(o.restTargetMins) + ".", 0, "amber"), W(), Z(),
      persistBfmOnPause(), saveTripSnapshot(), saveBfmSummary())
  }

  function j() {
    o.tripStarted && (o.onBreak = !1, clearRestWarnTimer(), o.breakStartTs = 0, W(), Z(),
      "trip" !== o.view && Y("trip"),
      persistBfmOnResume(), saveTripSnapshot(), P(), ir())
  }

  window.addEventListener("popstate", function() {
    if (o.tripStarted) {
      R("Complete your trip before leaving this workflow.");
      try {
        history.pushState({
          skywayTripGuard: !0
        }, "")
      } catch (e) {}
    }
  });
  var z = ["trip", "checkin", "pod", "fuel", "incident", "vehicleissue", "expense", "break",
    "tripfeedback", "documents", "dispatch", "podbooking", "podresult"
  ];

  function Y(e) {
    var t;
    o.tripStarted && -1 === z.indexOf(e) ? R("Complete your trip before leaving this workflow.") : (
      tr(), o.view = e, ["Dash", "Vcheck", "StartTrip", "Chktyres", "Chkbattery", "Chkfuel",
        "Chkgps", "Chkhealth", "Trip", "CheckIn", "Pod", "Fuel", "Incident", "VehicleIssue",
        "Expense", "Break", "TripFeedback", "Documents", "Dispatch", "PodBooking", "PodResult"
      ].forEach(function(t) {
        var r = document.getElementById("view" + t);
        r && (r.hidden = t.toLowerCase() !== e)
      }), window.scrollTo({
        top: 0,
        behavior: "smooth"
      }), "trip" === e && (! function() {
        var e = u("#ringV"),
          t = u("#ringPct");
        if (!e) return;
        var r = 67,
          n = 2 * Math.PI * 50;
        e.style.strokeDashoffset = n, setTimeout(function() {
          e.style.strokeDashoffset = n * (1 - r / 100)
        }, 200);
        var i = 0,
          a = setInterval(function() {
            (i += 2) >= r && (i = r, clearInterval(a)), t.textContent = i + "%"
          }, 22)
      }(), o.tripStarted && !o.onBreak && W(), Z(), ee()), "starttrip" === e &&
      prefillStartTripPage(), "checkin" === e && function() {
        w("inCheckDate", "");
        var e = u("#inCheckDate");
        e && (e.value = k());
        u("#inHub") && c.hub && (u("#inHub").value = c.hub);
        if (u("#inCheckInTime") && !u("#inCheckInTime").value) {
          var t = new Date;
          u("#inCheckInTime").value = p(t.getHours()) + ":" + p(t.getMinutes())
        }
        /* Refresh the hub dropdown every time this page is opened, so a
           trip that finished loading after boot still fills it. */
        Dr().catch(function(err) {
          console.error(gr, "Dr() (Hub Name dropdown) failed:", err)
        }), BOOKING_ID_OPTIONS.length ? renderBookingIdChecklist() : Fr().catch(function(err) {
          console.error(gr, "Fr() (Booking ID checklist) failed:", err)
        }), updateBookingIdChip(), updateHubItemCount(u("#inHub") && u("#inHub").value || "")
      }(), "pod" === e && function() {
        var hub = c.hub || u("#inHub").value;
        if (updateBookingIdChip(), w("podHubTitle", hub ? "POD — " + hub : "POD — no hub selected"),
          w("podHubDate", c
            .date || k()), !hub) {
          var host = u("#podItemList");
          return void(host && (host.innerHTML =
            '<li class="pod-item pod-item--empty">No hub selected. Go back and check in to a hub first.</li>'
            ))
        }
        loadPodItemsForHub(hub)
      }(), "dispatch" === e && populateDispatchBookingDropdown(),
      "podbooking" === e && loadPodItemsForDispatchBooking(),
      setTimeout(initPodSignaturePad, 30), setTimeout(initPodResultSignaturePad, 30), "vcheck" !== e && 0 !== e.indexOf("chk") || Ne(),
      "chktyres" === e && function() {
        try {
          if (!("speechSynthesis" in window)) return;
          var e = window.speechSynthesis;

          function t() {
            var t = new SpeechSynthesisUtterance($e),
              r = function(e) {
                if (!e || !e.length) return null;
                for (var t = 0; t < rt.length; t++) {
                  var r = e.filter(function(e) {
                    return rt[t].test(e.name)
                  });
                  if (r.length) return r[0]
                }
                var n = e.filter(function(e) {
                  return /female/i.test(e.name) || /female/i.test(e.voiceURI || "")
                });
                return n.length ? n[0] : e.filter(function(e) {
                  return /^en/i.test(e.lang)
                })[0] || e[0]
              }(et);
            r && (t.voice = r), t.rate = .92, t.pitch = 1.12, t.volume = 1, e.cancel(), e.speak(t)
          }(et = e.getVoices()) && et.length || tt ? t() : e.addEventListener("voiceschanged",
            function r() {
              e.removeEventListener("voiceschanged", r), et = e.getVoices(), t()
            }), tt = !0
        } catch (r) {}
      }(), "trip" === e ? (loadTripMapOSM(), rebuildHubPipelineFromBooking()) : void 0,
      "fuel" === e ? function() {
        var e = u("#inFuelCountry");
        e && !e.value && (e.value = "Australia");
        var t = u("#inFuelTripId");
        t && (t.value = K.tripId || X || "");
        St(),
          function() {
            It(), Ct && clearInterval(Ct);
            Ct = setInterval(It, 1e3)
          }()
      }() : Ct && (clearInterval(Ct), Ct = null), "incident" === e && function() {
        var e = u("#inIncDate");
        e && !e.value && (e.value = Nt());
        var t = u("#inIncTime");
        t && !t.value && (t.value = Ot())
      }(), "vehicleissue" === e && ((t = u("#inVehWhen")) && !t.value && (t.value = Nt() + "T" +
        Ot())), "expense" === e && function() {
        var e = u("#inExpDate");
        e && !e.value && (e.value = Nt());
        var tripEl = u("#inExpTripId");
        tripEl && (tripEl.value = K.tripId || X || "—");
        var vehEl = u("#inExpVehicleName");
        vehEl && (vehEl.value = K.vehicleName || "—"), Xr().catch(function(err) {
          console.error(gr, "Xr() (Expense Type dropdown) failed:", err)
        })
      }(), "break" === e && function() {
        var e = u("#inBrkDate");
        e && (e.value = k());
        var t = u("#inBrkStart");
        t && !t.value && (t.value = Ot());
        var r = u("#inBrkTripName");
        r && (r.value = K.tripName || K.tripId || X || "");
        var n = u("#inBrkTripId");
        n && (n.value = K.tripId || X || "");
        zt(), br2()
      }(), "tripfeedback" === e && function() {
        var e = u("#inTfbTripId");
        e && (e.value = K.tripId || X || "");
        var t = u("#inTfbTripName");
        t && (t.value = K.tripName || K.tripId || X || "")
      }(), "documents" === e && hr(), rr())
  }
  var Q = [{
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
        ["POD", "Signed 09:52"]
      ]
    }, {
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
        ["POD", "Signed 11:14"]
      ]
    }, {
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
        ["POD", "Signed 12:06"]
      ]
    }, {
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
        ["Window", "2:00 – 3:00 PM"]
      ]
    }, {
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
        ["Window", "3:00 – 4:00 PM"]
      ]
    }, {
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
        ["Window", "3:45 – 4:30 PM"]
      ]
    }, {
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
        ["Window", "4:15 – 5:00 PM"]
      ]
    }],
    J = Q.findIndex(function(e) {
      return "next" === e.status
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
      record: null
    };

  function $(e) {
    e && (K.tripRecordId = e.ID || e.id || null, K.tripId = le(e, "tripId") || "", K.tripName = le(
        e, "tripName") || "", K.vehicleRecordId = de(e, "vehicle") || null, K.vehicleName = le(e,
        "vehicle") || "", K.driverRecordId = de(e, "primaryDriver") || de(e, "driver") || null, K
      .driverEmployeeRecordId = s.recordId || null, K.driverId = s.id || "", K.driverName = s
      .name || "", K.record = e, K.tripId && (X = K.tripId), o.breakCount = 0, br2(), console.log(
        gr, "driverRecordId resolved to:", K.driverRecordId, "| driverEmployeeRecordId:", K
        .driverEmployeeRecordId,
        "| driverId (business, e.g. 'DR-101' — never send this into a lookup field):", K.driverId
        ), console.log(gr, "Active trip set:", K), console.log(gr,
        "[booking-debug] raw Booking_ID field on this Trip record:", e.Booking_ID), ee(),
      updateBookingIdChip(),
      /* A new trip means a new booking: drop the cached hub set before
         rebuilding the dropdown, or the previous trip's hubs would be
         reused. */
      resetTripHubCache(), resetBookingIdSelection(), Dr().catch(function(err) {
        console.error(gr, "Dr() (Hub Name dropdown, trip/booking filtered) failed:", err)
      }), Fr().catch(function(err) {
        console.error(gr, "Fr() (Booking ID checklist) failed:", err)
      }), rebuildHubPipelineFromBooking().catch(function(err) {
        console.error(gr, "rebuildHubPipelineFromBooking() failed:", err)
      }), tripMapState.loadedForTrip = null,
      /* POD Completion KPI (Trip details card) — a new/changed trip means
         a new booking list, so recount for it. */
      refreshPodCompletionKpi())
  }

  function ee() {
    var e = K.record;
    if (e) {
      var t = le(e, "tripId") || "—",
        r = tripRoute(e);
      w("atdHeaderTripId", t), w("atdHeaderRoute", r), w("atdTripId", t), w("atdRoutePill", r), w(
          "atdTripName", le(e, "tripName") || "—"), w("atdTripType", le(e, "tripType") || "—"), w(
          "atdTripStatus", le(e, "status") || "—"), w("atdRoute", r), w("atdBookingDate", le(e,
          "bookingDate") || "—"), w("atdPlannedDelivery", le(e, "plannedDelivery") || "—"), w(
          "atdDeliveryMode", le(e, "deliveryMode") || "—"), w("atdVehicle", le(e, "vehicle") ||
        "—"), w("atdVehicleCapacity", le(e, "vehicleCapacity") || "—"), w("atdSupervisor", le(e,
          "supervisor") || "—"), w("atdPrimaryDriver", le(e, "primaryDriver") || "—"), w(
          "atdSecondaryDriver", le(e, "secondaryDriver") || "—"), w("atdPickupLocation", le(e,
          "pickupLocation") || le(e, "fromLocation") || "—"), w("atdDeliveryLocation", le(e,
          "deliveryLocation") || le(e, "toLocation") || "—"), w("atdQuantity", le(e, "quantity") ||
          "—"), w("atdWeight", le(e, "weight") || "—"), w("atdTrackingNumber", le(e,
          "trackingNumber") || "—"), w("atdFromLocation", le(e, "fromLocation") || "—"), w(
          "atdStartDateTime", le(e, "startDateTime") || "—"), w("atdEstimatedDistance", le(e,
          "estimatedDistance") || "—"), w("atdTotalLoadedWeight", le(e, "totalLoadedWeight") ||
        "—"), w("atdTripCompletion", le(e, "tripCompletion") || "—"), w("atdToLocation", le(e,
          "toLocation") || "—"), w("atdTripDuration", le(e, "tripDuration") || "—"),
        /* Mirrors of the 6 fields shown on the trimmed "Trip details" card,
           duplicated under "tfd*" ids so the "View more" popup
           (#panelTripDetailsFull) can show the complete set without id
           collisions with the card. */
        w("tfdTripName", le(e, "tripName") || "—"), w("tfdTripType", le(e, "tripType") || "—"), w(
          "tfdTripStatus", le(e, "status") || "—"), w("tfdRoute", r), w("tfdPickupLocation", le(e,
          "pickupLocation") || le(e, "fromLocation") || "—"), w("tfdDeliveryLocation", le(e,
          "deliveryLocation") || le(e, "toLocation") || "—")
    }
  }
  var te = [{
      id: "TR-1046",
      route: "Eastern Creek → Goulburn",
      window: "04:10 – 05:55",
      stops: 3,
      status: "Completed"
    }, {
      id: "TR-1047",
      route: "Goulburn → Gundagai",
      window: "06:00 – 06:25",
      stops: 2,
      status: "Completed"
    }, {
      id: "TR-1048",
      route: "Sydney → Melbourne",
      window: "06:30 – 16:35",
      stops: 12,
      status: "Active"
    }, {
      id: "TR-1051",
      route: "Tullamarine → Laverton",
      window: "17:20 – 18:40",
      stops: 2,
      status: "Scheduled"
    }],
    re = {
      attended: 0,
      cancelled: 0,
      get total() {
        return this.attended + this.cancelled
      }
    };

  function ne(e) {
    return {
      done: "Delivered",
      current: "Current",
      next: "Next",
      upcoming: "Upcoming"
    } [e] || e
  }

  function ie() {
    var e = u("#hubDetail");
    if (e) {
      var t = Q.filter(function(e) {
          return "current" === e.status
        })[0] || Q[0],
        r = Q.filter(function(e) {
          return "next" === e.status
        })[0] || Q[Q.length - 1];
      w("hubCurrentName", t.name), w("hubCurrentMeta", "Departed " + t.eta + " · Stop #" + t.no), w(
        "hubNextName", r.name), w("hubNextMeta", r.distance + " · ETA " + r.eta);
      var n = u("#hubPipeline"),
        pipelineSig = Q.map(function(e) {
          return e.name
        }).join("|");
      if (n && n.getAttribute("data-sig") !== pipelineSig && (n.setAttribute("data-sig",
          pipelineSig), n.innerHTML = "", Q.forEach(function(e, t) {
          var r = document.createElement("button");
          r.type = "button", r.className = "hubpipe__node is-" + e.status, r.setAttribute(
              "role", "tab"), r.setAttribute("aria-label", "Stop " + e.no + " · " + e.name), r
            .innerHTML =
            '<span class="hubpipe__dot" aria-hidden="true"></span><span class="hubpipe__label">' +
            e.name + "</span>", r.addEventListener("click", function() {
              J = t, ie()
            }), n.appendChild(r)
        })), n) {
        m(".hubpipe__node", n).forEach(function(e, t) {
          e.classList.toggle("is-active", t === J), e.setAttribute("aria-selected", t === J ?
            "true" : "false")
        });
        var i = n.children[J];
        i && i.scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest"
        })
      }
      var a = Q[J];
      w("hubIndexLabel", "Stop " + a.no), w("hubTotal", String(Q.length)), w("hubBadge", "Stop #" +
        a.no),
        w("hubName", a.name), w("hubLocation", a.location), w("hubEta", a.eta);
      var o = u("#hubStatus");
      o && (o.textContent = ne(a.status), o.className = "hubstatus is-" + a.status), e.classList
        .remove("is-swap"), e.offsetWidth, e.classList.add("is-swap");
      var s = u("#hubPrev"),
        c = u("#hubNext");
      s && (s.disabled = 0 === J), c && (c.disabled = J === Q.length - 1), w("tripNextStopName",
        "Stop #" + r.no + " · " + r.name), updateStopsCompletedKpi()
    }
  }

  function ae(e) {
    J = Math.max(0, Math.min(Q.length - 1, J + e)), ie()
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
      if (e.innerHTML = "", trips.length) trips.forEach(function(trip) {
        e.appendChild(fe(trip))
      });
      else {
        var empty = document.createElement("li");
        empty.className = "triprow", empty.textContent =
          "No additional assigned trips.", e.appendChild(empty)
      }
    }
    /* "Today" is passed in separately because `trips` (the "other assigned
       trips" list) always excludes today's trip by design — filtering
       `trips` itself for "today" here would always yield 0, which is why
       the Today's Trip value never showed up in this popup before. */
    var todayCount = todayItem ? 1 : 0,
      upcomingCount = trips.length;
    w("tripsAssigned", String(total)), w("tripsDone", String(todayCount)), w("tripsLeft", String(
      upcomingCount)), w("tripsDriverName", s.name || "Driver"), w("tripsDateLabel", trips.length ?
      trips.length + (1 === trips.length ? " more trip" : " more trips") : "No more trips");
    var i = document.querySelector('[data-panel="panelTrips"] [data-fill]');
    i && i.setAttribute("data-fill", total ? Math.round(todayCount / total * 100) : 0)
  }
  var se = "Trip_Dispatch1",
    ce = {
      driverName: ["Driver_Name", "Primary_Driver"],
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
      assignedBookings: ["Booking_ID", "Assigned_Bookings", "Bookings", "Booking_IDs"],
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
      expectedDelivery: ["Expected_Delivery", "Expected_Delivery_Date", "Planned_Delivery_Date"],
      trackingNumber: ["Tracking_Number", "Tracking_No", "Tracking_ID"],
      tripCompletion: ["Trip_Completion_Date_Time"],
      actualDeparture: ["Actual_Departure_Date_Time"],
      startingOdometer: ["Starting_Odometer"],
      /* Added for the "Driver & recent trips" card's last-6-trips list. */
      endDateTime: ["Trip_Completion_Date_Time", "Trip_End_Date_Time", "End_Date_Time",
        "Actual_Delivery_Date_Time"
      ],
      workingHours: ["Total_Working_Hours", "Total_Work_Hours", "Working_Hours", "Trip_Duration",
        "Total_Hours"
      ],
      customerCompany: ["Customer", "Customer_Company", "Customer_Company_Name", "Company_Name"]
    };

  function le(e, t) {
    var r = sr(e, ce[t] || []);
    return Array.isArray(r) ? r.map(function(e) {
      return cr(e)
    }).filter(Boolean).join(", ") : cr(r)
  }

  function de(e, t) {
    var r, n = sr(e, ce[t] || []);
    return Array.isArray(n) && (n = n[0]), null == (r = n) ? "" : "string" == typeof r ||
      "number" == typeof r ? String(r) : r.ID || r.zc_id || r.id || ""
  }

  function tripRoute(e) {
    var t = le(e, "route");
    if (t) return t;
    var r = le(e, "fromLocation"),
      n = le(e, "toLocation");
    return r || n ? [r, n].filter(Boolean).join(" → ") : "—"
  }

  /* True while the driver already has a trip in progress (restored from
     Creator on boot, or started this session). Kept as a function on
     purpose: fe()/feCompact() shadow `o` with a local, so they can't read
     o.activeTripRecordId directly. */
  function hasActiveTrip() {
    return !!(o.tripStarted || o.activeTripRecordId)
  }

  /* Adjusts the "Start Trip" button of a trip row for an in-progress trip:
     the active trip's button becomes "Resume trip", every other trip's
     button is disabled (the click handler shows "Complete your active trip
     first"). */
  function tripStartControl(li, status) {
    var btn = li.querySelector("[data-start-trip]");
    if (!btn) return;
    if ("In Transit" === status) {
      btn.setAttribute("data-nav", "trip"), btn.removeAttribute("data-start-trip");
      var label = btn.querySelector("span");
      (label || btn).textContent = "Resume trip"
    } else hasActiveTrip() && (btn.setAttribute("aria-disabled", "true"), btn.style.opacity = ".5")
  }

  function ue(e, t) {
    return String(e || "").trim() === String(t || "").trim()
  }

  function me(e) {
    if (!e) return 0;
    var t = Date.parse(e);
    if (!isNaN(t)) return t;
    var r = String(e).match(/(\d{1,2})-(\w{3})-(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
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
        Dec: 11
      } [r[2]];
      if (void 0 !== n) {
        var i = new Date(+r[3], n, +r[1], +(r[4] || 0), +(r[5] || 0), +(r[6] || 0));
        if (!isNaN(i.getTime())) return i.getTime()
      }
    }
    return 0
  }

  function pe(e) {
    w("dashTripCountLabel", e || "No trips");
    var t = u("#dashTodayTripList");
    if (t) {
      t.innerHTML = "";
      var r = document.createElement("li");
      r.className = "triprow", r.textContent = e || "No assigned trips for today or upcoming.", t
        .appendChild(r)
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
      r = new Date;
    return t.getFullYear() === r.getFullYear() && t.getMonth() === r.getMonth() && t
      .getDate() === r.getDate()
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
    c = "In Transit" === s || c, tagLabel = "In Transit" === s ? "Active trip" : tagLabel;
    return n = tripRoute(e), l.className = "triprow " + ve(s), l.setAttribute("data-trip-id", t), l.innerHTML =
      '<div class="triprow__main"><span class="triprow__tag"></span><b class="triprow__id"></b><span class="triprow__route" data-name></span><span class="triprow__meta" data-route></span><span class="triprow__meta" data-locations></span><span class="triprow__meta" data-date></span></div><span class="triprow__status"></span><div class="triprow__actions">' +
      (c ?
        '<button type="button" class="triprow__view is-start" data-nav="vcheck" data-start-trip data-trip-id="' +
        t + '">Start Trip · ' + t + "</button>" : "") +
      '<button type="button" class="triprow__view" data-view-trip>View</button></div>',
      l.querySelector(".triprow__tag").textContent = tagLabel,
      l.querySelector(".triprow__id").textContent =
      t, l.querySelector("[data-name]").textContent = r, l.querySelector("[data-route]")
      .textContent = "Route: " + n, l.querySelector("[data-locations]").textContent = "From: " + i +
      "  ·  To: " + a, l.querySelector("[data-date]").textContent = "Start: " + o, l.querySelector(
        ".triprow__status").textContent = s, tripStartControl(l, s), l
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
    c = activeTrip || c, tagLabel = activeTrip ? "Active trip" : tagLabel;
    return l.className = "triprow triprow--compact trip-highlight", l.setAttribute(
        "data-trip-id", t), l.innerHTML =
      '<div class="trip-highlight__top"><span class="trip-highlight__tag"></span><div class="trip-highlight__actions">' +
      (c ?
        '<button type="button" class="trip-highlight__btn is-start" data-nav="vcheck" data-start-trip data-trip-id="' +
        t +
        '"><svg width="13" height="13" aria-hidden="true"><path d="M4 3l9 6-9 6V3z" fill="currentColor"/></svg><span>Start Trip · ' +
        t + "</span></button>" : "") +
      '<button type="button" class="trip-highlight__btn is-view" data-view-trip>View</button></div></div><div class="trip-highlight__body"><div class="trip-highlight__info"><b class="trip-highlight__id"></b><span class="trip-highlight__locations" data-locations></span><span class="trip-highlight__date"><svg width="13" height="13" aria-hidden="true"><use href="#i-calendar"/></svg><span data-date></span></span></div><svg class="trip-highlight__art" viewBox="0 0 140 80" aria-hidden="true" focusable="false"><path d="M12 62c22-6 38 2 58-8s40-18 58-4" fill="none" stroke="#9db8e6" stroke-width="2" stroke-dasharray="4 5"/><circle cx="14" cy="60" r="6" fill="#e8f0fe" stroke="#1E6FE8" stroke-width="2"/><circle cx="124" cy="52" r="6" fill="#e8f0fe" stroke="#1E6FE8" stroke-width="2"/></svg></div>',
      l.querySelector(".trip-highlight__tag").textContent = tagLabel,
      l.querySelector(".trip-highlight__id").textContent = t,
      l.querySelector("[data-locations]").innerHTML = '<svg width="12" height="12" aria-hidden="true"><use href="#i-pin"/></svg><b>From: ' +
      i +
      '</b> <svg width="11" height="11" aria-hidden="true"><use href="#i-arrow-right"/></svg> <svg width="12" height="12" aria-hidden="true"><use href="#i-pin"/></svg><b>To: ' +
      a + "</b>", l.querySelector("[data-date]").textContent = "Start: " + o, tripStartControl(l, activeTrip ?
        "In Transit" : ""), l
  }

  /* `act` = the driver's in-transit trips (ID-verified by ke()); omitted →
     fall back to every In Transit row in `e`. */
  function he(e, act) {
    var activeTrips = act || e.filter(function(e) {
      return "In Transit" === le(e, "status")
    }).slice().sort(function(e, t) {
      return me(le(t, "startDateTime")) - me(le(e, "startDateTime"))
    });
    o.activeTripRecordId = activeTrips.length ? activeTrips[0].ID || activeTrips[0].id || null : null;
    var t = e.filter(function(e) {
      return "Assigned" === le(e, "status") && function(e) {
        if (!e) return !1;
        var t = new Date;
        return t.setHours(0, 0, 0, 0), e >= t.getTime()
      }(me(le(e, "startDateTime")))
    }).slice().sort(function(e, t) {
      return me(le(e, "startDateTime")) - me(le(t, "startDateTime"))
    });
    t = activeTrips.concat(t), w("dashTripCountLabel", t.length ? t.length + (1 === t.length ? " trip" : " trips") :
      "No trips"), ge = t;
    var r = u("#startTopLabel");
    r && (r.textContent = t.length ? "Trip " + (le(t[0], "tripId") || "—") + " · ready" :
      "No trip assigned yet");
    activeTrips.length && r && (r.textContent = "Trip " + (le(activeTrips[0], "tripId") || "—") +
      " · in transit"), t.forEach(function(e) {
      ye[le(e, "tripId") || "—"] = e
    });
    var n = u("#dashTodayTripList"),
      todayItem = null,
      upcomingItem = null;
    if (t.length && (todayItem = activeTrips[0] || t.filter(function(e) {
        return isSameDay(me(le(e, "startDateTime")))
      })[0] || null, upcomingItem = t.filter(function(e) {
        return e !== todayItem
      })[0] || null), n)
      if (n.innerHTML = "", t.length) {
        [todayItem, upcomingItem].filter(Boolean).forEach(function(e) {
          n.appendChild(feCompact(e))
        })
      } else {
        var i = document.createElement("li");
        i.className = "triprow", i.textContent = "No assigned trips for today or upcoming.", n
          .appendChild(i)
      }
    var vm = u("#btnTodayTripViewMore");
    vm && (vm.hidden = t.length <= 2);
    /* The "View More" popup lists the driver's other assigned trips only
       — the two already shown on the main Today's trip card (today's
       trip and the next upcoming one) are excluded so nothing repeats. */
    oe(t.filter(function(e) {
      return e !== todayItem && e !== upcomingItem
    }), t.length, todayItem);
    return t
  }

  function ve(e) {
    var t = String(e || "").toLowerCase();
    return "completed" === t ? "is-completed" : "cancelled" === t ? "is-cancelled" : -1 !== [
      "dispatched", "in transit", "arrived"
    ].indexOf(t) ? "is-active" : "is-scheduled"
  }
  var ye = {},
    ge = [];

  function be(e, t, r) {
    var ATT_ALLOWED_STATUSES = ["Planned", "In Transit", "Cancelled", "Completed"];
    e = (e || []).filter(function(rec) {
      return -1 !== ATT_ALLOWED_STATUSES.indexOf(le(rec, "status"))
    });
    var n = e.filter(function(e) {
        return "Completed" === le(e, "status")
      }).length,
      i = e.filter(function(e) {
        return "Cancelled" === le(e, "status")
      }).length,
      a = e.length,
      o = a ? Math.round(n / a * 100) : 0;
    w("attDone", String(n)), w("attCancel", String(i)), w("attTotal", String(a)), w("attDone2",
      String(n)), w("attCancel2", String(i)), w("attTotal2", String(a)), w("attSub", o +
      "% attendance · all assigned trips"), w("tripAttMini", o + "%"), w("tripAttSub", n +
      " of " + a), w("dashAttDone", String(n)), w("dashAttCancel", String(i)), w("dashAttTotal",
      String(a)), w("dashAttSub", n + " of " + a), re.attended = n, re.cancelled = i, Te();
    var s = u("#panelAttendance");
    s && !s.hidden && De();
    var c = t || [],
      l = e.filter(function(e) {
        return "Assigned" !== le(e, "status") && -1 === c.indexOf(le(e, "tripId"))
      }).slice().sort(function(e, t) {
        return me(le(t, "startDateTime")) - me(le(e, "startDateTime"))
      });
    l.forEach(function(e) {
      var t = le(e, "tripId") || "—";
      ye[t] = e
    });
    var d3 = l.filter(function(e) {
      return "Completed" === le(e, "status")
    }).slice(0, 3);

    function buildTripRow(e) {
      var t = le(e, "tripId") || "—",
        r = le(e, "startDateTime") || "—",
        n = le(e, "status") || "—",
        i = document.createElement("li");
      return i.className = "triprow " + ve(n), i.setAttribute("data-trip-id", t),
        i.innerHTML =
        '<div class="triprow__main"><b class="triprow__id"></b><span class="triprow__meta"></span></div><span class="triprow__status"></span><button type="button" class="triprow__view" data-view-trip>View</button>',
        i.querySelector(".triprow__id").textContent = t, i.querySelector(
          ".triprow__meta").textContent = r, i.querySelector(".triprow__status")
        .textContent = n, i
    }

    function renderTripList(e, data, emptyMsg) {
      if (e) {
        if (e.innerHTML = "", !data.length) {
          var t = document.createElement("li");
          return t.className = "triprow", t.textContent = emptyMsg, void e.appendChild(t)
        }
        data.forEach(function(t) {
          e.appendChild(buildTripRow(t))
        })
      }
    }
    renderTripList(u("#dashAttList"), d3, "No completed trips yet."), renderTripList(u(
      "#attList"), l, r || "No other trips assigned to this driver.");
    renderLast6Trips(l)
  }

  /* ---------- "Driver & recent trips" card (right of Trip details) ----------
     Shows Driver Name/ID at the top and, below it, ONLY the last 6 trip
     records (most-recent-first — `l` above is already sorted that way) with
     exactly: Trip ID, Booking ID, Start Date, End Date, Total Working Hours,
     Customer Company Name. No other fields are added, per request. */
  function renderLast6Trips(allTrips) {
    var host = u("#last6TripsList");
    if (!host) return;
    var rows = (allTrips || []).slice(0, 6);
    if (!rows.length) return void(host.innerHTML =
      '<li class="trip6-empty">No trip records yet.</li>');
    host.innerHTML = "", rows.forEach(function(e) {
      var li = document.createElement("li");
      li.className = "trip6-item";
      li.innerHTML = '<div class="trip6-hd"><b class="trip6-id"></b><span class="trip6-bk"></span></div><dl class="trip6-grid"><div><dt>Start Date</dt><dd class="trip6-start"></dd></div><div><dt>End Date</dt><dd class="trip6-end"></dd></div><div><dt>Total Working Hours</dt><dd class="trip6-hrs"></dd></div><div><dt>Customer Company</dt><dd class="trip6-cust"></dd></div></dl>';
      li.querySelector(".trip6-id").textContent = le(e, "tripId") || "—";
      li.querySelector(".trip6-bk").textContent = le(e, "assignedBookings") || "—";
      li.querySelector(".trip6-start").textContent = le(e, "startDateTime") || "—";
      li.querySelector(".trip6-end").textContent = le(e, "endDateTime") || "—";
      li.querySelector(".trip6-hrs").textContent = le(e, "workingHours") || "—";
      li.querySelector(".trip6-cust").textContent = le(e, "customerCompany") || "—";
      host.appendChild(li)
    })
  }

  function _e(e, t) {
    var r = ce.driverName || [];
    if (t >= r.length) return kr({
      report_name: se,
      field_config: "all",
      max_records: 200
    }).then(function(e) {
      return e && e.data || []
    });
    var n = r[t];
    return kr({
      report_name: se,
      criteria: "(" + n + ' == "' + e.replace(/"/g, '\\"') + '")',
      field_config: "all",
      max_records: 200
    }).then(function(r) {
      var n = r && r.data || [];
      return n.length ? n : _e(e, t + 1)
    }).catch(function(r) {
      return console.warn(gr, "Trip criteria on", n, "failed, trying next:", r), _e(e, t + 1)
    })
  }

  function ke() {
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA) return ye = {}, pe(
      "Preview mode — not connected to Zoho Creator"), be([], [],
      "Preview mode — not connected to Zoho Creator."), Promise.resolve();
    if (!s.name || "Driver not found" === s.name) return ye = {}, pe("No matching driver found"),
      be([], [], "No matching driver found."), Promise.resolve();
    var e = s.name.trim();
    return _e(e, 0).then(function(t) {
      var r = t.filter(function(t) {
        return function(e, t) {
          return ue(le(e, "driverName"), t) || ue(le(e, "secondaryDriverName"), t)
        }(t, e)
      });
      /* The driver's in-transit trip(s): matched by the Primary/Secondary
         Driver lookup ID; the name match above is only the fallback for a
         trip whose driver IDs are missing. A trip finished in this session
         is never treated as active, even if Creator is slow to flip it. */
      var activeTrips = t.filter(function(e) {
        if ("In Transit" !== le(e, "status") || (e.ID || e.id) === o.completedTripRecordId) return !1;
        var t = de(e, "primaryDriver"),
          n = de(e, "secondaryDriverName");
        return s.recordId && (t || n) ? t === s.recordId || n === s.recordId : r.indexOf(e) > -1
      }).sort(function(e, t) {
        return me(le(t, "startDateTime")) - me(le(e, "startDateTime"))
      });
      activeTrips.forEach(function(e) {
        r.indexOf(e) < 0 && r.push(e)
      });
      if (console.log(gr, se, "exact Driver Name matches for", e, ":", r.length, "of", t
        .length, "| in-transit trips for this driver:", activeTrips.length), ye = {}, !r.length)
        return pe("No trip assigned"), void be([], [], "No trips assigned to this driver.");
      var displayedTrips = he(r, activeTrips);
      be(r, displayedTrips.map(function(e) {
        return le(e, "tripId")
      }));
      if (!activeTrips.length) return null;
      activeTrips.length > 1 && console.warn(gr, "multiple in-transit trips found; restoring the latest", activeTrips.map(function(e) {
        return le(e, "tripId")
      }));
      var activeId = activeTrips[0].ID || activeTrips[0].id;
      return o.tripStarted && K.tripRecordId === activeId ? (console.log(gr,
        "restore: trip already active in this session — nothing to restore"), null) : restoreActiveTrip(activeTrips[0]).then(function(resumed) {
        /* Already ended (every Start_Trip_in_Driver row has an End_Time): it
           must not show as an active trip on the Dashboard either. */
        resumed || (he(r, []), console.log(gr, "restore: stale In Transit trip ignored", le(activeTrips[0], "tripId")))
      })
    }).catch(function(e) {
      console.error(gr, "loadDriverTripsAndRender failed:", e), ye = {}, pe(
        "Couldn't load trip"), be([], [], "Couldn't load trips for this driver.")
    })
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
    var t = null == e ? "" : "object" == typeof e ? e.ID || e.id || e.zc_id || "" : String(e);
    /* Creator record IDs are long numeric strings; a plain display value
       ("SKY-EMP-006") is not an ID. */
    return /^\d{8,}$/.test(t) ? t : ""
  }

  function restoreLookupText(e) {
    return null == e ? "" : "string" == typeof e || "number" == typeof e ? String(e) : e.display_value || e
      .displayValue || e.url || e.value || ""
  }

  /* Is this Start_Trip_in_Driver / Log_a_break row the signed-in driver's? */
  function restoreIsMyRow(row) {
    var id = restoreLookupId(row.Driver_ID) || restoreLookupId(row.Driver_Name);
    return id ? id === s.recordId || id === Ut : ue(restoreLookupText(row.Driver_Name), s.name) || ue(
      restoreLookupText(row.Driver_ID), s.id)
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
    var attempts = ['(Trip_ID == "' + escapeCriteria(tripRecordId) + '")', "(Trip_ID == " +
      escapeCriteria(tripRecordId) + ")"
    ];
    tripLabel && attempts.push('(Trip_ID == "' + escapeCriteria(tripLabel) + '")');
    return function next(i, lastErr) {
      if (i >= attempts.length) {
        if (lastErr) throw lastErr;
        return Promise.resolve([])
      }
      console.log(gr, "restore: reading", report, "with criteria", attempts[i]);
      return kr({
        report_name: report,
        criteria: attempts[i],
        field_config: "all",
        max_records: 200
      }).then(function(res) {
        var rows = (res && res.data || []).filter(restoreIsMyRow);
        return rows.length ? rows : next(i + 1, lastErr)
      }, function(err) {
        /* Two-argument then: only kr()'s own rejection lands here, not an
           error from a deeper attempt. */
        var msg = "";
        try {
          msg = JSON.stringify(err)
        } catch (x) {
          msg = String(err)
        }
        console.warn(gr, "restore:", report, "criteria failed:", attempts[i], err);
        if (/2898|"status"\s*:\s*403|permission denied/i.test(msg)) throw err;
        return next(i + 1, err)
      })
    }(0, null)
  }

  /* Minutes of COMPLETED breaks. Computed from each row's Start_time and
     End_time, never Total_break_duration (its unit differs between the
     widget and the server workflows). */
  function completedBreakMinutes(rows) {
    return (rows || []).reduce(function(sum, row) {
      if (!row.Start_time || !row.End_time) return sum;
      var d = timeStrToMins(row.End_time) - timeStrToMins(row.Start_time);
      return sum + Math.round(d < 0 ? d + 1440 : d)
    }, 0)
  }

  /* Deferred until the boot loader has gone — R() toasts shown under it
     would expire unseen (the loader runs for a fixed 40 s). */
  function restoreToast(msg) {
    I ? R(msg) : o.pendingToast = o.pendingToast ? o.pendingToast + " " + msg : msg
  }

  /* No local snapshot (new device / storage cleared): rebuild the BFM
     counters from timestamps. Returns the labels of tiers already in
     breach so the caller can show ONE summary instead of per-tier alerts. */
  function rebuildBfmWithoutSnapshot(breakRows) {
    var elapsed = Math.max(0, Math.floor((Date.now() - o.startTs) / 6e4)),
      worked = Math.max(0, elapsed - completedBreakMinutes(breakRows)),
      fresh = [];
    o.onBreak = !1, o.breakElapsedMins = 0, o.restTargetMins = 0, o.restCompleteNotified = !1, o
      .tierWorked = a.tiers.map(function() {
        return worked
      }), o.tierExtraMins = a.tiers.map(function() {
        return 0
      }), o.tierNotified = a.tiers.map(function(tier) {
        return worked >= tier.maxWorkMins
      }), o.breakCount = breakRows ? breakRows.length : 0, o.weekWorkedMins += worked;
    a.tiers.forEach(function(tier) {
      worked >= tier.maxWorkMins && fresh.push(tier.label)
    });
    console.warn(gr, "restore: no local snapshot; rebuilt", worked, "worked minutes (", elapsed,
      "elapsed minus completed breaks) from", breakRows ? breakRows.length : "no", "break records");
    return fresh
  }

  /* Applies everything the restore knows onto `o`. Synchronous on purpose:
     nothing can run between "tripStarted" becoming true and the BFM
     counters being in place, so a bfmTick can't count on half-built state
     or overwrite the stored snapshot with it. Returns the labels of tiers
     that are in breach and were not already known to be. */
  function applyRestoredTrip(e, ts, startRow, snap, breakRows) {
    var startD = new Date(ts),
      endMins;
    o.startTs = ts, o.startTime = p(startD.getHours()) + ":" + p(startD.getMinutes()), endMins = (_(o
      .startTime) + a.maxWorkPerShift) % 1440, o.endTime = p(Math.floor(endMins / 60)) + ":" + p(
      endMins % 60), o.startTripRecordId = startRow && (startRow.ID || startRow.id) || null, o
      .startOdometer = startRow && Number(startRow.Starting_Odometer_Reading) || Number(le(e,
        "startingOdometer")) || 0, o.startLocation = startRow ? restoreLookupText(startRow
        .Live_Location) : "", o.startLocationUrl = startRow ? restoreLookupText(startRow
        .Live_Location_URL) : "", o.endLocation = le(e, "toLocation") || "", o.bfmDayKey =
      bfmDateKey(new Date), o.restAlertShown = !1, o.restEscalated = !1;
    var fresh = snap ? restoreBfmSnapshot(snap) : rebuildBfmWithoutSnapshot(breakRows);
    snap || restoreToast("Trip resumed. Break history may be incomplete."), o.restoredTrip = !0, o
      .tripStarted = !0;
    return fresh
  }

  /* Puts the restored trip on screen, the same way submitStartTripPage
     does after a successful start (minus every Creator write). */
  function showRestoredTrip(fresh) {
    w("tripStart", o.startTime), w("tripEnd", o.endTime), w("tripStartedAt", o.startTime), w(
      "tripWindow", o.startTime + " – " + o.endTime), w("tripStartLoc", o.startLocation), w(
      "kpiStatus", "IN TRANSIT");
    var stickyEl = u("#stickyStart");
    stickyEl && (stickyEl.textContent = "Open trip", stickyEl.setAttribute("data-nav", "trip")), U || (U = !0,
      function() {
        try {
          history.pushState({
            skywayTripGuard: !0
          }, "")
        } catch (e) {}
      }()), ee(), Z(), nr(), openBfmDayRecord(), W(), q(), P(), ir();
    /* Every tier already in breach was flagged as notified before P() ran,
       so nothing above fired a per-tier alert or wrote a Creator row; this
       is the single quiet summary. */
    fresh && fresh.length && !o.onBreak && pushBfmNotification("amber", "Trip resumed — " + fresh.join(
      ", ") + (1 === fresh.length ? " limit is" : " limits are") +
      " already reached. Take the required rest before driving on."), saveTripSnapshot(), Y("trip"),
      console.log(gr, "restore: trip view ready", K.tripId, "| start record", o.startTripRecordId ||
        "not found", "| on break:", o.onBreak)
  }

  /* Resolves true when the trip was resumed, false when it turned out to be
     already ended (so the caller must not treat it as active). */
  function restoreActiveTrip(e) {
    var tripRecordId = e.ID || e.id,
      tripLabel = le(e, "tripId");
    console.log(gr, "restore: active trip found", tripLabel, tripRecordId);
    return restoreFetchTripRows("Start_Trip_in_Driver1", tripRecordId, tripLabel).then(function(rows) {
      var open = rows.filter(function(row) {
        return !row.End_Time
      }).sort(function(x, y) {
        return me(String(y.Date_field || "") + " " + String(y.Start_Time || "")) - me(String(x
          .Date_field || "") + " " + String(x.Start_Time || ""))
      });
      console.log(gr, "restore: Start_Trip_in_Driver rows for this trip/driver:", rows.length,
        "| still open:", open.length);
      return rows.length && !open.length ? {
        ended: !0
      } : {
        row: open[0] || null
      }
    }, function(err) {
      console.warn(gr,
        "restore: could not read Start_Trip_in_Driver1 (the Driver profile needs View access to it) — resuming without the start record:",
        err);
      return {
        row: null
      }
    }).then(function(found) {
      if (found.ended) return console.warn(gr, "restore: every Start_Trip_in_Driver row for", tripLabel,
        "already has an End_Time — the trip was ended, so it is not resumed"), !1;
      var startRow = found.row,
        ts = me(le(e, "startDateTime")),
        src = "Trip_Dispatch Start_Date_Time";
      !ts && startRow && (ts = me(String(startRow.Date_field || "") + " " + String(startRow
        .Start_Time || "")), src = "Start_Trip_in_Driver Date_field + Start_Time");
      ts || (console.warn(gr, "restore: no valid start timestamp found; falling back to now"),
        restoreToast("Saved start time could not be read — timing restarted from now."), ts = Date.now(), src =
        "current time (fallback)");
      console.log(gr, "restore: trip started", new Date(ts).toString(), "— source:", src);
      K.tripRecordId === tripRecordId || $(e);
      var snap = readTripSnapshot();
      console.log(gr, "restore: local BFM snapshot", snap ? "found" : "not found");
      return (snap ? Promise.resolve(null) : restoreFetchTripRows("Log_a_break2", tripRecordId,
        tripLabel).catch(function(err) {
        console.warn(gr, "restore: could not read Log_a_break2 — assuming no completed breaks:", err);
        return null
      })).then(function(breakRows) {
        showRestoredTrip(applyRestoredTrip(e, ts, startRow, snap, breakRows));
        return !0
      })
    }).catch(function(err) {
      /* Never strand a driver who has a live trip on the Dashboard: fall
         back to the minimum needed to show the trip and its timer. */
      console.error(gr, "restore failed for active trip:", err);
      try {
        K.tripRecordId === tripRecordId || $(e);
        showRestoredTrip(o.tripStarted ? [] : applyRestoredTrip(e, me(le(e, "startDateTime")) || Date
          .now(), null, null, null))
      } catch (err2) {
        console.error(gr, "restore fallback failed too:", err2)
      }
      restoreToast("Trip is active. Some restored details could not be loaded.");
      return !0
    })
  }

  function we(e, t) {
    var r = u("#" + e),
      n = u("#" + t);
    if (r) {
      var i = re.total ? re.attended / re.total : 0;
      if (r.style.transition = "none", r.style.strokeDashoffset = 339, requestAnimationFrame(
          function() {
            requestAnimationFrame(function() {
              r.style.transition = "stroke-dashoffset 1.1s cubic-bezier(.3,.8,.3,1)", r.style
                .strokeDashoffset = 339 * (1 - i)
            })
          }), n) var a = Math.round(100 * i),
        o = 0,
        s = setInterval(function() {
          (o += Math.max(1, Math.round(a / 22))) >= a && (o = a, clearInterval(s)), n
            .textContent = o + "%"
        }, 40)
    }
  }

  function De() {
    we("attRing", "attPct")
  }

  function Te() {
    we("dashAttRing", "dashAttPct")
  }
  var Ce = null,
    Ie = {
      tyres: {
        label: "Tyres",
        fields: ["fTyrePress", "fTyreSpare", "fTyreCond"]
      },
      battery: {
        label: "Battery",
        fields: ["fBattCond", "fBattFunc"]
      },
      fuel: {
        label: "Fuel",
        fields: ["fVcFuelType", "fFuelPct", "fFuelOk"]
      },
      gps: {
        label: "GPS",
        fields: ["fGpsFixed", "fGpsId", "fGpsCond"]
      },
      health: {
        label: "Driver health",
        fields: ["fHealthDrive", "fHealthFatigue"]
      }
    },
    Se = {
      Pass: 0,
      Monitor: 1,
      Defect: 2
    };

  function Ee(e) {
    for (var t = "Pass", r = 0; r < e.length; r++) {
      if (null === e[r]) return null;
      Se[e[r]] > Se[t] && (t = e[r])
    }
    return t
  }

  function Le(e) {
    return At(e) || null
  }

  function Re(e) {
    var t = At(e);
    return "" === t ? null : "yes" === t ? "Pass" : "Defect"
  }

  function xe(e, t) {
    var r = At(e);
    return "" === r ? null : t[r] || "Defect"
  }

  function Ae() {
    var e, t, r, n = Object.keys(Ve),
      i = n.every(function(e) {
        return null !== Ve[e] || null !== qe[e]
      }),
      a = null;
    return i && (a = "Pass", n.forEach(function(e) {
      var t = Ge(e);
      Se[t] > Se[a] && (a = t)
    })), {
      tyres: Ee([a, null === Le("#inTyreCond") ? null : "Good" === At("#inTyreCond") ? "Pass" :
        "Average" === At("#inTyreCond") ? "Monitor" : "Defect"
      ]),
      battery: Ee([xe("#inBattCond", {
        Good: "Pass",
        Bad: "Defect",
        Change: "Defect"
      }), Re("#inBattFunc")]),
      fuel: Ee([null === Le("#inVcFuelType") ? null : "Pass", (e = At("#inVcFuelLevel"), t = 40,
        r = 25, "" === e || null === e || isNaN(e) ? null : (e = Number(e)) < r ? "Defect" :
        e < t ? "Monitor" : "Pass"), Re("#inFuelOk")]),
      gps: Ee([Re("#inGpsFixed"), null === Le("#inGpsUnit") ? null : "Pass", xe("#inGpsCond", {
        Good: "Pass",
        Weak: "Monitor",
        Faulty: "Defect"
      })]),
      health: Ee([Re("#inHealthDrive"), Le("#inHealthFatigue")])
    }
  }
  var Pe = {
    tyres: !1,
    battery: !1,
    fuel: !1,
    gps: !1,
    health: !1
  };

  function Ne() {
    var e = Ae(),
      t = 0,
      r = 0;
    Object.keys(Ie).forEach(function(n) {
      var i = e[n];
      "Defect" === i && (r++, Pe[n] = !1), Pe[n] && t++;
      var a = document.querySelector('[data-pill="' + n + '"]');
      a && (a.textContent = null === i ? "Not checked" : i, a.className = "checkpill" + (
        null === i ? "" : " is-" + i.toLowerCase()));
      var o = document.querySelector('[data-check="' + n + '"]');
      o && (o.classList.remove("is-pass", "is-monitor", "is-defect"), i && o.classList.add(
        "is-" + i.toLowerCase()));
      var s = document.querySelector('[data-check-card="' + n + '"]'),
        c = document.querySelector('[data-kpi-state="' + n + '"]');
      c && (c.textContent = Pe[n] ? "Verified" : null === i ? "Not checked" : i, c.className =
          "qa__state" + (Pe[n] ? " is-verified" : null === i ? "" : " is-" + i.toLowerCase())),
        s && (s.classList.remove("is-pass", "is-monitor", "is-defect", "is-verified"), i && s
          .classList.add("is-" + i.toLowerCase()), Pe[n] && s.classList.add("is-verified"))
    });
    var n = Object.keys(Ie).length;
    w("vcPassed", t + " / " + n), w("vcDefects", String(r));
    var i = u("#vcProgress");
    i && (i.style.width = t / n * 100 + "%");
    var a = t === n;
    w("vcResult", a ? "Cleared to depart" : r ? "Defects raised" : "Incomplete");
    var o = u("#btnStartTripCta");
    if (o) {
      o.disabled = !a;
      var s = K.tripId || X || "",
        c = o.querySelector("span");
      c && (c.textContent = (a ? "Start Trip" : "Start Trip — " + t + "/" + n + " checks") + (s ?
        " · " + s : ""))
    }
    return e
  }

  function Oe() {
    Y("vcheck")
  }
  var Me = {
      4: {
        frontAxles: 1,
        rearAxles: 1,
        rearDual: !1
      },
      6: {
        frontAxles: 1,
        rearAxles: 1,
        rearDual: !0
      },
      8: {
        frontAxles: 2,
        rearAxles: 1,
        rearDual: !0
      },
      12: {
        frontAxles: 2,
        rearAxles: 2,
        rearDual: !0
      },
      16: {
        frontAxles: 2,
        rearAxles: 3,
        rearDual: !0
      }
    },
    Fe = 4;

  function Be(e) {
    var t = Me[e] || Me[6],
      r = {};
    (1 === t.frontAxles ? [1.7] : [1.95, 1.4]).forEach(function(e, n) {
      var i = n + 1,
        a = t.frontAxles > 1,
        o = a ? "f" + i + "r" : "fr",
        s = a ? "Front axle " + i + " " : "Front ";
      r[a ? "f" + i + "l" : "fl"] = {
        x: e,
        z: .83,
        dual: !1,
        label: s + "left tyre"
      }, r[o] = {
        x: e,
        z: -.83,
        dual: !1,
        label: s + "right tyre"
      }
    });
    var n = t.rearAxles,
      dl = !1 !== t.rearDual;
    return (1 === n ? [-1.5] : 2 === n ? [-1.3, -1.85] : [-1.05, -1.55, -2.05]).forEach(function(e,
      t) {
      var i = t + 1,
        a = n > 1,
        o = a ? "r" + i + "r" : "rr",
        s = a ? "Rear axle " + i + " " : "Rear ";
      r[a ? "r" + i + "l" : "rl"] = {
        x: e,
        z: .83,
        dual: dl,
        label: s + (dl ? "left tyres" : "left tyre")
      }, r[o] = {
        x: e,
        z: -.83,
        dual: dl,
        label: s + (dl ? "right tyres" : "right tyre")
      }
    }), r
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
    return Object.keys(r).forEach(function(e) {
      n[e] = t && void 0 !== Ve[e] ? Ve[e] : null, i[e] = t && void 0 !== qe[e] ? qe[e] : null,
        a[e] = r[e].label
    }), Ve = n, qe = i, He = a, Fe = e, r
  }

  function Ze(e) {
    if (e = Number(e) || 6, Me[e] || (e = 6), e !== Fe || !Object.keys(Ve).length) {
      var t = Ue(e, !0);
      ! function(e) {
        var t = document.querySelector(".veh3d__fallback-grid");
        if (!t) return;
        var r = Object.keys(e),
          n = r.map(function(e) {
            var t = e.toUpperCase();
            return '<button type="button" class="tyre3d__tyre" data-tyre="' + e +
              '" aria-label="' + (He[e] || "Tyre") +
              ' pressure"><span class="tyre3d__ring"><svg viewBox="0 0 24 24"><use href="#i-tyre"/></svg></span><span class="tyre3d__pos">' +
              t + '</span><span class="tyre3d__badge" data-badge="' + e +
              '">Tap to add</span></button>'
          }).join("");
        t.innerHTML = n, t.classList.toggle("is-wide", r.length > 4)
      }(t),
      function(e) {
        if (!Je.ready || !window.THREE) return;
        var t = window.THREE;
        Je.truck && (Je.scene.remove(Je.truck), function(e) {
          if (!e) return;
          e.traverse(function(e) {
            e.geometry && e.geometry.dispose(), e.material && (Array.isArray(e.material) ? e
              .material.forEach(function(e) {
                e.dispose()
              }) : e.material.dispose())
          })
        }(Je.truck));
        Je.truck = it(t, e), Je.scene.add(Je.truck), at()
      }(t), je()
    }
  }

  function Ge(e) {
    var t, r = null === (t = Ve[e]) || "" === t || isNaN(t) ? null : (t = Number(t)) >= 100 && t <=
      120 ? "Pass" : t >= 90 && t <= 130 ? "Monitor" : "Defect";
    return "no" === qe[e] ? "Defect" : "yes" === qe[e] && null === r ? "Pass" : r
  }

  function je() {
    var e = Object.keys(Ve),
      t = e.filter(function(e) {
        return null !== Ve[e] || null !== qe[e]
      }),
      r = null,
      n = -1,
      i = {
        Pass: 0,
        Monitor: 1,
        Defect: 2
      };
    t.forEach(function(e) {
      var t = Ge(e);
      i[t] > n && (n = i[t], r = Ve[e])
    });
    var a = u("#inTyrePress");
    a && (a.value = null === r ? n >= 0 ? "0" : "" : r), e.forEach(function(e) {
      var t = document.querySelector('.tyre3d__tyre[data-tyre="' + e + '"]'),
        r = document.querySelector('[data-badge="' + e + '"]');
      if (t && r) {
        var n = Ve[e],
          i = Ge(e);
        t.classList.remove("is-set", "is-monitor", "is-defect"), null === n && null === qe[e] ?
          r.textContent = "Tap to add" : (r.textContent = null === n ? "yes" === qe[e] ? "OK" :
            "Not OK" : n + " psi", "Pass" === i ? t.classList.add("is-set") : "Monitor" === i ?
            t.classList.add("is-monitor") : t.classList.add("is-defect")), pt(e, i)
      }
    }), w("tyre3dSummary", t.length + " of " + e.length + " tyre positions recorded (" + Fe +
      " tyres total)"), Ne()
  }

  function ze(e) {
    We = e, w("tyrePopupTitle", He[e] || "Tyre");
    var t = u("#tyrePopupInput");
    t && (t.value = null === Ve[e] ? "" : Ve[e]);
    var r = document.querySelector('.yn-toggle[data-yn-target="tyrePopupOk"]');
    r && m(".yn-btn", r).forEach(function(t) {
      t.classList.toggle("is-active", t.getAttribute("data-yn-val") === qe[e])
    });
    var n = u("#tyrePopupOk");
    n && (n.value = qe[e] || ""), u("#tyrePopup").hidden = !1, u("#tyreScrim").hidden = !1, document
      .body.style.overflow = "hidden", t && setTimeout(function() {
        t.focus()
      }, 60)
  }

  /* ---------- NEW: Trip details popup (Trip status / Stops completed /
     Driving time / Distance left) — opened from the trip timer or its
     round info button; keeps the Assigned Trip header clean. ---------- */
  function openTripInfoPopup() {
    var p = u("#tripInfoPopup"),
      s = u("#tripInfoScrim");
    p && (p.hidden = !1), s && (s.hidden = !1), document.body.style.overflow = "hidden"
  }

  function closeTripInfoPopup() {
    var p = u("#tripInfoPopup"),
      s = u("#tripInfoScrim");
    p && (p.hidden = !0), s && (s.hidden = !0), document.body.style.overflow = ""
  }

  function Ye() {
    u("#tyrePopup").hidden = !0, u("#tyreScrim").hidden = !0, document.body.style.overflow = "",
      We = null
  }

  function Qe() {
    if (We) {
      var e = u("#tyrePopupInput") ? At("#tyrePopupInput") : "";
      Ve[We] = "" === e ? null : Number(e);
      var t = At("#tyrePopupOk");
      qe[We] = "" === t ? null : t, je(), Ye()
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
    rotY: -.55,
    rotX: .18,
    baseDist: 9.6,
    idleSpin: !1
  };
  var Xe = ["https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
    "https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js",
    "https://unpkg.com/three@0.128.0/build/three.min.js"
  ];

  function Ke(e, t) {
    if (t = t || 0, void 0 === window.THREE)
      if (t >= Xe.length) e(!1);
      else {
        var r = document.createElement("script");
        r.src = Xe[t], r.async = !0, r.onload = function() {
          e(void 0 !== window.THREE)
        }, r.onerror = function() {
          Ke(e, t + 1)
        }, document.head.appendChild(r)
      }
    else e(!0)
  }
  var $e = "Please select the vehicle's tyres and check the tyre condition.",
    et = null,
    tt = !1,
    rt = [/google\s*us\s*english/i, /microsoft\s*(aria|jenny|emma)/i, /samantha/i,
      /google\s*uk\s*english\s*female/i,
      /moira|tessa|karen|fiona|serena|kate|joanna|kimberly|ivy|susan|victoria/i, /zira/i
    ];

  function nt() {
    var e = u("#veh3dCanvas"),
      t = u("#veh3dFallback");
    e && (e.hidden = !0), t && (t.hidden = !1), w("veh3dSideLabel", "Tap a tyre")
  }

  function it(e, t) {
    var r = new e.Group,
      n = new e.MeshPhysicalMaterial({
        color: 1990616,
        roughness: .32,
        metalness: .55,
        clearcoat: .6,
        clearcoatRoughness: .22
      }),
      i = new e.MeshPhysicalMaterial({
        color: 1194639,
        roughness: .35,
        metalness: .5,
        clearcoat: .5,
        clearcoatRoughness: .25
      }),
      a = new e.MeshPhysicalMaterial({
        color: 794680,
        roughness: .08,
        metalness: .2,
        clearcoat: 1,
        transparent: !0,
        opacity: .92
      }),
      o = new e.MeshPhysicalMaterial({
        color: 15856889,
        roughness: .55,
        metalness: .1,
        clearcoat: .25
      }),
      s = new e.MeshStandardMaterial({
        color: 14147046,
        roughness: .6,
        metalness: .1
      }),
      c = new e.MeshStandardMaterial({
        color: 2304314,
        roughness: .75,
        metalness: .35
      }),
      l = new e.MeshStandardMaterial({
        color: 14146530,
        roughness: .15,
        metalness: .95
      }),
      d = new e.MeshStandardMaterial({
        color: 16775133,
        emissive: 16773828,
        emissiveIntensity: .9,
        roughness: .3
      }),
      u = new e.MeshStandardMaterial({
        color: 16751918,
        emissive: 16747008,
        emissiveIntensity: .7
      }),
      m = new e.MeshStandardMaterial({
        color: 11740188,
        emissive: 8000526,
        emissiveIntensity: .55
      }),
      p = new e.MeshStandardMaterial({
        color: 16757760,
        emissive: 16751872,
        emissiveIntensity: .85
      });

    function f(t, n, i, a, o, s, c) {
      var l = new e.Mesh(new e.BoxGeometry(t, n, i), a);
      return l.position.set(o, s, c), l.castShadow = !0, l.receiveShadow = !0, r.add(l), l
    }
    f(4.9, .16, 1.46, c, -.05, -.32, 0);
    f(4.9, .06, .08, c, -.05, -.25, .66), f(4.9, .06, .08, c, -.05, -.25, -.66);
    f(1.28, 1.62, 1.6, n, 1.78, .78, 0), f(1.16, .22, 1.5, n, 1.74, 1.7, 0), f(.62, 1, 1.42, i,
      2.55, .15, 0), f(.6, .06, 1.3, n, 2.55, .68, 0);
    f(.06, .62, 1.06, l, 2.87, .16, 0);
    f(.14, .22, 1.5, l, 2.92, -.2, 0);
    var h = new e.Mesh(new e.CylinderGeometry(.09, .09, .06, 20), d);
    h.rotation.z = Math.PI / 2, h.position.set(2.9, .22, .55), r.add(h);
    var v = h.clone();
    v.position.z = -.55, r.add(v);
    var y = new e.Mesh(new e.SphereGeometry(.045, 12, 12), u);
    y.position.set(2.9, .02, .62), r.add(y);
    var g = y.clone();
    g.position.z = -.62, r.add(g), f(.06, .82, 1.36, a, 2.32, 1, 0).rotation.z = -.06, f(.75, .62,
      .05, a, 1.5, 1.08, .79), f(.75, .62, .05, a, 1.5, 1.08, -.79), f(.5, .05, 1.5, i, 2.35,
      1.46, 0), ["l", "r"].forEach(function(e) {
      var t = "l" === e ? 1 : -1;
      f(.28, .03, .03, l, 2.02, 1.12, .86 * t), f(.05, .22, .16, l, 2.15, 1.1, .98 * t)
    });
    for (var b = -2; b <= 2; b++) {
      var _ = new e.Mesh(new e.SphereGeometry(.028, 8, 8), p);
      _.position.set(2.28, 1.83, .26 * b), r.add(_)
    }
    var k = new e.Mesh(new e.CylinderGeometry(.045, .045, 1.3, 14), l);
    k.position.set(1.16, 1.15, .68), r.add(k);
    var w = new e.Mesh(new e.ConeGeometry(.065, .1, 14), c);
    w.position.set(1.16, 1.83, .68), r.add(w);
    var D = new e.Mesh(new e.CylinderGeometry(.19, .19, .62, 18), l);
    D.rotation.z = Math.PI / 2, D.position.set(.65, -.05, .72), D.castShadow = !0, r.add(D);
    var T = new e.Mesh(new e.TorusGeometry(.2, .015, 8, 20), c);
    T.rotation.y = Math.PI / 2, T.position.set(.44, -.05, .72), r.add(T);
    var C = T.clone();
    C.position.x = .86, r.add(C);
    f(2.9, 1.7, 1.62, o, -1.15, .75, 0), f(2.94, .06, 1.66, s, -1.15, 1.63, 0), f(2.98, .1, 1.7, c,
      -1.15, -.34, 0);
    for (var I = -2.45; I <= .15; I += .29) f(.035, 1.6, .02, s, I, .75, .815), f(.035, 1.6, .02, s,
      I, .75, -.815);
    f(2.9, .05, .02, l, -1.15, .05, .816), f(2.9, .05, .02, l, -1.15, .05, -.816);
    f(.05, .22, .16, m, -2.58, .1, .55), f(.05, .22, .16, m, -2.58, .1, -.55);
    f(.12, .14, 1.66, l, -2.62, -.3, 0);
    var S = new e.CylinderGeometry(.47, .47, .34, 28),
      E = new e.CylinderGeometry(.23, .23, .36, 20),
      L = new e.CylinderGeometry(.06, .06, .4, 12),
      R = {
        color: 1645602,
        roughness: .95,
        metalness: .03
      };
    var x = {
      color: 5989490,
      roughness: .35,
      metalness: .2,
      emissive: 0
    };
    return t = t || Be(6), Je.wheels = {}, Object.keys(t).forEach(function(n) {
      var a = t[n],
        o = new e.Group,
        s = [];
      (a.dual ? [
        [-.2, -.22],
        [.2, .22]
      ] : [
        [0, 0]
      ]).forEach(function(pair) {
        var dx = pair[0],
          dz = pair[1];
        var r = function(t, r) {
          var n = new e.Group,
            i = new e.Mesh(S, new e.MeshStandardMaterial(R));
          i.rotation.x = Math.PI / 2, i.castShadow = !0, n.add(i);
          var a = new e.Mesh(E, l);
          a.rotation.x = Math.PI / 2, n.add(a);
          var o = new e.Mesh(L, l);
          o.rotation.x = Math.PI / 2, n.add(o);
          for (var s = 0; s < 6; s++) {
            var d = new e.Mesh(new e.CylinderGeometry(.018, .018, .42, 6), c);
            d.rotation.x = Math.PI / 2;
            var u = s / 6 * Math.PI * 2;
            d.position.set(.13 * Math.cos(u), .13 * Math.sin(u), 0), n.add(d)
          }
          return n.position.set(t, 0, r), {
            w: n,
            tyre: i
          }
        }(a.x + dx, dz);
        o.add(r.w);
        var n = new e.Mesh(new e.TorusGeometry(.49, .04, 10, 28), new e
          .MeshStandardMaterial(x));
        n.rotation.x = Math.PI / 2, r.w.add(n), s.push(n)
      });
      var d = a.dual ? .82 : .53,
        u = new e.TorusGeometry(d, .045, 8, 20, Math.PI),
        m = new e.Mesh(u, i);
      m.position.set(a.x, 0, a.z), m.castShadow = !0, r.add(m), o.position.set(0, 0, a.z), o
        .userData.tyre = n;
      var p = new e.Mesh(new e.CylinderGeometry(.66, .66, a.dual ? 1.15 : .5, 16), new e
        .MeshBasicMaterial({
          visible: !1
        }));
      p.rotation.x = Math.PI / 2, p.position.set(a.x, 0, 0), p.userData.tyre = n, o.add(p), r
        .add(o), Je.wheels[n] = {
          group: o,
          rings: s,
          hit: p
        }
    }), r.position.y = .5, r
  }

  function at() {
    if (Je.ready) {
      Je.truck.rotation.y = Je.rotY, Je.truck.rotation.x = 0;
      var e = Je.baseDist;
      Je.camera.position.set(0, 1.95 + 1.7 * Je.rotX, e), Je.camera.lookAt(0, .68, 0), Je.renderer
        .render(Je.scene, Je.camera)
    }
  }
  var ot = null;

  function st() {
    if (Je.ready) {
      var e = u("#veh3dScene");
      if (e) {
        var t = e.clientWidth,
          r = e.clientHeight;
        t && r && (Je.renderer.setSize(t, r, !1), Je.camera.aspect = t / r, Je.camera
          .updateProjectionMatrix(), at())
      }
    }
  }

  function ct(e) {
    var t = window.THREE,
      r = function(e) {
        var t = Je.canvas.getBoundingClientRect();
        return {
          x: (e.clientX - t.left) / t.width * 2 - 1,
          y: -(e.clientY - t.top) / t.height * 2 + 1
        }
      }(e),
      n = new t.Raycaster;
    n.setFromCamera(r, Je.camera);
    var i = Object.keys(Je.wheels).map(function(e) {
        return Je.wheels[e].hit
      }),
      a = n.intersectObjects(i, !1);
    return a.length ? a[0].object.userData.tyre : null
  }

  function lt(e) {
    Je.dragging = !0, Je.moved = !1, Je.lastX = e.clientX, Je.lastY = e.clientY, Je.idleSpin = !1,
      ot && clearTimeout(ot), ot = setTimeout(function() {
        Je.idleSpin = !0
      }, 2600);
    var t = u("#veh3dViewer");
    if (t && t.classList.add("is-dragging"), Je.canvas.setPointerCapture) try {
      Je.canvas.setPointerCapture(e.pointerId)
    } catch (e) {}
  }

  function dt(e) {
    if (Je.dragging) {
      var t = e.clientX - Je.lastX,
        r = e.clientY - Je.lastY;
      (Math.abs(t) > 3 || Math.abs(r) > 3) && (Je.moved = !0), Je.lastX = e.clientX, Je.lastY = e
        .clientY, Je.rotY += .012 * t, Je.rotX = Math.max(-.3, Math.min(.75, Je.rotX + .006 * r)),
        at()
    }
  }

  function ut(e) {
    if (Je.dragging) {
      Je.dragging = !1;
      var t = u("#veh3dViewer");
      if (t && t.classList.remove("is-dragging"), !Je.moved) {
        var r = ct(e);
        r && ze(r)
      }
    }
  }

  function mt() {
    Je.rotY = -.55, Je.rotX = .18, at()
  }

  function pt(e, t) {
    var r = Je.wheels && Je.wheels[e];
    if (r) {
      var n = {
        Pass: 1023320,
        Monitor: 13072128,
        Defect: 13841707
      } [t] || 5989490;
      (r.rings || []).forEach(function(e) {
        e.material.color.setHex(n), e.material.emissive.setHex(t ? n : 0), e.material
          .emissiveIntensity = t ? .4 : 0
      }), at()
    }
  }

  function ft() {
    var e = u("#veh3dViewer"),
      t = u("#veh3dCanvas");
    if (e && t) return function() {
      try {
        var e = document.createElement("canvas");
        return !(!window.WebGLRenderingContext || !e.getContext("webgl") && !e.getContext(
          "experimental-webgl"))
      } catch (e) {
        return !1
      }
    }() ? void Ke(function(e) {
      if (!e) return Je.failed = !0, void nt();
      ! function(e) {
        var t = window.THREE;
        try {
          Je.canvas = e, Je.renderer = new t.WebGLRenderer({
              canvas: e,
              antialias: !0,
              alpha: !0
            }), Je.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)),
            "shadowMap" in Je.renderer && (Je.renderer.shadowMap.enabled = !0, Je.renderer
              .shadowMap.type = t.PCFSoftShadowMap), "outputEncoding" in Je.renderer && t
            .sRGBEncoding && (Je.renderer.outputEncoding = t.sRGBEncoding), Je.scene = new t
            .Scene, Je.camera = new t.PerspectiveCamera(30, 1, .1, 100), Je.scene.add(new t
              .HemisphereLight(14477055, 3357002, .85));
          var r = new t.DirectionalLight(16774366, 1.05);
          r.position.set(3.4, 5, 2.6), r.castShadow = !0, r.shadow.mapSize.set(1024, 1024), r
            .shadow.camera.left = -4.5, r.shadow.camera.right = 4.5, r.shadow.camera.top =
            4.5, r.shadow.camera.bottom = -4.5, r.shadow.camera.near = .5, r.shadow.camera
            .far = 14, r.shadow.bias = -.0025, Je.scene.add(r);
          var n = new t.DirectionalLight(12375295, .4);
          n.position.set(-4, 2.5, -3), Je.scene.add(n);
          var i = new t.DirectionalLight(16777215, .3);
          i.position.set(-1, 1.5, 4), Je.scene.add(i), Je.truck = it(t, Be(Fe)), Je.truck
            .rotation.x = 0, Je.scene.add(Je.truck);
          var a = new t.Mesh(new t.PlaneGeometry(30, 30), new t.ShadowMaterial({
            opacity: .28
          }));
          a.rotation.x = -Math.PI / 2, a.position.y = .001, a.receiveShadow = !0, Je.scene
            .add(a), Je.idleSpin = !0, Je.ready = !0, st(), at(), o = performance.now(),
            requestAnimationFrame(function e(t) {
              if (Je.ready) {
                var r = Math.min(.05, (t - o) / 1e3);
                o = t, !Je.dragging && Je.idleSpin && (Je.rotY += .18 * r, at()),
                  requestAnimationFrame(e)
              }
            })
        } catch (e) {
          return Je.failed = !0, void nt()
        }
        var o;
        e.addEventListener("pointerdown", lt), window.addEventListener("pointermove", dt),
          window.addEventListener("pointerup", ut), window.addEventListener("pointercancel",
            ut);
        var s = u("#veh3dReset");
        s && s.addEventListener("click", mt);
        if ("undefined" != typeof ResizeObserver) {
          var c = new ResizeObserver(function() {
              st()
            }),
            l = u("#veh3dScene");
          l && c.observe(l)
        } else window.addEventListener("resize", st), setTimeout(st, 300)
      }(t)
    }) : (Je.failed = !0, void nt())
  }
  var ht = {
      Good: "Good — locked and tracking",
      Weak: "Weak — intermittent signal",
      Faulty: "Faulty — no signal / unit fault"
    },
    vt = {
      Pass: "Alert — fit to drive",
      Monitor: "Slightly tired — fit with breaks",
      Defect: "Fatigued — not fit to drive"
    };

  function yt(e) {
    return "yes" === e ? "Yes" : "no" === e ? "No" : ""
  }

  function cr2(v) {
    return null === v || void 0 === v || "" === v ? "" : String(v).trim()
  }

  function gt() {
    var e = Ae();
    if (Ce = {
        tyrePressure: Number(At("#inTyrePress")) || 0,
        tyrePressures: {
          fl: Ve.fl,
          fr: Ve.fr,
          rl: Ve.rl,
          rr: Ve.rr
        },
        tyrePressureOk: {
          fl: qe.fl,
          fr: qe.fr,
          rl: qe.rl,
          rr: qe.rr
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
        grades: e
      }, window.ZOHO && ZOHO.CREATOR && ZOHO.CREATOR.DATA) return K.tripRecordId && K
      .driverRecordId ? void ZOHO.CREATOR.DATA.addRecords({
        form_name: "Vehicle_check_in",
        payload: {
          data: {
            Trip_ID: cr2(K.tripRecordId || K.tripId),
            Driver: cr2(K.driverRecordId || K.driverEmployeeRecordId || K.driverName || K
              .driverId || ""),
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
            Notes: [Ce.notes, Ce.fuelQuantity ? "Fuel quantity: " + Ce.fuelQuantity : ""]
              .filter(Boolean).join(" | ")
          }
        }
      }).catch(function(e) {
        console.error(gr, "Vehicle_check_in save failed:", e), R(
          "Couldn't save the vehicle check-in — please try again.")
      }) : (console.error(gr,
          "Vehicle_check_in not saved — no active trip. Start a trip from Today's Trip first."),
        void R("Start a trip first — this check-in isn't linked to a trip yet."))
  }

  function bt() {
    if (!Object.keys(Pe).every(function(e) {
        return Pe[e]
      })) return void R("Complete all 5 vehicle checks before starting the trip.");
    if (!K.tripRecordId || !K.driverRecordId) return void R(
      "Can't start — no assigned trip/driver is loaded yet. Please wait for the page to finish loading and try again."
      );
    Y("starttrip")
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
    idEl && (idEl.value = K.tripId || X || "", idEl.disabled = !0);
    var nmEl = u("#inStTripName");
    nmEl && (nmEl.value = K.tripName || K.tripId || X || "", nmEl.disabled = !0);
    var dEl = u("#inStDate");
    dEl && (dEl.value = k(), dEl.disabled = !0);
    var stEl = u("#inStStartTime");
    if (stEl) {
      if (!stEl.value) {
        var now = new Date;
        stEl.value = p(now.getHours()) + ":" + p(now.getMinutes())
      }
      stEl.disabled = !0
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
    if (hasActiveTrip()) return console.warn(gr, "Start Trip blocked — a trip is already in progress:", o
      .activeTripRecordId || K.tripRecordId), errEl.textContent = "Complete your active trip first.", void(
      errEl.hidden = !1);
    var startTimeVal = At("#inStStartTime");
    if (!startTimeVal) return errEl.textContent = "Enter the start time.", void(errEl.hidden = !
    1);
    var odoVal = At("#inStOdo");
    if (!odoVal) return errEl.textContent = "Enter the starting odometer reading.", void(errEl
      .hidden = !1);
    if (!K.tripRecordId) return errEl.textContent =
      "Can't start — no assigned Trip_Dispatch1 record is loaded yet.", void(errEl.hidden = !1);
    var tripLabel = K.tripId || X || "",
      odometerNum = Number(odoVal) || 0,
      startMinsVal = _(startTimeVal),
      endMinsVal = (startMinsVal + a.maxWorkPerShift) % 1440,
      endTimeVal = p(Math.floor(endMinsVal / 60)) + ":" + p(endMinsVal % 60),
      endLocationVal = K.record && le(K.record, "toLocation") || "",
      locVal = At("#inStartLoc"),
      urlVal = At("#inStartUrl");
    var submitBtn = u("#btnSubmitStartTrip");
    var stStartRecordId = null;
    submitBtn && (submitBtn.disabled = !0);
    try {
      if (window.ZOHO && ZOHO.CREATOR && ZOHO.CREATOR.DATA) {
        var stTodayD = new Date,
          stZohoDate = p(stTodayD.getDate()) + "-" + h[stTodayD.getMonth()] + "-" + stTodayD
          .getFullYear(),
          stDriverEmpId = await resolveEmployeeFormId(),
          /* Never substitute the trip's assigned driver here: this record
             must always identify the user currently logged into the portal. */
          stDriverId = stDriverEmpId || K.driverEmployeeRecordId || s.recordId;
        if (!stDriverId) throw new Error("No Employee_Form record could be resolved for the logged-in driver.");
        var tsPayload = {
          /* Creator lookup fields require their record IDs, not the visible
             Trip ID / Driver ID labels shown in the widget. */
          Driver_ID: cr2(stDriverId),
          Driver_Name: cr2(stDriverId),
          Trip_ID: cr2(K.tripRecordId),
          Trip_Name: cr2(K.tripRecordId),
          Date_field: stZohoDate,
          Starting_Odometer_Reading: odometerNum,
          Start_Time: b(startTimeVal)
        };
        locVal && (tsPayload.Live_Location = locVal);
        urlVal && (tsPayload.Live_Location_URL = {
          url: urlVal
        });
        await ZOHO.CREATOR.DATA.addRecords({
          form_name: "Start_Trip_in_Driver",
          payload: {
            data: tsPayload
          }
        }).then(function(stRes) {
          /* CRITICAL FIX: ZOHO.CREATOR.DATA.addRecords() resolves its promise
             even when Creator REJECTS the record (bad lookup ID, a mandatory
             field missing, a validation rule failing, etc.) — it only
             rejects on transport-level failures. Every other save in this
             file (see saveFuel above) checks response.code === 3000 for
             this reason; Start Trip never did, so a rejected record still
             fell through to the "Data Added Successfully!" success path
             below with nothing actually written to Zoho. */
          console.log(gr, "Start_Trip_in_Driver addRecords response:", stRes);
          var stCode = stRes && (stRes.code || stRes.result && stRes.result[0] &&
            stRes.result[0].code);
          if (void 0 !== stCode && 3e3 !== stCode) throw new Error(
            "Creator rejected the record (code " + stCode + "): " + _r(stRes));
          stStartRecordId = stRes && stRes.data && (stRes.data.ID || stRes.data.id) || stRes && stRes
            .result && stRes.result[0] && (stRes.result[0].ID || stRes.result[0].id) || null;
        });
        if (ZOHO.CREATOR.DATA.updateRecords) try {
          await ZOHO.CREATOR.DATA.updateRecords({
            form_name: se,
            id: K.tripRecordId,
            payload: {
              data: {
                Starting_Odometer: odometerNum
              }
            }
          });
        } catch (odometerErr) {
          /* The Start Trip record was saved successfully; keep the driver
             moving if the optional dispatch odometer update is rejected. */
          console.error(gr, "Could not update Trip_Dispatch1 odometer:", odometerErr);
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
    o.startTime = startTimeVal, o.startTs = me((stZohoDate || p(new Date().getDate()) + "-" + h[new Date()
      .getMonth()] + "-" + new Date().getFullYear()) + " " + b(startTimeVal)), o.startTripRecordId =
      stStartRecordId, o.activeTripRecordId = K.tripRecordId, o.endTime = endTimeVal, o.tripStarted = !0, o.startLocation =
      locVal, o.startLocationUrl = urlVal, o.endLocation = endLocationVal, o.startOdometer =
      odometerNum, o.tierWorked = [0, 0, 0, 0, 0], o.tierExtraMins = [0, 0, 0, 0, 0], o.tierNotified = [
        !1, !1, !1, !1, !1
      ], o.breakElapsedMins = 0, o.onBreak = !1, o.bfmDayKey = bfmDateKey(new Date()), w(
        "tripStart", startTimeVal), w("tripEnd",
        endTimeVal), w("tripStartedAt", startTimeVal), w("tripWindow", startTimeVal + " – " +
        endTimeVal), w("tripStartLoc", locVal), w("kpiStatus", "IN TRANSIT");
    var stickyEl = u("#stickyStart");
    stickyEl && (stickyEl.textContent = "Open trip", stickyEl.setAttribute("data-nav", "trip")),
      ee(), B(o.startTs), W(), saveTripSnapshot(), pushBfmNotification("green",
        "Trip " + (tripLabel || "") +
        " started — BFM monitoring is now active for this trip."), U || (U = !0, function() {
        try {
          history.pushState({
            skywayTripGuard: !0
          }, "")
        } catch (e) {}
      }()), M(), R("Trip " + tripLabel + " started at " + startTimeVal +
        " — saved to Zoho Creator"), Y("trip"), persistBfmOnResume();
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
      console.warn(gr, "complete: no Start_Trip_in_Driver record ID in memory — looking it up");
      var rows = await restoreFetchTripRows("Start_Trip_in_Driver1", K.tripRecordId, K.tripId),
        open = rows.filter(function(row) {
          return !row.End_Time
        }).sort(function(x, y) {
          return me(String(y.Date_field || "") + " " + String(y.Start_Time || "")) - me(String(x
            .Date_field || "") + " " + String(x.Start_Time || ""))
        })[0];
      if (!open) throw new Error("No open Start_Trip_in_Driver record was found for this trip.");
      o.startTripRecordId = open.ID || open.id
    }
    var now = new Date,
      endTime = p(now.getHours()) + ":" + p(now.getMinutes()) + ":" + p(now.getSeconds()),
      payload = {
        data: {
          End_Time: endTime
        }
      },
      DATA = ZOHO.CREATOR.DATA;
    console.log(gr, "complete: setting End_Time", endTime, "on Start_Trip_in_Driver", o.startTripRecordId);
    /* SDK 2.0 updates a single record with updateRecordById; updateRecords is
       criteria-based, so it is only the fallback. */
    var res = await (DATA.updateRecordById ? DATA.updateRecordById({
      report_name: "Start_Trip_in_Driver1",
      id: o.startTripRecordId,
      payload: payload
    }) : DATA.updateRecords({
      report_name: "Start_Trip_in_Driver1",
      criteria: '(ID == "' + escapeCriteria(o.startTripRecordId) + '")',
      payload: payload
    }));
    console.log(gr, "Start_Trip_in_Driver End_Time update response:", res);
    var code = res && (res.code || res.result && res.result[0] && res.result[0].code);
    if (3e3 !== code) throw new Error("Creator did not confirm the update (code " + code + "): " + _r(res))
  }

  function _t() {
    var e = u("#checkInErr");
    e.hidden = !0;
    var t = u("#inHub").value,
      r = u("#inCheckInTime").value;
    if (!t) return e.textContent = "Select the hub you're checking in to.", void(e.hidden = !1);
    if (!r) return e.textContent = "Enter your check-in time.", void(e.hidden = !1);
    syncSelectedBookingIdsFromChecklist();
    if (BOOKING_ID_OPTIONS.length && !c.bookingIds.length) return e.textContent =
      "Select at least one Booking ID for this check-in.", void(e.hidden = !1);
    var bookingIds = c.bookingIds;
    return c = {
      hub: t,
      date: u("#inCheckDate").value,
      inTime: r,
      outTime: u("#inCheckOutTime").value,
      bookingIds: bookingIds
    }, R("Checked in at " + t + " — opening POD"), void Y("pod")
  }

  function kt() {
    if (!c.hub) {
      var e = u("#inHub").value;
      if (!e) return void R("Select a hub and save your check-in first.");
      c.hub = e, c.date = u("#inCheckDate").value || k()
    }
    Y("pod")
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
    POD_RESULT_META = podBuildResultMeta(cfg, new Date);
    var now = new Date,
      dateStr = cfg.date || now.toLocaleDateString("en-AU", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      });
    w("podResultDate", dateStr), w("podResultDriverName", cfg.driverName || s.name || "—"), w(
      "podResultDriverId", cfg.driverId || s.id || "—"), w("podResultTripId", cfg.tripId || K
      .tripId || "—"), w("podResultAssignedTripId", K.tripId || cfg.tripId || "—"), w(
      "podResultBookingId", cfg.bookingId || "—"), w("podResultStatus", cfg
      .status || "—"), w("podResultNote", cfg.note ||
      "—"), w("podResultReceivedAt", cfg.receivedAt || now.toLocaleString("en-AU", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }));
    /* ---------- Vehicle / Customer / Pickup / Delivery ----------
       Sourced from the corresponding Trip / Booking_Shipments1
       records (see K.vehicleName and BOOKING_FIELD_CANDIDATES),
       never guessed — cfg carries "—" when a flow has no single
       Booking to resolve these against (e.g. the multi-booking hub
       check-in flow). The old, incorrect binding that put the
       driver's checked-in Hub name into "Delivery Location" has been
       removed; Delivery Location now comes only from the Booking. */
    w("podResultCustomerName", cfg.customerName || "—"),
      w("podResultCompanyName", cfg.companyName || "—"),
      w("podResultVehicleNo", cfg.vehicleNo || K.vehicleName || "—"),
      w("podResultShipperCompany", cfg.shipperCompany || cfg.companyName || "—"),
      w("podResultPickupLocation", cfg.pickupLocation || "—"),
      w("podResultPickupAddress", cfg.pickupAddress || "—"),
      w("podResultCustomerCompany", cfg.customerCompany || cfg.companyName || "—"),
      w("podResultDeliveryLocation", cfg.deliveryLocation || "—"),
      w("podResultDeliveryAddress", cfg.deliveryAddress || "—"),
      w("podResultWeight", cfg.weight || "—");
    var receivedByEl = u("#podResultReceivedByName");
    receivedByEl && (receivedByEl.value = cfg.receivedByName || "");
    var body = u("#podResultItemList");
    if (body) {
      var items = cfg.items || [];
      body.innerHTML = items.length ? items.map(function(it, idx) {
        return "<tr><td>" + (idx + 1) + '</td><td class="item-name">' + (it.name || "—") +
          "</td><td>" + (it.qty || 0) + "</td><td>" + (it.receivedQty || 0) + "</td><td>" +
          (it.pendingQty || 0) + "</td><td>" + podPriceLabel(it.price) + "</td></tr>"
      }).join("") : '<tr><td colspan="6" style="text-align:center;color:#8b93a7">No items recorded for this delivery.</td></tr>'
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
    sigImg && (cfg.signature ? sigImg.src = cfg.signature : sigImg.removeAttribute("src"),
      sigImg.hidden = !0);
    podResultSigPad.hasInk = false;
    var wrap = u("#podResultSigPadWrap");
    wrap && wrap.classList.remove("has-signature")
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
    lastY: 0
  };

  function podResultSigPadPointerPos(e) {
    var r = podResultSigPad.canvas.getBoundingClientRect();
    return {
      x: e.clientX - r.left,
      y: e.clientY - r.top
    }
  }

  function podResultSigPadDown(e) {
    podResultSigPad.drawing = true;
    var p = podResultSigPadPointerPos(e);
    podResultSigPad.lastX = p.x, podResultSigPad.lastY = p.y;
    podResultSigPad.canvas.setPointerCapture && podResultSigPad.canvas.setPointerCapture(e.pointerId)
  }

  function podResultSigPadMove(e) {
    if (!podResultSigPad.drawing) return;
    var p = podResultSigPadPointerPos(e),
      ctx = podResultSigPad.ctx;
    ctx.beginPath(), ctx.moveTo(podResultSigPad.lastX, podResultSigPad.lastY), ctx.lineTo(p.x, p.y),
      ctx.stroke(), podResultSigPad.lastX = p.x, podResultSigPad.lastY = p.y;
    if (!podResultSigPad.hasInk) {
      podResultSigPad.hasInk = true;
      var wrap = u("#podResultSigPadWrap");
      wrap && wrap.classList.add("has-signature")
    }
  }

  function podResultSigPadCommit() {
    if (!podResultSigPad.canvas) return;
    if (!podResultSigPad.hasInk) return void(RECEIVER_SIGNATURE_DATA = null);
    RECEIVER_SIGNATURE_DATA = podResultSigPad.canvas.toDataURL("image/png");
    var sigImg = u("#podResultSignatureImg");
    sigImg && (sigImg.src = RECEIVER_SIGNATURE_DATA)
  }

  function podResultSigPadUp() {
    podResultSigPad.drawing = false, podResultSigPadCommit()
  }

  function podResultSigPadClear() {
    var c = podResultSigPad.canvas;
    if (!c) return;
    var ctx = podResultSigPad.ctx,
      ratio = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, c.width / ratio, c.height / ratio), podResultSigPad.hasInk = false;
    var wrap = u("#podResultSigPadWrap");
    wrap && wrap.classList.remove("has-signature");
    RECEIVER_SIGNATURE_DATA = null;
    var sigImg = u("#podResultSignatureImg");
    sigImg && (sigImg.hidden = !0, sigImg.removeAttribute("src"))
  }

  function podResultSigPadResize() {
    var c = podResultSigPad.canvas;
    if (!c) return;
    var ratio = window.devicePixelRatio || 1,
      w2 = c.clientWidth || 600,
      h2 = c.clientHeight || 140,
      savedData = podResultSigPad.hasInk ? c.toDataURL() : null;
    c.width = w2 * ratio, c.height = h2 * ratio;
    var ctx = c.getContext("2d");
    ctx.scale(ratio, ratio), ctx.lineWidth = 2, ctx.lineCap = "round", ctx.lineJoin = "round",
      ctx.strokeStyle = "#0F2748", podResultSigPad.ctx = ctx;
    savedData && podResultSigPadLoad(savedData, true)
  }

  function podResultSigPadLoad(dataUrl, isResizeRedraw) {
    if (!podResultSigPad.canvas || !dataUrl) return;
    var img = new Image;
    img.onload = function() {
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
      ctx.clearRect(0, 0, w2, h2), ctx.drawImage(img, dx, dy, dw, dh);
      podResultSigPad.hasInk = true;
      var wrap = u("#podResultSigPadWrap");
      wrap && wrap.classList.add("has-signature");
      isResizeRedraw || podResultSigPadCommit()
    }, img.src = dataUrl
  }

  function initPodResultSignaturePad() {
    var c = u("#podResultSignaturePad");
    if (!c) return;
    if (podResultSigPad.canvas !== c) {
      podResultSigPad.canvas = c, podResultSigPad.hasInk = false;
      c.addEventListener("pointerdown", podResultSigPadDown), c.addEventListener("pointermove",
        podResultSigPadMove), window.addEventListener("pointerup", podResultSigPadUp)
    }
    podResultSigPadResize(),
      !podResultSigPad.hasInk && RECEIVER_SIGNATURE_DATA && podResultSigPadLoad(RECEIVER_SIGNATURE_DATA, true)
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
    html2canvas: "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
    jspdf: "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
  };

  function loadScriptOnce(src) {
    return new Promise(function(resolve, reject) {
      var existing = document.querySelector('script[src="' + src + '"]');
      if (existing) return void(existing.getAttribute("data-loaded") === "1" ? resolve() :
        existing.addEventListener("load", function() {
          resolve()
        }));
      var el = document.createElement("script");
      el.src = src, el.async = !0, el.onload = function() {
        el.setAttribute("data-loaded", "1"), resolve()
      }, el.onerror = function() {
        reject(new Error("Failed to load " + src))
      }, document.head.appendChild(el)
    })
  }

  function ensurePdfLibs() {
    var need = [];
    window.html2canvas || need.push(loadScriptOnce(PDF_LIBS.html2canvas));
    window.jspdf && window.jspdf.jsPDF || need.push(loadScriptOnce(PDF_LIBS.jspdf));
    return need.length ? Promise.all(need) : Promise.resolve()
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
      html + "</body></html>";
    try {
      var blob = new Blob([page], {
          type: "text/html"
        }),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url, a.download = "Proof_of_Delivery_" + fileSafeId + ".html", document.body
        .appendChild(a), a.click(), a.remove(), setTimeout(function() {
          URL.revokeObjectURL(url)
        }, 4e3), R("PDF export unavailable offline — downloaded an HTML copy instead.")
    } catch (err) {
      console.error(gr, "POD download fallback failed:", err), window.print()
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
        type: mime
      })
    } catch (err) {
      return console.error(gr, "dataUrlToFile() failed:", err), null
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
    return v = (v || "").trim(), "—" === v ? "" : v
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
    pdfUploaded: false
  };

  function podZohoDate(d) {
    return p(d.getDate()) + "-" + h[d.getMonth()] + "-" + d.getFullYear()
  }

  function podZohoDateTime(d) {
    return podZohoDate(d) + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds())
  }

  function podBuildResultMeta(cfg, now) {
    cfg = cfg || {};
    var cfgDate = String(cfg.date || "").trim();
    return {
      /* wt() already passes "dd-MMM-yyyy"; the dispatch flow passes the
         long display date, so fall back to today in Zoho's format. */
      dateZoho: /^\d{2}-[A-Za-z]{3}-\d{4}$/.test(cfgDate) ? cfgDate : podZohoDate(now),
      receivedAtZoho: podZohoDateTime(now),
      items: (cfg.items || []).map(function(it) {
        return {
          name: it.name,
          qty: it.qty,
          receivedQty: it.receivedQty,
          pendingQty: it.pendingQty,
          price: it.price
        }
      }),
      savedRecordId: null,
      itemRowsSaved: 0,
      signatureUploaded: false,
      pdfUploaded: false
    }
  }

  function podPriceLabel(val) {
    return null == val || "" === val || isNaN(Number(val)) ? "—" : Number(val).toFixed(2)
  }

  /* Order total = sum of price x total qty, only when at least one item
     actually has a price; otherwise the placeholder is kept. */
  function podOrderTotalLabel(items) {
    var any = !1,
      total = 0;
    (items || []).forEach(function(it) {
      null == it.price || isNaN(Number(it.price)) || (any = !0, total += Number(it.price) * (Number(it.qty) || 0))
    });
    return any ? total.toFixed(2) : "—"
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
        Received_by_print_name: "podResultReceivedByName"
      };
    Object.keys(textFieldMap).forEach(function(formField) {
      var v = podResultDomValue(textFieldMap[formField]);
      v && (payload[formField] = v)
    });
    /* Weight is a Decimal field: a non-numeric string (e.g. "12 kg") makes
       Creator reject the whole record, so only a real number is sent. */
    var weightTxt = podResultDomValue("podResultWeight");
    if (weightTxt) {
      var weightNum = parseFloat(String(weightTxt).replace(/,/g, ""));
      isNaN(weightNum) || (payload.Weight = weightNum)
    }
    /* Date_field1 is a Date field and Date_and_Time_Received a Date-Time
       field — Creator only accepts "dd-MMM-yyyy" / "dd-MMM-yyyy HH:mm:ss",
       not the human-readable text shown on the popup. */
    POD_RESULT_META.dateZoho && (payload.Date_field1 = POD_RESULT_META.dateZoho);
    POD_RESULT_META.receivedAtZoho && (payload.Date_and_Time_Received = POD_RESULT_META.receivedAtZoho);
    /* Driver ID must always be the logged-in driver's own ID, taken
       directly from the session rather than trusting the DOM text
       (which is normally the same value, but this guarantees it). */
    payload.Driver_ID = String(s && s.id || podResultDomValue("podResultDriverId") || "");
    payload.Driver_ID || delete payload.Driver_ID;
    return payload
  }

  /* One ORDER_DETAILS row per item on the popup's Order Details table:
     Item_Name, Total_Qty, Received_Qty, Pending_Qty and — only when the
     item has a price — Price and Order_Total_AUD (price x Total Qty). */
  function buildOrderDetailsRows() {
    return (POD_RESULT_META.items || []).map(function(it, idx) {
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
        row.Order_Total_AUD = Math.round(Number(it.price) * total * 100) / 100
      }
      return row
    })
  }

  /* Creator answers HTTP 200 with a non-3000 code for validation errors,
     and rejects (status/responseText) for HTTP errors. Normalise the
     first kind into a thrown Error so both take the same path. */
  function podCreatorResponseError(res) {
    if (!res) return "";
    var code = res.code;
    void 0 === code && res.result && res.result[0] && (code = res.result[0].code);
    if (void 0 === code || 3e3 === code) return "";
    var first = res.result && res.result[0] || {},
      detail = res.message || first.message || "";
    var errObj = res.error || first.error;
    if (errObj) try {
      detail += (detail ? " " : "") + JSON.stringify(errObj)
    } catch (x) {}
    return "Creator rejected the record (code " + code + (detail ? ": " + detail : "") + ")"
  }

  function podRecordId(res) {
    var d = res && (res.data || res.result && res.result[0] && res.result[0].data);
    return d && (d.ID || d.id) || null
  }

  function podAddRecord(formName, data) {
    return ZOHO.CREATOR.DATA.addRecords({
      form_name: formName,
      payload: {
        data: data
      }
    }).then(function(res) {
      var bad = podCreatorResponseError(res);
      if (bad) {
        var er = new Error(formName + ": " + bad);
        er.creatorResponse = res;
        throw er
      }
      return res
    })
  }

  function podIsPermissionError(err) {
    var raw = "";
    try {
      raw = "string" == typeof err ? err : JSON.stringify(err)
    } catch (x) {
      raw = String(err)
    }
    if (err && err.message) raw += " " + err.message;
    return /"?status"?\s*[:=]\s*403/.test(raw) || /\b289[5-9]\b/.test(raw) || /permission denied/i.test(raw)
  }

  function podSaveErrorMessage(err) {
    if (podIsPermissionError(err)) return "Zoho Creator refused the save (HTTP 403 / code 2899 — " +
      "\"Permission denied to add record(s)\"). This is a Creator permission setting, not something " +
      "this dashboard's code can override: give the portal profile this driver logs in with Add + View " +
      "permission on the POD_PDF and ORDER_DETAILS forms (and View + Edit on the POD_PDF1 and " +
      "ORDER_DETAILS_Report reports), then press Save again.";
    return _r(err)
  }

  /* Adds ORDER_DETAILS rows one by one, linked to the POD_PDF record through
     the subform's Booking_ID lookup. Only used as the fallback when the
     nested add below is rejected. Resumes from meta.itemRowsSaved so a retry
     never duplicates rows that already went in. */
  function podAddOrderDetailsRows(parentId, rows) {
    var meta = POD_RESULT_META;
    return rows.reduce(function(chain, row, idx) {
      return idx < meta.itemRowsSaved ? chain : chain.then(function() {
        var data = {};
        Object.keys(row).forEach(function(k) {
          data[k] = row[k]
        });
        data.Booking_ID = parentId;
        return podAddRecord("ORDER_DETAILS", data).then(function() {
          meta.itemRowsSaved = idx + 1
        }).catch(function(err) {
          console.error(gr, "ORDER_DETAILS item " + (idx + 1) + " of " + rows.length +
            " failed to save:", err);
          throw err
        })
      })
    }, Promise.resolve())
  }

  function podUploadOne(recordId, fieldName, file) {
    return ZOHO.CREATOR.FILE.uploadFile({
      report_name: POD_PDF_REPORT_NAME,
      id: recordId,
      field_name: fieldName,
      file: file
    }).then(function(res) {
      var bad = podCreatorResponseError(res);
      if (bad) throw new Error(bad);
      return res
    })
  }

  /* Friendly explanation for HTTP 403 / code 2897 on an attachment upload.
     Attaching a file to an existing record is an UPDATE in Zoho Creator's
     permission model, so a portal profile that may Add a POD_PDF record
     (which is why the POD and its items save fine) can still be refused
     here. This is a Creator permission setting, not something widget code
     can override, so the message tells the driver/admin exactly what to
     change. */
  function podAttachPermissionMessage(labels) {
    return "Zoho Creator saved the POD, but refused to attach the " + labels.join(" and ") +
      " (HTTP 403 / code 2897 \u2014 \"Permission denied to update record(s)\"). Attaching a file counts as " +
      "editing the record, so the portal profile this driver signs in with needs Edit permission on the " +
      POD_PDF_REPORT_NAME + " report, and the POD_File_upload and Received_by_signature fields must be " +
      "editable for that profile. Everything else on the POD is saved; once an admin enables that, press " +
      "Save to retry the attachment (or use Download to keep a copy of the PDF)."
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
    if (!window.ZOHO.CREATOR.FILE || !ZOHO.CREATOR.FILE.uploadFile) return console.error(gr,
      "ZOHO.CREATOR.FILE.uploadFile is not available — signature/PDF not uploaded."), Promise
      .resolve(["The file upload API isn't available, so the signature/PDF were not attached."]);
    if (needSig) {
      var sigFile = dataUrlToFile(RECEIVER_SIGNATURE_DATA, "Signature_" + fileSafeId + ".png");
      sigFile && jobs.push({
        label: "signature",
        field: "Received_by_signature",
        file: sigFile,
        ok: !1,
        onDone: function() {
          meta.signatureUploaded = !0
        }
      })
    }
    if (needPdf) {
      var pdfFile = new File([pdfBlob], "Proof_of_Delivery_" + fileSafeId + ".pdf", {
        type: "application/pdf"
      });
      jobs.push({
        label: "PDF",
        field: "POD_File_upload",
        file: pdfFile,
        ok: !1,
        onDone: function() {
          meta.pdfUploaded = !0
        }
      })
    }
    var denied = !1;
    return jobs.reduce(function(chain, job) {
      return chain.then(function() {
        if (denied) return;
        return podUploadOne(recordId, job.field, job.file).then(function() {
          job.ok = !0, job.onDone()
        }).catch(function(err) {
          console.error(gr, "POD_PDF " + job.label + " upload failed:", err);
          podIsPermissionError(err) ? denied = !0 : warnings.push("The " + job.label +
            " could not be attached (" + _r(err) + ").")
        })
      })
    }, Promise.resolve()).then(function() {
      if (denied) warnings.unshift(podAttachPermissionMessage(jobs.filter(function(j) {
        return !j.ok
      }).map(function(j) {
        return j.label
      })));
      return warnings
    })
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
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA) return Promise.resolve({
      preview: !0,
      warnings: []
    });
    var meta = POD_RESULT_META,
      rows = buildOrderDetailsRows(),
      ensureParent;
    if (meta.savedRecordId) ensureParent = Promise.resolve(meta.savedRecordId);
    else {
      var payload = buildPodPdfPayload(),
        withItems = {};
      Object.keys(payload).forEach(function(k) {
        withItems[k] = payload[k]
      });
      rows.length && (withItems.ORDER_DETAILS = rows);

      var takeId = function(res, itemsAlreadySaved) {
        var id = podRecordId(res);
        if (!id) throw new Error(
          "The POD_PDF record was saved but Zoho returned no record ID, so the items, signature and PDF could not be linked to it."
          );
        meta.savedRecordId = id;
        meta.itemRowsSaved = itemsAlreadySaved ? rows.length : 0;
        return id
      };
      /* Preferred path: the items go in the same request as the parent,
         as the ORDER_DETAILS subform (Creator's documented way to add a
         parent with its subform rows, all-or-nothing). */
      ensureParent = podAddRecord("POD_PDF", withItems).then(function(res) {
        return takeId(res, !0)
      }, function(err) {
        if (!rows.length || podIsPermissionError(err)) throw err;
        console.warn(gr,
          "POD_PDF add with nested ORDER_DETAILS rows was rejected — retrying with the parent alone, then adding the item rows one by one:",
          err);
        return podAddRecord("POD_PDF", payload).then(function(res) {
          return takeId(res, !1)
        })
      })
    }
    return ensureParent.then(function(id) {
      var itemsDone = rows.length && meta.itemRowsSaved < rows.length ? podAddOrderDetailsRows(id, rows) :
        Promise.resolve();
      return itemsDone.then(function() {
        return podUploadAttachments(id, pdfBlob, fileSafeId)
      }).then(function(warnings) {
        return {
          id: id,
          warnings: warnings
        }
      })
    })
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

  function buildPodPdf(doc) {
    return ensurePdfLibs().then(function() {
      if (!window.html2canvas || !window.jspdf || !window.jspdf.jsPDF)
        throw new Error("PDF libraries unavailable after load");
      /* iOS Safari refuses canvases above ~16.7 million pixels (the render
         silently fails and the PDF is skipped), so the scale is lowered
         for a long POD instead of always using 2x. */
      var estH = Math.max(doc.scrollHeight, 1200),
        renderScale = Math.max(1, Math.min(2, Math.sqrt(14e6 / (PDF_RENDER_WIDTH_PX * estH))));
      return window.html2canvas(doc, {
        scale: renderScale,
        useCORS: !0,
        backgroundColor: "#ffffff",
        windowWidth: PDF_RENDER_WIDTH_PX,
        windowHeight: Math.max(doc.scrollHeight, window.innerHeight || 0),
        scrollX: 0,
        scrollY: 0,
        ignoreElements: function(el) {
          return el.hasAttribute && el.hasAttribute("data-pdf-exclude")
        },
        onclone: function(clonedDoc) {
          /* #podResultSignatureImg stays hidden on screen (the pad
             canvas is the visible control); unhide it only in the
             clone html2canvas renders, so the exported PDF/PNG shows
             the actual signature instead of nothing. */
          var cloneSigImg = clonedDoc.getElementById("podResultSignatureImg");
          cloneSigImg && (cloneSigImg.hidden = !1);
          /* Belt-and-braces on top of windowWidth above: pin the cloned
             sheet itself to the desktop A4 width and force the desktop
             (row) arrangement for the two-column and sign-off blocks,
             so the capture can never fall back to the mobile stacked
             layout even if a host page overrides the iframe width. */
          var clonedSheet = clonedDoc.querySelector(".poddoc-sheet");
          clonedSheet && (clonedSheet.style.width = "210mm", clonedSheet.style.minWidth = "210mm");
          var wideBlocks = clonedDoc.querySelectorAll(
            ".poddoc-sheet .two-col, .poddoc-sheet .signoff-cols");
          for (var i = 0; i < wideBlocks.length; i++) wideBlocks[i].style.flexDirection = "row"
        }
      })
    }).then(function(canvas) {
      var jsPDF = window.jspdf.jsPDF,
        pdf = new jsPDF({
          unit: "mm",
          format: "a4",
          orientation: "portrait"
        }),
        pageW = pdf.internal.pageSize.getWidth(),
        pageH = pdf.internal.pageSize.getHeight(),
        imgW = pageW,
        imgH = canvas.height * imgW / canvas.width,
        /* JPEG (white background is already opaque) keeps the PDF a
           fraction of the size of PNG, so it uploads reliably on mobile data. */
        imgData = canvas.toDataURL("image/jpeg", .92);
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
          sliceCanvas.width = canvas.width, sliceCanvas.height = sliceH;
          sliceCanvas.getContext("2d").drawImage(canvas, 0, rendered, canvas.width, sliceH, 0,
            0, canvas.width, sliceH);
          var sliceData = sliceCanvas.toDataURL("image/jpeg", .92),
            sliceImgH = sliceH / pxPerMm;
          first || pdf.addPage(), first = !1, pdf.addImage(sliceData, "JPEG", 0, 0, imgW,
            sliceImgH), rendered += sliceH
        }
      }
      return pdf
    })
  }

  function podResultFileSafeId() {
    return String(u("#podResultAssignedTripId") ? u("#podResultAssignedTripId").textContent :
      "POD").replace(/[^a-z0-9]+/gi, "_")
  }

  function downloadPodResult() {
    var doc = u("#podResultDoc");
    if (!doc) return;
    var fileSafeId = podResultFileSafeId(),
      btn = u("#btnDownloadPod"),
      btnLabel = btn && btn.querySelector("span");
    btn && (btn.disabled = !0);
    btnLabel && (btnLabel.textContent = "Preparing…");
    buildPodPdf(doc).then(function(pdf) {
      pdf.save("Proof_of_Delivery_" + fileSafeId + ".pdf"), R(
        "Proof of Delivery downloaded as a PDF.")
    }).catch(function(err) {
      console.error(gr, "POD PDF export failed, falling back to HTML download:", err),
        downloadPodResultAsHtmlFallback(doc, fileSafeId)
    }).finally(function() {
      btn && (btn.disabled = !1), btnLabel && (btnLabel.textContent = "Download")
    })
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
    btn && (btn.disabled = !0, btn.textContent = "Saving…");
    var pdfFailed = !1;

    function done(msg, isError) {
      btn && (btn.disabled = !1, btn.textContent = "Save");
      if (isError) return void(errEl && (errEl.textContent = msg, errEl.hidden = !1));
      R(msg);
      /* Give the driver a moment to see the confirmation toast
         before the popup closes and the app returns to the
         Assigned Trip page — an instant jump away would make the
         save feel like it never happened. */
      setTimeout(function() {
        Y("trip")
      }, 900)
    }
    /* The PDF is best-effort: if it can't be rendered the record's fields,
       item rows and signature are still saved. It is skipped when an
       earlier attempt already attached it. */
    (POD_RESULT_META.pdfUploaded ? Promise.resolve(null) : buildPodPdf(doc).then(function(pdf) {
      return pdf.output("blob")
    }).catch(function(err) {
      pdfFailed = !0;
      console.error(gr, "buildPodPdf() failed before POD_PDF save, saving without the PDF:", err);
      return null
    })).then(function(blob) {
      return savePodPdfToZohoCreator(blob, fileSafeId)
    }).then(function(result) {
      if (result && result.preview) return done("Preview mode — POD not saved");
      /* Update the Trip details "POD Completion" KPI right away, then
         reconcile it with Creator in the background. */
      podKpiMarkCompleted(podKpiSplitIds(podResultDomValue("podResultBookingId")));
      refreshPodCompletionKpi();
      refreshStopsCompletedFromCreator(), scorePodOutcome(result.id);
      if (result.warnings && result.warnings.length) return done(
        "The POD and its items were saved to Zoho Creator, but: " + result.warnings.join(" ") +
        " Press Save to retry the attachment.", !0);
      done(pdfFailed ? "POD saved to Zoho Creator (without the PDF attachment)." :
        "POD saved to Zoho Creator.")
    }).catch(function(err) {
      console.error(gr, "saveDeliveryRecordToZoho() failed:", err);
      done("Couldn't save the POD to Zoho Creator: " + podSaveErrorMessage(err), !0)
    })
  }

  async function wt() {
    var e = u("#podErr");
    e.hidden = !0;
    var t = u("#inPodStatus"),
      r = t ? t.value : "";
    if (!r) return u("#fPodStatus") && u("#fPodStatus").classList.add("is-bad"), e.textContent =
      "Select a POD status from the dropdown.", void(e.hidden = !1);
    u("#fPodStatus") && u("#fPodStatus").classList.remove("is-bad");
    var n = c.hub;
    if (!n) return e.textContent = "No hub selected — go back to check-in.", void(e.hidden = !1);
    if (!K.tripRecordId) return console.error(gr, "no active trip", K), e.textContent =
      "Start a trip first — this check-in isn't linked to a trip yet.", void(e.hidden = !1);
    var i = CURRENT_POD_ITEMS.map(function(e) {
        var t = document.querySelector('[data-pid="' + e.id + '"]'),
          r = document.querySelector('[data-recv="' + e.id + '"]'),
          receivedQty = r && Number(r.value) || 0,
          pendingQty = Math.max(0, (Number(e.qty) || 0) - receivedQty);
        return {
          id: e.id,
          name: e.name,
          delivered: !!t && t.checked,
          qty: Number(e.qty) || 0,
          price: e.price,
          receivedQty: receivedQty,
          pendingQty: pendingQty
        }
      }),
      sig = At("#inPodSignatureData"),
      deliveredCount = i.filter(function(e) {
        return e.delivered
      }).length;
    l.unshift({
      hub: n,
      date: c.date || k(),
      status: r,
      items: i,
      notes: u("#podNotes").value.trim(),
      signature: sig,
      savedAt: (new Date).toLocaleTimeString("en-AU", {
        hour: "2-digit",
        minute: "2-digit"
      })
    }), Dt(), updateStopsCompletedKpi();
    var empId = await resolveEmployeeFormId(),
      todayD = new Date,
      zohoDate = p(todayD.getDate()) + "-" + h[todayD.getMonth()] + "-" + todayD.getFullYear(),
      itemSummary = i.length ? "Items: " + deliveredCount + " of " + i.length + " delivered (" + i
      .map(function(e) {
        return e.name + " x" + e.receivedQty + (e.pendingQty ? " (pending " + e.pendingQty + ")" :
          "")
      }).join(", ") + ")" : "",
      notesParts = [u("#podNotes").value.trim(), itemSummary].filter(Boolean),
      PODSTATUS_MAP = {
        "Delivered": "Delivered",
        "Revised": "Revised",
        "Partially Received": "Partially received",
        "Cancelled": "Cancelled"
      },
      payload = {
        Trip_ID: cr2(K.tripRecordId || K.tripId),
        Trip_Name: cr2(K.tripRecordId || K.tripId),
        Driver_ID: cr2(empId || K.driverRecordId || K.driverEmployeeRecordId || ""),
        Driver_Name: cr2(empId || K.driverRecordId || K.driverEmployeeRecordId || ""),
        Date_field: zohoDate,
        Delivery_Status: PODSTATUS_MAP[r] || r,
        Notes: notesParts.join(" | ")
      };
    c.inTime && (payload.Check_in_Time = b(c.inTime)), c.outTime && (payload.Check_Out_Time = b(c
      .outTime));
    /* Booking_ID is now a Multi-Select lookup on Hub_Check_in_Check_Out1
       (one Trip can cover several Bookings), so Creator expects an array
       of {ID: "..."} references rather than a single value. Only IDs
       with a real Booking_Shipments record ID are sent — a selection
       that only ever resolved to a display label (no record found) is
       left out rather than sent as a bad reference. */
    var bookingIdRefs = (c.bookingIds || []).filter(function(bk) {
      return bk && bk.id
    }).map(function(bk) {
      return {
        ID: bk.id
      }
    });
    bookingIdRefs.length ? payload.Booking_ID = bookingIdRefs : console.warn(gr,
      "Hub_Check_in_Check_Out1 saved without Booking_ID — no Booking selected or no matching record id found",
      c.bookingIds);
    var podHubNameId = HUB_NAME_TO_ID[n] || null;
    podHubNameId ? payload.Hub_Name = podHubNameId : console.warn(gr,
      "Hub_Check_in_Check_Out1 saved without Hub_Name — no matching Locations record id found for",
      n);
    var podTripIdVal = payload.Trip_ID;
    var hubCheckinId = null;
    if (window.ZOHO && ZOHO.CREATOR && ZOHO.CREATOR.DATA) {
      var hubRes = await ZOHO.CREATOR.DATA.addRecords({
        form_name: "Hub_Check_in_Check_Out1",
        payload: {
          data: payload
        }
      }).catch(function(t) {
        console.error(gr, "Hub_Check_in_Check_Out1 save failed:", t), e.textContent =
          "Couldn't save: " + _r(t), e.hidden = !1
      });
      hubCheckinId = hubRes && hubRes.data && (hubRes.data.ID || hubRes.data.id) || null;
      var deliveredItems = i.filter(function(x) {
        return x.delivered && x.qty > 0
      });
      if (deliveredItems.length) {
        var podIdsRaw = [];
        for (var podItemIdx = 0; podItemIdx < deliveredItems.length; podItemIdx++) {
          var item = deliveredItems[podItemIdx];
          var podPayload = {
            Item: cr2(item.id),
            Quantity: item.qty,
            Received_Qty: item.receivedQty,
            Pending_Qty: item.pendingQty
          };
          /* Per the POD form schema, each POD item record is saved
             against the specific Trip_ID and Hub_Name it belongs to —
             not just linked indirectly through the parent
             Hub_Check_in_Check_Out1 record. */
          podTripIdVal && (podPayload.Trip_ID = podTripIdVal), podHubNameId && (podPayload
            .Hub_Name = podHubNameId), sig && (podPayload.Receiver_Signature = sig);
          var podSaveRes = await ZOHO.CREATOR.DATA
            .addRecords({
              form_name: "POD",
              payload: {
                data: podPayload
              }
            }).then(function(res) {
              return res && res.data && (res.data.ID || res.data.id) || null
            }).catch(function(err) {
              return console.error(gr, "POD item save failed:", err), null
            });
          podIdsRaw.push(podSaveRes)
        }
        var podIds = podIdsRaw.filter(Boolean);
        if (podIds.length && hubCheckinId && ZOHO.CREATOR.DATA.updateRecords) {
          var podLink = podIds.map(function(pid) {
            return {
              ID: pid
            }
          });
          ZOHO.CREATOR.DATA.updateRecords({
            form_name: "Hub_Check_in_Check_Out1",
            id: hubCheckinId,
            payload: {
              data: {
                POD: podLink
              }
            }
          }).catch(function(err) {
            console.error(gr, "Could not link POD records to Hub_Check_in_Check_Out1:", err)
          })
        }
      }
    }
    R("POD saved for " + n + " — " + r), populatePodResultPage({
      date: zohoDate,
      driverName: s.name,
      driverId: empId || s.id,
      tripId: podTripIdVal,
      bookingId: (c.bookingIds || []).map(function(bk) {
        return bk.name || bk.id
      }).join(", ") || null,
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
      items: i.map(function(it) {
        return {
          name: it.name,
          qty: it.qty,
          receivedQty: it.receivedQty,
          pendingQty: it.pendingQty,
          price: it.price,
          status: it.delivered ? "Delivered" : "Pending",
          note: "—"
        }
      })
    }), u("#podNotes").value = "", sigPadClear(), t && (t.value = ""), Y("podresult");
    var a = Q.findIndex(function(e) {
      return "next" === e.status
    });
    a >= 0 && (J = a), ie(), setTimeout(function() {
        var e = u("#hubDetail");
        e && e.closest(".card") && e.closest(".card").scrollIntoView({
          behavior: "smooth",
          block: "start"
        })
      }, 120),
      function() {
        var e = u("#hubDetail");
        if (e) {
          var t = e.closest(".card") || e;
          setTimeout(function() {
            t.scrollIntoView({
              behavior: "smooth",
              block: "start"
            }), t.classList.remove("is-flash"), t.offsetWidth, t.classList.add("is-flash")
          }, 60)
        }
      }()
  }

  function Dt() {
    var e = u("#podReportList");
    e && (l.length ? e.innerHTML = l.map(function(e) {
        var t = "Cancelled" === e.status ? "red" : "Partially Received" === e.status ? "amber" :
          "green",
          r = e.items.filter(function(e) {
            return e.delivered
          }).length;
        return '<li class="pod-report"><i class="status-dot ' + t +
          '" style="margin-top:5px"></i><div><p><b>' + e.hub + "</b> — " + e.status +
          "</p><time>" + r + " of " + e.items.length + " items delivered · " + e.date + " · " +
          e.savedAt + "</time></div></li>"
      }).join("") : e.innerHTML =
      '<li class="pod-report pod-report--empty">No POD reports saved yet. Check in at a hub to get started.</li>'
      )
  }
  var Tt = [];
  var Ct = null;

  function It() {
    var e = new Date,
      t = u("#inFuelDate"),
      r = u("#inFuelTime");
    t && (t.value = e.toLocaleDateString("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric"
    })), r && (r.value = e.toLocaleTimeString("en-AU", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }))
  }

  function St() {
    var e = Number((u("#inFuelQty") || {}).value) || 0,
      t = Number((u("#inFuelCost") || {}).value) || 0,
      r = u("#inFuelTotal");
    r && (r.value = e && t ? (e * t).toFixed(2) : "")
  }

  function Et(e) {
    var t = Rt(e);
    return t ? {
      url: t
    } : null
  }
  async function Lt() {
    console.groupCollapsed(gr, "saveFuel()");
    try {
      console.log(" First Block Passed");
      var e = u("#fuelErr");
      if (e.hidden = !0, xt(["fFuelCurrentLoc", "fFuelUrl", "fFuelType", "fFuelQty", "fFuelCost",
          "fFuelOdo"
        ]), !Pt([
          ["#inFuelCurrentLoc", "fFuelCurrentLoc", "Enter your current location."],
          ["#inFuelUrl", "fFuelUrl", "Enter or capture your live location URL."],
          ["#inFuelType", "fFuelType", "Select the fuel type."],
          ["#inFuelQty", "fFuelQty", "Enter the fuel quantity in litres."],
          ["#inFuelCost", "fFuelCost", "Enter the cost per unit."],
          ["#inFuelOdo", "fFuelOdo", "Enter the current mileage."]
        ], e)) return void console.warn(gr, "blocked: missing required field");
      var t = Number(At("#inFuelQty")),
        r = Number(At("#inFuelCost"));
      if (!(t > 0)) return u("#fFuelQty").classList.add("is-bad"), e.textContent =
        "Fuel quantity must be greater than zero.", void(e.hidden = !1);
      if (!(r > 0)) return u("#fFuelCost").classList.add("is-bad"), e.textContent =
        "Cost per unit must be greater than zero.", void(e.hidden = !1);
      if (console.log(" Second Block Passed"), !K.tripRecordId || !K.driverRecordId)
      return console.error(gr, "no active trip", K), e.textContent =
        "Start a trip first — this fuel entry isn't linked to a trip yet.", void(e.hidden = !1);
      console.log(" 3rd Block Passed");
      var n = await Vt(),
        i = new Date,
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
            minute: "2-digit"
          })
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
          Current_Odometer: a.mileage
        };
      if (console.log(" 4th Block Passed"), a.liveLocationUrl && (o.Live_Location_URL = Et(a
          .liveLocationUrl)), console.log(gr, "ACTIVE_TRIP:", K), console.table(o), !window
        .ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA) return console.warn(gr,
        "preview mode — not writing to Creator"), Tt.unshift(a), void R(
        "Preview mode — fuel entry not saved to Creator");
      var s, c = u("#btnSaveFuel");
      c && (c.disabled = !0);
      try {
        s = await ZOHO.CREATOR.DATA.addRecords({
          form_name: "Fuel_Entry",
          payload: {
            data: o
          }
        })
      } finally {
        c && (c.disabled = !1)
      }
      console.log(gr, "addRecords response:", s);
      var l = s && (s.code || s.result && s.result[0] && s.result[0].code);
      if (3e3 !== l && void 0 !== l) return console.error(gr,
          "Creator rejected the record. code:", l, s), e.textContent = "Couldn't save: " + _r(
        s), void(e.hidden = !1);
      console.log(gr, "saved. record id:", s && s.data && s.data.ID), Tt.unshift(a), [
        "#inFuelCurrentLoc", "#inFuelUrl", "#inFuelStation", "#inFuelType", "#inFuelQty",
        "#inFuelCost", "#inFuelTotal", "#inFuelOdo"
      ].forEach(function(e) {
        var t = u(e);
        t && (t.value = "")
      }), R("Fuel Entry Added Successfully — " + t.toFixed(2) + " L for $" + a.totalCost
        .toFixed(2)), Y("trip")
    } catch (e) {
      console.error(gr, "saveFuel failed:", e, _r(e));
      var d = u("#fuelErr");
      d && (d.textContent = "Couldn't save the fuel entry: " + _r(e), d.hidden = !1), R(
        "Couldn't save the fuel entry — check the console.")
    } finally {
      console.groupEnd()
    }
  }

  function Rt(e) {
    var t = (e || "").trim();
    return t ? (/^https?:\/\//i.test(t) || (t = "https://" + t.replace(/^\/+/, "")), t) : ""
  }

  function xt(e) {
    e.forEach(function(e) {
      var t = document.getElementById(e);
      t && t.classList.remove("is-bad")
    })
  }

  function At(e) {
    var t = u(e);
    return t ? String(t.value).trim() : ""
  }

  function Pt(e, t) {
    for (var r = 0; r < e.length; r++)
      if (!At(e[r][0])) {
        var n = document.getElementById(e[r][1]);
        return n && n.classList.add("is-bad"), t.textContent = e[r][2], t.hidden = !1, !1
      } return !0
  }

  function Nt() {
    var e = new Date;
    return e.getFullYear() + "-" + p(e.getMonth() + 1) + "-" + p(e.getDate())
  }

  function Ot() {
    var e = new Date;
    return p(e.getHours()) + ":" + p(e.getMinutes())
  }

  function Mt(e, t) {
    window.ZOHO && ZOHO.CREATOR && ZOHO.CREATOR.DATA && (void 0 === t.Trip_ID && (t.Trip_ID = K
        .tripId || X || ""), void 0 === t.Vehicle && (t.Vehicle = K.vehicleName || ""), void 0 ===
      t.Driver && (t.Driver = K.driverName || s.name || ""), void 0 === t.Driver_ID && (t
        .Driver_ID = K.driverId || s.id || ""), ZOHO.CREATOR.DATA.addRecords({
        form_name: e,
        payload: {
          data: t
        }
      }).catch(function() {}))
  }
  async function saveBfmSummary() {
    var totalHrs = +(o.workedMins / 60).toFixed(2),
      maxHrs = +(a.maxWorkPerShift / 60).toFixed(2),
      restHrs = Math.max(0, +(totalHrs - maxHrs).toFixed(2)),
      msg = "Work period logged — " + totalHrs + "h worked (limit " + maxHrs +
      "h). Rest required: " + restHrs + "h.";
    pushBfmNotification(restHrs > 0 ? "amber" : "green", msg);
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA) return void console.warn(gr,
      "preview mode — Driver_BFM_Notification not saved");
    try {
      var empId = await resolveEmployeeFormId(),
        driverRef = cr2(empId || K.driverRecordId || K.driverEmployeeRecordId || ""),
        tripRef = cr2(K.tripRecordId || K.tripId || ""),
        nowD = new Date,
        zohoDate = p(nowD.getDate()) + "-" + h[nowD.getMonth()] + "-" + nowD.getFullYear(),
        endTimeVal = p(nowD.getHours()) + ":" + p(nowD.getMinutes()) + ":" + p(nowD
          .getSeconds()),
        payload = {
          Trip_ID: tripRef,
          Trip_Name: tripRef,
          Driver_ID: driverRef,
          Driver_Name: driverRef,
          Date_field: zohoDate,
          Start_Time: b(o.startTime),
          End_Time: endTimeVal,
          Break_Hours: restHrs,
          Notification: msg
        };
      o.startLocation && (payload.Live_Location = o.startLocation);
      var urlObj = Et(o.startLocationUrl);
      urlObj && (payload.Live_Location_URL = urlObj);
      await ZOHO.CREATOR.DATA.addRecords({
        form_name: "Driver_BFM_Notification",
        payload: {
          data: payload
        }
      })
    } catch (err) {
      console.error(gr, "Driver_BFM_Notification save failed:", err)
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
        a < 0 && (a += 1440), r.value = (a / 60).toFixed(2)
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
    return function i(a) {
      return a >= n.length ? (console.warn(gr,
        "resolveDriverDetailsRecordId: no report candidate matched by email — falling back to cached ID",
        t), t) : kr({
        report_name: n[a],
        criteria: "(" + r + ' == "' + e.replace(/"/g, '\\"') + '")',
        field_config: "all",
        max_records: 5
      }).then(function(e) {
        var t = e && e.data || [];
        if (t.length) {
          var r = t[0].ID || t[0].id;
          return console.log(gr, "resolveDriverDetailsRecordId: matched via report", n[a],
            "-> ID", r), Ht = r, r
        }
        return i(a + 1)
      }).catch(function(e) {
        return console.warn(gr, "resolveDriverDetailsRecordId: report", n[a], "failed:", e),
          i(a + 1)
      })
    }(0)
  }
  async function qt() {
    console.groupCollapsed(gr, "saveIncident()");
    try {
      var e = u("#incErr");
      if (e.hidden = !0, xt(["fIncName", "fIncPlace", "fIncLoc", "fIncUrl", "fIncDate",
          "fIncTime", "fIncTrip", "fIncRepairs", "fIncParts", "fIncAltVeh", "fIncEndTime",
          "fIncDur"
        ]), !Pt([
          ["#inIncName", "fIncName", "Enter a name for this accident."],
          ["#inIncPlace", "fIncPlace", "Enter the accident place."],
          ["#inIncLoc", "fIncLoc", "Enter your live location."],
          ["#inIncUrl", "fIncUrl", "Enter or capture your live location URL."],
          ["#inIncDate", "fIncDate", "Enter the date of the accident."],
          ["#inIncTime", "fIncTime", "Enter the start time of the accident."],
          ["#inIncTrip", "fIncTrip", "Select the trip status."],
          ["#inIncRepairs", "fIncRepairs", "Select whether vehicle repairs are needed."],
          ["#inIncParts", "fIncParts", "Select whether vehicle parts are damaged."],
          ["#inIncAltVeh", "fIncAltVeh", "Select whether an alternative vehicle is required."],
          ["#inIncDur", "fIncDur", "Enter the total accident duration in hours."]
        ], e)) return void console.warn(gr, "blocked: missing required field");
      var t = Number(At("#inIncDur"));
      if (t < 0) return u("#fIncDur").classList.add("is-bad"), e.textContent =
        "Duration can't be negative.", void(e.hidden = !1);
      if (!K.tripRecordId || !K.driverEmployeeRecordId && !K.driverRecordId) return console.error(
          gr, "no active trip", K), e.textContent =
        "Start a trip first — this accident report isn't linked to a trip yet.", void(e
          .hidden = !1);
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
          durationHours: t
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
          Total_accident_duration_hours: r.durationHours
        };
      if (r.endTime && (i.End_Time = b(r.endTime)), r.liveLocationUrl && (i.Live_Location_URL =
          Et(r.liveLocationUrl)), console.log(gr, "ACTIVE_TRIP:", K), console.table(i), !window
        .ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA) return console.warn(gr,
        "preview mode — not writing to Creator"), Ft.unshift(r), void R(
        "Preview mode — accident report not saved to Creator");
      var a, o = u("#btnSaveIncident");
      o && (o.disabled = !0);
      try {
        a = await ZOHO.CREATOR.DATA.addRecords({
          form_name: "Report_An_Accident",
          payload: {
            data: i
          }
        })
      } finally {
        o && (o.disabled = !1)
      }
      console.log(gr, "addRecords response:", a);
      var s = a && (a.code || a.result && a.result[0] && a.result[0].code);
      if (3e3 !== s && void 0 !== s) return console.error(gr,
          "Creator rejected the record. code:", s, a), e.textContent = "Couldn't save: " + _r(
        a), void(e.hidden = !1);
      console.log(gr, "saved. record id:", a && a.data && a.data.ID), Ft.unshift(r), scoreAccident(r.name,
        a && a.data && a.data.ID), [
        "#inIncName", "#inIncPlace", "#inIncLoc", "#inIncUrl", "#inIncDate", "#inIncTime",
        "#inIncTrip", "#inIncRepairs", "#inIncParts", "#inIncAltVeh", "#inIncEndTime",
        "#inIncDur"
      ].forEach(function(e) {
        var t = u(e);
        t && (t.value = "")
      }), m("#viewIncident .yn-btn").forEach(function(e) {
        e.classList.remove("is-active")
      }), R("Accident report saved — " + r.name), Y("trip")
    } catch (e) {
      console.error(gr, "saveIncident failed:", e, _r(e));
      var c = u("#incErr");
      c && (c.textContent = "Couldn't save the accident report: " + _r(e), c.hidden = !1), R(
        "Couldn't save the accident report — check the console.")
    } finally {
      console.groupEnd()
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
    var e = (s.email || "").trim(),
      /* Fallback only to the authenticated driver's cached record, never
         to the trip's Primary Driver lookup. */
      t = s.recordId || K.driverEmployeeRecordId || null;
    if (!e) return Promise.resolve(t);
    var n = ["Employee_Form", "All_Employee_Form", "Employees", "Employee"];
    return function i(a) {
      return a >= n.length ? (console.warn(gr,
        "resolveEmployeeFormId: no report candidate matched by email — falling back to cached ID",
        t), t) : kr({
        report_name: n[a],
        criteria: "(" + r + ' == "' + e.replace(/"/g, '\\"') + '")',
        field_config: "all",
        max_records: 5
      }).then(function(e) {
        var t = e && e.data || [];
        if (t.length) {
          var r = t[0].ID || t[0].id;
          return console.log(gr, "resolveEmployeeFormId: matched via report", n[a], "-> ID",
            r), Ut = r, r
        }
        return i(a + 1)
      }).catch(function(e) {
        return console.warn(gr, "resolveEmployeeFormId: report", n[a], "failed:", e), i(a + 1)
      })
    }(0)
  }
  async function Zt() {
    var e = u("#vehErr");
    if (e.hidden = !0, xt(["fVehName", "fVehLoc", "fVehWhen", "fVehStatus", "fVehContinue",
        "fVehAltVeh", "fVehDamages"
      ]), Pt([
        ["#inVehName", "fVehName", "Enter the incident name."],
        ["#inVehLoc", "fVehLoc", "Enter the live location."],
        ["#inVehWhen", "fVehWhen", "Enter the incident date and time."],
        ["#inVehStatus", "fVehStatus", "Select a status."],
        ["#inVehContinue", "fVehContinue", "Select whether the driver can continue to drive."],
        ["#inVehAltVeh", "fVehAltVeh", "Select whether an alternative vehicle is required."],
        ["#inVehDamages", "fVehDamages", "Describe the damages."]
      ], e)) {
      if (!K.tripRecordId) return console.error(gr, "no active trip", K), e.textContent =
        "Start a trip first — this vehicle issue isn't linked to a trip yet.", void(e.hidden = !
          1);
      var t = {
        name: At("#inVehName"),
        location: At("#inVehLoc"),
        when: At("#inVehWhen"),
        status: At("#inVehStatus"),
        continueToDrive: At("#inVehContinue"),
        altVehicleRequired: At("#inVehAltVeh"),
        liveUrl: At("#inVehUrl"),
        damages: At("#inVehDamages"),
        notes: At("#inVehNotes")
      };
      Wt.unshift(t);
      var n = await resolveEmployeeFormId();
      if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA) return ["#inVehName", "#inVehLoc",
        "#inVehWhen", "#inVehNotes", "#inVehStatus", "#inVehContinue", "#inVehAltVeh",
        "#inVehUrl", "#inVehDamages"
      ].forEach(function(e) {
        var t = u(e);
        t && (t.value = "")
      }), m("#viewVehicleIssue .yn-btn").forEach(function(e) {
        e.classList.remove("is-active")
      }), R("Vehicle issue saved — " + t.name), void Y("trip");
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
        Notes: t.notes
      };
      t.liveUrl && (i.Live_location_URL = Et(t.liveUrl)), ZOHO.CREATOR.DATA.addRecords({
        form_name: "Vehicle_Issue",
        payload: {
          data: i
        }
      }).then(function() {
        ["#inVehName", "#inVehLoc", "#inVehWhen", "#inVehNotes", "#inVehStatus",
          "#inVehContinue", "#inVehAltVeh", "#inVehUrl", "#inVehDamages"
        ].forEach(function(e) {
          var t = u(e);
          t && (t.value = "")
        }), m("#viewVehicleIssue .yn-btn").forEach(function(e) {
          e.classList.remove("is-active")
        }), R("Vehicle issue saved — " + t.name), Y("trip")
      }).catch(function(t) {
        console.error(gr, "Vehicle_Issue save failed:", t), e.textContent =
          "Couldn't save: " + _r(t), e.hidden = !1
      })
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
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA) return Promise.resolve();
    var reports = [e.expenseTypes].concat(e.expenseTypesFallbacks || []).filter(function(v, i,
      arr) {
      return v && arr.indexOf(v) === i
    });
    var SYSTEM_KEYS = ["ID", "id", "Added_Time", "Added_User", "Modified_Time", "Modified_User",
      "ZC_Modified_Time", "ZC_Added_Time"
    ];

    function fallbackLabel(rec) {
      for (var k in rec) {
        if (SYSTEM_KEYS.indexOf(k) === -1 && "string" === typeof rec[k] && rec[k].trim())
          return rec[k].trim()
      }
      return ""
    }
    return function tryReport(n) {
      if (n >= reports.length) return void console.error(gr,
        "Could not read an Expense_Type report for the Expense Type dropdown (tried: " + reports
        .join(", ") + ").");
      return kr({
        report_name: reports[n],
        field_config: "all",
        max_records: 200
      }).then(function(res) {
        var rows = res && res.data || [];
        console.log(gr, "Expense_Type rows from", reports[n], "-", rows.length, "row(s)",
          rows[0] || null);
        if (!rows.length && n + 1 < reports.length) return tryReport(n + 1);
        var prev = sel.value,
          ids = [],
          options = [];
        rows.forEach(function(rec) {
          var label = cr(sr(rec, ["Expense_Type", "Expense_Type1", "Name"])) || fallbackLabel(
              rec),
            id = rec.ID || rec.id || "";
          label && id && options.push({
            id: id,
            label: label
          })
        }),
        /* The Expense_Type picklist is defined with sortorder =
           ascending in Zoho Creator, but that only governs Creator's
           own UI — the API returns rows in report order, so sort here
           to match what the driver expects to see. */
        options.sort(function(a, b) {
          return a.label.localeCompare(b.label)
        }), sel.innerHTML = options.length ?
          '<option value="" selected hidden disabled></option>' :
          '<option value="">No expense types found</option>', options.forEach(function(o) {
          var opt = document.createElement("option");
          opt.value = o.id, opt.textContent = o.label, sel.appendChild(opt), ids.push(o.id)
        }), prev && -1 !== ids.indexOf(prev) && (sel.value = prev), options.length && (sel
          .dataset.loaded = "1")
      }).catch(function(err) {
        return console.error(gr, "getRecords on", reports[n], "(Expense_Type) failed:", err),
          tryReport(n + 1)
      })
    }(0)
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
    return isNaN(mo) || isNaN(d) || !h[mo] ? "" : p(d) + "-" + h[mo] + "-" + y
  }

  function clearExpenseForm() {
    ["#inExpDate", "#inExpType", "#inExpAmount", "#inExpPayment", "#inExpTransRef", "#inExpNote",
      "#inExpLoc", "#inExpUrl"
    ].forEach(function(sel) {
      var el = u(sel);
      el && (el.value = "")
    });
    var f = u("#inExpReceipt");
    f && (f.value = "")
  }

  async function submitExpenseEntry() {
    var e = u("#expErr");
    if (e.hidden = !0, xt(["fExpDate", "fExpType", "fExpAmount", "fExpPayment"]), Pt([
        ["#inExpDate", "fExpDate", "Enter the expense date."],
        ["#inExpType", "fExpType", "Select an expense type."],
        ["#inExpAmount", "fExpAmount", "Enter the amount."],
        ["#inExpPayment", "fExpPayment", "Select a payment method."]
      ], e)) {
      if (!K.tripRecordId) return console.error(gr, "no active trip", K), e.textContent =
        "Start a trip first — this expense isn't linked to a trip yet.", void(e.hidden = !1);
      if (!K.vehicleRecordId) return console.error(gr, "no vehicle on active trip", K), e
        .textContent =
        "No vehicle found on this trip — the Expense Entry form requires one.", void(e.hidden = !
          1);
      var t = {
          date: At("#inExpDate"),
          type: At("#inExpType"),
          amount: At("#inExpAmount"),
          payment: At("#inExpPayment"),
          transRef: At("#inExpTransRef"),
          note: At("#inExpNote"),
          loc: At("#inExpLoc"),
          url: At("#inExpUrl")
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
          Description: descParts.join(" | ")
        };
      /* Live_Location / Live_Location_URL are real fields on the Expense_Entry
         Zoho form (see form export), so send them as their own fields instead
         of folding them into Description — that's what was silently dropping
         them from the saved record. Live_Location_URL is a url-type field, so
         it must be sent as {url: ...} just like Start Trip does above. */
      t.loc && (i.Live_Location = t.loc);
      t.url && (i.Live_Location_URL = {
        url: t.url
      });
      if (t.transRef && (i.Transaction_Reference = t.transRef), !window.ZOHO || !ZOHO.CREATOR || !
        ZOHO.CREATOR.DATA) return clearExpenseForm(), R("Expense entry saved — " + t.type), void Y(
        "trip");
      ZOHO.CREATOR.DATA.addRecords({
        form_name: "Expense_Entry",
        payload: {
          data: i
        }
      }).then(function(res) {
        /* Same fix as Start Trip / Fuel Entry: addRecords() resolves even
           when Creator rejects the record, so the response code must be
           checked explicitly or a rejected save still looks like success. */
        console.log(gr, "Expense_Entry addRecords response:", res);
        var expCode = res && (res.code || res.result && res.result[0] && res.result[0].code);
        if (void 0 !== expCode && 3e3 !== expCode) {
          console.error(gr, "Creator rejected the Expense_Entry record. code:", expCode, res);
          e.textContent = "Couldn't save: " + _r(res), e.hidden = !1;
          return
        }
        var newId = res && res.data && (res.data.ID || res.data.id) || null,
          fi = u("#inExpReceipt"),
          file = fi && fi.files && fi.files[0];
        if (!newId || !file) return clearExpenseForm(), R("Expense entry saved — " + t.type), void Y(
          "trip");
        if (!window.ZOHO.CREATOR.FILE || !ZOHO.CREATOR.FILE.uploadFile) {
          console.error(gr, "ZOHO.CREATOR.FILE.uploadFile is not available — Receipt was not uploaded.");
          clearExpenseForm(), R("Expense entry saved, but the receipt could not be uploaded."), Y("trip");
          return
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
          file: file
        }).then(function() {
          clearExpenseForm(), R("Expense entry saved — " + t.type), Y("trip")
        }).catch(function(err) {
          console.error(gr, "Expense receipt upload failed:", err);
          clearExpenseForm(), R("Expense entry saved, but the receipt upload failed: " + _r(err)), Y("trip")
        })
      }).catch(function(t) {
        console.error(gr, "Expense_Entry save failed:", t), e.textContent =
          "Couldn't save: " + _r(t), e.hidden = !1
      })
    }
  }
  var Gt = [];

  function jt() {
    var e = _(At("#inBrkStart")),
      t = _(At("#inBrkEnd"));
    return null !== e && null !== t && At("#inBrkStart") && At("#inBrkEnd") ? t >= e ? t - e : t +
      1440 - e : null
  }

  function br2() {
    w("brkCountLabel", "Break #" + (o.breakCount + 1) + " for this trip")
  }

  function zt() {
    var e = jt();
    w("brkLength", null === e ? "—" : f(e)), w("brkRequired", a.restBlock + " min"), w("brkStatus",
      null === e ? "—" : e >= a.restBlock ? "Qualifies as a rest block" : "Shorter than required")
  }
  async function Yt() {
    var e = u("#brkErr");
    if (e.hidden = !0, xt(["fBrkDate", "fBrkStart", "fBrkEnd", "fBrkLoc"]), Pt([
        ["#inBrkStart", "fBrkStart", "Enter your break start time."],
        ["#inBrkEnd", "fBrkEnd", "Enter your break end time."],
        ["#inBrkLoc", "fBrkLoc", "Enter your live location."]
      ], e)) {
      var t = jt();
      if (0 === t) return u("#fBrkEnd").classList.add("is-bad"), e.textContent =
        "End time cannot match the start time.", void(e.hidden = !1);
      if (!K.tripRecordId) return console.error(gr, "no active trip", K), e.textContent =
        "Start a trip first — this break isn't linked to a trip yet.", void(e.hidden = !1);
      var breakNo = o.breakCount + 1,
        statusTxt = (t >= a.restBlock ? "Qualifies as a rest block" : "Shorter than required") +
        " — Break #" + breakNo,
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
          status: statusTxt
        };
      Gt.unshift(r);
      var todayD = new Date,
        zohoDate = p(todayD.getDate()) + "-" + h[todayD.getMonth()] + "-" + todayD.getFullYear(),
        empId = await resolveEmployeeFormId(),
        payload = {
          Current_date: zohoDate,
          Trip_ID: cr2(K.tripRecordId || K.tripId),
          Trip_Name: cr2(K.tripRecordId || K.tripId),
          Driver_ID: cr2(empId || K.driverRecordId || K.driverEmployeeRecordId || ""),
          Driver_Name: cr2(empId || K.driverRecordId || K.driverEmployeeRecordId || ""),
          Start_time: b(r.start),
          End_time: b(r.end),
          Live_location: r.location,
          Total_break_duration: r.minutes,
          Required_Block: a.restBlock,
          Status: r.status
        };
      r.liveUrl && (payload.Live_Location_URL = {
        url: r.liveUrl
      }), window.ZOHO && ZOHO.CREATOR && ZOHO.CREATOR.DATA && (await ZOHO.CREATOR.DATA
        .addRecords({
          form_name: "Log_a_break",
          payload: {
            data: payload
          }
        }).catch(function(t) {
          console.error(gr, "Log_a_break save failed:", t), e.textContent =
            "Couldn't save: " + _r(t), e.hidden = !1
        })), o.breakCount = breakNo, t >= a.restBlock && (o.sinceRestMins = 0, o
        .restAlertShown = !1, o.restEscalated = !1, F()), o.restTakenMins += t, P(), ir(), [
        "#inBrkStart", "#inBrkEnd", "#inBrkLoc", "#inBrkUrl"
      ].forEach(function(e) {
        var t = u(e);
        t && (t.value = "")
      }), zt(), br2(), R("Break #" + breakNo + " saved — " + f(t) + " logged"), Y("trip")
    }
  }
  var Qt = null;

  function Jt(e) {
    0;
    var t = document.getElementById("mapHubFilter");
    t && t.value !== (e || "") && (t.value = e || ""), m(".mhub").forEach(function(t) {
      t.classList.toggle("is-active", !!e && t.getAttribute("data-hub") === e)
    });
    var r = document.getElementById("mapHubInfo");
    if (r)
      if (e) {
        var n = Q.filter(function(t) {
          return t.name === e
        })[0];
        if (n) {
          w("mapHubInfoBadge", "Stop #" + n.no), w("mapHubInfoName", n.name), w("mapHubInfoLoc", n
            .location);
          var i = document.getElementById("mapHubInfoStatus");
          i && (i.textContent = ne(n.status), i.className = "hubstatus is-" + n.status), r
            .hidden = !1
        } else r.hidden = !0
      } else r.hidden = !0
  }
  var Xt = 486 / 874,
    Kt = 0;

  function $t() {
    Qt && (clearInterval(Qt), Qt = null)
  }

  function er(e, t) {
    tr(), document.getElementById(e).hidden = !1, u("#scrim").hidden = !1, t && (t.classList.add(
        "is-open"), t.setAttribute("aria-expanded", "true")), document.body.style.overflow =
      "hidden"
  }

  function tr() {
    m(".panel").forEach(function(e) {
      e.hidden = !0
    }), u("#scrim").hidden = !0, m(".avbtn").forEach(function(e) {
      e.classList.remove("is-open"), e.setAttribute("aria-expanded", "false")
    }), m("[data-panel]").forEach(function(e) {
      e.classList.remove("is-open")
    }), document.body.style.overflow = ""
  }

  function rr() {
    m("[data-fill]").forEach(function(e, t) {
      var r = Math.max(0, Math.min(100, Number(e.getAttribute("data-fill")) || 0));
      e.style.width = "0", setTimeout(function() {
        e.style.width = r + "%"
      }, 90 + 55 * t)
    })
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
      cap: 400
    },
    BFM_LOG_STORE = {
      prefix: "skyway.bfmLog.",
      key: "",
      events: [],
      cap: 500
    },
    REST_WARN_TIMER = null;

  function evStorePrune(st) {
    var cut = Date.now() - a.scoreWindowDays * 864e5;
    st.events = st.events.filter(function(ev) {
      return ev && ev.ts >= cut
    }).sort(function(x, y) {
      return y.ts - x.ts
    }).slice(0, st.cap)
  }

  function evStoreSave(st) {
    if (!st.key) return;
    try {
      localStorage.setItem(st.key, JSON.stringify(st.events))
    } catch (err) {
      console.warn(gr, "score/log history could not be saved:", err)
    }
  }

  function evStoreSync(st) {
    var k = s.recordId ? st.prefix + s.recordId : "";
    if (!k) return !1;
    if (st.key === k) return !0;
    var stored = [];
    try {
      stored = JSON.parse(localStorage.getItem(k) || "[]") || []
    } catch (err) {
      stored = []
    }
    var seen = {},
      merged = [];
    st.events.concat(stored).forEach(function(ev) {
      ev && ev.id && !seen[ev.id] && (seen[ev.id] = !0, merged.push(ev))
    });
    st.key = k, st.events = merged, evStorePrune(st), evStoreSave(st);
    return !0
  }

  function evStoreAdd(st, ev) {
    evStoreSync(st);
    if (ev.k && st.events.some(function(x) {
        return x.k === ev.k
      })) return !1;
    ev.id = Date.now() + "-" + Math.random().toString(36).slice(2, 7), ev.ts = Date.now(), st
      .events.unshift(ev), evStorePrune(st), evStoreSave(st);
    return !0
  }

  function logStamp(ts) {
    var d2 = new Date(ts);
    return p(d2.getDate()) + " " + h[d2.getMonth()] + " " + p(d2.getHours()) + ":" + p(d2
      .getMinutes())
  }

  function scoreCalc() {
    var cats = {
        fatigue: 0,
        safety: 0,
        delivery: 0
      },
      total = 0;
    SCORE_STORE.events.forEach(function(ev) {
      var pts = Number(ev.pts) || 0;
      cats[ev.cat] = (cats[ev.cat] || 0) + pts, total += pts
    });
    return {
      score: Math.max(0, Math.round(100 - total)),
      cats: cats,
      events: SCORE_STORE.events
    }
  }

  function scoreBand(v) {
    return v >= 90 ? {
      label: "Excellent",
      color: "#0F9D58"
    } : v >= 75 ? {
      label: "Good",
      color: "#0F9D58"
    } : v >= 60 ? {
      label: "Fair",
      color: "#C77700"
    } : {
      label: "Needs improvement",
      color: "#D3352B"
    }
  }

  function scoreSetBar(id, valId, val) {
    var bar = u("#" + id),
      shown = null == val ? "\u2014" : String(val);
    w(valId, shown);
    if (!bar) return;
    bar.setAttribute("data-fill", null == val ? 0 : val);
    bar.className = null == val || val >= 85 ? "green" : val >= 70 ? "amber" : "red"
  }

  function scoreRenderPanel() {
    try {
      var ready = evStoreSync(SCORE_STORE);
      ready && evStorePrune(SCORE_STORE);
      var res = scoreCalc(),
        band = scoreBand(res.score);
      s.score = ready ? res.score : 0;
      w("scoreMini", ready ? res.score : "\u2014"), w("scoreBig", ready ? res.score : "\u2014"),
        w("scoreBand", ready ? band.label : "\u2014"), w("scoreBandMini", ready ? band.label :
          "\u2014");
      ["#scoreRing", "#scoreArc"].forEach(function(sel) {
        var el = u(sel);
        el && el.setAttribute("stroke", ready ? band.color : "#E3E8F0")
      });
      var n = res.events.length;
      w("scoreSub", ready ? (n ? n + (1 === n ? " deduction" : " deductions") : "No deductions") +
        " in the last " + a.scoreWindowDays + " days" : "Loading your score\u2026");
      var pct = function(c) {
        return ready ? Math.max(0, 100 - res.cats[c]) : null
      };
      scoreSetBar("scoreBarSafety", "scoreValSafety", pct("safety")), scoreSetBar(
        "scoreBarDelivery", "scoreValDelivery", pct("delivery")), scoreSetBar(
        "scoreBarFatigue", "scoreValFatigue", pct("fatigue")), scoreSetBar("scoreBarFuel",
        "scoreValFuel", null), scoreSetBar("scoreBarVehicle", "scoreValVehicle", null);
      var rules = u("#scoreRules");
      if (rules) {
        rules.innerHTML = "";
        [
          ["Rest shorter than a BFM tier requires", a.scorePerShortRest],
          ["Every " + a.overageBlockMins + " min driven past a BFM limit", a
            .scorePerOverageBlock
          ],
          ["Accident reported", a.scorePerAccident],
          ["Partially received delivery", a.scorePerPartialDelivery],
          ["Cancelled delivery", a.scorePerCancelledDelivery]
        ].forEach(function(r2) {
          var li = document.createElement("li"),
            sp = document.createElement("span"),
            bb = document.createElement("b");
          sp.textContent = r2[0], bb.textContent = "\u2212" + r2[1], li.appendChild(sp), li
            .appendChild(bb), rules.appendChild(li)
        });
        var note = document.createElement("li");
        note.textContent = "Deductions drop off after " + a.scoreWindowDays +
          " days. Fuel efficiency and vehicle care aren't scored yet.", rules.appendChild(note)
      }
      var ded = u("#scoreDeductions");
      if (ded) {
        ded.innerHTML = "";
        res.events.slice(0, 8).forEach(function(ev) {
          var li = document.createElement("li"),
            pt = document.createElement("span"),
            box = document.createElement("div"),
            tx = document.createElement("p"),
            tm = document.createElement("time");
          pt.className = "scoreded__pts", pt.textContent = "\u2212" + ev.pts, tx.textContent = ev
            .text || "", tm.textContent = logStamp(ev.ts), box.appendChild(tx), box
            .appendChild(tm), li.appendChild(pt), li.appendChild(box), ded.appendChild(li)
        });
        if (!res.events.length) {
          var none = document.createElement("li");
          none.className = "scoreded__none", none.textContent = "Nothing deducted.", ded
            .appendChild(none)
        }
      }
    } catch (err) {
      console.warn(gr, "scoreRenderPanel failed:", err)
    }
  }

  function scoreRefresh() {
    nr();
    var panel = u("#panelScore");
    panel && !panel.hidden && rr()
  }

  function scoreAdd(cat, pts, text, dedupeKey) {
    if (!(pts > 0)) return;
    try {
      evStoreAdd(SCORE_STORE, {
        cat: cat,
        pts: pts,
        text: text,
        trip: K && K.tripId || X || "",
        k: dedupeKey || ""
      })
    } catch (err) {
      console.warn(gr, "scoreAdd failed:", err)
    }
    scoreRefresh()
  }

  function scoreAccident(name, recordId) {
    scoreAdd("safety", a.scorePerAccident, "Accident reported: " + (name || "accident"), "acc:" + (
      recordId || Date.now()))
  }

  /* Called once a POD has been saved to Creator (both the hub flow and the
     dispatch flow end in the same POD Saved popup). */
  function scorePodOutcome(recordId) {
    var st = String(podResultDomValue("podResultStatus") || "").toLowerCase();
    if (!recordId) return;
    if (-1 !== st.indexOf("partial")) scoreAdd("delivery", a.scorePerPartialDelivery,
      "Partially received delivery", "pod:" + recordId);
    else if (-1 !== st.indexOf("cancel")) scoreAdd("delivery", a.scorePerCancelledDelivery,
      "Cancelled delivery", "pod:" + recordId)
  }

  function bfmLogAdd(type, tier, text, pts, tone) {
    try {
      evStoreAdd(BFM_LOG_STORE, {
        type: type,
        tier: tier,
        text: text,
        pts: Number(pts) || 0,
        tone: tone || "amber",
        trip: K && K.tripId || X || ""
      });
      var panel = u("#panelBfmLogs");
      panel && !panel.hidden && bfmLogsRender()
    } catch (err) {
      console.warn(gr, "bfmLogAdd failed:", err)
    }
  }

  function bfmLogsRender() {
    w("bfmLogDriverId", (s && s.id) || "—"), w("bfmLogTripId", K && K.tripId || X || "—");
    evStoreSync(BFM_LOG_STORE), evStorePrune(BFM_LOG_STORE);
    var events = BFM_LOG_STORE.events,
      limits = 0,
      shortRests = 0,
      pts = 0;
    events.forEach(function(ev) {
      "Limit reached" === ev.type && limits++, "Insufficient rest" === ev.type && shortRests++,
        pts += Number(ev.pts) || 0
    }), w("bfmLogLimits", String(limits)), w("bfmLogShort", String(shortRests)), w("bfmLogPts",
      String(pts));
    var host = u("#bfmLogList");
    if (!host) return;
    host.innerHTML = "";
    if (!events.length) {
      var empty = document.createElement("li");
      return empty.className = "bfmlog__empty", empty.textContent =
        "No BFM events recorded yet.", void host.appendChild(empty)
    }
    var lastDay = "";
    events.forEach(function(ev) {
      var d2 = new Date(ev.ts),
        day = p(d2.getDate()) + " " + h[d2.getMonth()] + " " + d2.getFullYear();
      if (day !== lastDay) {
        lastDay = day;
        var hd = document.createElement("li");
        hd.className = "bfmlog__day", hd.textContent = day, host.appendChild(hd)
      }
      var li = document.createElement("li"),
        box = document.createElement("div"),
        ttl = document.createElement("b"),
        tx = document.createElement("p"),
        tm = document.createElement("time");
      li.className = "bfmlog__item " + (ev.tone || "amber"), ttl.textContent = ev.type + (ev
          .tier && "BFM" !== ev.tier ? " \u00b7 " + ev.tier : ""), tx.textContent = ev.text || "",
        tm.textContent = logStamp(ev.ts) + (ev.trip ? " \u00b7 " + ev.trip : ""), box
        .appendChild(ttl), box.appendChild(tx), box.appendChild(tm), li.appendChild(box);
      if (ev.pts) {
        var pt = document.createElement("span");
        pt.className = "bfmlog__pts", pt.textContent = "\u2212" + ev.pts, li.appendChild(pt)
      }
      host.appendChild(li)
    })
  }

  function openBfmLogsPanel() {
    bfmLogsRender(), er("panelBfmLogs", null)
  }

  /* ---------- rest ends in 2 minutes ---------- */
  function clearRestWarnTimer() {
    REST_WARN_TIMER && (clearTimeout(REST_WARN_TIMER), REST_WARN_TIMER = null)
  }

  function armRestWarnTimer() {
    clearRestWarnTimer();
    if (!o.onBreak || o.restWarnNotified || !o.breakStartTs) return;
    var target = o.restTargetMins || a.tiers[0].restMins;
    if (target <= a.restWarnMins) return;
    var delay = o.breakStartTs + (target - a.restWarnMins) * 6e4 - Date.now();
    delay > 0 && (REST_WARN_TIMER = setTimeout(maybeNotifyRestEnding, delay))
  }

  function maybeNotifyRestEnding() {
    if (!o.tripStarted || !o.onBreak || o.restWarnNotified) return;
    var target = o.restTargetMins || a.tiers[0].restMins;
    if (target <= a.restWarnMins) return;
    var remainingMs = o.breakStartTs ? o.breakStartTs + 6e4 * target - Date.now() : 6e4 * (
      target - o.breakElapsedMins);
    if (remainingMs <= 0 || remainingMs > 6e4 * a.restWarnMins + 1500) return;
    o.restWarnNotified = !0, clearRestWarnTimer(), notifyRestEndingSoon(Math.max(1, Math.min(a
      .restWarnMins, Math.ceil(remainingMs / 6e4)))), saveTripSnapshot()
  }

  function notifyRestEndingSoon(mins) {
    var msg = "Your rest time will be completed in " + mins + (1 === mins ? " minute." :
      " minutes.");
    pushBfmNotification("amber", msg), O(), bfmLogAdd("Rest ending soon", "BFM", msg, 0, "amber");
    try {
      navigator.vibrate && navigator.vibrate([200, 100, 200])
    } catch (err) {}
    var toast = document.createElement("div");
    toast.className = "rest-alert", toast.setAttribute("role", "alert"), toast.style
      .borderLeftColor = "#C77700", toast.style.borderColor = "rgba(199,119,0,.3)", toast
      .innerHTML =
      '<svg width="20" height="20" style="flex:none;color:#C77700;margin-top:1px"><use href="#i-clock"/></svg><div style="flex:1"><b></b><p></p></div><button class="xbtn" aria-label="Dismiss">\u2715</button>',
      toast.querySelector("b").textContent = "Rest ending soon", toast.querySelector("p")
      .textContent = msg, toast.querySelector("button").addEventListener("click", function() {
        toast.remove()
      }), document.body.appendChild(toast), setTimeout(function() {
        toast.parentNode && toast.remove()
      }, 2e4)
  }

  function nr() {
    var e = 2 * Math.PI * 50,
      t = 2 * Math.PI * 14,
      r = u("#scoreRing"),
      n = u("#scoreArc");
    r && setTimeout(function() {
      r.style.strokeDashoffset = e * (1 - s.score / 100)
    }, 250), n && (n.setAttribute("stroke-dasharray", t), setTimeout(function() {
      n.style.transition = "stroke-dashoffset 1s ease", n.style.strokeDashoffset = t * (1 - s
        .score / 100)
    }, 350)), w("scoreMini", s.score), w("scoreBig", s.score), scoreRenderPanel()
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
    var t = Lr.slice().sort(function(e, t) {
      return t.ts - e.ts
    });
    var host = u("#alertList");
    host && (host.innerHTML = t.length ? t.map(function(e) {
      return '<li class="alert ' + e.tone + '"><i class="status-dot ' + e.tone +
        '" style="margin-top:5px"></i><div><p>' + e.text + "</p><time>" + relTime(e.ts) +
        "</time></div></li>"
    }).join("") : '<li class="alert-empty">No alerts right now.</li>')
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
    l.forEach(function(rep) {
      ("Delivered" === rep.status || "Partially Received" === rep.status) && (deliveredHubs[rep
        .hub] = !0)
    });
    var total = Q.length,
      completed = Q.filter(function(hub) {
        return "done" === hub.status || deliveredHubs[hub.name] || STOP_REMOTE_DONE[normKey(hub
          .name)]
      }).length;
    return {
      total: total,
      completed: completed,
      remaining: Math.max(0, total - completed)
    }
  }

  function updateStopsCompletedKpi() {
    var c = stopCounts(),
      total = c.total,
      completed = c.completed,
      valEl = u("#stopsKpiVal") || document.querySelector('[data-action="deliveries"] .kpi__val'),
      subEl = u("#stopsKpiSub") || document.querySelector('[data-action="deliveries"] .kpi__sub'),
      barEl = u("#stopsKpiBar");
    w("stopsAvail", total ? String(total) : "\u2014"), w("stopsDone", total ? String(completed) :
      "\u2014"), w("stopsLeft", total ? String(c.remaining) : "\u2014");
    if (!total) {
      valEl && (valEl.innerHTML = "\u2014 <small>/ \u2014</small>");
      subEl && (subEl.textContent = K.tripRecordId ? "No stops found for this trip yet" :
        "Start a trip to see its stops");
      return void(barEl && (barEl.style.width = "0%"))
    }
    valEl && (valEl.innerHTML = completed + " <small>/ " + total + "</small>");
    barEl && (barEl.style.width = Math.round(100 * completed / total) + "%");
    if (subEl) {
      var nextHub = Q.filter(function(hub) {
          return "next" === hub.status
        })[0],
        line1 = total + (1 === total ? " stop" : " stops") + " available \u00b7 " + completed +
        " completed \u00b7 " + c.remaining + " remaining";
      subEl.textContent = "";
      subEl.appendChild(document.createTextNode(line1));
      var line2 = nextHub ? "Next: " + nextHub.name : completed === total ? "All stops complete" :
        "";
      if (line2) {
        subEl.appendChild(document.createElement("br"));
        subEl.appendChild(document.createTextNode(line2))
      }
    }
  }

  /* Reads this trip's saved PODs from Creator (POD_PDF1) so hubs delivered
     before a reload / on another device still count as completed. Failure is
     non-fatal: the in-session count keeps working. */
  function refreshStopsCompletedFromCreator() {
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA || !(K.tripRecordId || K.tripId))
      return Promise.resolve();
    var parts = [];
    K.tripId && parts.push('Trip_ID == "' + escapeCriteria(K.tripId) + '"');
    K.tripRecordId && K.tripRecordId !== K.tripId && parts.push('Trip_ID == "' + escapeCriteria(K
      .tripRecordId) + '"');
    return kr({
      report_name: POD_PDF_REPORT_NAME,
      criteria: "(" + parts.join(" || ") + ")",
      field_config: "all",
      max_records: 1000
    }).then(function(res) {
      var set = {};
      (res && res.data || []).forEach(function(row) {
        var st = String(cr(row.Delivery_Status) || "").trim().toLowerCase();
        if ("delivered" !== st && "partially received" !== st) return;
        var loc = normKey(cr(row.Delivery_Location));
        loc && (set[loc] = !0)
      });
      STOP_REMOTE_DONE = set, updateStopsCompletedKpi()
    }).catch(function(err) {
      console.warn(gr, "Stops completed: could not read " + POD_PDF_REPORT_NAME + ":", err)
    })
  }

  function ar(e) {
    return String(e || "").toLowerCase().replace(/[^a-z0-9]/g, "")
  }

  function or(e, t) {
    if (!e) return null;
    for (var r = 0; r < t.length; r++) {
      var n = t[r];
      if (n && void 0 !== e[n] && null !== e[n] && "" !== e[n]) return n
    }
    for (var i = t.filter(Boolean).map(ar), a = Object.keys(e), o = 0; o < a.length; o++)
      if (-1 !== i.indexOf(ar(a[o]))) {
        var s = e[a[o]];
        if (null != s && "" !== s) return a[o]
      } return null
  }

  function sr(e, t) {
    var r = or(e, t);
    return r ? e[r] : ""
  }

  function cr(e) {
    return null == e ? "" : "string" == typeof e || "number" == typeof e ? String(e) : e
      .display_value || e.zc_display_value || e.ID || ""
  }

  function lr(e) {
    return e ? "string" == typeof e ? e : e.display_value || [e.prefix, e.first_name, e.last_name, e
      .suffix
    ].filter(Boolean).join(" ") : ""
  }

  function dr(e) {
    return e ? "string" == typeof e ? e : e.display_value || [e.district_city, e.state_province]
      .filter(Boolean).join(" ") : ""
  }

  function ur(e) {
    var t = function(e) {
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
          Dec: 11
        } [t[2]];
        if (void 0 !== r) return new Date(Number(t[3]), r, Number(t[1]))
      }
      var n = new Date(e);
      return isNaN(n) ? null : n
    }(e);
    return t ? Math.round((t - new Date) / 864e5) : null
  }

  function mr(e, t, r, n) {
    var i = document.getElementById(e),
      a = document.getElementById(t);
    if (a && (a.textContent = n || "--"), !r || !i) return;
    /* PHOTO FIX: some Zoho Creator image-field shapes come back as an object
       (e.g. {url:...} / {display_value:...} / {filepath:...}) rather than a
       plain string — passing that object straight to ZOHO.CREATOR.UTIL
       .setImageData()/img.src (both of which expect a string) silently
       failed and left the avatar stuck on initials. Unwrap it here first. */
    "object" == typeof r && (r = r.url || r.display_value || r.filepath || r.downloadUrl || "");
    if (!r) return;

    function done() {
      i.hidden = !1, a && (a.hidden = !0)
    }

    function fail() {
      i.hidden = !0, a && (a.hidden = !1)
    }
    i.onerror = fail;
    if (window.ZOHO && ZOHO.CREATOR && ZOHO.CREATOR.UTIL && ZOHO.CREATOR.UTIL.setImageData) {
      var call = ZOHO.CREATOR.UTIL.setImageData(i, r, done);
      call && call.catch && call.catch(fail)
    } else i.src = r, done()
  }

  function pr() {
    var e = u("#docViewerPopup"),
      t = u("#docViewerScrim");
    e && (e.hidden = !0), t && (t.hidden = !0), document.body.style.overflow = "";
    var r = u("#docViewerFrame");
    r && (r.src = "about:blank")
  }

  function fr(e, t, r, n) {
    var i, a = document.getElementById(t),
      o = document.getElementById(r),
      s = document.getElementById(n);

    function c(e) {
      o && (o.textContent = "On file"), a && a.classList.remove("is-missing"), s && (s.href = e, s
        .removeAttribute("aria-disabled"))
    }
    if (!e) return o && (o.textContent = i || "Not on file"), a && a.classList.add("is-missing"),
      void(s && (s.setAttribute("aria-disabled", "true"), s.removeAttribute("href")));
    if (o && (o.textContent = "Loading…"), window.ZOHO && ZOHO.CREATOR && ZOHO.CREATOR.UTIL && ZOHO
      .CREATOR.UTIL.setImageData) {
      var l = document.createElement("img");
      l.hidden = !0, document.body.appendChild(l), ZOHO.CREATOR.UTIL.setImageData(l, e, function() {
        c(l.src), l.remove()
      })
    } else c(e)
  }

  function hr() {
    w("docsDriverName", s.name || "—"), w("docsDriverId", s.id || "—");
    var e = document.getElementById("docsLookupNote"),
      t = document.getElementById("docsLookupNoteText");
    s.loaded ? e && (e.hidden = !0) : (t && (t.textContent =
        "Couldn't identify your driver record yet — documents will appear once it loads."), e && (
        e.hidden = !1)), fr(s.medicalCertificatePath, "docCardMedical", "docStatusMedical",
        "docLinkMedical"), fr(s.licenceDocumentPath, "docCardLicence", "docStatusLicence",
        "docLinkLicence"), fr(s.rightToWorkDocumentPath, "docCardRtw", "docStatusRtw",
      "docLinkRtw"), fr(s.identityDocumentCopyPath, "docCardIdentity", "docStatusIdentity",
        "docLinkIdentity"), w("driverDocsPopupName", s.name || "—"), w("driverDocsPopupId", s.id ||
        "—");
    var dp = document.getElementById("driverDocsPopupNote"),
      dpt = document.getElementById("driverDocsPopupNoteText");
    s.loaded ? dp && (dp.hidden = !0) : (dpt && (dpt.textContent =
        "Couldn't identify your driver record yet — documents will appear once it loads."), dp &&
      (dp.hidden = !1)), fr(s.medicalCertificatePath, "docCardMedicalDP", "docStatusMedicalDP",
      "docLinkMedicalDP"), fr(s.licenceDocumentPath, "docCardLicenceDP", "docStatusLicenceDP",
      "docLinkLicenceDP"), fr(s.rightToWorkDocumentPath, "docCardRtwDP", "docStatusRtwDP",
      "docLinkRtwDP"), fr(s.identityDocumentCopyPath, "docCardIdentityDP", "docStatusIdentityDP",
      "docLinkIdentityDP")
  }

  function openDriverDocsPopup() {
    hr(), u("#driverDocsPopup").hidden = !1, u("#driverDocsScrim").hidden = !1, document.body.style
      .overflow = "hidden"
  }

  function closeDriverDocsPopup() {
    u("#driverDocsPopup").hidden = !0, u("#driverDocsScrim").hidden = !0, document.body.style
      .overflow = ""
  }

  /* ---------- REPLACES vr() ----------
     The BFM_Monitoring form/report no longer exists in this Zoho
     Creator app, so this seeds the in-memory BFM counters from the
     hardcoded defaults in `a` directly, with no server lookup. */
  function vr() {
    /* BFM_Monitoring report/form no longer exists in this Zoho Creator
       app, so this simply seeds the in-memory BFM counters from the
       local defaults instead of attempting a lookup. */
    ACTIVE_BFM_RECORD.id = null, ACTIVE_BFM_RECORD.workMins = 0, ACTIVE_BFM_RECORD.maxMins = a
      .maxWorkPerShift, a.source = "Default BFM values";
    return Promise.resolve().then(function() {
      P(), ir()
    })
  }

  function yr() {
    var e, t, r = (e = s.name, (t = String(e || "").trim().split(/\s+/).filter(Boolean)).length ? (
      t[0][0] + (t[1] ? t[1][0] : "")).toUpperCase() : "--");
    w("hdrDriverId", s.id), w("hdrDriverName", function(e) {
        var t = String(e || "").trim().split(/\s+/).filter(Boolean);
        return t.length ? t.length > 1 ? t[0] + " " + t[1][0] + "." : t[0] : "—"
      }(s.name)), w("panelDriverName", s.name), w("panelDriverSub", s.id + (s.department ? " · " + s
        .department : "")), w("tripDriverLabel", s.name + " (" + s.id + ")"), w("tripsDriverName", s
        .name), w("drvSummaryName", s.name || "—"), w("drvSummaryId", s.id || "—"), mr(
        "hdrAvatarImg", "hdrAvatarInitials", s.photoPath, r), mr("panelAvatarImg",
        "panelAvatarInitials", s.photoPath, r), hr(), w("panelEmployeeId", s.id || "—"), w(
        "panelName", s.name || "—"), w("panelGender", s.gender || "—"), w("panelDob", s.dob || "—"),
      w("panelMobile", s.mobile || "—"), w("panelEmail", s.email || "—"), w("panelAddress", s
        .address || "—"), w("panelEmploymentType", s.employmentType || "—"), w("panelStarted", s
        .started || "—"), w("panelDepartment", s.department || "—"), w("panelDesignation", s
        .designation || "—"), w("panelIdentityDocType", s.identityDocType || "—"), w(
        "panelIdentityDocNumber", s.identityDocNumber || "—"), w("panelVisaExpiry", s
        .visaExpiryDate || "—"), w("panelLicenceNo", s
        .licenceNo || s.licenceNumber || "—"), w("panelLicenceType", s.licenceType || "—"), w(
        "panelLicenceClass", s.licenceClass || "—"), w(
        "panelLicenceIssueDate", s.licenceIssueDate || "—"), w("panelLicenceExpiry", s
        .licenceExpiry || "—"), w("panelLicenceStatus", s.licenceStatus || "—"), w(
        "panelBfmModule", s.fatigueModule || a.module || "—"), w("panelHeavyVehicleExperience", s
        .heavyVehicleExperience || "—"), w("panelMedicalFitnessStatus", s.medicalFitnessStatus ||
        "—"), w("panelMedicalCertExpiry", s.medicalCertExpiry || "—");
    var n = s.experience,
      i = "" !== n && !isNaN(Number(n));
    w("panelExperience", n ? i ? n + " years" : String(n) : "—"), w("panelLastCheckup", s
      .lastCheckupDate || "—");
    var a2 = document.getElementById("panelDocWarn"),
      o = document.getElementById("panelDocWarnText"),
      c = ur(s.licenceExpiry);
    a2 && o && (null !== c && c <= 30 ? (o.textContent = c < 0 ? "Licence expired " + Math.abs(c) +
      " days ago" : "Licence expires in " + c + " days", a2.hidden = !1) : a2.hidden = !0)
  }
  var gr = "[Driver Dashboard]";

  function br(e) {
    return String(e || "").trim().toLowerCase()
  }

  function _r(e) {
    if (!e) return "Unknown error.";
    if ("string" == typeof e) return e;
    if (e.message) return e.message;
    if (e.data && e.data.message) return e.data.message;
    if (Array.isArray(e.data) && e.data[0] && e.data[0].message) return e.data[0].message;
    try {
      var t = JSON.stringify(e);
      return t && "{}" !== t ? t : "Unknown error."
    } catch (t) {
      return String(e)
    }
  }
  async function kr(e) {
    return console.log("Get records Params:", e), ZOHO.CREATOR.DATA.getRecords(e).catch(function(
      e) {
      if (function(e) {
          var t = "";
          try {
            t = JSON.stringify(e)
          } catch (r) {
            t = String(e)
          }
          return /9280/.test(t) || /no records found/i.test(t)
        }(e)) return {
        data: []
      };
      throw e
    })
  }

  function wr(t) {
    var n = br(t),
      a = [e.employees].concat(e.employeesFallbacks || []).filter(function(e, t, r) {
        return e && r.indexOf(e) === t
      }),
      o = [],
      s = null;
    return function c(l) {
      if (l >= a.length) {
        if (s && function(e) {
            var t = "";
            try {
              t = JSON.stringify(e)
            } catch (r) {
              t = String(e)
            }
            return /"?status"?\s*[:=]\s*403/.test(t) || /2898/.test(t) || /permission denied/i
              .test(t)
          }(s)) throw new Error(
          'Zoho denied access to the Driver report (HTTP 403 / code 2898 — "Permission denied to view record(s)"). This is a Zoho Creator sharing setting, not something this dashboard\'s code can fix on its own. To resolve it: 1) In Zoho Creator, open this app → Settings → Portal (or Users, depending on your plan). 2) Find the report named ' +
          (o.length ? '"' + o.join('", "') + '"' : '"' + e.employees + '"') +
          " (whichever your Driver Form report is called) and confirm it is explicitly shared with the Client Portal role/profile this driver logs in as, with at least View permission. 3) Also confirm the underlying Driver Form itself is shared with that same portal role — a shared report on an unshared form still returns this error. This same query already works for admin users, which is expected: portal users are permission-scoped separately."
          );
        throw new Error("Could not read " + (o.length ? 'the report(s) "' + o.join('", "') + '"' :
            "the Driver report") + " (" + (s && s.message ? s.message : JSON.stringify(s)) +
          ").")
      }
      var d = a[l];
      return o.push(d),
        function(e, t, n) {
          var a = "(" + r + ' == "' + t.trim() + '")';
          return console.log("exactCriteria:", a), console.log(gr, "Trying report:", e,
            "| criteria:", a), kr({
            report_name: e,
            criteria: `(${r} == "${t.trim()}")`,
            field_config: "all",
            max_records: 200
          }).then(function(t) {
            var r = t && t.data || [];
            return console.log(gr, e, "exact-match rows:", r.length), r.length ? r[0] : (
              console.warn(gr, e,
                "— no exact match, retrying with a case/whitespace-insensitive scan."), kr({
                report_name: e,
                field_config: "all",
                max_records: 200
              }).then(function(t) {
                var r = t && t.data || [],
                  a = r.filter(function(e) {
                    return br(sr(e, i.email)) === n
                  });
                return console.log(gr, e, "fallback scan matched", a.length, "of", r
                    .length, "records"), a.length > 1 && console.warn(gr,
                    "Multiple records in", e, "share this email — using the first:", a), !
                  a.length && r.length && console.log(gr, "Emails seen in", e,
                    "for comparison:", r.map(function(e) {
                      return sr(e, i.email)
                    })), a[0] || null
              }))
          })
        }(d, t, n).catch(function(e) {
          return console.error(gr, "getRecords on", d, "failed:", e), s = e, c(l + 1)
        })
    }(0)
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

  /* Report names, most-likely first. "Shipment_Booking" is the real
     Booking_Shipments report in this app; the rest are fallbacks for
     renamed/duplicated reports. */
  var BOOKING_REPORT_CANDIDATES = ["Shipment_Booking", "Booking_Shipments",
    "Booking_Shipments1", "All_Shipment_Booking", "Bookings", "All_Bookings"
  ];
  var BOOKING_FIELD_CANDIDATES = {
    bookingId: ["Booking_ID", "Booking", "Booking_Id", "BookingID", "Booking_No", "Booking_Number"],
    /* Booking_Shipments.Assigned_Hub is a single lookup to Locations — it
       is only the booking's PRIMARY hub, so it is used solely as a
       last-resort fallback when no item row carries a hub. */
    assignedHub: ["Assigned_Hub"],
    pickupLocation: ["Pickup_Location"],
    deliveryLocation: ["Delivery_Location"],
    route: ["Route"],
    customer: ["Customer_Company_Name", "Customer_Name", "Customer", "Company_Name"],
    weight: ["Weight", "Total_Weight", "Total_loaded_Weight"],
    shipmentItems: ["Shipment_Items", "Shipment_Items1", "Shipment_Item", "Items"]
  };
  var SHIPMENT_ITEM_FIELD_CANDIDATES = {
    /* "Item" is the real field (displayname " Item"); the rest are
       fallbacks. Item_Name is listed first only so a renamed field still
       wins over the generic "Name". */
    name: ["Item_Name", "Item", "Product_Name", "Item_Description", "Product", "Name",
      "Description"
    ],
    /* "Total_Qty" added per the reference screenshot supplied — some
       reports use this exact field name instead of "Quantity". */
    qty: ["Quantity", "Qty", "Total_Qty", "Item_Quantity", "Units", "No_of_Units",
      "Total_Quantity"
    ],
    /* Optional unit price — only used when a Shipment_Items row actually
       carries one; never guessed. Feeds ORDER_DETAILS.Price. */
    price: ["Price", "Unit_Price", "Price_AUD", "Item_Price"],
    /* Shipment_Items.Booking_Shipments — the other end of the
       bidirectional link. Its displayformat is [ID], so its display value
       IS the booking's record ID. */
    bookingLink: ["Booking_Shipments", "Booking_ID", "Booking", "Shipment_Booking",
      "Booking_Shipment"
    ]
  };
  var SHIPMENT_ITEM_REPORT_CANDIDATES = ["All_Shipment_Items", "Shipment_Items1",
    "Shipment_Items", "Shipment_Items_Report"
  ];
  /* Shipment_Items.Hub_Name is the real hub field. Anything else is still
     picked up by the /hub/i key scan in hubRefsFromRow(). */
  var SHIPMENT_ITEM_HUB_FIELD = ["Hub_Name", "Delivery_Hub", "Hub", "Assigned_Hub",
    "Destination_Hub", "Drop_Hub"
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
  var TRIP_ASSIGNED_BOOKINGS_SUBFORM_CANDIDATES = ["Assigned_Bookings", "Assigned_Booking_Details",
    "Booking_Details", "Trip_Bookings", "Bookings", "Booking_Items"
  ];

  function assignedBookingsFromTripRecord() {
    var rec = K.record;
    if (!rec) return null;
    for (var i = 0; i < TRIP_ASSIGNED_BOOKINGS_SUBFORM_CANDIDATES.length; i++) {
      var raw = rec[TRIP_ASSIGNED_BOOKINGS_SUBFORM_CANDIDATES[i]];
      if (Array.isArray(raw) && raw.length) return raw;
      if (raw && Array.isArray(raw.data) && raw.data.length) return raw.data
    }
    return null
  }


  /* ---------- lookup-value helpers ---------- */

  function rawLookupId(v) {
    if (null == v) return "";
    if (Array.isArray(v)) v = v[0];
    return null == v ? "" : "string" == typeof v || "number" == typeof v ? String(v).trim() :
      String(v.ID || v.zc_id || v.id || "").trim()
  }

  function lookupLabel(v) {
    if (Array.isArray(v)) return v.map(lookupLabel).filter(Boolean).join(", ");
    return cr(v)
  }

  function normKey(v) {
    return String(null == v ? "" : v).trim().toLowerCase()
  }

  /* Splits any lookup value (string, number, {ID,display_value}, or an
     array of those) into the record IDs and the display labels it
     carries. Either side can be empty — the case the old ID-only code
     mishandled. */
  function refListFromValue(v) {
    var ids = [],
      names = [],
      arr = Array.isArray(v) ? v : (null == v ? [] : [v]);
    arr.forEach(function(x) {
      if (null == x || "" === x) return;
      if ("string" == typeof x || "number" == typeof x) {
        var sVal = String(x).trim();
        if (!sVal) return;
        /* Creator record IDs are long numeric strings; everything else is
           treated as a display label. */
        if (/^\d{8,}$/.test(sVal)) {
          -1 === ids.indexOf(sVal) && ids.push(sVal)
        } else -1 === names.indexOf(sVal) && names.push(sVal);
        return
      }
      if ("object" == typeof x) {
        var id = String(x.ID || x.zc_id || x.id || "").trim();
        id && -1 === ids.indexOf(id) && ids.push(id);
        var lb = String(x.display_value || x.zc_display_value || x.Name || "").trim();
        lb && -1 === names.indexOf(lb) && names.push(lb)
      }
    });
    return {
      ids: ids,
      names: names
    }
  }

  /* Every hub reference carried by one Shipment_Items row. */
  function hubRefsFromRow(row) {
    if (!row) return {
      ids: [],
      names: []
    };
    var key = or(row, SHIPMENT_ITEM_HUB_FIELD),
      out = key ? refListFromValue(row[key]) : {
        ids: [],
        names: []
      };
    if (!out.ids.length && !out.names.length) Object.keys(row).forEach(function(k) {
      if (!/hub/i.test(k)) return;
      var extra = refListFromValue(row[k]);
      extra.ids.forEach(function(id) {
        -1 === out.ids.indexOf(id) && out.ids.push(id)
      });
      extra.names.forEach(function(nm) {
        -1 === out.names.indexOf(nm) && out.names.push(nm)
      })
    });
    return out
  }

  function idListOf(raw) {
    if (null == raw) return [];
    var arr = Array.isArray(raw) ? raw : [raw];
    return arr.map(function(v) {
      return null == v ? "" : "string" == typeof v || "number" == typeof v ? String(v).trim() :
        String(v.ID || v.zc_id || v.id || "").trim()
    }).filter(Boolean)
  }

  function escapeCriteria(v) {
    return String(v == null ? "" : v).replace(/"/g, '\\"')
  }

  /* ---------- Trip -> Booking ---------- */

  /* Every key that could identify this trip's booking: the lookup's
     record ID and its visible Booking ID label ("BK-010"), because Zoho
     returns one, the other, or both depending on the report. */
  function getTripBookingIds() {
    var tripRec = K.record,
      refs = refListFromValue(tripRec ? sr(tripRec, ce.assignedBookings) : null),
      keys = [];
    refs.ids.concat(refs.names).forEach(function(key) {
      key = String(key || "").trim();
      key && -1 === keys.indexOf(key) && keys.push(key)
    });
    /* Last resort: scan the trip record for any booking-ish field. */
    if (!keys.length && tripRec) Object.keys(tripRec).forEach(function(k) {
      if (!/booking/i.test(k) || /date/i.test(k)) return;
      var extra = refListFromValue(tripRec[k]);
      extra.ids.concat(extra.names).forEach(function(key) {
        key = String(key || "").trim();
        key && -1 === keys.indexOf(key) && keys.push(key)
      })
    });
    return keys
  }

  var BOOKING_CACHE = {
    key: null,
    rows: null
  };

  /* Resolves the Booking_Shipments record(s) linked to the active trip.
     Tries a server-side criteria match on Booking_ID first (cheap), then
     falls back to a full scan matched on record ID or Booking ID label. */
  function fetchActiveTripShipmentBookings() {
    /* Preferred path: read the "Assigned Bookings" subform directly off
       the already-loaded Trip_Dispatch1 record — see
       assignedBookingsFromTripRecord() above for why. */
    var subformRows = assignedBookingsFromTripRecord();
    if (subformRows && subformRows.length) return console.log(gr,
      "[hub-debug] using Assigned Bookings subform straight off the Trip_Dispatch1 record:",
      subformRows), Promise.resolve(subformRows);
    var bookingIds = getTripBookingIds();
    console.log(gr, "[hub-debug] getTripBookingIds() ->", bookingIds);
    if (!bookingIds.length) return console.warn(gr,
      "[hub-debug] no Booking ID resolved off the Trip_Dispatch record — check ce.assignedBookings"
      ), Promise.resolve([]);
    var cacheKey = bookingIds.join("|");
    if (BOOKING_CACHE.key === cacheKey && BOOKING_CACHE.rows && BOOKING_CACHE.rows.length)
    return Promise.resolve(BOOKING_CACHE.rows);
    var wanted = bookingIds.map(normKey),
      /* Only the non-numeric keys are usable as a Booking_ID criteria
         value — the numeric one is the record ID. */
      labels = bookingIds.filter(function(v) {
        return !/^\d{8,}$/.test(String(v))
      });

    function remember(rows) {
      return rows && rows.length && (BOOKING_CACHE.key = cacheKey, BOOKING_CACHE.rows = rows),
        rows
    }

    return function tryReport(index) {
      if (index >= BOOKING_REPORT_CANDIDATES.length) return console.warn(gr,
        "[hub-debug] no booking report matched", bookingIds, "- tried:",
        BOOKING_REPORT_CANDIDATES), Promise.resolve([]);
      var reportName = BOOKING_REPORT_CANDIDATES[index],
        params = {
          report_name: reportName,
          field_config: "all",
          max_records: 200
        };
      if (labels.length) params.criteria = "(" + labels.map(function(v) {
        return 'Booking_ID == "' + escapeCriteria(v) + '"'
      }).join(" || ") + ")";
      return kr(params).then(function(res) {
        var rows = res && res.data || [];
        if (rows.length) return console.log(gr, "[hub-debug] booking report", reportName,
          "criteria match ->", rows.length, "row(s)"), remember(rows);
        /* Criteria found nothing (or wasn't usable) — scan the report. */
        return kr({
          report_name: reportName,
          field_config: "all",
          max_records: 200
        }).then(function(res2) {
          var allRows = res2 && res2.data || [];
          console.log(gr, "[hub-debug] booking report", reportName, "scan returned",
            allRows.length, "row(s)");
          var matches = allRows.filter(function(record) {
            var refs = refListFromValue(sr(record, BOOKING_FIELD_CANDIDATES.bookingId)),
              candidates = [String(record.ID || record.id || "")].concat(refs.ids).concat(
                refs.names).map(normKey);
            return wanted.some(function(k) {
              return -1 !== candidates.indexOf(k)
            })
          });
          if (!matches.length && allRows.length) console.log(gr,
            "[hub-debug] no match in", reportName, "— Booking IDs seen:", allRows.slice(0,
              20).map(function(rec) {
              return lookupLabel(sr(rec, BOOKING_FIELD_CANDIDATES.bookingId)) || rec.ID
            }));
          return matches.length ? remember(matches) : tryReport(index + 1)
        })
      }).catch(function(err) {
        return console.warn(gr, "[hub-debug] getRecords on booking report", reportName,
          "threw (likely not a report name in this app):", err), tryReport(index + 1)
      })
    }(0)
  }

  /* ---------- Booking -> Shipment Items ---------- */

  /* The Shipment_Items grid on the Shipment_Booking report is a
     concatenated formula string, so this normally yields nothing. It is
     kept for apps whose report exposes the grid as real rows. */
  function subformRowsFromBooking(booking) {
    if (!booking) return [];
    var key = or(booking, BOOKING_FIELD_CANDIDATES.shipmentItems),
      raw = key ? booking[key] : null,
      rows = Array.isArray(raw) ? raw : (raw && "object" == typeof raw ? [raw] : []);
    if (rows.length && "object" == typeof rows[0] && (or(rows[0],
        SHIPMENT_ITEM_FIELD_CANDIDATES.name) || or(rows[0], SHIPMENT_ITEM_FIELD_CANDIDATES
        .qty))) return rows;
    var found = [];
    Object.keys(booking).forEach(function(k) {
      var v = booking[k];
      if (!Array.isArray(v) || !v.length || "object" != typeof v[0]) return;
      if (or(v[0], SHIPMENT_ITEM_FIELD_CANDIDATES.name) || or(v[0],
          SHIPMENT_ITEM_FIELD_CANDIDATES.qty)) {
        console.log(gr, "[hub-debug] auto-detected a Shipment_Items grid under field", k);
        found = found.concat(v)
      }
    });
    return found
  }

  function shipmentItemsFromBookings(bookings) {
    return (bookings || []).reduce(function(items, booking) {
      return items.concat(subformRowsFromBooking(booking))
    }, [])
  }

  /* True when this Shipment_Items row belongs to one of these bookings —
     matched on the back-link's record ID or its label. */
  function rowLinksToBooking(row, bookingKeys) {
    var key = or(row, SHIPMENT_ITEM_FIELD_CANDIDATES.bookingLink),
      values = key ? [row[key]] : [];
    if (!values.length) Object.keys(row).forEach(function(k) {
      /booking/i.test(k) && !/date/i.test(k) && values.push(row[k])
    });
    var candidates = [];
    values.forEach(function(v) {
      var refs = refListFromValue(v);
      refs.ids.concat(refs.names).forEach(function(x) {
        candidates.push(normKey(x))
      })
    });
    return bookingKeys.some(function(k) {
      return -1 !== candidates.indexOf(k)
    })
  }

  var ITEM_CACHE = {
    key: null,
    rows: null
  };

  /* Primary source for hubs AND for POD items. Queries the Shipment_Items
     report and keeps the rows linked to this trip's booking(s); falls
     back to the booking's own grid if a report ever exposes real rows. */
  function fetchShipmentItemsForBookings(bookings) {
    bookings = bookings || [];
    if (!bookings.length) return Promise.resolve([]);
    var bookingRecordIds = bookings.map(function(b) {
        return String(b.ID || b.id || "").trim()
      }).filter(Boolean),
      bookingKeys = [];
    bookingRecordIds.forEach(function(id) {
      bookingKeys.push(normKey(id))
    });
    bookings.forEach(function(b) {
      var refs = refListFromValue(sr(b, BOOKING_FIELD_CANDIDATES.bookingId));
      refs.ids.concat(refs.names).forEach(function(x) {
        x && bookingKeys.push(normKey(x))
      })
    });
    var cacheKey = bookingKeys.join("|");
    if (ITEM_CACHE.key === cacheKey && ITEM_CACHE.rows && ITEM_CACHE.rows.length)
    return Promise.resolve(ITEM_CACHE.rows);

    function remember(rows) {
      return rows && rows.length && (ITEM_CACHE.key = cacheKey, ITEM_CACHE.rows = rows), rows
    }

    function tryReport(index) {
      if (index >= SHIPMENT_ITEM_REPORT_CANDIDATES.length) {
        /* Nothing from any report — last chance is the parent grid. */
        var embedded = shipmentItemsFromBookings(bookings);
        return console.warn(gr,
          "[hub-debug] no Shipment_Items report returned matching rows — tried:",
          SHIPMENT_ITEM_REPORT_CANDIDATES, "| grid fallback gave", embedded.length,
          "row(s)"), Promise.resolve(remember(embedded))
      }
      var reportName = SHIPMENT_ITEM_REPORT_CANDIDATES[index],
        params = {
          report_name: reportName,
          field_config: "all",
          max_records: 500
        };
      /* Shipment_Items.Booking_Shipments is a lookup, so it is queried by
         the parent record ID. */
      if (bookingRecordIds.length) params.criteria = "(" + bookingRecordIds.map(function(id) {
        return "Booking_Shipments == " + id
      }).join(" || ") + ")";
      return kr(params).then(function(res) {
        var rows = res && res.data || [];
        if (rows.length) return console.log(gr, "[hub-debug] item report", reportName,
          "criteria match ->", rows.length, "row(s)"), remember(rows);
        return kr({
          report_name: reportName,
          field_config: "all",
          max_records: 500
        }).then(function(res2) {
          var allRows = res2 && res2.data || [];
          console.log(gr, "[hub-debug] item report", reportName, "scan returned", allRows
            .length, "row(s)");
          var matches = allRows.filter(function(item) {
            return rowLinksToBooking(item, bookingKeys)
          });
          console.log(gr, "[hub-debug] item report", reportName, "matched", matches.length,
            "row(s) for booking keys", bookingKeys);
          return matches.length ? remember(matches) : tryReport(index + 1)
        })
      }).catch(function(err) {
        return console.warn(gr, "[hub-debug] getRecords on item report", reportName,
          "threw (likely not a report name in this app):", err), tryReport(index + 1)
      })
    }
    return tryReport(0)
  }

  /* ---------- hub matching + item mapping ---------- */

  function shipmentItemMatchesHub(item, hubName) {
    var refs = hubRefsFromRow(item),
      selectedHubId = HUB_NAME_TO_ID[hubName] || "";
    /* Primary: match on the Locations record ID — immune to label drift
       (whitespace, casing, or a disambiguation suffix). */
    if (selectedHubId && -1 !== refs.ids.map(String).indexOf(String(selectedHubId))) return !0;
    /* Fallback: normalized label match, for rows that carry only the
       hub's display value or before HUB_NAME_TO_ID is populated. */
    var wanted = normKey(hubName);
    if (!wanted) return !1;
    return refs.names.some(function(nm) {
      return normKey(nm) === wanted
    })
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
  var ITEM_REPORT_CANDIDATES = ["Items", "All_Items", "Item", "All_Item", "Products",
    "All_Products", "Item_Master", "All_Item_Master"
  ];
  var ITEM_NAME_FIELD_CANDIDATES = ["Item_Name", "Name", "Product_Name", "Title",
    "Item_Description", "Description"
  ];

  function looksLikeRawRecordId(v) {
    return /^\d{6,}$/.test(String(null == v ? "" : v).trim())
  }

  function ensureItemNamesLoaded() {
    if (ITEM_NAMES_LOAD_PROMISE) return ITEM_NAMES_LOAD_PROMISE;
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA) return ITEM_NAMES_LOAD_PROMISE =
      Promise.resolve();
    return ITEM_NAMES_LOAD_PROMISE = function tryReport(n) {
      if (n >= ITEM_REPORT_CANDIDATES.length) return Promise.resolve();
      return kr({
        report_name: ITEM_REPORT_CANDIDATES[n],
        field_config: "all",
        max_records: 1000
      }).then(function(res) {
        var rows = res && res.data || [];
        if (!rows.length) return tryReport(n + 1);
        rows.forEach(function(rec) {
          var id = rec.ID || rec.id;
          if (!id) return;
          var nm = cr(sr(rec, ITEM_NAME_FIELD_CANDIDATES));
          nm && !looksLikeRawRecordId(nm) && (ITEM_ID_TO_NAME[id] = nm)
        }), console.log(gr, "Item names resolved via", ITEM_REPORT_CANDIDATES[n], "-", Object
          .keys(ITEM_ID_TO_NAME).length, "item(s)")
      }).catch(function(err) {
        return console.warn(gr, "[item-name] getRecords on item report",
          ITEM_REPORT_CANDIDATES[n], "threw (likely not a report name in this app):", err),
          tryReport(n + 1)
      })
    }(0)
  }

  function resolveItemName(raw) {
    var val = cr(raw) || "Item";
    return looksLikeRawRecordId(val) && ITEM_ID_TO_NAME[val] ? ITEM_ID_TO_NAME[val] : val
  }

  function mapOneShipmentItem(item, index) {
    var qty = Number(sr(item, SHIPMENT_ITEM_FIELD_CANDIDATES.qty)) || 0,
      priceRaw = cr(sr(item, SHIPMENT_ITEM_FIELD_CANDIDATES.price)),
      priceNum = "" === priceRaw ? NaN : parseFloat(String(priceRaw).replace(/[^0-9.\-]/g, ""));
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
      pendingQty: 0
    }
  }

  function mapShipmentSubformItems(rows, hubName) {
    var seen = {};
    return (rows || []).reduce(function(items, item, index) {
      if (!shipmentItemMatchesHub(item, hubName)) return items;
      var mapped = mapOneShipmentItem(item, index),
        key = mapped.id || mapped.name + "|" + mapped.qty;
      return seen[key] ? items : (seen[key] = !0, items.push(mapped), items)
    }, [])
  }

  /* True when NO row carries any hub reference. Hub filtering is then
     impossible, and every item of the booking belongs to the hub the
     driver picked. */
  function rowsHaveNoHubInfo(rows) {
    return !(rows || []).some(function(r) {
      var refs = hubRefsFromRow(r);
      return refs.ids.length || refs.names.length
    })
  }

  /* ---------- signature pad (unchanged) ---------- */

  var sigPad = {
    canvas: null,
    ctx: null,
    drawing: false,
    hasInk: false,
    lastX: 0,
    lastY: 0
  };

  function sigPadResize() {
    var c = sigPad.canvas;
    if (!c) return;
    var wrap = c.parentElement,
      w = wrap ? wrap.clientWidth : c.width,
      ratio = window.devicePixelRatio || 1;
    if (!w) return;
    var savedData = sigPad.hasInk ? c.toDataURL() : null;
    c.width = Math.max(1, Math.round(w * ratio)), c.height = Math.max(1, Math.round(180 * ratio)), c
      .style.width = w + "px", c.style.height = "180px";
    var ctx = c.getContext("2d");
    ctx.scale(ratio, ratio), ctx.lineWidth = 2.2, ctx.lineCap = "round", ctx.lineJoin = "round", ctx
      .strokeStyle = "#0F2748", sigPad.ctx = ctx;
    if (savedData) {
      var img = new Image;
      img.onload = function() {
        ctx.drawImage(img, 0, 0, w, 180)
      }, img.src = savedData
    }
  }

  function sigPadPointerPos(e) {
    var r = sigPad.canvas.getBoundingClientRect();
    return {
      x: e.clientX - r.left,
      y: e.clientY - r.top
    }
  }

  function sigPadDown(e) {
    sigPad.drawing = true;
    var p = sigPadPointerPos(e);
    sigPad.lastX = p.x, sigPad.lastY = p.y;
    try {
      sigPad.canvas.setPointerCapture(e.pointerId)
    } catch (err) {}
  }

  function sigPadMove(e) {
    if (!sigPad.drawing) return;
    var p = sigPadPointerPos(e),
      ctx = sigPad.ctx;
    ctx.beginPath(), ctx.moveTo(sigPad.lastX, sigPad.lastY), ctx.lineTo(p.x, p.y), ctx.stroke(),
      sigPad.lastX = p.x, sigPad.lastY = p.y;
    if (!sigPad.hasInk) {
      sigPad.hasInk = true;
      var wrap = u("#sigPadWrap");
      wrap && wrap.classList.add("has-signature")
    }
  }

  function sigPadUp() {
    sigPad.drawing = false;
    var h = u("#inPodSignatureData");
    h && (h.value = sigPad.hasInk ? sigPad.canvas.toDataURL("image/png") : "")
  }

  function sigPadClear() {
    var c = sigPad.canvas;
    if (!c) return;
    var ctx = sigPad.ctx,
      ratio = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, c.width / ratio, c.height / ratio), sigPad.hasInk = false;
    var wrap = u("#sigPadWrap");
    wrap && wrap.classList.remove("has-signature");
    var h = u("#inPodSignatureData");
    h && (h.value = "")
  }

  function initPodSignaturePad() {
    var c = u("#podSignaturePad");
    if (!c) return;
    if (sigPad.canvas !== c) {
      sigPad.canvas = c, sigPad.hasInk = false;
      c.addEventListener("pointerdown", sigPadDown), c.addEventListener("pointermove", sigPadMove),
        window.addEventListener("pointerup", sigPadUp)
    }
    sigPadResize()
  }

  /* ---------- POD item list UI (unchanged) ---------- */

  function recalcPodItemPending(id) {
    var recvEl = document.querySelector('[data-recv="' + id + '"]'),
      pendEl = document.querySelector('[data-pending="' + id + '"]'),
      item = CURRENT_POD_ITEMS.filter(function(p) {
        return String(p.id) === String(id)
      })[0];
    if (!recvEl || !pendEl || !item) return;
    var recv = Math.max(0, Number(recvEl.value) || 0),
      pending = Math.max(0, (Number(item.qty) || 0) - recv);
    item.receivedQty = recv, item.pendingQty = pending, pendEl.textContent = String(pending)
  }

  function renderPodItemsUI() {
    var host = u("#podItemList"),
      summaryEl = u("#podSummaryLine");
    if (host) {
      if (CURRENT_POD_LOADING) return summaryEl && (summaryEl.hidden = !0), void(host.innerHTML =
        '<li class="pod-item pod-item--empty">Loading items…</li>');
      if (!CURRENT_POD_ITEMS.length) return summaryEl && (summaryEl.hidden = !0), void(host
        .innerHTML =
        '<li class="pod-item pod-item--empty">No items found for this booking/trip at this hub.</li>'
        );
      if (summaryEl) {
        var totalQty = CURRENT_POD_ITEMS.reduce(function(sum, p) {
          return sum + (Number(p.qty) || 0)
        }, 0);
        summaryEl.hidden = !1, summaryEl.innerHTML = "<span>" + CURRENT_POD_ITEMS.length +
          " item" + (1 === CURRENT_POD_ITEMS.length ? "" : "s") + " to deliver</span><span>" +
          totalQty + " total quantity</span>"
      }
      host.innerHTML = CURRENT_POD_ITEMS.map(function(p) {
        return '<li class="pod-item"><label class="pod-item__check"><input type="checkbox" data-pid="' +
          p.id + '" checked><span>' + p.name +
          '</span></label><div class="pod-item__qty"><span>Quantity</span><span class="pod-item__qty-val">' +
          p.qty +
          '</span></div><div class="pod-item__qty"><span>Received qty</span><input type="number" min="0" max="' +
          p.qty + '" data-recv="' + p.id + '" value="' + p.receivedQty +
          '"></div><div class="pod-item__qty"><span>Pending qty</span><span class="pod-item__qty-val" data-pending="' +
          p.id + '">' + p.pendingQty + '</span></div></li>'
      }).join(""), host.querySelectorAll("[data-recv]").forEach(function(el) {
        el.addEventListener("input", function() {
          recalcPodItemPending(el.getAttribute("data-recv"))
        })
      }), CURRENT_POD_ITEMS.forEach(function(p) {
        recalcPodItemPending(p.id)
      })
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
        v = base && typeof base == "object" ? base[parts[1]] : void 0
      } else v = rec[key];
      if (v !== void 0 && v !== null && "" !== v) {
        var n = Number(v);
        if (!isNaN(n) && 0 !== n) return n
      }
    }
    return null
  }
  var tripMapState = {
    map: null,
    markers: [],
    loadedForTrip: null,
    hubs: []
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
    refs: null
  };

  function resetTripHubCache() {
    TRIP_HUB_ID_CACHE.tripRecordId = null, TRIP_HUB_ID_CACHE.refs = null,
      BOOKING_CACHE.key = null, BOOKING_CACHE.rows = null,
      ITEM_CACHE.key = null, ITEM_CACHE.rows = null,
      HUB_PIPELINE_LOADED_FOR = null
  }

  function resolveTripHubRefs(forceRefresh) {
    var bookingIds = getTripBookingIds();
    if (!bookingIds.length) return Promise.resolve(null);
    var currentTripKey = K.tripRecordId || K.tripId || "";
    if (!forceRefresh && TRIP_HUB_ID_CACHE.tripRecordId === currentTripKey && TRIP_HUB_ID_CACHE
      .refs && (TRIP_HUB_ID_CACHE.refs.ids.length || TRIP_HUB_ID_CACHE.refs.names.length))
    return Promise.resolve(TRIP_HUB_ID_CACHE.refs);
    return fetchActiveTripShipmentBookings().then(function(bookings) {
      return fetchShipmentItemsForBookings(bookings).then(function(items) {
        var ids = [],
          names = [];
        items.forEach(function(rec) {
          var refs = hubRefsFromRow(rec);
          refs.ids.forEach(function(id) {
            -1 === ids.indexOf(id) && ids.push(id)
          });
          refs.names.forEach(function(nm) {
            -1 === names.indexOf(nm) && names.push(nm)
          })
        });
        /* Fallback: the booking's own Assigned_Hub, for bookings whose
           items carry no hub of their own. */
        if (!ids.length && !names.length) bookings.forEach(function(b) {
          var refs = refListFromValue(sr(b, BOOKING_FIELD_CANDIDATES.assignedHub));
          refs.ids.forEach(function(id) {
            -1 === ids.indexOf(id) && ids.push(id)
          });
          refs.names.forEach(function(nm) {
            -1 === names.indexOf(nm) && names.push(nm)
          })
        });
        var out = {
          ids: ids,
          names: names
        };
        console.log(gr, "[hub-debug] resolveTripHubRefs ->", out);
        /* Never cache an empty result: a transient miss must not poison
           every later lookup for this trip. */
        if (ids.length || names.length) TRIP_HUB_ID_CACHE.tripRecordId = currentTripKey,
          TRIP_HUB_ID_CACHE.refs = out;
        return out
      })
    })
  }

  /* Back-compat shim for anything expecting a plain ID array. */
  function resolveTripHubIds(forceRefresh) {
    return resolveTripHubRefs(forceRefresh).then(function(refs) {
      return refs ? refs.ids : null
    })
  }

  function locationMatchesHubRefs(rec, refs) {
    if (!refs) return !0;
    var recId = String(rec.ID || rec.id || "");
    if (recId && -1 !== refs.ids.map(String).indexOf(recId)) return !0;
    var nm = normKey(cr(sr(rec, t)));
    return !!nm && refs.names.some(function(x) {
      return normKey(x) === nm
    })
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
    if (!currentTripKey || HUB_PIPELINE_LOADED_FOR === currentTripKey) return Promise.resolve();
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA) return Promise.resolve();
    return resolveTripHubRefs().then(function(refs) {
      if (!refs || (!refs.ids.length && !refs.names.length)) return;
      var names = refs.names.length ? refs.names : refs.ids.map(String);
      Q = names.map(function(nm, i) {
        return {
          no: i + 1,
          name: nm,
          location: "",
          distance: "—",
          eta: "—",
          status: "upcoming",
          delivery: []
        }
      }), J = 0, HUB_PIPELINE_LOADED_FOR = currentTripKey, ie(), updateStopsCompletedKpi(),
        refreshStopsCompletedFromCreator()
    }).catch(function(err) {
      console.warn(gr, "rebuildHubPipelineFromBooking failed:", err)
    })
  }

  /* Every hub NAME tied to this trip's booking/shipment items, regardless
     of whether a matching Locations row (and lat/lng) is ever found. The
     map-hub filter is built from this list — a hub that hasn't been
     geocoded yet should still show up as a filter option, it just won't
     get a marker. */
  function fetchTripHubLocations() {
    return resolveTripHubRefs().then(function(refs) {
      if (!refs || (!refs.ids.length && !refs.names.length)) return [];
      /* Start from the names/ids we already know belong to this trip, so
         the filter list is correct even if the Locations lookup below
         fails entirely (wrong report name, no network, etc). */
      var byKey = {},
        order = [];

      function upsert(key, patch) {
        var norm = normKey(key);
        if (!norm) return;
        if (!byKey[norm]) byKey[norm] = {
          id: "",
          name: key,
          lat: null,
          lng: null,
          address: "",
          _norm: norm
        }, order.push(norm);
        Object.keys(patch || {}).forEach(function(k) {
          null != patch[k] && "" !== patch[k] && (byKey[norm][k] = patch[k])
        })
      }
      refs.names.forEach(function(nm) {
        upsert(nm, {
          name: nm
        })
      });
      var locCandidates = [e.locations].concat(e.locationsFallbacks || []).filter(function(v, i,
        arr) {
        return v && arr.indexOf(v) === i
      });
      return function tryLoc(idx) {
        if (idx >= locCandidates.length) return Object.keys(byKey).map(function(k) {
          return byKey[k]
        }).filter(function(h) {
          return h.name
        });
        return kr({
          report_name: locCandidates[idx],
          field_config: "all",
          max_records: 200
        }).then(function(res) {
          var rows2 = res && res.data || [],
            matched = rows2.filter(function(rec) {
              return locationMatchesHubRefs(rec, refs)
            });
          if (!matched.length && idx + 1 < locCandidates.length) return tryLoc(idx + 1);
          matched.forEach(function(rec) {
            var nm = cr(sr(rec, t)) || "Hub",
              lat = locNumField(rec, LOC_LAT_FIELDS),
              lng = locNumField(rec, LOC_LNG_FIELDS),
              addrRaw = rec.Hub_Location,
              addr = addrRaw && typeof addrRaw == "object" ? [addrRaw.address_line_1,
                addrRaw.address_line_2, addrRaw.district_city, addrRaw.state_province
              ].filter(Boolean).join(", ") : "";
            upsert(nm, {
              id: rec.ID || rec.id || "",
              name: nm,
              lat: lat,
              lng: lng,
              address: addr
            })
          });
          /* Keep the hub NAMES even when no Locations row matched — only
             the marker/coordinates are optional, the filter entry is not. */
          return order.map(function(k) {
            return byKey[k]
          }).filter(function(h) {
            return h.name
          })
        }).catch(function(err) {
          return console.warn(gr, "getRecords on", locCandidates[idx],
            "(Locations, trip map) failed:", err), tryLoc(idx + 1)
        })
      }(0)
    })
  }

  function ensureTripMapInit() {
    if (tripMapState.map) return tripMapState.map;
    var el = u("#tripMapOSM");
    /* BUG FIX: `L` inside this file is the page-loader helper (function L()
       near the top), which shadows the Leaflet global — that is what threw
       "L.map is not a function". Leaflet must be read from window.L. */
    if (!el || !window.L || typeof window.L.map != "function") return null;
    var map = window.L.map(el, {
      scrollWheelZoom: false
    }).setView([-25.2744, 133.7751], 4);
    /* Flat, uncluttered basemap (cream landmasses / light blue ocean, no
       roads or place labels) — matches the reference design instead of
       the busier default OSM raster style. */
    return window.L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
      attribution: "© OpenStreetMap contributors © CARTO",
      subdomains: "abcd",
      maxZoom: 20
    }).addTo(map), tripMapState.map = map, map
  }

  function selectMapHubOSM(name) {
    var hub = tripMapState.hubs.filter(function(h) {
        return h.name === name
      })[0],
      panel = u("#mapHubInfo"),
      filt = u("#mapHubFilter");
    if (filt && filt.value !== (name || "")) filt.value = name || "";
    if (!hub) return void(panel && (panel.hidden = !0));
    var hasCoords = null != hub.lat && null != hub.lng;
    panel && (w("mapHubInfoBadge", "Hub"), w("mapHubInfoName", hub.name), w("mapHubInfoLoc", hub
      .address || (hasCoords ? hub.lat.toFixed(5) + ", " + hub.lng.toFixed(5) :
        "Location coordinates not available")), panel.hidden = !1);
    var m = tripMapState.markers.filter(function(mk) {
      return mk._hubName === name
    })[0];
    m && tripMapState.map && (tripMapState.map.setView(m.getLatLng(), 13), m.openPopup())
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
      mapped = hubs.filter(function(h) {
        return null != h.lat && null != h.lng
      });
    if (!hubs.length) {
      chip && (chip.textContent = "No hubs found for this trip");
      filt && (filt.innerHTML = '<option value="">All hubs</option>');
      return
    }
    chip && (chip.textContent = hubs.length + " hub" + (1 === hubs.length ? "" : "s") +
      " on this trip" + (mapped.length < hubs.length ? " (" + mapped.length +
        " mapped)" : ""));
    var prevValue = filt && filt.value;
    filt && (filt.innerHTML = '<option value="">All hubs</option>', hubs.forEach(function(h) {
      var opt = document.createElement("option");
      opt.value = h.name, opt.textContent = h.name, filt.appendChild(opt)
    }), hubs.some(function(h) {
      return h.name === prevValue
    }) && (filt.value = prevValue), filt.onchange = function() {
      var v = filt.value;
      if (v) return void selectMapHubOSM(v);
      u("#mapHubInfo") && (u("#mapHubInfo").hidden = !0);
      var map = tripMapState.map,
        bounds = mapped.map(function(h) {
          return [h.lat, h.lng]
        });
      map && bounds.length && map.fitBounds(bounds, {
        padding: [36, 36],
        maxZoom: 13
      })
    })
  }

  /* Draws markers for whichever hubs currently have coordinates. Safe to
     call repeatedly (e.g. once the map library finishes loading after the
     hub list already rendered) — it just redraws the marker layer. */
  function renderTripMapMarkers() {
    var map = tripMapState.map,
      emptyEl = u("#tripMapEmpty"),
      hubs = tripMapState.hubs || [];
    if (tripMapState.markers.forEach(function(m) {
        map && map.removeLayer(m)
      }), tripMapState.markers = [], !map) return;
    var mapped = hubs.filter(function(h) {
      return null != h.lat && null != h.lng
    });
    if (!hubs.length) return void(emptyEl && (emptyEl.hidden = !1));
    if (!mapped.length) return void(emptyEl && (emptyEl.hidden = !1, emptyEl.textContent =
      "No hub coordinates available to plot for this trip yet."));
    emptyEl && (emptyEl.hidden = !0);
    var bounds = [];
    mapped.forEach(function(h) {
      var marker = window.L.marker([h.lat, h.lng]).addTo(map).bindPopup("<b>" + h.name + "</b>" + (h
        .address ? "<br>" + h.address : ""));
      marker._hubName = h.name, marker.on("click", function() {
        selectMapHubOSM(h.name)
      }), tripMapState.markers.push(marker), bounds.push([h.lat, h.lng])
    }), bounds.length && map.fitBounds(bounds, {
      padding: [36, 36],
      maxZoom: 13
    })
  }

  function renderTripMapHubs(hubs) {
    renderTripMapHubList(hubs), renderTripMapMarkers()
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
        return void(emptyEl && (emptyEl.hidden = !1, emptyEl.textContent =
          "Map couldn't load — check your connection and reopen this page."))
      }
      return void setTimeout(initTripMapWhenReady, 300)
    }
    TRIP_MAP_INIT_TRIES = 0;
    var map = ensureTripMapInit();
    map && (setTimeout(function() {
      map.invalidateSize(), renderTripMapMarkers()
    }, 60), renderTripMapMarkers())
  }

  function loadTripMapOSM() {
    /* Map tiles and hub data are independent: kick off both, neither one
       blocks the other. A slow tile CDN must not leave the hub filter
       stuck on "Loading hubs…" forever, and missing hub data must not
       keep the tiles from rendering. */
    initTripMapWhenReady();
    var currentTripId = K.tripRecordId || K.tripId || "";
    if (tripMapState.loadedForTrip === currentTripId && tripMapState.hubs.length)
    return void renderTripMapHubs(tripMapState.hubs);
    tripMapState.loadedForTrip = currentTripId;
    var chip = u("#mapHubCountText");
    chip && (chip.textContent = "Loading hubs…");
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA) return void renderTripMapHubs([]);
    fetchTripHubLocations().then(function(hubs) {
      renderTripMapHubs(hubs)
    }).catch(function(err) {
      console.error(gr, "loadTripMapOSM failed:", err), renderTripMapHubs([])
    })
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
    if (c.bookingIds && c.bookingIds.length) label = c.bookingIds.map(function(b) {
      return b.label
    }).filter(Boolean).join(", ");
    else if (BOOKING_ID_OPTIONS.length) label = BOOKING_ID_OPTIONS.map(function(o) {
      return o.label
    }).filter(Boolean).join(", ");
    else if (K.record) {
      /* getTripBookingIds() is used here instead of le(K.record,
         "assignedBookings") because it has an extra last-resort scan
         (any field whose name contains "booking") that le() doesn't —
         so if Zoho ever returns the Booking_ID multi-select under a
         slightly different key, or the exact-key lookup otherwise
         misses, the chip still finds it instead of showing "—". */
      var keys = getTripBookingIds();
      console.log(gr, "[booking-debug] updateBookingIdChip() fallback keys:", keys), label = keys
        .join(", ")
    }
    var tripLabel = K.tripId || "—";
    label = label || "—";
    var a = u("#checkinBookingIdChip");
    a && (a.textContent = "Trip ID: " + tripLabel + " · Booking ID: " + label);
    var b = u("#podBookingIdChip");
    b && (b.textContent = "Trip ID: " + tripLabel + " · Booking ID: " + label)
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
    return String((o && (o.id || o.label)) || "")
  }

  function renderBookingIdChecklist() {
    var host = u("#bookingIdList");
    if (!host) return;
    if (!BOOKING_ID_OPTIONS.length) return void(host.innerHTML =
      '<li class="booking-item booking-item--empty">No Booking IDs found for this Trip.</li>');
    /* Nothing chosen yet (e.g. first load for this trip) -> default to
       every Booking ID selected, since most trips cover all of them. */
    var selectedKeys = c.bookingIds && c.bookingIds.length ? c.bookingIds.map(function(b) {
      return String(b.id || b.label || "")
    }) : null;
    host.innerHTML = BOOKING_ID_OPTIONS.map(function(o) {
      var key = bookingOptionKey(o),
        checked = selectedKeys ? -1 !== selectedKeys.indexOf(key) : !0;
      return '<li class="booking-item"><label class="booking-item__check"><input type="checkbox" data-bid="' +
        String(o.id || "").replace(/"/g, "&quot;") + '" data-blabel="' + String(o.label || "")
        .replace(/"/g, "&quot;") + '"' + (checked ? " checked" : "") +
        '> <span>' + String(o.label || "") + '</span></label></li>'
    }).join(""), selectedKeys || syncSelectedBookingIdsFromChecklist()
  }

  /* Reads the checked boxes in #bookingIdList into c.bookingIds and
     refreshes the "Booking ID: …" chip to match. Bound to the
     checklist's (bubbling) change event, so it fires on every tick. */
  function syncSelectedBookingIdsFromChecklist() {
    var host = u("#bookingIdList");
    c.bookingIds = host ? Array.prototype.slice.call(host.querySelectorAll(
      'input[type="checkbox"]:checked')).map(function(cb) {
      return {
        id: cb.getAttribute("data-bid") || "",
        label: cb.getAttribute("data-blabel") || ""
      }
    }) : [], updateBookingIdChip()
  }

  /* Drops the cached checklist so a new trip doesn't show the previous
     trip's Booking IDs while the fresh list is still loading. */
  function resetBookingIdSelection() {
    BOOKING_ID_OPTIONS = [], c.bookingIds = []
  }

  /* Loads the Booking record(s) linked to the active Trip and (re)builds
     the checklist. Mirrors Dr() (Hub Name dropdown) — same
     fetchActiveTripShipmentBookings() source, so the Booking IDs offered
     here always match what the Hub pipeline is using. */
  function Fr() {
    var host = u("#bookingIdList");
    if (!host) return Promise.resolve();
    if (!K.tripRecordId) return BOOKING_ID_OPTIONS = [], host.innerHTML =
      '<li class="booking-item booking-item--empty">Start a trip to load Booking IDs.</li>', Promise
      .resolve();
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA) return Promise.resolve();
    host.innerHTML = '<li class="booking-item booking-item--empty">Loading Booking IDs…</li>';
    return fetchActiveTripShipmentBookings().then(function(bookings) {
      var seen = {};
      BOOKING_ID_OPTIONS = (bookings || []).map(function(b) {
        var label = lookupLabel(sr(b, BOOKING_FIELD_CANDIDATES.bookingId)) || b.ID || b.id || "";
        label = String(label).trim();
        return label ? {
          id: b.ID || b.id || null,
          label: label
        } : null
      }).filter(function(o) {
        return o && !seen[o.label] && (seen[o.label] = !0)
      }), console.log(gr, "[booking-debug] Booking ID checklist options:", BOOKING_ID_OPTIONS),
      renderBookingIdChecklist()
    }).catch(function(err) {
      console.error(gr, "Fr() (Booking ID checklist) failed:", err), host.innerHTML =
        '<li class="booking-item booking-item--empty">Could not load Booking IDs for this Trip.</li>'
    })
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
    if (!hubName) return void(el.hidden = !0);
    el.hidden = !1, el.textContent = "Checking items for this hub…";
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA) return void(el.textContent = "");
    return fetchActiveTripShipmentBookings().then(function(bookings) {
      return fetchShipmentItemsForBookings(bookings).then(function(rows) {
        var count = rowsHaveNoHubInfo(rows) ? rows.length : mapShipmentSubformItems(rows,
          hubName).length;
        el.hidden = !1, el.textContent = count + " shipment item" + (1 === count ? "" : "s") +
          " assigned to this hub"
      })
    }).catch(function(err) {
      console.error(gr, "Hub shipment item count lookup failed:", err);
      el.textContent = "Couldn't load the item count for this hub."
    })
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
    CURRENT_POD_LOADING = true, renderPodItemsUI();
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA) return CURRENT_POD_ITEMS = (d[
      hubName] || []).map(function(p) {
      return {
        id: p.id,
        name: p.name,
        qty: p.qty,
        receivedQty: p.qty,
        pendingQty: 0
      }
    }), CURRENT_POD_LOADING = false, void renderPodItemsUI();

    function finish(items, source) {
      console.log(gr, "POD items resolved via", source, "-", items.length, "item(s)"),
        CURRENT_POD_LOADING = false, CURRENT_POD_ITEMS = items, renderPodItemsUI()
    }

    if (!K.record || !(K.tripId || K.tripRecordId)) return finish([],
      "no active Trip_Dispatch record");
    if (!getTripBookingIds().length) return finish([], "no Booking ID linked to this Trip ID");
    if (!hubName) return finish([], "no hub selected");

    return fetchActiveTripShipmentBookings().then(function(bookings) {
      return Promise.all([ensureItemNamesLoaded(), fetchShipmentItemsForBookings(bookings)]).then(
        function(res) {
        var rows = res[1];
        /* When no row carries hub information at all, hub filtering is
           impossible — every item of this booking belongs here. */
        if (rowsHaveNoHubInfo(rows)) {
          console.warn(gr,
            "[hub-debug] no hub field on any Shipment_Items row — showing every item of this booking"
          );
          return finish(rows.map(mapOneShipmentItem),
            "Trip + Booking Shipment Items (no hub field on rows)")
        }
        finish(mapShipmentSubformItems(rows, hubName),
          "Trip_Dispatch + Booking + Shipment_Items.Hub_Name")
      })
    }).catch(function(err) {
      console.error(gr, "POD Shipment_Items lookup failed:", err);
      finish([], "Shipment_Items lookup failed")
    })
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
    w("dispatchTripBookingsCount", bookings.length + (1 === bookings.length ?
      " booking" : " bookings"));
    var namesEl = u("#dispatchTripCompanyNames");
    if (!namesEl) return;
    if (!bookings.length) return void(namesEl.textContent =
      "No bookings found for this trip.");
    var seen = {},
      names = [];
    bookings.forEach(function(b) {
      var nm = lookupLabel(sr(b, BOOKING_FIELD_CANDIDATES.customer));
      nm && !seen[nm] && (seen[nm] = !0, names.push(nm))
    });
    namesEl.textContent = names.length ? names.join(", ") :
      "No company name found on these bookings.";
  }

  function populateDispatchBookingDropdown() {
    var sel = u("#inDispatchBookingId");
    if (!sel) return;
    ["#inDispatchCustomer", "#inDispatchWeight", "#inDispatchPickup", "#inDispatchDelivery"]
    .forEach(function(id) {
      var el = u(id);
      el && (el.value = "")
    });
    w("dispatchTripBookingsCount", "—");
    var namesEl0 = u("#dispatchTripCompanyNames");
    namesEl0 && (namesEl0.textContent = "Select a trip to see the bookings on it.");
    if (!K.tripRecordId) return void(sel.innerHTML =
      '<option value="" selected hidden disabled>Start a trip to load Booking IDs…</option>');
    sel.innerHTML =
      '<option value="" selected hidden disabled>Loading Booking IDs…</option>';
    w("dispatchTripBookingsCount", "Loading…");
    namesEl0 && (namesEl0.textContent = "Loading…");
    fetchActiveTripShipmentBookings().then(function(bookings) {
      DISPATCH_BOOKING_OPTIONS = bookings || [];
      renderDispatchTripBookingsSummary(DISPATCH_BOOKING_OPTIONS);
      if (!DISPATCH_BOOKING_OPTIONS.length) return void(sel.innerHTML =
        '<option value="" selected hidden disabled>No Booking IDs found for this Trip.</option>'
        );
      var labels = DISPATCH_BOOKING_OPTIONS.map(function(b, i) {
        return lookupLabel(sr(b, BOOKING_FIELD_CANDIDATES.bookingId)) || b.ID || b.id ||
          "Booking " + (i + 1)
      });
      /* Booking IDs whose POD is already saved (see POD_PDF1) still
         show in the list — the driver needs to see every Booking ID
         on this Trip — but are rendered disabled so a completed
         delivery can't be re-selected and re-submitted. Only Booking
         IDs with no matching POD_PDF1 record stay selectable. */
      renderDispatchBookingOptions(sel, labels, {});
      fetchCompletedPodBookingIds(labels).then(function(completedSet) {
        renderDispatchBookingOptions(sel, labels, completedSet)
      }).catch(function(err) {
        console.error(gr, "fetchCompletedPodBookingIds() failed:", err)
      })
    }).catch(function(err) {
      console.error(gr, "populateDispatchBookingDropdown() failed:", err), sel.innerHTML =
        '<option value="" selected hidden disabled>Could not load Booking IDs.</option>',
        w("dispatchTripBookingsCount", "—"),
        namesEl0 && (namesEl0.textContent = "Could not load bookings for this trip.")
    })
  }

  /* Renders the Booking ID <select> options, disabling (but still
     showing) any Booking ID present in completedSet. Kept as its own
     function so populateDispatchBookingDropdown() can render once
     immediately (nothing disabled yet, while the completed-lookup is
     still in flight) and again once that lookup resolves, without
     duplicating the option-building markup. */
  function renderDispatchBookingOptions(sel, labels, completedSet) {
    sel.innerHTML = '<option value="" selected hidden disabled>Select a Booking ID…</option>' +
      labels.map(function(label, i) {
        var isCompleted = !!completedSet[label],
          safeLabel = String(label).replace(/</g, "&lt;");
        return '<option value="' + i + '"' + (isCompleted ? " disabled" : "") + ">" + safeLabel +
          (isCompleted ? " (POD completed)" : "") + "</option>"
      }).join("")
  }

  /* Looks up which of these Booking IDs already have a saved POD_PDF1
     record (Booking_ID field) — see the POD_PDF form's field
     definition — so populateDispatchBookingDropdown() can disable
     them instead of leaving every Booking ID selectable forever. */
  function fetchCompletedPodBookingIds(bookingIds) {
    var ids = (bookingIds || []).filter(Boolean);
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA || !ids.length) return Promise.resolve(
      {});
    var criteria = "(" + ids.map(function(id) {
      return 'Booking_ID == "' + escapeCriteria(id) + '"'
    }).join(" || ") + ")";
    return kr({
      report_name: "POD_PDF1",
      criteria: criteria,
      field_config: "all",
      max_records: 1000
    }).then(function(res) {
      var set = {};
      return (res && res.data || []).forEach(function(row) {
        var bid = String(row.Booking_ID || "").trim();
        bid && (set[bid] = !0)
      }), set
    }).catch(function(err) {
      return console.error(gr, "fetchCompletedPodBookingIds() report query failed:", err), {}
    })
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
    seq: 0
  };

  function podKpiSplitIds(v) {
    return String(null == v ? "" : v).split(/[,;]+/).map(function(x) {
      return x.trim()
    }).filter(Boolean)
  }

  function renderPodCompletionKpi() {
    var valEl = u("#podKpiVal"),
      subEl = u("#podKpiSub"),
      barEl = u("#podKpiBar");
    if (!valEl) return;
    var total = POD_KPI.labels.length;
    if (!total) {
      valEl.innerHTML = "— <small>/ — Completed</small>";
      subEl && (subEl.textContent = POD_KPI.loading ? "Loading…" : K.tripRecordId ?
        "No PODs assigned to this trip yet" : "Start a trip to track its PODs");
      barEl && (barEl.style.width = "0%");
      return
    }
    var completed = POD_KPI.labels.filter(function(label) {
      return POD_KPI.done[label] || POD_KPI.local[label]
    }).length;
    valEl.innerHTML = completed + " <small>/ " + total + " Completed</small>";
    subEl && (subEl.textContent = "Total PODs: " + total + " · Completed: " + completed +
      " · Pending: " + (total - completed));
    barEl && (barEl.style.width = Math.round(100 * completed / total) + "%")
  }

  /* Booking IDs (as shown on the popup, possibly several comma-separated
     from the hub check-in flow) that were just saved. */
  function podKpiMarkCompleted(ids) {
    (ids || []).forEach(function(id) {
      POD_KPI.local[id] = !0
    });
    renderPodCompletionKpi()
  }

  /* Which of these Booking IDs already have a saved POD_PDF record.
     Matches on Booking_ID, plus this Trip's own POD_PDF rows (a hub
     check-in POD stores several Booking IDs comma-separated in one
     Booking_ID text field, so those are split before comparing).
     Resolves to null (not {}) when the lookup itself fails, so a
     transient error never wipes a count that was already known. */
  function fetchTripCompletedPodBookingIds(labels) {
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA || !labels.length) return Promise.resolve(
      null);
    var parts = labels.map(function(l) {
      return 'Booking_ID == "' + escapeCriteria(l) + '"'
    });
    K.tripId && parts.push('Trip_ID == "' + escapeCriteria(K.tripId) + '"');
    return kr({
      report_name: POD_PDF_REPORT_NAME,
      criteria: "(" + parts.join(" || ") + ")",
      field_config: "all",
      max_records: 1000
    }).then(function(res) {
      var wanted = {},
        set = {};
      labels.forEach(function(l) {
        wanted[l] = !0
      });
      (res && res.data || []).forEach(function(row) {
        podKpiSplitIds(cr(row.Booking_ID)).forEach(function(id) {
          wanted[id] && (set[id] = !0)
        })
      });
      return set
    }).catch(function(err) {
      console.warn(gr, "POD Completion KPI: could not read " + POD_PDF_REPORT_NAME + ":", err);
      return null
    })
  }

  function refreshPodCompletionKpi() {
    if (!u("#podKpiVal")) return Promise.resolve();
    var tripKey = K.tripRecordId || K.tripId || "";
    if (POD_KPI.tripKey !== tripKey) POD_KPI = {
      tripKey: tripKey,
      labels: [],
      done: {},
      local: {},
      loading: !1,
      seq: POD_KPI.seq
    };
    if (!tripKey) return renderPodCompletionKpi(), Promise.resolve();
    var seq = ++POD_KPI.seq;
    POD_KPI.loading = !0;
    renderPodCompletionKpi();
    return fetchActiveTripShipmentBookings().then(function(bookings) {
      if (seq !== POD_KPI.seq) return;
      var seen = {},
        labels = [];
      (bookings || []).forEach(function(b) {
        var label = String(lookupLabel(sr(b, BOOKING_FIELD_CANDIDATES.bookingId)) || b.ID || b.id ||
          "").trim();
        label && !seen[label] && (seen[label] = !0, labels.push(label))
      });
      POD_KPI.labels = labels;
      POD_KPI.loading = !1;
      renderPodCompletionKpi();
      return fetchTripCompletedPodBookingIds(labels).then(function(set) {
        if (seq !== POD_KPI.seq) return;
        set && (POD_KPI.done = set);
        renderPodCompletionKpi()
      })
    }).catch(function(err) {
      POD_KPI.loading = !1;
      console.error(gr, "refreshPodCompletionKpi() failed:", err);
      renderPodCompletionKpi()
    })
  }

  function onDispatchBookingSelected() {
    var sel = u("#inDispatchBookingId"),
      idx = sel && sel.value;
    DISPATCH_POD_RECORD_ID = null;
    if (!sel || "" === idx || null == idx) return void(DISPATCH_SELECTED_BOOKING = null);
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
      customerName = lookupLabel(sr(booking, BOOKING_FIELD_CANDIDATES.customer));
    custEl && (custEl.value = customerName || "—");
    weightEl && (weightEl.value = cr(sr(booking, BOOKING_FIELD_CANDIDATES.weight)) || "—");
    pickupEl && (pickupEl.value = lookupLabel(sr(booking, BOOKING_FIELD_CANDIDATES.pickupLocation)) ||
      "—");
    deliveryEl && (deliveryEl.value = lookupLabel(sr(booking, BOOKING_FIELD_CANDIDATES
      .deliveryLocation)) || "—");
    /* The Trip_Dispatch1 "Assigned Bookings" subform row (see
       assignedBookingsFromTripRecord()) doesn't carry the Customer
       Company Name directly — only the linked Booking record does — so
       if it came back blank, look that record up once and fill it in
       when it resolves. */
    if (!customerName) {
      var bookingRef = sr(booking, BOOKING_FIELD_CANDIDATES.bookingId);
      resolveBookingCustomerName(bookingRef).then(function(nm) {
        custEl && DISPATCH_SELECTED_BOOKING === booking && nm && (custEl.value = nm)
      }).catch(function(err) {
        console.error(gr, "resolveBookingCustomerName() failed:", err)
      })
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
        criteria: '(ID == "' + escaped + '" || Booking_ID == "' + escaped + '")',
        field_config: "all",
        max_records: 1
      }).then(function(res) {
        var row = res && res.data && res.data[0];
        var nm = row && lookupLabel(sr(row, BOOKING_FIELD_CANDIDATES.customer));
        return nm || tryReport(index + 1)
      }).catch(function() {
        return tryReport(index + 1)
      })
    }
    return tryReport(0)
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
    if (errEl && (errEl.hidden = !0), !DISPATCH_SELECTED_BOOKING) return errEl && (errEl
      .textContent = "Select a Booking ID first.", errEl.hidden = !1), void 0;
    var booking = DISPATCH_SELECTED_BOOKING,
      bookingRefId = booking.ID || booking.id || null,
      custEl = u("#inDispatchCustomer"),
      weightEl = u("#inDispatchWeight"),
      pickupEl = u("#inDispatchPickup"),
      deliveryEl = u("#inDispatchDelivery"),
      btn = u("#btnCreatePodFromDispatch");
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA) return DISPATCH_POD_RECORD_ID =
      null, void Y("podbooking");
    btn && (btn.disabled = !0);
    try {
      var empId = await resolveEmployeeFormId(),
        payload = {};
      bookingRefId && (payload.Booking_ID = cr2(bookingRefId)), K.tripRecordId && (payload
          .Trip_ID = cr2(K.tripRecordId)), empId && (payload.Driver_ID = cr2(empId), payload
          .Driver_Name = cr2(empId));
      var customerVal = custEl && custEl.value,
        weightVal = weightEl && weightEl.value,
        pickupVal = pickupEl && pickupEl.value,
        deliveryVal = deliveryEl && deliveryEl.value;
      customerVal && "—" !== customerVal && (payload.Customer_Company_Name = customerVal), weightVal &&
        "—" !== weightVal && (payload.Weight = Number(weightVal) || weightVal), pickupVal &&
        "—" !== pickupVal && (payload.Pickup_Location = pickupVal), deliveryVal && "—" !==
        deliveryVal && (payload.Delivery_Location = deliveryVal);
      var res = await ZOHO.CREATOR.DATA.addRecords({
        form_name: "Dispatch_POD",
        payload: {
          data: payload
        }
      });
      DISPATCH_POD_RECORD_ID = res && res.data && (res.data.ID || res.data.id) || null, Y(
        "podbooking")
    } catch (err) {
      console.error(gr, "Dispatch_POD save failed:", err), errEl && (errEl.textContent =
        "Couldn't save Booking Details: " + _r(err), errEl.hidden = !1)
    } finally {
      btn && (btn.disabled = !1)
    }
  }

  function recalcPodBkPending(i) {
    var item = DISPATCH_POD_ITEMS[i];
    if (!item) return;
    item.pendingQty = Math.max(0, (Number(item.qty) || 0) - (Number(item.receivedQty) || 0));
    var pendEl = u('[data-podbk-pending="' + i + '"]');
    pendEl && (pendEl.textContent = item.pendingQty)
  }

  function renderPodBkItemsUI() {
    var host = u("#podBkItemList"),
      countEl = u("#podBkItemCount");
    if (!host) return;
    var booking = DISPATCH_SELECTED_BOOKING,
      bkLabel = booking ? lookupLabel(sr(booking, BOOKING_FIELD_CANDIDATES.bookingId)) || booking
      .ID || booking.id || "—" : "—";
    w("podBkBookingIdChip", "Booking ID: " + bkLabel);
    if (!DISPATCH_POD_ITEMS.length) return countEl && (countEl.textContent = ""), void(host
      .innerHTML =
      '<div class="podbk-row podbk-row--empty">No Shipment Items found for this Booking.</div>');
    countEl && (countEl.textContent = DISPATCH_POD_ITEMS.length + " item" + (1 ===
      DISPATCH_POD_ITEMS.length ? "" : "s")),
      host.innerHTML = DISPATCH_POD_ITEMS.map(function(item, i) {
        return '<div class="podbk-row"><span>' + String(item.name).replace(/</g, "&lt;") +
          '</span><span>' + item.qty +
          '</span><input type="number" min="0" data-podbk-received="' + i + '" value="' + item
          .receivedQty +
          '"><span data-podbk-pending="' + i + '">' + item.pendingQty + "</span></div>"
      }).join(""), Array.prototype.slice.call(host.querySelectorAll("[data-podbk-received]"))
      .forEach(function(el) {
        el.addEventListener("input", function() {
          var i = Number(el.getAttribute("data-podbk-received"));
          DISPATCH_POD_ITEMS[i].receivedQty = Number(el.value) || 0, recalcPodBkPending(i)
        })
      })
  }

  function loadPodItemsForDispatchBooking() {
    var booking = DISPATCH_SELECTED_BOOKING,
      statusEl = u("#inPodBkStatus"),
      noteEl = u("#podBkNote");
    /* Delivery Status/Note are now a single overall pair for the
       whole booking (not per item) — reset them each time a
       different booking's items load, so a value entered for one
       booking never carries over and gets saved against another. */
    statusEl && (statusEl.value = ""), noteEl && (noteEl.value = "");
    if (!booking) return DISPATCH_POD_ITEMS = [], void renderPodBkItemsUI();
    w("podBkItemCount", "Loading…");
    return Promise.all([ensureItemNamesLoaded(), fetchShipmentItemsForBookings([booking])]).then(
      function(res) {
      var rows = res[1];
      DISPATCH_POD_ITEMS = (rows || []).map(function(row, i) {
        return mapOneShipmentItem(row, i)
      }), renderPodBkItemsUI()
    }).catch(function(err) {
      console.error(gr, "loadPodItemsForDispatchBooking() failed:", err), DISPATCH_POD_ITEMS = [],
        renderPodBkItemsUI()
    })
  }

  async function savePodBooking() {
    var errEl = u("#podBkErr");
    if (errEl && (errEl.hidden = !0), !DISPATCH_SELECTED_BOOKING || !DISPATCH_POD_ITEMS.length)
      return errEl && (errEl.textContent = "No items to save for this Booking.", errEl.hidden = !1);
    var statusEl = u("#inPodBkStatus"),
      overallStatus = statusEl ? statusEl.value : "";
    if (!overallStatus) return u("#fPodBkStatus") && u("#fPodBkStatus").classList.add("is-bad"),
      errEl && (errEl.textContent = "Select a Delivery Status.", errEl.hidden = !1);
    u("#fPodBkStatus") && u("#fPodBkStatus").classList.remove("is-bad");
    var overallNote = (u("#podBkNote") ? u("#podBkNote").value : "").trim();
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA) return R(
      "Preview mode — POD not saved");
    if (!DISPATCH_POD_RECORD_ID) return errEl && (errEl.textContent =
      "Booking Details weren't saved — go back and submit the Booking Details again.", errEl
      .hidden = !1);
    var booking = DISPATCH_SELECTED_BOOKING,
      bookingRefId = booking.ID || booking.id || null,
      empId = await resolveEmployeeFormId(),
      saveBtn = u("#btnSavePodBooking");
    saveBtn && (saveBtn.disabled = !0);
    try {
      for (var dispatchPodIdx = 0; dispatchPodIdx < DISPATCH_POD_ITEMS.length; dispatchPodIdx++) {
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
          Delivery_Note: overallNote
        };
        bookingRefId && (payload.Booking_ID = cr2(bookingRefId)), K.tripRecordId && (
            payload.Trip_ID = K.tripRecordId), empId && (payload.Driver_ID = cr2(empId));
        await ZOHO.CREATOR.DATA.addRecords({
          form_name: "Proof_of_Delivery2",
          payload: {
            data: payload
          }
        }).catch(function(err) {
          return console.error(gr, "Proof_of_Delivery2 (Dispatch flow) item save failed:", err), null
        })
      }
      /* Customer Company Name comes from the Customer field on the
         Booking_Shipments1 record; Vehicle from the current Trip
         record (K.vehicleName, resolved via Trip_Dispatch1.Vehicle —
         see ce.vehicle above); Pickup/Delivery Location and Weight
         from the same Booking record. All from data this flow already
         fetched — nothing here is guessed. */
      var podCustomerCompany = lookupLabel(sr(booking, BOOKING_FIELD_CANDIDATES.customer)),
        podPickupLocation = lookupLabel(sr(booking, BOOKING_FIELD_CANDIDATES.pickupLocation)),
        podDeliveryLocation = lookupLabel(sr(booking, BOOKING_FIELD_CANDIDATES.deliveryLocation)),
        podWeight = cr(sr(booking, BOOKING_FIELD_CANDIDATES.weight));
      R("POD saved for Booking " + (lookupLabel(sr(booking,
        BOOKING_FIELD_CANDIDATES.bookingId)) || bookingRefId)), populatePodResultPage({
        date: k(),
        driverName: s.name,
        driverId: empId || s.id,
        tripId: K.tripRecordId || K.tripId,
        bookingId: lookupLabel(sr(booking, BOOKING_FIELD_CANDIDATES.bookingId)) || bookingRefId,
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
        items: DISPATCH_POD_ITEMS.map(function(it) {
          return {
            name: it.name,
            qty: it.qty,
            receivedQty: it.receivedQty,
            pendingQty: it.pendingQty,
            price: it.price
          }
        })
      }), DISPATCH_POD_RECORD_ID = null, Y("podresult")
    } finally {
      saveBtn && (saveBtn.disabled = !1)
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
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA) return Promise.resolve();
    var reports = [e.locations].concat(e.locationsFallbacks || []).filter(function(v, i, arr) {
      return v && arr.indexOf(v) === i
    });
    return resolveTripHubRefs().then(function(hubRefs) {
      var hasRefs = !!(hubRefs && (hubRefs.ids.length || hubRefs.names.length));
      if (hubRefs && !hasRefs) console.warn(gr,
        "[hub-debug] hub resolution returned nothing for this Trip/Booking — listing all hubs. Run skywayHubDebug() to see why."
      );
      return function tryLoc(n) {
        if (n >= reports.length) return void console.error(gr,
          "Could not read a Locations report for Hub Name (tried: " + reports.join(", ") +
          ").");
        return kr({
          report_name: reports[n],
          field_config: "all",
          max_records: 200
        }).then(function(res) {
          var allRows = res && res.data || [],
            sel = u("#inHub");
          if (!sel) return;
          var rows = hasRefs ? allRows.filter(function(rec) {
            return locationMatchesHubRefs(rec, hubRefs)
          }) : allRows;
          if (hasRefs && !rows.length && n + 1 < reports.length) return tryLoc(n + 1);
          HUB_NAME_TO_ID = {};
          var names = [];
          rows.forEach(function(rec) {
            var nm = cr(sr(rec, t));
            nm && void 0 === HUB_NAME_TO_ID[nm] && (HUB_NAME_TO_ID[nm] = rec.ID || rec.id ||
              null, names.push(nm))
          });
          /* Hub names present on the items but missing from Locations are
             still offered, so the driver is never blocked. */
          if (hasRefs) hubRefs.names.forEach(function(nm) {
            nm = String(nm).trim();
            nm && void 0 === HUB_NAME_TO_ID[nm] && (HUB_NAME_TO_ID[nm] = null, names.push(
              nm))
          });
          console.log(gr, "[hub-debug] hub dropdown options:", names);
          var prev = sel.value;
          sel.innerHTML = names.length ? '<option value="" selected hidden disabled></option>' :
            '<option value="">No hubs found for this Trip/Booking</option>';
          names.forEach(function(nm) {
            var opt = document.createElement("option");
            opt.value = nm, opt.textContent = nm, sel.appendChild(opt)
          });
          prev && -1 !== names.indexOf(prev) && (sel.value = prev)
        }).catch(function(err) {
          return console.error(gr, "getRecords on", reports[n], "(Locations) failed:", err),
            tryLoc(n + 1)
        })
      }(0)
    })
  }

  /* ------------------------------------------------------------
     Console diagnostic. Run  skywayHubDebug()  in the browser console to
     print the real Zoho field names on this trip's booking and item
     records — use it to extend the *_CANDIDATES lists above if a hub
     still doesn't appear.
     ------------------------------------------------------------ */
  window.skywayHubDebug = function() {
    console.group("[Skyway hub debug]");
    console.log("Trip record:", K.record);
    console.log("Trip booking keys:", getTripBookingIds());
    return fetchActiveTripShipmentBookings().then(function(bookings) {
      console.log("Matched booking record(s):", bookings);
      bookings.forEach(function(b) {
        console.log("Booking field names:", Object.keys(b))
      });
      return fetchShipmentItemsForBookings(bookings).then(function(rows) {
        console.log("Shipment item row(s):", rows);
        rows.slice(0, 5).forEach(function(r, i) {
          console.log("Item " + i + " field names:", Object.keys(r), "| hub refs:",
            hubRefsFromRow(r), "| Item:", cr(sr(r, SHIPMENT_ITEM_FIELD_CANDIDATES.name)),
            "| Quantity:", sr(r, SHIPMENT_ITEM_FIELD_CANDIDATES.qty))
        });
        console.log("HUB_NAME_TO_ID:", HUB_NAME_TO_ID);
        console.groupEnd();
        return {
          bookings: bookings,
          items: rows
        }
      })
    }).catch(function(err) {
      console.error("skywayHubDebug failed:", err), console.groupEnd()
    })
  };

  function Tr() {
    if (!window.ZOHO || !ZOHO.CREATOR) return a.source = "Default BFM values (preview)", yr(),
      void L();
    Dr();
    var e = "";
    (ZOHO.CREATOR.UTIL.getQueryParams ? ZOHO.CREATOR.UTIL.getQueryParams().catch(function() {
      return {}
    }) : Promise.resolve({})).then(function(e) {
      return (e = e || {}).driverEmail ? (console.log(gr,
        "email source: URL param ?driverEmail=", e.driverEmail), e.driverEmail) : (ZOHO
        .CREATOR.UTIL.getWidgetParams ? ZOHO.CREATOR.UTIL.getWidgetParams().catch(function() {
          return {}
        }) : Promise.resolve({})).then(function(e) {
        var t = e && (e.Driver_Email || e.driverEmail);
        return t ? (console.log(gr, "email source: widget parameter", t), t) : ZOHO.CREATOR
          .UTIL.getInitParams().then(function(e) {
            console.log(gr, "getInitParams() ->", e);
            var t = e && e.loginUser;
            if (!t) throw new Error(
              "getInitParams() returned no loginUser. In a Customer Portal this can happen depending on how the widget page is embedded — pass the portal user's email in explicitly instead: add a query param to this widget's page URL (e.g. via a Deluge on-load script using zoho.loginuserid) and read it here as ?driverEmail=..."
              );
            return console.log(gr, "email source: getInitParams().loginUser", t), t
          })
      })
    }).then(function(t) {
      return wr(e = t.trim())
    }).then(function(t) {
      if (!t) throw new Error('No Driver form record has Email == "' + e +
        "\". Check that record's Email field for typos, extra spaces, or a different case than the portal login."
        );
      var r;
      (r = document.getElementById("driverLookupError")) && (r.hidden = !0),
      function(e) {
        var t = [];

        function r(r, n) {
          var a = or(e, i[r] || []),
            o = a ? e[a] : "",
            s = n ? n(o) : o || "";
          return t.push({
            field: r,
            matchedApiName: a || "NOT FOUND",
            value: s
          }), s
        }
        s.recordId = e.ID || e.id || null, s.id = r("id") || s.id, s.name = r("name", lr) || s
          .name, s.gender = r("gender", cr), s.email = r("email") || s.email, s.mobile = r(
            "mobile"), s.altMobile = r("altMobile"), s.dob = r("dob"), s.photoPath = r("photo") ||
          /* PHOTO FIX: none of the known Profile_Photo/Photo/Driver_Photo-style
             candidates above matched a field on this Driver record — instead of
             giving up (which is what silently left the avatar as initials-only),
             scan every field on the record for one that looks like an image field
             by name (contains "photo"/"picture"/"image"/"avatar") and has a value,
             so a differently-named field in this Zoho form still gets picked up. */
          function() {
            var keys = Object.keys(e),
              rx = /photo|picture|image|avatar/i;
            for (var i2 = 0; i2 < keys.length; i2++)
              if (rx.test(keys[i2]) && null != e[keys[i2]] && "" !== e[keys[i2]]) return e[keys[
                i2]];
            return ""
          }(),
          s.address = r("address", dr), s.employmentType = r("employmentType"), s.started = r(
            "joiningDate"), s.department = r("department", cr), s.designation = r("designation",
            cr), s.licenceNo = r("licenceNo"), s
          .licenceNumber = r("licenceNumber"), s.licenceIssueDate = r("licenceIssueDate"), s
          .licenceType = r("licenceType", cr), s.licenceClass = r("licenceClass", cr) || s
          .licenceType, s.licenceExpiry = r("licenceExpiry"), s
          .licenceStatus = r("licenceStatus", cr), s.licenceDocumentPath = r("licenceDocument"),
          s.licenceCopyPath = r("licenceCopy"), s.vehicleName = r("vehicleName", cr), s
          .vehicleAssigned = s.vehicleName, s.passportNumber = r("passportNumber"), s
          .passportCopyPath = r("passportCopy"), s.identityDocType = r("identityDocType", cr), s
          .identityDocNumber = r("identityDocNumber"), s.experience = r("experience"), s
          .heavyVehicleExperience = r("heavyVehicleExperience", cr), s
          .lastCheckupDate = r("lastCheckupDate"), s.medicalFitnessStatus = r(
            "medicalFitnessStatus", cr), s.medicalCertExpiry = r("medicalCertExpiry"), s
          .fatigueModule = r("fatigueModule", cr), s.documentsPath = r("documents"), s.remark =
          r("remark"), s.visaStatus = r("visaStatus", cr), s.visaExpiryDate = r(
            "visaExpiryDate"), s.expiryDate = r("expiryDate"), s.medicalCertificatePath = r(
            "medicalCertificate"), s.rightToWorkDocumentPath = r("rightToWorkDocument"), s
          .identityDocumentCopyPath = r("identityDocumentCopy"), s.bfmAccreditation = n && e[
          n] || "", s.loaded = !0, console.log(gr, "Field mapping report:"), console.table ?
          console.table(t) : console.log(t), console.log(gr,
            "Raw record returned by Zoho (all keys as-received):", e)
      }(t)
    }).then(function() {
      yr(), vr(), scoreRefresh(), ke().then(function() {
        L()
      }).catch(function(e) {
        console.error(gr, "restore/load chain failed:", e), L()
      })
    }).catch(function(t) {
      var r, n, i;
      console.error(gr, "Driver profile load failed:", t), s.loaded = !1, s.name =
        "Driver not found", s.id = "—", yr(), r = (e ? "Signed in as " + e + ". " : "") + (t &&
          t.message ? t.message : "Could not load this driver's profile."), n = document
        .getElementById("driverLookupError"), (i = document.getElementById(
          "driverLookupErrorText")) && (i.textContent = r), n && (n.hidden = !1), pe(
          "No matching driver found"), be([], [], "No matching driver found."), a.source =
        "Default BFM values (driver lookup failed)", P(), L()
    })
  }
  var Cr = {
    contact: {
      type: "form",
      link: "Contact_Control"
    },
    alerts: {
      type: "report",
      link: e.alerts
    },
    "view-stop": {
      type: "report",
      link: "Trip_Stops"
    },
    "score-report": {
      type: "report",
      link: "Driver_Scorecard"
    },
    trip: {
      type: "report",
      link: e.trips
    },
    deliveries: {
      type: "report",
      link: "Trip_Stops"
    },
    duty: {
      type: "report",
      link: e.duty
    },
    route: {
      type: "report",
      link: e.trips
    },
    fuel: {
      type: "report",
      link: "Fuel_Entries"
    }
  };
  var Ir = !1;
  document.addEventListener("DOMContentLoaded", function() {
    try {
      if (Ir) return;
      Ir = !0,
        function() {
          function e(e, t, r) {
            var n = u(e);
            n && n.addEventListener(t, r)
          }

          function t(t) {
            e(t, "click", function(e) {
              var t = e.target.closest("[data-view-trip]");
              if (t) {
                var r = t.closest("[data-trip-id]");
                if (r) {
                  var n = ye[r.getAttribute("data-trip-id")];
                  n && function(e) {
                    if (e) {
                      var t = le(e, "tripId") || "—",
                        r = le(e, "status") || "—",
                        n = ve(r);
                      w("tdTripId", t), w("tdTripIdRow", t), w("tdTripType", le(e,
                          "tripType") || "—"), w("tdTripStatus", r), w("tdTripStatusRow",
                          r), w("tdRoute", tripRoute(e)), w("tdBookingDate", le(
                          e, "bookingDate") || "—"), w("tdPlannedDelivery", le(e,
                          "plannedDelivery") || "—"), w("tdVehicle", le(e, "vehicle") ||
                          "—"), w("tdVehicleCapacity", le(e, "vehicleCapacity") || "—"),
                        w("tdSupervisor", le(e, "supervisor") || "—"), w(
                          "tdPrimaryDriver", le(e, "primaryDriver") || "—"), w(
                          "tdVehicleInspectionStatus", le(e, "vehicleInspectionStatus") ||
                          "—"), w("tdFromLocation", le(e, "fromLocation") || "—"), w(
                          "tdToLocation", le(e, "toLocation") || "—"), w(
                          "tdPickupLocation", le(e, "pickupLocation") || "—"), w(
                          "tdDeliveryLocation", le(e, "deliveryLocation") || "—"), w(
                          "tdEstimatedDistance", le(e, "estimatedDistance") || "—"), w(
                          "tdTripDuration", le(e, "tripDuration") || "—"), w("tdQuantity",
                          le(e, "quantity") || "—"), w("tdWeight", le(e, "weight") ||
                        "—"), w("tdExpectedDelivery", le(e, "expectedDelivery") || "—");
                      var i = u("#tdTripStatus");
                      i && (i.className = "hubstatus " + n), er("panelTripDetails", null)
                    }
                  }(n)
                }
              }
            })
          }
          w("hdrDate", k()), w("hdrDriverId", s.id), document.addEventListener("click",
              function(e) {
                var t = e.target.closest("[data-nav]");
                if (t) {
                  var r = t.getAttribute("data-nav");
                  /* A Start Trip button while a trip is already in progress:
                     refuse before $() swaps the active trip out from under it. */
                  if ((t.hasAttribute("data-start-trip") || "btnStartTop" === t.id) && hasActiveTrip())
                    return void R("Complete your active trip first");
                  if (t.hasAttribute("data-start-trip")) {
                    var n = t.getAttribute("data-trip-id"),
                      i = n ? ye[n] : null;
                    i ? $(i) : n && (X = n)
                  }
                  if ("btnStartTop" === t.id) {
                    if (!ge.length) return void R("No trip assigned yet — nothing to start.");
                    $(ge[0])
                  }
                  return "break" === r && G(), void Y(r)
                }
                var a = e.target.closest("[data-panel]");
                if (a) {
                  var o = a.getAttribute("data-panel");
                  return er(o, null), rr(), void("panelAttendance" === o && De())
                }
                var c = e.target.closest("[data-geo]");
                if (c) ! function(e) {
                  var t = {
                    veh: {
                      url: "#inVehUrl",
                      loc: "#inVehLoc"
                    },
                    brk: {
                      url: "#inBrkUrl",
                      loc: "#inBrkLoc"
                    },
                    start: {
                      url: "#inStartUrl",
                      loc: "#inStartLoc"
                    },
                    fuel: {
                      url: "#inFuelUrl",
                      loc: "#inFuelCurrentLoc"
                    },
                    inc: {
                      url: "#inIncUrl",
                      loc: "#inIncLoc"
                    },
                    exp: {
                      url: "#inExpUrl",
                      loc: "#inExpLoc"
                    }
                  } [e];
                  if (t) {
                    var r = t.url,
                      n = t.loc;
                    navigator.geolocation ? (R("Getting your location…"), navigator
                      .geolocation.getCurrentPosition(function(e) {
                        var t = e.coords.latitude.toFixed(6),
                          i = e.coords.longitude.toFixed(6),
                          a = u(r);
                        a && (a.value = "https://maps.google.com/?q=" + t + "," + i,
                          "start" === c.getAttribute("data-geo") && (a.disabled = !0));
                        var o = u(n);
                        o && !o.value && (o.value = t + ", " + i, "start" === c.getAttribute(
                          "data-geo") && (o.disabled = !0)), R("Location captured")
                      }, function() {
                        R("Couldn't get your location — enter it manually.")
                      }, {
                        timeout: 1e4
                      })) : R("Location isn't available on this device.")
                  }
                }(c.getAttribute("data-geo"));
                else {
                  var l = e.target.closest("[data-action]");
                  if (l) {
                    var d = l.getAttribute("data-action");
                    if ("alerts" === d) return ir(), er("panelAlerts", null), void F();
                    var m = Cr[d];
                    if (m && function(e) {
                        if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.UTIL) return !1;
                        try {
                          var t = "?Driver_ID=" + encodeURIComponent(s.id) + "&Trip_ID=" +
                            encodeURIComponent(K.tripId || X || "");
                          return ZOHO.CREATOR.UTIL.navigateParentURL({
                            action: "open",
                            url: ("form" === e.type ? "#Form:" : "#Report:") + e.link + t,
                            window: "new"
                          }), !0
                        } catch (e) {
                          return !1
                        }
                      }(m)) return;
                    R(l.textContent.trim() + " — connect this to a Creator form to go live.")
                  }
                }
              }), u("#btnDriver").addEventListener("click", function() {
              er("panelDriver", this)
            }), u("#btnTripAttended").addEventListener("click", function() {
              er("panelAttendance", this), De()
            }), u("#btnScore").addEventListener("click", function() {
              er("panelScore", this), rr(), nr()
            }), e("#btnBfmLogs", "click", openBfmLogsPanel), e("#btnBfmLogsBack", "click", function() {
              er("panelScore", u("#btnScore")), rr(), nr()
            }), u("#scrim").addEventListener("click", tr), m("[data-close]").forEach(function(
            e) {
              e.addEventListener("click", tr)
            }), document.addEventListener("keydown", function(e) {
              "Escape" === e.key && (tr(), u("#tyrePopup").hidden || Ye(), u(
                  "#docViewerPopup").hidden || pr(), u("#driverDocsPopup").hidden ||
                closeDriverDocsPopup(), u("#tripInfoPopup").hidden || closeTripInfoPopup())
            }), e("#btnTripInfo", "click", function(e) {
              e.stopPropagation(), openTripInfoPopup()
            }), e("#tripTimerBox", "click", openTripInfoPopup), e("#tripInfoClose", "click",
              closeTripInfoPopup), e("#tripInfoScrim", "click", closeTripInfoPopup), e(
              "#btnDownloadPod", "click", downloadPodResult), e("#btnSavePodPdf", "click",
              saveDeliveryRecordToZoho), t(
              "#dashAttList"), t("#attList"), t("#dashTodayTripList"), t("#tripList"), e("#btnAttSummary", "click", function() {
              er("panelAttendance", null), De()
            }), e("#btnAttViewMore", "click", function() {
              er("panelAttendance", null), De()
            }), e("#btnStartTripCta", "click", bt), e("#btnSubmitStartTrip", "click",
              submitStartTripPage), e("#btnSaveVcheck", "click", gt), e("#veh3dFallback", "click", function(e) {
              var t = e.target.closest(".tyre3d__tyre");
              t && ze(t.getAttribute("data-tyre"))
            }), e("#tyrePopupSave", "click", Qe), e(
              "#tyrePopupClose", "click", Ye), e("#tyreScrim", "click", Ye), e(
              "#tyrePopupInput", "keydown",
              function(e) {
                "Enter" === e.key && Qe()
              }), e("#tyreCountFilter", "change", function(e) {
              Ze(e.target.value)
            }), e("#btnClearPodResultSignature", "click", podResultSigPadClear), e(
              "#btnPanelViewDocs", "click", function() {
              tr(), openDriverDocsPopup()
            }), e("#driverDocsPopupClose", "click", closeDriverDocsPopup), e("#driverDocsScrim",
              "click", closeDriverDocsPopup), e("#driverDocsPopup", "click", function(e) {
              var t = e.target.closest(".doccard__open");
              if (t && "true" !== t.getAttribute("aria-disabled")) {
                e.preventDefault();
                var r = t.closest(".doccard"),
                  n = r && r.querySelector(".doccard__body b");
                ! function(e, t) {
                  if (t) {
                    closeDriverDocsPopup(), w("docViewerTitle", e || "Document");
                    var r = u("#docViewerLoading");
                    r && (r.hidden = !1);
                    var n = u("#docViewerFrame");
                    n && (n.onload = function() {
                      r && (r.hidden = !0)
                    }, n.src = t);
                    var i = u("#docViewerDownload");
                    i && (i.href = t, i.setAttribute("download", function(e) {
                      return ((e || "document").trim().toLowerCase().replace(
                          /[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "document") +
                        ".pdf"
                    }(e)));
                    var a = u("#docViewerOpenTab");
                    a && (a.href = t), u("#docViewerPopup").hidden = !1, u("#docViewerScrim")
                      .hidden = !1, document.body.style.overflow = "hidden"
                  }
                }(n ? n.textContent : "Document", t.getAttribute("href"))
              }
            }), e("#docsGrid", "click", function(e) {
              var t = e.target.closest(".doccard__open");
              if (t && "true" !== t.getAttribute("aria-disabled")) {
                e.preventDefault();
                var r = t.closest(".doccard"),
                  n = r && r.querySelector(".doccard__body b");
                ! function(e, t) {
                  if (t) {
                    w("docViewerTitle", e || "Document");
                    var r = u("#docViewerLoading");
                    r && (r.hidden = !1);
                    var n = u("#docViewerFrame");
                    n && (n.onload = function() {
                      r && (r.hidden = !0)
                    }, n.src = t);
                    var i = u("#docViewerDownload");
                    i && (i.href = t, i.setAttribute("download", function(e) {
                      return ((e || "document").trim().toLowerCase().replace(
                          /[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "document") +
                        ".pdf"
                    }(e)));
                    var a = u("#docViewerOpenTab");
                    a && (a.href = t), u("#docViewerPopup").hidden = !1, u("#docViewerScrim")
                      .hidden = !1, document.body.style.overflow = "hidden"
                  }
                }(n ? n.textContent : "Document", t.getAttribute("href"))
              }
            }), e("#docViewerClose", "click", pr), e("#docViewerScrim", "click", pr), je(),
          ft(), m(".yn-toggle").forEach(function(e) {
              if (!e.dataset.ynWired) {
                e.dataset.ynWired = "1";
                var t = document.getElementById(e.getAttribute("data-yn-target"));
                m(".yn-btn", e).forEach(function(r) {
                  r.addEventListener("click", function() {
                    m(".yn-btn", e).forEach(function(e) {
                      e.classList.remove("is-active")
                    }), r.classList.add("is-active"), t && (t.value = r
                      .getAttribute("data-yn-val"), t.dispatchEvent(new Event(
                        "change", {
                          bubbles: !0
                        })))
                  })
                })
              }
            }), m("[data-check-verify]").forEach(function(e) {
              e.addEventListener("click", function() {
                ! function(e) {
                  var t = document.querySelector('[data-err="' + e + '"]');
                  xt(Ie[e].fields), t && (t.hidden = !0);
                  var r = Ae()[e];
                  null === r ? (Ie[e].fields.forEach(function(e) {
                    var t = document.getElementById(e),
                      r = t && t.querySelector("input, select");
                    t && r && !String(r.value).trim() && t.classList.add("is-bad")
                  }), t && (t.textContent =
                    "Complete every field in this check before verifying.", t
                    .hidden = !1), Ne()) : "Defect" === r ? (t && (t.textContent =
                    "This check has failed. Raise a vehicle issue — the trip can't start with an open defect.",
                    t.hidden = !1), Ne()) : (Pe[e] = !0, Ne(), Oe(), R(Ie[e].label +
                      " verified" + ("Monitor" === r ? " — flagged to monitor" : "")),
                    Object.keys(Pe).every(function(e) {
                      return Pe[e]
                    }) && (gt(), R("All checks verified — VH-208 cleared to depart")))
                }(e.getAttribute("data-check-verify"))
              })
            }), m("[data-check-close]").forEach(function(e) {
              e.addEventListener("click", function() {
                Oe()
              })
            }), e("#hubPrev", "click", function() {
              ae(-1)
            }), e("#hubNext", "click", function() {
              ae(1)
            }), e("#btnHubPod", "click", function() {
              var e = Q[J];
              c.hub = e.name, c.date = c.date || k(), u("#inHub") && (u("#inHub").value = e
                .name), Y("pod")
            }), ie(), oe(), ["attDone", "attCancel", "attTotal", "attDone2", "attCancel2",
              "attTotal2", "dashAttDone", "dashAttCancel", "dashAttTotal"
            ].forEach(function(e) {
              w(e, "—")
            }), w("attSub", "Loading…"), w("tripAttMini", "—"), w("tripAttSub", "Loading…"), w(
              "dashAttSub", "Loading…"), [u("#attList"), u("#dashAttList")].forEach(function(
            e) {
              if (e) {
                e.innerHTML = "";
                var t = document.createElement("li");
                t.className = "triprow", t.textContent = "Loading trips…", e.appendChild(t)
              }
            }),
            function() {
              w("dashTripCountLabel", "Loading…");
              [u("#dashTodayTripList"), u("#tripList")].forEach(function(e) {
                if (e) {
                  e.innerHTML = "";
                  var t = document.createElement("li");
                  t.className = "triprow", t.textContent = "Loading trips…", e.appendChild(t)
                }
              })
            }(), Te(), m(".checkcard input, .checkcard select").forEach(function(e) {
              e.addEventListener("input", Ne), e.addEventListener("change", Ne)
            }), m(".checkcard .yn-btn").forEach(function(e) {
              e.addEventListener("click", function() {
                setTimeout(Ne, 0)
              })
            }), e("#btnSaveCheckIn", "click", _t), e("#btnGoToPod", "click", kt), e(
              "#btnSavePod", "click", wt), e("#btnClearSignature", "click", sigPadClear), e(
              "#inHub", "change", function() {
                updateHubItemCount(u("#inHub").value)
              }), e("#bookingIdList", "change", syncSelectedBookingIdsFromChecklist), window
            .addEventListener("resize", function() {
              sigPad.canvas && sigPadResize(), podResultSigPad.canvas && podResultSigPadResize()
            }), e("#btnSaveFuel", "click", Lt), e("#inFuelQty", "input", St), e("#inFuelCost",
              "input", St), e("#inIncTime", "input", Bt), e("#inIncEndTime", "input", Bt), e(
              "#btnSaveIncident", "click", qt), e("#btnSaveVehicle", "click", Zt), e(
              "#btnSaveExpense", "click", submitExpenseEntry), e(
              "#inDispatchBookingId", "change", onDispatchBookingSelected), e(
              "#btnCreatePodFromDispatch", "click", submitDispatchToPod), e(
              "#btnSavePodBooking", "click", savePodBooking), e(
              "#btnSaveBreak", "click", Yt), e("#btnContinueDriving", "click", j), e(
              "#btnStopTimer", "click", G), e(
              "#inBrkStart", "input", zt), e("#inBrkEnd", "input", zt), Dt(), e("#btnComplete",
              "click",
              function() {
                Y("tripfeedback")
              }), e("#btnSubmitTripFeedback", "click", async function() {
              var e = u("#tfbErr");
              e.hidden = !0, xt(["fTfbFeedback"]);
              var t = At("#inTfbFeedback");
              if (!t) return u("#fTfbFeedback").classList.add("is-bad"), e.textContent =
                "Enter some feedback before submitting.", void(e.hidden = !1);
              /* End the trip in Creator FIRST. Only when that is confirmed do the
                 feedback / BFM summary below run, so a failed attempt can be
                 retried without duplicating anything, and the driver stays in
                 the trip until Creator has really closed it. */
              var doneBtn = u("#btnSubmitTripFeedback");
              doneBtn && (doneBtn.disabled = !0);
              try {
                await endStartTripRecord()
              } catch (endErr) {
                console.error(gr, "Could not end the trip in Creator:", endErr);
                e.textContent = "Couldn't complete the trip in Zoho Creator: " + _r(endErr) +
                  " You are still on this trip — check your connection and press Submit again.";
                e.hidden = !1, doneBtn && (doneBtn.disabled = !1);
                return
              }
              doneBtn && (doneBtn.disabled = !1);
              clearTripSnapshot(), o.completedTripRecordId = K.tripRecordId, o.activeTripRecordId = null, o
                .startTripRecordId = null, o.restoredTrip = !1;
              Mt("Trip_Feedback", {
                  Trip_ID: At("#inTfbTripId"),
                  Trip_Name: At("#inTfbTripName"),
                  Trip_Feedback: t
                }), saveBfmSummary(), R("Trip " + (K.tripId || X) +
                " completed — feedback submitted"), o.tripStarted = !1, o.breakCount = 0, u(
                  "#inTfbFeedback").value = "", H(), V &&
                (clearInterval(V), V = null), w("tripTimerVal", "00:00:00"), U = !1, Y("dash"),
                /* Reload the driver's trips so the Dashboard shows the updated attendance
                   and no longer offers the finished trip as "Resume trip". */
                ke()
            }), P(), ir(), rr(), nr(), r = window.matchMedia && window.matchMedia(
              "(prefers-reduced-motion: reduce)").matches, n = window.matchMedia && window
            .matchMedia("(hover: hover) and (pointer: fine)").matches, m(".kpi").forEach(
              function(e) {
                n && !r && (e.addEventListener("mousemove", function(t) {
                  var r = e.getBoundingClientRect(),
                    n = (t.clientX - r.left) / r.width - .5,
                    i = (t.clientY - r.top) / r.height - .5;
                  e.style.transform = "translateY(-6px) scale(1.018) rotateX(" + (7 * -i)
                    .toFixed(2) + "deg) rotateY(" + (8 * n).toFixed(2) + "deg)"
                }), e.addEventListener("mouseleave", function() {
                  e.style.transform = ""
                })), e.addEventListener("pointerdown", function() {
                  e.classList.add("is-lit")
                }), ["pointerup", "pointercancel", "pointerleave", "blur"].forEach(function(
                t) {
                  e.addEventListener(t, function() {
                    setTimeout(function() {
                      e.classList.remove("is-lit")
                    }, 260)
                  })
                })
              }), Tr(), setInterval(bfmTick, 6e4);
          var r, n
        }()
    } catch (e) {
      console.error("Dashboard boot error:", e), L()
    }
  })
}();