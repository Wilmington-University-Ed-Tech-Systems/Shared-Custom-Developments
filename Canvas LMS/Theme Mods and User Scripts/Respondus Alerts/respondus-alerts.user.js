// ==UserScript==
// @name         Respondus Alerts
// @namespace    https://github.com/Wilmington-University-Ed-Tech-Systems/Shared-Custom-Developments/tree/main/Canvas%20LMS/Theme%20Mods%20and%20User%20Scripts/Respondus%20Alerts
// @version      1.0.0
// @description  Adds alerts for Respondus activation and potential setting errors. Also, logs visiting the Respondus LockDown Browser Dashboard.
// @author       James Sekcienski, Ed Tech Systems, Wilmington University
// @match      https://*.instructure.com/courses/*
// ==/UserScript==

"use strict";

(() => {
  // CONFIGS
  const RESPONDUS_TOOL_ID = 199; // NEED TO UPDATE for your instance. Respondus LockDown Browser External Tool ID
  const LOG_PAGE_TITLE = "zzz_WU-Tool-Activation-Log";

  if (/^\/courses\/[0-9]+\??[^\/]*\/?$/.test(window.location.pathname)) {
    addToolActivationTracker();
  } else {
    const respondusToolPathNamePattern = new RegExp(
      `^\/courses\/[0-9]+\/external_tools\/${RESPONDUS_TOOL_ID}$`
    );
    if (respondusToolPathNamePattern.test(window.location.pathname)) {
      logActivation("respondus");
    }
  }

  async function hasNecessaryPermissions() {
    const courseId = window.location.pathname.split("/")[2];
    const permissions = await getCoursePermissions(courseId);
    return (
      permissions?.read_as_admin &&
      permissions?.manage_wiki_create &&
      permissions?.manage_wiki_update &&
      permissions?.manage_assignments_edit
    );
  }

  async function getCoursePermissions(courseId) {
    const pageResponse = await getRequestLinksAndResults(
      `${window.location.protocol}//${window.location.hostname}/api/v1/courses/${courseId}/permissions`
    );

    if (pageResponse) {
      return pageResponse?.results;
    } else {
      return {};
    }
  }

  async function addToolActivationTracker() {
    const hasPermissions = await hasNecessaryPermissions();
    if (!hasPermissions) {
      return;
    }

    const courseHomeRightSideButtonsDiv = document.getElementById(
      "course_show_secondary"
    );
    if (courseHomeRightSideButtonsDiv) {
      const auditResults = await getAuditResults();

      updateTopCourseAlerts(auditResults);
    }
  }

  async function getAuditResults() {
    const courseId = window.location.pathname.split("/")[2];

    const auditResults = {};

    // Check Respondus
    const respondusResults = await checkRespondus(courseId);
    auditResults.respondus = respondusResults;

    return auditResults;
  }

  function updateTopCourseAlerts(auditResults) {
    const recentAnnouncementsDiv = document.getElementById(
      "announcements_on_home_page"
    );
    const courseHomeContentDiv = document.getElementById("course_home_content");
    const topCourseHomeDiv = recentAnnouncementsDiv
      ? recentAnnouncementsDiv
      : courseHomeContentDiv;

    if (auditResults?.respondus?.needsActivation) {
      const message = `
        <div>
          <p>${auditResults.respondus?.reason}</p>
          <p>${auditResults.respondus?.solution}</p>
        </div>
      `;
      const alert = createAlert(message, "ERROR", true);
      topCourseHomeDiv.insertAdjacentElement("beforebegin", alert);
    }
  }

  async function checkRespondus(courseId) {
    const respondusResults = {};
    const respondusQuizzes = await getAllCourseRespondusQuizzes(courseId);

    // Has Quiz with "Require Respondus" in the name
    if (respondusQuizzes.length > 0) {
      respondusResults.usesRespondus = true;
    } else {
      respondusResults.usesRespondus = false;
      respondusResults.needsActivation = false;
      respondusResults.reason =
        "No quizzes with 'Requires Respondus' in the name.";
      respondusResults.solution = "N/A";
      return respondusResults;
    }

    // Is there an activation log yet?
    const logPage = await getLogPage();
    if (!logPage || !logPage?.body) {
      respondusResults.needsActivation = true;
      respondusResults.reason =
        "LockDown Browser is not activated for this course.";
      respondusResults.solution = `Go to <a href='/courses/${courseId}/external_tools/${RESPONDUS_TOOL_ID}'>LockDown Browser settings</a> to activate this course. After the page loads, it will be activated.`;
      return respondusResults;
    }

    // Is Respondus in the activation log yet?
    const logBody = logPage?.body;
    const tempDoc = new DOMParser().parseFromString(logBody, "text/html");
    if (
      !tempDoc.body.querySelector(`table#course-${courseId} tbody tr.respondus`)
    ) {
      respondusResults.needsActivation = true;
      respondusResults.reason =
        "LockDown Browser is not activated for this course.";
      respondusResults.solution = `Go to <a href='/courses/${courseId}/external_tools/${RESPONDUS_TOOL_ID}'>LockDown Browser settings</a> to activate this course. After the page loads, it will be activated.`;
      return respondusResults;
    }

    // Has Quiz with "Require Respondus" and settings not enabled
    for (const quiz of respondusQuizzes) {
      if (
        !quiz?.require_lockdown_browser ||
        (quiz?.title?.includes("+ Webcam") &&
          !quiz?.require_lockdown_browser_monitor)
      ) {
        respondusResults.needsActivation = true;
        respondusResults.reason =
          "At least one quiz says it 'Requires Respondus', but it isn't enabled properly.";
        respondusResults.solution = `
          <p>
            Go to <a href='/courses/${courseId}/external_tools/${RESPONDUS_TOOL_ID}'>LockDown Browser settings</a> and review the settings.
          </p> 
          <details>
            <summary>Expected Respondus Settings</summary>
            <div>
              For each quiz with "Requires Respondus LockDown Browser + Webcam" in the name, ensure the following:</p>
              <ul>
                <li>LockDown Browser is "Required"</li>
                <li>
                  Proctoring is "Respondus Monitor"
                  <ul>
                    <li>
                      *To allow use of iPads with 'Webcam Only' proctoring, enable 'Allow use of an iPad for this exam' in the 'Advanced Settings' under Proctoring.
                    </li>
                    <li>
                      <em>iPads do not currently support screen recording.</em>
                    </li>
                  </ul>
                </li>
              </ul>
            </div>
          </details>
        `;
        return respondusResults;
      }
    }

    // Is there a quiz without 'Requires Respondus' that has Respondus enabled?
    const allQuizzes = await getAllCourseQuizzes(courseId);
    for (const quiz of allQuizzes) {
      if (quiz?.title?.includes("Requires Respondus")) {
        continue;
      }

      if (
        quiz?.require_lockdown_browser ||
        quiz?.require_lockdown_browser_monitor
      ) {
        respondusResults.needsActivation = true;
        respondusResults.reason =
          "At least one quiz has LockDown Browser and/or Monitor enabled, but the name is not configured properly.";
        respondusResults.solution = `Go to <a href='/courses/${courseId}/external_tools/${RESPONDUS_TOOL_ID}'>LockDown Browser settings</a> to review the quizzes. Each quiz without 'Requires Respondus' in the name, that shows LockDown Browser as 'Required' and/or Proctoring as 'Respondus Monitor' needs to be fixed.`;
        return respondusResults;
      }
    }

    // Passed all checks
    respondusResults.needsActivation = false;
    respondusResults.reason =
      "Respondus enabled on quizzes and course activated.";
    return respondusResults;
  }

  async function getAllCourseRespondusQuizzes(courseId) {
    const courseQuizzes = await getPaginatedRequestResults(
      `${window.location.protocol}//${window.location.hostname}/api/v1/courses/${courseId}/all_quizzes?per_page=100&search_term=requires%20respondus`
    );
    return courseQuizzes;
  }

  async function getAllCourseQuizzes(courseId) {
    const courseQuizzes = await getPaginatedRequestResults(
      `${window.location.protocol}//${window.location.hostname}/api/v1/courses/${courseId}/all_quizzes?per_page=100`
    );
    return courseQuizzes;
  }

  async function logActivation(tool) {
    const hasPermissions = await hasNecessaryPermissions();
    if (!hasPermissions) {
      return;
    }
    let logPage = await getLogPage();
    if (!logPage) {
      logPage = await createLogPage();
    }

    if (!logPage) {
      console.error("Missing log page");
      return;
    }

    updateLogPage(logPage, tool);
  }

  async function getLogPage() {
    const courseId = window.location.pathname.split("/")[2];
    const logPagesResponse = await getPaginatedRequestResults(
      `${window.location.protocol}//${window.location.hostname}/api/v1/courses/${courseId}/pages?include[]=body&search_term=${LOG_PAGE_TITLE}`
    );

    if (logPagesResponse) {
      return logPagesResponse[0];
    } else {
      return logPagesResponse;
    }
  }

  async function createLogPage() {
    const CSRFtoken = function () {
      return decodeURIComponent(
        (document.cookie.match("(^|;) *_csrf_token=([^;]*)") || "")[2]
      );
    };

    const courseId = window.location.pathname.split("/")[2];
    const url = `${window.location.protocol}//${window.location.hostname}/api/v1/courses/${courseId}/pages`;
    const params = {
      wiki_page: {
        title: LOG_PAGE_TITLE,
        body: `
          <table id='course-${courseId}' class='ic-Table ic-Table--hover-row ic-Table--striped'>
            <thead>
              <tr>
                <th>Tool</th>
                <th>Date/Time</th>
              </tr>
            </thead>
            <tbody>
            </tbody>
          </table>
        `,
        published: 0,
      },
    };
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-CSRF-Token": CSRFtoken(),
      },
      body: JSON.stringify(params),
    })
      .then((response) => {
        if (response.ok) {
          return response.json();
        } else {
          console.warn(`Failed to create log page`);
          return false;
        }
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  }

  async function updateLogPage(logPage, tool) {
    const CSRFtoken = function () {
      return decodeURIComponent(
        (document.cookie.match("(^|;) *_csrf_token=([^;]*)") || "")[2]
      );
    };

    const courseId = window.location.pathname.split("/")[2];
    const currentBody = logPage?.body;
    const tempDocument = new DOMParser().parseFromString(
      currentBody,
      "text/html"
    );
    const courseTable = tempDocument.querySelector(`table#course-${courseId}`);
    if (!courseTable) {
      tempDocument.body.innerHTML = `
        <table id='course-${courseId}' class='ic-Table ic-Table--hover-row ic-Table--striped'>
          <thead>
            <tr>
              <th>Tool</th>
              <th>Date/Time</th>
            </tr>
          </thead>
          <tbody>
            <tr class="${tool}">
              <td>${tool}</td>
              <td>${new Date().toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      `;
    } else {
      const tableBody = courseTable.querySelector("tbody");
      tableBody.insertAdjacentHTML(
        "afterbegin",
        `
        <tr class="${tool}">
          <td>${tool}</td>
          <td>${new Date().toLocaleString()}</td>
        </tr>
      `
      );
    }

    const newBody = tempDocument.body.innerHTML;
    const url = `${window.location.protocol}//${window.location.hostname}/api/v1/courses/${courseId}/pages/${logPage.page_id}`;
    const params = {
      wiki_page: {
        title: LOG_PAGE_TITLE,
        body: newBody,
        published: 0,
      },
    };
    return fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-CSRF-Token": CSRFtoken(),
      },
      body: JSON.stringify(params),
    })
      .then((response) => {
        if (response.ok) {
          return response.json();
        } else {
          console.warn(`Failed to update log page`);
          return false;
        }
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  }

  async function getRequestLinksAndResults(url) {
    let results = [];
    let links = {};

    const fetches = [];

    fetches.push(
      fetch(url)
        .then((response) => {
          let headerLinks = response.headers.get("link")?.split(",");
          if (headerLinks) {
            for (let link of headerLinks) {
              let splitLink = link.split("; rel=");
              links[splitLink[1].replaceAll('"', "")] = splitLink[0]
                .replace("<", "")
                .replace(">", "");
            }
          }
          return response.json();
        })
        .then((data) => {
          results = data;
        })
        .catch((error) => {
          console.error("Error:", error);
        })
    );

    await Promise.all(fetches);

    return {
      results: results,
      links: links,
    };
  }

  async function getPaginatedRequestResults(url) {
    const completeResults = [];
    let pageResults = {};

    let currentUrl = url;
    do {
      pageResults = await getRequestLinksAndResults(currentUrl);
      if (pageResults.hasOwnProperty("results")) {
        if (Array.isArray(pageResults.results)) {
          completeResults.push(...pageResults.results);
        } else {
          completeResults.push(pageResults.results);
        }
      }

      if (
        pageResults.hasOwnProperty("links") &&
        pageResults.links.hasOwnProperty("next")
      ) {
        currentUrl = pageResults.links.next;
      } else {
        currentUrl = "";
      }
    } while (currentUrl != "");

    return completeResults;
  }

  function createAlert(message, type, isDismissable = false) {
    let color = "#0374B5";
    let icon = `<i class='icon-solid icon-info-borderless' aria-hidden='true'></i>`;
    if (type == "WARNING") {
      color = "#fc5e13";
      icon = `<i class='icon-solid icon-warning-borderless' aria-hidden='true'></i>`;
    } else if (type == "ERROR") {
      color = "#e0061f";
      icon = `<i class='icon-solid icon-warning-borderless' aria-hidden='true'></i>`;
    } else if (type == "INFO") {
      color = "var(--ic-brand-primary)";
    }

    const alert = document.createElement("div");
    alert.style.marginTop = "0.5rem";
    alert.style.marginBottom = "0.5rem";
    alert.style.border = `1px solid ${color}`;
    alert.style.borderRadius = "5px";
    alert.style.display = "flex";
    alert.style.boxSizing = "border-box";

    const iconWrapper = document.createElement("div");
    iconWrapper.style.backgroundColor = color;
    iconWrapper.style.color = "white";
    iconWrapper.style.alignItems = "center";
    iconWrapper.style.display = "flex";
    iconWrapper.style.flex = "0 0 2.5rem";
    iconWrapper.style.justifyContent = "center";
    iconWrapper.innerHTML = icon;

    const alertContentWrapper = document.createElement("div");
    alertContentWrapper.style.minWidth = 0;
    if (!isDismissable) {
      alertContentWrapper.innerHTML = message;
    } else {
      alertContentWrapper.style.flex = "1 1 auto";
      alertContentWrapper.style.display = "flex";
      alertContentWrapper.style.justifyContent = "space-between";
      alertContentWrapper.style.padding = "0.5rem 0.5rem 0.5rem 1rem";

      const messageWrapper = document.createElement("div");
      messageWrapper.style.minWidth = 0;
      messageWrapper.innerHTML = message;

      const dismissButtonWrapper = document.createElement("div");
      dismissButtonWrapper.style.minWidth = "2rem";
      dismissButtonWrapper.style.textAlign = "center";
      const dismissButton = document.createElement("button");
      dismissButton.classList.add("Button", "Button--icon-action");
      dismissButton.innerHTML = `<i class="icon-x" title="Hide this alert"></i>`;
      dismissButton.addEventListener("click", () => {
        alert.style.display = "none";
      });
      dismissButtonWrapper.append(dismissButton);

      alertContentWrapper.append(messageWrapper);
      alertContentWrapper.append(dismissButtonWrapper);
    }

    alert.append(iconWrapper);
    alert.append(alertContentWrapper);

    return alert;
  }
})();
