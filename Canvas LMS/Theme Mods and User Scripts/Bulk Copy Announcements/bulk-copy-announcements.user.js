// ==UserScript==
// @name         Bulk Copy Announcements
// @namespace    https://github.com/Wilmington-University-Ed-Tech-Systems/Shared-Custom-Developments/Canvas-LMS/Theme-Mods-and-User-Scripts/Bulk-Copy-Announcements
// @version      1.0.0
// @description  Adds ability to bulk copy announcements
// @author       James Sekcienski, Ed Tech Systems, Wilmington University
// @match      https://*.instructure.com/courses/*/announcements
// ==/UserScript==

"use strict";

(async () => {
  // CONFIGS
  const folderNameForCopiedAnnouncementFiles = "wu-copied-announcements-files"; // Don't use spaces
  const headerBackgroundColor = "var(--ic-brand-primary)";
  const headerBorderColor = "#c7cdd1";
  const headerFontColor = "var(--ic-brand-button--primary-text)";
  const footerBackgroundColor = "#f5f5f5";
  const footerBorderColor = "#c7cdd1";
  const footerFontColor = "inherit";
  const pageTitlePrefixForSpecialCopyProcess =
    "zzz_[WU_ANNOUNCEMENT_COPY_HELPER_TO_BE_DELETED]";
  const waitTimeToCheckCopyProgressStatus = 10; // seconds

  if (/\/courses\/[0-9]+\/announcements/.test(window.location.pathname)) {
    const courseId = window.location.pathname.split("/")[2];
    const hasTeacherEnrollment =
      (await getTeacherEnrollments(courseId)).length > 0;
    if (!hasTeacherEnrollment) {
      return;
    }

    onElementRendered(["#add_announcement", ".ic-item-row"], () => {
      addCustomStyleRules();

      // Add button to copy selected announcements
      addCopyAnnouncementsButton();

      // Add checkboxes next to announcements without one
      // Checkboxes may not show next to announcements after a course has ended
      const announcementRows = document.querySelectorAll(
        "div.ic-item-row.ic-announcement-row"
      );
      for (let row of announcementRows) {
        addMissingCheckboxToRow(row);
      }
      // addMutationObserver to watch for additional announcements loading on page
      addMutationObserverForAnnouncementRows();
    });
  }

  /*
    Checks if an element has been added to the document that meets one of the given
    selectors. 
    
    If so, it will call the given callback (cb) function with the found 
    element.
    
    If not, as long as it hasn't reached its maximum number of attempts, it will wait 
    the set amount of time and check call this function again to check.
  */
  function onElementRendered(selectors, cb, _attempts) {
    for (let selector of selectors) {
      const el = document.querySelectorAll(selector);
      _attempts = ++_attempts || 1;
      if (el.length) return cb(el);
    }
    if (_attempts == 60) return;
    setTimeout(function () {
      onElementRendered(selectors, cb, _attempts);
    }, 250);
  }

  function addCustomStyleRules() {
    const customStyleRules = `
    <style>
      div.ic-item-row__select-col.wu-missing-announcement-selector-div
        div.ic-Form-control.ic-Form-control--checkbox {
        position: relative;
        width: 100%;
        line-height: 1.5;
      }

      div.ic-item-row__select-col.wu-missing-announcement-selector-div
        div.ic-Form-control.ic-Form-control--checkbox
        input {
        font-size: 1.5rem;
        inset-inline: 0px auto;
        margin-top: 0px;
      }

      div.ic-item-row__select-col.wu-missing-announcement-selector-div
        div.ic-Form-control.ic-Form-control--checkbox
        label {
        box-sizing: content-box;
        cursor: auto;
        display: block;
        font-family: serif;
        line-height: normal;
        padding: 0px;
        position: static;
        word-spacing: normal;
        z-index: auto;
        width: 1.825rem;
        height: 1.5rem;
      }

      div.ic-item-row__select-col.wu-missing-announcement-selector-div
        div.ic-Form-control.ic-Form-control--checkbox
        label::before {
        height: 1.2rem;
        width: 1.2rem;
      }
      
      .ic-Form-control.ic-Form-control--checkbox
        label.ic-Label[for^="wu-missing-checkbox"]:before {
        width: 1.25rem;
        height: 1.25rem;
        top: 0;
      }

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

  /*
    Adds a checkbox next to an announcement if one isn't present to ensure it can be 
    selected as an option for the bulk 'copy' process
  */
  function addMissingCheckboxToRow(announcementRow) {
    const checkbox = announcementRow.querySelector(
      "div.ic-item-row__select-col input[type='checkbox']"
    );
    if (!checkbox) {
      const authorColumn = announcementRow.querySelector(
        "div.ic-item-row__author-col"
      );
      if (authorColumn) {
        let announcementId = "";
        const link = announcementRow.querySelector(
          "a.ic-item-row__content-link"
        );
        const splitLink = link.href.split("/discussion_topics/");
        if (splitLink.length == 2) {
          announcementId = splitLink[1];
        }
        authorColumn.insertAdjacentHTML(
          "beforebegin",
          `
          <div class="ic-item-row__select-col wu-missing-announcement-selector-div">
            <div class="ic-Form-control ic-Form-control--checkbox">
              <input id="wu-missing-checkbox-for-${announcementId}" type="checkbox" class="wu-missing-checkbox" title="Select announcement to copy">
              <label class="ic-Label" for="wu-missing-checkbox-for-${announcementId}" style="position: static;">
                <span class="screenreader-only">
                  Select announcement to copy (${link.innerText.replace(
                    "unread, ",
                    ""
                  )})
                </span>
              </label>
            </div>
          </div>
        `
        );
      }
    }
  }

  /*
    Watch for newly added nodes to check if a new announcement row has been added.
    When found, call addMissingCheckboxToRow for each newly added row.
  */
  function addMutationObserverForAnnouncementRows() {
    const announcementsWrapper = document.querySelector(
      "div.announcements-v2__wrapper"
    );

    const announcementsWrapperObserver = new MutationObserver((mutations) => {
      for (let mutation of mutations) {
        const addedNodes = mutation.addedNodes;
        if (addedNodes.length > 0) {
          for (let node of addedNodes) {
            if (node.classList?.contains("ic-announcement-row")) {
              addMissingCheckboxToRow(node);
            } else {
              const childNodes = node.childNodes;
              for (let child of childNodes) {
                if (child.classList?.contains("ic-announcement-row")) {
                  addMissingCheckboxToRow(child);
                }
              }
            }
          }
        }
      }
    });

    if (announcementsWrapper) {
      announcementsWrapperObserver.observe(announcementsWrapper, {
        subtree: true,
        childList: true,
      });
    }
  }

  /**
   * Adds a copy announcements button that can be used to activate this feature.
   */
  function addCopyAnnouncementsButton() {
    const deleteAnnouncementsBtn = document.getElementById(
      "delete_announcements"
    );
    const addAnnouncementsBtn = document.getElementById("add_announcement");
    const copyAnnouncementsBtn = document.getElementById("copy_announcements");
    if (!copyAnnouncementsBtn) {
      if (addAnnouncementsBtn && deleteAnnouncementsBtn) {
        deleteAnnouncementsBtn.insertAdjacentHTML(
          "afterend",
          `
          <button id="wu-copy_announcements" class="btn Button--secondary" style="margin: 0px 0.75rem 0px 0px;"><i class="icon-Line icon-copy" aria-hidden="true"></i>&nbsp;Copy</button>
        `
        );
        document
          .getElementById("wu-copy_announcements")
          .addEventListener("click", checkToOpenCopyAnnouncementsModal);
      } else {
        const markAllReadButton = document.getElementById(
          "mark_all_announcement_read"
        );
        markAllReadButton.insertAdjacentHTML(
          "afterend",
          `
          <button id="wu-copy_announcements" class="btn Button--secondary"><i class="icon-Line icon-copy" aria-hidden="true"></i>&nbsp;Copy</button>
        `
        );
        document
          .getElementById("wu-copy_announcements")
          .addEventListener("click", checkToOpenCopyAnnouncementsModal);
      }
    }
  }

  /**
   * This will handle checking that at least one announcement has been selected.
   * If so, then it will get the selected announcement(s) and open the copy
   * announcements modal.
   */
  async function checkToOpenCopyAnnouncementsModal() {
    const sourceCourseId = document.location.pathname.split("/")[2];

    const announcementIdsToCopy = getSelectedAnnouncementIds();
    if (announcementIdsToCopy.length == 0) {
      alert(
        "No selected announcements found.  Check the announcements you would like copied to another course."
      );
    } else {
      const announcementsToCopy = await getAnnouncements(
        sourceCourseId,
        announcementIdsToCopy
      );
      displayCopyAnnouncementsModal(sourceCourseId, announcementsToCopy);
    }
  }

  /**
   * Get the ids of the announcements that have been selected
   */
  function getSelectedAnnouncementIds() {
    const announcementRows = [
      ...document.querySelectorAll("div.ic-item-row.ic-announcement-row"),
    ];
    const selectedAnnouncementRows = announcementRows.filter(
      (row) =>
        row.querySelector("div.ic-item-row__select-col input[type='checkbox']")
          ?.checked
    );

    const selectedAnnouncementIds = [
      ...selectedAnnouncementRows.map((row) => {
        const link = row.querySelector("a.ic-item-row__content-link");
        const splitLink = link.href.split("/discussion_topics/");
        if (splitLink.length == 2) {
          return splitLink[1];
        } else {
          return "error";
        }
      }),
    ];

    return [...selectedAnnouncementIds.filter((id) => id != "error")].reverse();
  }

  /**
   * Takes in the sourceCourseId of the of the course to copy from,
   * and an array of announcements to copy to another course.
   * Opens a modal to ask the user for the course to copy to.
   * Once the user selects a course and submits, it will create announcements
   * in the destination course that match the announcements to copy.
   */
  async function displayCopyAnnouncementsModal(
    sourceCourseId,
    announcementsToCopy
  ) {
    const existingModal = document.getElementById("wu-copy-announcement-modal");
    if (existingModal) {
      existingModal.remove();
    }

    if (!document.getElementById("wu-copy-announcement-modal")) {
      const permissions = await getCoursePermissions(sourceCourseId);

      const copyAnnouncementDialog = createCopyAnnouncementDialog(
        sourceCourseId,
        announcementsToCopy,
        permissions
      );
      document.body.append(copyAnnouncementDialog);

      copyAnnouncementDialog.showModal();
    }
  }

  /**
   * This creates a dialog for the user inputs that are needed for
   * this copy announcement feature. It also provides a summary of the
   * announcements that have been selected and will show loading
   * messages when the copy process is running.
   */
  function createCopyAnnouncementDialog(courseId, announcements, permissions) {
    const dialog = document.createElement("dialog");
    dialog.id = "wu-copy-announcement-modal";
    dialog.classList.add("wu-dialog");
    dialog.style.width = "70vw";
    dialog.style.height = "70vh";

    const dialogContentWrapper = document.createElement("div");
    dialogContentWrapper.classList.add("wu-dialog-content-wrapper");

    const dialogHeader = createCopyAnnouncementDialogHeader(dialog);
    const dialogBody = createCopyAnnouncementDialogBody(
      courseId,
      announcements,
      permissions
    );
    const dialogFooter = createCopyAnnouncementDialogFooter(
      dialog,
      courseId,
      announcements
    );

    dialogContentWrapper.append(dialogHeader);
    dialogContentWrapper.append(dialogBody);
    dialogContentWrapper.append(dialogFooter);
    dialog.append(dialogContentWrapper);

    return dialog;
  }

  function createCopyAnnouncementDialogHeader(dialog) {
    const headerContainer = document.createElement("div");
    headerContainer.classList.add("wu-dialog-header");

    const heading = document.createElement("h2");
    heading.innerText = "Copy Selected Announcements to Another Course";

    const closeButton = document.createElement("button");
    closeButton.id = "wu-copy-announcement-modal-close-btn";
    closeButton.classList.add(
      "wu-dialog-close",
      "Button",
      "Button--icon-action",
      "wu-dialog-close"
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

  function createCopyAnnouncementDialogBody(
    courseId,
    announcements,
    permissions
  ) {
    const bodyWrapper = document.createElement("div");
    bodyWrapper.classList.add("wu-dialog-body");

    const selectedAnnouncementsSection = document.createElement("section");
    const selectedAnnouncementsHeading = document.createElement("h3");
    selectedAnnouncementsHeading.innerText = "Selected Announcements";
    const selectedAnnouncementsTable = createSelectedAnnouncementsTable(
      announcements,
      permissions
    );
    selectedAnnouncementsSection.append(selectedAnnouncementsHeading);
    selectedAnnouncementsSection.append(selectedAnnouncementsTable);
    bodyWrapper.append(selectedAnnouncementsSection);

    const coursesSection = document.createElement("section");
    const coursesHeading = document.createElement("h3");
    coursesHeading.innerText = "Select Course to Copy To";
    const coursesWrapper = document.createElement("div");
    coursesWrapper.id = "wu-copy-announcement-modal-courses";
    coursesWrapper.classList.add("ic-Form-control", "ic-Form-control--radio");
    coursesWrapper.style.overflow = "auto";
    coursesWrapper.style.maxHeight = "200px";
    coursesWrapper.style.borderTop = `1px solid ${headerBorderColor}`;
    coursesWrapper.style.borderBottom = `1px solid ${headerBorderColor}`;
    coursesSection.append(coursesHeading);
    coursesSection.append(coursesWrapper);
    bodyWrapper.append(coursesSection);
    loadInTeachersCourses(courseId, coursesWrapper);

    const announcementSettingsSection = document.createElement("section");
    const announcementSettingsHeading = document.createElement("h3");
    announcementSettingsHeading.innerText = "Copied Announcement Settings";
    const announcementSettingControls = createAnnouncementSettingControls();
    announcementSettingsSection.append(announcementSettingsHeading);
    announcementSettingsSection.append(announcementSettingControls);
    bodyWrapper.append(announcementSettingControls);

    const copyProcessDetailsSection = document.createElement("section");
    const copyProcessDetailsHeading = document.createElement("h3");
    copyProcessDetailsHeading.innerText = "Copy Process Details";
    const copyProcessDetailsDescription = document.createElement("p");
    copyProcessDetailsDescription.innerHTML = `
      This process will create new copies of the announcements in the course you select.  
      It will not overwrite past copies of the announcement. <em>NOTE:</em> If a selected announcement includes 
      any links, be sure to review them in the selected destination course to ensure they still work.
    `;
    const copyProcessDetailsFixingBrokenEmbeds =
      createFixingBrokenEmbedsDetails();
    copyProcessDetailsSection.append(copyProcessDetailsHeading);
    copyProcessDetailsSection.append(copyProcessDetailsDescription);
    copyProcessDetailsSection.append(copyProcessDetailsFixingBrokenEmbeds);
    bodyWrapper.append(copyProcessDetailsSection);

    const loadingSection = document.createElement("section");
    loadingSection.innerHTML = `
      <div id="wu-copy-progress-div" class="ic-Form-control">
        <label class="ic-Label">Copy Progress</label>
        <div class="progress-bar__bar-container">
          <div id="wu-copy-progress-bar" class="progress-bar__bar" style="width: 1%;"></div>
        </div>
      </div>
      ${createLoadingMessagesWrapper().outerHTML}
    `;
    bodyWrapper.append(loadingSection);

    return bodyWrapper;
  }

  function createAnnouncementSettingControls() {
    const settingsWrapper = document.createElement("div");

    const studentCommentingWrapper = document.createElement("div");
    studentCommentingWrapper.classList.add(
      "ic-Form-control",
      "ic-Form-control--checkbox"
    );
    const studentCommentingCheckbox = document.createElement("input");
    studentCommentingCheckbox.type = "checkbox";
    studentCommentingCheckbox.id = "wu-is-student-comments-allowed";
    studentCommentingCheckbox.checked = true;
    const studentCommentingLabel = document.createElement("label");
    studentCommentingLabel.classList.add("ic-Label");
    studentCommentingLabel.innerText = "Allow users to comment";
    studentCommentingLabel.setAttribute(
      "for",
      "wu-is-student-comments-allowed"
    );
    studentCommentingWrapper.append(studentCommentingCheckbox);
    studentCommentingWrapper.append(studentCommentingLabel);
    settingsWrapper.append(studentCommentingWrapper);

    const requiredPostWrapper = document.createElement("div");
    requiredPostWrapper.classList.add(
      "ic-Form-control",
      "ic-Form-control--checkbox"
    );
    requiredPostWrapper.style.marginLeft = "2em";
    const requiredPostCheckbox = document.createElement("input");
    requiredPostCheckbox.type = "checkbox";
    requiredPostCheckbox.id = "wu-is-post-required-first";
    const requiredPostLabel = document.createElement("label");
    requiredPostLabel.classList.add("ic-Label");
    requiredPostLabel.innerText = "Users must post before seeing replies";
    requiredPostLabel.setAttribute("for", "wu-is-post-required-first");
    requiredPostWrapper.append(requiredPostCheckbox);
    requiredPostWrapper.append(requiredPostLabel);
    settingsWrapper.append(requiredPostWrapper);

    const delayedPostingWrapper = document.createElement("div");
    delayedPostingWrapper.classList.add(
      "ic-Form-control",
      "ic-Form-control--checkbox"
    );
    const delayedPostingCheckbox = document.createElement("input");
    delayedPostingCheckbox.type = "checkbox";
    delayedPostingCheckbox.id = "wu-is-delayed-posting";
    delayedPostingCheckbox.checked = true;
    const delayedPostingLabel = document.createElement("label");
    delayedPostingLabel.classList.add("ic-Label");
    delayedPostingLabel.innerText = "Delay Posting";
    delayedPostingLabel.setAttribute("for", "wu-is-delayed-posting");
    delayedPostingWrapper.append(delayedPostingCheckbox);
    delayedPostingWrapper.append(delayedPostingLabel);
    settingsWrapper.append(delayedPostingWrapper);

    const delayedPostingTimeWrapper = document.createElement("div");
    delayedPostingTimeWrapper.id = "wu-delayed-posting-entry";
    delayedPostingTimeWrapper.classList.add("ic-Form-control");
    const delayedPostingTimeInput = document.createElement("input");
    delayedPostingTimeInput.type = "datetime-local";
    delayedPostingTimeInput.id = "wu-delayed-posting-date-time";
    delayedPostingTimeInput.min = getMinDateTimeString();
    const delayedPostingTimeLabel = document.createElement("label");
    delayedPostingTimeLabel.classList.add("ic-Label");
    delayedPostingTimeLabel.innerText = "Delay Posting Until: ";
    delayedPostingTimeLabel.setAttribute("for", "wu-delayed-posting-date-time");
    delayedPostingTimeWrapper.append(delayedPostingTimeLabel);
    delayedPostingTimeWrapper.append(delayedPostingTimeInput);
    settingsWrapper.append(delayedPostingTimeWrapper);

    studentCommentingCheckbox.addEventListener("click", () => {
      if (studentCommentingCheckbox.checked) {
        requiredPostWrapper.style.display = "";
      } else {
        requiredPostWrapper.style.display = "none";
      }
    });

    delayedPostingCheckbox.addEventListener("click", () => {
      if (delayedPostingCheckbox.checked) {
        delayedPostingTimeWrapper.style.display = "";
      } else {
        delayedPostingTimeWrapper.style.display = "none";
      }
    });

    return settingsWrapper;
  }

  function createFixingBrokenEmbedsDetails() {
    const details = document.createElement("details");
    details.style.marginBottom = "1rem";
    details.innerHTML = `
      <summary>How to Manually Fix Broken LTI Embeds in Copied Announcements</summary>
      <ul>
        <li>Option 1:
          <ol>
            <li>Go to the copied announcement in the other course.</li>
            <li>Edit the announcement</li>
            <li>Remove the embed(s) that isn't loading properly</li>
            <li>Embed the content again that wasn't loading properly</li>
            <li>Save the changes and make sure the content is now loading properly</li>
          </ol>
        </li>
        <li>Option 2: <em>*Not recommended when copying to published courses as this may result in duplicate notifications.</em>
          <ol>
            <li>Use the native Canvas Copy To feature to copy the announcement from this course to the selected course.</li>
            <li>Go to the selected course and delete the copy that was made using Copy To. <em>It should show with a generic/unknown author.</em></li>
            <li>Check the copied announcement that shows you as the author and the video should now load properly.</li>
          </ol>
        </li>
      </ul>
    `;

    return details;
  }

  function createCopyAnnouncementDialogFooter(
    dialog,
    sourceCourseId,
    announcementsToCopy
  ) {
    const footer = document.createElement("div");
    footer.classList.add("wu-dialog-footer");

    const footerButtonWrapper = document.createElement("div");
    footerButtonWrapper.style.display = "flex";
    footerButtonWrapper.style.flex = "0 0 auto";
    footerButtonWrapper.style.justifyContent = "flex-end";
    footerButtonWrapper.style.padding = "0.75rem";

    const cancelButton = document.createElement("button");
    cancelButton.id = "wu-copy-announcement-modal-cancel-btn";
    cancelButton.classList.add("Button");
    cancelButton.innerText = "Cancel";
    cancelButton.style.marginRight = "0.75rem";
    cancelButton.addEventListener("click", () => {
      dialog.close();
    });

    const copyButton = document.createElement("button");
    copyButton.id = "wu-copy-announcement-modal-copy-btn";
    copyButton.classList.add("Button", "Button--primary");
    copyButton.innerText = "Copy to Courses";
    copyButton.addEventListener("click", async () => {
      const hasValidSettings = validateCopySettings();
      if (!hasValidSettings) {
        return;
      }

      copyButton.style.display = "none";
      cancelButton.style.display = "none";

      const destinationCourseId = document.querySelector(
        "input[name='destination-course-radio-buttons']:checked"
      ).value;

      const announcementSettings = getCopyAnnouncementSettings();

      await copyAnnouncementsToCourse(
        announcementsToCopy,
        sourceCourseId,
        destinationCourseId,
        announcementSettings
      );

      setTimeout(() => {
        alert("Announcements copied");
      }, 500);

      if (!copyButton) {
        return;
      }
      copyButton.style.display = "";

      if (!cancelButton) {
        return;
      }
      cancelButton.style.display = "";
    });

    footerButtonWrapper.append(cancelButton);
    footerButtonWrapper.append(copyButton);
    footer.append(footerButtonWrapper);
    return footer;
  }

  function validateCopySettings() {
    const isDelayedPosting = document.getElementById("wu-is-delayed-posting");
    const delayedPostingInput = document.getElementById(
      "wu-delayed-posting-date-time"
    );
    const delayedPostingDateTime = isDelayedPosting.checked
      ? delayedPostingInput.value
      : "";

    const minDateTime = getMinDateTimeString();

    if (
      !document.querySelector(
        "input[name='destination-course-radio-buttons']:checked"
      )
    ) {
      alert(
        "You need to select a course to copy to where you are an active teacher."
      );
      return false;
    } else if (
      isDelayedPosting &&
      isDelayedPosting.checked &&
      !delayedPostingDateTime
    ) {
      alert(
        "Need to enter a delayed posting time or uncheck option to delay posting."
      );
      return false;
    } else if (
      isDelayedPosting &&
      isDelayedPosting.checked &&
      delayedPostingDateTime < minDateTime
    ) {
      alert("The delayed posting date/time needs to be in the future");
      return false;
    }

    return true;
  }

  function getCopyAnnouncementSettings() {
    const requireInitialPostCheckbox = document.getElementById(
      "wu-is-post-required-first"
    );
    const studentCommentsCheckbox = document.getElementById(
      "wu-is-student-comments-allowed"
    );
    const isCommentingAllowed = studentCommentsCheckbox.checked;
    const isInitialPostRequired = isCommentingAllowed
      ? requireInitialPostCheckbox.checked
      : false;

    const isDelayedPosting = document.getElementById("wu-is-delayed-posting");
    const delayedPostingInput = document.getElementById(
      "wu-delayed-posting-date-time"
    );
    const delayedPostingDateTime = isDelayedPosting.checked
      ? delayedPostingInput.value
        ? new Date(delayedPostingInput.value).toISOString()
        : ""
      : "";

    return {
      isCommentingAllowed: isCommentingAllowed,
      isInitialPostRequired: isInitialPostRequired,
      delayedPostingDateTime: delayedPostingDateTime,
    };
  }

  /**
   * This gets the minimum date-time string to use for a date input based
   * on the current date and time.
   */
  function getMinDateTimeString() {
    const currentDateTime = new Date();
    const year = `${currentDateTime.getFullYear()}`;
    const month = `${currentDateTime.getMonth() + 1}`;
    const day = `${currentDateTime.getDate()}`;
    const hour = `${currentDateTime.getHours()}`;
    const minute = `${currentDateTime.getMinutes()}`;
    const minDateTime = `${year}-${month.padStart(2, "0")}-${day.padStart(
      2,
      "0"
    )}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
    return minDateTime;
  }

  /**
   * This creates a container with a table that lists the announcements that
   * were selected to be copied, their message, and details about additional
   * copy requirements that may be needed and may take longer to process.
   */
  function createSelectedAnnouncementsTable(announcements, permissions) {
    const container = document.createElement("div");

    const tableWrapper = document.createElement("div");
    tableWrapper.style.overflow = "auto";
    tableWrapper.style.maxHeight = "200px";
    tableWrapper.style.marginBottom = "1rem";
    tableWrapper.style.borderTop = `1px solid ${headerBorderColor}`;
    tableWrapper.style.borderBottom = `1px solid ${headerBorderColor}`;

    const table = document.createElement("table");
    table.classList.add("ic-Table", "ic-Table--hover-row", "ic-Table--striped");
    table.id = "wu-selected-announcements";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    headerRow.insertAdjacentHTML(
      "beforeend",
      `
        <th style="background-color: ${headerBackgroundColor}; color: ${headerFontColor}; position: sticky; top: 0px; border-bottom: 1px solid ${headerBorderColor};">Title</th>
        <th style="background-color: ${headerBackgroundColor}; color: ${headerFontColor}; position: sticky; top: 0px; border-bottom: 1px solid ${headerBorderColor};">Special Copy Conditions (*Takes longer to process)</th>
      `
    );
    thead.append(headerRow);

    const tbody = document.createElement("tbody");
    let needCreatePagePermission = false;
    const hasCreatePagePermission = permissions?.manage_wiki_create;
    for (const announcement of announcements) {
      const hasSpecialLtiEmbed = checkForSpecialLtiEmbed(announcement);
      if (!needCreatePagePermission && hasSpecialLtiEmbed) {
        needCreatePagePermission = true;
      }

      const row = createSelectedAnnouncementRow(
        announcement,
        hasCreatePagePermission
      );
      tbody.append(row);
    }

    table.append(thead);
    table.append(tbody);

    tableWrapper.append(table);
    container.append(tableWrapper);

    if (!hasCreatePagePermission && needCreatePagePermission) {
      const missingPermissionDetails = createMissingPermissionDetails();
      container.append(missingPermissionDetails);
    }

    return container;
  }

  /**
   * This creates a table row element with information about the given announcement.
   * The hasCreatePagePermission is checked to determine the appropriate message if
   * a special LTI embed is found in the given announcement message.
   */
  function createSelectedAnnouncementRow(
    announcement,
    hasCreatePagePermission
  ) {
    const hasAttachements =
      announcement?.attachments && announcement?.attachments.length > 0;
    const hasEmbeddedFiles = announcement.message.includes(
      'data-api-returntype="File"'
    );
    const hasSpecialLtiEmbed = checkForSpecialLtiEmbed(announcement);

    const row = document.createElement("tr");
    row.innerHTML = `
        <td>${announcement?.title}</td>
        <td>${
          hasAttachements
            ? "Attached files will be copied to the selected course and linked in the copied message body. "
            : ""
        }${
      hasEmbeddedFiles
        ? "Files that are linked in the message body will be copied to the selected course. "
        : ""
    }${
      hasSpecialLtiEmbed
        ? "A special embed of LTI content was found in the message. An extra copy process is needed to update this link properly. " +
          (hasCreatePagePermission
            ? ""
            : "<br><br><strong>You do not currently have the required permissions for this special copy process.</strong> This will copy the announcement to the destination course, but you will need to fix the content.")
        : ""
    }</td>
      `;

    return row;
  }

  /**
   * Checks if the given announcement has an LTI embed that uses a
   * resource_link_lookup_uuid
   *
   * NOTE: This is currently based on the format that was found to be used
   * with Kaltura video embeds. This may need adjustment for other LTIs if
   * they follow a different format.
   */
  function checkForSpecialLtiEmbed(announcement) {
    const message = announcement?.message;
    const hasSpecialLtiEmbed =
      message.includes("<iframe") &&
      message.includes(
        "/external_tools/retrieve?display=in_rce&amp;resource_link_lookup_uuid"
      );
    return hasSpecialLtiEmbed;
  }

  /**
   * This will create a details element with information on what
   * to do if the user is missing the required permission to perform
   * the special copy process that is needed to handle a special LTI embed
   */
  function createMissingPermissionDetails() {
    const details = document.createElement("details");
    details.style.marginBottom = "1rem";
    details.innerHTML = `
      <summary><em>What to do if you don't have the required permissions?</em></summary>
      <ol>
        <li>Don't select the announcements that require an additional permission to copy with this bulk copy feature.</li>
        <li>Use the <a href='https://community.canvaslms.com/t5/Instructor-Guide/How-do-I-copy-an-announcement-to-another-course/ta-p/888' target='_blank'>Canvas Copy To feature</a> to copy the announcement from this course to a Sandbox course that doesn't have students.</li>
        <li>Go to the Sandbox course and use the bulk announcement copy feature to copy the announcement to your desired course.</li>
      </ol>
    `;
    return details;
  }

  /**
   * Creates a div element that will show loading messages
   * when this feature is processing requests.
   */
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

  /**
   * Updates the content of the message wrapper element based
   * on the given message type and the new message.
   */
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

  /**
   * Takes in a sourceCourseId for what course this appears in.
   * Loads in the user's active courses in which they are a teacher
   * as radio button options to the copy-announcement-modal-courses element.
   */
  async function loadInTeachersCourses(sourceCourseId, coursesWrapper) {
    if (!coursesWrapper) {
      return;
    }

    coursesWrapper.innerHTML = "";

    const courses = await getCoursesWithTeacherEnrollment();
    if (!courses) {
      return;
    }

    for (const course of courses) {
      const courseId = course.id;
      if (courseId != sourceCourseId) {
        addCourseOption(coursesWrapper, course);
      }
    }
  }

  /**
   * Adds a radio button option based on the given course to the given wrapper
   */
  function addCourseOption(wrapper, course) {
    const courseId = course.id;
    const isPublished = course.workflow_state == "available";
    wrapper.innerHTML += `
      <div class="ic-Radio">
        <input id="radio-course-${courseId}" type="radio" value="${courseId}" data-is-published="${isPublished}" name="destination-course-radio-buttons">
        <label for="radio-course-${courseId}" class="ic-Label"> <strong><a href='/courses/${courseId}' target='_blank'><i class='icon-solid ${
      isPublished ? "icon-publish" : "icon-unpublished"
    }' title='${
      isPublished ? "published course" : "unpublished course"
    }'></i> ${course.name}</a></strong> <em>Course Code: ${
      course.course_code
    }</em></label>
      </div>
    `;
  }

  /**
   * Takes in a sourceCourseId for the course to copy from,
   * the destinationCourseId for the course to copy to and
   * an array of announcements to copy.
   *
   * It will create new announcements in the destination course
   * with the same settings for the most part.
   * - Internal course links will have the course Id updated
   * - Set to delay announcements one day from now so notifications will be sent
   *
   */
  async function copyAnnouncementsToCourse(
    announcements,
    sourceCourseId,
    destinationCourseId,
    announcementSettings
  ) {
    updateLoadingMessage("clear");
    const progressBar = document.getElementById("wu-copy-progress-bar");
    let numOfSteps = announcements.length * 3;
    let completedSteps = 0;
    const BASE_URL = document.location.hostname;
    let announcementNum = 0;
    const totalAnnouncements = announcements.length;
    const pageIdsToCopy = [];
    const pageTitles = {};
    const permissions = await getCoursePermissions(sourceCourseId);

    for (const announcement of announcements) {
      await copyAnnouncementToCourse(
        announcement,
        sourceCourseId,
        destinationCourseId,
        announcementSettings,
        progressBar,
        completedSteps,
        numOfSteps,
        announcementNum,
        totalAnnouncements,
        permissions,
        pageIdsToCopy,
        pageTitles
      );
    }

    if (permissions?.manage_wiki_create) {
      // Perform Special Copy Process and Clean-Up for LTI Embedded Content
      await handleCopyStepsForLtiEmbeddedContent(
        progressBar,
        completedSteps,
        numOfSteps,
        sourceCourseId,
        destinationCourseId,
        pageIdsToCopy,
        pageTitles
      );
    }

    updateLoadingMessage(
      "info",
      "Announcement copy process is complete. You may now select another course to copy these same announcements to or close this dialog."
    );
  }

  async function copyAnnouncementToCourse(
    announcement,
    sourceCourseId,
    destinationCourseId,
    announcementSettings,
    progressBar,
    completedSteps,
    numOfSteps,
    announcementNum,
    totalAnnouncements,
    permissions,
    pageIdsToCopy,
    pageTitles
  ) {
    announcementNum++;
    updateLoadingMessage(
      "info",
      `Beginning process to copy announcement ${announcementNum} of ${totalAnnouncements}: ${announcement.title}`
    );

    completedSteps++;
    progressBar.style.width = `${Math.floor(
      (completedSteps * 100) / numOfSteps
    )}%`;

    let updatedMessage = announcement.message;

    // Check for new LTI embeds
    if (checkForSpecialLtiEmbed(announcement)) {
      updateLoadingMessage("info", "Found special embed of LTI content");
      if (permissions?.manage_wiki_create) {
        updateLoadingMessage(
          "info",
          "Preparing special copy process to handle updating the special embed in the selected course"
        );
        await handleSetupForCopyProcessForLtiEmbeddedContent(
          announcement,
          sourceCourseId,
          updatedMessage,
          pageIdsToCopy,
          pageTitles
        );
        numOfSteps++;
      } else {
        updateLoadingMessage(
          "error",
          "Missing required permission to perform special copy process. You will need to fix the embedded content in the copied announcement."
        );
      }
    }

    // Check for attached and/or linked files
    const attachments = announcement.attachments;
    const hasEmbeddedFiles = announcement.message.includes(
      'data-api-returntype="File"'
    );
    if (attachments.length > 0 || hasEmbeddedFiles) {
      let copiedAnnouncementsFolder =
        await getOrCreateCopiedAnnouncementsFolder(destinationCourseId);
      console.log(`Copied Announcements folder`);
      console.log(copiedAnnouncementsFolder);

      const folderId = copiedAnnouncementsFolder.id;

      if (attachments.length > 0) {
        updateLoadingMessage(
          "loading",
          `Found attached file(s). Copying file(s) to selected course...`
        );
        updatedMessage = await copyAttachmentsAndUpdateMessage(
          destinationCourseId,
          folderId,
          updatedMessage,
          attachments
        );
      }

      if (hasEmbeddedFiles) {
        updateLoadingMessage(
          "loading",
          "Found link(s) to file in announcement message. Copying linked file(s) to selected course..."
        );
        updatedMessage = await copyLinkedFilesAndUpdateMessage(
          sourceCourseId,
          destinationCourseId,
          folderId,
          updatedMessage,
          announcement
        );
      }
    }

    updateLoadingMessage(
      "info",
      "Updating internal course links in announcement message"
    );
    updatedMessage = updatedMessage.replaceAll(
      `/courses/${sourceCourseId}/`,
      `/courses/${destinationCourseId}/`
    );
    completedSteps++;
    progressBar.style.width = `${Math.floor(
      (completedSteps * 100) / numOfSteps
    )}%`;

    updateLoadingMessage(
      "info",
      `Copying announcement ${announcementNum} of ${totalAnnouncements}: ${announcement.title}`
    );
    const data = getDataForCreateAnnouncementRequest(
      announcement,
      updatedMessage,
      announcementSettings
    );
    await createAnnouncement(destinationCourseId, data);

    updateLoadingMessage(
      "success",
      `Successfully copied announcement ${announcementNum} of ${totalAnnouncements}: ${announcement.title}`
    );
    completedSteps++;
    progressBar.style.width = `${Math.floor(
      (completedSteps * 100) / numOfSteps
    )}%`;
  }

  async function handleSetupForCopyProcessForLtiEmbeddedContent(
    announcement,
    sourceCourseId,
    message,
    pageIdsToCopy,
    pageTitles
  ) {
    const title = `${pageTitlePrefixForSpecialCopyProcess} ${announcement.title}`;
    const pageToCopy = await createPage(sourceCourseId, title, message);
    pageIdsToCopy.push(pageToCopy.page_id);
    pageTitles[pageToCopy.page_id] = title;
  }

  async function copyAttachmentsAndUpdateMessage(
    destinationCourseId,
    folderId,
    message,
    attachments
  ) {
    const BASE_URL = document.location.hostname;
    const fileIds = [];

    attachments.forEach((attachment) => fileIds.push(`${attachment.id}`));
    message += "<hr /><p>Attachments</p><ul>";
    for (const fileId of fileIds) {
      const copiedFile = await copyFile(folderId, fileId);
      const newFileId = copiedFile.id;
      message += `
        <li>
          <a class=\"image\" href=\"https://${BASE_URL}/courses/${destinationCourseId}/files/${newFileId}/download\" data-api-endpoint=\"https://${BASE_URL}/api/v1/courses/${destinationCourseId}/files/${newFileId}\" data-api-returntype=\"File\">${
        copiedFile.display_name || copiedFile.filename
      }</a>
        </li>
      `;
    }
    message += "</ul>";

    return message;
  }

  async function copyLinkedFilesAndUpdateMessage(
    sourceCourseId,
    destinationCourseId,
    folderId,
    message,
    announcement
  ) {
    const fileIds = [];

    const regularExpression = /\/files\/[0-9]+/g;
    const fileLinkMatches = [
      ...announcement.message.matchAll(regularExpression),
    ];
    const fileLinkPaths = [
      ...new Set(fileLinkMatches.map((match) => match[0])),
    ];

    fileLinkPaths.forEach((fileLinkPath) =>
      fileIds.push(fileLinkPath.replaceAll("/files/", ""))
    );
    for (const fileId of fileIds) {
      const copiedFile = await copyFile(folderId, fileId);
      const newFileId = copiedFile.id;
      message = message.replaceAll(
        `/courses/${sourceCourseId}/files/${fileId}`,
        `/courses/${destinationCourseId}/files/${newFileId}`
      );
    }

    return message;
  }

  function getDataForCreateAnnouncementRequest(
    announcement,
    updatedMessage,
    announcementSettings
  ) {
    const delayedPostingDateTime = announcementSettings?.delayedPostingDateTime;
    const isCommentingAllowed = announcementSettings?.isCommentingAllowed;
    const isInitialPostRequired = announcementSettings?.isInitialPostRequired;

    const data = {
      title: announcement.title,
      message: updatedMessage,
      allow_rating: announcement.allow_rating,
      only_graders_can_rate: announcement.only_graders_can_rate,
      sort_by_rating: announcement.sort_by_rating,
      podcast_enabled: !!announcement.podcast_url,
      podcast_has_student_posts: announcement.podcast_has_student_posts,
      is_announcement: true,
    };

    if (isCommentingAllowed) {
      data.locked = false;
      if (isInitialPostRequired) {
        data.require_initial_post = true;
      }
    } else {
      data.locked = true;
    }

    if (delayedPostingDateTime) {
      data.delayed_post_at = delayedPostingDateTime;
    }

    return data;
  }

  async function handleCopyStepsForLtiEmbeddedContent(
    progressBar,
    completedSteps,
    numOfSteps,
    sourceCourseId,
    destinationCourseId,
    pageIdsToCopy,
    pageTitles
  ) {
    updateLoadingMessage(
      "info",
      `Beginning special copy process for announcements with a special embed of LTI content`
    );
    const copyProgress = await copyPages(
      sourceCourseId,
      destinationCourseId,
      pageIdsToCopy
    );

    updateLoadingMessage(
      "info",
      `Please be patient and wait for this process to complete...`
    );
    const status = await waitForCopy(copyProgress?.progress_url);
    if (status == "completed") {
      updateLoadingMessage(
        "success",
        "Special copy process to handle updating the special embed completed successfully!"
      );
    } else {
      updateLoadingMessage(
        "error",
        "ERROR: Special copy process failed. Need to manually update embedded content in the copied announcement."
      );
    }

    let cleanupStep = 0;
    const totalCleanupsNeeded = pageIdsToCopy.length;
    for (const pageId in pageTitles) {
      cleanupStep++;
      const pageTitle = pageTitles[pageId];
      updateLoadingMessage(
        "info",
        `Beginning special copy process clean-up ${cleanupStep} of ${totalCleanupsNeeded}.`
      );

      await deletePage(sourceCourseId, pageId);
      if (status == "completed") {
        const copiedPage = await getCopiedPage(destinationCourseId, pageTitle);
        await deletePage(destinationCourseId, copiedPage.page_id);
      }

      updateLoadingMessage(
        "success",
        `Clean-up ${cleanupStep} of ${totalCleanupsNeeded} completed successfully!`
      );

      completedSteps++;
      progressBar.style.width = `${Math.floor(
        (completedSteps * 100) / numOfSteps
      )}%`;
    }
  }

  /**
   * Get the CSRF Token to use for post requests
   */
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

  /**
   * Gets the results of a request to the specified URL and
   * returns the results and header links from the request
   *
   * @param {String} url The URL of the GET request
   * @returns An Object with the results and links from the
   *   GET request
   */
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

  /**
   * Gets the results from performing a sequence of paginated
   * requests from the first to the last page.
   *
   * If a single page of results is an Array, all results will be
   * combined into a single array.
   *
   * If a single page of results is not an Array, then the result will
   * be an array of page results.
   *
   * @param {String} url The URL for the GET request
   * @returns An array with all of the results after completing
   *   the chain of paginated requests
   */
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

  /**
   * Takes in a course Id, and array of announcement Ids to get the
   * details for
   *
   * @returns the details of the announcements for the given ids in
   * an array
   */
  async function getAnnouncements(courseId, announcementIds) {
    const announcements = [];

    const BASE_URL = document.location.hostname;

    const fetches = [];
    announcementIds.forEach((id) => {
      const url = `https://${BASE_URL}/api/v1/courses/${courseId}/discussion_topics/${id}`;

      fetches.push(
        fetch(url)
          .then((response) => response.json())
          .then((data) => announcements.push(data))
          .catch((error) => {
            console.error("Error:", error);
          })
      );
    });
    await Promise.all(fetches);

    return announcements;
  }

  /**
   * Gets the copied announcements folder in the given course id.
   * If one isn't found, then it will create a new folder and
   * return the newly created folder.
   */
  async function getOrCreateCopiedAnnouncementsFolder(courseId) {
    const BASE_URL = document.location.hostname;
    const url = `https://${BASE_URL}/api/v1/courses/${courseId}/folders/by_path/unfiled/${folderNameForCopiedAnnouncementFiles}`;
    return fetch(url)
      .then((response) => response.json())
      .then(async (data) => {
        if (data.errors) {
          console.log(`Created Copied Announcements folder`);
          return await createFolder(destinationCourseId);
        } else {
          return data.pop();
        }
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  }

  /**
   * Create a new folder for the files that need to be copied
   * over for the announcement.
   */
  async function createFolder(courseId) {
    const BASE_URL = document.location.hostname;
    const url = `https://${BASE_URL}/api/v1/courses/${courseId}/folders`;
    const data = {
      name: folderNameForCopiedAnnouncementFiles,
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

  async function getCoursesWithTeacherEnrollment() {
    const BASE_URL = document.location.hostname;
    const url = `https://${BASE_URL}/api/v1/courses?enrollment_type=teacher&enrollment_state=active&per_page=100`;
    const courses = await getPaginatedRequestResults(url);
    return courses;
  }

  async function getTeacherEnrollments(courseId) {
    const BASE_URL = document.location.hostname;
    const url = `https://${BASE_URL}/api/v1/courses/${courseId}/enrollments?user_id=self&state[]=active&type[]=TeacherEnrollment`;
    const request = await getRequestLinksAndResults(url);
    return request?.results ?? [];
  }

  async function getCoursePermissions(courseId) {
    const BASE_URL = document.location.hostname;
    const url = `https://${BASE_URL}/api/v1/courses/${courseId}/permissions`;
    const permissions = await getRequestLinksAndResults(url);
    return permissions?.results;
  }

  async function copyFile(folderId, fileId) {
    const BASE_URL = document.location.hostname;
    const url = `https://${BASE_URL}/api/v1/folders/${folderId}/copy_file`;
    const data = {
      source_file_id: fileId,
      on_duplicate: "rename",
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

  async function createAnnouncement(courseId, data) {
    const BASE_URL = document.location.hostname;
    const url = `https://${BASE_URL}/api/v1/courses/${courseId}/discussion_topics`;
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

  async function createPage(courseId, title, body) {
    const BASE_URL = document.location.hostname;
    const url = `https://${BASE_URL}/api/v1/courses/${courseId}/pages`;
    const data = {
      wiki_page: {
        title: title,
        body: body,
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

  async function deletePage(courseId, pageId) {
    const BASE_URL = document.location.hostname;
    const url = `https://${BASE_URL}/api/v1/courses/${courseId}/pages/${pageId}`;

    return fetch(url, {
      method: "DELETE",
      headers: {
        "X-CSRF-Token": getCsrfToken(),
      },
    })
      .then((response) => {
        return response.json();
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  }

  async function copyPages(sourceCourseId, destinationCourseId, pageIds) {
    const BASE_URL = document.location.hostname;
    const url = `https://${BASE_URL}/api/v1/courses/${destinationCourseId}/content_migrations`;
    const data = {
      migration_type: "course_copy_importer",
      select: {
        pages: pageIds,
      },
      settings: {
        associate_with_assignment_id: null,
        insert_into_module_id: null,
        insert_into_module_position: null,
        insert_into_module_type: "pages",
        source_course_id: `${sourceCourseId}`,
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

  async function getStatus(url) {
    return (await getRequestLinksAndResults(url))?.results;
  }

  async function waitForCopy(progressUrl) {
    const WAIT_TIME = waitTimeToCheckCopyProgressStatus; // seconds
    const WAIT_TIME_MS = WAIT_TIME * 1000;
    const isCompletePromise = new Promise((resolve, reject) => {
      let isComplete = false;
      let status;
      setTimeout(async () => {
        const progress = await getStatus(progressUrl);
        if (
          progress?.workflow_state == "completed" ||
          progress?.workflow_state == "failed"
        ) {
          isComplete = true;
          status = progress?.workflow_state;
        }
        resolve([isComplete, status]);
      }, WAIT_TIME_MS);
    });

    const [isComplete, status] = await isCompletePromise;
    if (isComplete) {
      return status;
    } else {
      updateLoadingMessage(
        "loading",
        `Special copy process is still running. Checking status again in ${WAIT_TIME} seconds...`
      );
      return await waitForCopy(progressUrl);
    }
  }

  async function getCopiedPage(courseId, title) {
    const BASE_URL = document.location.hostname;
    const url = `https://${BASE_URL}/api/v1/courses/${courseId}/pages?search_term=${title}`;
    const foundPages = await getPaginatedRequestResults(url);
    if (foundPages.length > 0) {
      return foundPages[0];
    }
  }
})();
