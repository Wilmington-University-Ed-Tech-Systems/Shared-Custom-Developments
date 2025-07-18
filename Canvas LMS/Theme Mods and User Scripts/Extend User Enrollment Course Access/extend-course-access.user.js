// ==UserScript==
// @name         Extend User Enrollment Course Access
// @namespace    https://github.com/Wilmington-University-Ed-Tech-Systems/Shared-Custom-Developments/tree/main/Canvas%20LMS/Theme%20Mods%20and%20User%20Scripts/Extend%20User%20Enrollment%20Course%20Access
// @version      1.0.0
// @description  Adds ability to extend a user enrollment course access by setting enrollment start and end dates
// @author       James Sekcienski, Ed Tech Systems, Wilmington University
// @match      https://*.instructure.com/courses/*/users/*
// ==/UserScript==

"use strict";

(async () => {
  // CONFIGS
  const headerBackgroundColor = "var(--ic-brand-primary)";
  const headerBorderColor = "#c7cdd1";
  const headerFontColor = "var(--ic-brand-button--primary-text)";
  const footerBackgroundColor = "#f5f5f5";
  const footerBorderColor = "#c7cdd1";
  const footerFontColor = "inherit";

  if (
    /^\/courses\/[0-9]+\/users\/[0-9]+\??[^\/]*\/?$/.test(
      window.location.pathname
    )
  ) {
    const permissions = await getCoursePermissions();
    const hasRequiredPermissions =
      hasRequiredPermissionsForFeature(permissions);
    if (!hasRequiredPermissions) {
      return;
    }

    addCustomStyleRules();

    const courseId = window.location.pathname.split("/")[2];
    const course = await getCourseDetails(courseId);
    const sections = await getSections(courseId, false);
    if (sections) {
      course.sections = sections;
    }
    const termId = course?.enrollment_term_id;
    const term = await getEnrollmentTerm(termId);
    if (term) {
      course.term = term;
    }

    const userId = window.location.pathname.split("/")[4];
    const user = await getUserWithEnrollments(courseId, userId);

    watchForMemberships(course, user);
  }

  async function getCoursePermissions() {
    const courseId = window.location.pathname.split("/")[2];
    const url = `/api/v1/courses/${courseId}/permissions`;
    return fetch(url)
      .then((response) => response.json())
      .catch((error) => console.error(error));
  }

  function hasRequiredPermissionsForFeature(permissions) {
    return (
      permissions?.read_as_admin &&
      !permissions?.participate_as_student &&
      permissions?.allow_course_admin_actions &&
      permissions?.manage_students &&
      permissions?.add_teacher_to_course &&
      permissions?.add_ta_to_course &&
      permissions?.add_designer_to_course &&
      permissions?.add_observer_to_course &&
      permissions?.add_student_to_course
    );
  }

  function addCustomStyleRules() {
    const customStyleRules = `
    <style>
      /* Dialog Styles */
      .wu-dialog {
        min-width: 50vw;
        min-height: 30vh;
        max-height: 90vh;
        padding: 0;
        resize: both;
        overflow: hidden;
        border: 2px solid rgb(193 193 193);
        box-shadow: rgba(0, 0, 0, 0.1) 0px 0.375rem 0.4375rem,
          rgba(0, 0, 0, 0.25) 0px 0.625rem 1.75rem;
        border-radius: 5px;
      }

      .wu-dialog-content-wrapper {
        padding: 0;
        height: 100%;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
      }

      .wu-dialog-header {
        display: flex;
        justify-content: space-between;
        background-color: ${headerBackgroundColor};
        color: ${headerFontColor};
        border-bottom: 2px solid ${headerBorderColor};
        padding: 0.75rem;
        box-sizing: border-box;
      }

      .wu-dialog-header button.wu-dialog-close {
        padding: 0.25rem 1rem;
        color: ${headerFontColor};
      }

      .wu-dialog-header button.wu-dialog-close:focus,
      .wu-dialog-header button.wu-dialog-close:hover {
        box-shadow: inset 0 0 0 2px ${headerBorderColor};
      }

      .wu-dialog-body {
        padding: 1rem;
        overflow: auto;
        flex: 1 1 auto;
      }

      .wu-dialog-footer {
        padding: 2px 16px;
        background-color: ${footerBackgroundColor};
        color: ${footerFontColor};
        border-top: 1px solid ${footerBorderColor};
      }
    </style>
    `;
    document.head.insertAdjacentHTML("beforeend", customStyleRules);
  }

  async function getCourseDetails(courseId) {
    const url = `/api/v1/courses/${courseId}?include[]=term&include[]=concluded`;
    const course = await fetch(url)
      .then((response) => response.json())
      .catch((error) => console.error(error));
    return course;
  }

  async function getEnrollmentTerm(termId) {
    const url = `/api/v1/accounts/self/terms/${termId}`;
    const course = await fetch(url)
      .then((response) => response.json())
      .catch((error) => console.error(error));
    return course;
  }

  async function getSections(courseId, convertToDict = true) {
    const url = `/api/v1/courses/${courseId}/sections?per_page=100`;
    const sections = await getPaginatedRequestResults(url);
    if (!convertToDict) {
      return sections;
    }

    const sectionsById = {};
    for (const section of sections) {
      sectionsById[`${section?.id}`] = section;
    }
    return sectionsById;
  }

  async function getUserWithEnrollments(courseId, userId) {
    const url = `/api/v1/courses/${courseId}/users/${userId}?include[]=enrollments`;
    const user = await fetch(url)
      .then((response) => response.json())
      .catch((error) => console.error(error));
    return user;
  }

  function watchForMemberships(course, user) {
    if (
      document.querySelector(
        "#content .more_user_information table tr.enrollment"
      )
    ) {
      addExtendAccessButtons(course, user);
      return;
    }

    const observer = new MutationObserver((mutations) => {
      if (
        !mutations.some((mutation) => (mutation?.addedNodes?.length ?? 0) > 0)
      ) {
        return;
      }

      if (
        document.querySelector(
          "#content .more_user_information table tr.enrollment"
        )
      ) {
        addExtendAccessButtons(course, user);
        observer.disconnect();
        return;
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function addExtendAccessButtons(course, user) {
    const enrollmentRows = [
      ...document.querySelectorAll(
        "#content .more_user_information table tbody > tr.enrollment"
      ),
    ];
    for (const row of enrollmentRows) {
      addExtendAccessButtonToEnrollmentRow(row, course, user);
    }
  }

  function addExtendAccessButtonToEnrollmentRow(row, course, user) {
    if (
      (row.querySelector(".unconclude_enrollment_link_holder")?.style
        ?.display ?? "") != "none"
    ) {
      return;
    }

    const deleteLink = row.querySelector("a.delete_enrollment_link");
    if (!deleteLink) {
      return;
    }
    const splitDeleteLinkHref = deleteLink?.href?.split("/");
    if (splitDeleteLinkHref.length < 5) {
      return;
    }
    const enrollmentId = splitDeleteLinkHref[0].startsWith("https")
      ? splitDeleteLinkHref[6]
      : splitDeleteLinkHref[4];
    const extendAccessButtonCell = createExtendAccessButtonCell(
      enrollmentId,
      course,
      user
    );
    row.insertAdjacentElement("beforeend", extendAccessButtonCell);
  }

  function createExtendAccessButtonCell(enrollmentId, course, user) {
    const cell = document.createElement("td");

    const contentWrapper = document.createElement("div");

    const button = document.createElement("button");
    button.classList.add("Button", "Button--link");
    button.style.marginLeft = "0.5rem";
    button.innerText = "Extend End Date";
    button.addEventListener("click", () => {
      openExtendAccessDialog(enrollmentId, course, user);
    });

    contentWrapper.append(button);
    cell.append(contentWrapper);

    return cell;
  }

  function openExtendAccessDialog(enrollmentId, course, user) {
    const existingDialog = document.getElementById("wu-set-end-date-dialog");
    if (existingDialog) {
      existingDialog.remove();
    }

    if (!document.getElementById("wu-set-end-date-dialog")) {
      const setEndDateDialog = createSetEndDateDialog(
        enrollmentId,
        course,
        user
      );
      document.body.append(setEndDateDialog);

      setEndDateDialog.showModal();
    }
  }

  function createSetEndDateDialog(enrollmentId, course, user) {
    const dialog = document.createElement("dialog");
    dialog.id = "wu-set-end-date-dialog";
    dialog.classList.add("wu-dialog");
    dialog.style.width = "70vw";
    dialog.style.height = "60vh";

    const dialogContentWrapper = document.createElement("div");
    dialogContentWrapper.classList.add("wu-dialog-content-wrapper");

    const dialogHeader = createDialogHeader(dialog);
    const dialogBody = createDialogBody(enrollmentId, course, user);
    const dialogFooter = createDialogFooter(dialog, enrollmentId, course, user);

    dialogContentWrapper.append(dialogHeader);
    dialogContentWrapper.append(dialogBody);
    dialogContentWrapper.append(dialogFooter);
    dialog.append(dialogContentWrapper);

    return dialog;
  }

  function createDialogHeader(dialog) {
    const headerContainer = document.createElement("div");
    headerContainer.classList.add("wu-dialog-header");

    const heading = document.createElement("h2");
    heading.innerText = "Set End Date for User Enrollment";

    const closeButton = document.createElement("button");
    closeButton.id = "wu-set-end-date-dialog-close-btn";
    closeButton.classList.add(
      "wu-dialog-close",
      "Button",
      "Button--icon-action"
    );
    closeButton.title = "Close";
    closeButton.innerHTML = `
      <i class='icon-x'></i>
    `;
    closeButton.addEventListener("click", () => {
      dialog.close();
    });

    headerContainer.append(heading);
    headerContainer.append(closeButton);

    return headerContainer;
  }

  function createDialogBody(enrollmentId, courseId, user) {
    const bodyWrapper = document.createElement("div");
    bodyWrapper.classList.add("wu-dialog-body");

    const settingsSection = document.createElement("section");
    const settingsHeading = document.createElement("h3");
    const userName = user?.short_name ?? user?.name ?? "User";
    settingsHeading.innerText = `Updating ${userName}'s Enrollment End Date in Section`;
    const settingControls = createSettingControls();
    settingsSection.append(settingsHeading);
    settingsSection.append(settingControls);
    bodyWrapper.append(settingsSection);

    const loadingSection = document.createElement("section");
    loadingSection.innerHTML = `
      <div id="wu-progress-div" class="ic-Form-control">
        <label class="ic-Label">Update Progress</label>
        <div class="progress-bar__bar-container">
          <div id="wu-progress-bar" class="progress-bar__bar" style="width: 1%;"></div>
        </div>
      </div>
      ${createLoadingMessagesWrapper().outerHTML}
    `;
    bodyWrapper.append(loadingSection);

    return bodyWrapper;
  }

  function createSettingControls() {
    const endDateInputWrapper = document.createElement("div");
    endDateInputWrapper.classList.add("ic-Form-control");
    const endDateTimeInput = document.createElement("input");
    endDateTimeInput.type = "datetime-local";
    endDateTimeInput.id = `wu-end-date-time-input`;
    const minDateTime = getMinDateTimeString();
    endDateTimeInput.min = minDateTime;
    endDateTimeInput.value = minDateTime;
    const endDateTimeLabel = document.createElement("label");
    endDateTimeLabel.classList.add("ic-Label");
    endDateTimeLabel.innerText = "New Enrollment End Date: ";
    endDateTimeLabel.setAttribute("for", `wu-end-date-time-input`);
    endDateInputWrapper.append(endDateTimeLabel);
    endDateInputWrapper.append(endDateTimeInput);

    return endDateInputWrapper;
  }

  function getMinDateTimeString() {
    const currentDateTime = new Date();
    const year = `${currentDateTime.getFullYear()}`;
    const month = `${currentDateTime.getMonth() + 1}`;
    const day = `${currentDateTime.getDate()}`;
    const hour = "23"; // `${currentDateTime.getHours()}`
    const minute = "59"; // `${currentDateTime.getMinutes()}`
    const minDateTime = `${year}-${month.padStart(2, "0")}-${day.padStart(
      2,
      "0"
    )}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
    return minDateTime;
  }

  function createDialogFooter(dialog, enrollmentId, course, user) {
    const footer = document.createElement("div");
    footer.classList.add("wu-dialog-footer");

    const footerButtonWrapper = document.createElement("div");
    footerButtonWrapper.style.display = "flex";
    footerButtonWrapper.style.flex = "0 0 auto";
    footerButtonWrapper.style.justifyContent = "flex-end";
    footerButtonWrapper.style.padding = "0.75rem";

    const cancelButton = document.createElement("button");
    cancelButton.id = "wu-set-end-date-dialog-cancel-btn";
    cancelButton.classList.add("Button");
    cancelButton.innerText = "Cancel";
    cancelButton.style.marginRight = "0.75rem";
    cancelButton.addEventListener("click", () => {
      dialog.close();
    });

    const updateButton = document.createElement("button");
    updateButton.id = "wu-set-end-date-dialog-update-btn";
    updateButton.classList.add("Button", "Button--primary");
    updateButton.innerText = "Update End Date";
    updateButton.addEventListener("click", async () => {
      const hasValidSettings = validateUpdateSettings();
      if (!hasValidSettings) {
        updateLoadingMessage("error", "Invalid update settings");
        return;
      }

      updateButton.style.display = "none";
      cancelButton.style.display = "none";

      updateLoadingMessage("LOADING", "Getting new enrollment settings");
      const enrollmentSettings = getUpdateSettings(enrollmentId, course, user);
      if (!enrollmentSettings) {
        updateLoadingMessage("error", "Failed to get update settings");

        if (updateButton) {
          updateButton.style.display = "";
        }

        if (cancelButton) {
          cancelButton.style.display = "";
        }
        return;
      }

      await setEnrollmentEndDate(enrollmentSettings, course);

      updateLoadingMessage("success", "Enrollment update process complete");

      setTimeout(() => {
        if (
          confirm(
            "Enrollment Update Process Complete\n\nWould you like to reload the page to reflect the new changes?"
          )
        ) {
          window.location.reload();
        }
      }, 500);

      if (updateButton) {
        updateButton.style.display = "";
      }

      if (cancelButton) {
        cancelButton.style.display = "";
      }
    });

    footerButtonWrapper.append(cancelButton);
    footerButtonWrapper.append(updateButton);
    footer.append(footerButtonWrapper);
    return footer;
  }

  function createLoadingMessagesWrapper() {
    const wrapper = document.createElement("div");

    const heading = document.createElement("h4");
    heading.innerText = "Loading Messages";

    const messagesWrapper = document.createElement("div");
    messagesWrapper.id = "wu-loading-messages";
    messagesWrapper.style.borderTop = "1px solid gray";
    messagesWrapper.style.maxHeight = "200px";
    messagesWrapper.style.overflow = "auto";
    messagesWrapper.style.marginBottom = "1rem";

    wrapper.append(heading);
    wrapper.append(messagesWrapper);
    return wrapper;
  }

  function updateLoadingMessage(messageType, newMessage) {
    const messageWrapper = document.getElementById("wu-loading-messages");
    if (!messageWrapper) {
      return;
    }

    if (messageType == "clear") {
      messageWrapper.innerHTML = "";
    } else if (messageType == "success") {
      messageWrapper.innerHTML += `
        <p class='text-success' data-type='${messageType}'><i class='icon-line icon-check'></i> ${newMessage}</p>
      `;
    } else if (messageType == "error") {
      messageWrapper.innerHTML = `
        ${messageWrapper.innerHTML}
        <p class='text-error' data-type='${messageType}'><i class='icon-line icon-warning'></i> ${newMessage}</p>
      `;
    } else {
      messageWrapper.innerHTML += `
        <p class='text-info' data-type='${messageType}'><i class='icon-line icon-info'></i> ${newMessage}</p>
      `;
    }

    messageWrapper.scrollTop = messageWrapper.scrollHeight;
  }

  function validateUpdateSettings() {
    const endDateTimeInput = document.getElementById("wu-end-date-time-input");
    const minDateTime = getMinDateTimeString();

    // Handle when there is a blank date/time
    if (!(endDateTimeInput?.value ?? "")) {
      alert("Need to enter date/time for new enrollment end date.");
      return false;
    }

    // Handle when there is a date/time that isn't in the future
    if (endDateTimeInput.value < minDateTime) {
      alert("Date/time needs to be in the future (at 11:59 PM today or later)");
      return false;
    }

    return true;
  }

  function getUpdateSettings(enrollmentId, course, user) {
    const endDateTimeInput = document.getElementById("wu-end-date-time-input");
    const endDateTime = endDateTimeInput?.value ?? "";
    if (!endDateTime) {
      return;
    }

    const userEnrollments = user?.enrollments ?? [];
    const enrollment = userEnrollments.find(
      (enrollment) => enrollmentId == enrollment?.id
    );
    if (!enrollment) {
      return;
    }
    const roleId = enrollment?.role_id;
    const roleType = enrollment?.type;
    const sectionId = enrollment?.course_section_id;

    // TODO May need better handling of start at time
    // Start at is required to get user specific access dates to work
    const startAtTime = course?.term?.start_at ?? enrollment?.created_at ?? "";

    return {
      startAt: startAtTime,
      endAt: endDateTime,
      roleId: roleId,
      roleType: roleType,
      sectionId: sectionId,
      userId: user.id,
    };
  }

  async function setEnrollmentEndDate(settings, course) {
    const isCourseConcluded = course?.concluded;
    if (isCourseConcluded) {
      updateLoadingMessage(
        "LOADING",
        "Temporarily opening course to update enrollment end date"
      );
      await openCourse(course);
    }

    updateLoadingMessage("LOADING", "Updating enrollment end date");
    await updateEnrollment(settings);

    if (isCourseConcluded) {
      updateLoadingMessage("LOADING", "Re-closing general course access");
      await closeCourse(course);
    }
  }

  async function updateEnrollment(settings) {
    if (!settings) {
      return;
    }
    const BASE_URL = document.location.hostname;
    const url = `https://${BASE_URL}/api/v1/sections/${settings?.sectionId}/enrollments`;
    const data = {
      enrollment: {
        role_id: settings?.roleId,
        type: settings?.roleType,
        enrollment_state: "active",
        user_id: settings?.userId,
        start_at: settings?.startAt,
        end_at: settings?.endAt,
      },
    };

    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-CSRF-Token": getCsrfToken(),
      },
      body: JSON.stringify(data),
    })
      .then((response) => {
        return response.json();
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  }

  async function openCourse(course) {
    const BASE_URL = document.location.hostname;
    const url = `https://${BASE_URL}/api/v1/courses/${course.id}`;
    const data = {
      course: {},
    };
    if (!course?.restrict_enrollments_to_course_dates) {
      data["course"]["restrict_enrollments_to_course_dates"] = true;
    }
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 1);
    data["course"]["end_at"] = endDate;

    return fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-CSRF-Token": getCsrfToken(),
      },
      body: JSON.stringify(data),
    })
      .then((response) => {
        return response.json();
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  }

  async function closeCourse(course) {
    const BASE_URL = document.location.hostname;
    const url = `https://${BASE_URL}/api/v1/courses/${course.id}`;
    const data = {
      course: {},
    };
    if (course?.restrict_enrollments_to_course_dates) {
      data["course"]["end_at"] = course?.end_at;
    } else {
      data["course"]["restrict_enrollments_to_course_dates"] = false;
    }

    return fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-CSRF-Token": getCsrfToken(),
      },
      body: JSON.stringify(data),
    })
      .then((response) => {
        return response.json();
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  }

  function getCsrfToken() {
    const csrfRegex = new RegExp("^_csrf_token=(.*)$");
    let csrf;
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      let cookie = cookies[i].trim();
      const match = csrfRegex.exec(cookie);
      if (match) {
        csrf = decodeURIComponent(match[1]);
        break;
      }
    }
    return csrf;
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
})();
