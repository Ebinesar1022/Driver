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

   This file preserves all existing behavior; only whitespace/formatting
   and section-header comments were added for readability.
   ========================================================================== */
! function() {
  "use strict";
  var e = {
      bfm: "All_BFM_Monitoring",
      trips: "All_Trips",
      duty: "All_Duty_Logs",
      alerts: "All_Alerts",
      employees: "Drivers",
      employeesFallbacks: ["Driver"],
      locations: "Locations1",
      locationsFallbacks: ["Locations", "All_Locations"]
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
      photo: ["Profile_Photo", "Profile_Photo", "Profile_Picture", "Photo"],
      address: ["Address", "Address"],
      employmentType: ["Employment_Type", "Employment_Type", "Employee_Type"],
      joiningDate: ["Joining_Date", "Joining_Date", "Date_of_Joining", "DOJ"],
      department: ["Department", "Department", "Dept"],
      licenceNo: ["Licence_NO", "Licence_NO", "Licence_No", "License_No"],
      licenceNumber: ["Licence_Number", "Licence_Number", "License_Number"],
      licenceIssueDate: ["Licence_Issue_Date", "Licence_Issue_Date", "License_Issue_Date"],
      licenceType: ["Licence_Type", "Licence_Type", "License_Type"],
      licenceExpiry: ["Licence_Expiry_Date", "Licence_Expiry_Date", "License_Expiry_Date"],
      licenceStatus: ["Licence_Status", "Licence_Status", "License_Status"],
      licenceDocument: ["Licence_Document", "Licence_Document", "License_Document"],
      licenceCopy: ["Licence_Copy", "Licence_Copy", "License_Copy"],
      vehicleName: ["Vehicle_Name", "Vehicle_Name", "Vehicle_Type", "Vehicle_Registration_No"],
      passportNumber: ["Passport_Number", "Passport_Number"],
      passportCopy: ["Passport_Copy", "Passport_Copy"],
      experience: ["Experience_Years", "Experience_Years", "Driving_Experience", "Experience"],
      lastCheckupDate: ["Last_Checkup_Date", "Last_Checkup_Date", "Last_Medical_Checkup_Date"],
      documents: ["Documents", "Documents"],
      remark: ["Remark", "Remark", "Remarks"],
      visaStatus: ["Visa_Right_to_Work_Status", "Visa_Right_to_Work_Status", "Visa_Status"],
      visaExpiryDate: ["Visa_Expiry_Date", "Visa_Expiry_Date"],
      expiryDate: ["Expiry_Date", "Expiry_Date"],
      medicalCertificate: ["Medical_Certificate", "Medical_Certificate"],
      rightToWorkDocument: ["Right_to_Work_Document", "Right_to_Work_Document"],
      identityDocumentCopy: ["Identity_Document_Copy", "Identity_Document_Copy"]
    },
    a = {
      module: "Standard BFM",
      maxContinuousWork: 360,
      restBlock: 15,
      maxWorkPerShift: 840,
      minRestPerShift: 420,
      maxWorkPerWeek: 4320,
      warnBefore: 30,
      source: "Default BFM values"
    },
    o = {
      view: "dash",
      tripStarted: !1,
      startTime: "06:30",
      endTime: "16:35",
      workedMins: 402,
      sinceRestMins: 282,
      restTakenMins: 45,
      weekWorkedMins: 2460,
      restAlertShown: !1,
      restEscalated: !1,
      notificationCount: 0,
      onBreak: !1,
      breakCount: 0
    },
    s = {
      id: "—",
      name: "Loading…",
      score: 92,
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
      vehicleName: "",
      vehicleAssigned: "",
      passportNumber: "",
      passportCopyPath: "",
      experience: "",
      lastCheckupDate: "",
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
      outTime: ""
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
    var t = new Date(e);
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

  function D(e) {
    e = Math.max(0, Math.min(100, Math.round(e)));
    var t = document.getElementById("loaderProgressFill"),
      r = document.getElementById("loaderProgressPct"),
      n = document.getElementById("loaderProgress");
    t && (t.style.width = e + "%"), r && (r.textContent = e + "%"), n && n.setAttribute(
      "aria-valuenow", String(e))
  }
  var T = 5e3,
    C = Date.now(),
    I = !1,
    S = setInterval(function() {
      I || D(Math.min(100, (Date.now() - C) / T * 100))
    }, 50);

  function E() {
    if (!I) {
      I = !0, clearInterval(S), D(100);
      var e = document.getElementById("pageLoader");
      setTimeout(function() {
        e && !e.classList.contains("is-hidden") && (e.classList.add("is-hidden"), setTimeout(
          function() {
            e.parentNode && e.remove()
          }, 600));
        try {
          Y("dash")
        } catch (e) {}
      }, 260)
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
    var e = a.maxContinuousWork - o.sinceRestMins,
      t = a.maxWorkPerShift - o.workedMins,
      r = a.maxWorkPerWeek - o.weekWorkedMins,
      n = "ok";
    e <= 0 || t <= 0 || r <= 0 ? n = "breach" : (e <= a.warnBefore || t <= a.warnBefore) && (n =
      "warn");
    var i = 0,
      s = "";
    return t <= 0 ? (i = a.minRestPerShift, s =
      "Shift work limit reached — a continuous stationary rest is required before you drive again."
      ) : e <= 0 && (i = a.restBlock, s =
      "Continuous work limit reached — take your rest block now."), {
      status: n,
      untilRest: e,
      shiftLeft: t,
      weekLeft: r,
      restRequired: i,
      restReason: s,
      rules: [{
        label: "Continuous work before rest",
        used: o.sinceRestMins,
        max: a.maxContinuousWork,
        note: "Rest required: " + a.restBlock + " continuous minutes"
      }, {
        label: "Work this shift",
        used: o.workedMins,
        max: a.maxWorkPerShift,
        note: "Rest required: " + f(a.minRestPerShift) + " continuous stationary rest"
      }, {
        label: "Work this week",
        used: o.weekWorkedMins,
        max: a.maxWorkPerWeek,
        note: "Rolling 7 days"
      }]
    }
  }

  function A(e, t) {
    var r = document.getElementById(e);
    r && (r.innerHTML = t.rules.map(function(e) {
      var t = Math.min(100, e.used / e.max * 100),
        r = t >= 100 ? "red" : t >= 88 ? "amber" : "green";
      return '<div class="bfm__rule"><span>' + e.label + " <b>" + f(e.used) + " / " + f(e
        .max) + '</b></span><div class="bar"><i class="' + r + '" style="width:' + t +
        '%"></i></div><em>' + e.note + "</em></div>"
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
        "No rest owing right now. Next rest block of " + a.restBlock + " minutes is due in " + f(e
          .untilRest) + ".")), w("bfmMeta", a.module +
        " · limits sourced from the BFM Monitoring form · warn threshold " + a.warnBefore + " min"),
      w("bfmSource", a.source), w("panelBfmModule", a.module);
    var c = u("#tripBfmHero");
    c && (c.className = "bfm__hero bfm-" + e.status), w("tripBfmState", t), w("tripBfmStateSub", r),
      w("tripBfmCountdown", e.untilRest > 0 ? f(e.untilRest) : f(e.restRequired)), w("tripBfmSrc", a
        .source), A("tripBfmRules", e);
    var l = u("#tripBfmRest");
    return l && (l.className = "bfm__rest " + e.status, w("tripBfmRestText", e.restRequired ? e
        .restReason + " Required rest: " + f(e.restRequired) + "." :
        "No rest owing right now. Next rest block due in " + f(e.untilRest) + ".")), w("tripBfm", t
        .toUpperCase()), w("tripBfmSub", e.untilRest > 0 ? "Rest due in " + f(e.untilRest) :
        "Rest " + f(e.restRequired) + " required"), w("kpiDuty", f(o.workedMins)), w("kpiDutySub",
        f(Math.max(0, e.shiftLeft)) + " left"), w("tripDriving", f(o.workedMins)), e.restRequired &&
      !o.restAlertShown && function(e) {
        o.restAlertShown = !0, M(), O();
        var t = document.createElement("div");
        t.className = "rest-alert", t.setAttribute("role", "alert"), t.innerHTML =
          '<svg width="20" height="20" style="flex:none;color:#D3352B;margin-top:1px"><use href="#i-alert"/></svg><div style=\'flex:1\'><b>Rest required now</b><p>' +
          e.restReason + " Take " + f(e.restRequired) +
          ' and log it before driving on.</p></div><button class="xbtn" aria-label="Dismiss">✕</button>',
          t.querySelector("button").addEventListener("click", function() {
            t.remove()
          }), document.body.appendChild(t), setTimeout(function() {
            o.tripStarted && !o.restEscalated && (x().restRequired > 0 && function() {
              o.restEscalated = !0, M(), O(), s.score = Math.max(0, s.score - 5), nr();
              var e = document.createElement("div");
              e.className = "rest-alert rest-alert--escalated", e.setAttribute("role",
                  "alert"), e.innerHTML =
                '<svg width="20" height="20" style="flex:none;color:#D3352B;margin-top:1px"><use href="#i-alert"/></svg><div style=\'flex:1\'><b>Required rest still missed</b><p>You haven\'t logged a qualifying rest block. 5 points have been deducted from your driver score — pull over and log a break now.</p></div><button class="xbtn" aria-label="Dismiss">✕</button>',
                e.querySelector("button").addEventListener("click", function() {
                  e.remove()
                }), document.body.appendChild(e)
            }())
          }, 12e4)
      }(e), e
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

  function B(e) {
    var t = _(e);
    if (null !== t) {
      var r = new Date,
        n = 60 * r.getHours() + r.getMinutes() - t;
      n < 0 && (n += 1440), o.workedMins = n, o.sinceRestMins = n, o.weekWorkedMins += n, o
        .restAlertShown = !1, o.restEscalated = !1, F(), P(), ir()
    }
  }

  function H() {
    o.restAlertShown = !1, o.restEscalated = !1
  }
  var V = null;

  function q() {
    if (o.tripStarted) {
      var e = _(o.startTime);
      if (null !== e) {
        var t = new Date,
          r = 3600 * t.getHours() + 60 * t.getMinutes() + t.getSeconds() - 60 * e;
        r < 0 && (r += 86400), w("tripTimerVal", p(Math.floor(r / 3600)) + ":" + p(Math.floor(r %
          3600 / 60)) + ":" + p(r % 60))
      }
    }
  }

  function W() {
    V || (q(), V = setInterval(q, 1e3))
  }
  var U = !1;

  function Z() {
    var e = u("#btnStopTimer"),
      t = u("#btnContinueDriving");
    e && (e.hidden = !!o.onBreak), t && (t.hidden = !o.onBreak)
  }

  function G() {
    o.tripStarted && (o.onBreak = !0, V && (clearInterval(V), V = null), Z())
  }

  function j() {
    o.tripStarted && (o.onBreak = !1, W(), Z(), Y("trip"))
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
  var z = ["trip", "checkin", "pod", "fuel", "incident", "vehicleissue", "break", "tripfeedback",
    "documents"
  ];

  function Y(e) {
    var t;
    o.tripStarted && -1 === z.indexOf(e) ? R("Complete your trip before leaving this workflow.") : (
      tr(), o.view = e, ["Dash", "Vcheck", "StartTrip", "Chktyres", "Chkbattery", "Chkfuel",
        "Chkgps", "Chkhealth", "Trip", "CheckIn", "Pod", "Fuel", "Incident", "VehicleIssue",
        "Break", "TripFeedback", "Documents"
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
      }(), "pod" === e && function() {
        var hub = c.hub || u("#inHub").value;
        if (w("podHubTitle", hub ? "POD — " + hub : "POD — no hub selected"), w("podHubDate", c
            .date || k()), !hub) {
          var host = u("#podItemList");
          return void(host && (host.innerHTML =
            '<li class="pod-item pod-item--empty">No hub selected. Go back and check in to a hub first.</li>'
            ))
        }
        loadPodItemsForHub(hub)
      }(), setTimeout(initPodSignaturePad, 30), "vcheck" !== e && 0 !== e.indexOf("chk") || Ne(),
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
      }(), "trip" === e ? loadTripMapOSM() : void 0, "fuel" === e ? function() {
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
        Ot())), "break" === e && function() {
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
        ), console.log(gr, "Active trip set:", K), ee())
  }

  function ee() {
    var e = K.record;
    if (e) {
      var t = le(e, "tripId") || "—",
        r = le(e, "route") || "—";
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
          "toLocation") || "—"), w("atdTripDuration", le(e, "tripDuration") || "—")
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
      var n = u("#hubPipeline");
      if (n && n.childElementCount !== Q.length && (n.innerHTML = "", Q.forEach(function(e, t) {
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
      w("hubIndexLabel", "Stop " + a.no), w("hubTotal", String(12)), w("hubBadge", "Stop #" + a.no),
        w("hubName", a.name), w("hubLocation", a.location), w("hubEta", a.eta);
      var o = u("#hubStatus");
      o && (o.textContent = ne(a.status), o.className = "hubstatus is-" + a.status), e.classList
        .remove("is-swap"), e.offsetWidth, e.classList.add("is-swap");
      var s = u("#hubPrev"),
        c = u("#hubNext");
      s && (s.disabled = 0 === J), c && (c.disabled = J === Q.length - 1), w("tripNextStopName",
        "Stop #" + r.no + " · " + r.name)
    }
  }

  function ae(e) {
    J = Math.max(0, Math.min(Q.length - 1, J + e)), ie()
  }

  function oe() {
    var e = u("#tripList");
    e && (e.innerHTML = "", te.forEach(function(t) {
      e.appendChild(function(e) {
        var t = document.createElement("li");
        return t.className = "triprow is-" + e.status.toLowerCase(), t.innerHTML =
          '<div class="triprow__main"><b class="triprow__id"></b><span class="triprow__route"></span><span class="triprow__meta"></span></div><span class="triprow__status"></span>',
          t.querySelector(".triprow__id").textContent = e.id, t.querySelector(
            ".triprow__route").textContent = e.route, t.querySelector(".triprow__meta")
          .textContent = e.window + " · " + e.stops + " stops", t.querySelector(
            ".triprow__status").textContent = e.status, t
      }(t))
    }));
    var t = te.filter(function(e) {
        return "Completed" === e.status
      }).length,
      r = te.filter(function(e) {
        return "Active" === e.status
      }).length,
      n = te.filter(function(e) {
        return "Scheduled" === e.status
      }).length;
    w("tripsAssigned", String(te.length)), w("tripsDone", String(t)), w("tripsLeft", String(te
      .length - t)), w("kpiTodayTrips", String(te.length)), w("kpiTodayTripsSub", r +
      " active · " + t + " done · " + n + " scheduled"), w("tripsDateLabel", k());
    var i = document.querySelector('[data-panel="panelTrips"] [data-fill]');
    i && i.setAttribute("data-fill", Math.round(t / te.length * 100))
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
      assignedBookings: ["Assigned_Bookings", "Bookings", "Booking_IDs"],
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
      actualDeparture: ["Actual_Departure_Date_Time"]
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

  function ue(e, t) {
    return String(e || "").trim() === String(t || "").trim()
  }

  function me(e) {
    if (!e) return 0;
    var t = Date.parse(e);
    if (!isNaN(t)) return t;
    var r = String(e).match(/(\d{1,2})-(\w{3})-(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
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
        var i = new Date(+r[3], n, +r[1], +(r[4] || 0), +(r[5] || 0));
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

  function fe(e) {
    var t = le(e, "tripId") || "—",
      r = le(e, "tripName") || "—",
      n = le(e, "route") || "—",
      i = le(e, "fromLocation") || "—",
      a = le(e, "toLocation") || "—",
      o = le(e, "startDateTime") || "—",
      s = le(e, "status") || "—",
      c = function(e) {
        if (!e) return !1;
        var t = new Date(e),
          r = new Date;
        return t.getFullYear() === r.getFullYear() && t.getMonth() === r.getMonth() && t
        .getDate() === r.getDate()
      }(me(le(e, "startDateTime"))),
      l = document.createElement("li");
    return l.className = "triprow " + ve(s), l.setAttribute("data-trip-id", t), l.innerHTML =
      '<div class="triprow__main"><b class="triprow__id"></b><span class="triprow__route" data-name></span><span class="triprow__meta" data-route></span><span class="triprow__meta" data-locations></span><span class="triprow__meta" data-date></span></div><span class="triprow__status"></span>' +
      (c ?
        '<button type="button" class="triprow__view is-start" data-nav="vcheck" data-start-trip data-trip-id="' +
        t + '">Start Trip · ' + t + "</button>" : ""), l.querySelector(".triprow__id").textContent =
      t, l.querySelector("[data-name]").textContent = r, l.querySelector("[data-route]")
      .textContent = "Route: " + n, l.querySelector("[data-locations]").textContent = "From: " + i +
      "  ·  To: " + a, l.querySelector("[data-date]").textContent = "Start: " + o, l.querySelector(
        ".triprow__status").textContent = s, l
  }

  function he(e) {
    var t = e.filter(function(e) {
      return "Assigned" === le(e, "status") && function(e) {
        if (!e) return !1;
        var t = new Date;
        return t.setHours(0, 0, 0, 0), e >= t.getTime()
      }(me(le(e, "startDateTime")))
    }).slice().sort(function(e, t) {
      return me(le(e, "startDateTime")) - me(le(t, "startDateTime"))
    });
    w("dashTripCountLabel", t.length ? t.length + (1 === t.length ? " trip" : " trips") :
      "No trips"), ge = t;
    var r = u("#startTopLabel");
    r && (r.textContent = t.length ? "Trip " + (le(t[0], "tripId") || "—") + " · ready" :
      "No trip assigned yet");
    var n = u("#dashTodayTripList");
    if (n)
      if (n.innerHTML = "", t.length) t.forEach(function(e) {
        var t = le(e, "tripId") || "—";
        ye[t] = e, n.appendChild(fe(e))
      });
      else {
        var i = document.createElement("li");
        i.className = "triprow", i.textContent = "No assigned trips for today or upcoming.", n
          .appendChild(i)
      } return t
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
    }), [u("#dashAttList"), u("#attList")].forEach(function(e) {
      if (e) {
        if (e.innerHTML = "", !l.length) {
          var t = document.createElement("li");
          return t.className = "triprow", t.textContent = r ||
            "No other trips assigned to this driver.", void e.appendChild(t)
        }
        l.forEach(function(t) {
          e.appendChild(function(e) {
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
          }(t))
        })
      }
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
      if (console.log(gr, se, "exact Driver Name matches for", e, ":", r.length, "of", t
        .length), ye = {}, !r.length) return pe("No trip assigned"), void be([], [],
        "No trips assigned to this driver.");
      be(r, he(r).map(function(e) {
        return le(e, "tripId")
      }))
    }).catch(function(e) {
      console.error(gr, "loadDriverTripsAndRender failed:", e), ye = {}, pe(
        "Couldn't load trip"), be([], [], "Couldn't load trips for this driver.")
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
        fields: ["fVcFuelType", "fFuelPct", "fFuelOk", "fVcOdo"]
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
        e < t ? "Monitor" : "Pass"), Re("#inFuelOk"), At("#inVcOdo") ? "Pass" : null]),
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
      6: {
        frontAxles: 1,
        rearDualAxles: 1
      },
      8: {
        frontAxles: 2,
        rearDualAxles: 1
      },
      12: {
        frontAxles: 2,
        rearDualAxles: 2
      },
      16: {
        frontAxles: 2,
        rearDualAxles: 3
      }
    },
    Fe = 6;

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
    var n = t.rearDualAxles;
    return (1 === n ? [-1.5] : 2 === n ? [-1.3, -1.85] : [-1.05, -1.55, -2.05]).forEach(function(e,
      t) {
      var i = t + 1,
        a = n > 1,
        o = a ? "r" + i + "r" : "rr",
        s = a ? "Rear axle " + i + " " : "Rear ";
      r[a ? "r" + i + "l" : "rl"] = {
        x: e,
        z: .83,
        dual: !0,
        label: s + "left tyres"
      }, r[o] = {
        x: e,
        z: -.83,
        dual: !0,
        label: s + "right tyres"
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
  Ue(6, !1);
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
      (a.dual ? [-.17, .17] : [0]).forEach(function(t) {
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
        }(a.x, t);
        o.add(r.w);
        var n = new e.Mesh(new e.TorusGeometry(.49, .04, 10, 28), new e
          .MeshStandardMaterial(x));
        n.rotation.x = Math.PI / 2, r.w.add(n), s.push(n)
      });
      var d = a.dual ? .58 : .53,
        u = new e.TorusGeometry(d, .045, 8, 20, Math.PI),
        m = new e.Mesh(u, i);
      m.position.set(a.x, 0, a.z), m.castShadow = !0, r.add(m), o.position.set(0, 0, a.z), o
        .userData.tyre = n;
      var p = new e.Mesh(new e.CylinderGeometry(.66, .66, a.dual ? .62 : .5, 16), new e
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
     Driver ID/Driver Name (from the currently logged-in driver),
     a default Start Time, and best-effort GPS-based Live Location
     + Live Location URL. Nothing here writes to Zoho — see
     submitStartTripPage() below for the actual save.
     ============================================================ */
  function prefillStartTripPage() {
    var drIdEl = u("#inStDriverId");
    drIdEl && (drIdEl.value = s.id || "");
    var drNmEl = u("#inStDriverName");
    drNmEl && (drNmEl.value = s.name || "");
    var idEl = u("#inStTripId");
    idEl && (idEl.value = K.tripId || X || "");
    var nmEl = u("#inStTripName");
    nmEl && (nmEl.value = K.tripName || K.tripId || X || "");
    var dEl = u("#inStDate");
    dEl && (dEl.value = k());
    var stEl = u("#inStStartTime");
    if (stEl && !stEl.value) {
      var now = new Date;
      stEl.value = p(now.getHours()) + ":" + p(now.getMinutes())
    }
    var locEl = u("#inStartLoc");
    if (locEl && !locEl.value && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(pos) {
        var la = pos.coords.latitude.toFixed(6),
          lo = pos.coords.longitude.toFixed(6);
        locEl.value || (locEl.value = la + ", " + lo);
        var urlEl = u("#inStartUrl");
        urlEl && !urlEl.value && (urlEl.value = "https://maps.google.com/?q=" + la + "," + lo)
      }, function() {}, {
        timeout: 8000
      })
    }
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
    var startTimeVal = At("#inStStartTime");
    if (!startTimeVal) return errEl.textContent = "Enter the start time.", void(errEl.hidden = !
    1);
    var odoVal = At("#inStOdo");
    if (!odoVal) return errEl.textContent = "Enter the starting odometer reading.", void(errEl
      .hidden = !1);
    if (!K.tripRecordId || !K.driverRecordId) return errEl.textContent =
      "Can't start — no assigned trip/driver is loaded yet.", void(errEl.hidden = !1);
    var tripLabel = K.tripId || X || "",
      odometerNum = Number(odoVal) || 0,
      startMinsVal = _(startTimeVal),
      endMinsVal = (startMinsVal + a.maxWorkPerShift) % 1440,
      endTimeVal = p(Math.floor(endMinsVal / 60)) + ":" + p(endMinsVal % 60),
      endLocationVal = K.record && le(K.record, "toLocation") || "",
      locVal = At("#inStartLoc"),
      urlVal = At("#inStartUrl");
    o.startTime = startTimeVal, o.endTime = endTimeVal, o.tripStarted = !0, o.startLocation =
      locVal, o.startLocationUrl = urlVal, o.endLocation = endLocationVal, o.startOdometer =
      odometerNum, w("tripStart", startTimeVal), w("tripEnd", endTimeVal), w("tripStartedAt",
        startTimeVal), w("tripWindow", startTimeVal + " – " + endTimeVal), w("tripStartLoc",
        locVal), w("kpiStatus", "IN TRANSIT");
    var stickyEl = u("#stickyStart");
    stickyEl && (stickyEl.textContent = "Open trip", stickyEl.setAttribute("data-nav", "trip")),
      ee(), B(startTimeVal), W(), U || (U = !0, function() {
        try {
          history.pushState({
            skywayTripGuard: !0
          }, "")
        } catch (e) {}
      }()), M(), R("Trip " + tripLabel + " started at " + startTimeVal +
        " — saved to Zoho Creator"), Y("trip");
    if (window.ZOHO && ZOHO.CREATOR && ZOHO.CREATOR.DATA) {
      var stTodayD = new Date,
        stZohoDate = p(stTodayD.getDate()) + "-" + h[stTodayD.getMonth()] + "-" + stTodayD
        .getFullYear();
      var stDriverEmpId = await resolveEmployeeFormId(),
        stDriverId = stDriverEmpId || K.driverEmployeeRecordId || K.driverRecordId;
      var tsPayload = {
        Driver_ID: stDriverId,
        Trip_ID: K.tripRecordId || K.tripId,
        Date_field: stZohoDate,
        Starting_Odometer_Reading: odometerNum,
        Driver_Name: stDriverId,
        Trip_Name: K.tripRecordId || K.tripId,
        Start_Time: b(startTimeVal)
      };
      locVal && (tsPayload.Live_Location = locVal), urlVal && (tsPayload.Live_Location_URL = {
        url: urlVal
      }), await ZOHO.CREATOR.DATA.addRecords({
        form_name: "Start_Trip_in_Driver",
        payload: {
          data: tsPayload
        }
      }).then(function() {
        return K.tripRecordId && ZOHO.CREATOR.DATA.updateRecords ? ZOHO.CREATOR.DATA
          .updateRecords({
            form_name: "Trip_Dispatch",
            id: K.tripRecordId,
            payload: {
              data: {
                Starting_Odometer: odometerNum
              }
            }
          }).catch(function(e) {
            console.error(gr, "Could not write Starting_Odometer back to Trip_Dispatch1:",
              e)
          }) : null
      }).catch(function(e) {
        console.error(gr, "Start_Trip_in_Driver save failed:", e), R(
          "Couldn't save the trip start — please try again.")
      })
    }
  }

  function _t() {
    var e = u("#checkInErr");
    e.hidden = !0;
    var t = u("#inHub").value,
      r = u("#inCheckInTime").value;
    return t ? r ? (c = {
      hub: t,
      date: u("#inCheckDate").value,
      inTime: r,
      outTime: u("#inCheckOutTime").value
    }, R("Checked in at " + t + " — opening POD"), void Y("pod")) : (e.textContent =
      "Enter your check-in time.", void(e.hidden = !1)) : (e.textContent =
      "Select the hub you're checking in to.", void(e.hidden = !1))
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
     by populateHubDropdown() below) to its real Locations record ID
     via HUB_NAME_TO_ID, plus every other field entered on the page.
     ============================================================ */
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
          r = document.querySelector('[data-qty="' + e.id + '"]');
        return {
          id: e.id,
          name: e.name,
          delivered: !!t && t.checked,
          qty: r && Number(r.value) || 0
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
    }), Dt();
    var empId = await resolveEmployeeFormId(),
      todayD = new Date,
      zohoDate = p(todayD.getDate()) + "-" + h[todayD.getMonth()] + "-" + todayD.getFullYear(),
      itemSummary = i.length ? "Items: " + deliveredCount + " of " + i.length + " delivered (" + i
      .map(function(e) {
        return e.name + " x" + e.qty
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
      .outTime)), HUB_NAME_TO_ID[n] ? payload.Hub_Name = HUB_NAME_TO_ID[n] : console.warn(gr,
      "Hub_Check_in_Check_Out1 saved without Hub_Name — no matching Locations record id found for",
      n);
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
        var podIds = (await Promise.all(deliveredItems.map(function(item) {
          var podPayload = {
            Item: cr2(item.id),
            Quantity: item.qty
          };
          return sig && (podPayload.Receiver_Signature = sig), ZOHO.CREATOR.DATA
            .addRecords({
              form_name: "POD",
              payload: {
                data: podPayload
              }
            }).then(function(res) {
              return res && res.data && (res.data.ID || res.data.id) || null
            }).catch(function(err) {
              return console.error(gr, "POD item save failed:", err), null
            })
        }))).filter(Boolean);
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
    R("POD saved for " + n + " — " + r), u("#podNotes").value = "", sigPadClear(), t && (t.value =
      ""), Y("trip");
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
          Odometer_Reading: a.mileage
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
      console.log(gr, "saved. record id:", a && a.data && a.data.ID), Ft.unshift(r), [
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
      t = K.driverRecordId || K.driverEmployeeRecordId || null;
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
    }, 350)), w("scoreMini", s.score), w("scoreBig", s.score)
  }

  function ir() {
    var e = x(),
      t = [];
    e.restRequired ? t.push({
      tone: "red",
      text: "Rest required now — " + f(e.restRequired) + " before driving on",
      time: "Now"
    }) : t.push({
      tone: "amber",
      text: "Rest block due in " + f(e.untilRest),
      time: "Scheduled"
    }), t.push({
      tone: "amber",
      text: "Vehicle service due in 620 km",
      time: "13 minutes ago"
    }), t.push({
      tone: "green",
      text: "POD successfully submitted — Stop #8",
      time: "12:20"
    }), t.push({
      tone: "green",
      text: "Route updated by Dispatch — continue on the M31",
      time: "11:02"
    }), t.push({
      tone: "amber",
      text: "Medical certificate expires in 28 days",
      time: "Today"
    }), u("#alertList").innerHTML = t.map(function(e) {
      return '<li class="alert ' + e.tone + '"><i class="status-dot ' + e.tone +
        '" style="margin-top:5px"></i><div><p>' + e.text + "</p><time>" + e.time +
        "</time></div></li>"
    }).join("")
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
    a && (a.textContent = n || "--"), r && i && (window.ZOHO && ZOHO.CREATOR && ZOHO.CREATOR.UTIL &&
      ZOHO.CREATOR.UTIL.setImageData ? ZOHO.CREATOR.UTIL.setImageData(i, r, function() {
        i.hidden = !1, a && (a.hidden = !0)
      }) : (i.src = r, i.hidden = !1, a && (a.hidden = !0)))
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

  function vr() {
    return ZOHO.CREATOR.DATA.getRecords({
      report_name: e.bfm,
      criteria: '(Driver_ID == "' + s.id + '" && Active == true)',
      field_config: "all",
      max_records: 200
    }).then(function(e) {
      var t;
      (t = e && e.data && e.data[0]) && (a.module = t.Fatigue_Module || a.module, a
        .maxContinuousWork = Number(t.Max_Continuous_Work_Minutes) || a.maxContinuousWork, a
        .restBlock = Number(t.Rest_Block_Minutes) || a.restBlock, a.maxWorkPerShift = Number(t
          .Max_Work_Per_Shift_Minutes) || a.maxWorkPerShift, a.minRestPerShift = Number(t
          .Min_Rest_Per_Shift_Minutes) || a.minRestPerShift, a.maxWorkPerWeek = Number(t
          .Max_Work_Per_Week_Minutes) || a.maxWorkPerWeek, a.warnBefore = Number(t
          .Warning_Threshold_Minutes) || a.warnBefore, a.source = "BFM Monitoring · " + (t
          .Rule_Set_Name || a.module))
    }).catch(function() {
      a.source = "Default BFM values (form unreachable)"
    }).then(function() {
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
        .name), mr("hdrAvatarImg", "hdrAvatarInitials", s.photoPath, r), mr("panelAvatarImg",
        "panelAvatarInitials", s.photoPath, r), hr(), w("panelEmployeeId", s.id || "—"), w(
        "panelName", s.name || "—"), w("panelGender", s.gender || "—"), w("panelDob", s.dob || "—"),
      w("panelMobile", s.mobile || "—"), w("panelEmail", s.email || "—"), w("panelAddress", s
        .address || "—"), w("panelEmploymentType", s.employmentType || "—"), w("panelStarted", s
        .started || "—"), w("panelDepartment", s.department || "—"), w("panelLicenceNo", s
        .licenceNo || "—"), w("panelLicenceClass", s.licenceClass || "—"), w(
        "panelLicenceIssueDate", s.licenceIssueDate || "—"), w("panelLicenceExpiry", s
        .licenceExpiry || "—"), w("panelLicenceStatus", s.licenceStatus || "—");
    var n = s.experience,
      i = "" !== n && !isNaN(Number(n));
    w("panelExperience", n ? i ? n + " years" : String(n) : "—"), w("panelLastCheckup", s
      .lastCheckupDate || "—");
    var a = document.getElementById("panelDocWarn"),
      o = document.getElementById("panelDocWarnText"),
      c = ur(s.licenceExpiry);
    a && o && (null !== c && c <= 30 ? (o.textContent = c < 0 ? "Licence expired " + Math.abs(c) +
      " days ago" : "Licence expires in " + c + " days", a.hidden = !1) : a.hidden = !0)
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
  var HUB_NAME_TO_ID = {};
  var CURRENT_POD_ITEMS = [];
  var CURRENT_POD_LOADING = false;
  var BOOKING_REPORT_CANDIDATES = ["Booking_Shipments", "All_Booking_Shipments", "Bookings",
    "All_Bookings"
  ];
  var BOOKING_FIELD_CANDIDATES = {
    bookingId: ["Booking_ID"],
    assignedHub: ["Assigned_Hub"],
    pickupLocation: ["Pickup_Location"],
    deliveryLocation: ["Delivery_Location"],
    route: ["Route"],
    shipmentItems: ["Shipment_Items"]
  };
  var SHIPMENT_ITEM_FIELD_CANDIDATES = {
    name: ["Item_Name", "Item", "Product_Name", "Item_Description", "Product", "Name",
      "Description"
    ],
    qty: ["Quantity", "Qty", "Item_Quantity", "Units", "No_of_Units", "Total_Quantity"]
  };

  function idListOf(raw) {
    if (null == raw) return [];
    var arr = Array.isArray(raw) ? raw : [raw];
    return arr.map(function(v) {
      return null == v ? "" : "string" == typeof v || "number" == typeof v ? String(v).trim() :
        String(v.ID || v.zc_id || v.id || "").trim()
    }).filter(Boolean)
  }
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

  function renderPodItemsUI() {
    var host = u("#podItemList");
    if (host) {
      if (CURRENT_POD_LOADING) return void(host.innerHTML =
        '<li class="pod-item pod-item--empty">Loading items…</li>');
      if (!CURRENT_POD_ITEMS.length) return void(host.innerHTML =
        '<li class="pod-item pod-item--empty">No items found for this booking/trip at this hub.</li>'
        );
      host.innerHTML = CURRENT_POD_ITEMS.map(function(p) {
        return '<li class="pod-item"><label class="pod-item__check"><input type="checkbox" data-pid="' +
          p.id + '" checked><span>' + p.name +
          '</span></label><div class="pod-item__qty"><span>Qty delivered</span><input type="number" min="0" data-qty="' +
          p.id + '" value="' + p.qty + '"></div></li>'
      }).join("")
    }
  }
  var SHIPMENT_ITEMS_REPORT_CANDIDATES = ["Shipment_Items", "All_Shipment_Items"];
  var SHIPMENT_ITEM_HUB_FIELD = ["Hub_Name"];
  var SHIPMENT_ITEM_BOOKING_LINK_FIELD = ["Booking_Shipments"];

  function fetchShipmentItemsReport(criteria) {
    return function tryReport(idx) {
      return idx >= SHIPMENT_ITEMS_REPORT_CANDIDATES.length ? Promise.resolve([]) : kr({
        report_name: SHIPMENT_ITEMS_REPORT_CANDIDATES[idx],
        criteria: criteria,
        field_config: "all",
        max_records: 200
      }).then(function(res) {
        return res && res.data || []
      }).catch(function(err) {
        return console.warn(gr, "getRecords on", SHIPMENT_ITEMS_REPORT_CANDIDATES[idx],
          "(Shipment_Items) failed:", err), tryReport(idx + 1)
      })
    }(0)
  }

  function mapShipmentItemRecords(rows) {
    return rows.map(function(rec) {
      var nm = cr(sr(rec, SHIPMENT_ITEM_FIELD_CANDIDATES.name)) || "Item",
        qty = Number(sr(rec, SHIPMENT_ITEM_FIELD_CANDIDATES.qty)) || 0;
      return {
        id: rec.ID || rec.id || "",
        name: nm,
        qty: qty
      }
    }).filter(function(it) {
      return it.id
    })
  }

  function rawLookupId(v) {
    if (null == v) return "";
    if (Array.isArray(v)) v = v[0];
    return null == v ? "" : "string" == typeof v || "number" == typeof v ? String(v).trim() :
      String(v.ID || v.zc_id || v.id || "").trim()
  }
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

  function getTripBookingIds() {
    var tripRec = K.record;
    return tripRec ? idListOf(sr(tripRec, ce.assignedBookings)) : []
  }

  function fetchTripHubLocations() {
    var bookingIds = getTripBookingIds();
    if (!bookingIds.length) return Promise.resolve([]);
    var crit = "(" + bookingIds.map(function(id) {
      return SHIPMENT_ITEM_BOOKING_LINK_FIELD[0] + ' == "' + id + '"'
    }).join(" || ") + ")";
    return fetchShipmentItemsReport(crit).then(function(rows) {
      var hubIds = [];
      rows.forEach(function(rec) {
        var raw = sr(rec, SHIPMENT_ITEM_HUB_FIELD),
          id = rawLookupId(raw);
        id && -1 === hubIds.indexOf(id) && hubIds.push(id)
      });
      if (!hubIds.length) return [];
      var locCandidates = [e.locations].concat(e.locationsFallbacks || []).filter(function(v, i,
        arr) {
        return v && arr.indexOf(v) === i
      });
      return function tryLoc(idx) {
        if (idx >= locCandidates.length) return [];
        var crit2 = "(" + hubIds.map(function(id) {
          return "ID == " + id
        }).join(" || ") + ")";
        return kr({
          report_name: locCandidates[idx],
          field_config: "all",
          max_records: 200
        }).then(function(res) {
          var rows2 = res && res.data || [],
            matched = rows2.filter(function(rec) {
              return -1 !== hubIds.indexOf(String(rec.ID || rec.id || ""))
            });
          return matched.map(function(rec) {
            var nm = cr(sr(rec, t)) || "Hub",
              lat = locNumField(rec, LOC_LAT_FIELDS),
              lng = locNumField(rec, LOC_LNG_FIELDS),
              addrRaw = rec.Hub_Location,
              addr = addrRaw && typeof addrRaw == "object" ? [addrRaw.address_line_1,
                addrRaw.address_line_2, addrRaw.district_city, addrRaw.state_province
              ].filter(Boolean).join(", ") : "";
            return {
              id: rec.ID || rec.id || "",
              name: nm,
              lat: lat,
              lng: lng,
              address: addr
            }
          }).filter(function(h) {
            return null != h.lat && null != h.lng
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
    if (!el || typeof L == "undefined") return null;
    var map = L.map(el, {
      scrollWheelZoom: false
    }).setView([-25.2744, 133.7751], 4);
    return L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 18
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
    panel && (w("mapHubInfoBadge", "Hub"), w("mapHubInfoName", hub.name), w("mapHubInfoLoc", hub
      .address || (hub.lat.toFixed(5) + ", " + hub.lng.toFixed(5))), panel.hidden = !1);
    var m = tripMapState.markers.filter(function(mk) {
      return mk._hubName === name
    })[0];
    m && tripMapState.map && (tripMapState.map.setView(m.getLatLng(), 13), m.openPopup())
  }

  function renderTripMapHubs(hubs) {
    var map = ensureTripMapInit(),
      emptyEl = u("#tripMapEmpty"),
      chip = u("#mapHubCountText");
    if (tripMapState.markers.forEach(function(m) {
        map && map.removeLayer(m)
      }), tripMapState.markers = [], tripMapState.hubs = hubs, !map) return void(emptyEl && (emptyEl
      .hidden = !1));
    if (!hubs.length) return emptyEl && (emptyEl.hidden = !1), void(chip && (chip.textContent =
      "No hubs found"));
    emptyEl && (emptyEl.hidden = !0), chip && (chip.textContent = hubs.length + " hub" + (1 === hubs
      .length ? "" : "s") + " on this trip");
    var bounds = [];
    hubs.forEach(function(h) {
      var marker = L.marker([h.lat, h.lng]).addTo(map).bindPopup("<b>" + h.name + "</b>" + (h
        .address ? "<br>" + h.address : ""));
      marker._hubName = h.name, marker.on("click", function() {
        selectMapHubOSM(h.name)
      }), tripMapState.markers.push(marker), bounds.push([h.lat, h.lng])
    }), bounds.length && map.fitBounds(bounds, {
      padding: [36, 36],
      maxZoom: 13
    });
    var filt = u("#mapHubFilter");
    filt && (filt.innerHTML = '<option value="">All hubs</option>', hubs.forEach(function(h) {
      var opt = document.createElement("option");
      opt.value = h.name, opt.textContent = h.name, filt.appendChild(opt)
    }), filt.onchange = function() {
      var v = filt.value;
      v ? selectMapHubOSM(v) : (u("#mapHubInfo") && (u("#mapHubInfo").hidden = !0), bounds
        .length && map.fitBounds(bounds, {
          padding: [36, 36],
          maxZoom: 13
        }))
    })
  }

  function loadTripMapOSM() {
    if (typeof L == "undefined") return void setTimeout(loadTripMapOSM, 300);
    var map = ensureTripMapInit();
    if (map) setTimeout(function() {
      map.invalidateSize()
    }, 60);
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

  function loadPodItemsForHub(hubName) {
    CURRENT_POD_LOADING = true, renderPodItemsUI();
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA) return CURRENT_POD_ITEMS = (d[
      hubName] || []).map(function(p) {
      return {
        id: p.id,
        name: p.name,
        qty: p.qty
      }
    }), CURRENT_POD_LOADING = false, void renderPodItemsUI();
    var tripRec = K.record,
      bookingIds = tripRec ? idListOf(sr(tripRec, ce.assignedBookings)) : [];

    function finish(items, source) {
      console.log(gr, "POD items resolved via", source, "-", items.length, "item(s)"),
        CURRENT_POD_LOADING = false, CURRENT_POD_ITEMS = items, renderPodItemsUI()
    }

    function tryHubMatch() {
      if (!hubName) return void finish([], "none — no hub selected");
      var critH = "(" + SHIPMENT_ITEM_HUB_FIELD[0] + ' == "' + hubName.replace(/"/g, '\\"') + '")';
      fetchShipmentItemsReport(critH).then(function(rows) {
        finish(mapShipmentItemRecords(rows), "Hub_Name match")
      }).catch(function() {
        finish([], "hub match failed")
      })
    }
    if (bookingIds.length) {
      var crit = "(" + bookingIds.map(function(id) {
        return SHIPMENT_ITEM_BOOKING_LINK_FIELD[0] + ' == "' + id + '"'
      }).join(" || ") + ")";
      fetchShipmentItemsReport(crit).then(function(rows) {
        var items = mapShipmentItemRecords(rows);
        items.length ? finish(items, "Trip's assigned Booking(s) match") : tryHubMatch()
      }).catch(tryHubMatch)
    } else tryHubMatch()
  }

  /* ------------------------------------------------------------
     Populates the Hub Name <select> on the Hub Check-In / Check-Out
     page from the real Locations report in Zoho Creator (tries
     Locations1, then falls back through Locations / All_Locations).
     ------------------------------------------------------------ */
  function Dr() {
    if (!window.ZOHO || !ZOHO.CREATOR || !ZOHO.CREATOR.DATA) return Promise.resolve();
    var r = [e.locations].concat(e.locationsFallbacks || []).filter(function(e, t, r) {
      return e && r.indexOf(e) === t
    });
    return function e(n) {
      if (!(n >= r.length)) return kr({
        report_name: r[n],
        field_config: "all",
        max_records: 200
      }).then(function(e) {
        ! function(e) {
          var r = u("#inHub");
          if (r) {
            HUB_NAME_TO_ID = {};
            var names = [];
            e.forEach(function(rec) {
              var nm = cr(sr(rec, t));
              nm && void 0 === HUB_NAME_TO_ID[nm] && (HUB_NAME_TO_ID[nm] = rec.ID || rec
                .id || null, names.push(nm))
            });
            var a = r.value;
            r.innerHTML = '<option value="">Select a hub…</option>', names.forEach(function(
              e) {
              var t = document.createElement("option");
              t.value = e, t.textContent = e, r.appendChild(t)
            }), a && -1 !== names.indexOf(a) && (r.value = a)
          }
        }(e && e.data || [])
      }).catch(function(t) {
        return console.error(gr, "getRecords on", r[n], "(Locations) failed:", t), e(n + 1)
      });
      console.error(gr, "Could not read a Locations report for Hub Name (tried: " + r.join(", ") +
        ").")
    }(0)
  }

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
            "mobile"), s.altMobile = r("altMobile"), s.dob = r("dob"), s.photoPath = r("photo"),
          s.address = r("address", dr), s.employmentType = r("employmentType"), s.started = r(
            "joiningDate"), s.department = r("department", cr), s.licenceNo = r("licenceNo"), s
          .licenceNumber = r("licenceNumber"), s.licenceIssueDate = r("licenceIssueDate"), s
          .licenceClass = r("licenceType", cr), s.licenceExpiry = r("licenceExpiry"), s
          .licenceStatus = r("licenceStatus", cr), s.licenceDocumentPath = r("licenceDocument"),
          s.licenceCopyPath = r("licenceCopy"), s.vehicleName = r("vehicleName", cr), s
          .vehicleAssigned = s.vehicleName, s.passportNumber = r("passportNumber"), s
          .passportCopyPath = r("passportCopy"), s.experience = r("experience"), s
          .lastCheckupDate = r("lastCheckupDate"), s.documentsPath = r("documents"), s.remark =
          r("remark"), s.visaStatus = r("visaStatus", cr), s.visaExpiryDate = r(
            "visaExpiryDate"), s.expiryDate = r("expiryDate"), s.medicalCertificatePath = r(
            "medicalCertificate"), s.rightToWorkDocumentPath = r("rightToWorkDocument"), s
          .identityDocumentCopyPath = r("identityDocumentCopy"), s.bfmAccreditation = n && e[
          n] || "", s.loaded = !0, console.log(gr, "Field mapping report:"), console.table ?
          console.table(t) : console.log(t), console.log(gr,
            "Raw record returned by Zoho (all keys as-received):", e)
      }(t)
    }).then(function() {
      yr(), ke(), vr(), L()
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
                          r), w("tdRoute", le(e, "route") || "—"), w("tdBookingDate", le(
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
                        a && (a.value = "https://maps.google.com/?q=" + t + "," + i);
                        var o = u(n);
                        o && !o.value && (o.value = t + ", " + i), R("Location captured")
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
            }), u("#scrim").addEventListener("click", tr), m("[data-close]").forEach(function(
            e) {
              e.addEventListener("click", tr)
            }), document.addEventListener("keydown", function(e) {
              "Escape" === e.key && (tr(), u("#tyrePopup").hidden || Ye(), u(
                  "#docViewerPopup").hidden || pr(), u("#driverDocsPopup").hidden ||
                closeDriverDocsPopup())
            }), t("#dashAttList"), t("#attList"), e("#btnAttSummary", "click", function() {
              er("panelAttendance", null), De()
            }), e("#btnStartTripCta", "click", bt), e("#btnSubmitStartTrip", "click",
              submitStartTripPage), e("#btnSetStartTime", "click", function() {
              var el = u("#inStStartTime");
              if (el) {
                var now = new Date;
                el.value = p(now.getHours()) + ":" + p(now.getMinutes())
              }
              var dEl = u("#inStDate");
              dEl && (dEl.value = k())
            }), e("#btnSaveVcheck", "click", gt), e("#veh3dFallback", "click", function(e) {
              var t = e.target.closest(".tyre3d__tyre");
              t && ze(t.getAttribute("data-tyre"))
            }), e("#tyrePopupSave", "click", Qe), e("#tyrePopupCancel", "click", Ye), e(
              "#tyrePopupClose", "click", Ye), e("#tyreScrim", "click", Ye), e(
              "#tyrePopupInput", "keydown",
              function(e) {
                "Enter" === e.key && Qe()
              }), e("#tyreCountFilter", "change", function(e) {
              Ze(e.target.value)
            }), e("#btnPanelViewDocs", "click", function() {
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
              var e = u("#dashTodayTripList");
              if (e) {
                e.innerHTML = "";
                var t = document.createElement("li");
                t.className = "triprow", t.textContent = "Loading trips…", e.appendChild(t)
              }
            }(), Te(), m(".checkcard input, .checkcard select").forEach(function(e) {
              e.addEventListener("input", Ne), e.addEventListener("change", Ne)
            }), m(".checkcard .yn-btn").forEach(function(e) {
              e.addEventListener("click", function() {
                setTimeout(Ne, 0)
              })
            }), e("#btnSaveCheckIn", "click", _t), e("#btnGoToPod", "click", kt), e(
              "#btnSavePod", "click", wt), e("#btnClearSignature", "click", sigPadClear), window
            .addEventListener("resize", function() {
              sigPad.canvas && sigPadResize()
            }), e("#btnSaveFuel", "click", Lt), e("#inFuelQty", "input", St), e("#inFuelCost",
              "input", St), e("#inIncTime", "input", Bt), e("#inIncEndTime", "input", Bt), e(
              "#btnSaveIncident", "click", qt), e("#btnSaveVehicle", "click", Zt), e(
              "#btnSaveBreak", "click", Yt), e("#btnContinueDriving", "click", j), e(
              "#inBrkStart", "input", zt), e("#inBrkEnd", "input", zt), Dt(), e("#btnComplete",
              "click",
              function() {
                Y("tripfeedback")
              }), e("#btnSubmitTripFeedback", "click", function() {
              var e = u("#tfbErr");
              e.hidden = !0, xt(["fTfbFeedback"]);
              var t = At("#inTfbFeedback");
              if (!t) return u("#fTfbFeedback").classList.add("is-bad"), e.textContent =
                "Enter some feedback before submitting.", void(e.hidden = !1);
              Mt("Trip_Feedback", {
                  Trip_ID: At("#inTfbTripId"),
                  Trip_Name: At("#inTfbTripName"),
                  Trip_Feedback: t
                }), R("Trip " + (K.tripId || X) + " completed — feedback submitted"), o
                .tripStarted = !1, o.breakCount = 0, u("#inTfbFeedback").value = "", H(), V &&
                (clearInterval(V), V = null), w("tripTimerVal", "00:00:00"), U = !1, Y("dash")
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
              }), Tr(), setInterval(function() {
              o.tripStarted && (o.workedMins += 1, o.sinceRestMins += 1, o.weekWorkedMins +=
                1, P(), ir())
            }, 6e4);
          var r, n
        }()
    } catch (e) {
      console.error("Dashboard boot error:", e), L()
    }
  })
}();