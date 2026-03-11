// ==UserScript==
// @name         Admin Manage User Emails
// @namespace    https://github.com/Wilmington-University-Ed-Tech-Systems/Shared-Custom-Developments/tree/main/Canvas%20LMS/Theme%20Mods%20and%20User%20Scripts/Admin%20Manage%20User%20Emails
// @version      1.0.0
// @description  Adds ability to manage the emails for a user from the user account details page.
// @author       James Sekcienski, Ed Tech Systems, Wilmington University
// @match      https://*.instructure.com/accounts/*/users/*
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

  if (/^\/accounts\/[0-9]+\/users\/[0-9]+?/.test(window.location.pathname)) {
    const hasPermission = await hasNecessaryPermissions();
    if (hasPermission) {
      addCustomStyleRules();
      addManageEmailsButton();
    }
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

  async function hasNecessaryPermissions() {
    const accountId = window.location.pathname.split("/")[2];
    const permissions = await getAccountPermissions(accountId);
    return (
      permissions?.become_user &&
      permissions?.manage_user_logins &&
      permissions?.read_email_addresses
    );
  }

  async function getAccountPermissions(accountId) {
    const WINDOW_PROTOCOL = window.location.protocol;
    const BASE_URL = document.location.hostname;
    const url = `${WINDOW_PROTOCOL}//${BASE_URL}/api/v1/accounts/${accountId}/permissions`;
    const pageResponse = await getRequestLinksAndResults(url);

    if (pageResponse) {
      return pageResponse?.results;
    } else {
      return {};
    }
  }

  function addManageEmailsButton() {
    const rightSide = document.getElementById("right-side");
    if (rightSide) {
      const button = createManageEmailButton();
      rightSide.insertAdjacentElement("beforeEnd", button);
      addManageEmailsDialog();
    }
  }

  function createManageEmailButton() {
    const button = document.createElement("button");
    button.innerHTML = `<i class="icon-line icon-edit"></i> Manage Emails`;
    button.classList.add("btn", "button-sidebar-wide");
    button.addEventListener("click", () => {
      openManageEmailsDialog();
    });

    return button;
  }

  function addManageEmailsDialog() {
    const userId = window.location.pathname.split("/")[4];
    document.body.insertAdjacentElement(
      "beforeend",
      createManageEmailsDialog(userId),
    );
  }

  function openManageEmailsDialog() {
    const userId = window.location.pathname.split("/")[4];
    const table = document.querySelector("#wu-manage-emails-dialog table");
    loadEmails(table, userId);

    const dialog = document.getElementById("wu-manage-emails-dialog");
    dialog.showModal();
  }

  function createManageEmailsDialog(userId) {
    const dialog = document.createElement("dialog");
    dialog.id = "wu-manage-emails-dialog";
    dialog.classList.add("wu-dialog");
    dialog.style.width = "70vw";
    dialog.style.height = "70vh";

    const dialogContentWrapper = document.createElement("div");
    dialogContentWrapper.classList.add("wu-dialog-content-wrapper");

    const dialogHeader = createManageEmailsDialogHeader(dialog);
    const dialogBody = createManageEmailsDialogBody(userId);
    const dialogFooter = createManageEmailsDialogFooter(dialog);

    dialogContentWrapper.append(dialogHeader);
    dialogContentWrapper.append(dialogBody);
    dialogContentWrapper.append(dialogFooter);
    dialog.append(dialogContentWrapper);

    return dialog;
  }

  function createManageEmailsDialogHeader(dialog) {
    const headerContainer = document.createElement("div");
    headerContainer.classList.add("wu-dialog-header");

    const heading = document.createElement("h2");
    heading.innerText = "Manage User Emails";

    const closeButton = document.createElement("button");
    closeButton.id = "wu-manage-emails-dialog-close-btn";
    closeButton.classList.add(
      "Button",
      "Button--icon-action",
      "wu-dialog-close",
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

  function createManageEmailsDialogBody(userId) {
    const bodyWrapper = document.createElement("div");
    bodyWrapper.classList.add("wu-dialog-body");

    const emailsSection = document.createElement("section");
    const emailsHeading = document.createElement("h3");
    emailsHeading.innerText = "User Email(s)";
    const emailsTable = createEmailsTable();
    loadEmails(emailsTable, userId);
    emailsSection.append(emailsHeading);
    emailsSection.append(emailsTable);
    bodyWrapper.append(emailsSection);

    return bodyWrapper;
  }

  function createManageEmailsDialogFooter(dialog) {
    const footer = document.createElement("div");
    footer.classList.add("wu-dialog-footer");

    const footerButtonWrapper = document.createElement("div");
    footerButtonWrapper.style.display = "flex";
    footerButtonWrapper.style.flex = "0 0 auto";
    footerButtonWrapper.style.justifyContent = "flex-end";
    footerButtonWrapper.style.padding = "0.75rem";

    const cancelButton = document.createElement("button");
    cancelButton.id = "wu-manage-emails-dialog-cancel-btn";
    cancelButton.classList.add("Button");
    cancelButton.innerText = "Close";
    cancelButton.style.marginRight = "0.75rem";
    cancelButton.addEventListener("click", () => {
      dialog.close();
    });

    footerButtonWrapper.append(cancelButton);
    footer.append(footerButtonWrapper);
    return footer;
  }

  function createEmailsTable() {
    const table = document.createElement("table");
    table.classList.add("ic-Table", "ic-Table--hover-row", "ic-Table--striped");
    table.id = "wu-user-emails";

    table.innerHTML = `
      <thead>
        <tr>
          <th>Email Address</th>
          <th>Default</th>
          <th>Confirm</th>
          <th>Delete</th>
        </tr>
      </thead>
      <tbody>
      </tbody>
    `;

    return table;
  }

  async function loadEmails(table, userId) {
    const communicationChannels = await getCommunicationChannels(userId);
    const tbody = table.querySelector("tbody");
    if (!tbody) {
      console.warn("Email table missing table body. Unable to load emails.");
      return;
    }

    tbody.innerHTML = "";
    for (const commChannel of communicationChannels) {
      if (commChannel?.type != "email") {
        continue;
      }

      const workflowState = commChannel?.workflow_state;
      if (workflowState != "active" && workflowState != "unconfirmed") {
        continue;
      }

      addEmailRow(tbody, commChannel);
    }
  }

  async function getCommunicationChannels(userId) {
    const WINDOW_PROTOCOL = window.location.protocol;
    const BASE_URL = document.location.hostname;
    const url = `${WINDOW_PROTOCOL}//${BASE_URL}/api/v1/users/${userId}/communication_channels`;
    const communicationChannels = await getPaginatedRequestResults(url);

    return communicationChannels;
  }

  function addEmailRow(tbody, emailDetails) {
    const row = document.createElement("tr");

    const emailTd = document.createElement("td");
    emailTd.dataset.id = emailDetails?.id;
    emailTd.innerText = emailDetails?.address;
    row.append(emailTd);

    const defaultTd = document.createElement("td");
    const defaultButton = createSetDefaultButton(emailDetails);
    defaultTd.append(defaultButton);
    row.append(defaultTd);

    const confirmTd = document.createElement("td");
    if (emailDetails?.workflow_state == "active") {
      confirmTd.innerText = "Confirmed";
    } else if (emailDetails?.workflow_state == "unconfirmed") {
      const confirmButton = createConfirmButton(emailDetails);
      confirmTd.append(confirmButton);
    }
    row.append(confirmTd);

    const deleteTd = document.createElement("td");
    const deleteButton = createDeleteButton(emailDetails);
    deleteTd.append(deleteButton);
    row.append(deleteTd);

    tbody.append(row);
  }

  function createSetDefaultButton(emailDetails) {
    const button = document.createElement("button");
    button.classList.add("btn", "wu-default-email-button");
    button.title =
      emailDetails?.position == 1
        ? "Currently the default email"
        : "Set this as the default";
    if (emailDetails?.position == 1) {
      button.disabled = true;
    }
    button.innerHTML = `<i class='icon-line icon-star'></i>`;
    button.addEventListener("click", async () => {
      const result = await editUserDefaultEmail(emailDetails);
      console.log(result);
      if (!result || result?.email != emailDetails?.address) {
        return;
      }

      const defaultEmailButtons = [
        ...document.querySelectorAll("button.wu-default-email-button"),
      ];
      for (const currButton of defaultEmailButtons) {
        if (currButton == button) {
          button.title = "Currently the default email";
          button.disabled = true;
        } else {
          currButton.title = "Set this as the default";
          currButton.disabled = false;
        }
      }
    });

    return button;
  }

  function createConfirmButton(emailDetails) {
    const button = document.createElement("button");
    button.classList.add("btn");
    button.title = "Confirm this email";
    button.innerHTML = `<i class='icon-line icon-certified'></i>`;
    button.addEventListener("click", async () => {
      const result = await confirmEmail(emailDetails);
      if (!result || result?.workflow_state != "active") {
        return;
      }

      const parentTd = button?.parentElement;
      button.remove();
      parentTd.innerText = "Confirmed";
    });

    return button;
  }

  function createDeleteButton(emailDetails) {
    const button = document.createElement("button");
    button.classList.add("btn");
    button.title = "Delete this email";
    button.innerHTML = `<i class='icon-line icon-trash'></i>`;
    button.addEventListener("click", async () => {
      const result = await deleteEmail(emailDetails);
      if (
        !result ||
        result?.workflow_state == "unconfirmed" ||
        result?.workflow_state == "active"
      ) {
        return;
      }

      button?.parentElement?.parentElement.remove();
    });

    return button;
  }

  async function editUserDefaultEmail(emailDetails) {
    const WINDOW_PROTOCOL = window.location.protocol;
    const BASE_URL = document.location.hostname;
    const url = `${WINDOW_PROTOCOL}//${BASE_URL}/api/v1/users/${emailDetails?.user_id}?user[email]=${emailDetails?.address}`;

    return fetch(url, {
      method: "PUT",
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

  async function confirmEmail(emailDetails) {
    const deleteResult = await deleteEmail(emailDetails);
    if (!deleteResult || deleteResult?.workflow_state == "unconfirmed") {
      console.warn(
        "Failed to delete communication channel so it can be confirmed",
      );
      return;
    }

    const createResult = await createEmail(emailDetails);
    if (!createResult || createResult?.workflow_state != "active") {
      console.warn("Failed to create confirmed email");
      return;
    }

    return createResult;
  }

  async function createEmail(emailDetails) {
    const WINDOW_PROTOCOL = window.location.protocol;
    const BASE_URL = document.location.hostname;
    const url = `${WINDOW_PROTOCOL}//${BASE_URL}/api/v1/users/${emailDetails?.user_id}/communication_channels?communication_channel[address]=${emailDetails?.address}&communication_channel[type]=email&skip_confirmation=true`;

    return fetch(url, {
      method: "POST",
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

  async function deleteEmail(emailDetails) {
    const WINDOW_PROTOCOL = window.location.protocol;
    const BASE_URL = document.location.hostname;
    const url = `${WINDOW_PROTOCOL}//${BASE_URL}/api/v1/users/${emailDetails?.user_id}/communication_channels/${emailDetails?.id}`;

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
        }),
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
