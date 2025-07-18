// ==UserScript==
// @name         Show Soft Concluded Enrollment Status
// @namespace    https://github.com/Wilmington-University-Ed-Tech-Systems/Shared-Custom-Developments/tree/main/Canvas%20LMS/Theme%20Mods%20and%20User%20Scripts/Show%20Soft%20Concluded%20Enrollment%20Status
// @version      1.0.0
// @description  Shows a lock icon next to users in the People list if they have an active enrollment, but it is soft-concluded based on enrollment dates.
// @author       James Sekcienski, Ed Tech Systems, Wilmington University
// @match      https://*.instructure.com/courses/*/users
// ==/UserScript==

"use strict";

(async () => {
  if (/^\/courses\/[0-9]+\/users\??[^\/]*\/?$/.test(window.location.pathname)) {
    const permissions = await getCoursePermissions();
    const hasRequiredPermissions =
      hasRequiredPermissionsForFeature(permissions);
    if (!hasRequiredPermissions) {
      return;
    }

    const courseId = window.location.pathname.split("/")[2];
    const course = await getCourseDetails(courseId);
    const sections = await getSections(courseId);
    if (sections) {
      course.sections = sections;
    }
    const termId = course?.enrollment_term_id;
    const term = await getEnrollmentTerm(termId);
    if (term) {
      course.term = term;
    }
    const users = await getCourseUsers(courseId);
    waitForRoster(course, users);
  }

  async function getCoursePermissions() {
    const courseId = window.location.pathname.split("/")[2];
    const url = `/api/v1/courses/${courseId}/permissions`;
    return fetch(url)
      .then((response) => response.json())
      .catch((error) => console.error(error));
  }

  function hasRequiredPermissionsForFeature(permissions) {
    return permissions?.read_as_admin && !permissions?.participate_as_student;
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

  async function getCourseUsers(courseId, convertToDict = true) {
    const url = `/api/v1/courses/${courseId}/users?include[]=enrollments&per_page=100`;
    const users = await getPaginatedRequestResults(url);
    if (!convertToDict) {
      return users;
    }

    const usersById = {};
    for (const user of users) {
      usersById[`${user?.id}`] = user;
    }
    return usersById;
  }

  function waitForRoster(course, users) {
    const roster = document.querySelector("table.roster");
    if (roster) {
      watchForUserRows(course, users);
      return;
    }

    const observer = new MutationObserver((mutations) => {
      if (
        !mutations.some((mutation) => (mutation?.addedNodes?.length ?? 0) > 0)
      ) {
        return;
      }

      if (document.querySelector("table.roster")) {
        watchForUserRows(course, users);
        observer.disconnect();
        return;
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function watchForUserRows(course, users) {
    const userRows = [
      ...document.querySelectorAll(
        `table.roster > tbody > tr.rosterUser:not(.wu-soft-concluded-checked)`
      ),
    ];
    for (const row of userRows) {
      updateSoftConcludedStatus(row, course, users);
    }

    const observer = new MutationObserver((mutations) => {
      if (
        !mutations.some((mutation) => (mutation?.addedNodes?.length ?? 0) > 0)
      ) {
        return;
      }

      const addedUserRows = [
        ...document.querySelectorAll(
          `table.roster > tbody > tr.rosterUser:not(.wu-soft-concluded-checked)`
        ),
      ];
      observer.disconnect();
      for (const row of addedUserRows) {
        updateSoftConcludedStatus(row, course, users);
      }
      observer.observe(document.body, { childList: true, subtree: true });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function updateSoftConcludedStatus(row, course, users) {
    const userId = row?.id?.replace("user_", "");
    const user = users[userId];
    const enrollments = user?.enrollments ?? [];
    if (!hasActiveEnrollment(course, enrollments)) {
      addSoftConcludedIcon(row);
    }
    row.classList.add("wu-soft-concluded-checked");
  }

  function hasActiveEnrollment(course, enrollments) {
    const currentDate = new Date();
    return enrollments.some((enrollment) => {
      const enrollmentState = enrollment?.enrollment_state ?? "";
      if (enrollmentState != "active") {
        return false;
      }

      // Check User Enrollment Date
      const endAt = enrollment?.end_at;
      if (endAt) {
        return new Date(endAt) > currentDate;
      }

      // Check Override Term Enrollment Date
      // Non-student overrides will override course and section specific dates if they provide longer access
      const role = enrollment?.role ?? "";
      const overrides = course?.term?.overrides ?? {};
      const hasOverrideForRole = overrides.hasOwnProperty(role);
      const overrideEndAtDate =
        hasOverrideForRole && overrides[role]?.end_at
          ? new Date(overrides[role]?.end_at)
          : null; // When null the term end date should be used instead
      if (
        hasOverrideForRole &&
        role != "StudentEnrollment" &&
        overrideEndAtDate &&
        new Date(overrideEndAtDate) > currentDate
      ) {
        return true;
      }

      // Check Section Enrollment Date
      if (
        course?.sections &&
        course.sections.hasOwnProperty(`${enrollment?.course_section_id}`) &&
        course.sections[`${enrollment?.course_section_id}`]
          ?.restrict_enrollments_to_section_dates
      ) {
        const sectionStartAt =
          course.sections[`${enrollment.course_section_id}`]?.start_at;
        const sectionEndAt =
          course.sections[`${enrollment.course_section_id}`]?.end_at;
        if (sectionStartAt && sectionEndAt) {
          return new Date(sectionEndAt) > currentDate;
        }
      }

      if (course?.restrict_enrollments_to_course_dates) {
        // Check Course Enrollment Date
        const courseEndAt = course?.end_at;
        if (courseEndAt) {
          return new Date(courseEndAt) > currentDate;
        } else {
          return true;
        }
      } else {
        // Check Override Term Enrollment Date
        if (hasOverrideForRole && overrideEndAtDate) {
          return new Date(overrideEndAtDate) > currentDate;
        }

        // Check General Term Enrollment Date
        const termEndAt = course?.term?.end_at;
        if (termEndAt) {
          return new Date(termEndAt) > currentDate;
        } else {
          return true;
        }
      }
    });
  }

  function addSoftConcludedIcon(row) {
    const nameAnchor = row.querySelector("td > a.roster_user_name");
    if (!nameAnchor) {
      console.warn("Missing user name link");
      return;
    }

    nameAnchor.insertAdjacentHTML(
      "afterbegin",
      `
      <i class='icon-line icon-lock' title='This enrollment is concluded'></i>
    `
    );
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
